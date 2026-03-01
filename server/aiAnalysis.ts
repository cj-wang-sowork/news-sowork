/**
 * NewsFlow — AI Analysis Service
 * Handles turning point detection and AI stance response generation.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { getTextEmbedding, cosineSimilarity } from "./newsIngestion";

// ─── Detect Turning Points from Articles ─────────────────────────────────────
export async function detectTurningPoints(
  topicId: number,
  topicQuery: string,
  articles: Array<{ title: string; publishedAt: Date; source: string }>
): Promise<void> {
  const db = await getDb();
  if (!db || articles.length === 0) return;

  // Group articles by date (day-level)
  const byDate = new Map<string, typeof articles>();
  for (const article of articles) {
    const dateKey = article.publishedAt.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(article);
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  // Use LLM to identify turning points
  const articlesText = articles
    .slice(0, 40)
    .map((a) => `[${a.publishedAt.toISOString().slice(0, 10)}] ${a.title}`)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a news analysis AI. Given a list of news headlines about a topic, identify the major turning points (significant shifts in the story). For each turning point, provide a concise title and summary in Traditional Chinese. Output JSON only.`,
      },
      {
        role: "user",
        content: `Topic: "${topicQuery}"\n\nHeadlines:\n${articlesText}\n\nIdentify up to 5 major turning points in this story. Each should represent a significant development or shift.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "turning_points_analysis",
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
                },
                required: ["title", "title_en", "summary", "date_label", "heat_level", "is_active"],
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

  try {
    const content = response.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const detectedPoints = parsed.turning_points as Array<{
      title: string;
      title_en: string;
      summary: string;
      date_label: string;
      heat_level: "extreme" | "high" | "medium" | "low";
      is_active: boolean;
    }>;

    // Get article counts per turning point
    const totalArticles = articles.length;
    const uniqueSources = new Set(articles.map((a) => a.source)).size;

    for (let i = 0; i < detectedPoints.length; i++) {
      const point = detectedPoints[i]!;
      const articleShare = Math.floor(totalArticles / detectedPoints.length);
      const mediaShare = Math.max(1, Math.floor(uniqueSources / detectedPoints.length));

      const newPoint: InsertTurningPoint = {
        topicId,
        title: point.title,
        titleEn: point.title_en,
        summary: point.summary,
        dateLabel: point.date_label,
        eventDate: new Date(),
        articleCount: articleShare,
        mediaCount: mediaShare,
        heatLevel: point.heat_level,
        isActive: point.is_active ? 1 : 0,
        sortOrder: i,
      };

      await db
        .insert(turningPoints)
        .values(newPoint)
        .onDuplicateKeyUpdate({ set: { title: point.title } });
    }
  } catch (err) {
    console.error("[AI] Failed to parse turning points:", err);
  }
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

  return response.choices[0]?.message?.content as string ?? "無法生成回覆，請稍後再試。";
}

// ─── Search & Build Topic Timeline ───────────────────────────────────────────
export async function buildTopicTimeline(query: string): Promise<{
  topic: typeof topics.$inferSelect | null;
  turningPointsList: Array<typeof turningPoints.$inferSelect & { news: Array<typeof newsArticles.$inferSelect> }>;
} | null> {
  const db = await getDb();
  if (!db) return null;

  // Check if topic already exists
  const existingTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.query, query))
    .limit(1);

  let topic = existingTopics[0] ?? null;

  if (!topic) {
    // Create new topic
    const slug = query
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, "-")
      .slice(0, 64);

    await db.insert(topics).values({
      slug: `${slug}-${Date.now()}`,
      query,
      heatLevel: "medium",
      trendDirection: "stable",
    });

    const newTopics = await db.select().from(topics).where(eq(topics.query, query)).limit(1);
    topic = newTopics[0] ?? null;
  }

  if (!topic) return null;

  // Get turning points for this topic
  const tpList = await db
    .select()
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topic.id))
    .orderBy(turningPoints.sortOrder);

  // Get news for each turning point
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
