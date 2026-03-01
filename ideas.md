# SoWork NewsFlow 設計構思

## 設計方向一：Editorial Precision（編輯精準主義）
<response>
<text>
**Design Movement**: Swiss International Typographic Style（瑞士國際排版主義）
**Core Principles**:
1. 網格至上：嚴格的欄位系統，每個元素都在格線上
2. 字體即設計：標題用超大無襯線字體，製造強烈視覺層次
3. 留白即呼吸：大量空白讓內容自己說話
4. 資訊密度精準：重要資訊大、次要資訊小，絕不平均分配

**Color Philosophy**: 幾乎全白底（#FAFAFA），主色用深墨色（#111111），唯一的強調色是品牌橘（#FF5A1F）。橘色只出現在轉折點標記與 CTA，讓它在視覺上有「警報感」。

**Layout Paradigm**: 不對稱的欄位佈局。首頁左側 40% 是超大標題與搜尋框，右側 60% 是熱門話題卡片瀑布流。時間軸頁面採用左側固定軸線、右側滾動內容的設計。

**Signature Elements**:
1. 橘色垂直細線作為時間軸主幹
2. 轉折點用實心橘色圓點 + 日期標籤
3. 新聞卡片左側有橘色粗邊框（border-left）作為視覺錨點

**Interaction Philosophy**: 懸停時卡片輕微上浮（translateY -4px），轉折點展開時有流暢的 accordion 動畫。

**Animation**: 頁面進入時元素由下往上淡入（stagger 0.1s），時間軸軸線從上往下繪製（draw animation）。

**Typography System**: 
- 標題：Playfair Display Bold（有文化感的現代 Serif）
- 副標題 / UI：Noto Sans TC（中文現代感）
- 數字 / 熱度：Tabular Nums，橘色強調
</text>
<probability>0.07</probability>
</response>

## 設計方向二：Intelligence Dashboard（情報儀表板）
<response>
<text>
**Design Movement**: Data Journalism + Intelligence Briefing（資料新聞 + 情報簡報風格）
**Core Principles**:
1. 資料視覺化優先：熱度用長條圖、媒體數用圓點陣列呈現
2. 密度感：像彭博終端機一樣，資訊密集但有序
3. 專業冷靜：配色克制，讓數據說話
4. 功能性美學：每個設計元素都有功能目的

**Color Philosophy**: 主背景 #F8F9FA（極淺灰），卡片白色，主色調為深靛藍（#1B3A6B），強調色為琥珀橘（#E8820C）。靛藍代表可信賴的資訊，橘色代表警示與熱度。

**Layout Paradigm**: 三欄式儀表板佈局。左側是話題導覽列（可折疊），中間是主時間軸，右側是 AI 立場回覆面板。

**Signature Elements**:
1. 熱度條（Heat Bar）：每個轉折點旁有橫向進度條顯示相對熱度
2. 媒體矩陣：用小圓點陣列顯示「幾家媒體在報導」
3. 語言標籤：每篇新聞卡片右上角顯示原始語言旗幟

**Interaction Philosophy**: 點擊轉折點後右側面板滑入，顯示相關新聞與 AI 回覆選項。

**Animation**: 數字計數動畫（熱度數字從 0 跳到實際值），卡片 hover 時顯示媒體來源詳情。

**Typography System**:
- 標題：IBM Plex Sans Bold（科技感 Sans-serif）
- 數據：IBM Plex Mono（等寬字體讓數字對齊）
- 中文：Noto Sans TC
</text>
<probability>0.08</probability>
</response>

## 設計方向三：Narrative Pulse（敘事脈動）← 選擇此方案
<response>
<text>
**Design Movement**: Contemporary Editorial + Motion Design（當代編輯設計 + 動態設計）
**Core Principles**:
1. 時間感：整個設計語言圍繞「時間流動」，軸線是視覺核心
2. 對比張力：大標題 vs 小細節，橘色 vs 白色，動態 vs 靜止
3. 層次深度：卡片有微妙的陰影層次，讓資訊有前後景之分
4. 全球感：設計語言中性，不偏向任何文化，適合多語系

**Color Philosophy**: 
- 背景：#FAFAFA（溫暖的極淺灰，不是冷白）
- 主色：深炭灰 #1C1C1E（Apple 風格的深色，比純黑更有質感）
- 品牌橘：#FF5A1F（SoWork 橘，用於時間軸、轉折點、熱度）
- 輔助色：淺橘 #FFF0EB（橘色的淡版，用於卡片 hover 背景）
- 邊框：#E8E8E8（極淡的灰，讓卡片有輪廓但不搶眼）

**Layout Paradigm**: 首頁採用「英雄搜尋 + 熱門卡片」的非對稱佈局。時間軸頁面採用「中央軸線 + 左右交錯卡片」的雜誌式排版，打破傳統的純左對齊。

**Signature Elements**:
1. 橘色垂直時間軸（帶有微光暈效果）
2. 轉折點：橘色脈動圓點（CSS animation pulse）+ 日期膠囊標籤
3. 新聞卡片：白色圓角卡片，hover 時左側出現橘色邊框

**Interaction Philosophy**: 搜尋框有打字動畫提示詞（「攻打伊朗」→「台積電赴美」→「AI 監管法案」循環）。AI 回覆面板以側邊滑出（slide-over）方式呈現，不打斷主時間軸的閱讀。

**Animation**: 
- 時間軸軸線：從頂部向下 draw（SVG stroke-dashoffset animation）
- 轉折點圓點：pulse 脈動動畫（代表「活躍事件」）
- 卡片進入：stagger fade-up（每張卡片延遲 80ms 進入）
- 熱度數字：countUp 動畫

**Typography System**:
- 大標題 / 品牌：Sora ExtraBold（現代幾何感，比 Inter 更有個性）
- 內文 / UI：Noto Sans TC（中文最佳閱讀體驗）
- 數字 / 熱度：Sora Tabular（等寬數字，整齊美觀）
- 英文輔助：Sora Regular
</text>
<probability>0.09</probability>
</response>

---

## 選定方案：Narrative Pulse

選擇方向三「Narrative Pulse」，因為它最能體現「新聞脈絡流動」的核心概念，且中央軸線的設計語言直接呼應產品功能，視覺上也最具辨識度。
