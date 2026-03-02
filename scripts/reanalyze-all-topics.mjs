/**
 * 全量重新抓取腳本
 * 1. 清除所有議題的舊假文章（source = 'news.google.com'）
 * 2. 對每個有轉折點的議題重新呼叫 buildTopicTimeline，抓取真實 RSS 文章
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// 使用 tsx/esm 執行 TypeScript
const { getDb } = await import('../server/db.ts');
const { buildTopicTimeline } = await import('../server/aiAnalysis.ts');
const { topics, newsArticles } = await import('../drizzle/schema.ts');
const { eq, sql, and, like } = await import('drizzle-orm');

const db = await getDb();
if (!db) {
  console.error('無法連接資料庫');
  process.exit(1);
}

// Step 1: 清除所有 source = 'news.google.com' 的假文章
console.log('Step 1: 清除假文章（source = news.google.com）...');
const deleteResult = await db
  .delete(newsArticles)
  .where(eq(newsArticles.source, 'news.google.com'));
console.log(`已清除假文章`);

// Step 2: 取得所有有轉折點的公開議題
const { turningPoints } = await import('../drizzle/schema.ts');
const { desc, inArray } = await import('drizzle-orm');

const topicsWithTPs = await db
  .selectDistinct({ topicId: turningPoints.topicId })
  .from(turningPoints);
const topicIds = topicsWithTPs.map(t => t.topicId);

if (topicIds.length === 0) {
  console.log('沒有找到有轉折點的議題');
  process.exit(0);
}

const topicList = await db
  .select({ id: topics.id, query: topics.query, totalArticles: topics.totalArticles })
  .from(topics)
  .where(
    and(
      eq(topics.isActive, 1),
      inArray(topics.id, topicIds)
    )
  )
  .orderBy(desc(topics.totalArticles));

console.log(`Step 2: 找到 ${topicList.length} 個有轉折點的議題，開始重新分析...`);
console.log('（每個議題約需 30-60 秒，共需約 ' + Math.ceil(topicList.length * 45 / 60) + ' 分鐘）\n');

let successCount = 0;
let failCount = 0;

for (let i = 0; i < topicList.length; i++) {
  const topic = topicList[i];
  const progress = `[${i + 1}/${topicList.length}]`;
  console.log(`${progress} 分析: "${topic.query}"...`);
  
  try {
    const result = await buildTopicTimeline(topic.query);
    if (result?.topic) {
      successCount++;
      console.log(`  ✓ 完成，轉折點: ${result.turningPointsList.length} 個`);
    } else {
      failCount++;
      console.log(`  ✗ 分析失敗（無轉折點）`);
    }
  } catch (e) {
    failCount++;
    console.log(`  ✗ 錯誤: ${String(e).slice(0, 100)}`);
  }
  
  // 避免 API rate limit
  if (i < topicList.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

console.log(`\n=== 完成 ===`);
console.log(`成功: ${successCount} 個`);
console.log(`失敗: ${failCount} 個`);
process.exit(0);
