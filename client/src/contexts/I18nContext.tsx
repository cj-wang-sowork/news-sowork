/**
 * I18nContext — 多語言支援
 * 自動偵測 navigator.language，支援繁中 (zh-TW)、簡中 (zh-CN)、英文 (en)
 * 可手動切換並儲存至 localStorage
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';

// ─── Translation dictionary ────────────────────────────────────────────────────
const translations: Record<Locale, Record<string, string>> = {
  'zh-TW': {
    // Navbar
    'nav.explore': '探索話題',
    'nav.saved': '已追蹤',
    'nav.login': '登入',
    'nav.logout': '登出',
    'nav.points': '點',

    // Home
    'home.hero.badge': 'Live — 持續更新中',
    'home.hero.title1': '看見新聞的',
    'home.hero.title2': '演變脈絡',
    'home.hero.subtitle': 'AI 自動聚合全球新聞，標記重大轉折點，讓你在 30 秒內掌握一個事件的完整演變——而不是淹沒在千篇報導中。',
    'home.search.placeholder': '輸入你想追蹤的事件...',
    'home.search.button': '追蹤',
    'home.stats.topics': '今日追蹤話題',
    'home.stats.topics_unit': '個',
    'home.stats.media': '覆蓋媒體來源',
    'home.stats.media_unit': '家',
    'home.stats.languages': '支援語言',
    'home.stats.languages_unit': '種',
    'home.stats.update': '即時更新',
    'home.stats.update_unit': '每 15 分鐘',
    'home.hot.title': '全球熱門話題',
    'home.hot.subtitle': '依「媒體家數 × 篇數」即時排序，每 15 分鐘更新',
    'home.hot.viewAll': '查看全部',
    'home.card.articles': '篇報導',
    'home.card.media': '家媒體',

    // Timeline
    'timeline.back': '返回探索話題',
    'timeline.tracking': '追蹤主題',
    'timeline.live': '即時更新',
    'timeline.lastUpdate': '最後更新：',
    'timeline.articles': '篇報導',
    'timeline.media': '家媒體',
    'timeline.turningPoints': '個轉折點',
    'timeline.follow': '追蹤此議題',
    'timeline.following': '已追蹤',
    'timeline.notifyOn': '🔔 通知已開',
    'timeline.notifyOff': '🔕 開啟通知',
    'timeline.collecting': '正在收集相關新語',
    'timeline.collectTarget': '目標：至少 50 篇才能建立完整時間軸',
    'timeline.collectUnit': '篇',
    'timeline.autoUpdate': '每 10 秒自動更新──系統正在背景搜尋台灣、香港、英文新語來源',
    'timeline.empty.title': '正在收集新語中',
    'timeline.empty.subtitle': 'AI 將從中分析轉折點',
    'timeline.ai.button': 'AI 立場回覆建議',
    'timeline.ai.title': 'AI 立場回覆建議',
    'timeline.ai.subtitle': '根據此轉折點，AI 將為你生成對應的立場聲明',

    // Footer
    'footer.rights': '© 2026 SoWork AI · NewsFlow. 新聞資料由 AI 自動聚合，不代表本平台立場。',
    'footer.about': '關於我們',
    'footer.privacy': '隱私政策',
    'footer.terms': '服務條款',
  },
  'zh-CN': {
    // Navbar
    'nav.explore': '探索话题',
    'nav.saved': '已追踪',
    'nav.login': '登录',
    'nav.logout': '退出',
    'nav.points': '点',

    // Home
    'home.hero.badge': 'Live — 持续更新中',
    'home.hero.title1': '看见新闻的',
    'home.hero.title2': '演变脉络',
    'home.hero.subtitle': 'AI 自动聚合全球新闻，标记重大转折点，让你在 30 秒内掌握一个事件的完整演变——而不是淹没在千篇报道中。',
    'home.search.placeholder': '输入你想追踪的事件...',
    'home.search.button': '追踪',
    'home.stats.topics': '今日追踪话题',
    'home.stats.topics_unit': '个',
    'home.stats.media': '覆盖媒体来源',
    'home.stats.media_unit': '家',
    'home.stats.languages': '支持语言',
    'home.stats.languages_unit': '种',
    'home.stats.update': '实时更新',
    'home.stats.update_unit': '每 15 分钟',
    'home.hot.title': '全球热门话题',
    'home.hot.subtitle': '依「媒体家数 × 篇数」实时排序，每 15 分钟更新',
    'home.hot.viewAll': '查看全部',
    'home.card.articles': '篇报道',
    'home.card.media': '家媒体',

    // Timeline
    'timeline.back': '返回探索话题',
    'timeline.tracking': '追踪主题',
    'timeline.live': '实时更新',
    'timeline.lastUpdate': '最后更新：',
    'timeline.articles': '篇报道',
    'timeline.media': '家媒体',
    'timeline.turningPoints': '个转折点',
    'timeline.follow': '追踪此话题',
    'timeline.following': '已追踪',
    'timeline.notifyOn': '🔔 通知已开',
    'timeline.notifyOff': '🔕 开启通知',
    'timeline.collecting': '正在收集相关新闻',
    'timeline.collectTarget': '目标：至少 50 篇才能建立完整时间轴',
    'timeline.collectUnit': '篇',
    'timeline.autoUpdate': '每 10 秒自动更新──系统正在后台搜索相关新闻来源',
    'timeline.empty.title': '正在收集新闻中',
    'timeline.empty.subtitle': 'AI 将从中分析转折点',
    'timeline.ai.button': 'AI 立场回复建议',
    'timeline.ai.title': 'AI 立场回复建议',
    'timeline.ai.subtitle': '根据此转折点，AI 将为你生成对应的立场声明',

    // Footer
    'footer.rights': '© 2026 SoWork AI · NewsFlow. 新闻资料由 AI 自动聚合，不代表本平台立场。',
    'footer.about': '关于我们',
    'footer.privacy': '隐私政策',
    'footer.terms': '服务条款',
  },
  'en': {
    // Navbar
    'nav.explore': 'Explore',
    'nav.saved': 'Saved',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.points': 'pts',

    // Home
    'home.hero.badge': 'Live — Continuously Updated',
    'home.hero.title1': 'See the News',
    'home.hero.title2': 'Evolve Over Time',
    'home.hero.subtitle': 'AI aggregates global news, marks major turning points, and helps you grasp the full story in 30 seconds—without drowning in thousands of articles.',
    'home.search.placeholder': 'Enter the event you want to track...',
    'home.search.button': 'Track',
    'home.stats.topics': 'Topics Today',
    'home.stats.topics_unit': '',
    'home.stats.media': 'Media Sources',
    'home.stats.media_unit': '',
    'home.stats.languages': 'Languages',
    'home.stats.languages_unit': '',
    'home.stats.update': 'Real-time Updates',
    'home.stats.update_unit': 'Every 15 min',
    'home.hot.title': 'Trending Topics',
    'home.hot.subtitle': 'Ranked by media coverage × article count, updated every 15 min',
    'home.hot.viewAll': 'View All',
    'home.card.articles': 'articles',
    'home.card.media': 'media',

    // Timeline
    'timeline.back': 'Back to Explore',
    'timeline.tracking': 'Tracking',
    'timeline.live': 'Live',
    'timeline.lastUpdate': 'Last updated: ',
    'timeline.articles': 'articles',
    'timeline.media': 'media',
    'timeline.turningPoints': 'turning points',
    'timeline.follow': 'Follow Topic',
    'timeline.following': 'Following',
    'timeline.notifyOn': '🔔 Notify On',
    'timeline.notifyOff': '🔕 Enable Notify',
    'timeline.collecting': 'Collecting related news',
    'timeline.collectTarget': 'Goal: at least 50 articles to build a complete timeline',
    'timeline.collectUnit': 'articles',
    'timeline.autoUpdate': 'Auto-updating every 10s — searching news sources in the background',
    'timeline.empty.title': 'Collecting News',
    'timeline.empty.subtitle': 'AI will analyze turning points from the collected articles',
    'timeline.ai.button': 'AI Stance Suggestions',
    'timeline.ai.title': 'AI Stance Suggestions',
    'timeline.ai.subtitle': 'AI will generate a stance statement based on this turning point',

    // Footer
    'footer.rights': '© 2026 SoWork AI · NewsFlow. News is aggregated by AI and does not represent the platform\'s position.',
    'footer.about': 'About',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
  },
};

// ─── Locale detection ─────────────────────────────────────────────────────────
function detectLocale(): Locale {
  // 1. Check localStorage override
  try {
    const stored = localStorage.getItem('newsflow_locale') as Locale | null;
    if (stored && ['zh-TW', 'zh-CN', 'en'].includes(stored)) return stored;
  } catch { /* ignore */ }

  // 2. Detect from browser language
  const lang = navigator.language || 'zh-TW';
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant')) return 'zh-TW';
  if (lang.startsWith('zh-CN') || lang.startsWith('zh-Hans') || lang === 'zh') return 'zh-CN';
  if (lang.startsWith('en')) return 'en';

  // 3. Default to zh-TW
  return 'zh-TW';
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-TW',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem('newsflow_locale', newLocale); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[locale][key] ?? translations['zh-TW'][key] ?? fallback ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
