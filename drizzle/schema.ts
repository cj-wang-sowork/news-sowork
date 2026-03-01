import {
  bigint,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Topics ──────────────────────────────────────────────────────────────────
export const topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  query: varchar("query", { length: 256 }).notNull(),
  queryEn: varchar("queryEn", { length: 256 }),
  totalArticles: int("totalArticles").default(0).notNull(),
  totalMedia: int("totalMedia").default(0).notNull(),
  heatLevel: mysqlEnum("heatLevel", ["extreme", "high", "medium", "low"]).default("medium").notNull(),
  trendDirection: mysqlEnum("trendDirection", ["up", "down", "stable"]).default("stable").notNull(),
  trendPercent: int("trendPercent").default(0).notNull(),
  category: varchar("category", { length: 64 }),
  isActive: int("isActive").default(1).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = typeof topics.$inferInsert;

// ─── Turning Points ───────────────────────────────────────────────────────────
export const turningPoints = mysqlTable("turning_points", {
  id: int("id").autoincrement().primaryKey(),
  topicId: int("topicId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  titleEn: varchar("titleEn", { length: 256 }),
  summary: text("summary").notNull(),
  summaryEn: text("summaryEn"),
  dateLabel: varchar("dateLabel", { length: 64 }).notNull(),
  eventDate: timestamp("eventDate").notNull(),
  articleCount: int("articleCount").default(0).notNull(),
  mediaCount: int("mediaCount").default(0).notNull(),
  heatLevel: mysqlEnum("heatLevel", ["extreme", "high", "medium", "low"]).default("medium").notNull(),
  isActive: int("isActive").default(0).notNull(),
  semanticDrift: float("semanticDrift"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TurningPoint = typeof turningPoints.$inferSelect;
export type InsertTurningPoint = typeof turningPoints.$inferInsert;

// ─── News Articles ────────────────────────────────────────────────────────────
export const newsArticles = mysqlTable("news_articles", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  turningPointId: int("turningPointId"),
  topicId: int("topicId"),
  title: text("title").notNull(),
  titleEn: text("titleEn"),
  url: varchar("url", { length: 1024 }).notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  sourceFlag: varchar("sourceFlag", { length: 8 }),
  language: varchar("language", { length: 16 }).notNull(),
  publishedAt: timestamp("publishedAt").notNull(),
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
  embeddingVector: json("embeddingVector"),
  semanticClusterId: varchar("semanticClusterId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;

// ─── RSS Sources ──────────────────────────────────────────────────────────────
export const rssSources = mysqlTable("rss_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  nameLocal: varchar("nameLocal", { length: 128 }),
  url: varchar("url", { length: 1024 }).notNull().unique(),
  language: varchar("language", { length: 16 }).notNull(),
  country: varchar("country", { length: 8 }),
  flag: varchar("flag", { length: 8 }),
  category: varchar("category", { length: 64 }),
  isActive: int("isActive").default(1).notNull(),
  lastFetchedAt: timestamp("lastFetchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RssSource = typeof rssSources.$inferSelect;
export type InsertRssSource = typeof rssSources.$inferInsert;
