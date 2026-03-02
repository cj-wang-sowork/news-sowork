/**
 * NewsFlow — AI Analysis Service (Google News RSS + Gemini LLM)
 * Flow: User query → Google News RSS search → Gemini format as timeline → Store in DB
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { eq, desc, like, sql } from "drizzle-orm";

// ─── Google News RSS Search ───────────────────────────────────────────────────

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
}

/**
 * Search Google News RSS for a given query.
 * Google News RSS: https://news.google.com/rss/search?q=QUERY&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
 */
export async function searchGoogleNews(query: string, targetCount = 50): Promise<{
  items: NewsItem[];
  rawText: string;
}> {
  // 擴大時間範圍至 30 天，提升台灣在地新聞覆蓋率
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const afterDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  // 生成多個搜尋變體：繁中主詞、加台灣地域限定、加新聞關鍵詞、英文
  const queryVariants = new Set<string>();
  queryVariants.add(query);
  // 加入「台灣」地域限定詞（若查詢中未包含）
  if (!query.includes('台灣') && !query.includes('Taiwan')) {
    queryVariants.add(`${query} 台灣`);
  }
  // 加入「新聞」關鍵詞強化搜尋
  queryVariants.add(`${query} 新聞`);
  // 英文版本（取前 20 字）
  queryVariants.add(query.length <= 20 ? query : query.slice(0, 20));

  const allItems: NewsItem[] = [];

  for (const q of Array.from(queryVariants)) {
    if (allItems.length >= targetCount * 2) break; // 已足夠，不繼續搜尋
    const encodedQuery = encodeURIComponent(`${q} after:${afterDate}`);
    // 多語言 feed：繁中（台灣）、繁中（香港）、英文
    const feeds = [
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=HK&ceid=HK:zh-Hant`,
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`,
    ];

    for (const feedUrl of feeds) {
      try {
        const resp = await fetch(feedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NewsFlowBot/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) continue;

        const xml = await resp.text();
        const items = parseRssXml(xml);
        allItems.push(...items);
      } catch (err) {
        console.warn(`[GoogleNews] Failed to fetch ${feedUrl}:`, (err as Error).message);
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Sort by date (newest first)
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const top = deduped.slice(0, Math.max(targetCount, 50));

  // Build raw text summary for LLM
  const rawText = top
    .map((item, i) => `[${i + 1}] ${item.publishedAt} — ${item.source}\n標題: ${item.title}\n摘要: ${item.description}`)
    .join("\n\n");

  console.log(`[GoogleNews] Found ${top.length} articles (target: ${targetCount}) for query: "${query}"`);
  return { items: top, rawText };
}

function parseRssXml(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Extract <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";

    const title = extractTag(block, "title") ?? "";
    const link = extractTag(block, "link") ?? extractTag(block, "guid") ?? "";
    const pubDate = extractTag(block, "pubDate") ?? "";
    const description = extractTag(block, "description") ?? "";
    const source = extractTag(block, "source") ?? extractDomain(link);

    if (!title || !link) continue;

    items.push({
      title: cleanHtml(title),
      url: link.trim(),
      source: cleanHtml(source),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      description: cleanHtml(description).slice(0, 300),
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "si");
  const m = regex.exec(xml);
  return m ? (m[1] ?? "").trim() : null;
}

function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

// ─── Format News into Timeline using Gemini ───────────────────────────────────
interface TurningPointData {
  title: string;
  title_en: string;
  summary: string;
  date_label: string;
  heat_level: "extreme" | "high" | "medium" | "low";
  is_active: boolean;
  keywords: string[];
  article_count: number;
  media_count: number;
  source_urls: string[];
}

interface TimelineAnalysisResult {
  turning_points: TurningPointData[];
  tags: string[]; // 議題標籤，如 ["AI","科技","台灣"]
  topic_title: string; // 議題簡潔標題
}

async function formatTimelineFromNews(
  query: string,
  newsText: string,
  newsItems: NewsItem[]
): Promise<TimelineAnalysisResult> {
  const sourceUrls = newsItems.slice(0, 15).map((item) => item.url);

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a news timeline analyst. Given a list of RECENT news articles (from the past 7 days) about a topic, identify and structure the major developments into a timeline. IMPORTANT: Only analyze events that are described in the provided articles. Do NOT invent historical background or events from years ago. Each turning point must correspond to actual news from the provided articles. Output structured JSON only.`,
      },
      {
        role: "user",
        content: `Topic: "${query}"

Recent News Articles (past 7 days):
${newsText}

Based ONLY on these recent articles:
1. Extract 3 to 6 major developments from this story. Order them from oldest to newest based on article publish dates.
2. Generate 3-6 topic tags in Traditional Chinese (e.g. "AI", "台灣", "外交", "科技", "軍事", "經濟", "能源", "選舉")
3. Generate a concise topic title in Traditional Chinese (10 characters or less)

CRITICAL RULES:
- ONLY describe events from the provided articles. Do NOT add historical context from years ago.
- date_label MUST be the actual publish date of the article (e.g., "2026年3月2日"), NOT a historical event date.
- If articles are all from this week, all date_labels should be from this week.

For each turning point:
- title: concise title in Traditional Chinese (繁體中文)
- title_en: concise title in English  
- summary: 2-3 sentence summary in Traditional Chinese explaining what happened and why it matters
- date_label: the publish date of the main article for this event (e.g., "2026年3月2日")
- heat_level: "extreme" (global crisis), "high" (major international news), "medium" (regional significance), "low" (minor development)
- is_active: true if this is the current/ongoing situation (most recent turning point)
- keywords: 3-5 Chinese keywords for this event
- article_count: number of provided articles relevant to this turning point
- media_count: number of different media sources in the provided articles
- source_urls: up to 3 relevant URLs from the provided articles`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "timeline_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topic_title: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            turning_points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  title_en: { type: "string" },
                  summary: { type: "string" },
                  date_label: { type: "string" },
                  heat_level: { type: "string", enum: ["extreme", "high", "medium", "low"] },
                  is_active: { type: "boolean" },
                  keywords: { type: "array", items: { type: "string" } },
                  article_count: { type: "number" },
                  media_count: { type: "number" },
                  source_urls: { type: "array", items: { type: "string" } },
                },
                required: [
                  "title", "title_en", "summary", "date_label",
                  "heat_level", "is_active", "keywords",
                  "article_count", "media_count", "source_urls"
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["topic_title", "tags", "turning_points"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = (typeof content === "string" ? JSON.parse(content) : content) as TimelineAnalysisResult;
  return parsed ?? { turning_points: [], tags: [], topic_title: query };
}

// ─── Parse date from date_label string ──────────────────────────────────────────────────────────────
function parseDateFromLabel(dateLabel: string): Date {
  // 嘗試解析常見格式："2025年6月13日"、"2026年2月底"、"2024年底"
  const yearMonthDay = dateLabel.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (yearMonthDay) {
    return new Date(Number(yearMonthDay[1]), Number(yearMonthDay[2]) - 1, Number(yearMonthDay[3]));
  }
  const yearMonth = dateLabel.match(/(\d{4})年(\d{1,2})月/);
  if (yearMonth) {
    return new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 15);
  }
  const yearOnly = dateLabel.match(/(\d{4})年/);
  if (yearOnly) {
    return new Date(Number(yearOnly[1]), 6, 1);
  }
  return new Date();
}

// ─── Store Timeline in Database (增量新增，不清除舊轉折點) ─────────────────────
async function storeTimeline(
  topicId: number,
  turningPointsData: TurningPointData[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 取得現有轉折點標題，用於去重
  const existingTPs = await db
    .select({ title: turningPoints.title, dateLabel: turningPoints.dateLabel })
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topicId));
  const existingTitles = new Set(existingTPs.map(tp => tp.title));
  const existingDateLabels = new Set(existingTPs.map(tp => tp.dateLabel));

  // 過濾掉日期超過 30 天的轉折點（避免儲存歷史背景）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentData = turningPointsData.filter(point => {
    const eventDate = parseDateFromLabel(point.date_label);
    return eventDate >= thirtyDaysAgo;
  });
  if (recentData.length < turningPointsData.length) {
    console.log(`[Timeline] Filtered out ${turningPointsData.length - recentData.length} old turning points (>30 days)`);
  }
  // 如果過濾後沒有資料，使用全部資料（避免全空白）
  const dataToStore = recentData.length > 0 ? recentData : turningPointsData;

  // 取得目前最大 sortOrder
  const [maxOrderRow] = await db
    .select({ maxOrder: sql<number>`MAX(${turningPoints.sortOrder})` })
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topicId));
  let nextSortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  for (const point of dataToStore) {
    // 去重：標題相同或日期標籤相同則跳過
    if (existingTitles.has(point.title) || existingDateLabels.has(point.date_label)) {
      console.log(`[Timeline] Skipping duplicate turning point: "${point.title}"`);
      continue;
    }

    // 解析事件日期
    const eventDate = parseDateFromLabel(point.date_label);

    const newPoint: InsertTurningPoint = {
      topicId,
      title: point.title,
      titleEn: point.title_en,
      summary: point.summary,
      dateLabel: point.date_label,
      eventDate,
      articleCount: Math.max(1, Math.round(point.article_count)),
      mediaCount: Math.max(1, Math.round(point.media_count)),
      heatLevel: point.heat_level,
      isActive: point.is_active ? 1 : 0,
      sortOrder: nextSortOrder++,
    };

    await db.insert(turningPoints).values(newPoint);

    // 取得剛插入的轉折點 ID
    const [latestTP] = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topicId))
      .orderBy(desc(turningPoints.createdAt))
      .limit(1);
    if (!latestTP) continue;

    // 儲存來源文章
    const sourceUrls = point.source_urls.slice(0, 3);
    for (const url of sourceUrls) {
      if (!url || url.length < 10) continue;
      try {
        await db.insert(newsArticles).values({
          title: `${point.title} — 相關報導`,
          url,
          source: extractDomain(url),
          publishedAt: eventDate,
          topicId,
          turningPointId: latestTP.id,
          language: "zh-TW",
        });
      } catch {
        // Ignore duplicate URL errors
      }
    }

    // 更新去重集合
    existingTitles.add(point.title);
    existingDateLabels.add(point.date_label);
  }
}

// ─── Build Topic Timeline (Full Pipeline) ────────────────────────────────────────────
export async function buildTopicTimeline(query: string): Promise<{
  topic: typeof topics.$inferSelect | null;
  turningPointsList: Array<typeof turningPoints.$inferSelect & { news: Array<typeof newsArticles.$inferSelect> }>;
} | null> {
  const db = await getDb();
  if (!db) return null;

  console.log(`[Timeline] Building timeline for: "${query}"`);

  // Step 1: Check if topic already has a fresh timeline (within 1 hour)
  const existingTopics = await db
    .select()
    .from(topics)
    .where(like(topics.query, `%${query}%`))
    .limit(1);

  let topic = existingTopics[0] ?? null;

  if (topic) {
    const existingTPs = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topic.id))
      .limit(1);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isFresh = topic.lastUpdated && topic.lastUpdated > oneHourAgo;

    if (existingTPs.length > 0 && isFresh) {
      console.log(`[Timeline] Using cached timeline for: "${query}"`);
      const tpList = await db
        .select()
        .from(turningPoints)
        .where(eq(turningPoints.topicId, topic.id))
        .orderBy(turningPoints.sortOrder);

      const result = await Promise.all(
        tpList.map(async (tp) => {
          const news = await db
            .select()
            .from(newsArticles)
            .where(eq(newsArticles.turningPointId, tp.id))
            .orderBy(desc(newsArticles.publishedAt))
            .limit(5);
          return { ...tp, news };
        })
      );

      return { topic, turningPointsList: result };
    }
  }

  // Step 2: Create or update topic
  if (!topic) {
    // Generate clean slug: use pinyin-like encoding for Chinese, fallback to timestamp
    const cleanQuery = query
      .replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/g, (match) => {
        // Convert Chinese characters to their Unicode code points as hex
        return Array.from(match)
          .map((c) => c.codePointAt(0)?.toString(16) ?? "")
          .join("");
      })
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const slug = `${cleanQuery || "topic"}-${Date.now()}`;

    await db.insert(topics).values({
      slug,
      query,
      heatLevel: "medium",
      trendDirection: "stable",
    });

    const newTopics = await db
      .select()
      .from(topics)
      .where(like(topics.query, `%${query}%`))
      .limit(1);
    topic = newTopics[0] ?? null;
  }

  if (!topic) return null;

  // Step 3: Search Google News RSS
  console.log(`[Timeline] Searching Google News for: "${query}"`);
  const { items: newsItems, rawText } = await searchGoogleNews(query);

  if (newsItems.length === 0) {
    console.warn(`[Timeline] No news found for: "${query}"`);
    return { topic, turningPointsList: [] };
  }

  console.log(`[Timeline] Found ${newsItems.length} articles, formatting timeline...`);

  // Step 4: Format into timeline using Gemini
  const analysisResult = await formatTimelineFromNews(query, rawText, newsItems);
  const turningPointsData = analysisResult.turning_points;
  const topicTags = analysisResult.tags ?? [];
  const topicTitle = analysisResult.topic_title || query;
  console.log(`[Timeline] Detected ${turningPointsData.length} turning points, tags: ${topicTags.join(', ')}`);

  // Step 5: Update topic stats + tags
  const totalArticles = turningPointsData.reduce((sum, tp) => sum + tp.article_count, 0);
  const maxMedia = Math.max(...turningPointsData.map((tp) => tp.media_count), 0);
  const maxHeat = turningPointsData.some((tp) => tp.heat_level === "extreme")
    ? "extreme"
    : turningPointsData.some((tp) => tp.heat_level === "high")
    ? "high"
    : "medium";

  await db
    .update(topics)
    .set({
      totalArticles,
      totalMedia: maxMedia,
      heatLevel: maxHeat,
      lastUpdated: new Date(),
      // 儲存標籤（JSON 字串）
      tags: JSON.stringify(topicTags),
      // 如果標題是預設查詢，更新為 AI 生成的簡潔標題
      ...(topic.query === query && topicTitle !== query ? { query: topicTitle } : {}),
    })
    .where(eq(topics.id, topic.id));

  // Step 6: Store timeline in DB
  await storeTimeline(topic.id, turningPointsData);

  // Step 7: Return complete timeline
  const tpList = await db
    .select()
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topic.id))
    .orderBy(desc(turningPoints.eventDate)); // 最新轉折點在最前

  const result = await Promise.all(
    tpList.map(async (tp) => {
      const news = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.turningPointId, tp.id))
        .orderBy(desc(newsArticles.publishedAt))
        .limit(5);
      return { ...tp, news };
    })
  );

  console.log(`[Timeline] Done! ${result.length} turning points stored.`);
  return { topic, turningPointsList: result };
}

// ─── Generate AI Stance Response ─────────────────────────────────────────────
export async function generateStanceResponse(params: {
  topicTitle: string;
  topicSummary: string;
  role: string;
  responseType: "press" | "social" | "memo";
  language?: string;
}): Promise<string> {
  const { topicTitle, topicSummary, role, responseType, language = "zh-TW" } = params;

  const typeInstructions = {
    press: "a formal press release (新聞稿)",
    social: "a social media post (社群媒體貼文)",
    memo: "an internal decision memo (內部決策備忘錄)",
  };

  const langInstruction =
    language === "zh-TW" || language === "zh-CN"
      ? "Respond in Traditional Chinese (繁體中文)."
      : `Respond in ${language}.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert communications strategist. ${langInstruction} Generate ${typeInstructions[responseType]} from the perspective of the specified role, based on the given news event context. Be realistic, professional, and appropriate to the role's interests and concerns.`,
      },
      {
        role: "user",
        content: `News Event: "${topicTitle}"\n\nContext: ${topicSummary}\n\nRole/Perspective: ${role}\n\nGenerate a ${typeInstructions[responseType]} from this perspective. Keep it concise but impactful.`,
      },
    ],
  });

  return (response.choices[0]?.message?.content as string) ?? "無法生成回覆，請稍後再試。";
}
