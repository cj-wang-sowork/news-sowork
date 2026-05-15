export type SurfaceKey = 'global' | 'politics' | 'brand' | 'invest';

export interface SurfaceConfig {
  key: SurfaceKey;
  path: string;
  navLabel: string;
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  searchPlaceholder: string;
  suggestedTopics: string[];
}

export const SURFACE_PRIORITY: SurfaceKey[] = ['politics', 'brand', 'invest'];

export const SURFACE_CONFIGS: Record<SurfaceKey, SurfaceConfig> = {
  global: {
    key: 'global',
    path: '/',
    navLabel: '總覽',
    heroEyebrow: 'Global News Intelligence',
    heroTitle: '看見新聞的',
    heroAccent: '演變脈絡',
    heroDescription:
      'AI 自動聚合全球新聞，標記重大轉折點，讓你在 30 秒內掌握一個事件的完整演變——而不是淹沒在千篇報導中。',
    searchPlaceholder: '輸入你想追蹤的事件...',
    suggestedTopics: ['攻打伊朗', '台積電赴美', 'AI 監管法案', '霍爾木茲海峽', '哈梅內伊身亡', '烏克蘭停火'],
  },
  politics: {
    key: 'politics',
    path: '/politics',
    navLabel: '政治',
    heroEyebrow: 'Priority 01 · Politics',
    heroTitle: '先看政治，',
    heroAccent: '再讀後果',
    heroDescription:
      '從選舉、兩岸、國際衝突到政策攻防，先抓權力移動，再判斷輿論與資本會往哪裡走。',
    searchPlaceholder: '搜尋政治、政策、國際衝突議題...',
    suggestedTopics: ['美中關稅談判', '台海軍演', '美國大選辯論', '國會改革法案', '烏克蘭停火', '中東停火協議'],
  },
  brand: {
    key: 'brand',
    path: '/brand',
    navLabel: '品牌',
    heroEyebrow: 'Priority 02 · Brand',
    heroTitle: '品牌要知道，',
    heroAccent: '輿論往哪裡吹',
    heroDescription:
      '把時事轉成品牌反應速度：哪些話題能借勢、哪些風險要避開、哪些受眾情緒正在升溫。',
    searchPlaceholder: '搜尋品牌、公關、消費趨勢議題...',
    suggestedTopics: ['Labubu 全球熱潮', '星巴克漲價策略', 'Threads 演算法更新', 'AI 手機大戰', '旅遊報復性消費', '永續漂綠爭議'],
  },
  invest: {
    key: 'invest',
    path: '/invest',
    navLabel: '投資',
    heroEyebrow: 'Priority 03 · Investment',
    heroTitle: '投資不是追新聞，',
    heroAccent: '是追變化速度',
    heroDescription:
      '把地緣政治、產業鏈與資金風向串起來，快速判斷哪些事件正在重估市場預期。',
    searchPlaceholder: '搜尋產業、資產、總經議題...',
    suggestedTopics: ['輝達財報', '聯準會降息路徑', '台積電資本支出', '黃金價格創高', '油價飆升', '比特幣 ETF 資金流'],
  },
};

export const SURFACE_NAV_ITEMS = SURFACE_PRIORITY.map((key) => SURFACE_CONFIGS[key]);

export function getSurfaceConfig(surface: SurfaceKey = 'global'): SurfaceConfig {
  return SURFACE_CONFIGS[surface] ?? SURFACE_CONFIGS.global;
}
