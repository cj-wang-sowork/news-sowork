/**
 * NewsFlow — AI Analysis Service
 * Handles turning point detection and AI stance response generation.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { eq, desc, or, like, sql } from "drizzle-orm";

// ─── Detect Turning Points from Articles ─────────────────────────────────────
export async function detectTurningPoints(
  topicId: number,
  topicQuery: string,
  articles: Array<{ title: string; publishedAt: Date; source: string }>
): Promise<void> {
  const db = await getDb();
  if (!db || articles.length === 0) return;

  // Use LLM to identify turning points
  const articlesText = articles
    .slice(0, 50)
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
        content: `Topic: "${topicQuery}"\n\nHeadlines:\n${articlesText}\n\nIdentify 3 to 6 major turning points in this story. Each should represent a significant development or shift. Order them chronologically.`,
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
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["title", "title_en", "summary", "date_label", "heat_level", "is_active", "keywords"],
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
      keywords: string[];
    }>;

    const totalArticles = articles.length;
    const uniqueSources = new Set(articles.map((a) => a.source)).size;

    for (let i = 0; i < detectedPoints.length; i++) {
      const point = detectedPoints[i]!;
      const articleShare = Math.max(1, Math.floor(totalArticles / detectedPoints.length));
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
        .onDuplicateKeyUpdate({ set: { title: point.title, summary: point.summary } });

      // Assign articles to this turning point by keyword matching
      const tp = await db
        .select()
        .from(turningPoints)
        .where(eq(turningPoints.topicId, topicId))
        .orderBy(desc(turningPoints.createdAt))
        .limit(detectedPoints.length);

      const tpRecord = tp[i];
      if (tpRecord && point.keywords.length > 0) {
        // Match articles by keywords
        const keywordConditions = point.keywords.slice(0, 3).map((kw) =>
          like(newsArticles.title, `%${kw}%`)
        );
        if (keywordConditions.length > 0) {
          await db
            .update(newsArticles)
            .set({ turningPointId: tpRecord.id, topicId })
            .where(or(...keywordConditions));
        }
      }
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

  return (response.choices[0]?.message?.content as string) ?? "無法生成回覆，請稍後再試。";
}

// ─── Build Topic Timeline (Full Pipeline) ────────────────────────────────────
export async function buildTopicTimeline(query: string): Promise<{
  topic: typeof topics.$inferSelect | null;
  turningPointsList: Array<typeof turningPoints.$inferSelect & { news: Array<typeof newsArticles.$inferSelect> }>;
} | null> {
  const db = await getDb();
  if (!db) return null;

  // Step 1: Check if topic already exists with turning points
  const existingTopics = await db
    .select()
    .from(topics)
    .where(like(topics.query, `%${query}%`))
    .limit(1);

  let topic = existingTopics[0] ?? null;

  // If topic exists and has turning points, return existing data
  if (topic) {
    const existingTPs = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topic.id))
      .limit(1);

    if (existingTPs.length > 0) {
      // Return existing timeline
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

  // Step 2: Create new topic if not exists
  if (!topic) {
    const slug = `${query
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fff]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 48)}-${Date.now()}`;

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

  // Step 3: Find relevant articles via keyword matching
  // Split query into keywords for broader matching
  const keywords = query.split(/[\s,，、]+/).filter((k) => k.length > 1);
  const keywordConditions = keywords.slice(0, 5).map((kw) =>
    like(newsArticles.title, `%${kw}%`)
  );

  let relevantArticles: Array<typeof newsArticles.$inferSelect> = [];

  if (keywordConditions.length > 0) {
    relevantArticles = await db
      .select()
      .from(newsArticles)
      .where(or(...keywordConditions))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(60);
  }

  // Fallback: get recent articles if no keyword matches
  if (relevantArticles.length < 5) {
    relevantArticles = await db
      .select()
      .from(newsArticles)
      .orderBy(desc(newsArticles.publishedAt))
      .limit(40);
  }

  // Step 4: Update topic stats
  const uniqueSources = new Set(relevantArticles.map((a) => a.source)).size;
  await db
    .update(topics)
    .set({
      totalArticles: relevantArticles.length,
      totalMedia: uniqueSources,
      heatLevel: relevantArticles.length > 30 ? "high" : relevantArticles.length > 10 ? "medium" : "low",
      lastUpdated: new Date(),
    })
    .where(eq(topics.id, topic.id));

  // Step 5: Run AI turning point detection
  await detectTurningPoints(
    topic.id,
    query,
    relevantArticles.map((a) => ({
      title: a.title,
      publishedAt: a.publishedAt ?? new Date(),
      source: a.source,
    }))
  );

  // Step 6: Return complete timeline
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
