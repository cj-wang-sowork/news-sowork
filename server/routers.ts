import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  getHotTopics,
  getTopicBySlug,
  getTopicTurningPoints,
  getTurningPointNews,
} from "./db";
import { fetchAndStoreArticles, seedRssSources } from "./newsIngestion";
import { buildTopicTimeline, generateStanceResponse, detectTurningPoints } from "./aiAnalysis";
import { getDb } from "./db";
import { topics, newsArticles } from "../drizzle/schema";
import { like, desc, sql } from "drizzle-orm";

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

  topics: router({
    hot: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(24).default(12) }).optional())
      .query(async ({ input }) => {
        const topicsList = await getHotTopics(input?.limit ?? 12);
        return topicsList;
      }),

    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(256) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(topics)
          .where(like(topics.query, `%${input.query}%`))
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

    createOrFind: publicProcedure
      .input(z.object({ query: z.string().min(1).max(256) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { slug: "iran-war", isNew: false };

        const existing = await db
          .select()
          .from(topics)
          .where(like(topics.query, `%${input.query}%`))
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          return { slug: existing[0].slug, isNew: false };
        }

        const result = await buildTopicTimeline(input.query);
        if (result?.topic) {
          return { slug: result.topic.slug, isNew: true };
        }

        return { slug: "iran-war", isNew: false };
      }),
  }),

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

  ai: router({
    generateStance: publicProcedure
      .input(
        z.object({
          topicTitle: z.string().min(1).max(256),
          topicSummary: z.string().min(1).max(1000),
          role: z.string().min(1).max(128),
          responseType: z.enum(["press", "social", "memo"]),
          language: z.string().default("zh-TW"),
        })
      )
      .mutation(async ({ input }) => {
        const response = await generateStanceResponse(input);
        return { content: response };
      }),

    analyzeTopic: publicProcedure
      .input(
        z.object({
          topicId: z.number(),
          topicQuery: z.string(),
          articles: z.array(
            z.object({
              title: z.string(),
              publishedAt: z.date(),
              source: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        await detectTurningPoints(input.topicId, input.topicQuery, input.articles);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
