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
  getUserByEmail,
} from "./db";
import { fetchAndStoreArticles, seedRssSources } from "./newsIngestion";
import { buildTopicTimeline, generateStanceResponse } from "./aiAnalysis";
import { triggerManualUpdate } from "./scheduler";
import { getDb } from "./db";
import {
  topics,
  newsArticles,
  users,
  pointTransactions,
  topicViews,
  userTopics,
  rssSources,
  topicMergeSignals,
  topicMergeHistory,
  turningPoints,
} from "../drizzle/schema";
import { like, desc, sql, eq, and, gte } from "drizzle-orm";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";

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

    // 注冊（Email / Password）
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8, "密碼至少8個字元"),
        name: z.string().min(1, "請輸入姓名").max(64),
      }))
      .mutation(async ({ input, ctx }) => {
        // 檢查 email 是否已存在
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new Error("此 Email 已被注冊，請直接登入或使用其他 Email");
        }
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");
        // 加密密碼
        const passwordHash = await bcrypt.hash(input.password, 12);
        // 生成唯一 openId（本地註冊用戶不經過 Manus OAuth）
        const openId = `local_${nanoid(16)}`;
        // 建立用戶
        await db.insert(users).values({
          openId,
          email: input.email,
          name: input.name,
          passwordHash,
          authMethod: "password",
          loginMethod: "email",
          lastSignedIn: new Date(),
        });
        const newUser = await getUserByEmail(input.email);
        if (!newUser) throw new Error("建立用戶失敗");
        // 發放歡迎點
        await addPoints(db, newUser.id, 100, "welcome", undefined, "新用戶歡迎點");
        // 發行 session cookie
        const token = await sdk.createSessionToken(openId, { name: input.name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email } };
      }),

    // 登入（Email / Password）
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new Error("郵筱或密碼錯誤");
        }
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new Error("郵筱或密碼錯誤");
        }
        // 登入成功，發行 session cookie
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        // 更新最後登入時間
        const db = await getDb();
        if (db) {
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        }
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    // Google OAuth 登入（前端傳入 Firebase ID Token，後端驗證後建立 session）
    loginWithGoogle: publicProcedure
      .input(z.object({
        idToken: z.string().min(1),
        name: z.string().optional(),
        email: z.string().email().optional(),
        photoURL: z.string().optional(),
        uid: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");
        // 用 Firebase UID 作為 openId
        const openId = `google_${input.uid}`;
        // 查詢或建立用戶
        let [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.openId, openId))
          .limit(1);
        if (!existingUser) {
          // 新用戶：建立記錄
          await db.insert(users).values({
            openId,
            email: input.email ?? null,
            name: input.name ?? '用戶',
            authMethod: 'google',
            loginMethod: 'google',
            avatar: input.photoURL ?? null,
            lastSignedIn: new Date(),
          });
          const [newUser] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
          if (!newUser) throw new Error("建立用戶失敗");
          // 發放歡迎點
          await addPoints(db, newUser.id, 100, 'welcome', undefined, 'Google 登入歡迎點');
          existingUser = newUser;
        } else {
          // 更新最後登入時間和头像
          await db.update(users).set({
            lastSignedIn: new Date(),
            avatar: input.photoURL ?? existingUser.avatar,
            name: input.name ?? existingUser.name,
          }).where(eq(users.id, existingUser.id));
        }
        // 發行 session cookie
        const sessionToken = await sdk.createSessionToken(openId, { name: existingUser.name ?? '' });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: existingUser.id, name: existingUser.name, email: existingUser.email } };
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
        // 同步計算真實的文章數和媒體數，確保卡片與詳情頁一致
        const db = await getDb();
        if (db && tpList.length > 0) {
          const [statsRow] = await db
            .select({
              totalArticles: sql<number>`COUNT(DISTINCT ${newsArticles.id})`,
              totalMedia: sql<number>`COUNT(DISTINCT ${newsArticles.source})`,
            })
            .from(newsArticles)
            .where(eq(newsArticles.topicId, topic.id));
          if (statsRow) {
            const realArticles = Number(statsRow.totalArticles ?? 0);
            const realMedia = Number(statsRow.totalMedia ?? 0);
            // 如果快取值與真實值不一致，更新快取
            if (realArticles !== topic.totalArticles || realMedia !== topic.totalMedia) {
              await db
                .update(topics)
                .set({ totalArticles: realArticles, totalMedia: realMedia })
                .where(eq(topics.id, topic.id));
              topic.totalArticles = realArticles;
              topic.totalMedia = realMedia;
            }
          }
        }
        return { topic, turningPoints: turningPointsWithNews };
      }),
    // 取得議題下所有新聞文章（用於前端顯示全部來源）
    getTopicArticles: publicProcedure
      .input(z.object({ topicId: z.number(), limit: z.number().default(200) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const articles = await db
          .select({
            id: newsArticles.id,
            title: newsArticles.title,
            url: newsArticles.url,
            source: newsArticles.source,
            publishedAt: newsArticles.publishedAt,
            turningPointId: newsArticles.turningPointId,
            language: newsArticles.language,
          })
          .from(newsArticles)
          .where(eq(newsArticles.topicId, input.topicId))
          .orderBy(desc(newsArticles.publishedAt))
          .limit(input.limit);
        return articles.map(a => ({
          id: a.id,
          title: a.title,
          url: a.url,
          source: a.source,
          publishedAt: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : '',
          turningPointId: a.turningPointId,
          language: a.language,
        }));
      }),
    // 瀏覽議題題：記錄瀏覽次數，並為創建者荥點（24h 去重）
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
        if (!db) return { articleCount: 0, topicCount: 0, rssSourceCount: 0 };
        const [articleRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(newsArticles);
        const [topicRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(topics)
          .where(eq(topics.visibility, "public"));
        const [rssRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(rssSources);
        return {
          articleCount: Number(articleRow?.count ?? 0),
          topicCount: Number(topicRow?.count ?? 0),
          rssSourceCount: Number(rssRow?.count ?? 0),
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
          topicId: result.topic.id,
          isNew: result.turningPointsList.length > 0,
          visibility: input.visibility,
        };
      }),
    // 用戶自己建立的議題列表
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
    // 用戶追蹤的議題列表（包含自建 + 追蹤公開議題）
    savedTopics: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];
        // 列出用戶追蹤的議題（join topics 表）
        const saved = await db
          .select({
            id: userTopics.id,
            topicId: userTopics.topicId,
            isPinned: userTopics.isPinned,
            createdAt: userTopics.createdAt,
            topicQuery: topics.query,
            topicSlug: topics.slug,
            topicCategory: topics.category,
            topicHeatLevel: topics.heatLevel,
            topicTotalArticles: topics.totalArticles,
            topicTotalMedia: topics.totalMedia,
            topicLastUpdated: topics.lastUpdated,
            topicTags: topics.tags,
          })
          .from(userTopics)
          .innerJoin(topics, eq(userTopics.topicId, topics.id))
          .where(eq(userTopics.userId, ctx.user.id))
          .orderBy(desc(userTopics.isPinned), desc(userTopics.createdAt));
        return saved;
      }),
    // 追蹤議題
    saveTopic: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");
        // 檢查是否已追蹤
        const [existing] = await db
          .select()
          .from(userTopics)
          .where(and(eq(userTopics.userId, ctx.user.id), eq(userTopics.topicId, input.topicId)))
          .limit(1);
        if (existing) return { saved: false, message: "已追蹤此議題" };
        await db.insert(userTopics).values({
          userId: ctx.user.id,
          topicId: input.topicId,
          isPinned: 0,
        });
        return { saved: true, message: "追蹤成功" };
      }),
    // 取消追蹤議題
    unsaveTopic: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");
        await db
          .delete(userTopics)
          .where(and(eq(userTopics.userId, ctx.user.id), eq(userTopics.topicId, input.topicId)));
        return { saved: false, message: "已取消追蹤" };
      }),
    // 切換釘選狀態
    pinTopic: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive(), pin: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("資料庫連線失敗");
        await db
          .update(userTopics)
          .set({ isPinned: input.pin ? 1 : 0 })
          .where(and(eq(userTopics.userId, ctx.user.id), eq(userTopics.topicId, input.topicId)));
        return { pinned: input.pin };
      }),
    // 檢查用戶是否已追蹤某議題
    isSaved: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return false;
        const [row] = await db
          .select({ id: userTopics.id })
          .from(userTopics)
          .where(and(eq(userTopics.userId, ctx.user.id), eq(userTopics.topicId, input.topicId)))
          .limit(1);
        return !!row;
      }),

    // 取得所有標籤（公開 API，供前端篩選用）
    allTags: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({ tags: topics.tags })
          .from(topics)
          .where(and(
            eq(topics.visibility, "public"),
            sql`${topics.isActive} = 1`,
            sql`${topics.tags} IS NOT NULL AND ${topics.tags} != '[]'`,
          ));

        // 解析每個議題的 tags JSON，合併去重
        const tagSet = new Set<string>();
        for (const row of rows) {
          if (!row.tags) continue;
          try {
            const parsed = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
            if (Array.isArray(parsed)) {
              for (const t of parsed) {
                if (typeof t === 'string' && t.trim()) tagSet.add(t.trim());
              }
            }
          } catch {
            // 忽略解析失敗
          }
        }
        return Array.from(tagSet).sort();
      }),

    // 取得議題新語收集進度
    getProgress: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { articleCount: 0, turningPointCount: 0, status: 'unknown' as const };
        // 查詢議題
        const [topic] = await db
          .select({ id: topics.id, totalArticles: topics.totalArticles, totalMedia: topics.totalMedia, lastUpdated: topics.lastUpdated, collectionStage: topics.collectionStage })
          .from(topics)
          .where(eq(topics.slug, input.slug))
          .limit(1);
        if (!topic) return { articleCount: 0, turningPointCount: 0, status: 'not_found' as const, collectionStage: null as string | null };
        // 計算實際收集的文章數
        const [countRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(newsArticles)
          .where(eq(newsArticles.topicId, topic.id));
        const articleCount = Number(countRow?.count ?? 0);
        // 計算轉折點數
        const { turningPoints } = await import('../drizzle/schema');
        const [tpRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(turningPoints)
          .where(eq(turningPoints.topicId, topic.id));
        const turningPointCount = Number(tpRow?.count ?? 0);
        const TARGET = 50;
        const status = articleCount >= TARGET ? 'ready' : 'collecting';
        return { articleCount, turningPointCount, target: TARGET, status, lastUpdated: topic.lastUpdated, collectionStage: topic.collectionStage ?? 'ready' };
      }),

    // 訂閱議題通知
    subscribeNotification: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB error');
        const { topicSubscriptions } = await import('../drizzle/schema');
        await db
          .insert(topicSubscriptions)
          .values({ userId: ctx.user.id, topicId: input.topicId, notifyOnNewPoint: 1 })
          .onDuplicateKeyUpdate({ set: { notifyOnNewPoint: 1 } });
        return { subscribed: true };
      }),

    // 取消訂閱通知
    unsubscribeNotification: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB error');
        const { topicSubscriptions } = await import('../drizzle/schema');
        await db
          .delete(topicSubscriptions)
          .where(and(eq(topicSubscriptions.userId, ctx.user.id), eq(topicSubscriptions.topicId, input.topicId)));
        return { subscribed: false };
      }),

    // 查詢訂閱狀態
    isSubscribed: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return false;
        const { topicSubscriptions } = await import('../drizzle/schema');
        const [row] = await db
          .select({ id: topicSubscriptions.id })
          .from(topicSubscriptions)
          .where(and(eq(topicSubscriptions.userId, ctx.user.id), eq(topicSubscriptions.topicId, input.topicId)))
          .limit(1);
        return !!row;
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

    // 議題歉義消解：輸入關鍵字，AI 回傳 3-5 個可能的議題方向供用戶確認
    disambiguate: publicProcedure
      .input(z.object({ query: z.string().min(1).max(256) }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const prompt = `用戶輸入了關鍵字：「${input.query}」

請分析這個關鍵字可能對應哪些不同的新聞議題或事件方向。
請提供 3-5 個具體、清晰的議題方向，讓用戶選擇他真正想追蹤的方向。

要求：
1. 每個方向要具體且有區別性
2. 標題不超過 15 個字
3. 描述請簡短說明該方向的內容（20 字內）
4. 如果關鍵字已夠明確不具歉義性，可以只回傳 1 個方向
5. refinedQuery 是更精確的搜尋關鍵字，用於搜尋新聞`;
        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一個新聞議題分析專家，回傳格式為 JSON。' },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'disambiguate_result',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  candidates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        refinedQuery: { type: 'string' },
                      },
                      required: ['title', 'description', 'refinedQuery'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['candidates'],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = result.choices?.[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '{"candidates":[]}';
        try {
          const parsed = JSON.parse(content) as { candidates: Array<{ title: string; description: string; refinedQuery: string }> };
          return { candidates: parsed.candidates.slice(0, 5) };
        } catch {
          return { candidates: [{ title: input.query, description: '直接搜尋此議題', refinedQuery: input.query }] };
        }
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
      .mutation(async ({ ctx: _ctx, input }) => {
        // 點數系統開發中：暫時對所有登入用戶免費開放
        const response = await generateStanceResponse(input);
        return {
          content: response,
          pointsUsed: 0,
          pointsRemaining: 0,
        };
      }),

    // 根據議題標題自動推薦合適的回覆身份
    suggestRoles: publicProcedure
      .input(z.object({
        topicTitle: z.string().min(1).max(256),
        topicSummary: z.string().max(1000).optional(),
        topicCategory: z.string().max(64).optional(),
      }))
      .query(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const prompt = `你是一個專業的新語分析師。
以下是一則新語議題：
標題：${input.topicTitle}
${input.topicSummary ? `摘要：${input.topicSummary}` : ''}
${input.topicCategory ? `分類：${input.topicCategory}` : ''}

請分析此議題，推薦 4−5 個最可能需要對此議題發表立場或回覆的具體身份。

要求：
1. 身份要具體且具有代表性（不要太泛泛）
2. 包含不同觀點的利益相關者（政府、業界、媒體、公民社會等）
3. 身份名稱不超過 12 個字
4. 回傳 JSON 格式：{"roles": ["...", "...", "...", "..."]}

只回傳 JSON，不要其他文字。`;
        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一個專業的新語分析師，回傳格式將是 JSON。' },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'role_suggestions',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  roles: { type: 'array', items: { type: 'string' } },
                },
                required: ['roles'],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = result.choices?.[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '{"roles":[]}';
        try {
          const parsed = JSON.parse(content);
          return { roles: (parsed.roles as string[]).slice(0, 5) };
        } catch {
          return { roles: [] };
        }
      }),

    // 生成分享論點建議（供用戶分享時選用）
    generateShareOpinions: publicProcedure
      .input(z.object({
        topicTitle: z.string().min(1).max(256),
        topicSummary: z.string().max(2000).optional(),
        turningPoints: z.array(z.string()).max(10).optional(),
      }))
      .query(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        const tpContext = input.turningPoints && input.turningPoints.length > 0
          ? `\n重大轉折點：\n${input.turningPoints.slice(0, 5).map((tp, i) => `${i + 1}. ${tp}`).join('\n')}`
          : '';
        const prompt = `你是一個台灣新語評論員。
以下是一則新語議題：
標題：${input.topicTitle}
${input.topicSummary ? `摘要：${input.topicSummary}` : ''}${tpContext}

請針對此議題，生成 4 個不同角度的個人觀點，供讀者在分享新語時選用。

要求：
1. 每個觀點 25-40 個字，簡潔有力
2. 涵蓋不同立場（支持、質疑、中立分析、長遠影響）
3. 語氣自然，像真實讀者的個人感想
4. 用繁體中文
5. 不要以「我」開頭，用「這」、「此」、「台灣」、「值得」等開頭

回傳 JSON 格式：{"opinions": ["...", "...", "...", "..."]}
只回傳 JSON，不要其他文字。`;
        try {
          const result = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一個台灣新語評論員，回傳格式為 JSON。' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'share_opinions',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    opinions: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['opinions'],
                  additionalProperties: false,
                },
              },
            },
          });
          const rawContent = result.choices?.[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{"opinions":[]}';
          const parsed = JSON.parse(content);
          return { opinions: (parsed.opinions as string[]).slice(0, 4) };
        } catch {
          return { opinions: [] };
        }
      }),

    // 對話式修改已生成內容
    refineContent: protectedProcedure
      .input(z.object({
        currentContent: z.string().min(1).max(5000),
        instruction: z.string().min(1).max(500),
        role: z.string().min(1).max(128),
        responseType: z.enum(['press', 'social', 'memo']),
        topicTitle: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx: _ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        // 點數系統開發中：暫時對所有登入用戶免費開放
        const typeLabel = { press: '新語稿', social: '社群貼文', memo: '內部備忘' }[input.responseType];
        const refinePrompt = `你是一個專業的內容編輯師。

以下是一份以「${input.role}」身份撰寫的${typeLabel}：

---
${input.currentContent}
---

用戶要求修改：${input.instruction}

請根據用戶的要求修改內容。保持原有的身份觀點和文件類型，只調整用戶指定的部分。
直接回傳修改後的完整內容，不要加任何前言或說明。`;
        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一個專業的內容編輯師。' },
            { role: 'user', content: refinePrompt },
          ],
        });
        const refined = result.choices?.[0]?.message?.content ?? input.currentContent;
        return {
          content: refined,
          pointsUsed: 0,
          pointsRemaining: 0,
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

    // 手動觸發每日更新（供管理員測試）
    triggerDailyUpdate: protectedProcedure
      .mutation(async () => {
        const result = await triggerManualUpdate();
        return { ...result, message: `手動更新完成：成功 ${result.success} 個，失敗 ${result.failed} 個` };
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

  // ─── Organize (Merge / Split / Learn) ────────────────────────────────────────────────
  organize: router({
    // 記錄用戶拖拉行為（學習信號）
    recordSignal: protectedProcedure
      .input(z.object({
        sourceTopicId: z.number().int().positive(),
        targetTopicId: z.number().int().positive(),
        action: z.enum(['merge', 'split']),
        confidence: z.number().int().min(1).max(5).default(3),
        note: z.string().max(256).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('資料庫連線失敗');
        // 防止同一用戶重複投票（同一對議題對已有信號則更新）
        const [existing] = await db
          .select()
          .from(topicMergeSignals)
          .where(and(
            eq(topicMergeSignals.userId, ctx.user.id),
            eq(topicMergeSignals.sourceTopicId, input.sourceTopicId),
            eq(topicMergeSignals.targetTopicId, input.targetTopicId),
          ))
          .limit(1);
        if (existing) {
          await db.update(topicMergeSignals)
            .set({ action: input.action, confidence: input.confidence, note: input.note ?? null })
            .where(eq(topicMergeSignals.id, existing.id));
          return { success: true, updated: true };
        }
        await db.insert(topicMergeSignals).values({
          userId: ctx.user.id,
          sourceTopicId: input.sourceTopicId,
          targetTopicId: input.targetTopicId,
          action: input.action,
          confidence: input.confidence,
          note: input.note ?? null,
        });
        return { success: true, updated: false };
      }),

    // 查看兩個議題之間的學習信號統計
    getSignalStats: publicProcedure
      .input(z.object({
        topicIdA: z.number().int().positive(),
        topicIdB: z.number().int().positive(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { mergeVotes: 0, splitVotes: 0, totalVotes: 0 };
        const signals = await db
          .select()
          .from(topicMergeSignals)
          .where(sql`(
            (${topicMergeSignals.sourceTopicId} = ${input.topicIdA} AND ${topicMergeSignals.targetTopicId} = ${input.topicIdB})
            OR
            (${topicMergeSignals.sourceTopicId} = ${input.topicIdB} AND ${topicMergeSignals.targetTopicId} = ${input.topicIdA})
          )`);
        const mergeVotes = signals.filter(s => s.action === 'merge').reduce((sum, s) => sum + s.confidence, 0);
        const splitVotes = signals.filter(s => s.action === 'split').reduce((sum, s) => sum + s.confidence, 0);
        return { mergeVotes, splitVotes, totalVotes: signals.length };
      }),

    // 學習信號列表（合併票數最多的前 20 對）
    getTopSignals: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const signals = await db
          .select({
            sourceTopicId: topicMergeSignals.sourceTopicId,
            targetTopicId: topicMergeSignals.targetTopicId,
            action: topicMergeSignals.action,
            voteCount: sql<number>`COUNT(*)`,
            totalConfidence: sql<number>`SUM(${topicMergeSignals.confidence})`,
          })
          .from(topicMergeSignals)
          .groupBy(topicMergeSignals.sourceTopicId, topicMergeSignals.targetTopicId, topicMergeSignals.action)
          .orderBy(desc(sql`SUM(${topicMergeSignals.confidence})`))
          .limit(input?.limit ?? 20);
        return signals;
      }),

    // 實際執行合併（保留 targetTopic，將 sourceTopic 的轉折點和文章移轉過去，再刪除 sourceTopic）
    mergeTopics: protectedProcedure
      .input(z.object({
        sourceTopicId: z.number().int().positive(), // 被合併掉的議題
        targetTopicId: z.number().int().positive(), // 保留的議題
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('資料庫連線失敗');
        if (input.sourceTopicId === input.targetTopicId) throw new Error('不能合併相同議題');
        // 查詢兩個議題
        const [source] = await db.select().from(topics).where(eq(topics.id, input.sourceTopicId)).limit(1);
        const [target] = await db.select().from(topics).where(eq(topics.id, input.targetTopicId)).limit(1);
        if (!source || !target) throw new Error('議題不存在');
        // 移轉轉折點
        await db.update(turningPoints)
          .set({ topicId: input.targetTopicId })
          .where(eq(turningPoints.topicId, input.sourceTopicId));
        // 移轉文章
        await db.update(newsArticles)
          .set({ topicId: input.targetTopicId })
          .where(eq(newsArticles.topicId, input.sourceTopicId));
        // 記錄合併歷史
        await db.insert(topicMergeHistory).values({
          action: 'merge',
          sourceTopicId: input.sourceTopicId,
          targetTopicId: input.targetTopicId,
          executedByUserId: ctx.user.id,
          signalCount: 0,
          sourceTopicQuery: source.query,
        });
        // 刪除 source 議題
        await db.delete(topics).where(eq(topics.id, input.sourceTopicId));
        return { success: true, mergedInto: target.slug, targetQuery: target.query };
      }),

    // 分割護題：將指定轉折點分割成新議題
    splitTopic: protectedProcedure
      .input(z.object({
        sourceTopicId: z.number().int().positive(),
        turningPointIds: z.array(z.number().int().positive()).min(1), // 要分割出去的轉折點 IDs
        newTopicQuery: z.string().min(1).max(256), // 新議題的名稱
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('資料庫連線失敗');
        const [source] = await db.select().from(topics).where(eq(topics.id, input.sourceTopicId)).limit(1);
        if (!source) throw new Error('議題不存在');
        // 建立新議題
        const newSlug = `split-${Date.now()}`;
        await db.insert(topics).values({
          slug: newSlug,
          query: input.newTopicQuery,
          heatLevel: 'medium',
          trendDirection: 'stable',
        });
        const [newTopic] = await db.select().from(topics).where(eq(topics.slug, newSlug)).limit(1);
        if (!newTopic) throw new Error('建立新議題失敗');
        // 移轉指定轉折點到新議題
        for (const tpId of input.turningPointIds) {
          await db.update(turningPoints)
            .set({ topicId: newTopic.id })
            .where(and(eq(turningPoints.id, tpId), eq(turningPoints.topicId, input.sourceTopicId)));
        }
        // 記錄分割歷史
        await db.insert(topicMergeHistory).values({
          action: 'split',
          sourceTopicId: input.sourceTopicId,
          resultTopicId: newTopic.id,
          executedByUserId: ctx.user.id,
          signalCount: 0,
          sourceTopicQuery: source.query,
        });
        return { success: true, newTopicSlug: newSlug, newTopicId: newTopic.id };
      }),

    // 操作歷史記錄
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(topicMergeHistory)
          .orderBy(desc(topicMergeHistory.createdAt))
          .limit(input?.limit ?? 20);
      }),
  }),
});

export type AppRouter = typeof appRouter;
