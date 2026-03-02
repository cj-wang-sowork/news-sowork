/**
 * 批次建立 50 個平台預設熱門議題
 * 執行方式：node scripts/seed-topics.mjs
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";

// 50 個全球熱門議題（涵蓋政治、科技、氣候、財經、社會等分類）
const TOPICS = [
  // 地緣政治 & 國際衝突
  { query: "俄烏戰爭最新進展", category: "地緣政治" },
  { query: "以巴衝突加薩戰爭", category: "地緣政治" },
  { query: "台海緊張局勢", category: "地緣政治" },
  { query: "伊朗核武談判", category: "地緣政治" },
  { query: "北韓飛彈試射", category: "地緣政治" },
  { query: "美中貿易戰關稅", category: "地緣政治" },
  { query: "南海主權爭議", category: "地緣政治" },
  { query: "敘利亞內戰局勢", category: "地緣政治" },

  // 科技 & AI
  { query: "OpenAI GPT 人工智慧發展", category: "科技" },
  { query: "輝達 NVIDIA AI 晶片", category: "科技" },
  { query: "特斯拉自動駕駛", category: "科技" },
  { query: "蘋果 Apple Intelligence AI", category: "科技" },
  { query: "量子電腦突破", category: "科技" },
  { query: "馬斯克 SpaceX 星艦", category: "科技" },
  { query: "Meta 元宇宙 VR", category: "科技" },
  { query: "台積電先進製程", category: "科技" },

  // 氣候 & 環境
  { query: "全球暖化氣候變遷", category: "氣候" },
  { query: "COP 氣候峰會協議", category: "氣候" },
  { query: "極端天氣颱風洪水", category: "氣候" },
  { query: "再生能源太陽能風電", category: "氣候" },
  { query: "電動車普及化", category: "氣候" },

  // 財經 & 市場
  { query: "美國聯準會升降息", category: "財經" },
  { query: "比特幣加密貨幣", category: "財經" },
  { query: "美股那斯達克科技股", category: "財經" },
  { query: "日圓匯率日本央行", category: "財經" },
  { query: "中國房地產危機恆大", category: "財經" },
  { query: "黃金油價大宗商品", category: "財經" },
  { query: "台灣股市加權指數", category: "財經" },

  // 政治 & 選舉
  { query: "美國川普政策", category: "政治" },
  { query: "台灣政治選舉", category: "政治" },
  { query: "歐盟政治整合", category: "政治" },
  { query: "印度莫迪政府", category: "政治" },
  { query: "日本政治自民黨", category: "政治" },
  { query: "英國工黨執政", category: "政治" },

  // 社會 & 文化
  { query: "人口老化少子化", category: "社會" },
  { query: "移民難民危機", category: "社會" },
  { query: "韓國流行文化 K-pop", category: "社會" },
  { query: "ChatGPT AI 教育衝擊", category: "社會" },
  { query: "社群媒體假訊息", category: "社會" },
  { query: "精神健康心理健康議題", category: "社會" },

  // 健康 & 醫療
  { query: "新冠病毒 COVID 後遺症", category: "健康" },
  { query: "癌症新藥免疫療法", category: "健康" },
  { query: "禽流感 H5N1 疫情", category: "健康" },
  { query: "減肥藥 GLP-1 Ozempic", category: "健康" },

  // 太空 & 科學
  { query: "NASA 月球登陸計畫", category: "太空" },
  { query: "火星探測任務", category: "太空" },
  { query: "黑洞宇宙天文發現", category: "太空" },

  // 能源 & 基礎建設
  { query: "核能發電復興", category: "能源" },
  { query: "半導體供應鏈重組", category: "能源" },
  { query: "5G 6G 通訊網路", category: "能源" },
];

console.log(`📋 準備建立 ${TOPICS.length} 個議題...`);
console.log("─".repeat(60));

// 輸出 JSON 供外部使用
console.log(JSON.stringify(TOPICS, null, 2));
