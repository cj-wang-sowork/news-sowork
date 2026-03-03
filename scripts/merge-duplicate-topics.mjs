/**
 * 合併重複議題腳本
 * 將重複議題的轉折點和新聞文章移轉到保留議題，然後刪除重複議題
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 合併計畫：{ keepId: 保留的議題ID, deleteIds: 要刪除的議題ID陣列 }
const mergePlans = [
  // 美伊/以伊衝突群 → 保留 30003「以伊衝突升級」
  { keepId: 30003, keepName: '以伊衝突升級', deleteIds: [120005, 120006, 120008, 30052] },
  // AI監管群 → 保留 120002「AI監管進程」
  { keepId: 120002, keepName: 'AI監管進程', deleteIds: [120003] },
  // 比特幣群 → 保留 30024「比特幣市場波動」
  { keepId: 30024, keepName: '比特幣市場波動', deleteIds: [90002] },
  // 台股群 → 保留 30029「台股加權指數」
  { keepId: 30029, keepName: '台股加權指數', deleteIds: [60003] },
];

for (const plan of mergePlans) {
  console.log(`\n=== 合併到「${plan.keepName}」(ID: ${plan.keepId}) ===`);
  
  for (const deleteId of plan.deleteIds) {
    // 1. 查看要刪除的議題
    const [topicRows] = await conn.query('SELECT id, query FROM topics WHERE id = ?', [deleteId]);
    if (topicRows.length === 0) {
      console.log(`  議題 ${deleteId} 不存在，跳過`);
      continue;
    }
    const deleteTopic = topicRows[0];
    console.log(`  合併「${deleteTopic.query}」(ID: ${deleteId}) → 刪除`);

    // 2. 將轉折點移轉到保留議題
    const [tpResult] = await conn.query(
      'UPDATE turning_points SET topicId = ? WHERE topicId = ?',
      [plan.keepId, deleteId]
    );
    console.log(`    轉折點移轉: ${tpResult.affectedRows} 筆`);

    // 3. 將新聞文章移轉到保留議題
    const [naResult] = await conn.query(
      'UPDATE news_articles SET topicId = ? WHERE topicId = ?',
      [plan.keepId, deleteId]
    );
    console.log(`    新聞文章移轉: ${naResult.affectedRows} 筆`);

    // 4. 刪除 user_topics 中的收藏記錄（避免 FK 衝突）
    const [utResult] = await conn.query(
      'DELETE FROM user_topics WHERE topicId = ?',
      [deleteId]
    );
    console.log(`    用戶收藏刪除: ${utResult.affectedRows} 筆`);

    // 5. 刪除 topic_notifications 中的訂閱記錄
    const [tnResult] = await conn.query(
      'DELETE FROM topic_notifications WHERE topicId = ?',
      [deleteId]
    ).catch(() => [{ affectedRows: 0 }]);
    console.log(`    通知訂閱刪除: ${tnResult.affectedRows} 筆`);

    // 6. 刪除議題本身
    const [delResult] = await conn.query('DELETE FROM topics WHERE id = ?', [deleteId]);
    console.log(`    議題刪除: ${delResult.affectedRows} 筆`);
  }

  // 7. 更新保留議題的統計數字
  const [statsRows] = await conn.query(
    'SELECT COUNT(DISTINCT id) as tp_count FROM turning_points WHERE topicId = ?',
    [plan.keepId]
  );
  console.log(`  保留議題現有轉折點數: ${statsRows[0].tp_count}`);
}

console.log('\n✅ 合併完成！');
await conn.end();
