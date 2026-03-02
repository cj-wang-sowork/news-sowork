import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, newsArticles, rssSources, topics, turningPoints, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ─────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Topic helpers ────────────────────────────────────────────────────────────
export async function getHotTopics(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(topics)
    .where(eq(topics.isActive, 1))
    .orderBy(desc(topics.lastUpdated))
    .limit(limit);
}

export async function getTopicBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function getTopicTurningPoints(topicId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topicId))
    .orderBy(desc(turningPoints.eventDate)); // 最新轉折點在最前
}

export async function getTurningPointNews(turningPointId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.turningPointId, turningPointId))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit);
}

export async function getRssSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rssSources).where(eq(rssSources.isActive, 1));
}

export async function updateTopicStats(topicId: number) {
  const db = await getDb();
  if (!db) return;
  const [stats] = await db
    .select({
      totalArticles: sql<number>`COUNT(DISTINCT ${newsArticles.id})`,
      totalMedia: sql<number>`COUNT(DISTINCT ${newsArticles.source})`,
    })
    .from(newsArticles)
    .where(eq(newsArticles.topicId, topicId));
  if (stats) {
    await db
      .update(topics)
      .set({ totalArticles: stats.totalArticles, totalMedia: stats.totalMedia, lastUpdated: new Date() })
      .where(eq(topics.id, topicId));
  }
}
