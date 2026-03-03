import {
  bigint,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
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
  // 點數餘額：新用戶預設 100 點（歡迎禮）
  points: int("points").default(100).notNull(),
  // Password authentication fields
  passwordHash: varchar("passwordHash", { length: 255 }),
  authMethod: mysqlEnum("authMethod", ["password", "oauth", "google"]).default("password"),
  // Google / social login
  avatar: text("avatar"),
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
  // 新增：議題創建者（null = 平台預設議題）
  creatorId: int("creatorId"),
  // 新增：可見性（public = 公開，private = 私人）
  visibility: mysqlEnum("visibility", ["public", "private"]).default("public").notNull(),
  // 新增：累計瀏覽次數
  viewCount: int("viewCount").default(0).notNull(),
  // 標籤（JSON 字串，如 ["AI","科技","台灣"]）
  tags: text("tags"),
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

// ─── Point Transactions ───────────────────────────────────────────────────────
// 記錄所有點數異動歷史（賺點 / 扣點）
export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 正數 = 賺點，負數 = 扣點
  amount: int("amount").notNull(),
  // 類型：view_reward=被瀏覽賺點, ai_usage=AI功能扣點, welcome=新用戶禮, admin=管理員調整
  type: mysqlEnum("type", ["view_reward", "ai_usage", "welcome", "admin"]).notNull(),
  // 關聯的議題（若有）
  topicId: int("topicId"),
  // 備註說明
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = typeof pointTransactions.$inferInsert;

// ─── Topic Views ──────────────────────────────────────────────────────────────
// 記錄瀏覽紀錄，防止同一用戶重複觸發賺點（每 24 小時只算一次）
export const topicViews = mysqlTable("topic_views", {
  id: int("id").autoincrement().primaryKey(),
  topicId: int("topicId").notNull(),
  // 瀏覽者 userId（null = 未登入訪客）
  viewerId: int("viewerId"),
  // 瀏覽者 IP（用於訪客去重）
  viewerIp: varchar("viewerIp", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TopicView = typeof topicViews.$inferSelect;
export type InsertTopicView = typeof topicViews.$inferInsert;

// ─── User Topics ──────────────────────────────────────────────────────────────
// 用戶私有議題追蹤：登入用戶可以追蹤任何公開議題，或建立只有自己看得到的私有議題
export const userTopics = mysqlTable("user_topics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 關聯到 topics 表（若追蹤現有議題）
  topicId: int("topicId"),
  // 自定義私有議題標題（若不關聯現有議題）
  customTitle: varchar("customTitle", { length: 256 }),
  // 自定義搜尋關鍵字
  customQuery: varchar("customQuery", { length: 256 }),
  // 備註
  note: text("note"),
  // 是否已釘選
  isPinned: int("isPinned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserTopic = typeof userTopics.$inferSelect;
export type InsertUserTopic = typeof userTopics.$inferInsert;

// ─── User Conversations ───────────────────────────────────────────────────────
// AI 對話記錄：每個對話關聯到一個議題，私有化存儲，只有創建者能看到
export const userConversations = mysqlTable("user_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 關聯的議題
  topicId: int("topicId").notNull(),
  // 對話標題（自動生成或用戶自訂）
  title: varchar("title", { length: 256 }).notNull(),
  // 消耗的點數
  pointsUsed: int("pointsUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserConversation = typeof userConversations.$inferSelect;
export type InsertUserConversation = typeof userConversations.$inferInsert;

// ─── Conversation Messages ────────────────────────────────────────────────────
// 對話訊息：每條訊息屬於一個對話
export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  // 角色：user = 用戶訊息, assistant = AI 回覆
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  // 此訊息消耗的點數（僅 assistant 訊息有值）
  pointsCost: int("pointsCost").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

// ─── Topic Subscriptions ──────────────────────────────────────────────────────
// 議題訂閱：用戶訂閱議題後，當有新轉折點時收到通知
export const topicSubscriptions = mysqlTable("topic_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  topicId: int("topicId").notNull(),
  // 是否開啟新轉折點通知
  notifyOnNewPoint: tinyint("notifyOnNewPoint").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TopicSubscription = typeof topicSubscriptions.$inferSelect;
export type InsertTopicSubscription = typeof topicSubscriptions.$inferInsert;

// ─── Topic Merge Signals ──────────────────────────────────────────────────────
// 用戶拖拉行為學習信號：記錄每次用戶認為兩個議題應該合併或分開的投票
// 系統累積這些信號，當合併票數超過門檻時自動執行合併
export const topicMergeSignals = mysqlTable("topic_merge_signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 被拖拉的議題（來源）
  sourceTopicId: int("sourceTopicId").notNull(),
  // 拖拉目標議題（目標）
  targetTopicId: int("targetTopicId").notNull(),
  // 行為類型：merge = 建議合併, split = 建議分開
  action: mysqlEnum("action", ["merge", "split"]).notNull(),
  // 信心分數（1-5，預設 3，未來可讓用戶評分）
  confidence: int("confidence").default(3).notNull(),
  // 用戶備註（可選）
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TopicMergeSignal = typeof topicMergeSignals.$inferSelect;
export type InsertTopicMergeSignal = typeof topicMergeSignals.$inferInsert;

// ─── Topic Merge History ──────────────────────────────────────────────────────
// 實際執行過的合併/分割操作記錄（可追溯、可復原）
export const topicMergeHistory = mysqlTable("topic_merge_history", {
  id: int("id").autoincrement().primaryKey(),
  // 操作類型
  action: mysqlEnum("action", ["merge", "split"]).notNull(),
  // 合併：sourceTopicId 被合併進 targetTopicId（source 被刪除）
  // 分割：sourceTopicId 被分割，新議題 ID 存在 resultTopicId
  sourceTopicId: int("sourceTopicId").notNull(),
  targetTopicId: int("targetTopicId"),
  // 分割後新建的議題 ID
  resultTopicId: int("resultTopicId"),
  // 執行者（用戶 ID，null = 系統自動執行）
  executedByUserId: int("executedByUserId"),
  // 觸發此操作的信號數量（0 = 手動執行）
  signalCount: int("signalCount").default(0).notNull(),
  // 備份：被刪除議題的原始 query（方便追溯）
  sourceTopicQuery: varchar("sourceTopicQuery", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TopicMergeHistory = typeof topicMergeHistory.$inferSelect;
export type InsertTopicMergeHistory = typeof topicMergeHistory.$inferInsert;
