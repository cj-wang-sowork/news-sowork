/**
 * NewsFlow — Layered Auto-Update Scheduler
 *
 * 預設排程：
 * - RSS 全量抓取：每 15 分鐘
 * - Embedding 補跑：每 10 分鐘
 * - 熱門公開議題刷新：每 1 小時
 * - 全量公開議題刷新：每天凌晨 3:00（UTC+8）
 *
 * 使用純 setInterval / setTimeout 實作，不依賴外部 cron 套件。
 */

import { topics } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { buildTopicTimeline } from "./aiAnalysis";
import { getDb } from "./db";
import {
  fetchAndStoreArticles,
  generateEmbeddingsForPendingArticles,
  seedRssSources,
} from "./newsIngestion";

let schedulerStarted = false;
const runningJobs = new Set<string>();

const MINUTE = 60 * 1000;
const DEFAULTS = {
  rssIntervalMs: 15 * MINUTE,
  embeddingIntervalMs: 10 * MINUTE,
  hotTopicIntervalMs: 60 * MINUTE,
  dailyUpdateHourUtc8: 3,
  hotTopicLimit: 12,
  dailyTopicLimit: 30,
  hotTopicDelayMs: 3000,
  dailyTopicDelayMs: 5000,
  embeddingBatchSize: 100,
} as const;

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSchedulerConfig() {
  return {
    rssIntervalMs: getNumberEnv("NEWSFLOW_RSS_INTERVAL_MS", DEFAULTS.rssIntervalMs),
    embeddingIntervalMs: getNumberEnv("NEWSFLOW_EMBEDDING_INTERVAL_MS", DEFAULTS.embeddingIntervalMs),
    hotTopicIntervalMs: getNumberEnv("NEWSFLOW_HOT_TOPIC_INTERVAL_MS", DEFAULTS.hotTopicIntervalMs),
    dailyUpdateHourUtc8: getNumberEnv("NEWSFLOW_DAILY_UPDATE_HOUR_UTC8", DEFAULTS.dailyUpdateHourUtc8),
    hotTopicLimit: getNumberEnv("NEWSFLOW_HOT_TOPIC_LIMIT", DEFAULTS.hotTopicLimit),
    dailyTopicLimit: getNumberEnv("NEWSFLOW_DAILY_TOPIC_LIMIT", DEFAULTS.dailyTopicLimit),
    hotTopicDelayMs: getNumberEnv("NEWSFLOW_HOT_TOPIC_DELAY_MS", DEFAULTS.hotTopicDelayMs),
    dailyTopicDelayMs: getNumberEnv("NEWSFLOW_DAILY_TOPIC_DELAY_MS", DEFAULTS.dailyTopicDelayMs),
    embeddingBatchSize: getNumberEnv("NEWSFLOW_EMBEDDING_BATCH_SIZE", DEFAULTS.embeddingBatchSize),
  };
}

/**
 * 計算距離下一個指定小時（UTC+8）的毫秒數
 */
function msUntilNextRun(targetHour = 3): number {
  const now = new Date();
  const utc8Offset = 8 * 60 * 60 * 1000;
  const nowUtc8 = new Date(now.getTime() + utc8Offset);

  const next = new Date(nowUtc8);
  next.setHours(targetHour, 0, 0, 0);

  if (next.getTime() <= nowUtc8.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - nowUtc8.getTime();
}

async function runExclusive<T>(jobName: string, fn: () => Promise<T>): Promise<T | null> {
  if (runningJobs.has(jobName)) {
    console.log(`[Scheduler] ${jobName} 已在執行中，略過重複觸發`);
    return null;
  }

  runningJobs.add(jobName);
  const startedAt = Date.now();

  try {
    console.log(`[Scheduler] ${jobName} 開始`);
    const result = await fn();
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[Scheduler] ${jobName} 完成（${elapsedSec}s）`);
    return result;
  } catch (error) {
    console.error(`[Scheduler] ${jobName} 失敗:`, error);
    throw error;
  } finally {
    runningJobs.delete(jobName);
  }
}

async function refreshPublicTopics(options: {
  limit: number;
  delayMs: number;
  jobLabel: string;
}): Promise<{ success: number; failed: number; total: number }> {
  const db = await getDb();
  if (!db) {
    console.error(`[Scheduler] ${options.jobLabel}：資料庫連線失敗`);
    return { success: 0, failed: 0, total: 0 };
  }

  const publicTopics = await db
    .select({ id: topics.id, query: topics.query, slug: topics.slug })
    .from(topics)
    .where(sql`${topics.visibility} = 'public' AND ${topics.isActive} = 1`)
    .orderBy(sql`${topics.lastUpdated} ASC`)
    .limit(options.limit);

  console.log(`[Scheduler] ${options.jobLabel}：找到 ${publicTopics.length} 個議題`);

  let successCount = 0;
  let failCount = 0;

  for (const topic of publicTopics) {
    try {
      console.log(`[Scheduler] ${options.jobLabel}：更新議題 ${topic.query}`);
      await buildTopicTimeline(topic.query);
      successCount++;
      if (options.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
    } catch (error) {
      console.error(`[Scheduler] ${options.jobLabel}：議題「${topic.query}」更新失敗`, error);
      failCount++;
    }
  }

  console.log(
    `[Scheduler] ${options.jobLabel} 完成：成功 ${successCount} 個，失敗 ${failCount} 個`
  );

  return { success: successCount, failed: failCount, total: publicTopics.length };
}

async function runRssIngestion(): Promise<{ stored: number }> {
  await seedRssSources();
  const stored = await fetchAndStoreArticles();
  console.log(`[Scheduler] RSS 抓取完成：新增 / 更新 ${stored} 篇新聞`);
  return { stored };
}

async function runEmbeddingBackfill(limit: number): Promise<{ processed: number }> {
  const processed = await generateEmbeddingsForPendingArticles(limit);
  console.log(`[Scheduler] Embedding 補跑完成：處理 ${processed} 篇新聞`);
  return { processed };
}

function scheduleRepeatingJob(jobName: string, intervalMs: number, task: () => Promise<unknown>, runOnBoot = false): void {
  if (runOnBoot) {
    setTimeout(() => {
      runExclusive(jobName, task).catch(console.error);
    }, 15 * 1000);
  }

  setInterval(() => {
    runExclusive(jobName, task).catch(console.error);
  }, intervalMs);

  console.log(`[Scheduler] 已排程 ${jobName}，每 ${(intervalMs / MINUTE).toFixed(0)} 分鐘執行一次`);
}

/**
 * 啟動排程器（只啟動一次）
 */
export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const config = getSchedulerConfig();

  scheduleRepeatingJob("rss-ingestion", config.rssIntervalMs, () => runRssIngestion(), true);
  scheduleRepeatingJob(
    "embedding-backfill",
    config.embeddingIntervalMs,
    () => runEmbeddingBackfill(config.embeddingBatchSize),
    true
  );
  scheduleRepeatingJob(
    "hot-topic-refresh",
    config.hotTopicIntervalMs,
    () => refreshPublicTopics({
      limit: config.hotTopicLimit,
      delayMs: config.hotTopicDelayMs,
      jobLabel: "熱門議題刷新",
    }),
    true
  );

  const msToFirst = msUntilNextRun(config.dailyUpdateHourUtc8);
  const hoursToFirst = (msToFirst / 1000 / 60 / 60).toFixed(1);
  console.log(
    `[Scheduler] 全量公開議題刷新已啟動，距離下次執行還有 ${hoursToFirst} 小時（每天凌晨 ${config.dailyUpdateHourUtc8}:00 UTC+8）`
  );

  setTimeout(() => {
    runExclusive("daily-topic-refresh", () =>
      refreshPublicTopics({
        limit: config.dailyTopicLimit,
        delayMs: config.dailyTopicDelayMs,
        jobLabel: "全量公開議題刷新",
      })
    ).catch(console.error);

    setInterval(() => {
      runExclusive("daily-topic-refresh", () =>
        refreshPublicTopics({
          limit: config.dailyTopicLimit,
          delayMs: config.dailyTopicDelayMs,
          jobLabel: "全量公開議題刷新",
        })
      ).catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }, msToFirst);
}

/**
 * 手動觸發一次全量公開議題更新（供管理員 API 呼叫）
 */
export async function triggerManualUpdate(): Promise<{ success: number; failed: number; total: number }> {
  const config = getSchedulerConfig();
  return (
    (await runExclusive("manual-daily-topic-refresh", () =>
      refreshPublicTopics({
        limit: config.dailyTopicLimit,
        delayMs: 3000,
        jobLabel: "手動全量公開議題刷新",
      })
    )) ?? { success: 0, failed: 0, total: 0 }
  );
}

export async function triggerManualHotRefresh(): Promise<{ success: number; failed: number; total: number }> {
  const config = getSchedulerConfig();
  return (
    (await runExclusive("manual-hot-topic-refresh", () =>
      refreshPublicTopics({
        limit: config.hotTopicLimit,
        delayMs: 1500,
        jobLabel: "手動熱門議題刷新",
      })
    )) ?? { success: 0, failed: 0, total: 0 }
  );
}

export async function triggerManualEmbeddingBackfill(): Promise<{ processed: number }> {
  const config = getSchedulerConfig();
  return (
    (await runExclusive("manual-embedding-backfill", () =>
      runEmbeddingBackfill(config.embeddingBatchSize)
    )) ?? { processed: 0 }
  );
}

export async function triggerManualRssIngestion(): Promise<{ stored: number }> {
  return (await runExclusive("manual-rss-ingestion", () => runRssIngestion())) ?? { stored: 0 };
}
