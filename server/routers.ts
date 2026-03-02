import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getHotTopics,
  getTopicBySlug,
  getTopicTurningPoints,
  getTurningPointNews,
} from "./db";
import { fetchAndStoreArticles, seedRssSources } from "./newsIngestion";
import { buildTopicTimeline, generateStanceResponse } from "./aiAnalysis";
import { getDb } from "./db";
import {
  topics,
  newsArticles,
  users,
  pointTransactions,
  topicViews,
} from "../drizzle/schema";
import { like, desc, sql, eq, and, gte } from "drizzle-orm";

// ─── Point costs ──────────────────────────────────────────────────────────────
const POINT_COST_AI_STANCE = 10;   // AI 立場回覆：扣 10 點
const POINT_REWARD_VIEW = 1;        // 被瀏覽一次：賺 1 點（24h 去重）
const POINT_WELCOME = 100;          // 新用戶歡迎禮

// ─── Helper: add points to user ──────────────────────────────────────────────
async function addPoints(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  amount: number,
  type: "view_reward" | "ai_usage" | "welcome" | "admin",
  topicId?: number,
  note?: string
) {
  if (!db) return;
  await db.update(users).set({ points: sql`${users.points} + ${amount}` }).where(eq(users.id, userId));
  await db.insert(pointTransactions).values({ userId, amount, type, topicId: topicId ?? null, note: note ?? null });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Points ────────────────────────────────────────────────────────────────
  points: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { points: 0 };
      const [row] = await db.select({ points: users.points }).from(users).where(eq(users.id, ctx.user.id));
      return { points: row?.points ?? 0 };
    }),

    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(pointTransactions)
          .where(eq(pointTransactions.userId, ctx.user.id))
          .orderBy(desc(pointTransactions.createdAt))
          .limit(input?.limit ?? 20);
      }),
  }),

  // ─── Topics ────────────────────────────────────────────────────────────────
  topics: router({
    hot: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(24) }).optional())
      .query(async ({ input }) => {
        const topicsList = await getHotTopics(input?.limit ?? 24);
        return topicsList;
      }),

    // 公開議題列表（含平台預設 + 用戶公開議題）
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(24),
        offset: z.number().min(0).default(0),
        tag: z.string().optional(), // 標籤篩選
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { items: [], total: 0 };
        const limit = input?.limit ?? 24;
        const offset = input?.offset ?? 0;

        // 基礎条件：公開 + 啟用
        let baseCondition = sql`${topics.visibility} = 'public' AND ${topics.isActive} = 1`;

        // 標籤篩選：用 JSON_CONTAINS 或 LIKE 比對
        if (input?.tag) {
          baseCondition = sql`${topics.visibility} = 'public' AND ${topics.isActive} = 1 AND JSON_CONTAINS(${topics.tags}, ${JSON.stringify(input.tag)})`;
        }

        const [countRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(topics)
          .where(baseCondition);

        const items = await db
          .select()
          .from(topics)
          .where(baseCondition)
          .orderBy(desc(topics.lastUpdated)) // 最新更新的議題在最前
          .limit(limit)
          .offset(offset);

        return { items, total: Number(countRow?.count ?? 0) };
      }),

    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(256) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(topics)
          .where(and(
            like(topics.query, `%${input.query}%`),
            eq(topics.visibility, "public"),
          ))
          .orderBy(desc(sql`${topics.totalArticles} * ${topics.totalMedia}`))
          .limit(10);
      }),

    getTimeline: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const topic = await getTopicBySlug(input.slug);
        if (!topic) return null;

        const tpList = await getTopicTurningPoints(topic.id);
        const turningPointsWithNews = await Promise.all(
          tpList.map(async (tp) => {
            const news = await getTurningPointNews(tp.id, 5);
            return {
              ...tp,
              news: news.map((n) => ({
                id: n.id,
                title: n.title,
                url: n.url,
                source: n.source,
                sourceFlag: n.sourceFlag ?? "",
                language: n.language,
                time: n.publishedAt
                  ? new Date(n.publishedAt).toLocaleDateString("zh-TW", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "",
              })),
            };
          })
        );

        return { topic, turningPoints: turningPointsWithNews };
      }),

    // 瀏覽議題：記錄瀏覽次數，並為創建者賺點（24h 去重）
    recordView: publicProcedure
      .input(z.object({ slug: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { rewarded: false };

        const topic = await getTopicBySlug(input.slug);
        if (!topic || !topic.creatorId) return { rewarded: false };

        // 累計瀏覽次數
        await db.update(topics).set({ viewCount: sql`${topics.viewCount} + 1` }).where(eq(topics.id, topic.id));

        // 去重：同一用戶 24h 內只賺一次點
        const viewerId = ctx.user?.id ?? null;
        if (viewerId && viewerId !== topic.creatorId) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [existing] = await db
            .select({ id: topicViews.id })
            .from(topicViews)
            .where(and(
              eq(topicViews.topicId, topic.id),
              eq(topicViews.viewerId, viewerId),
              gte(topicViews.createdAt, since),
            ))
            .limit(1);

          if (!existing) {
            await db.insert(topicViews).values({ topicId: topic.id, viewerId });
            await addPoints(db, topic.creatorId, POINT_REWARD_VIEW, "view_reward", topic.id, `議題「${topic.query}」被瀏覽`);
            return { rewarded: true };
          }
        }
        return { rewarded: false };
      }),

    stats: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { articleCount: 0, topicCount: 0 };
        const [articleRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(newsArticles);
        const [topicRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(topics)
          .where(eq(topics.visibility, "public"));
        return {
          articleCount: Number(articleRow?.count ?? 0),
          topicCount: Number(topicRow?.count ?? 0),
        };
      }),

    // 用戶創建議題（需登入）
    create: protectedProcedure
      .input(z.object({
        query: z.string().min(2).max(256),
        visibility: z.enum(["public", "private"]).default("public"),
      }))
      .mutation(async ({ ctx, input }) => {
        // 呼叫 AI pipeline 生成時間軸
        const result = await buildTopicTimeline(input.query);
        if (!result?.topic) throw new Error("AI 分析失敗，請稍後再試");

        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");

        // 更新議題的創建者與可見性
        await db.update(topics)
          .set({
            creatorId: ctx.user.id,
            visibility: input.visibility,
          })
          .where(eq(topics.id, result.topic.id));

        return {
          slug: result.topic.slug,
          isNew: result.turningPointsList.length > 0,
          visibility: input.visibility,
        };
      }),

    // 用戶自己的議題列表
    myTopics: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(topics)
          .where(eq(topics.creatorId, ctx.user.id))
          .orderBy(desc(topics.createdAt))
          .limit(input?.limit ?? 20);
      }),

    // 公開搜尋（不需登入）
    createOrFind: publicProcedure
      .input(z.object({ query: z.string().min(1).max(256) }))
      .mutation(async ({ input }) => {
        const result = await buildTopicTimeline(input.query);
        if (result?.topic) {
          const isNew = result.turningPointsList.length > 0;
          return { slug: result.topic.slug, isNew };
        }
        return { slug: "iran-war", isNew: false };
      }),
  }),

  // ─── News ──────────────────────────────────────────────────────────────────
  news: router({
    fetchRss: publicProcedure
      .input(z.object({ sourceUrl: z.string().url().optional() }).optional())
      .mutation(async ({ input }) => {
        await seedRssSources();
        const count = await fetchAndStoreArticles(input?.sourceUrl);
        return { stored: count };
      }),

    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(newsArticles)
          .orderBy(desc(newsArticles.publishedAt))
          .limit(input?.limit ?? 20);
      }),
  }),

  // ─── AI ────────────────────────────────────────────────────────────────────
  ai: router({
    generateStance: protectedProcedure
      .input(
        z.object({
          topicTitle: z.string().min(1).max(256),
          topicSummary: z.string().min(1).max(1000),
          role: z.string().min(1).max(128),
          responseType: z.enum(["press", "social", "memo"]),
          language: z.string().default("zh-TW"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");

        // 檢查點數是否足夠
        const [userRow] = await db.select({ points: users.points }).from(users).where(eq(users.id, ctx.user.id));
        const currentPoints = userRow?.points ?? 0;
        if (currentPoints < POINT_COST_AI_STANCE) {
          throw new Error(`點數不足！使用 AI 立場回覆需要 ${POINT_COST_AI_STANCE} 點，您目前只有 ${currentPoints} 點。`);
        }

        // 扣點
        await addPoints(db, ctx.user.id, -POINT_COST_AI_STANCE, "ai_usage", undefined, `AI 立場回覆：${input.topicTitle}`);

        const response = await generateStanceResponse(input);
        return {
          content: response,
          pointsUsed: POINT_COST_AI_STANCE,
          pointsRemaining: currentPoints - POINT_COST_AI_STANCE,
        };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    triggerIngest: protectedProcedure
      .input(z.object({ sourceUrl: z.string().url().optional() }).optional())
      .mutation(async ({ input }) => {
        await seedRssSources();
        const stored = await fetchAndStoreArticles(input?.sourceUrl);
        return { stored, message: `成功抓取並儲存 ${stored} 篇新聞` };
      }),

    ingestStatus: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { articleCount: 0, topicCount: 0, lastFetch: null };
        const [articleRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(newsArticles);
        const [topicRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(topics);
        return {
          articleCount: Number(articleRow?.count ?? 0),
          topicCount: Number(topicRow?.count ?? 0),
        };
      }),

    // 批次建立平台預設議題（僅管理員可用）
    seedTopics: protectedProcedure
      .input(z.object({
        queries: z.array(z.string().min(1).max(256)).min(1).max(60),
      }))
      .mutation(async ({ input }) => {
        const results: { query: string; slug: string; success: boolean; error?: string }[] = [];
        for (const query of input.queries) {
          try {
            const result = await buildTopicTimeline(query);
            if (result?.topic) {
              results.push({ query, slug: result.topic.slug, success: true });
            } else {
              results.push({ query, slug: "", success: false, error: "AI 分析失敗" });
            }
          } catch (e: unknown) {
            results.push({ query, slug: "", success: false, error: String(e) });
          }
        }
        return { results, successCount: results.filter(r => r.success).length };
      }),
  }),
});

export type AppRouter = typeof appRouter;
