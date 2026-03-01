/**
 * NewsFlow — AI Analysis Service (Google News RSS + Gemini LLM)
 * Flow: User query → Google News RSS search → Gemini format as timeline → Store in DB
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { eq, desc, like } from "drizzle-orm";

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
export async function searchGoogleNews(query: string): Promise<{
  items: NewsItem[];
  rawText: string;
}> {
  // Build multiple search queries for better coverage
  const queries = [
    query,
    // Add English version for international coverage
    query.length <= 20 ? query : query.slice(0, 20),
  ];

  const allItems: NewsItem[] = [];

  for (const q of queries) {
    const encodedQuery = encodeURIComponent(q);
    // Try multiple language feeds
    const feeds = [
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`,
    ];

    for (const feedUrl of feeds) {
      try {
        const resp = await fetch(feedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NewsFlowBot/1.0)",
          },
          signal: AbortSignal.timeout(8000),
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

  const top = deduped.slice(0, 30);

  // Build raw text summary for LLM
  const rawText = top
    .map((item, i) => `[${i + 1}] ${item.publishedAt} — ${item.source}\n標題: ${item.title}\n摘要: ${item.description}`)
    .join("\n\n");

  console.log(`[GoogleNews] Found ${top.length} articles for query: "${query}"`);
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

async function formatTimelineFromNews(
  query: string,
  newsText: string,
  newsItems: NewsItem[]
): Promise<TurningPointData[]> {
  const sourceUrls = newsItems.slice(0, 15).map((item) => item.url);

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a news timeline analyst. Given a list of recent news articles about a topic, identify and structure the major turning points into a chronological timeline. Each turning point should represent a significant development or shift in the story. Output structured JSON only.`,
      },
      {
        role: "user",
        content: `Topic: "${query}"

Recent News Articles:
${newsText}

Based on these articles, extract 3 to 6 major turning points from this story. Order them chronologically from oldest to newest. For each turning point:
- title: concise title in Traditional Chinese (繁體中文)
- title_en: concise title in English  
- summary: 2-3 sentence summary in Traditional Chinese explaining what happened and why it matters
- date_label: specific date or period (e.g., "2025年6月13日", "2026年2月底")
- heat_level: "extreme" (global crisis), "high" (major international news), "medium" (regional significance), "low" (minor development)
- is_active: true if this is the current/ongoing situation (most recent turning point)
- keywords: 3-5 Chinese keywords for this event
- article_count: estimated number of news articles about this event (realistic number based on coverage)
- media_count: estimated number of media outlets covering this (realistic number)
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
          required: ["turning_points"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return (parsed?.turning_points as TurningPointData[]) ?? [];
}

// ─── Store Timeline in Database ───────────────────────────────────────────────
async function storeTimeline(
  topicId: number,
  turningPointsData: TurningPointData[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Clear existing turning points for this topic (re-analysis)
  await db.delete(turningPoints).where(eq(turningPoints.topicId, topicId));

  for (let i = 0; i < turningPointsData.length; i++) {
    const point = turningPointsData[i]!;

    const newPoint: InsertTurningPoint = {
      topicId,
      title: point.title,
      titleEn: point.title_en,
      summary: point.summary,
      dateLabel: point.date_label,
      eventDate: new Date(),
      articleCount: Math.max(1, Math.round(point.article_count)),
      mediaCount: Math.max(1, Math.round(point.media_count)),
      heatLevel: point.heat_level,
      isActive: point.is_active ? 1 : 0,
      sortOrder: i,
    };

    await db.insert(turningPoints).values(newPoint);

    // Get the inserted turning point ID
    const insertedTPs = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topicId))
      .orderBy(desc(turningPoints.createdAt))
      .limit(turningPointsData.length);

    const tpRecord = insertedTPs[insertedTPs.length - 1 - i];
    if (!tpRecord) continue;

    // Store source articles
    const sourceUrls = point.source_urls.slice(0, 3);
    for (const url of sourceUrls) {
      if (!url || url.length < 10) continue;
      try {
        await db.insert(newsArticles).values({
          title: `${point.title} — 相關報導`,
          url,
          source: extractDomain(url),
          publishedAt: new Date(),
          topicId,
          turningPointId: tpRecord.id,
          language: "zh-TW",
        });
      } catch {
        // Ignore duplicate URL errors
      }
    }
  }
}

// ─── Build Topic Timeline (Full Pipeline) ────────────────────────────────────
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
  const turningPointsData = await formatTimelineFromNews(query, rawText, newsItems);
  console.log(`[Timeline] Detected ${turningPointsData.length} turning points`);

  // Step 5: Update topic stats
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
    })
    .where(eq(topics.id, topic.id));

  // Step 6: Store timeline in DB
  await storeTimeline(topic.id, turningPointsData);

  // Step 7: Return complete timeline
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
