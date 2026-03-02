/**
 * 全量重新抓取腳本：對所有有轉折點的議題重新呼叫 buildTopicTimeline
 * 執行方式: node --import tsx/esm scripts/reanalyze.ts
 */
import { getDb, updateTopicStats } from '../server/db';
import { buildTopicTimeline } from '../server/aiAnalysis';
import { topics, turningPoints } from '../drizzle/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.error('無法連接資料庫');
  process.exit(1);
}

// 取得所有有轉折點的公開議題
const topicsWithTPs = await db
  .selectDistinct({ topicId: turningPoints.topicId })
  .from(turningPoints);
const topicIds = topicsWithTPs.map(t => t.topicId);

if (topicIds.length === 0) {
  console.log('沒有找到有轉折點的議題');
  process.exit(0);
}

const topicList = await db
  .select({ id: topics.id, query: topics.query })
  .from(topics)
  .where(
    and(
      eq(topics.isActive, 1),
      inArray(topics.id, topicIds)
    )
  )
  .orderBy(desc(sql`${topics.totalArticles}`));

console.log(`找到 ${topicList.length} 個議題，開始重新分析...\n`);

let successCount = 0;
let failCount = 0;

for (let i = 0; i < topicList.length; i++) {
  const topic = topicList[i];
  const progress = `[${i + 1}/${topicList.length}]`;
  process.stdout.write(`${progress} "${topic.query}" ... `);

  try {
    const result = await buildTopicTimeline(topic.query);
    if (result?.topic) {
      await updateTopicStats(result.topic.id);
      successCount++;
      console.log(`✓ (${result.turningPointsList.length} 轉折點)`);
    } else {
      failCount++;
      console.log(`✗ 無轉折點`);
    }
  } catch (e) {
    failCount++;
    console.log(`✗ ${String(e).slice(0, 80)}`);
  }

  // 避免 rate limit，每個議題間隔 5 秒
  if (i < topicList.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

console.log(`\n=== 完成 ===`);
console.log(`成功: ${successCount}，失敗: ${failCount}`);
process.exit(0);
