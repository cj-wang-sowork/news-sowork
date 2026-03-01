/**
 * NewsFlow — News Ingestion Service
 * Fetches RSS feeds, deduplicates, and stores articles to DB.
 * Also handles AI embedding generation for semantic clustering.
 */

import RSSParser from "rss-parser";
import { getDb } from "./db";
import { newsArticles, rssSources, type InsertNewsArticle } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { eq, isNull, sql } from "drizzle-orm";

const parser = new RSSParser({
  timeout: 10000,
  headers: { "User-Agent": "NewsFlow/1.0 (+https://news.sowork.ai)" },
});

// ─── Default RSS Sources ──────────────────────────────────────────────────────
export const DEFAULT_RSS_SOURCES = [
  // Taiwan
  { name: "自由時報", url: "https://news.ltn.com.tw/rss/all.xml", language: "zh-TW", country: "TW", flag: "🇹🇼" },
  { name: "聯合新聞網", url: "https://udn.com/rssfeed/news/2/BREAKINGNEWS?ch=news", language: "zh-TW", country: "TW", flag: "🇹🇼" },
  { name: "公視新聞", url: "https://news.pts.org.tw/xml/newsfeed.xml", language: "zh-TW", country: "TW", flag: "🇹🇼" },
  { name: "中央社", url: "https://www.cna.com.tw/rss/aall.aspx", language: "zh-TW", country: "TW", flag: "🇹🇼" },
  // International Chinese
  { name: "BBC 中文", url: "https://feeds.bbci.co.uk/zhongwen/trad/rss.xml", language: "zh-TW", country: "GB", flag: "🇬🇧" },
  { name: "VOA 中文", url: "https://www.voachinese.com/api/zrqoeuuqt", language: "zh-CN", country: "US", flag: "🇺🇸" },
  // English
  { name: "Reuters", url: "https://feeds.reuters.com/reuters/topNews", language: "en", country: "GB", flag: "🇬🇧" },
  { name: "AP News", url: "https://feeds.apnews.com/rss/apf-topnews", language: "en", country: "US", flag: "🇺🇸" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "en", country: "QA", flag: "🇶🇦" },
  // Japanese
  { name: "NHK 日本語", url: "https://www3.nhk.or.jp/rss/news/cat0.xml", language: "ja", country: "JP", flag: "🇯🇵" },
];

// ─── Seed RSS Sources ─────────────────────────────────────────────────────────
export async function seedRssSources(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (const src of DEFAULT_RSS_SOURCES) {
    try {
      await db
        .insert(rssSources)
        .values({ ...src, isActive: 1 })
        .onDuplicateKeyUpdate({ set: { isActive: 1 } });
    } catch {
      // ignore duplicate
    }
  }
}

// ─── Fetch & Store Articles ───────────────────────────────────────────────────
export async function fetchAndStoreArticles(sourceUrl?: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get active sources
  const sources = sourceUrl
    ? await db.select().from(rssSources).where(eq(rssSources.url, sourceUrl))
    : await db.select().from(rssSources).where(eq(rssSources.isActive, 1));

  let totalStored = 0;

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      for (const item of (feed.items || []).slice(0, 20)) {
        if (!item.title || !item.link) continue;

        const article: InsertNewsArticle = {
          title: item.title.trim(),
          url: item.link,
          source: source.name,
          sourceFlag: source.flag ?? "",
          language: source.language,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        };

        try {
          await db.insert(newsArticles).values(article).onDuplicateKeyUpdate({
            set: { scrapedAt: new Date() },
          });
          totalStored++;
        } catch {
          // duplicate URL — skip
        }
      }

      // Update lastFetchedAt
      await db
        .update(rssSources)
        .set({ lastFetchedAt: new Date() })
        .where(eq(rssSources.id, source.id));
    } catch (err) {
      console.warn(`[RSS] Failed to fetch ${source.url}:`, err);
    }
  }

  return totalStored;
}

// ─── Generate Embeddings for Unprocessed Articles ────────────────────────────
export async function generateEmbeddingsForPendingArticles(limit = 50): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const pending = await db
    .select()
    .from(newsArticles)
    .where(isNull(newsArticles.embeddingVector))
    .limit(limit);

  let processed = 0;

  for (const article of pending) {
    try {
      const embedding = await getTextEmbedding(article.title + (article.titleEn ? ` ${article.titleEn}` : ""));
      await db
        .update(newsArticles)
        .set({ embeddingVector: embedding })
        .where(eq(newsArticles.id, article.id));
      processed++;
    } catch (err) {
      console.warn(`[Embed] Failed for article ${article.id}:`, err);
    }
  }

  return processed;
}

// ─── Text Embedding via LLM ───────────────────────────────────────────────────
// Uses LLM to generate a semantic summary vector representation
// Since we use the built-in invokeLLM, we simulate embeddings via structured JSON
export async function getTextEmbedding(text: string): Promise<number[]> {
  // Use LLM to extract key semantic features as a pseudo-embedding
  // In production, replace with a real embedding API (e.g., text-embedding-3-small)
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a semantic analysis engine. Given a news headline, output a JSON array of 16 float values between -1 and 1 representing the semantic vector of the text. Focus on: geopolitics, military, economy, technology, society, culture, environment, health, sports, entertainment, crime, science, business, diplomacy, conflict, humanitarian. Output ONLY the JSON array, no explanation.`,
      },
      {
        role: "user",
        content: text.slice(0, 500),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "embedding",
        strict: true,
        schema: {
          type: "object",
          properties: {
            vector: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: ["vector"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed.vector as number[];
  } catch {
    // Fallback: return zero vector
    return Array(16).fill(0);
  }
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ─── Semantic Search for Topic ────────────────────────────────────────────────
export async function semanticSearchArticles(
  queryText: string,
  limit = 30
): Promise<Array<typeof newsArticles.$inferSelect>> {
  const db = await getDb();
  if (!db) return [];

  // Get query embedding
  const queryEmbedding = await getTextEmbedding(queryText);

  // Get all articles with embeddings
  const allArticles = await db
    .select()
    .from(newsArticles)
    .where(sql`${newsArticles.embeddingVector} IS NOT NULL`)
    .orderBy(sql`${newsArticles.publishedAt} DESC`)
    .limit(500);

  // Score by cosine similarity
  const scored = allArticles
    .map((article) => {
      const vec = article.embeddingVector as number[] | null;
      const score = vec ? cosineSimilarity(queryEmbedding, vec) : 0;
      return { article, score };
    })
    .filter((item) => item.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => item.article);
}
