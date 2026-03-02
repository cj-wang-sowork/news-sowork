/**
 * 批次重建所有現有議題的時間軸
 * 清除舊轉折點後，用最新 AI 邏輯（最近 7 天）重新分析
 */
import { buildTopicTimeline } from "../server/aiAnalysis";
import { getDb } from "../server/db";
import { topics } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import * as fs from "fs";

const LOG_FILE = "/tmp/rebuild-progress.log";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

async function main() {
  // 清空 log
  fs.writeFileSync(LOG_FILE, "");

  const db = await getDb();
  if (!db) {
    log("❌ 無法連接資料庫");
    process.exit(1);
  }

  // 取得所有議題（依 id 排序）
  const allTopics = await db
    .select({ id: topics.id, query: topics.query, slug: topics.slug })
    .from(topics)
    .orderBy(desc(topics.id));

  log(`\n🚀 開始重建 ${allTopics.length} 個議題的時間軸\n${"─".repeat(60)}`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < allTopics.length; i++) {
    const topic = allTopics[i]!;
    const num = `[${String(i + 1).padStart(2, "0")}/${allTopics.length}]`;

    try {
      log(`${num} 分析中: ${topic.query}`);
      const result = await buildTopicTimeline(topic.query);

      if (result?.topic) {
        log(`${num} ✅ ${topic.query} → ${result.turningPointsList.length} 個轉折點`);
        successCount++;
      } else {
        log(`${num} ⚠️ ${topic.query} → 無新聞（可能無最近 7 天的報導）`);
        skipCount++;
      }
    } catch (e: unknown) {
      log(`${num} ❌ ${topic.query} → 錯誤: ${e instanceof Error ? e.message : String(e)}`);
      failCount++;
    }

    // 避免 rate limiting
    if (i < allTopics.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  log(`\n${"─".repeat(60)}`);
  log(`✅ 成功: ${successCount}  ⚠️ 無新聞: ${skipCount}  ❌ 失敗: ${failCount}`);
  process.exit(0);
}

main().catch(e => {
  log(`Fatal error: ${e}`);
  process.exit(1);
});
