import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database helpers
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = no DB, use fallback
  getHotTopics: vi.fn().mockResolvedValue([]),
  getTopicBySlug: vi.fn().mockResolvedValue(null),
  getTopicTurningPoints: vi.fn().mockResolvedValue([]),
  getTurningPointNews: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// Mock AI analysis
vi.mock("./aiAnalysis", () => ({
  generateStanceResponse: vi.fn().mockResolvedValue("【新聞稿範本】\n\n這是 AI 模擬生成的立場回覆。"),
  buildTopicTimeline: vi.fn().mockResolvedValue(null),
}));

// Mock RSS ingestion
vi.mock("./newsIngestion", () => ({
  fetchAndStoreArticles: vi.fn().mockResolvedValue(0),
  seedRssSources: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("topics.hot", () => {
  it("returns empty array when no DB is available", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.topics.hot({ limit: 6 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts limit parameter between 1 and 24", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.topics.hot({ limit: 12 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("topics.getTimeline", () => {
  it("returns null when topic slug not found", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.topics.getTimeline({ slug: "nonexistent-topic" });
    expect(result).toBeNull();
  });
});

describe("topics.createOrFind", () => {
  it("returns fallback slug when DB is unavailable", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.topics.createOrFind({ query: "攻打伊朗" });
    expect(result).toHaveProperty("slug");
    expect(typeof result.slug).toBe("string");
    expect(result.slug.length).toBeGreaterThan(0);
  });
});

describe("ai.generateStance", () => {
  it("returns generated content string", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ai.generateStance({
      topicTitle: "美以聯合空襲伊朗",
      topicSummary: "2026年2月28日，美國與以色列聯合空襲伊朗核設施",
      role: "國防部發言人",
      responseType: "press",
      language: "zh-TW",
    });
    expect(result).toHaveProperty("content");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("validates responseType enum", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should work with valid enum values
    for (const type of ["press", "social", "memo"] as const) {
      const result = await caller.ai.generateStance({
        topicTitle: "測試主題",
        topicSummary: "測試摘要",
        role: "測試身份",
        responseType: type,
        language: "zh-TW",
      });
      expect(result.content).toBeTruthy();
    }
  });
});

describe("news.fetchRss", () => {
  it("returns stored count", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.news.fetchRss();
    expect(result).toHaveProperty("stored");
    expect(typeof result.stored).toBe("number");
  });
});

describe("admin.ingestStatus", () => {
  it("returns article and topic counts", async () => {
    const user = {
      id: 1,
      openId: "owner-user",
      email: "admin@sowork.ai",
      name: "Admin",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx = {
      user,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.ingestStatus();
    expect(result).toHaveProperty("articleCount");
    expect(result).toHaveProperty("topicCount");
    expect(typeof result.articleCount).toBe("number");
    expect(typeof result.topicCount).toBe("number");
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.ingestStatus()).rejects.toThrow();
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
