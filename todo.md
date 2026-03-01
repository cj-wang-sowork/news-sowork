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
