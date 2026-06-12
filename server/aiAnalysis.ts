/**
 * NewsFlow — AI Analysis Service (Google News RSS + Gemini LLM)
 * Flow: User query → Google News RSS search → Gemini format as timeline → Store in DB
 */

import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { topics, turningPoints, newsArticles, type InsertTurningPoint } from "../drizzle/schema";
import { and, eq, desc, gt, isNotNull, like, sql } from "drizzle-orm";
import { fetchMeltwaterForTopic, meltwaterArticlesToNewsItems } from "./meltwater";

// ─── LLM Supplemental Search (補充來源) ─────────────────────────────────────────

/**
 * 使用 Manus 內建 LLM 搜尋新聞，作為 Google News RSS 的補充來源
 * 讓 LLM 以 web_search 能力找出更多相關新聞文章
 * 回傳格式與 NewsItem 相同，方便合併
 */
async function searchWithLLM(query: string, angle: 'main' | 'analysis' | 'english' = 'main'): Promise<NewsItem[]> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
    const nowStr = now.toISOString().slice(0, 10);
    const anglePrompts: Record<string, string> = {
      main: `找出關於「${query}」的最新新聞報導（${cutoffStr} 至 ${nowStr} 之間的事件）。注意：當前日期是 ${nowStr}，請只回傳此時間範圍內的報導。`,
      analysis: `找出關於「${query}」的深度分析、評論和背景報導（${cutoffStr} 至 ${nowStr} 之間）。注意：當前日期是 ${nowStr}，請只回傳此時間範圍內的報導。`,
      english: `Find recent English news articles about: "${query}" from ${cutoffStr} to ${nowStr}. Today's date is ${nowStr}. Focus on events within this date range only.`,
    };
    const prompt = anglePrompts[angle] ?? anglePrompts.main;
    console.log(`[LLM-Search] Supplemental search (${angle}) for: "${query}"`);

    const resp = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a news research assistant with web search capabilities. When given a topic, find and list recent news articles. Return ONLY a valid JSON array, no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `${prompt}

Return a JSON array of news articles. Each object must have:
- title: article headline (string)
- url: direct URL to the article (must be a real, working URL from a known news site)
- source: news outlet name (string)
- publishedAt: publication date in ISO format (string)
- description: 1-2 sentence summary (string)

Return 20-40 articles from diverse sources. Only return the JSON array, nothing else.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_articles',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              articles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    url: { type: 'string' },
                    source: { type: 'string' },
                    publishedAt: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['title', 'url', 'source', 'publishedAt', 'description'],
                  additionalProperties: false,
                },
              },
            },
            required: ['articles'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = (resp as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '';
    if (!content) return [];

    // 嘗試解析 JSON
    let parsed: { articles?: Array<{ title?: string; url?: string; source?: string; publishedAt?: string; description?: string }> } | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // 嘗試從 markdown code block 提取
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\{[\s\S]*\})/);
      if (jsonMatch?.[1]) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
      }
    }

    const rawArticles = parsed?.articles ?? [];
    const rawItems: NewsItem[] = rawArticles
      .filter(item => item.title && item.url && item.url.startsWith('http'))
      .map(item => ({
        title: item.title ?? '',
        url: item.url ?? '',
        source: item.source ?? 'LLM Search',
        publishedAt: item.publishedAt ?? new Date().toISOString(),
        description: item.description ?? '',
      }));

    // Filter out junk / spam articles
    const notJunk = rawItems.filter(item => !isJunkArticle(item));
    const junkCount = rawItems.length - notJunk.length;
    if (junkCount > 0) {
      console.log(`[LLM-Search] Filtered out ${junkCount} junk articles (${angle})`);
    }

    // Filter out articles with dates older than 60 days (LLM hallucinated stale data)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const items = notJunk.filter(item => {
      try {
        return new Date(item.publishedAt) >= sixtyDaysAgo;
      } catch {
        return true; // keep if date unparseable
      }
    });
    const staleCount = notJunk.length - items.length;
    if (staleCount > 0) {
      console.log(`[LLM-Search] Filtered out ${staleCount} stale articles (>60 days) (${angle})`);
    }

    console.log(`[LLM-Search] Found ${items.length} supplemental articles (${angle})`);
    return items;
  } catch (err) {
    console.warn('[LLM-Search] Search failed:', (err as Error).message);
    return [];
  }
}

// ─── Spam / Junk Article Filter ─────────────────────────────────────────────

/**
 * 垃圾文章過濾：網域黑名單 + 標題關鍵字黑名單
 * 同時適用於 Google News RSS 收集和 LLM 補充搜尋
 */
const DOMAIN_BLOCKLIST = [
  // 遊戲廣告 / 博彩
  'youxia.com', 'youxia.org', '游侠网',
  'betway', 'casino', 'poker', 'slot',
  // 低質量政治宣傳
  'bannedbook.org', '禁闻网', 'epochtimes.com.tw', // 大紀元（偏激）
  // 低質量轉載 / 娛樂
  'creaders.net', '万维读者网',
  // 博彩相關
  'bodog', 'bet365', '188bet', 'w88',
];

const TITLE_BLOCKLIST_PATTERNS = [
  // 博彩廣告（中文）
  /娱乐.*骰宝/i,
  /竞猜.*赚/i,
  /模拟器.*试玩/i,
  /揭秘最优秀的App/i,
  /最优秀的.*App/i,
  /注册.*领.*彩金/i,
  /首存.*送/i,
  /体育.*博彩/i,
  // 廣告/推廣
  /\[廣告\]/i,
  /\[AD\]/i,
  /sponsored/i,
  // 彩券 / 開獎號碼（英文）
  /winning numbers?\s*(drawn|for|in|are)/i,
  /lottery\s*(results?|numbers?|draw|winner)/i,
  /lotto\s*(results?|numbers?|jackpot)/i,
  /\bcash\s*\d+\s*(winning|numbers?|results?)/i,
  /powerball|mega\s*millions|euromillions/i,
  /(pick|draw)\s*\d+\s*(winning|numbers?|results?)/i,
  // 運動成績 / 比賽結果流水帳
  /final\s*score[:\s]/i,
  /\bscore[:\s]+\d+[-–]\d+/i,
  /match\s*results?\s*:/i,
  /\w+\s+\d+[,\s]+\w+\s+\d+\s*$/i,   // "TeamA 3, TeamB 1" 型格式
  // 清單型低質標題（內容農場）
  /^top\s*\d+\s*(ways?|tips?|things?|reasons?|facts?)/i,
  /\d+\s*(ways?|tips?|things?|reasons?|facts?)\s*(to|you|that|about)/i,
  // 星座 / 運勢
  /\b(horoscope|zodiac|astrology)\b.*today/i,
  /(今日|每日|本週).*(星座|運勢|運程)/i,
  // 天氣/氣象例行播報（標題帶地點+日期格式）
  /weather\s*(forecast|update|report)\s*for\s*\w+,?\s*\w+\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
];

function isJunkArticle(item: { title: string; url: string; source?: string }): boolean {
  const urlLower = item.url.toLowerCase();
  const sourceLower = (item.source ?? '').toLowerCase();

  // 網域黑名單
  for (const blocked of DOMAIN_BLOCKLIST) {
    if (urlLower.includes(blocked.toLowerCase()) || sourceLower.includes(blocked.toLowerCase())) {
      return true;
    }
  }

  // 標題關鍵字黑名單
  for (const pattern of TITLE_BLOCKLIST_PATTERNS) {
    if (pattern.test(item.title)) {
      return true;
    }
  }

  // 標題過短（< 5 字）或過長（> 200 字）
  if (item.title.trim().length < 5 || item.title.trim().length > 200) {
    return true;
  }

  // URL 不合法（非 http/https）
  if (!item.url.startsWith('http')) {
    return true;
  }

  return false;
}

// ─── Google News RSS Search ───────────────────────────────────────────────────

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
}

/**
 * 偵測查詢語言：繁中、簡中、日文、韓文、英文
 */
export function detectQueryLanguage(query: string): 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'en' {
  // 日文（包含平假名或片假名）
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) return 'ja';
  // 韓文
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(query)) return 'ko';
  // 中文字符
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(query)) {
    // 簡中特徵字（簡體字常見字形）
    const simplifiedChars = ['国', '党', '军', '经济', '发展', '政府', '习近平', '中共', '人民', '联合'];
    if (simplifiedChars.some(c => query.includes(c))) return 'zh-CN';
    return 'zh-TW';
  }
  return 'en';
}

/**
 * 使用 QWEN 呼叫 LLM（用於簡中查詢，效果更好）
 */
async function invokeLLMWithQwen(params: Parameters<typeof invokeLLM>[0]): Promise<import('./_core/llm').InvokeResult> {
  if (!ENV.qwenApiKey) {
    console.warn('[QWEN] No API key, falling back to default LLM');
    return invokeLLM(params);
  }
  try {
    const resp = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.qwenApiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: params.messages,
        ...(params.response_format ? { response_format: params.response_format } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn('[QWEN] API error, falling back:', resp.status);
      return invokeLLM(params);
    }
    return resp.json() as ReturnType<typeof invokeLLM>;
  } catch (err) {
    console.warn('[QWEN] Request failed, falling back:', (err as Error).message);
    return invokeLLM(params);
  }
}

/**
 * 根據語言選擇最適合的 LLM
 */
function selectLLM(language: string): (params: Parameters<typeof invokeLLM>[0]) => Promise<import('./_core/llm').InvokeResult> {
  if (language === 'zh-CN') return invokeLLMWithQwen;
  return invokeLLM;
}

/**
 * 判斷議題是否為台灣在地議題（非全球性）
 * 台灣在地：飲食、內政、財經、社會、娛樂、地方新聞等
 * 全球：國際外交、戰爭、全球科技巨頭、國際經濟等
 */
function isLocalTaiwanTopic(query: string): boolean {
  // For a multinational website, default is GLOBAL (false).
  // Only treat as Taiwan-local when there are explicit Taiwan-domestic keywords
  // AND no global signals are present.
  const localTaiwanKeywords = [
    // 台灣地名 / 政府機關（純在地）
    '台北', '台中', '高雄', '台南', '新北', '桃園', '基隆', '新竹', '苗栗',
    '彰化', '南投', '雲林', '嘉義', '屏東', '宜蘭', '花蓮', '台東', '澎湖',
    '金門', '馬祖', '台灣縣', '台灣市',
    // 台灣政治人物 / 機構（在地）
    '賴清德', '蔡英文', '韓國瑜', '柯文哲', '侯友宜', '盧秀燕', '陳建仁',
    '行政院', '立法院', '監察院', '考試院', '司法院', '總統府',
    '民進黨', '國民黨', '民眾黨', '時代力量', '台灣基進',
    // 台灣媒體（在地）
    '中央社', '自由時報', '聯合報', '中時', '公視', '台視', '中視', '民視', 'TVBS',
  ];
  const globalKeywords = [
    // 國家 / 地區
    '伊朗', '以色列', '美國', '中國', '俄羅斯', '烏克蘭', '北韓', '日本', '韓國',
    '法國', '英國', '德國', '歐盟', '聯合國', '印度', '巴西', '沙烏地', '土耳其',
    '巴勒斯坦', '加薩', '加沙', '敘利亞', '伊拉克', '阿富汗', '葉門',
    // 政治人物
    '川普', '拜登', '習近平', '普丁', '普京', '金正恩', '馬克宏',
    'Trump', 'Biden', 'Xi', 'Putin', 'Kim', 'Macron',
    // 事件 / 議題關鍵字
    '以哈', '以巴', '哈馬斯', '俄烏', '衝突', '戰爭', '軍事', '外交', '制裁',
    '核武', '核彈', '峰會', '北約', 'NATO', '印太', '一帶一路',
    '全球', '國際', '跨國',
    // 複合詞（中文常見的跨國議題）
    '美中', '中美', '美俄', '中俄', '中歐', '中非', '美非', '南非', '東南亞',
    '氣候', '暖化', '碳排', '能源', '糧食', '通膨', '利率', '人工智慧', 'AI',
    '太空', '晶片', '半導體', '供應鏈', '貿易戰', '關稅', '人權',
    '難民', '移民', '疫情', '病毒', '疫苗', '選舉', '民主', '威權',
    // 機構 / 組織
    '白宮', '美聯儲', 'Fed', 'IMF', 'WTO', 'WHO', 'G7', 'G20',
    'OPEC', 'TSMC', 'UN',
    // 英文
    'Iran', 'Israel', 'Ukraine', 'Russia', 'China', 'USA', 'Hamas', 'Gaza',
    'Middle East', 'sanctions', 'ceasefire', 'diplomacy',
    // 英文國家 / 地區
    'UK', 'US ', 'EU ', 'EU,', 'European', 'Japan', 'Korea', 'India', 'Brazil',
    'Saudi', 'Germany', 'France', 'Italy', 'Canada', 'Australia', 'Mexico',
    'Indonesia', 'Turkey', 'Nigeria', 'South Africa', 'Egypt',
    // 英文金融 / 經濟
    'BoE', 'BoJ', 'ECB', 'FOMC',
    'GDP', 'CPI', 'inflation', 'recession', 'interest rate', 'yield', 'bond',
    'dollar', 'euro', 'yen', 'sterling', 'currency', 'forex', 'treasury',
    'stock', 'market', 'earnings', 'IPO', 'merger', 'acquisition',
    'tariff', 'trade', 'export', 'import', 'supply chain', 'commodity',
    'oil', 'gas', 'energy', 'gold', 'silver', 'copper', 'bitcoin', 'crypto',
    // 英文科技 / 企業
    'Nvidia', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Samsung',
    'OpenAI', 'semiconductor', 'chip', 'tech', 'startup',
    // 台灣對外關係（非純內政）
    '海峽', '對岸', '兩岸', '南海', '台海', '美台', '日台',
  ];
  const q = query.toLowerCase();
  const hasGlobal = globalKeywords.some(kw => q.includes(kw.toLowerCase()));
  if (hasGlobal) return false; // Explicitly global
  const hasLocal = localTaiwanKeywords.some(kw => q.includes(kw.toLowerCase()));
  if (hasLocal) return true;   // Explicitly Taiwan-local
  return false; // Default: global (multinational site)
}

/**
 * 根據文章來源網域推斷語言代碼
 */
// Source-name keywords for language detection (used when URL is opaque, e.g. Google News redirects)
const SOURCE_LANG_MAP: Array<[RegExp, string]> = [
  [/\b(reuters|ap news|guardian|financial times|bbc news|bbc world|nytimes|new york times|washington post|cnn|bloomberg|voa|voice of america|foreign policy|foreign affairs|politico|axios|cnbc|al jazeera|haaretz|middle east eye|daily maverick|straits times|south china morning post|nikkei asia|the hindu|abc australia|yonhap|channel news asia|euronews|france 24|deutsche welle|dw\.com|cbc canada)\b/i, 'en'],
  [/\b(nhk|毎日|読売|朝日|産経|日経|nikkei)\b/i, 'ja'],
  [/\b(yonhap|연합뉴스|중앙일보|조선일보|한겨레)\b/i, 'ko'],
  [/\b(spiegel|faz|süddeutsche|zeit|bild|stern)\b/i, 'de'],
  [/\b(le monde|figaro|libération|france24)\b/i, 'fr'],
  [/\b(folha|globo|jornal)\b/i, 'pt'],
  [/\b(al-arabiya|alarabiya|arab news|middle east monitor)\b/i, 'ar'],
  [/\b(xinhua|people.s daily|global times|cgtn|caixin)\b/i, 'zh-CN'],
];

export function detectArticleLanguage(source: string, url: string): string {
  const u = (url || '').toLowerCase();
  const s = (source || '').toLowerCase();

  // URL-based detection (fast path for direct article URLs)
  const enDomains = [
    'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
    'ft.com', 'economist.com', 'nytimes.com', 'washingtonpost.com', 'cnn.com',
    'bloomberg.com', 'foreignpolicy.com', 'foreignaffairs.com', 'voanews.com',
    'france24.com', 'dw.com', 'euronews.com', 'asia.nikkei.com', 'scmp.com',
    'straitstimes.com', 'thehindu.com', 'abc.net.au', 'yna.co.kr', 'en.yna.co.kr',
    'aljazeera.com', 'haaretz.com', 'middleeasteye.net', 'dailymaverick.co.za',
    'cbc.ca', 'politico.com', 'nhk.or.jp', 'axios.com', 'cnbc.com', 'channelnewsasia.com',
  ];
  if (enDomains.some(d => u.includes(d))) return 'en';
  if (u.match(/\.(?:co\.jp|or\.jp|ne\.jp|go\.jp)/)) return 'ja';
  if (u.match(/\.(?:co\.kr|or\.kr|go\.kr)/) && !u.includes('en.yna')) return 'ko';
  if (u.includes('spiegel.de') || u.includes('faz.net') || u.includes('sueddeutsche.de')) return 'de';
  if (u.includes('lemonde.fr') || u.includes('lefigaro.fr')) return 'fr';
  if (u.includes('.com.br') || (u.includes('.pt') && !u.includes('politico'))) return 'pt';
  if (u.includes('alarabiya') || s.includes('arabic') || u.includes('.arabic')) return 'ar';
  if (u.includes('.cn/') || u.includes('caixin.com') || u.includes('xinhua') || u.includes('sina.com')) return 'zh-CN';

  // Source-name fallback (for Google News opaque URLs)
  for (const [pattern, lang] of SOURCE_LANG_MAP) {
    if (pattern.test(s)) return lang;
  }

  return 'unknown'; // default: unknown (multinational site — do not assume zh-TW)
}

/**
 * 根據文章來源推斷國家代碼（sourceFlag）
 */
// Source-name → country-code map (used when URL is opaque)
const SOURCE_FLAG_MAP: Array<[RegExp, string]> = [
  [/\b(reuters|ap news|voice of america|voa|nytimes|new york times|washington post|cnn|bloomberg|foreign policy|foreign affairs|politico|axios|cnbc|business insider|wall street journal|wsj|time magazine|newsweek|npr)\b/i, 'US'],
  [/\b(bbc news|bbc world|bbc|guardian|financial times|economist|sky news|daily telegraph|daily mail|independent|channel 4|itv news|middle east eye)\b/i, 'GB'],
  [/\b(deutsche welle|dw\.com|spiegel|faz|stern|zeit|süddeutsche|bild)\b/i, 'DE'],
  [/\b(france 24|le monde|figaro|libération|rfi|tf1|bfm)\b/i, 'FR'],
  [/\b(euronews)\b/i, 'EU'],
  [/\b(nikkei asia|nikkei|nhk world|nhk|mainichi|yomiuri|asahi|kyodo|jiji)\b/i, 'JP'],
  [/\b(south china morning post|scmp|hk01|tvb|rthk|singtao|wenweipo|hkfp)\b/i, 'HK'],
  [/\b(straits times|channel news asia|cna|channelnewsasia|today online|mothership)\b/i, 'SG'],
  [/\b(yonhap|yna|korea herald|korea times|joongang|chosun|hankyoreh)\b/i, 'KR'],
  [/\b(the hindu|ndtv|times of india|hindustan times|indian express|the wire india)\b/i, 'IN'],
  [/\b(abc australia|abc news australia|sydney morning herald|smh|the age|afr)\b/i, 'AU'],
  [/\b(al jazeera|aljazeera)\b/i, 'QA'],
  [/\b(haaretz|jerusalem post|times of israel|ynetnews)\b/i, 'IL'],
  [/\b(daily maverick|mail & guardian|times live|sowetan|daily sun)\b/i, 'ZA'],
  [/\b(cbc|toronto star|globe and mail|national post)\b/i, 'CA'],
  [/\b(folha|globo|o globo|uol|veja|exame|valor econômico)\b/i, 'BR'],
  [/\b(中央社|cna|公視|pts|自由時報|ltn|聯合報|udn|中時|蘋果|台視|中視|民視|三立|東森|tvbs|setn)\b/i, 'TW'],
  [/\b(xinhua|人民日報|global times|cgtn|china daily|caixin|南方週末|新浪|sina|qq news|tencent|网易|netease|騰訊|鳳凰|ifeng|澎湃|thepaper|第一財經)\b/i, 'CN'],
  [/\b(ria novosti|tass|rt|sputnik|novaya gazeta)\b/i, 'RU'],
  [/\b(sin chew|nanyang|星洲|光明|东方日报|马来西亚)\b/i, 'MY'],
  [/\b(香港01|hk01|香港文匯|大公報|明報|星島|東方日報香港|南華早報)\b/i, 'HK'],
  [/\b(aastocks|港交所|香港交易|聯合早報|zaobao|lianhe|mediacorp)\b/i, 'SG'],
  [/\b(澳門廣播|tdt macau|澳門日報)\b/i, 'MO'],
];

export function detectSourceFlag(source: string, url: string): string | null {
  const u = (url || '').toLowerCase();
  const s = (source || '').toLowerCase();
  const domainCountry: Array<[string, string]> = [
    ['reuters.com', 'US'], ['apnews.com', 'US'], ['voanews.com', 'US'],
    ['nytimes.com', 'US'], ['washingtonpost.com', 'US'], ['cnn.com', 'US'],
    ['bloomberg.com', 'US'], ['foreignpolicy.com', 'US'], ['foreignaffairs.com', 'US'],
    ['politico.com', 'US'], ['axios.com', 'US'], ['cnbc.com', 'US'],
    ['bbc.com', 'GB'], ['bbc.co.uk', 'GB'], ['theguardian.com', 'GB'],
    ['ft.com', 'GB'], ['economist.com', 'GB'],
    ['dw.com', 'DE'], ['spiegel.de', 'DE'],
    ['france24.com', 'FR'], ['lemonde.fr', 'FR'],
    ['euronews.com', 'EU'],
    ['asia.nikkei.com', 'JP'], ['nhk.or.jp', 'JP'],
    ['scmp.com', 'HK'],
    ['straitstimes.com', 'SG'], ['channelnewsasia.com', 'SG'],
    ['thehindu.com', 'IN'],
    ['abc.net.au', 'AU'],
    ['yna.co.kr', 'KR'], ['en.yna.co.kr', 'KR'],
    ['aljazeera.com', 'QA'],
    ['haaretz.com', 'IL'],
    ['middleeasteye.net', 'GB'],
    ['dailymaverick.co.za', 'ZA'],
    ['cbc.ca', 'CA'], ['folha.uol.com.br', 'BR'],
    ['udn.com', 'TW'], ['ltn.com.tw', 'TW'], ['cna.com.tw', 'TW'],
    ['chinatimes.com', 'TW'], ['setn.com', 'TW'], ['tvbs.com.tw', 'TW'],
  ];
  for (const [domain, country] of domainCountry) {
    if (u.includes(domain)) return country;
  }
  if (u.match(/\.(?:co\.jp|or\.jp|ne\.jp)/)) return 'JP';
  if (u.match(/\.(?:co\.kr|or\.kr)/) && !u.includes('en.yna')) return 'KR';
  if (u.includes('.cn/') || u.includes('xinhua') || u.includes('caixin')) return 'CN';
  if (u.includes('.com.br')) return 'BR';

  // Source-name fallback (for Google News opaque URLs)
  for (const [pattern, flag] of SOURCE_FLAG_MAP) {
    if (pattern.test(s) || pattern.test(source)) return flag;
  }
  return null;
}

/**
 * Search Google News RSS for a given query.
 * Google News RSS: https://news.google.com/rss/search?q=QUERY&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
 * 台灣在地議題只搜台灣 feed，全球議題搜台灣+香港+英文
 */
export async function searchGoogleNews(query: string, targetCount = 150, forceGlobal = false, queryEn = ''): Promise<{
  items: NewsItem[];
  rawText: string;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const afterDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  const isLocal = forceGlobal ? false : isLocalTaiwanTopic(query);
  console.log(`[GoogleNews] Topic scope: ${isLocal ? '台灣在地' : '全球'} for query: "${query}"`);

  // 生成搜尋變體
  const queryVariants = new Set<string>();
  queryVariants.add(query);
  queryVariants.add(`${query} 新聞`);
  queryVariants.add(`${query} 最新`);
  queryVariants.add(`${query} 事件`);
  if (isLocal) {
    // 台灣在地：加強台灣地域限定
    if (!query.includes('台灣') && !query.includes('Taiwan')) {
      queryVariants.add(`${query} 台灣`);
      queryVariants.add(`${query} 台灣 新聞`);
    }
    queryVariants.add(`${query} 政策`);
    queryVariants.add(`${query} 報導`);
  } else {
    // 全球：加入英文搜尋變體（讓 Google News EN feeds 更容易命中）
    queryVariants.add(query.length <= 20 ? query : query.slice(0, 20));
    queryVariants.add(`${query} 分析`);
    queryVariants.add(`${query} latest`);
    queryVariants.add(`${query} news`);
  }

  const allItems: NewsItem[] = [];

  // ── 直接媒體 RSS：在地議題用台灣媒體，全球議題用國際媒體 ──
  const TAIWAN_MEDIA_RSS: Array<{ name: string; url: string; queryParam: string }> = [
    // 聯合新聞網 — 全站最新
    { name: '聯合新聞網', url: 'https://udn.com/rssfeed/news/2/0?ch=news', queryParam: '' },
    // 自由時報 — 即時新聞
    { name: '自由時報', url: 'https://news.ltn.com.tw/rss/all.xml', queryParam: '' },
    // 中時電子報 — 即時新聞
    { name: '中時電子報', url: 'https://www.chinatimes.com/rss/realtime.xml', queryParam: '' },
    // ETtoday 新聞雲
    { name: 'ETtoday', url: 'https://feeds.feedburner.com/ettoday/realtime', queryParam: '' },
    // 三立新聞網
    { name: '三立新聞', url: 'https://www.setn.com/rss.aspx', queryParam: '' },
    // TVBS 新聞
    { name: 'TVBS', url: 'https://news.tvbs.com.tw/rss/news', queryParam: '' },
    // 民視新聞
    { name: '民視', url: 'https://www.ftvnews.com.tw/rss/news', queryParam: '' },
    // 商業周刊
    { name: '商業周刊', url: 'https://www.businessweekly.com.tw/rss/all', queryParam: '' },
    // 天下雜誌
    { name: '天下雜誌', url: 'https://www.cw.com.tw/rss/news.xml', queryParam: '' },
    // 風傳媒
    { name: '風傳媒', url: 'https://www.storm.mg/rss/1', queryParam: '' },
    // 關鍵評論網
    { name: '關鍵評論網', url: 'https://www.thenewslens.com/rss', queryParam: '' },
    // 上報
    { name: '上報', url: 'https://www.upmedia.mg/rss.php', queryParam: '' },
    // 鏡週刊
    { name: '鏡週刊', url: 'https://www.mirrormedia.mg/rss/news.rss', queryParam: '' },
    // 蘋果新聞網
    { name: '蘋果新聞', url: 'https://tw.nextapple.com/rss/index.xml', queryParam: '' },
    // 中央社
    { name: '中央社', url: 'https://feeds.feedburner.com/cna-realtime', queryParam: '' },
  ];

  const queryKeywords = query.split(/\s+/).filter(k => k.length >= 2);

  // 選擇直接媒體 RSS：在地議題用台灣媒體；全球議題用國際英文媒體
  const INTL_MEDIA_RSS = [
    { name: 'BBC World',     url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'Reuters',       url: 'https://feeds.reuters.com/reuters/worldNews' },
    { name: 'The Guardian',  url: 'https://www.theguardian.com/world/rss' },
    { name: 'Al Jazeera',    url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'AP News',       url: 'https://apnews.com/apf-topnews' },
    { name: 'France 24',     url: 'https://www.france24.com/en/rss' },
    { name: 'Deutsche Welle',url: 'https://rss.dw.com/rdf/rss-en-world' },
    { name: 'NHK World',     url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/news.xml' },
    { name: 'SCMP',          url: 'https://www.scmp.com/rss/91/feed' },
    { name: 'Nikkei Asia',   url: 'https://asia.nikkei.com/' },
  ];
  const activeMediaRSS = isLocal ? TAIWAN_MEDIA_RSS : INTL_MEDIA_RSS;

  const mediaFetchPromises = activeMediaRSS.map(async (media) => {
    try {
      const resp = await fetch(media.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsFlowBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return [];
      const xml = await resp.text();
      const items = parseRssXml(xml);
      let relevant: typeof items;
      if (isLocal) {
        // 在地議題：用中文關鍵字過濾
        relevant = items.filter(item => {
          const text = `${item.title} ${item.description}`.toLowerCase();
          return queryKeywords.some(kw => text.includes(kw.toLowerCase()));
        });
      } else {
        // 全球議題：國際媒體 RSS 是英文標題，直接取前 4 篇最新世界新聞
        // LLM 分析階段會自動判斷相關性
        relevant = items.slice(0, 4);
      }
      if (relevant.length > 0) {
        console.log(`[MediaRSS] ${media.name}: ${relevant.length} articles`);
      }
      return relevant;
    } catch {
      return [];
    }
  });
  const mediaResults = await Promise.all(mediaFetchPromises);
  for (const items of mediaResults) {
    allItems.push(...items);
  }
  console.log(`[GoogleNews] Direct media RSS: ${allItems.length} articles before Google News search`);

  // 再用 Google News RSS 搜尋（補充更多文章）
  for (const q of Array.from(queryVariants)) {
    if (allItems.length >= targetCount * 3) break;
    const encodedQuery = encodeURIComponent(`${q} after:${afterDate}`);
    const enQ = queryEn ? encodeURIComponent(`${queryEn} after:${afterDate}`) : encodedQuery;

    // 台灣在地：搜台灣+香港；全球：英文 feeds 用 enQ（英文關鍵字），其他 feeds 用原始 query
    const feeds = isLocal
      ? [
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=HK&ceid=HK:zh-Hant`,
        ]
      : [
          // English feeds use enQ (English keyword from topic title)
          `https://news.google.com/rss/search?q=${enQ}&hl=en-US&gl=US&ceid=US:en`,
          `https://news.google.com/rss/search?q=${enQ}&hl=en-GB&gl=GB&ceid=GB:en`,
          `https://news.google.com/rss/search?q=${enQ}&hl=en-AU&gl=AU&ceid=AU:en`,
          `https://news.google.com/rss/search?q=${enQ}&hl=en-SG&gl=SG&ceid=SG:en`,
          `https://news.google.com/rss/search?q=${enQ}&hl=en-IN&gl=IN&ceid=IN:en`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=ja&gl=JP&ceid=JP:ja`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=fr&gl=FR&ceid=FR:fr`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=de&gl=DE&ceid=DE:de`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`,
        ];

    for (const feedUrl of feeds) {
      try {
        const resp = await fetch(feedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NewsFlowBot/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) continue;

        const xml = await resp.text();
        const items = parseRssXml(xml);
        allItems.push(...items);
      } catch (err) {
        console.warn(`[GoogleNews] Failed to fetch ${feedUrl}:`, (err as Error).message);
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Filter out junk / spam articles
  const cleaned = deduped.filter(item => !isJunkArticle(item));
  const junkCount = deduped.length - cleaned.length;
  if (junkCount > 0) {
    console.log(`[GoogleNews] Filtered out ${junkCount} junk articles`);
  }

  // Sort by date (newest first)
  cleaned.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const top = cleaned.slice(0, Math.max(targetCount, 100));

  // Build raw text summary for LLM (包含 URL 讓 AI 能引用真實連結)
  const rawText = top
    .map((item, i) => `[${i + 1}] ${item.publishedAt} — ${item.source} — URL: ${item.url}\n標題: ${item.title}\n摘要: ${item.description}`)
    .join("\n\n");

  console.log(`[GoogleNews] Found ${top.length} articles (target: ${targetCount}) for query: "${query}"`);
  return { items: top, rawText };
}

function parseRssXml(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Extract <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";

    const title = extractTag(block, "title") ?? "";
    const gnLink = extractTag(block, "link") ?? extractTag(block, "guid") ?? "";
    const pubDate = extractTag(block, "pubDate") ?? "";
    const description = extractTag(block, "description") ?? "";
    const source = extractTag(block, "source") ?? extractDomain(gnLink);

    // Extract source domain from <source url="..."> attribute
    const sourceUrlMatch = block.match(/<source[^>]+url="([^"]+)"/);
    const sourceBaseUrl = sourceUrlMatch?.[1]?.trim() ?? "";
    const sourceDomain = sourceBaseUrl ? new URL(sourceBaseUrl).hostname.replace('www.', '') : '';

    // Build the best possible URL for the article:
    // 1. If it's NOT a Google News redirect, use it directly (e.g. from Perplexity)
    // 2. If it IS a Google News RSS URL (news.google.com/rss/articles/...),
    //    convert to the web version (news.google.com/articles/...) by removing /rss/
    //    The web version opens correctly on mobile browsers and Google News app
    let finalUrl: string;
    const cleanTitle = cleanHtml(title);
    if (gnLink.includes('news.google.com/rss/articles/')) {
      // Convert RSS URL to web URL: remove /rss/ prefix
      finalUrl = gnLink.replace('news.google.com/rss/articles/', 'news.google.com/articles/');
    } else if (gnLink.includes('news.google.com')) {
      // Other Google News URLs: keep as-is
      finalUrl = gnLink.trim();
    } else {
      finalUrl = gnLink.trim();
    }

    if (!cleanTitle || !finalUrl) continue;

    items.push({
      title: cleanHtml(title),
      url: finalUrl,
      source: cleanHtml(source),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      description: cleanHtml(description).slice(0, 300),
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "si");
  const m = regex.exec(xml);
  return m ? (m[1] ?? "").trim() : null;
}

function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

// ─── Format News into Timeline using Gemini ───────────────────────────────────
interface TurningPointData {
  title: string;
  title_en: string;
  summary: string;
  date_label: string;
  heat_level: "extreme" | "high" | "medium" | "low";
  keywords: string[];
  article_count: number;
  media_count: number;
  source_urls: string[];
}

interface TimelineAnalysisResult {
  turning_points: TurningPointData[];
  tags: string[]; // 議題標籤，如 ["AI","科技","台灣"]
  topic_title: string; // 議題簡潔標題
}

// ─── Bad Content Guard ────────────────────────────────────────────────────────
// Detects LLM-generated template metadata strings masquerading as summaries.
function isBadContent(text: string): boolean {
  return (
    (text.includes('近') && text.includes('小時')) ||
    (text.includes('累積') && text.includes('報導')) ||
    text.includes('代表來源包括') ||
    text.includes('在此階段共累積') ||
    text.includes('焦點集中於「')
  );
}

// Re-generates a single turning point's title + summary via LLM when bad content is detected.
async function repairBadTurningPoint(
  topicQuery: string,
  tpTitle: string,
  articleTitles: string[],
  isGlobal: boolean,
): Promise<{ title: string; summary: string } | null> {
  const articles = articleTitles.slice(0, 6).map((t, i) => `${i + 1}. ${t.replace(/"/g, "'").slice(0, 120)}`).join('\n') || '(no context)';
  const prompt = isGlobal
    ? `Topic: "${topicQuery}"\nEvent: "${tpTitle.replace(/"/g, "'").slice(0, 150)}"\nArticles:\n${articles}\n\nReturn ONLY valid JSON with two string fields:\n{"title":"4-10 word English headline","summary":"2-3 sentences explaining what happened and why it matters"}`
    : `議題：「${topicQuery}」\n事件：「${tpTitle.slice(0, 150)}」\n相關文章：\n${articles}\n\n只回傳合法 JSON，包含兩個字串欄位：\n{"title":"6-10字繁體中文標題","summary":"2-3句客觀分析說明發生了什麼及其意義"}`;

  try {
    const resp = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      model: 'gemini-2.5-flash',
      responseFormat: { type: 'json_object' },
    });
    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    const s = typeof raw === 'string' ? raw : (raw as Array<{ text?: string }>).map(p => p.text ?? '').join('');
    const match = s.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.title === 'string' && typeof parsed.summary === 'string'
      && parsed.title.length > 3 && parsed.summary.length > 15) {
      return { title: parsed.title.trim(), summary: parsed.summary.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Surface-specific analyst personas ───────────────────────────────────────

function getSurfaceSystemPrompt(surface: string, query: string, today: string): string {
  const base = `Today's date is ${today}.

UNIVERSAL RULES (apply to ALL surfaces):
1. ONLY include turning points DIRECTLY related to the topic query — reject articles that merely mention related entities.
2. ONLY use events described in the provided articles. Do NOT invent or add historical background.
3. Each turning point must represent a meaningful development that CHANGED the trajectory of this story.
4. date_label MUST be the actual publish date from the article, NOT a historical event date.
5. ONLY include events from the last 60 days relative to today. Reject older events.
6. Output structured JSON only.
7. TITLE RULES — 每個轉折點的 title 必須是 6-12 個中文字的事件摘要，嚴禁包含媒體來源名稱、問號、驚嘆號、「- 媒體名」、「【有片】」、「快訊」等格式。
8. RELEVANCE TEST — 每個轉折點都要問：「這個事件是否直接推進或改變了查詢主題的發展？」若否，跳過。
9. NO COPY-PASTE — summary 不得直接複製文章標題，不得含媒體名稱。`;

  if (surface === 'invest') {
    return `You are a senior macro strategist and portfolio manager at a top-tier asset management firm (think Bridgewater, BlackRock). Your job is to identify MARKET-MOVING turning points from the provided articles on: "${query}".

${base}

INVEST SURFACE — ADDITIONAL RULES:
- Each turning point summary MUST answer: (1) what happened specifically, (2) which assets/sectors/markets are directly affected and HOW (price impact, flow direction, repricing of risk), (3) what this signals about the broader macro or sector regime, (4) what the key uncertainty or tail risk is going forward.
- Use market-specific language: yield spreads, earnings revisions, capital flows, positioning, valuation multiples, policy expectations.
- Summaries should read like Bloomberg Intelligence briefs: data-specific, forward-looking, and institutionally actionable.
- heat_level guide: "extreme" = central bank surprise / earnings shock / geopolitical market disruption; "high" = major policy shift / sector rotation catalyst; "medium" = data print / corporate event; "low" = background macro color.
- STRICTLY EXCLUDE: political commentary without clear market implication, social/cultural events, sports, entertainment.`;
  }

  if (surface === 'brand') {
    return `You are a Chief Strategy Officer advising a room of CMOs and CEOs. Your job is to identify BUSINESS-CRITICAL turning points from the provided articles on: "${query}".

${base}

BRAND SURFACE — ADDITIONAL RULES:
- Each turning point summary MUST answer: (1) what happened and how it shifts the business environment, (2) which industries, consumer segments, or brand positions are most exposed, (3) what strategic response or brand action this demands (pricing, messaging, supply, partnerships), (4) the reputational or commercial risk if leadership ignores this signal.
- Write as strategic briefing material, NOT as news summaries. A good summary sounds like McKinsey meeting prep, not a news ticker.
- heat_level guide: "extreme" = industry-wide disruption / regulatory prohibition / viral brand crisis; "high" = significant consumer behavioral shift / major competitor move; "medium" = regulatory development / supply chain shift; "low" = emerging trend / early signal.
- STRICTLY EXCLUDE: political events without direct regulatory or consumer impact, military news without supply chain consequence, entertainment and sports.`;
  }

  if (surface === 'politics') {
    return `You are a senior political analyst and electoral strategist. Your job is to identify POWER-SHIFTING turning points from the provided articles on: "${query}".

${base}

POLITICS SURFACE — ADDITIONAL RULES:
- Each turning point summary MUST answer: (1) what happened and which actor gained or lost leverage, (2) the coalition dynamics — who benefits, who is threatened, (3) the policy or legislative implication if this momentum holds, (4) the counterforce or spoiler that could reverse it.
- Write with the analytical depth of The Economist's "Briefing" section: structural, not episodic.
- heat_level guide: "extreme" = election outcome / constitutional crisis / military escalation; "high" = major policy reversal / scandal with electoral impact; "medium" = polling shift / legislative development; "low" = campaign statement / minor political maneuver.`;
  }

  // Default: global surface — Economist editorial standard
  return `You are a senior news analyst at a publication with The Economist's editorial standards, specializing in geopolitics, international economics, and current affairs. Your job is to identify the KEY STRUCTURAL TURNING POINTS of this story: "${query}".

${base}

GLOBAL SURFACE — ADDITIONAL RULES:
- Each turning point summary MUST answer: (1) what happened specifically, (2) why this represents a structural shift (not just an event), (3) what the broader geopolitical or social implication is, (4) what remains contested or uncertain.
- Write with The Economist's discipline: no clichés, no passive "observers say," no hyperbole. Every sentence must carry analytical weight.
- A good summary passes the "so what?" test: a reader who already knows the headline learns something new from the analysis.
- heat_level guide: "extreme" = global crisis / major power conflict; "high" = significant geopolitical shift / G7-level consequence; "medium" = regional development / institutional change; "low" = diplomatic signal / policy adjustment.`;
}

async function formatTimelineFromNews(
  query: string,
  newsText: string,
  newsItems: NewsItem[],
  language = 'zh-TW',
  surface = 'global'
): Promise<TimelineAnalysisResult> {
  const sourceUrls = newsItems.slice(0, 15).map((item) => item.url);
  const llm = selectLLM(language);
  const today = new Date().toISOString().slice(0, 10);

  const response = await llm({
    messages: [
      {
        role: "system",
        content: getSurfaceSystemPrompt(surface, query, today),
      },
      {
        role: "user",
        content: `Topic: "${query}"

Recent News Articles:
${newsText}

Based STRICTLY on articles that are DIRECTLY about this topic ("${query}"):
1. Extract 3 to 6 major turning points from this story. Order them from oldest to newest.
2. Generate 3-6 topic tags in Traditional Chinese (e.g. "外交", "軍事", "峰會", "協議", "制裁")
3. Generate a concise topic title in Traditional Chinese (10 characters or less) that captures the CORE of this story

TITLE CLEANUP: Strip any trailing "- MediaName", "—MediaName", section labels, and clickbait prefixes. Title must be a clean standalone event description.

For each turning point:
- title: 6-12 個中文字的事件摘要（繁體中文），禁止包含媒體名稱或標題黨格式
- title_en: concise English headline (4-10 words)
- summary: 3-5 句話的深度分析（繁體中文）— 必須通過「So What?」測試：讀者已知標題後，你的分析要帶給他新的洞察。不得複製文章標題，不得含媒體名稱。
- date_label: the publish date of the main article (e.g., "2026年5月18日")
- heat_level: "extreme" / "high" / "medium" / "low" (see surface-specific guide above)
- keywords: 3-5 specific Chinese keywords directly related to this turning point
- article_count: number of provided articles directly relevant to this turning point
- media_count: number of different media sources covering this turning point
- source_urls: up to 3 URLs from provided articles that BEST support this turning point`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "timeline_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topic_title: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            turning_points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  title_en: { type: "string" },
                  summary: { type: "string" },
                  date_label: { type: "string" },
                  heat_level: { type: "string", enum: ["extreme", "high", "medium", "low"] },
                  keywords: { type: "array", items: { type: "string" } },
                  article_count: { type: "number" },
                  media_count: { type: "number" },
                  source_urls: { type: "array", items: { type: "string" } },
                },
                required: [
                  "title", "title_en", "summary", "date_label",
                  "heat_level", "keywords",
                  "article_count", "media_count", "source_urls"
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["topic_title", "tags", "turning_points"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = (typeof content === "string" ? JSON.parse(content) : content) as TimelineAnalysisResult;
  return parsed ?? { turning_points: [], tags: [], topic_title: query };
}

// ─── Parse date from date_label string ──────────────────────────────────────────────────────────────
function parseDateFromLabel(dateLabel: string): Date {
  // 嘗試解析常見格式："2025年6月13日"、"2026年2月底"、"2024年底"
  const yearMonthDay = dateLabel.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (yearMonthDay) {
    return new Date(Number(yearMonthDay[1]), Number(yearMonthDay[2]) - 1, Number(yearMonthDay[3]));
  }
  const yearMonth = dateLabel.match(/(\d{4})年(\d{1,2})月/);
  if (yearMonth) {
    return new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 15);
  }
  const yearOnly = dateLabel.match(/(\d{4})年/);
  if (yearOnly) {
    return new Date(Number(yearOnly[1]), 6, 1);
  }
  return new Date();
}

// ─── Relevance guard ─────────────────────────────────────────────────────────
const RELEVANCE_STOPWORDS = new Set([
  'that','this','with','from','have','been','will','when','what','into','over',
  'than','then','they','their','about','after','which','where','while','other',
  'global','world','news','international','report','says','amid','between',
  'new','also','amid','amid','could','would','should','more','most','than',
]);

function isArticleRelevant(articleTitle: string, topicQuery: string): boolean {
  if (!articleTitle || !topicQuery) return true;
  const tokenize = (s: string) =>
    s.toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !RELEVANCE_STOPWORDS.has(w));
  const titleTokens = new Set(tokenize(articleTitle));
  const queryTokens = tokenize(topicQuery);
  if (queryTokens.length === 0) return true;
  // At least 1 meaningful non-stopword keyword from the topic must appear in the article title
  return queryTokens.some(w => titleTokens.has(w));
}

// ─── Store Timeline in Database (增量新增，不清除舊轉折點) ─────────────────────
function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set([...a].filter(c => c.trim()));
  const setB = new Set([...b].filter(c => c.trim()));
  let overlap = 0;
  for (const c of setA) if (setB.has(c)) overlap++;
  return overlap / Math.max(setA.size, setB.size, 1);
}

async function storeTimeline(
  topicId: number,
  turningPointsData: TurningPointData[],
  newsItems: NewsItem[] = [],
  topicQuery = "",
  languageFilter?: 'en'
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // ── Step 0: Cleanup stale turning points (>90 days, 0 linked articles; keep max 20 per topic) ──
  {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const staleTPCandidates = await db
      .select({ id: turningPoints.id })
      .from(turningPoints)
      .where(
        and(
          eq(turningPoints.topicId, topicId),
          sql`${turningPoints.eventDate} < ${ninetyDaysAgo.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')}`
        )
      );
    for (const { id: tpId } of staleTPCandidates) {
      const [cnt] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(newsArticles)
        .where(eq(newsArticles.turningPointId, tpId));
      if (Number(cnt?.count ?? 0) === 0) {
        await db.delete(turningPoints).where(eq(turningPoints.id, tpId));
        console.log(`[storeTimeline] Deleted stale 0-article TP id=${tpId} (topic ${topicId})`);
      }
    }
    // Keep at most 20 most recent TPs per topic
    const allTPsForTopic = await db
      .select({ id: turningPoints.id })
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topicId))
      .orderBy(desc(turningPoints.eventDate));
    if (allTPsForTopic.length > 20) {
      const excessIds = allTPsForTopic.slice(20).map(tp => tp.id);
      for (const tpId of excessIds) {
        await db.delete(turningPoints).where(eq(turningPoints.id, tpId));
      }
      console.log(`[storeTimeline] Pruned ${excessIds.length} oldest TPs for topic ${topicId} (kept max 20)`);
    }
  }

  // ── Step A: 先將所有 newsItems 存入 newsArticles 表（不帶 turningPointId）──
  // 這樣所有文章都會被儲存，後續再用 source_urls 對映到轉折點
  const urlToArticleId = new Map<string, number>(); // url -> newsArticle.id

  let skippedIrrelevant = 0;
  for (const item of newsItems) {
    if (!item.url) continue;
    if (urlToArticleId.has(item.url)) continue; // 本批次內去重
    const itemSource = item.source || extractDomain(item.url);
    // Language filter: skip non-English articles when surface requires English-only
    if (languageFilter === 'en') {
      const artLang = detectArticleLanguage(itemSource, item.url);
      // Hard-skip known non-English languages
      if (['zh-CN', 'ja', 'ko', 'de', 'fr', 'pt', 'ar'].includes(artLang)) {
        skippedIrrelevant++; continue;
      }
      // 'unknown' or 'zh-TW' — use title Latin-character ratio as tiebreaker: >55% Latin → English.
      if (artLang === 'zh-TW' || artLang === 'unknown') {
        const title = item.title ?? '';
        const latinCount = (title.match(/[A-Za-z]/g) ?? []).length;
        const totalNonSpace = title.replace(/\s/g, '').length;
        const looksEnglish = totalNonSpace > 0 && latinCount / totalNonSpace > 0.55;
        if (!looksEnglish) { skippedIrrelevant++; continue; }
      }
    }
    // Relevance guard: skip articles whose title shares no significant keyword with the topic
    if (topicQuery && !isArticleRelevant(item.title, topicQuery)) {
      skippedIrrelevant++;
      continue;
    }
    try {
      await db.insert(newsArticles).values({
        title: item.title,
        url: item.url,
        source: itemSource,
        publishedAt: new Date(item.publishedAt),
        topicId,
        language: detectArticleLanguage(itemSource, item.url),
        sourceFlag: detectSourceFlag(itemSource, item.url),
      });
    } catch {
      // duplicate URL already in DB — fall through to SELECT below
    }
    // 無論 INSERT 成功或失敗，都 SELECT 取 ID（UNIQUE 約束生效後必須補這步）
    const [row] = await db.select({ id: newsArticles.id })
      .from(newsArticles).where(eq(newsArticles.url, item.url)).limit(1);
    if (row) urlToArticleId.set(item.url, row.id);
  }
  if (skippedIrrelevant > 0) console.log(`[storeTimeline] Skipped ${skippedIrrelevant} irrelevant articles for topic ${topicId}`);
  console.log(`[storeTimeline] Stored/mapped ${urlToArticleId.size} articles for topic ${topicId}`);

  // ── Step B: 儲存轉折點，並用 source_urls 對映到實際 newsArticle ──
  // 取得現有轉折點（含 id），用於去重與 replace-mode 重新激活
  const existingTPs = await db
    .select({ id: turningPoints.id, title: turningPoints.title, dateLabel: turningPoints.dateLabel })
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topicId));
  // Maps: title/dateLabel → TP id（用於 replace mode 重新激活既有 TP，而非插入重複列）
  const existingByTitle = new Map(existingTPs.map(tp => [tp.title, tp.id]));
  const existingByDate  = new Map(existingTPs.map(tp => [tp.dateLabel, tp.id]));

  // 過濾掉日期超過 60 天的轉折點（避免儲存歷史背景）
  const sixtyDaysAgoFilter = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const recentData = turningPointsData.filter(point => {
    const eventDate = parseDateFromLabel(point.date_label);
    return eventDate >= sixtyDaysAgoFilter && eventDate <= threeDaysFromNow;
  });
  if (recentData.length < turningPointsData.length) {
    console.log(`[Timeline] Filtered out ${turningPointsData.length - recentData.length} old/future turning points (>60 days or >3 days future)`);
  }
  // 如果過濾後沒有資料且 DB 已有轉折點，跳過（保留現有資料，不添加舊歷史事件）
  // 只在 DB 完全沒有轉折點時才放寬至 6 個月（首次建立議題）
  const hasExistingTPs = existingTPs.length > 0;
  const fallbackData = hasExistingTPs ? [] : turningPointsData.filter(point => {
    const d = parseDateFromLabel(point.date_label);
    return d >= sixMonthsAgo && d <= threeDaysFromNow;
  });
  const dataToStore = recentData.length > 0 ? recentData : fallbackData;
  if (dataToStore.length === 0 && hasExistingTPs) {
    console.log(`[Timeline] No recent turning points to add (topic already has ${existingTPs.length} existing TPs), skipping.`);
  }

  // ── Replace mode: 若本次有新資料，先將所有現有 TP 設為 inactive，再逐一重新激活或插入 ──
  // 若本次沒有任何資料，跳過 deactivation（避免 topic 變成空白）
  if (dataToStore.length > 0) {
    await db.update(turningPoints).set({ isActive: 0 }).where(eq(turningPoints.topicId, topicId));
    console.log(`[storeTimeline] Replace mode: deactivated ${existingTPs.length} existing TPs for topic ${topicId}`);
  }

  // 取得目前最大 sortOrder
  const [maxOrderRow] = await db
    .select({ maxOrder: sql<number>`MAX(${turningPoints.sortOrder})` })
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topicId));
  let nextSortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  for (const point of dataToStore) {
    // ── 日期驗證：拒絕超過 60 天或超過未來 3 天的轉折點（防止 LLM 幻覺日期） ──
    const pointDate = parseDateFromLabel(point.date_label);
    if (pointDate < sixtyDaysAgoFilter || pointDate > threeDaysFromNow) {
      console.warn(`[storeTimeline] Rejected TP "${point.title.slice(0, 40)}" — invalid date ${point.date_label}`);
      continue;
    }

    // ── 去重：完整標題 / 日期標籤完全相同，或字符相似度 > 55% → 重新激活既有 TP ──
    const dupById = existingByTitle.get(point.title) ?? existingByDate.get(point.date_label);
    if (dupById !== undefined) {
      await db.update(turningPoints).set({ isActive: 1 }).where(eq(turningPoints.id, dupById));
      console.log(`[Timeline] Reactivated existing TP id=${dupById}: "${point.title}"`);
      continue;
    }
    const fuzzyKey = [...existingByTitle.keys()].find(t => titleSimilarity(t, point.title) > 0.55);
    if (fuzzyKey) {
      const fuzzyId = existingByTitle.get(fuzzyKey)!;
      await db.update(turningPoints).set({ isActive: 1 }).where(eq(turningPoints.id, fuzzyId));
      console.log(`[Timeline] Reactivated fuzzy-matched TP id=${fuzzyId}: "${point.title}" ≈ "${fuzzyKey}"`);
      continue;
    }

    // ── 新轉折點必須有 source_urls（純幻覺 TP 無法溯源，直接略過）──
    if (!point.source_urls || point.source_urls.length === 0) {
      console.warn(`[storeTimeline] Skipping TP "${point.title.slice(0, 40)}" — no source_urls (unverifiable)`);
      continue;
    }

    // pointDate 已在上方驗證時解析，直接重用
    const eventDate = pointDate;

    // ── Bad-content guard: reject template/metadata summaries before writing to DB ──
    let cleanTitle = point.title;
    let cleanSummary = point.summary;
    let cleanTitleEn = point.title_en;
    if (isBadContent(point.summary) || isBadContent(point.title)) {
      console.warn(`[storeTimeline] Bad content detected in TP "${point.title.slice(0, 60)}", attempting LLM repair...`);
      const linkedTitles = (point.source_urls ?? [])
        .map(u => urlToArticleId.get(u))
        .filter(Boolean)
        .slice(0, 6)
        .map(id => newsItems.find(n => urlToArticleId.get(n.url) === id)?.title ?? '')
        .filter(t => t.length > 0);
      const isGlobal = opts?.forceGlobal || /^[A-Za-z]/.test(query);
      const repaired = await repairBadTurningPoint(query, point.title, linkedTitles, isGlobal);
      if (repaired) {
        cleanTitle = repaired.title;
        cleanSummary = repaired.summary;
        if (isGlobal) cleanTitleEn = repaired.title;
        console.log(`[storeTimeline] Repaired: "${cleanTitle.slice(0, 60)}"`);
      } else {
        console.warn(`[storeTimeline] Repair failed, skipping bad TP "${point.title.slice(0, 60)}"`);
        continue;
      }
    }

    const newPoint: InsertTurningPoint = {
      topicId,
      title: cleanTitle,
      titleEn: cleanTitleEn,
      summary: cleanSummary,
      dateLabel: point.date_label,
      eventDate,
      articleCount: Math.max(1, Math.round(point.article_count)),
      mediaCount: Math.max(1, Math.round(point.media_count)),
      heatLevel: point.heat_level,
      isActive: 1, // Always active when stored; deactivated by replace-mode or 60-day cleanup
      sortOrder: nextSortOrder++,
    };

    await db.insert(turningPoints).values(newPoint);

    // 取得剛插入的轉折點 ID
    const [latestTP] = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topicId))
      .orderBy(desc(turningPoints.createdAt))
      .limit(1);
    if (!latestTP) continue;

    // 用 source_urls 對映到實際 newsArticle，設定 turningPointId
    const sourceUrls = point.source_urls.slice(0, 5); // 最多 5 個代表性來源
    let linkedCount = 0;
    for (const url of sourceUrls) {
      if (!url || url.length < 10) continue;
      const articleId = urlToArticleId.get(url);
      if (articleId) {
        // 對映到實際文章：更新 turningPointId
        try {
          await db.update(newsArticles)
            .set({ turningPointId: latestTP.id })
            .where(eq(newsArticles.id, articleId));
          linkedCount++;
        } catch { /* ignore */ }
      }
      // Skip URLs not in newsItems — avoid inserting placeholder articles with generic titles
    }
    console.log(`[storeTimeline] Turning point "${point.title}": linked ${linkedCount} articles`);

    // ── 修正 articleCount / mediaCount：以實際連結數為準 ──
    // LLM 估算的 article_count 可能遠大於實際存入 DB 的數量，必須更正
    if (linkedCount > 0) {
      const [actualCounts] = await db
        .select({
          articleCount: sql<number>`COUNT(*)`,
          mediaCount: sql<number>`COUNT(DISTINCT ${newsArticles.source})`,
        })
        .from(newsArticles)
        .where(eq(newsArticles.turningPointId, latestTP.id));
      if (actualCounts) {
        await db.update(turningPoints)
          .set({
            articleCount: Math.max(1, actualCounts.articleCount),
            mediaCount: Math.max(1, actualCounts.mediaCount),
          })
          .where(eq(turningPoints.id, latestTP.id));
      }
    } else {
      // 無法連結任何文章 → 把計數歸為 0，避免顯示虛假的 "13 篇報導"
      await db.update(turningPoints)
        .set({ articleCount: 0, mediaCount: 0 })
        .where(eq(turningPoints.id, latestTP.id));
    }

    // 更新去重 Map，防止同一批次內重複
    existingByTitle.set(point.title, latestTP.id);
    existingByDate.set(point.date_label, latestTP.id);
  }

  // ── Step C: isActive cleanup — TPs older than 60 days must not be marked isActive ──
  {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await db
      .update(turningPoints)
      .set({ isActive: 0 })
      .where(
        and(
          eq(turningPoints.topicId, topicId),
          sql`${turningPoints.eventDate} < ${sixtyDaysAgo.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')}`
        )
      );
    console.log(`[storeTimeline] Cleared isActive for TPs older than 60 days (topic ${topicId})`);
  }
}

// ─── Build Topic Timeline (Full Pipeline) ────────────────────────────────────────────
// ─── Circuit breaker ─────────────────────────────────────────────────────────
// 防止議題創建失控（例如 LLM 去重失敗 fail-open、discovery 迴圈、crash-loop 重複觸發）。
// 記錄本程序近 1 小時內建立的新議題時間戳；超過上限就拒絕再建，並記錄警告。
// 正常運作每小時遠低於此（discovery 每 2 小時約建 6-12 個 + 少量用戶搜尋），
// 但失控時單一程序每小時最多只會多建 MAX 筆，而不是數萬筆。
const _topicCreateTimestamps: number[] = [];
const MAX_NEW_TOPICS_PER_HOUR = 80;
// DB 層全域上限（跨所有程序，含孤兒）。設得比記憶體層寬鬆，作為最後防線。
const MAX_NEW_TOPICS_PER_HOUR_DB = 150;
function canCreateNewTopic(): boolean {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (_topicCreateTimestamps.length && _topicCreateTimestamps[0] < cutoff) {
    _topicCreateTimestamps.shift();
  }
  return _topicCreateTimestamps.length < MAX_NEW_TOPICS_PER_HOUR;
}

export async function buildTopicTimeline(query: string, opts?: {
  forceGlobal?: boolean;
  queryEn?: string;
  /** Explicit Chinese display title to store as topic.query (used by agent pipeline when cluster
   *  generates both English search title and Chinese display title) */
  displayTitleZh?: string;
  seedArticles?: Array<{ title: string; url: string; source: string; country: string; publishedAt: Date }>;
  languageFilter?: 'en'; // 僅保留英文文章（invest surface 使用）
  surface?: 'global' | 'invest' | 'brand' | 'politics';
}): Promise<{
  topic: typeof topics.$inferSelect | null;
  turningPointsList: Array<typeof turningPoints.$inferSelect & { news: Array<typeof newsArticles.$inferSelect> }>;
} | null> {
  const db = await getDb();
  if (!db) return null;

  console.log(`[Timeline] Building timeline for: "${query}"`);

  // Step 1: Check if topic already has a fresh timeline (within 1 hour)
  const existingTopics = await db
    .select()
    .from(topics)
    .where(like(topics.query, `%${query}%`))
    .limit(1);

  let topic = existingTopics[0] ?? null;

  if (topic) {
    const existingTPs = await db
      .select()
      .from(turningPoints)
      .where(eq(turningPoints.topicId, topic.id))
      .limit(1);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isFresh = topic.lastUpdated && topic.lastUpdated > oneHourAgo;

    if (existingTPs.length > 0 && isFresh) {
      console.log(`[Timeline] Using cached timeline for: "${query}"`);
      const tpList = await db
        .select()
        .from(turningPoints)
        .where(eq(turningPoints.topicId, topic.id))
        .orderBy(turningPoints.sortOrder);

      const result = await Promise.all(
        tpList.map(async (tp) => {
          const news = await db
            .select()
            .from(newsArticles)
            .where(eq(newsArticles.turningPointId, tp.id))
            .orderBy(desc(newsArticles.publishedAt))
            .limit(5);
          return { ...tp, news };
        })
      );

      return { topic, turningPointsList: result };
    }
  }

  // Step 1.5: Fuzzy similarity check — only against homepage-featured topics to avoid
  // wrong redirects from 13,000+ stale topics polluting the LLM context
  if (!topic) {
    try {
      const featuredTopics = await db
        .select({ id: topics.id, query: topics.query })
        .from(topics)
        .where(isNotNull(topics.homepageFeaturedAt))
        .limit(50);
      if (featuredTopics.length > 0) {
        const queryLang = detectQueryLanguage(query);
        const llmForCheck = selectLLM(queryLang);
        const topicListStr = featuredTopics.map(t => `ID:${t.id} 「${t.query}」`).join('\n');
        const checkResp = await llmForCheck({
          messages: [
            { role: 'system', content: '你是一個新聞議題去重助手。判斷新查詢是否與現有議題列表中的某個議題高度相似（指同一事件、同一人物、同一政策，只是措辭不同）。如果高度相似，回傳該議題的 ID；如果沒有相似的，回傳 0。只回傳一個數字，不要任何解釋。' },
            { role: 'user', content: `新查詢：「${query}」\n\n現有議題列表：\n${topicListStr}\n\n請問新查詢與哪個現有議題高度相似？回傳 ID 數字（沒有則回傳 0）：` },
          ],
        });
        const rawContent = checkResp?.choices?.[0]?.message?.content;
        const matchIdStr = (typeof rawContent === 'string' ? rawContent.trim() : '0') || '0';
        const matchId = parseInt(matchIdStr, 10);
        if (matchId > 0) {
          const matchedTopicRows = await db.select().from(topics).where(eq(topics.id, matchId)).limit(1);
          if (matchedTopicRows.length > 0) {
            console.log(`[Timeline] Similarity check: "${query}" → matched existing topic ID ${matchId} 「${matchedTopicRows[0].query}」, redirecting`);
            topic = matchedTopicRows[0];
            // When called from homepage scan with an English title, migrate the topic name to English
            if (opts?.queryEn && matchedTopicRows[0].query !== query) {
              await db.update(topics).set({ query }).where(eq(topics.id, matchId));
              topic = { ...topic, query };
              console.log(`[Timeline] Updated topic ${matchId} query to English: "${query}"`);
            }
          }
        } else {
          console.log(`[Timeline] Similarity check: "${query}" → no similar topic found, creating new`);
        }
      }
    } catch (e) {
      console.warn('[Timeline] Similarity check failed, proceeding with new topic creation:', (e as Error).message);
    }
  }

  // Step 2: Create or update topic
  if (!topic) {
    // ⛔ Circuit breaker（記憶體層）：若本程序近 1 小時已建立過多新議題，拒絕再建
    if (!canCreateNewTopic()) {
      console.error(`[Timeline] ⛔ 熔斷器(記憶體)啟動：本程序近 1 小時已建立 ${MAX_NEW_TOPICS_PER_HOUR}+ 個新議題，拒絕為「${query}」建立。請檢查 LLM 去重健康狀況。`);
      return null;
    }
    // ⛔ Circuit breaker（DB 層，跨程序）：即使有脫離管理的孤兒程序，也用全域速率上限壓住。
    // 查近 1 小時「全部程序」建立的議題數（靠 idx_created 索引，便宜）。
    try {
      const [recent] = await db
        .select({ c: sql<number>`COUNT(*)` })
        .from(topics)
        .where(gt(topics.createdAt, sql`(NOW() - INTERVAL 1 HOUR)`));
      const recentCount = Number(recent?.c ?? 0);
      if (recentCount >= MAX_NEW_TOPICS_PER_HOUR_DB) {
        console.error(`[Timeline] ⛔ 熔斷器(DB跨程序)啟動：近 1 小時全系統已建立 ${recentCount} 個議題（上限 ${MAX_NEW_TOPICS_PER_HOUR_DB}），拒絕為「${query}」建立。疑似失控或孤兒程序，請檢查。`);
        return null;
      }
    } catch (e) {
      console.warn(`[Timeline] DB 熔斷器查詢失敗，改用記憶體層保護:`, (e as Error).message);
    }
    // For slug: prefer English query (clean URL), for display query: prefer Chinese
    const slugBase = query; // query is always the English search title from agents
    const cleanQuery = slugBase
      .replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/g, (match) => {
        return Array.from(match)
          .map((c) => c.codePointAt(0)?.toString(16) ?? "")
          .join("");
      })
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const slug = `${cleanQuery || "topic"}-${Date.now()}`;

    // If caller provides an explicit Chinese display title, use it as the stored query
    const initialQuery = opts?.displayTitleZh || query;
    await db.insert(topics).values({
      slug,
      query: initialQuery,
      queryEn: opts?.queryEn ?? null,
      heatLevel: "medium",
      trendDirection: "stable",
    });
    _topicCreateTimestamps.push(Date.now()); // 記錄創建時間供熔斷器計算

    const searchForNew = opts?.displayTitleZh || query;
    const newTopics = await db
      .select()
      .from(topics)
      .where(like(topics.query, `%${searchForNew.slice(0, 20)}%`))
      .limit(1);
    topic = newTopics[0] ?? null;
  }

  if (!topic) return null;

  // Step 3: Detect query language and expand query keywords via AI
  const queryLanguage = detectQueryLanguage(query);
  console.log(`[Timeline] Query language: ${queryLanguage} for: "${query}"`);

  // Query expansion: if English keyword already provided (from homepageScan), use it directly.
  // Otherwise run LLM expansion for user-typed queries.
  let searchQuery = query;
  let searchQueryEn = opts?.queryEn ?? '';

  if (searchQueryEn) {
    console.log(`[Timeline] Using provided English query: "${searchQueryEn}"`);
  } else {
    const llmForExpansion = selectLLM(queryLanguage);
    try {
      const expansionResp = await llmForExpansion({
        messages: [
          {
            role: 'system',
            content: 'You are a news search keyword optimizer. Return ONLY a JSON object with: "primary" (best search phrase max 20 chars), "primaryEn" (best English translation for international search, max 40 chars).'
          },
          {
            role: 'user',
            content: `Convert to news search keywords: "${query}"\nLanguage: ${queryLanguage}\nReturn JSON only.`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'keyword_expansion',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                primary: { type: 'string' },
                primaryEn: { type: 'string' }
              },
              required: ['primary', 'primaryEn'],
              additionalProperties: false
            }
          }
        }
      });
      const expansionContent = expansionResp.choices?.[0]?.message?.content;
      if (expansionContent) {
        const parsed = typeof expansionContent === 'string' ? JSON.parse(expansionContent) : expansionContent;
        if (parsed?.primary && parsed.primary !== query) {
          searchQuery = parsed.primary;
        }
        if (parsed?.primaryEn) {
          searchQueryEn = parsed.primaryEn;
        }
        console.log(`[Timeline] Query expanded: "${query}" → "${searchQuery}" EN:"${searchQueryEn}"`);
      }
    } catch (err) {
      console.warn('[Timeline] Query expansion failed, using original query:', (err as Error).message);
    }
  }

  // 階段更新：RSS 搜尋中
  await db.update(topics).set({ collectionStage: 'rss_searching' }).where(eq(topics.id, topic.id));
  console.log(`[Timeline] Searching Google News for: "${searchQuery}" (EN: "${searchQueryEn}")`);
  const rssStartTime = Date.now();
  const { items: rssItems, rawText: rssRawText } = await searchGoogleNews(searchQuery, 150, opts?.forceGlobal, searchQueryEn);
  const rssElapsedSec = Math.max((Date.now() - rssStartTime) / 1000, 0.1);
  const rssRate = rssItems.length / rssElapsedSec;
  console.log(`[Timeline] RSS: ${rssItems.length} articles in ${rssElapsedSec.toFixed(1)}s (rate: ${rssRate.toFixed(1)} articles/sec)`);

  // ── 注入首頁掃描的英文原始標題（如果有的話）──
  // homepageScan 從 30 個國際媒體抓到的原始英文文章，直接作為 seed 注入
  let newsItems = rssItems;
  let rawText = rssRawText;
  if (opts?.seedArticles && opts.seedArticles.length > 0) {
    const existingUrls = new Set(rssItems.map((i: NewsItem) => i.url));
    const seedItems: NewsItem[] = opts.seedArticles
      .filter(a => a.url && !existingUrls.has(a.url))
      .map(a => ({
        title: a.title,
        url: a.url,
        source: a.source,
        publishedAt: a.publishedAt.toISOString(),
        description: '',
        sourceFlag: a.country,
      }));
    if (seedItems.length > 0) {
      newsItems = [...seedItems, ...newsItems];
      console.log(`[Timeline] Injected ${seedItems.length} seed articles from homepage scan`);
    }
  }

  {
    // 階段更新：LLM 補充搜尋中
    await db.update(topics).set({ collectionStage: 'perplexity_searching' }).where(eq(topics.id, topic.id));
    const isChineseQuery = /[\u4e00-\u9fff]/.test(query);

    // 並行執行两輪 LLM 搜尋：主要角度 + 分析角度
    const llmAngles: Array<'main' | 'analysis' | 'english'> = ['main', 'analysis'];
    if (!isChineseQuery) {
      llmAngles.push('english');
    } else if (opts?.forceGlobal || !isLocalTaiwanTopic(query)) {
      // 中文查詢的全球議題：也從英文角度補充（重要！避免只搜繁中媒體）
      llmAngles.push('english');
    }

    console.log(`[Timeline] Triggering LLM supplemental search (${llmAngles.length} angles, RSS: ${rssItems.length} articles)...`);

    // 並行執行所有 LLM 搜尋
    const llmResults = await Promise.all(
      llmAngles.map(angle => searchWithLLM(query, angle))
    );
    const allLLMItems = llmResults.flat();

    if (allLLMItems.length > 0) {
      // 合併兩個來源，去除重複 URL（以標題相似度也去重）
      const existingUrls = new Set<string>(rssItems.map((i: NewsItem) => i.url));
      const existingTitleWords = new Set<string>(
        rssItems.flatMap((i: NewsItem) => i.title.split(/\s+/).filter((w: string) => w.length >= 4))
      );
      const newItems = allLLMItems.filter((i: NewsItem) => {
        if (!i.url || existingUrls.has(i.url)) return false;
        // 避免標題完全重複的文章（允許部分重疊）
        const titleWords = i.title.split(/\s+/).filter((w: string) => w.length >= 4);
        const overlapCount = titleWords.filter((w: string) => existingTitleWords.has(w)).length;
        const overlapRatio = titleWords.length > 0 ? overlapCount / titleWords.length : 0;
        return overlapRatio < 0.8; // 允許最多 80% 標題詞重疊
      });
      newsItems = [...rssItems, ...newItems];
      console.log(`[Timeline] After LLM merge: ${newsItems.length} articles (${rssItems.length} RSS + ${newItems.length} new from LLM)`);
      // 重建完整 rawText：將所有文章統一格式，包含 URL 讓 AI 能引用真實連結
      rawText = newsItems
        .map((item: NewsItem, i: number) => `[${i + 1}] ${item.publishedAt} — ${item.source} — URL: ${item.url}\n標題: ${item.title}\n摘要: ${item.description}`)
        .join('\n\n');
    } else {
      console.log(`[Timeline] LLM returned 0 articles, using RSS only (${rssItems.length} articles)`);
    }
  }

  // ── Meltwater 補充：根據議題 category 自動拉取對應分類 feed ──
  // 不需要 per-topic 設定——只要 .env 設好 8 個 category feed，新議題自動匹配
  try {
    const { articles: mwArticles, feedsChecked } = await fetchMeltwaterForTopic(
      searchQueryEn || query,
      topic.category,
      14
    );
    if (mwArticles.length > 0) {
      const existingUrls = new Set(newsItems.map((i: NewsItem) => i.url));
      const mwItems = meltwaterArticlesToNewsItems(mwArticles)
        .filter(i => !existingUrls.has(i.url)) as NewsItem[];
      newsItems = [...newsItems, ...mwItems];
      console.log(`[Timeline] Meltwater added ${mwItems.length} articles (category: "${topic.category}", feeds checked: ${feedsChecked})`);
    } else if (feedsChecked > 0) {
      console.log(`[Timeline] Meltwater: no matching articles in ${feedsChecked} feed(s) for category "${topic.category}"`);
    }
    // feedsChecked === 0 = env vars not set, silently skip
  } catch (err) {
    console.warn(`[Timeline] Meltwater fetch failed:`, err);
  }

  // ── DB 文章補充：將已存在 DB 的近期文章合併，避免 LLM 搜尋只找到歷史舊資料 ──
  {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dbArticles = await db
      .select({
        id: newsArticles.id,
        title: newsArticles.title,
        url: newsArticles.url,
        source: newsArticles.source,
        publishedAt: newsArticles.publishedAt,
      })
      .from(newsArticles)
      .where(
        and(
          eq(newsArticles.topicId, topic.id),
          gt(newsArticles.publishedAt, ninetyDaysAgo),
          // 語言過濾：invest surface 僅補充英文文章，避免繁中新聞混入
          ...(opts?.languageFilter === 'en'
            ? [sql`${newsArticles.language} NOT LIKE 'zh%'`]
            : [])
        )
      )
      .orderBy(desc(newsArticles.publishedAt))
      .limit(150);

    if (dbArticles.length > 0) {
      const existingUrls = new Set(newsItems.map((i: NewsItem) => i.url));
      const dbItems: NewsItem[] = dbArticles
        .filter(a => a.url && !existingUrls.has(a.url))
        .map(a => ({
          title: a.title ?? '',
          url: a.url ?? '',
          source: a.source ?? 'DB',
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : new Date().toISOString(),
          description: '',
        }));
      if (dbItems.length > 0) {
        newsItems = [...newsItems, ...dbItems];
        console.log(`[Timeline] DB merge: added ${dbItems.length} recent articles from DB for topic ${topic.id}`);
      }
    }
  }

  if (newsItems.length === 0) {
    // 階段更新：完成（無文章）
    await db.update(topics).set({ collectionStage: 'ready' }).where(eq(topics.id, topic.id));
    console.warn(`[Timeline] No news found for: "${query}"`);
    return { topic, turningPointsList: [] };
  }

  // ── 相關性過濾：確保送入 LLM 的文章跟議題直接相關 ──
  // 從 query 提取關鍵詞，只保留標題包含足夠多關鍵詞的文章
  const queryTerms = query
    .toLowerCase()
    .replace(/[–—\-「」【】『』《》〈〉""'']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const relevantItems = newsItems.filter((item) => {
    const titleLower = item.title.toLowerCase();
    const matchCount = queryTerms.filter((term) => titleLower.includes(term)).length;
    // 至少符合 25% 的查詢詞，或至少 2 個詞命中
    return matchCount >= Math.max(2, Math.ceil(queryTerms.length * 0.25));
  });

  // 若過濾後文章太少，退回使用全部文章（避免空結果）
  const itemsForAnalysis = relevantItems.length >= 8 ? relevantItems : newsItems;
  const relevanceRawText = itemsForAnalysis
    .map((item: NewsItem, i: number) =>
      `[${i + 1}] ${item.publishedAt} — ${item.source} — URL: ${item.url}\n標題: ${item.title}\n摘要: ${item.description}`
    )
    .join('\n\n');

  console.log(
    `[Timeline] Relevance filter: ${newsItems.length} → ${itemsForAnalysis.length} articles for analysis` +
    (relevantItems.length < 8 ? ' (fallback: using all)' : '')
  );

  // 階段更新：AI 分析中
  await db.update(topics).set({ collectionStage: 'analyzing' }).where(eq(topics.id, topic.id));
  console.log(`[Timeline] Found ${itemsForAnalysis.length} articles, formatting timeline...`);

  // Step 4: Format into timeline using language-appropriate LLM
  const analysisResult = await formatTimelineFromNews(query, relevanceRawText, itemsForAnalysis, queryLanguage, opts?.surface ?? 'global');
  const turningPointsData = analysisResult.turning_points;
  const topicTags = analysisResult.tags ?? [];
  const topicTitle = analysisResult.topic_title || query;
  console.log(`[Timeline] Detected ${turningPointsData.length} turning points, tags: ${topicTags.join(', ')}`);

  // Step 5: Update topic stats + tags
  // 使用實際收集的文章數（而非 AI 估計值），更準確反映資料量
  const totalArticles = newsItems.length;
  const maxMedia = Math.max(...turningPointsData.map((tp) => tp.media_count), 0);
  const maxHeat = turningPointsData.some((tp) => tp.heat_level === "extreme")
    ? "extreme"
    : turningPointsData.some((tp) => tp.heat_level === "high")
    ? "high"
    : "medium";

  // ── 決定最終顯示標題和英文搜尋標題 ───────────────────────────────────────
  // 優先順序（顯示 query）：
  //   1. opts.displayTitleZh — cluster 直接提供的中文標題（最精確）
  //   2. LLM 分析生成的 topic_title（如果是中文）
  //   3. 保留現有 topic.query
  // 英文搜尋標題（queryEn）：opts.queryEn（cluster 的英文標題）
  const isChineseTitle = topicTitle && /[一-鿿]/.test(topicTitle) && topicTitle !== query;
  const queryUpdates: Record<string, string> = {};

  if (opts?.displayTitleZh) {
    // Agent pipeline with explicit Chinese title from cluster LLM output
    queryUpdates.query = opts.displayTitleZh;
    if (opts.queryEn) queryUpdates.queryEn = opts.queryEn;
  } else if (opts?.queryEn) {
    // Agent pipeline without explicit Chinese title: use LLM-generated Chinese title if available
    if (isChineseTitle) queryUpdates.query = topicTitle;
    queryUpdates.queryEn = opts.queryEn;
  } else if (topic.query === query && isChineseTitle) {
    // 使用者搜尋：LLM 生成不同中文標題時更新
    queryUpdates.query = topicTitle;
  }

  await db
    .update(topics)
    .set({
      totalArticles,
      totalMedia: maxMedia,
      heatLevel: maxHeat,
      lastUpdated: new Date(),
      // 儲存標籤（JSON 字串）
      tags: JSON.stringify(topicTags),
      // 階段更新：分析完成
      collectionStage: 'ready',
      ...queryUpdates,
    })
    .where(eq(topics.id, topic.id));

  // Step 6: Store timeline in DB (pass query for relevance filtering)
  await storeTimeline(topic.id, turningPointsData, newsItems, topic.query || query, opts?.languageFilter);

  // Step 7: Return complete timeline
  const tpList = await db
    .select()
    .from(turningPoints)
    .where(eq(turningPoints.topicId, topic.id))
    .orderBy(desc(turningPoints.eventDate)); // 最新轉折點在最前

  const result = await Promise.all(
    tpList.map(async (tp) => {
      const news = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.turningPointId, tp.id))
        .orderBy(desc(newsArticles.publishedAt))
        .limit(5);
      return { ...tp, news };
    })
  );

  console.log(`[Timeline] Done! ${result.length} turning points stored.`);
  return { topic, turningPointsList: result };
}

// ─── Generate AI Stance Response ─────────────────────────────────────────────
export async function generateStanceResponse(params: {
  topicTitle: string;
  topicSummary: string;
  role: string;
  responseType: "press" | "social" | "memo";
  language?: string;
}): Promise<string> {
  const { topicTitle, topicSummary, role, responseType, language = "zh-TW" } = params;

  const typeInstructions = {
    press: "a formal press release (新聞稿)",
    social: "a social media post (社群媒體貼文)",
    memo: "an internal decision memo (內部決策備忘錄)",
  };

  const langInstruction =
    language === "zh-TW" || language === "zh-CN"
      ? "Respond in Traditional Chinese (繁體中文)."
      : `Respond in ${language}.`;

  // 注入今日日期（台灣時區 UTC+8）
  const now = new Date();
  const twDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = twDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayZh = `${twDate.getUTCFullYear()}年${twDate.getUTCMonth() + 1}月${twDate.getUTCDate()}日`;
  const todayROC = `中華民國${twDate.getUTCFullYear() - 1911}年${twDate.getUTCMonth() + 1}月${twDate.getUTCDate()}日`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert communications strategist. ${langInstruction} Generate ${typeInstructions[responseType]} from the perspective of the specified role, based on the given news event context. Be realistic, professional, and appropriate to the role's interests and concerns.

IMPORTANT: Today's date is ${todayStr} (${todayZh} / ${todayROC}). Always use TODAY's date when generating dates in the document. NEVER use past dates or make up dates.`,
      },
      {
        role: "user",
        content: `News Event: "${topicTitle}"\n\nContext: ${topicSummary}\n\nRole/Perspective: ${role}\n\nToday's date: ${todayZh} (${todayROC})\n\nGenerate a ${typeInstructions[responseType]} from this perspective. Keep it concise but impactful. Use today's date for any date references in the document.`,
      },
    ],
  });

  return (response.choices[0]?.message?.content as string) ?? "無法生成回覆，請稍後再試。";
}
