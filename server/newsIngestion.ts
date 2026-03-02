/**
 * NewsFlow — News Ingestion Service
 * Fetches RSS feeds, deduplicates, and stores articles to DB.
 * Also handles AI embedding generation for semantic clustering.
 */

import RSSParser from "rss-parser";
import { getDb } from "./db";
import { newsArticles, rssSources, type InsertNewsArticle } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { eq, isNull, sql } from "drizzle-orm";

const parser = new RSSParser({
  timeout: 10000,
  headers: { "User-Agent": "NewsFlow/1.0 (+https://news.sowork.ai)" },
});

// ─── Default RSS Sources ──────────────────────────────────────────────────────
export const DEFAULT_RSS_SOURCES = [
  // ── Taiwan 🇹🇼 ──
  { name: "自由時報", url: "https://news.ltn.com.tw/rss/all.xml", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "全國" },
  { name: "聯合新聞網", url: "https://udn.com/rssfeed/news/2/BREAKINGNEWS?ch=news", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "全國" },
  { name: "公視新聞", url: "https://news.pts.org.tw/xml/newsfeed.xml", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "全國" },
  { name: "中央社政治", url: "https://feeds.feedburner.com/rsscna/politics", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "政治" },
  { name: "中央社國際", url: "https://feeds.feedburner.com/rsscna/intworld", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "國際" },
  { name: "中央社兩岸", url: "https://feeds.feedburner.com/rsscna/mainland", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "兩岸" },
  { name: "中央社財經", url: "https://feeds.feedburner.com/rsscna/finance", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "財經" },
  { name: "Focus Taiwan", url: "https://feeds.feedburner.com/rsscna/engnews", language: "en", country: "TW", flag: "🇹🇼", category: "國際" },
  { name: "Taipei Times", url: "https://www.taipeitimes.com/xml/index.rss", language: "en", country: "TW", flag: "🇹🇼", category: "全國" },
  { name: "ETtoday即時", url: "https://feeds.feedburner.com/ettoday/realtime", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "即時" },
  { name: "ETtoday國際", url: "https://feeds.feedburner.com/ettoday/international", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "國際" },
  { name: "ETtoday政治", url: "https://feeds.feedburner.com/ettoday/politics", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "政治" },
  { name: "商業周刊", url: "https://www.businessweekly.com.tw/RSS/Channel/latest.xml", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "財經" },
  { name: "新頭殼", url: "https://newtalk.tw/rss", language: "zh-TW", country: "TW", flag: "🇹🇼", category: "全國" },
  { name: "BBC 中文繁體", url: "https://feeds.bbci.co.uk/zhongwen/trad/rss.xml", language: "zh-TW", country: "GB", flag: "🇬🇧", category: "國際" },

  // ── China / HK 🇨🇳🇭🇰 ──
  { name: "Xinhua English", url: "http://www.xinhuanet.com/english/rss/worldrss.xml", language: "en", country: "CN", flag: "🇨🇳", category: "國際" },
  { name: "CGTN World", url: "https://www.cgtn.com/subscribe/rss/section/world.xml", language: "en", country: "CN", flag: "🇨🇳", category: "國際" },
  { name: "ECNS", url: "https://www.ecns.cn/rss/rss.xml", language: "en", country: "CN", flag: "🇨🇳", category: "國際" },
  { name: "China Digital Times", url: "https://chinadigitaltimes.net/feed", language: "en", country: "CN", flag: "🇨🇳", category: "全國" },
  { name: "SCMP World", url: "https://www.scmp.com/rss/91/feed", language: "en", country: "HK", flag: "🇭🇰", category: "國際" },
  { name: "SCMP HK", url: "https://www.scmp.com/rss/5/feed", language: "en", country: "HK", flag: "🇭🇰", category: "全國" },
  { name: "VOA 中文", url: "https://www.voachinese.com/api/zrqoeuuqt/rss", language: "zh-CN", country: "US", flag: "🇺🇸", category: "國際" },

  // ── USA 🇺🇸 ──
  { name: "CNN Top", url: "http://rss.cnn.com/rss/cnn_topstories.rss", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "CNN World", url: "http://rss.cnn.com/rss/cnn_world.rss", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "NYT Home", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "NPR News", url: "https://www.npr.org/rss/rss.php?id=1001", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "NPR World", url: "https://www.npr.org/rss/rss.php?id=1004", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "Washington Post", url: "https://feeds.washingtonpost.com/rss/world", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "ABC News", url: "https://feeds.abcnews.com/abcnews/topstories", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "NBC World", url: "https://feeds.nbcnews.com/feeds/worldnews", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "PBS NewsHour", url: "https://feeds.feedburner.com/NewshourWorld", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "Axios", url: "https://api.axios.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "The Hill", url: "https://thehill.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "政治" },
  { name: "Politico", url: "https://www.politico.com/rss/politicopicks.xml", language: "en", country: "US", flag: "🇺🇸", category: "政治" },
  { name: "AP News", url: "https://news.google.com/rss/search?q=ap+news&hl=en-US&gl=US&ceid=US:en", language: "en", country: "US", flag: "🇺🇸", category: "全國" },

  // ── UK / International 🇬🇧 ──
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },
  { name: "BBC Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "亞洲" },
  { name: "BBC Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "非洲" },
  { name: "BBC Europe", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "歐洲" },
  { name: "BBC Middle East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "中東" },
  { name: "BBC Latin America", url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "拉丁美洲" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "財經" },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "科技" },
  { name: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", language: "en", country: "GB", flag: "🇬🇧", category: "財經" },
  { name: "Reuters Tech", url: "https://feeds.reuters.com/reuters/technologyNews", language: "en", country: "GB", flag: "🇬🇧", category: "科技" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },

  // ── Europe 🇪🇺 ──
  { name: "Euronews", url: "https://feeds.feedburner.com/euronews/en/home/", language: "en", country: "EU", flag: "🇪🇺", category: "歐洲" },
  { name: "France24 World", url: "https://www.france24.com/en/rss", language: "en", country: "FR", flag: "🇫🇷", category: "國際" },
  { name: "France24 Europe", url: "https://www.france24.com/en/europe/rss", language: "en", country: "FR", flag: "🇫🇷", category: "歐洲" },
  { name: "DW All", url: "https://rss.dw.com/rdf/rss-en-all", language: "en", country: "DE", flag: "🇩🇪", category: "國際" },
  { name: "DW Europe", url: "https://rss.dw.com/rdf/rss-en-eu", language: "en", country: "DE", flag: "🇩🇪", category: "歐洲" },
  { name: "DW Top Stories", url: "https://rss.dw.com/rdf/rss-en-top", language: "en", country: "DE", flag: "🇩🇪", category: "全國" },
  { name: "Spiegel International", url: "https://www.spiegel.de/international/index.rss", language: "en", country: "DE", flag: "🇩🇪", category: "國際" },
  { name: "Le Monde International", url: "https://www.lemonde.fr/en/international/rss_full.xml", language: "en", country: "FR", flag: "🇫🇷", category: "國際" },
  { name: "Politico EU", url: "https://www.politico.eu/feed/", language: "en", country: "EU", flag: "🇪🇺", category: "歐洲" },

  // ── Middle East 🇲🇾 ──
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "en", country: "QA", flag: "🇶🇦", category: "中東" },
  { name: "Tehran Times", url: "https://www.tehrantimes.com/rss", language: "en", country: "IR", flag: "🇮🇷", category: "中東" },
  { name: "Haaretz", url: "https://www.haaretz.com/srv/haaretz-latest-rss", language: "en", country: "IL", flag: "🇮🇱", category: "中東" },
  { name: "Times of Israel", url: "https://www.timesofisrael.com/feed/", language: "en", country: "IL", flag: "🇮🇱", category: "中東" },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", language: "en", country: "SA", flag: "🇸🇦", category: "中東" },
  { name: "Daily Sabah", url: "https://www.dailysabah.com/rssFeed/homepage", language: "en", country: "TR", flag: "🇹🇷", category: "中東" },

  // ── Japan 🇯🇵 ──
  { name: "NHK 日本語", url: "https://www3.nhk.or.jp/rss/news/cat0.xml", language: "ja", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "NHK World", url: "https://www3.nhk.or.jp/rss/news/cat6.xml", language: "ja", country: "JP", flag: "🇯🇵", category: "國際" },
  { name: "NHK English", url: "https://www3.nhk.or.jp/nhkworld/en/news/rss/", language: "en", country: "JP", flag: "🇯🇵", category: "國際" },
  { name: "Japan Times", url: "https://www.japantimes.co.jp/feed/", language: "en", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", language: "en", country: "JP", flag: "🇯🇵", category: "財經" },

  // ── Korea 🇰🇷 ──
  { name: "Korea Herald", url: "https://www.koreaherald.com/rss/", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },
  { name: "Yonhap News", url: "https://en.yna.co.kr/RSS/news.xml", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },
  { name: "Korea JoongAng Daily", url: "https://koreajoongangdaily.joins.com/rss/", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },

  // ── Southeast Asia 🇸🇬🇲🇾🇮🇩 ──
  { name: "Straits Times", url: "https://www.straitstimes.com/news/world/rss.xml", language: "en", country: "SG", flag: "🇸🇬", category: "國際" },
  { name: "Channel NewsAsia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", language: "en", country: "SG", flag: "🇸🇬", category: "亞洲" },
  { name: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", language: "en", country: "TH", flag: "🇹🇭", category: "全國" },
  { name: "Jakarta Post", url: "https://www.thejakartapost.com/feed", language: "en", country: "ID", flag: "🇮🇩", category: "全國" },
  { name: "Philippine Daily Inquirer", url: "https://newsinfo.inquirer.net/feed", language: "en", country: "PH", flag: "🇵🇭", category: "全國" },
  { name: "Vietnam News", url: "https://vietnamnews.vn/rss/", language: "en", country: "VN", flag: "🇻🇳", category: "全國" },
  { name: "Malay Mail", url: "https://www.malaymail.com/feed", language: "en", country: "MY", flag: "🇲🇾", category: "全國" },

  // ── South Asia 🇮🇳🇵🇰 ──
  { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", language: "en", country: "IN", flag: "🇮🇳", category: "全國" },
  { name: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", language: "en", country: "IN", flag: "🇮🇳", category: "全國" },
  { name: "The Hindu", url: "https://www.thehindu.com/news/feeder/default.rss", language: "en", country: "IN", flag: "🇮🇳", category: "全國" },
  { name: "Dawn Pakistan", url: "https://www.dawn.com/feeds/home", language: "en", country: "PK", flag: "🇵🇰", category: "全國" },

  // ── Australia / NZ 🇦🇺🇳🇿 ──
  { name: "ABC Australia", url: "https://www.abc.net.au/news/feed/51120/rss.xml", language: "en", country: "AU", flag: "🇦🇺", category: "全國" },
  { name: "Sydney Morning Herald", url: "https://www.smh.com.au/rss/feed.xml", language: "en", country: "AU", flag: "🇦🇺", category: "全國" },
  { name: "NZ Herald", url: "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/news/", language: "en", country: "NZ", flag: "🇳🇿", category: "全國" },

  // ── Africa 🇿🇦🇳🇬 ──
  { name: "AllAfrica", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", language: "en", country: "ZA", flag: "🇿🇦", category: "非洲" },
  { name: "Daily Nation Kenya", url: "https://nation.africa/kenya/rss.xml", language: "en", country: "KE", flag: "🇰🇪", category: "非洲" },
  { name: "Mail & Guardian SA", url: "https://mg.co.za/feed/", language: "en", country: "ZA", flag: "🇿🇦", category: "非洲" },

  // ── Latin America 🇧🇷🇲🇽 ──
  { name: "Buenos Aires Herald", url: "https://buenosairesherald.com/feed", language: "en", country: "AR", flag: "🇦🇷", category: "拉丁美洲" },
  { name: "Rio Times Brazil", url: "https://riotimesonline.com/feed/", language: "en", country: "BR", flag: "🇧🇷", category: "拉丁美洲" },
  { name: "Mexico News Daily", url: "https://mexiconewsdaily.com/feed/", language: "en", country: "MX", flag: "🇲🇽", category: "拉丁美洲" },

  // ── Russia / Eastern Europe 🇷🇺🇺🇦 ──
  { name: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", language: "en", country: "RU", flag: "🇷🇺", category: "東歐" },
  { name: "Kyiv Independent", url: "https://kyivindependent.com/feed/", language: "en", country: "UA", flag: "🇺🇦", category: "東歐" },
  { name: "Euractiv", url: "https://www.euractiv.com/feed/", language: "en", country: "EU", flag: "🇪🇺", category: "歐洲" },

  // ── Tech / Business Global 💻 ──
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "科技" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", language: "en", country: "US", flag: "🇺🇸", category: "科技" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", language: "en", country: "US", flag: "🇺🇸", category: "科技" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", language: "en", country: "US", flag: "🇺🇸", category: "科技" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "科技" },
  { name: "Financial Times", url: "https://www.ft.com/world?format=rss", language: "en", country: "GB", flag: "🇬🇧", category: "財經" },
  { name: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", language: "en", country: "US", flag: "🇺🇸", category: "財經" },
  { name: "The Economist", url: "https://www.economist.com/latest/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "財經" },
  { name: "Forbes", url: "https://www.forbes.com/real-time/feed2/", language: "en", country: "US", flag: "🇺🇸", category: "財經" },
  { name: "Business Insider", url: "https://feeds.businessinsider.com/custom/all", language: "en", country: "US", flag: "🇺🇸", category: "財經" },

  // ── Taiwan Today (English) 🇹🇼 ──
  { name: "Taiwan Today", url: "https://api.taiwantoday.tw/en/rss.php", language: "en", country: "TW", flag: "🇹🇼", category: "全國" },

  // ── China.org.cn 🇨🇳 ──
  { name: "China.org.cn", url: "http://www.china.org.cn/rss/1201719.xml", language: "en", country: "CN", flag: "🇨🇳", category: "全國" },

  // ── Additional US Media 🇺🇸 ──
  { name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "Vox", url: "https://www.vox.com/rss/index.xml", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "Slate", url: "https://feeds.feedburner.com/Slate", language: "en", country: "US", flag: "🇺🇸", category: "全國" },
  { name: "Mother Jones", url: "https://www.motherjones.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "政治" },
  { name: "The Nation", url: "https://www.thenation.com/feed/?post_type=article", language: "en", country: "US", flag: "🇺🇸", category: "政治" },
  { name: "National Review", url: "https://www.nationalreview.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "政治" },
  { name: "Foreign Policy", url: "https://foreignpolicy.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml", language: "en", country: "US", flag: "🇺🇸", category: "國際" },
  { name: "Defense One", url: "https://www.defenseone.com/rss/all/", language: "en", country: "US", flag: "🇺🇸", category: "國防" },
  { name: "Breaking Defense", url: "https://breakingdefense.com/feed/", language: "en", country: "US", flag: "🇺🇸", category: "國防" },

  // ── Additional UK Media 🇬🇧 ──
  { name: "The Independent", url: "https://www.independent.co.uk/news/world/rss", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },
  { name: "The Telegraph World", url: "https://www.telegraph.co.uk/rss.xml", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },
  { name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/world.xml", language: "en", country: "GB", flag: "🇬🇧", category: "國際" },
  { name: "Channel 4 News", url: "https://www.channel4.com/news/feed", language: "en", country: "GB", flag: "🇬🇧", category: "全國" },

  // ── Additional Europe 🇪🇺 ──
  { name: "ANSA English", url: "https://www.ansa.it/english/news/general_news/rss.xml", language: "en", country: "IT", flag: "🇮🇹", category: "國際" },
  { name: "EFE English", url: "https://www.efe.com/efe/english/1/rss", language: "en", country: "ES", flag: "🇪🇸", category: "國際" },
  { name: "Swiss Info", url: "https://www.swissinfo.ch/eng/rss/top_news", language: "en", country: "CH", flag: "🇨🇭", category: "國際" },
  { name: "Radio Free Europe", url: "https://www.rferl.org/api/epiqq", language: "en", country: "EU", flag: "🇪🇺", category: "東歐" },

  // ── Additional Middle East 🇸🇦 ──
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", language: "en", country: "GB", flag: "🇬🇧", category: "中東" },
  { name: "Al-Monitor", url: "https://www.al-monitor.com/rss", language: "en", country: "US", flag: "🇺🇸", category: "中東" },
  { name: "Gulf News", url: "https://gulfnews.com/rss", language: "en", country: "AE", flag: "🇦🇪", category: "中東" },
  { name: "Jordan Times", url: "https://www.jordantimes.com/rss.xml", language: "en", country: "JO", flag: "🇯🇴", category: "中東" },

  // ── Additional Asia 🇨🇳🇮🇳 ──
  { name: "Global Times", url: "https://www.globaltimes.cn/rss/outbrain.xml", language: "en", country: "CN", flag: "🇨🇳", category: "國際" },
  { name: "South China Morning Post Business", url: "https://www.scmp.com/rss/92/feed", language: "en", country: "HK", flag: "🇭🇰", category: "財經" },
  { name: "Nikkei Japan", url: "https://www.nikkei.com/rss/news.rdf", language: "ja", country: "JP", flag: "🇯🇵", category: "財經" },
  { name: "Mainichi Japan", url: "https://mainichi.jp/rss/etc/mainichi-flash.rss", language: "ja", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "Asahi Shimbun", url: "https://www.asahi.com/rss/asahi/newsheadlines.rdf", language: "ja", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "Yomiuri Shimbun", url: "https://www.yomiuri.co.jp/feed/", language: "ja", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "Chosun Ilbo", url: "https://english.chosun.com/rss/", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },
  { name: "Hankyoreh English", url: "https://english.hani.co.kr/rss/", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },

  // ── Science / Environment 🌍 ──
  { name: "Nature News", url: "https://www.nature.com/nature.rss", language: "en", country: "GB", flag: "🇬🇧", category: "科學" },
  { name: "Science Daily", url: "https://www.sciencedaily.com/rss/top/science.xml", language: "en", country: "US", flag: "🇺🇸", category: "科學" },
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home/", language: "en", country: "GB", flag: "🇬🇧", category: "科學" },
  { name: "Climate Home News", url: "https://www.climatechangenews.com/feed/", language: "en", country: "GB", flag: "🇬🇧", category: "環境" },
  { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed", language: "en", country: "GB", flag: "🇬🇧", category: "環境" },

  // ── Additional Global Finance 💹 ──
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", language: "en", country: "US", flag: "🇺🇸", category: "財經" },
  { name: "CNBC World", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", language: "en", country: "US", flag: "🇺🇸", category: "財經" },
  { name: "Wall Street Journal", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", language: "en", country: "US", flag: "🇺🇸", category: "財經" },
  { name: "Quartz", url: "https://qz.com/feed", language: "en", country: "US", flag: "🇺🇸", category: "財經" },

  // ── Part 2: 東亞新增 🇯🇵🇰🇷 ──
  { name: "NHK World RSS", url: "https://www3.nhk.or.jp/nhkworld/en/news/feeds/", language: "en", country: "JP", flag: "🇯🇵", category: "國際" },
  { name: "Mainichi", url: "https://mainichi.jp/english/rss/etc/atom.xml", language: "en", country: "JP", flag: "🇯🇵", category: "全國" },
  { name: "Korea Herald", url: "http://www.koreaherald.com/common/rss_xml.php", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },
  { name: "Korea Times", url: "https://www.koreatimes.co.kr/www/rss/rss.xml", language: "en", country: "KR", flag: "🇰🇷", category: "全國" },

  // ── Part 2: 東南亞新增 🇮🇩🇵🇭🇻🇳 ──
  { name: "Straits Times Asia", url: "https://www.straitstimes.com/news/asia/rss.xml", language: "en", country: "SG", flag: "🇸🇬", category: "亞洲" },
  { name: "VnExpress", url: "https://e.vnexpress.net/rss/news.rss", language: "en", country: "VN", flag: "🇻🇳", category: "全國" },
  { name: "Manila Times", url: "https://www.manilatimes.net/feed/", language: "en", country: "PH", flag: "🇵🇭", category: "全國" },

  // ── Part 2: 南亞新增 🇮🇳🇵🇰🇧🇩 ──
  { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", language: "en", country: "IN", flag: "🇮🇳", category: "全國" },
  { name: "The Hindu", url: "https://www.thehindu.com/feeder/default.rss", language: "en", country: "IN", flag: "🇮🇳", category: "全國" },
  { name: "Daily Star Bangladesh", url: "https://www.thedailystar.net/frontpage/rss.xml", language: "en", country: "BD", flag: "🇧🇩", category: "全國" },

  // ── Part 2: 信主新增 🇷🇺 ──
  { name: "RT Russia", url: "https://www.rt.com/rss/news/", language: "en", country: "RU", flag: "🇷🇺", category: "國際" },
  { name: "TASS", url: "https://tass.com/rss/v2.xml", language: "en", country: "RU", flag: "🇷🇺", category: "國際" },

  // ── Part 2: 非洲新增 🇰🇪🇳🇬🇿🇦 ──
  { name: "Daily Nation Kenya", url: "https://nation.africa/service/rss/kenya/1950774/feed.rss", language: "en", country: "KE", flag: "🇰🇪", category: "非洲" },
  { name: "Premium Times Nigeria", url: "https://www.premiumtimesng.com/feed", language: "en", country: "NG", flag: "🇳🇬", category: "非洲" },
  { name: "Egypt Independent", url: "https://egyptindependent.com/feed/", language: "en", country: "EG", flag: "🇪🇬", category: "非洲" },
  { name: "Daily Maverick SA", url: "https://www.dailymaverick.co.za/feed/", language: "en", country: "ZA", flag: "🇿🇦", category: "非洲" },

  // ── Part 2: 拉丁美洲新增 🇧🇷🇦🇷🇨🇴 ──
  { name: "Reuters LatAm", url: "https://www.reuters.com/arc/outboundfeeds/v3/all/?outputType=xml&size=20", language: "en", country: "US", flag: "🇺🇸", category: "拉丁美洲" },
  { name: "Buenos Aires Times", url: "https://www.batimes.com.ar/feed", language: "en", country: "AR", flag: "🇦🇷", category: "拉丁美洲" },
  { name: "Brazil Wire", url: "https://www.brasilwire.com/feed/", language: "en", country: "BR", flag: "🇧🇷", category: "拉丁美洲" },
  { name: "Merco Press", url: "https://en.mercopress.com/rss", language: "en", country: "UY", flag: "🇺🇾", category: "拉丁美洲" },
  { name: "Colombia Reports", url: "https://colombiareports.com/feed/", language: "en", country: "CO", flag: "🇨🇴", category: "拉丁美洲" },

  // ── Part 2: 大洋洲新增 🇦🇺🇳🇿 ──
  { name: "SBS Australia", url: "https://www.sbs.com.au/news/feed", language: "en", country: "AU", flag: "🇦🇺", category: "全國" },
  { name: "ABC Australia", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", language: "en", country: "AU", flag: "🇦🇺", category: "全國" },
  { name: "NZ Herald RSS", url: "https://www.nzherald.co.nz/arc/outboundfeeds/rss/curated/78/?outputType=xml", language: "en", country: "NZ", flag: "🇳🇿", category: "全國" },
  { name: "RNZ New Zealand", url: "https://www.rnz.co.nz/rss/national.xml", language: "en", country: "NZ", flag: "🇳🇿", category: "全國" },
];

// ─── Seed RSS Sources ─────────────────────────────────────────────────────────
export async function seedRssSources(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (const src of DEFAULT_RSS_SOURCES) {
    try {
      await db
        .insert(rssSources)
        .values({ ...src, isActive: 1 })
        .onDuplicateKeyUpdate({ set: { isActive: 1 } });
    } catch {
      // ignore duplicate
    }
  }
}

// ─── Fetch & Store Articles ───────────────────────────────────────────────────
export async function fetchAndStoreArticles(sourceUrl?: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get active sources
  const sources = sourceUrl
    ? await db.select().from(rssSources).where(eq(rssSources.url, sourceUrl))
    : await db.select().from(rssSources).where(eq(rssSources.isActive, 1));

  let totalStored = 0;

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      for (const item of (feed.items || []).slice(0, 20)) {
        if (!item.title || !item.link) continue;

        const article: InsertNewsArticle = {
          title: item.title.trim(),
          url: item.link,
          source: source.name,
          sourceFlag: source.flag ?? "",
          language: source.language,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        };

        try {
          await db.insert(newsArticles).values(article).onDuplicateKeyUpdate({
            set: { scrapedAt: new Date() },
          });
          totalStored++;
        } catch {
          // duplicate URL — skip
        }
      }

      // Update lastFetchedAt
      await db
        .update(rssSources)
        .set({ lastFetchedAt: new Date() })
        .where(eq(rssSources.id, source.id));
    } catch (err) {
      console.warn(`[RSS] Failed to fetch ${source.url}:`, err);
    }
  }

  return totalStored;
}

// ─── Generate Embeddings for Unprocessed Articles ────────────────────────────
export async function generateEmbeddingsForPendingArticles(limit = 50): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const pending = await db
    .select()
    .from(newsArticles)
    .where(isNull(newsArticles.embeddingVector))
    .limit(limit);

  let processed = 0;

  for (const article of pending) {
    try {
      const embedding = await getTextEmbedding(article.title + (article.titleEn ? ` ${article.titleEn}` : ""));
      await db
        .update(newsArticles)
        .set({ embeddingVector: embedding })
        .where(eq(newsArticles.id, article.id));
      processed++;
    } catch (err) {
      console.warn(`[Embed] Failed for article ${article.id}:`, err);
    }
  }

  return processed;
}

// ─── Text Embedding via LLM ───────────────────────────────────────────────────
// Uses LLM to generate a semantic summary vector representation
// Since we use the built-in invokeLLM, we simulate embeddings via structured JSON
export async function getTextEmbedding(text: string): Promise<number[]> {
  // Use LLM to extract key semantic features as a pseudo-embedding
  // In production, replace with a real embedding API (e.g., text-embedding-3-small)
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a semantic analysis engine. Given a news headline, output a JSON array of 16 float values between -1 and 1 representing the semantic vector of the text. Focus on: geopolitics, military, economy, technology, society, culture, environment, health, sports, entertainment, crime, science, business, diplomacy, conflict, humanitarian. Output ONLY the JSON array, no explanation.`,
      },
      {
        role: "user",
        content: text.slice(0, 500),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "embedding",
        strict: true,
        schema: {
          type: "object",
          properties: {
            vector: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: ["vector"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed.vector as number[];
  } catch {
    // Fallback: return zero vector
    return Array(16).fill(0);
  }
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ─── Semantic Search for Topic ────────────────────────────────────────────────
export async function semanticSearchArticles(
  queryText: string,
  limit = 30
): Promise<Array<typeof newsArticles.$inferSelect>> {
  const db = await getDb();
  if (!db) return [];

  // Get query embedding
  const queryEmbedding = await getTextEmbedding(queryText);

  // Get all articles with embeddings
  const allArticles = await db
    .select()
    .from(newsArticles)
    .where(sql`${newsArticles.embeddingVector} IS NOT NULL`)
    .orderBy(sql`${newsArticles.publishedAt} DESC`)
    .limit(500);

  // Score by cosine similarity
  const scored = allArticles
    .map((article) => {
      const vec = article.embeddingVector as number[] | null;
      const score = vec ? cosineSimilarity(queryEmbedding, vec) : 0;
      return { article, score };
    })
    .filter((item) => item.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => item.article);
}
