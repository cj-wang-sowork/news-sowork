/*
 * Home Page — SoWork NewsFlow
 * Design: Narrative Pulse | Hero search + Hot topics grid
 * Layout: Asymmetric hero (left 50% text, right 50% world map bg) + card grid below
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, TrendingUp, TrendingDown, Minus, ArrowRight, Flame, Newspaper, Radio, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { hotTopics, suggestedTopics } from '@/lib/mockData';

type HeatLevel = 'extreme' | 'high' | 'medium' | 'low';
type TrendDir = 'up' | 'down' | 'stable';

interface TopicCardData {
  id: number | string;
  slug: string;
  query: string;
  category?: string | null;
  heatLevel: HeatLevel;
  trendDirection: TrendDir;
  trendPercent: number;
  totalArticles: number;
  totalMedia: number;
  lastUpdated: Date | string;
}

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/hero-bg-XfwRB5Ntc2dAJmMgdEDPA7.webp';
const WORLD_MAP_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/world-map-bg-MzGU8tBRSD7zZ2Q542weKJ.webp';

function HeatBadge({ level }: { level: HeatLevel }) {
  const config = {
    extreme: { label: '極高熱度', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
    high: { label: '高熱度', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    medium: { label: '中熱度', bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-500' },
    low: { label: '低熱度', bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  };
  const c = config[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${level === 'extreme' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

function TrendIcon({ trend, percent }: { trend: TrendDir; percent: number }) {
  if (trend === 'up') return (
    <span className="flex items-center gap-0.5 text-xs text-red-500 font-semibold">
      <TrendingUp className="w-3 h-3" />+{percent}%
    </span>
  );
  if (trend === 'down') return (
    <span className="flex items-center gap-0.5 text-xs text-green-600 font-semibold">
      <TrendingDown className="w-3 h-3" />{percent}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs text-gray-400 font-medium">
      <Minus className="w-3 h-3" />持平
    </span>
  );
}

function TopicCard({ topic, index }: { topic: TopicCardData; index: number }) {
  const [, navigate] = useLocation();
  const delay = index * 80;

  return (
    <div
      className="fade-up opacity-0 bg-white rounded-2xl border border-border p-5 hover:border-[#FF5A1F]/30 hover:shadow-lg transition-all duration-300 cursor-pointer group"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
      onClick={() => navigate(`/timeline/${topic.slug}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{topic.category ?? '國際'}</span>
          <h3 className="font-display font-700 text-[15px] text-foreground mt-0.5 leading-snug group-hover:text-[#FF5A1F] transition-colors line-clamp-2"
            style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif', fontWeight: 700 }}>
            {topic.query}
          </h3>
        </div>
        <HeatBadge level={topic.heatLevel} />
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
            {topic.totalArticles.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">篇報導</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
            {topic.totalMedia}
          </span>
          <span className="text-xs text-muted-foreground">家媒體</span>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: Math.min(topic.totalMedia, 20) }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: i < Math.ceil(topic.totalMedia * 0.6) ? '#FF5A1F' : '#E8E8E8' }}
          />
        ))}
        {topic.totalMedia > 20 && <span className="text-xs text-muted-foreground ml-1">+{topic.totalMedia - 20}</span>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendIcon trend={topic.trendDirection} percent={topic.trendPercent} />
          <span className="text-xs text-muted-foreground">
            {typeof topic.lastUpdated === 'string' ? topic.lastUpdated : new Date(topic.lastUpdated).toLocaleDateString('zh-TW')}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FF5A1F] group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [topicIndex, setTopicIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, navigate] = useLocation();

  // Typing animation for placeholder
  useEffect(() => {
    const current = suggestedTopics[topicIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < current.length) {
          setPlaceholder(current.slice(0, charIndex + 1));
          setCharIndex(c => c + 1);
        } else {
          setTimeout(() => setIsDeleting(true), 1800);
        }
      } else {
        if (charIndex > 0) {
          setPlaceholder(current.slice(0, charIndex - 1));
          setCharIndex(c => c - 1);
        } else {
          setIsDeleting(false);
          setTopicIndex(i => (i + 1) % suggestedTopics.length);
        }
      }
    }, isDeleting ? 60 : 100);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, topicIndex]);

  // Fetch real hot topics from API
  const { data: apiTopics, isLoading: topicsLoading } = trpc.topics.hot.useQuery({ limit: 12 });

  // Create or find topic mutation for search
  const createOrFind = trpc.topics.createOrFind.useMutation({
    onSuccess: (data) => {
      navigate(`/timeline/${data.slug}`);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      createOrFind.mutate({ query: query.trim() });
    }
  };

  // Use real API data if available, fallback to mock
  const displayTopics: TopicCardData[] = (apiTopics && apiTopics.length > 0)
    ? apiTopics.map(t => ({
        id: t.id,
        slug: t.slug,
        query: t.query,
        category: t.category,
        heatLevel: t.heatLevel,
        trendDirection: t.trendDirection,
        trendPercent: t.trendPercent,
        totalArticles: t.totalArticles,
        totalMedia: t.totalMedia,
        lastUpdated: t.lastUpdated,
      }))
    : hotTopics.map(t => ({
        id: t.id,
        slug: 'iran-war',
        query: t.title,
        category: t.category,
        heatLevel: t.heatLevel,
        trendDirection: t.trend === 'up' ? 'up' as TrendDir : t.trend === 'down' ? 'down' as TrendDir : 'stable' as TrendDir,
        trendPercent: t.trendPercent,
        totalArticles: t.articleCount,
        totalMedia: t.mediaCount,
        lastUpdated: t.lastUpdate,
      }));

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FAFAFA] via-[#FAFAFA]/80 to-[#FAFAFA]/40" />

        <div className="relative container py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text + Search */}
            <div className="fade-up opacity-0" style={{ animationFillMode: 'forwards' }}>
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-full px-3 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Live — 持續更新中</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight mb-4"
                style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                看見新聞的
                <span className="text-[#FF5A1F] block">演變脈絡</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md" style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                AI 自動聚合全球新聞，標記重大轉折點，讓你在 30 秒內掌握一個事件的完整演變——而不是淹沒在千篇報導中。
              </p>

              {/* Search Box */}
              <form onSubmit={handleSearch} className="relative">
                <div className="flex items-center bg-white rounded-2xl border-2 border-border focus-within:border-[#FF5A1F] shadow-sm transition-all duration-200 overflow-hidden">
                  <Search className="w-5 h-5 text-muted-foreground ml-4 flex-shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={query ? '' : placeholder || '輸入你想追蹤的事件...'}
                    className="flex-1 px-3 py-4 text-base bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 typing-cursor"
                    style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                  />
                  <Button
                    type="submit"
                    disabled={createOrFind.isPending}
                    className="m-1.5 bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold rounded-xl px-5 py-2.5 h-auto shadow-sm disabled:opacity-70"
                  >
                    {createOrFind.isPending ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 分析中
                      </span>
                    ) : '追蹤'}
                  </Button>
                </div>
              </form>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 mt-4">
                {suggestedTopics.slice(0, 4).map(t => (
                  <button
                    key={t}
                    onClick={() => { setQuery(t); createOrFind.mutate({ query: t }); }}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-border text-muted-foreground hover:border-[#FF5A1F] hover:text-[#FF5A1F] transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: World Map */}
            <div className="hidden md:block fade-up opacity-0 stagger-2" style={{ animationFillMode: 'forwards' }}>
              <div className="relative rounded-3xl overflow-hidden bg-white border border-border shadow-lg">
                <img
                  src={WORLD_MAP_BG}
                  alt="全球新聞熱度地圖"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">全球新聞熱度分佈</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#FF5A1F]" />
                      <span className="text-xs text-muted-foreground">高熱度區域</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="text-xs text-muted-foreground">一般區域</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="bg-white border-y border-border">
        <div className="container py-4">
          <div className="flex items-center gap-8 overflow-x-auto">
            {[
              { label: '今日追蹤話題', value: '1,847', unit: '個' },
              { label: '覆蓋媒體來源', value: '2,300+', unit: '家' },
              { label: '支援語言', value: '42', unit: '種' },
              { label: '即時更新', value: '每 15 分鐘', unit: '' },
            ].map(stat => (
              <div key={stat.label} className="flex-shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>{stat.value}</span>
                  {stat.unit && <span className="text-sm text-muted-foreground">{stat.unit}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hot Topics Section */}
      <section className="container py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-[#FF5A1F]" />
              <h2 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                全球熱門話題
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">依「媒體家數 × 篇數」即時排序，每 15 分鐘更新</p>
          </div>
          <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground hidden md:flex items-center gap-1" onClick={() => alert('Feature coming soon')}>
            查看全部 <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {topicsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-100 rounded mb-2 w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayTopics.map((topic, i) => (
              <TopicCard key={String(topic.id)} topic={topic} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#FF5A1F] flex items-center justify-center">
                <span className="text-white text-xs font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>S</span>
              </div>
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>NewsFlow <span className="font-normal text-muted-foreground">by SoWork</span></span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © 2026 SoWork AI · NewsFlow. 新聞資料由 AI 自動聚合，不代表本平台立場。
            </p>
            <div className="flex items-center gap-4">
              {['關於我們', '隱私政策', '服務條款'].map(link => (
                <button key={link} className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => alert('Feature coming soon')}>
                  {link}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
