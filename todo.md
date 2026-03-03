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

## Sprint 9 — 用戶認證機制完整實作 (已完成)
- [x] Schema：新增 user_topics 表（用戶私有議題追蹤）
- [x] 執行 db:push 同步資料庫
- [x] 後端：myTopics.list API（登入用戶自建議題管理）
- [x] 前端：Navbar 更新（顯示用戶名稱，點擊可登出）
- [x] 前端：/my-topics 頁面（我的議題列表、新增/移除私有追蹤）
- [x] Navbar 加入「我的議題」導航連結（登入後顯示）

## Sprint 10 — 新聞媒體核心邏輯改善 (已完成)
- [x] 後端：topics.list 改為依 lastUpdated 降序排列（最新更新的議題排最前）
- [x] 後端：topics.hot 同樣改為依 lastUpdated 排序
- [x] 後端：getTopicTurningPoints 改為依 eventDate 降序（最新轉折點在最前）
- [x] 後端：buildTopicTimeline 完成後更新 topics.lastUpdated 時間戳
- [x] 後端：智慧合併 — storeTimeline 改為增量新增（不清除舊轉折點）
- [x] Schema：topics 加入 tags 欄位（text JSON，手動執行 SQL 新增）
- [x] 後端：buildTopicTimeline 自動從 AI 分析結果提取標籤
- [x] 後端：topics.list 支援 tags 篩選參數
- [x] 前端：議題卡片顯示標籤 chips（最多 3 個）
- [x] 前端：議題卡片顯示「最後更新」相對時間（如「3 小時前」）
- [x] 前端：Timeline 頁面轉折點改為從新到舊排列

## Sprint 11 — 標籤篩選、相對時間、每日排程 (已完成)
- [x] 前端：議題卡片 lastUpdated 改為相對時間（X 小時前、X 天前）
- [x] 前端：首頁加入標籤篩選 UI（從 API 動態取得所有標籤）
- [x] 前端：標籤篩選與分類篩選可同時使用
- [x] 後端：新增 topics.allTags API（回傳所有議題的標籤清單）
- [x] 後端：每日自動更新排程（每天凌晨 3 點觸發所有議題重新抓取）
- [x] 後端：admin.triggerDailyUpdate API（手動觸發更新供管理員使用）

## Sprint 12 — 修正時間軸顯示舊年份問題 (已完成)
- [x] 修正：Google News 搜尋加入 after:YYYY-MM-DD 時間限制（最近 7 天）
- [x] 修正：AI prompt 明確要求只分析最近 7 天的新聞，不要提取歷史背景
- [x] 修正：date_label 要求使用文章實際發布日期，不要用歷史事件日期
- [x] 修正：storeTimeline 加入 30 天過濾（避免儲存歷史背景）
- [x] 清除資料庫中所有舊轉折點，重置所有議題快取（下次訪問會重新分析）

## Sprint 13 — 標籤篩選、我的議題、認證整合、修正篇數 (已完成)
- [x] 修正：卡片篇數/媒體數與詳情頁不一致問題（getTimeline 同步計算真實數字）
- [x] 前端：議題卡片標籤 chip 點擊後套用標籤篩選
- [x] 前端：新增 /my-topics 頁面（登入用戶管理追蹤議題）
- [x] 前端：Navbar 加入「我的議題」入口連結（登入後顯示）
- [x] 後端：topics.savedTopics / saveTopic / unsaveTopic / pinTopic / isSaved API
- [x] 前端：Timeline 頁面加入「追蹤此議題」按鈕（登入後可用）
- [x] 認證整合：加入 Email/Password 登入（/auth/login）和註冊（/auth/register）頁面
- [x] 認證整合：Schema 加入 passwordHash 和 authMethod 欄位
- [x] 認證整合：後端 auth.register / auth.login procedures
- [ ] SoWork.ai 共用登入：確認 Manus OAuth 架構，實作跨平台帳號識別（待規劃）
- [ ] 點數共用：相同帳號在 SoWork.ai 生態系共用點數餘額（待規劃）
## Sprint 14 — AI 立場回覆升級（身份推薦 + 對話修改 + 複製/下載） (已完成)
- [x] 後端：ai.suggestRoles API（根據議題標題/摘要，AI 推薦 4-5 個合適身份）
- [x] 後端：ai.refineContent API（對話修改：用戶輸入修改指令，AI 根據現有內容調整）
- [x] 前端：AI 面板生成前 — 自動呼叫 suggestRoles，顯示 AI 推薦身份 chips（可點選）
- [x] 前端：AI 面板生成後 — 顯示生成內容 + 對話修改輸入框（多輪對話）
- [x] 前端：對話修改歷程顯示（每次修改指令記錄）
- [x] 前端：複製按鈕（一鍵複製全文到剪貼板，顯示「✓ 已複製」回饋）
- [x] 前端：下載按鈕（下載為 .txt 文件，檔名包含類型+身份+議題）
- [x] 前端：移除「複製貼上到其他地方」的障礙，讓用戶在面板內完成所有操作

## Sprint 15 — 身份記憶功能 (已完成)
- [x] 前端：localStorage 儲存最近使用的身份（最多 5 個，去重）
- [x] 前端：AI 面板顯示「最近使用」區塊（生成成功後記錄，下次開啟時顯示）
- [x] 前端：最近使用的身份 chips 可點選填入，可個別刪除（hover 顯示 × 按鈕）

## Sprint 16 — 生成內容分享連結 (已完成)
- [x] 前端：AI 面板加入「分享」按鈕（複製/下載旁）
- [x] 前端：分享連結包含 ai=1 + role + type 參數（URL query string）
- [x] 前端：Timeline 頁面讀取 URL 參數，資料載入後自動開啟 AI 面板並預填身份/類型
- [x] 前端：複製分享連結後顯示「🔗 已複製連結」回饋（2.5 秒自動消失）

## Sprint 17 — 議題建立流程升級（自動搜尋 + 歉義消解） (已完成)
- [x] 後端：強化 searchGoogleNews（多搜尋變體、擴大至 30 天、台灣/香港/英文 3 個 feed）
- [x] 後端：目標收集 50 篇新語（targetCount=50 參數）
- [x] 後端：topics.disambiguate API（AI 回傳 3-5 個可能議題方向）
- [x] 前端：CreateTopic.tsx 加入 3 步驟流程（輸入 → 確認方向 → 建立）
- [x] 前端：歉義消解步驟（顯示候選議題 chips，可點選或重新輸入）
- [x] 前端：確認步驟（顯示已選方向、可轉换方向、選擇可見性）
- [x] 前端：步驟進度指示器（Step 1/2/3 視覺回饋）

## Sprint 18 — 建立進度回饋 + 自動追蹤 (已完成)
- [x] 後端：topics.getProgress API（回傳議題的新語收集篇數、狀態）
- [x] 前端：Timeline 頁面頂部顯示「收集中」進度條（新語篇數 < 50 時顯示）
- [x] 前端：進度條每 10 秒自動 polling 更新
- [x] 後端：topics.create 加入 topicId 回傳値
- [x] 前端：CreateTopic 建立成功後自動呼叫 saveTopic，將議題加入「我的議題」

## Sprint 19 — AI 回覆面板修正 (已完成)
- [x] 修正：AI 生成日期應為今日（在 prompt 中注入 UTC+8 台灣時區的西元日期和民國日期）
- [x] 修正：生成內容使用 Streamdown 渲染 Markdown（粗體、列表等正確顯示）
- [x] 修正：對話修改區改為 textarea（rows=3，高度加大），支援 ⌘+Enter 發送

## Sprint 20 — AI 面板 UX 三項改進
- [x] 對話修改歷程可展開/收合（預設收合，顯示「X 次修改歷程」按鈕）
- [x] 生成結果版本切換（← → 箭頭在多版本間切換對比）
- [x] 手機端 bottom sheet（小螢幕改為從底部滑出的抽屉設計）

## Sprint 21 — 手機 Bottom Sheet 滑動關閉
- [x] 手機端 AI 面板加入 touch drag 手勢偵測（touchstart/touchmove/touchend）
- [x] 向下滑動超過閨値（100px）時自動關閉面板
- [x] 拖動時面板跟隨手指位移（translateY 動畫）
- [x] 放開後若未達閨値則彈回原位（spring 動畫）

## Sprint 22 — 議題訂閱推播通知
- [x] 後端：topics.subscribeNotification API（儲存用戶對議題的通知訂閱）
- [x] 後端：Schema 新增 topic_subscriptions 表
- [x] 後端：每日更新排程觸發時，檢查新轉折點並發送 notifyOwner 通知
- [x] 前端：Timeline 頁面「追蹤」按鈕旁加入「🔔 通知」 toggle
- [x] 前端：通知設定狀態顯示（已開啟/已關閉）

## Sprint 23 — 版本比對 Diff 視圖
- [ ] 前端：版本切換列加入「顯示差異」toggle 按鈕
- [ ] 前端：Diff 模式下，用綠色背景標示新增文字，紅色標示刪除文字
- [ ] 前端：實作 word-level diff 算法（LCS 或 diff-match-patch）
- [ ] 前端：Diff 視圖與正常視圖可切換

## Sprint 22 — 議題訂閱推播通知
- [ ] Schema：新增 topic_subscriptions 表（userId, topicId, notifyOnNewPoint）
- [ ] 後端：topics.subscribeNotification / unsubscribeNotification API
- [ ] 後端：每日更新排程觸發時，偵測新轉折點並發送 notifyOwner 通知
- [ ] 前端：Timeline 頁面「追蹤」按鈕旁加入「🔔 通知」toggle
- [ ] 前端：通知狀態顯示（已開啟/已關閉）

## Sprint 23 — 版本比對 Diff 視圖
- [x] 前端：版本切換列加入「顯示差異」 toggle 按鈕（只在 v2+ 出現）
- [x] 前端：實作 word-level diff（比對前一版本與當前版本）
- [x] 前端：新增文字用綠色背景標示，刪除文字用紅色刪除線標示
- [x] 前端：Diff 模式與正常模式可切換

## Sprint 24 — UI i18n 跟隨系統語言
- [x] 建立 i18n 翻譯字典（繁中/簡中/英文）
- [x] 偵測 navigator.language 自動設定初始語言
- [x] Navbar 加入語言切換選單（繁中/簡中/English）
- [x] 主要 UI 文字（Navbar、首頁、Timeline）套用翻譯

## Sprint 25 — Google OAuth 登入
- [x] 前端：安裝 Firebase SDK
- [x] 前端：建立 firebase.ts 設定檔（需 Firebase 環境變數）
- [x] 前端：LoginPage 移除 Manus OAuth，加入 Google 登入按鈕（Firebase signInWithPopup）
- [x] 前端：RegisterPage 移除 Manus OAuth，加入 Google 快速加入按鈕
- [x] 後端：auth.loginWithGoogle procedure（接收 Firebase ID token，建立 session）
- [x] Schema：users 加入 avatar 欄位，authMethod 加入 google 選項
- [x] 執行 db:push 同步資料庫
- [x] 設定 Firebase 環境變數（VITE_FIREBASE_* 已儲存，等待用戶填入 Firebase 專案設定）

## Sprint 26 — RSS 來源擴充 + QWEN 語言路由
- [x] 新增 147 個全球 RSS 來源（台灣、中國、美國、英國、歐洲、中東、日韓、東南亞、南亞、澳洲、非洲、拉丁美洲、科學、財經）
- [x] 偵測查詢語言（繁中/簡中/日文/韓文/英文）
- [x] 簡中查詢自動路由到 QWEN（通義千問）進行分析
- [x] QWEN API Key 已儲存並驗證通過

## Sprint 27 — RSS Seed 同步 + AI 查詢詞擴展
- [x] AdminIngest 頁面更新為 202 個來源說明
- [x] admin.triggerIngest 已包含 seedRssSources，點擊即同步
- [x] AI 查詢詞擴展：LLM 先把口語詞轉換為新聞關鍵字再搜尋（支援繁中/簡中/英文/日文/韓文）

## Sprint 28 — Stats Bar 即時更新 + RSS 來源數量
- [x] 確認 topics.stats API 即時讀取資料庫（topicCount、articleCount 均為即時 SQL COUNT）
- [x] 後端：topics.stats 新增 rssSourceCount 欄位（從 rss_sources 表計算）
- [x] 前端：Stats Bar 新增「RSS 新聞來源」欄位（即時從資料庫讀取，未同步前顯示 202）
- [x] 前端：Stats Bar 追蹤話題、已入庫新聞均為即時 API 資料

## Sprint 35 — 點數/付費功能改為「努力開發中」
- [x] 盤點所有需要點數或付費的功能（AI 立場回覆、加值、點數餘額等）
- [x] 前端：Navbar 點數餘額顯示移除（點數系統開發中）
- [x] 前端：首頁點數說明區塊改為「更多功能即將推出」
- [x] 前端：CreateTopic 點數資訊區塊改為免費建立說明
- [x] 前端：LoginPage / RegisterPage 移除點數相關文字
- [x] 後端：generateStance 移除點數扣除邏輯，對所有登入用戶免費開放
- [x] 後端：refineContent 移除點數扣除邏輯，對所有登入用戶免費開放
- [x] 後端：保留點數資料表（不刪除），只是暫停扣點機制

## Sprint 36 — AI 面板 Beta badge
- [x] 前端：AI 立場回覆面板生成按鈕旁加入「 Beta · 免費體驗」 badge
## Sprint 37 — 社群分享 OG meta tags 優化
- [x] 生成符合首頁文案的 OG 分享縮圖（1200x630）
- [x] 更新 index.html 的 Open Graph 和 Twitter Card meta tags

## Sprint 38 — 動態 OG tags + LINE 分享按鈕
- [x] 安裝 react-helmet-async
- [x] 議題頁動態 OG tags（標題、描述、縮圖）
- [x] 時間軸頁面加入 LINE 分享按鈕

## Sprint 39 — 議題去重
- [ ] 後端：建立議題相似度檢查邏輯，防止新建重複議題
- [ ] 清理資料庫中現有的重複議題

## Sprint 40 — 協作式議題整理（拖拉合併/分割 + 學習機制）
- [ ] schema：新增 topic_merge_signals 表（記錄用戶合併/分割行為）
- [ ] schema：新增 topic_merge_history 表（記錄實際合併操作）
- [ ] 後端：topics.mergeTopics procedure（合併兩個議題）
- [ ] 後端：topics.splitTopic procedure（從議題分割出新議題）
- [ ] 後端：topics.recordMergeSignal procedure（記錄用戶拖拉行為作為學習信號）
- [ ] 後端：topics.getMergeSignals procedure（查看學習信號統計）
- [ ] 前端：建立 /organize 頁面（拖拉議題卡片 UI，僅登入用戶可見）
- [ ] 前端：拖拉到另一卡片上方 → 顯示合併確認 dialog
- [ ] 前端：議題詳情頁加入「分割議題」按鈕（管理員/登入用戶）
- [ ] 前端：Navbar 加入「整理議題」入口（僅登入用戶可見）

## Sprint 43 — Perplexity 補充搜尋視覺化狀態指示器
- [x] 後端：topics 表加入 collectionStage 欄位（rss_searching / perplexity_searching / analyzing / ready）
- [x] 後端：aiAnalysis.ts 在各階段更新 collectionStage 欄位
- [x] 後端：getProgress API 回傳 collectionStage 欄位
- [x] 前端：Timeline 進度條改為分階段步驟指示器（RSS 搜尋 → Perplexity 補充 → AI 分析 → 完成）
- [x] 前端：修正現有文字錯字「新語」→「新聞」（視覺編輯器已完成）

## Sprint 44 — 品牌識別更新（SoWork.ai LOGO + 中文名稱「時事軸」）
- [x] 上傳 SoWork.ai 橘色閃電 favicon 和白色 LOGO 到 CDN
- [x] Navbar：更新 LOGO 為 SoWork.ai 橘色閃電圖示，產品名稱改為「時事軸」
- [x] Navbar：加入「by SoWork.ai」副標，連結回 tw.sowork.ai
- [x] 首頁 Footer：更新品牌名稱為「時事軸 by SoWork.ai」，加入 SoWork.ai 連結
- [x] 更新 favicon 為 SoWork.ai 橘色閃電圖示
- [x] 更新頁面 title 為「時事軸 by SoWork.ai — 看見新聞的演變脈絡」

## Sprint 45 — Bug 修復
- [x] 修復 Navbar：Link 內嵌 a 標籤（by SoWork.ai 連結）導致 React `<a> cannot contain a nested <a>` 錯誤
- [x] 修復 Timeline：「持續追蹤中...」結尾圓點置中問題，改為對齊左側時間軸

## Sprint 46 — 分享功能改為 Web Share API
- [x] 將 Timeline 的 LINE 分享按鈕改為手機原生分享（Web Share API），附上議題名稱和獨立網址
- [x] 桌機 fallback：改為「複製連結」按鈕

## Sprint 47 — 動態 OG 預覽圖生成
- [x] 安裝 sharp 套件（canvas native bindings 無法 build，改用 sharp + SVG）
- [x] 後端：建立 /api/og/:slug endpoint，動態生成含議題名稱的 OG 圖片（1200×630）
- [x] 前端：Timeline 頁面的 og:image 改為指向動態生成的圖片 URL
- [x] 頁面 title 更新為「議題名稱 — 時事軸 by SoWork.ai」

## Sprint 48 — OG 圖片快取機制
- [x] /api/og/:slug endpoint 加入記憶體快取（1 小時 TTL），避免重複生成（MISS: 1.5s → HIT: 0.002s）

## Sprint 49 — Navbar 品牌視覺層次調整
- [x] 「時事軸」字體加大到 19px、字重 900，「by SoWork.ai」縮小到 8.5px 並改為淡灰色（text-gray-400）

## Sprint 50 — 改善新聞蒐集數量 + 重點新聞來源標籤
- [x] 後端：RSS 搜尋加入計時，用速率（篇/秒 < 1）取代固定門檻觸發 Perplexity
- [x] 前端：將「收起報導」改為「重點新聞來源」

## Sprint 51 — 修復手機分享 + 增加 Perplexity 數量
- [x] 修復手機分享按鈕（將 LINE 連結改為 Web Share API 按鈕，手機觸發原生分享選單，桌機 fallback 複製連結）
- [x] 增加 Perplexity 每輪回傳文章數量（30-50 篇），加入第二輪英文搜尋，修復速率觸發邏輯

## Sprint 52 — 修復 Perplexity 補充文章無效問題
- [x] 診斷 Perplexity 補充後文章數付只有 12 篇的原因（totalArticles 用 AI 估計值而非實際數量）
- [x] 修復：totalArticles 改用 newsItems.length，Perplexity rawText 格式統一，重建完整 rawText
- [x] 調整：觸發條件改為速率 < 1 或文章數 < 20，更積極觸發 Perplexity

## Sprint 53 — tw.sowork.ai 引導連結 + LINE 介紹
- [x] 首頁 footer 前加入橙色 SoWork.ai CTA Banner（全寬、白色按鈕、文字說明）
- [x] Navbar 桌機版加入橙色圓角按鈕「了解 SoWork.ai ↗」，手機選單也加入連結
- [x] 撰寫 LINE 分享介紹文字
