/**
 * NewsFlow — AI Analysis Service (Google News RSS + Gemini LLM)
 * Flow: User query → Google News RSS search → Gemini format as timeline → Store in DB
 */

import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { eq, desc, like, sql } from "drizzle-orm";

// ─── Perplexity Search (補充來源) ───────────────────────────────────────────────

/**
 * 使用 Perplexity sonar 模型搜尋新聞，作為 Google News RSS 不足時的補充來源
 * 回傳格式與 NewsItem 相同，方便合併
 */
async function searchWithPerplexity(query: string): Promise<NewsItem[]> {
  const apiKey = ENV.perplexityApiKey;
  if (!apiKey) {
    console.warn('[Perplexity] No API key, skipping supplemental search');
    return [];
  }
  try {
    console.log(`[Perplexity] Supplemental search for: "${query}"`);
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a news research assistant. When given a topic, find recent news articles about it. Return ONLY a JSON array of news items, no other text.',
          },
          {
            role: 'user',
            content: `Find recent news articles (last 30 days) about: "${query}". Return a JSON array with objects having these fields: title (string, in the original language), url (string, must be a real URL), source (string, news outlet name), publishedAt (ISO date string), description (string, 1-2 sentence summary). Return AT LEAST 30 articles, up to 50 if available. Include articles from diverse sources (different countries, languages, media outlets). Only return the JSON array, nothing else.`,
          },
        ],
        return_citations: true,
        search_recency_filter: 'month',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn(`[Perplexity] API error: ${resp.status}`);
      return [];
    }
    const data = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const citations = data.citations ?? [];
    // 嘗試解析 LLM 回傳的 JSON
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          title?: string;
          url?: string;
          source?: string;
          publishedAt?: string;
          description?: string;
        }>;
        const items: NewsItem[] = parsed
          .filter(item => item.title && (item.url || citations.length > 0))
          .map((item, idx) => ({
            title: item.title ?? '',
            url: item.url ?? citations[idx] ?? '',
            source: item.source ?? 'Perplexity',
            publishedAt: item.publishedAt ?? new Date().toISOString(),
            description: item.description ?? '',
          }))
          .filter(item => item.url);
        console.log(`[Perplexity] Found ${items.length} supplemental articles`);
        return items;
      } catch {
        // JSON parse failed, fall through to citation-only mode
      }
    }
    // Fallback: 如果無法解析 JSON，用 citations 建立基本 NewsItem
    if (citations.length > 0) {
      const items: NewsItem[] = citations.slice(0, 15).map((url, idx) => ({
        title: `${query} 相關報導 ${idx + 1}`,
        url,
        source: new URL(url).hostname.replace('www.', ''),
        publishedAt: new Date().toISOString(),
        description: content.slice(0, 200),
      }));
      console.log(`[Perplexity] Using ${items.length} citation URLs as fallback`);
      return items;
    }
    return [];
  } catch (err) {
    console.warn('[Perplexity] Search failed:', (err as Error).message);
    return [];
  }
}

// ─── Google News RSS Search ───────────────────────────────────────────────────

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
}

/**
 * 偵測查詢語言：繁中、簡中、日文、韓文、英文
 */
export function detectQueryLanguage(query: string): 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'en' {
  // 日文（包含平假名或片假名）
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) return 'ja';
  // 韓文
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(query)) return 'ko';
  // 中文字符
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(query)) {
    // 簡中特徵字（簡體字常見字形）
    const simplifiedChars = ['国', '党', '军', '经济', '发展', '政府', '习近平', '中共', '人民', '联合'];
    if (simplifiedChars.some(c => query.includes(c))) return 'zh-CN';
    return 'zh-TW';
  }
  return 'en';
}

/**
 * 使用 QWEN 呼叫 LLM（用於簡中查詢，效果更好）
 */
async function invokeLLMWithQwen(params: Parameters<typeof invokeLLM>[0]): Promise<import('./_core/llm').InvokeResult> {
  if (!ENV.qwenApiKey) {
    console.warn('[QWEN] No API key, falling back to default LLM');
    return invokeLLM(params);
  }
  try {
    const resp = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.qwenApiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: params.messages,
        ...(params.response_format ? { response_format: params.response_format } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn('[QWEN] API error, falling back:', resp.status);
      return invokeLLM(params);
    }
    return resp.json() as ReturnType<typeof invokeLLM>;
  } catch (err) {
    console.warn('[QWEN] Request failed, falling back:', (err as Error).message);
    return invokeLLM(params);
  }
}

/**
 * 根據語言選擇最適合的 LLM
 */
function selectLLM(language: string): (params: Parameters<typeof invokeLLM>[0]) => Promise<import('./_core/llm').InvokeResult> {
  if (language === 'zh-CN') return invokeLLMWithQwen;
  return invokeLLM;
}

/**
 * 判斷議題是否為台灣在地議題（非全球性）
 * 台灣在地：飲食、內政、財經、社會、娛樂、地方新聞等
 * 全球：國際外交、戰爭、全球科技巨頭、國際經濟等
 */
function isLocalTaiwanTopic(query: string): boolean {
  const globalKeywords = [
    '伊朗', '以色列', '美國', '中國', '俄羅斯', '烏克蘭', '北韓', '日本', '韓國',
    '法國', '英國', '德國', '歐盟', '聯合國', '戰爭', '軍事', '外交',
    'Iran', 'Israel', 'Ukraine', 'Russia', 'NATO', 'China', 'USA', 'Trump',
    '全球', '國際', '外交部', '白宮', '美聯儲', 'Fed', 'TSMC',
    '海峽', '對岸', '兩岸', '南海',
  ];
  return !globalKeywords.some(kw => query.includes(kw));
}

/**
 * Search Google News RSS for a given query.
 * Google News RSS: https://news.google.com/rss/search?q=QUERY&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
 * 台灣在地議題只搜台灣 feed，全球議題搜台灣+香港+英文
 */
export async function searchGoogleNews(query: string, targetCount = 50): Promise<{
  items: NewsItem[];
  rawText: string;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const afterDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  const isLocal = isLocalTaiwanTopic(query);
  console.log(`[GoogleNews] Topic scope: ${isLocal ? '台灣在地' : '全球'} for query: "${query}"`);

  // 生成搜尋變體
  const queryVariants = new Set<string>();
  queryVariants.add(query);
  queryVariants.add(`${query} 新聞`);
  queryVariants.add(`${query} 最新`);
  if (isLocal) {
    // 台灣在地：加強台灣地域限定
    if (!query.includes('台灣') && !query.includes('Taiwan')) {
      queryVariants.add(`${query} 台灣`);
      queryVariants.add(`${query} 台灣 新聞`);
    }
    queryVariants.add(`${query} 事件`);
  } else {
    // 全球：加入英文變體
    queryVariants.add(query.length <= 20 ? query : query.slice(0, 20));
    queryVariants.add(`${query} 事件`);
  }

  const allItems: NewsItem[] = [];

  for (const q of Array.from(queryVariants)) {
    if (allItems.length >= targetCount * 3) break;
    const encodedQuery = encodeURIComponent(`${q} after:${afterDate}`);

    // 台灣在地：搜台灣+香港；全球：搜台灣+香港+英文
    const feeds = isLocal
      ? [
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=HK&ceid=HK:zh-Hant`,
        ]
      : [
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=HK&ceid=HK:zh-Hant`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`,
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
    const gnLink = extractTag(block, "link") ?? extractTag(block, "guid") ?? "";
    const pubDate = extractTag(block, "pubDate") ?? "";
    const description = extractTag(block, "description") ?? "";
    const source = extractTag(block, "source") ?? extractDomain(gnLink);

    // Extract source domain from <source url="..."> attribute
    const sourceUrlMatch = block.match(/<source[^>]+url="([^"]+)"/);
    const sourceBaseUrl = sourceUrlMatch?.[1]?.trim() ?? "";
    const sourceDomain = sourceBaseUrl ? new URL(sourceBaseUrl).hostname.replace('www.', '') : '';

    // Build the best possible URL for the article:
    // 1. If it's NOT a Google News redirect, use it directly (e.g. from Perplexity)
    // 2. If it IS a Google News RSS URL (news.google.com/rss/articles/...),
    //    convert to the web version (news.google.com/articles/...) by removing /rss/
    //    The web version opens correctly on mobile browsers and Google News app
    let finalUrl: string;
    const cleanTitle = cleanHtml(title);
    if (gnLink.includes('news.google.com/rss/articles/')) {
      // Convert RSS URL to web URL: remove /rss/ prefix
      finalUrl = gnLink.replace('news.google.com/rss/articles/', 'news.google.com/articles/');
    } else if (gnLink.includes('news.google.com')) {
      // Other Google News URLs: keep as-is
      finalUrl = gnLink.trim();
    } else {
      finalUrl = gnLink.trim();
    }

    if (!cleanTitle || !finalUrl) continue;

    items.push({
      title: cleanHtml(title),
      url: finalUrl,
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
  newsItems: NewsItem[],
  language = 'zh-TW'
): Promise<TimelineAnalysisResult> {
  const sourceUrls = newsItems.slice(0, 15).map((item) => item.url);
  const llm = selectLLM(language);

  const response = await llm({
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

  // Step 1.5: Fuzzy similarity check — if no exact match, use LLM to check if a similar topic already exists
  if (!topic) {
    try {
      const allTopics = await db.select({ id: topics.id, query: topics.query }).from(topics);
      if (allTopics.length > 0) {
        const queryLang = detectQueryLanguage(query);
        const llmForCheck = selectLLM(queryLang);
        const topicListStr = allTopics.map(t => `ID:${t.id} 「${t.query}」`).join('\n');
        const checkResp = await llmForCheck({
          messages: [
            { role: 'system', content: '你是一個新聞議題去重助手。判斷新查詢是否與現有議題列表中的某個議題高度相似（指同一事件、同一人物、同一政策，只是措辭不同）。如果高度相似，回傳該議題的 ID；如果沒有相似的，回傳 0。只回傳一個數字，不要任何解釋。' },
            { role: 'user', content: `新查詢：「${query}」\n\n現有議題列表：\n${topicListStr}\n\n請問新查詢與哪個現有議題高度相似？回傳 ID 數字（沒有則回傳 0）：` },
          ],
        });
        const rawContent = checkResp?.choices?.[0]?.message?.content;
        const matchIdStr = (typeof rawContent === 'string' ? rawContent.trim() : '0') || '0';
        const matchId = parseInt(matchIdStr, 10);
        if (matchId > 0) {
          const matchedTopicRows = await db.select().from(topics).where(eq(topics.id, matchId)).limit(1);
          if (matchedTopicRows.length > 0) {
            console.log(`[Timeline] Similarity check: "${query}" → matched existing topic ID ${matchId} 「${matchedTopicRows[0].query}」, redirecting`);
            topic = matchedTopicRows[0];
          }
        } else {
          console.log(`[Timeline] Similarity check: "${query}" → no similar topic found, creating new`);
        }
      }
    } catch (e) {
      console.warn('[Timeline] Similarity check failed, proceeding with new topic creation:', (e as Error).message);
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

  // Step 3: Detect query language and expand query keywords via AI
  const queryLanguage = detectQueryLanguage(query);
  console.log(`[Timeline] Query language: ${queryLanguage} for: "${query}"`);

  // AI 查詢詞擴展：將口語化詞轉換為新聞關鍵字
  const llmForExpansion = selectLLM(queryLanguage);
  let searchQuery = query;
  try {
    const expansionResp = await llmForExpansion({
      messages: [
        {
          role: 'system',
          content: 'You are a news search keyword optimizer. Convert colloquial or ambiguous queries into precise news search keywords. Return ONLY a JSON object with field "keywords" (array of 3-5 strings) and "primary" (the best single search phrase, max 20 chars).'
        },
        {
          role: 'user',
          content: `Convert this query into news search keywords: "${query}"\nLanguage: ${queryLanguage}\nReturn JSON only.`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'keyword_expansion',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              keywords: { type: 'array', items: { type: 'string' } },
              primary: { type: 'string' }
            },
            required: ['keywords', 'primary'],
            additionalProperties: false
          }
        }
      }
    });
    const expansionContent = expansionResp.choices?.[0]?.message?.content;
    if (expansionContent) {
      const parsed = typeof expansionContent === 'string' ? JSON.parse(expansionContent) : expansionContent;
      if (parsed?.primary && parsed.primary !== query) {
        console.log(`[Timeline] Query expanded: "${query}" → "${parsed.primary}" (keywords: ${parsed.keywords?.join(', ')})`);
        searchQuery = parsed.primary;
      }
    }
  } catch (err) {
    console.warn('[Timeline] Query expansion failed, using original query:', (err as Error).message);
  }

  // 階段更新：RSS 搜尋中
  await db.update(topics).set({ collectionStage: 'rss_searching' }).where(eq(topics.id, topic.id));
  console.log(`[Timeline] Searching Google News for: "${searchQuery}"`);
  const rssStartTime = Date.now();
  const { items: rssItems, rawText: rssRawText } = await searchGoogleNews(searchQuery);
  const rssElapsedSec = Math.max((Date.now() - rssStartTime) / 1000, 0.1);
  const rssRate = rssItems.length / rssElapsedSec;
  console.log(`[Timeline] RSS: ${rssItems.length} articles in ${rssElapsedSec.toFixed(1)}s (rate: ${rssRate.toFixed(1)} articles/sec)`);

  // 補充搜尋：速率 < 1 篇/秒 或 文章數 < 20 即觸發 Perplexity
  let newsItems = rssItems;
  let rawText = rssRawText;
  const shouldTriggerPerplexity = rssRate < 1.0 || rssItems.length < 20;
  if (shouldTriggerPerplexity) {
    // 階段更新：Perplexity 補充搜尋中
    await db.update(topics).set({ collectionStage: 'perplexity_searching' }).where(eq(topics.id, topic.id));
    console.log(`[Timeline] Triggering Perplexity (rate: ${rssRate.toFixed(1)}/sec, count: ${rssItems.length})...`);
    // 第一輪：繁中搜尋
    const perplexityItems = await searchWithPerplexity(query);
    // 第二輪：英文搜尋（如果查詢是中文）
    const isChineseQuery = /[一-鿿]/.test(query);
    const perplexityItemsEn = isChineseQuery ? await searchWithPerplexity(`${query} news`) : [];
    const allPerplexityItems = [...perplexityItems, ...perplexityItemsEn];
    if (allPerplexityItems.length > 0) {
      // 合併兩個來源，去除重複 URL
      const existingUrls = new Set(rssItems.map(i => i.url));
      const newItems = allPerplexityItems.filter(i => i.url && !existingUrls.has(i.url));
      newsItems = [...rssItems, ...newItems];
      console.log(`[Timeline] After merge: ${newsItems.length} articles (${rssItems.length} RSS + ${newItems.length} Perplexity)`);
      // 重建完整 rawText：將所有文章統一格式，方便 AI 分析
      rawText = newsItems
        .map((item, i) => `[${i + 1}] ${item.publishedAt} — ${item.source}\n標題: ${item.title}\n摘要: ${item.description}`)
        .join('\n\n');
    }
  }

  if (newsItems.length === 0) {
    // 階段更新：完成（無文章）
    await db.update(topics).set({ collectionStage: 'ready' }).where(eq(topics.id, topic.id));
    console.warn(`[Timeline] No news found for: "${query}"`);
    return { topic, turningPointsList: [] };
  }

  // 階段更新：AI 分析中
  await db.update(topics).set({ collectionStage: 'analyzing' }).where(eq(topics.id, topic.id));
  console.log(`[Timeline] Found ${newsItems.length} articles, formatting timeline...`);

  // Step 4: Format into timeline using language-appropriate LLM
  const analysisResult = await formatTimelineFromNews(query, rawText, newsItems, queryLanguage);
  const turningPointsData = analysisResult.turning_points;
  const topicTags = analysisResult.tags ?? [];
  const topicTitle = analysisResult.topic_title || query;
  console.log(`[Timeline] Detected ${turningPointsData.length} turning points, tags: ${topicTags.join(', ')}`);

  // Step 5: Update topic stats + tags
  // 使用實際收集的文章數（而非 AI 估計值），更準確反映資料量
  const totalArticles = newsItems.length;
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
      // 階段更新：分析完成
      collectionStage: 'ready',
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

  // 注入今日日期（台灣時區 UTC+8）
  const now = new Date();
  const twDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = twDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayZh = `${twDate.getUTCFullYear()}年${twDate.getUTCMonth() + 1}月${twDate.getUTCDate()}日`;
  const todayROC = `中華民國${twDate.getUTCFullYear() - 1911}年${twDate.getUTCMonth() + 1}月${twDate.getUTCDate()}日`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert communications strategist. ${langInstruction} Generate ${typeInstructions[responseType]} from the perspective of the specified role, based on the given news event context. Be realistic, professional, and appropriate to the role's interests and concerns.

IMPORTANT: Today's date is ${todayStr} (${todayZh} / ${todayROC}). Always use TODAY's date when generating dates in the document. NEVER use past dates or make up dates.`,
      },
      {
        role: "user",
        content: `News Event: "${topicTitle}"\n\nContext: ${topicSummary}\n\nRole/Perspective: ${role}\n\nToday's date: ${todayZh} (${todayROC})\n\nGenerate a ${typeInstructions[responseType]} from this perspective. Keep it concise but impactful. Use today's date for any date references in the document.`,
      },
    ],
  });

  return (response.choices[0]?.message?.content as string) ?? "無法生成回覆，請稍後再試。";
}
