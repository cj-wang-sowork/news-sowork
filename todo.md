# NewsFlow — Project TODO

## Sprint 1 (已完成)
- [x] 品牌命名：NewsFlow by SoWork
- [x] 首頁 Hero 搜尋框、打字動畫、全球熱度地圖
- [x] 熱門話題卡片（含媒體點陣圖、熱度指標）
- [x] 伊朗時間軸頁面（橘色軸線、轉折點、左右交錯卡片）
- [x] AI 立場回覆側邊面板（靜態模板）
- [x] 淺色系 Narrative Pulse 設計系統

## Sprint 2 — 後端 AI 整合 (已完成)
- [x] 升級全端架構（web-db-user）
- [x] 建置資料庫 Schema：topics、turning_points、news_articles 表
- [x] 執行 db:push 同步資料庫
- [x] 後端 RSS 抓取 API（支援多語言媒體來源）
- [x] AI 向量語意分群 API（使用 LLM embeddings）
- [x] 轉折點偵測 API（語意距離 + LLM 判定）
- [x] AI 立場回覆 API（接入真實 LLM）
- [x] 搜尋 API：使用者輸入主題 → 語意搜尋 → 回傳時間軸
- [x] 前端串接真實 API，替換模擬資料（含 loading skeleton）
- [x] 撰寫 vitest 測試（9 tests 全部通過）

## Sprint 3 — 待規劃
- [ ] 新聞爬蟲排程（每 15 分鐘自動執行）
- [ ] 訂閱追蹤功能（使用者訂閱主題，有轉折點時推播）
- [ ] 多語系 UI（英文 / 日文切換）
- [ ] 時間軸頁面串接真實 API（目前仍用 mockData）
- [ ] 搜尋結果頁（輸入主題後的過渡頁）

## Sprint 3 — RSS 抓取觸發 (已完成)
- [x] 建立管理員 RSS 抓取觸發頁面（/admin/ingest）
- [x] 後端加入 admin.triggerIngest 受保護 API
- [x] 執行第一次真實 RSS 抓取並確認資料入庫（87 篇）
- [x] 確認 5 個來源成功：自由時報、公視新聞、Al Jazeera、BBC 中文、NHK 日本語

## Sprint 4 — RSS 修正 + 搜尋結果抓取 (已完成)
- [x] 修正失效 RSS 來源：中央社改用 feedburner，Reuters/AP 改用 Google News RSS
- [x] VOA 中文 RSS 已對應修正（目前回傳 404，將從資料庫移除）
- [x] 重新觸發 RSS 抓取：新增 147 篇，累計共 381 篇真實新聞
- [x] Google News RSS 搜尋功能正常運作（Reuters、AP 頁面均有新聞入庫）

## Sprint 5 — 時間軸真實串接 (已完成)
- [x] 重寫 aiAnalysis.ts：完整 buildTopicTimeline 流程（關鍵字搜尋 → AI 偵測轉折點 → 分配文章）
- [x] 更新 routers.ts createOrFind：永遠執行完整 AI 分析流程
- [x] 完整重寫 Timeline.tsx：移除所有 mockData 依賴，串接真實 tRPC API
- [x] 加入 loading、error、空資料三種狀態的 UI
- [x] 11 個 vitest 測試全部通過

## Sprint 6 — Perplexity API 重構 (放棄：沙筆 TLS 限制無法連線)
- [x] 確認 Perplexity API Key 有效，但沙筆環境 TLS 封鎖無法連線 api.perplexity.ai
- [x] 死心：改用 Gemini 2.5 Flash + Google News RSS（方案 B）

## Sprint 6B — Gemini + Google News RSS 重構 (已完成)
- [x] 重構 aiAnalysis.ts：改用 Google News RSS 搜尋 + Gemini 分析轉折點
- [x] 移除 Perplexity 依賴，改用 invokeLLM (Gemini 2.5 Flash)
- [x] 端對端測試：輸入「伊朗」成功生成 5 個真實轉折點時間軸（約 20 秒）
- [x] 11 個 vitest 測試全部通過

## Sprint 7 — 首頁熱門話題真實資料 (已完成)
- [x] 後端：topics.hot API 從資料庫讀取真實話題與熱度數字
- [x] 後端：topics.hot 計算篇數、媒體數、最後更新時間
- [x] 前端：Home.tsx 熱門話題卡片串接真實 API，移除 mockData
- [x] 前端：空資料時顯示「尚無熱門話題，先搜尋一個主題吧！」
- [x] 後端：新增 topics.stats 公開 API，供首頁 Stats Bar 顯示真實話題數與新聞數
- [x] 前端：Stats Bar 改用 topics.stats 真實數字（話題數、新聞篇數）

## Sprint 8 — 新聞媒體平台轉型 (已完成)
- [x] Schema：topics 加入 creatorId、visibility（public/private）、viewCount 欄位
- [x] Schema：users 加入 points（點數餘額）欄位
- [x] Schema：新增 point_transactions 表（記錄點數異動歷史）
- [x] Schema：新增 topic_views 表（防止同一用戶重複賺點）
- [x] 執行 db:push 同步資料庫
- [x] 後端：topics.create API（登入用戶可建立議題，選擇 public/private）
- [x] 後端：topics.recordView API（瀏覽公開議題時，創建者賺點，24h 去重）
- [x] 後端：points.balance API（查詢點數餘額）
- [x] 後端：AI 功能扣點邏輯（generateStance 消耗點數）
- [x] 批次建立 50 個預設熱門議題（48 成功 / 2 失敗，共 52 個議題，1456 篇文章）
- [x] 前端：首頁顯示所有公開議題（含分類篩選、最多 50 個、顯示更多按鈕）
- [x] 前端：Navbar 顯示登入用戶點數餘額
- [x] 前端：「建立議題」按鈕與表單（登入後才能使用，支援 public/private）
- [x] 前端：首頁點數說明區塊（如何賺點、如何用點）
- [x] 前端：Timeline 頁面進入時自動記錄瀏覽（觸發創建者賺點）
