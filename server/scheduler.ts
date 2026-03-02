/**
 * NewsFlow — Daily Auto-Update Scheduler
 * 每天凌晨 3:00 (UTC+8) 自動重新抓取所有公開議題的最新新聞
 * 使用純 setInterval 實作，不依賴外部 cron 套件
 */

import { getDb } from "./db";
import { topics } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { buildTopicTimeline } from "./aiAnalysis";

let schedulerStarted = false;

/**
 * 計算距離下一個凌晨 3:00 (UTC+8) 的毫秒數
 */
function msUntilNextRun(targetHour = 3): number {
  const now = new Date();
  // UTC+8 offset
  const utc8Offset = 8 * 60 * 60 * 1000;
  const nowUtc8 = new Date(now.getTime() + utc8Offset);

  const next = new Date(nowUtc8);
  next.setHours(targetHour, 0, 0, 0);

  // 如果今天的目標時間已過，改成明天
  if (next.getTime() <= nowUtc8.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - nowUtc8.getTime();
}

/**
 * 執行一次所有公開議題的更新
 */
async function runDailyUpdate(): Promise<void> {
  console.log("[Scheduler] 開始每日議題更新...");
  const db = await getDb();
  if (!db) {
    console.error("[Scheduler] 資料庫連線失敗，跳過本次更新");
    return;
  }

  // 取得所有公開且啟用的議題
  const publicTopics = await db
    .select({ id: topics.id, query: topics.query, slug: topics.slug })
    .from(topics)
    .where(sql`${topics.visibility} = 'public' AND ${topics.isActive} = 1`)
    .orderBy(sql`${topics.lastUpdated} ASC`) // 最久沒更新的優先
    .limit(30); // 每次最多更新 30 個，避免 API 過載

  console.log(`[Scheduler] 找到 ${publicTopics.length} 個議題需要更新`);

  let successCount = 0;
  let failCount = 0;

  for (const topic of publicTopics) {
    try {
      console.log(`[Scheduler] 更新議題: ${topic.query}`);
      await buildTopicTimeline(topic.query);
      successCount++;
      // 每個議題間隔 5 秒，避免 Google News 限流
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (err) {
      console.error(`[Scheduler] 議題「${topic.query}」更新失敗:`, err);
      failCount++;
    }
  }

  console.log(`[Scheduler] 每日更新完成：成功 ${successCount} 個，失敗 ${failCount} 個`);
}

/**
 * 啟動排程器（只啟動一次）
 */
export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const msToFirst = msUntilNextRun(3);
  const hoursToFirst = (msToFirst / 1000 / 60 / 60).toFixed(1);
  console.log(`[Scheduler] 排程器已啟動，距離下次執行還有 ${hoursToFirst} 小時（每天凌晨 3:00 UTC+8）`);

  // 第一次在凌晨 3:00 執行
  setTimeout(() => {
    runDailyUpdate().catch(console.error);
    // 之後每 24 小時執行一次
    setInterval(() => {
      runDailyUpdate().catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }, msToFirst);
}

/**
 * 手動觸發一次更新（供管理員 API 呼叫）
 */
export async function triggerManualUpdate(): Promise<{ success: number; failed: number }> {
  const db = await getDb();
  if (!db) return { success: 0, failed: 0 };

  const publicTopics = await db
    .select({ id: topics.id, query: topics.query })
    .from(topics)
    .where(sql`${topics.visibility} = 'public' AND ${topics.isActive} = 1`)
    .orderBy(sql`${topics.lastUpdated} ASC`)
    .limit(30);

  let successCount = 0;
  let failCount = 0;

  for (const topic of publicTopics) {
    try {
      await buildTopicTimeline(topic.query);
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch {
      failCount++;
    }
  }

  return { success: successCount, failed: failCount };
}
