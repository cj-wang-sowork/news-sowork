// SoWork NewsFlow — Mock Data
// Simulates AI-processed news aggregation results

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceFlag: string;
  language: string;
  time: string;
  url?: string;
}

export interface TurningPoint {
  id: string;
  date: string;
  dateShort: string;
  title: string;
  summary: string;
  articleCount: number;
  mediaCount: number;
  heatLevel: 'low' | 'medium' | 'high' | 'extreme';
  isActive?: boolean;
  news: NewsItem[];
}

export interface Topic {
  id: string;
  query: string;
  totalArticles: number;
  totalMedia: number;
  heatLevel: 'low' | 'medium' | 'high' | 'extreme';
  lastUpdated: string;
  turningPoints: TurningPoint[];
}

export interface HotTopic {
  id: string;
  title: string;
  titleEn: string;
  articleCount: number;
  mediaCount: number;
  heatLevel: 'low' | 'medium' | 'high' | 'extreme';
  category: string;
  lastUpdate: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export const hotTopics: HotTopic[] = [
  {
    id: 'iran-war',
    title: '美以聯合空襲伊朗',
    titleEn: 'US-Israel Attack on Iran',
    articleCount: 1240,
    mediaCount: 45,
    heatLevel: 'extreme',
    category: '國際局勢',
    lastUpdate: '3 分鐘前',
    trend: 'up',
    trendPercent: 312,
  },
  {
    id: 'hormuz',
    title: '霍爾木茲海峽封鎖',
    titleEn: 'Strait of Hormuz Blockade',
    articleCount: 387,
    mediaCount: 28,
    heatLevel: 'extreme',
    category: '能源經濟',
    lastUpdate: '12 分鐘前',
    trend: 'up',
    trendPercent: 189,
  },
  {
    id: 'khamenei',
    title: '哈梅內伊身亡',
    titleEn: 'Death of Khamenei',
    articleCount: 892,
    mediaCount: 41,
    heatLevel: 'extreme',
    category: '政治外交',
    lastUpdate: '1 小時前',
    trend: 'up',
    trendPercent: 540,
  },
  {
    id: 'oil-price',
    title: '國際油價飆升',
    titleEn: 'Global Oil Price Surge',
    articleCount: 234,
    mediaCount: 19,
    heatLevel: 'high',
    category: '金融市場',
    lastUpdate: '25 分鐘前',
    trend: 'up',
    trendPercent: 78,
  },
  {
    id: 'tsmc-us',
    title: '台積電美國廠進展',
    titleEn: 'TSMC US Factory Progress',
    articleCount: 156,
    mediaCount: 14,
    heatLevel: 'high',
    category: '科技產業',
    lastUpdate: '2 小時前',
    trend: 'stable',
    trendPercent: 12,
  },
  {
    id: 'ai-regulation',
    title: 'AI 監管法案',
    titleEn: 'AI Regulation Legislation',
    articleCount: 98,
    mediaCount: 11,
    heatLevel: 'medium',
    category: '科技政策',
    lastUpdate: '4 小時前',
    trend: 'down',
    trendPercent: -8,
  },
];

export const iranTopic: Topic = {
  id: 'iran-war',
  query: '攻打伊朗',
  totalArticles: 1240,
  totalMedia: 45,
  heatLevel: 'extreme',
  lastUpdated: '2026年3月2日 14:32',
  turningPoints: [
    {
      id: 'tp1',
      date: '2025年6月13日',
      dateShort: '2025.06.13',
      title: '十二日戰爭爆發',
      summary: '以色列對伊朗核設施與軍事目標發動大規模先發制人空襲，引發為期 12 天的直接軍事衝突，雙方傷亡慘重。',
      articleCount: 320,
      mediaCount: 28,
      heatLevel: 'extreme',
      news: [
        { id: 'n1', title: '以色列重創伊朗精英，為何選在此時出手？', source: 'BBC 中文', sourceFlag: '🇬🇧', language: 'ZH', time: '2025.06.13' },
        { id: 'n2', title: 'Visualising 12 days of the Israel-Iran conflict', source: 'Al Jazeera', sourceFlag: '🇶🇦', language: 'EN', time: '2025.06.14' },
        { id: 'n3', title: '以色列大空襲伊朗：轟炸核計畫設施、擊殺參謀總長', source: '報導者', sourceFlag: '🇹🇼', language: 'ZH', time: '2025.06.13' },
        { id: 'n4', title: 'Israel launches major strikes on Iranian nuclear sites', source: 'Reuters', sourceFlag: '🇬🇧', language: 'EN', time: '2025.06.13' },
      ],
    },
    {
      id: 'tp2',
      date: '2025年12月 — 2026年1月',
      dateShort: '2025.12 — 2026.01',
      title: '伊朗爆發大規模反政府示威',
      summary: '因經濟崩潰與貨幣貶值，伊朗爆發自 1979 年以來最大規模的反政府示威，當局展開強力鎮壓，並實施全國斷網超過兩週。',
      articleCount: 185,
      mediaCount: 22,
      heatLevel: 'high',
      news: [
        { id: 'n5', title: '伊朗：哈梅內伊政權面臨新一波街頭抗議', source: 'BBC 中文', sourceFlag: '🇬🇧', language: 'ZH', time: '2025.12.29' },
        { id: 'n6', title: 'Internet shut down across Iran as protests spread', source: 'Al Jazeera', sourceFlag: '🇶🇦', language: 'EN', time: '2026.01.08' },
        { id: 'n7', title: '伊朗全國斷網，抗議浪潮蔓延至農村', source: '自由亞洲電台', sourceFlag: '🇺🇸', language: 'ZH', time: '2026.01.10' },
      ],
    },
    {
      id: 'tp3',
      date: '2026年2月6日 — 2月27日',
      dateShort: '2026.02.06 — 02.27',
      title: '美伊核談判重啟與破裂',
      summary: '美國與伊朗在阿曼斡旋下於日內瓦展開三輪間接核談判，阿曼稱「取得重大進展」，但最終未能達成突破，美國警告「所有選項」皆在桌上。',
      articleCount: 142,
      mediaCount: 19,
      heatLevel: 'high',
      news: [
        { id: 'n8', title: '美伊在日內瓦展開間接核談判，阿曼居中斡旋', source: '聯合報', sourceFlag: '🇹🇼', language: 'ZH', time: '2026.02.06' },
        { id: 'n9', title: 'Iran and US begin indirect nuclear talks in Geneva', source: 'Al Jazeera', sourceFlag: '🇶🇦', language: 'EN', time: '2026.02.06' },
        { id: 'n10', title: '第三輪核談判結束，阿曼稱「取得重大進展」', source: '中央社', sourceFlag: '🇹🇼', language: 'ZH', time: '2026.02.26' },
        { id: 'n11', title: 'Trump warns "all options on the table" as Iran talks stall', source: 'Reuters', sourceFlag: '🇬🇧', language: 'EN', time: '2026.02.27' },
      ],
    },
    {
      id: 'tp4',
      date: '2026年2月28日 — 3月1日',
      dateShort: '2026.02.28',
      title: '美以聯合空襲 + 哈梅內伊身亡',
      summary: '美國與以色列對伊朗發動代號「史詩狂怒」的聯合空襲，成功擊斃統治伊朗近 37 年的最高領袖哈梅內伊，目標直指政權更迭。伊朗隨即展開大規模報復。',
      articleCount: 450,
      mediaCount: 45,
      heatLevel: 'extreme',
      isActive: true,
      news: [
        { id: 'n12', title: '哈梅內伊身亡｜美以斬首行動開啟伊朗變天三種可能', source: '香港01', sourceFlag: '🇭🇰', language: 'ZH', time: '2026.03.01' },
        { id: 'n13', title: 'Iran confirms killing of Khamenei in US-Israel attacks', source: 'Al Jazeera', sourceFlag: '🇶🇦', language: 'EN', time: '2026.03.01' },
        { id: 'n14', title: '分析：押注伊朗政權更迭可能是特朗普迄今最大的豪賭', source: 'BBC 中文', sourceFlag: '🇬🇧', language: 'ZH', time: '2026.03.01' },
        { id: 'n15', title: 'Trump says major combat operations in Iran have begun', source: 'Reuters', sourceFlag: '🇬🇧', language: 'EN', time: '2026.02.28' },
        { id: 'n16', title: '伊朗最高領袖遭斬首，德黑蘭同時出現哀悼與慶祝人群', source: '報導者', sourceFlag: '🇹🇼', language: 'ZH', time: '2026.03.01' },
      ],
    },
    {
      id: 'tp5',
      date: '2026年3月1日 — 至今',
      dateShort: '2026.03.01',
      title: '伊朗封鎖霍爾木茲海峽',
      summary: '伊朗革命衛隊宣布封鎖全球石油咽喉霍爾木茲海峽，全球五分之一的石油運輸受阻，國際油價飆升，分析師警告可能重演 1970 年代石油危機。',
      articleCount: 143,
      mediaCount: 25,
      heatLevel: 'extreme',
      isActive: true,
      news: [
        { id: 'n17', title: '伊朗革命衛隊封鎖霍爾木茲海峽！油輪全面停航', source: 'Yahoo 財經', sourceFlag: '🇺🇸', language: 'ZH', time: '2026.03.01' },
        { id: 'n18', title: '$100 oil? Prolonged Hormuz closure could spark a 1970s-style crisis', source: 'CNBC', sourceFlag: '🇺🇸', language: 'EN', time: '2026.03.01' },
        { id: 'n19', title: '王毅警告戰事延燒整個波斯灣', source: '聯合早報', sourceFlag: '🇸🇬', language: 'ZH', time: '2026.03.02' },
        { id: 'n20', title: 'Oil Shipments in Persian Gulf Already Disrupted by Iran', source: 'New York Times', sourceFlag: '🇺🇸', language: 'EN', time: '2026.02.28' },
      ],
    },
  ],
};

export const suggestedTopics = [
  '攻打伊朗',
  '台積電赴美',
  'AI 監管法案',
  '霍爾木茲海峽',
  '哈梅內伊身亡',
  '烏克蘭停火',
];

export const aiStanceExamples = [
  { role: '國防部發言人', icon: '🎖️' },
  { role: '肯德基公關部門', icon: '🍗' },
  { role: '石油公司 CEO', icon: '⛽' },
  { role: '以色列外交部', icon: '🇮🇱' },
  { role: '聯合國秘書長', icon: '🌐' },
  { role: '台灣外交部', icon: '🇹🇼' },
];
