/*
 * Home Page — SoWork NewsFlow
 * Design: Narrative Pulse | Hero search + Hot topics grid
 * Layout: Asymmetric hero (left 50% text, right 50% world map bg) + card grid below
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Search, TrendingUp, TrendingDown, Minus, ArrowRight, Flame,
  Newspaper, Radio, Loader2, Plus, Coins, Eye, Lock, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { suggestedTopics } from '@/lib/mockData';

/** 計算相對時間字串 */
function timeAgo(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '剛剛更新';
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} 個月前`;
  return `${Math.floor(diffMonths / 12)} 年前`;
}

type HeatLevel = 'extreme' | 'high' | 'medium' | 'low';
type TrendDir = 'up' | 'down' | 'stable';

interface TopicCardData {
  id: number | string;
  slug: string;
  query: string;
  category?: string | null;
  tags?: string[] | null;
  heatLevel: HeatLevel;
  trendDirection: TrendDir;
  trendPercent: number;
  totalArticles: number;
  totalMedia: number;
  viewCount?: number;
  lastUpdated: Date | string | null;
  creatorId?: number | null;
}

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/hero-bg-XfwRB5Ntc2dAJmMgdEDPA7.webp';
const WORLD_MAP_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/world-map-bg-MzGU8tBRSD7zZ2Q542weKJ.webp';

const CATEGORIES = ['全部', '地緣政治', '科技', '氣候', '財經', '政治', '社會', '健康', '太空', '能源'];

const CATEGORY_COLORS: Record<string, string> = {
  '地緣政治': 'bg-red-50 text-red-700 border-red-100',
  '科技': 'bg-blue-50 text-blue-700 border-blue-100',
  '氣候': 'bg-green-50 text-green-700 border-green-100',
  '財經': 'bg-yellow-50 text-yellow-700 border-yellow-100',
  '政治': 'bg-purple-50 text-purple-700 border-purple-100',
  '社會': 'bg-pink-50 text-pink-700 border-pink-100',
  '健康': 'bg-teal-50 text-teal-700 border-teal-100',
  '太空': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  '能源': 'bg-orange-50 text-orange-700 border-orange-100',
};

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

function TopicCard({ topic, index, onTagClick }: { topic: TopicCardData; index: number; onTagClick?: (tag: string) => void }) {
  const [, navigate] = useLocation();
  const delay = index * 60;
  const catColor = topic.category ? CATEGORY_COLORS[topic.category] : undefined;

  return (
    <div
      className="fade-up opacity-0 bg-white rounded-2xl border border-border p-5 hover:border-[#FF5A1F]/30 hover:shadow-lg transition-all duration-300 cursor-pointer group"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
      onClick={() => navigate(`/timeline/${topic.slug}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {topic.category && (
            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border mb-1 ${catColor ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
              {topic.category}
            </span>
          )}
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
        {(topic.viewCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              {topic.viewCount}
            </span>
          </div>
        )}
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

      {/* Tags — click to filter */}
      {topic.tags && topic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {topic.tags.slice(0, 3).map(tag => (
            <button
              key={tag}
              onClick={(e) => { e.stopPropagation(); onTagClick?.(tag); }}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#FF5A1F] transition-colors cursor-pointer"
            >
              <Tag className="w-2.5 h-2.5" />{tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendIcon trend={topic.trendDirection} percent={topic.trendPercent} />
          <span className="text-xs text-muted-foreground">
            {timeAgo(topic.lastUpdated)}
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
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Typing animation for placeholder
  useEffect(() => {
    const current = suggestedTopics[topicIndex];
    if (!current) return;
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

  // Fetch real hot topics from API (limit 50)
  const { data: apiTopics, isLoading: topicsLoading } = trpc.topics.hot.useQuery({ limit: 50 });

  // Fetch real stats (public API)
  const { data: siteStats } = trpc.topics.stats.useQuery();

  // Fetch all tags for filter
  const { data: allTagsData } = trpc.topics.allTags.useQuery();

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

  // Map API data to card format
  const allTopics: TopicCardData[] = useMemo(() => (apiTopics ?? []).map(t => {
    let parsedTags: string[] = [];
    if (t.tags) {
      try {
        const raw = typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags;
        if (Array.isArray(raw)) parsedTags = raw.filter((x): x is string => typeof x === 'string');
      } catch { /* ignore */ }
    }
    return {
      id: t.id,
      slug: t.slug,
      query: t.query,
      category: t.category,
      tags: parsedTags,
      heatLevel: t.heatLevel as HeatLevel,
      trendDirection: t.trendDirection as TrendDir,
      trendPercent: t.trendPercent,
      totalArticles: t.totalArticles,
      totalMedia: t.totalMedia,
      viewCount: t.viewCount,
      lastUpdated: t.lastUpdated,
      creatorId: t.creatorId,
    };
  }), [apiTopics]);

  // Filter by category and tag
  const filteredTopics = useMemo(() => {
    let result = selectedCategory === '全部'
      ? allTopics
      : allTopics.filter(t => t.category === selectedCategory);
    if (selectedTag) {
      result = result.filter(t => t.tags?.includes(selectedTag));
    }
    return result;
  }, [allTopics, selectedCategory, selectedTag]);

  const displayTopics = showAll ? filteredTopics : filteredTopics.slice(0, 24);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FAFAFA] via-[#FAFAFA]/80 to-[#FAFAFA]/40" />

        <div className="relative container py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text + Search */}
            <div className="fade-up opacity-0" style={{ animationFillMode: 'forwards' }}>
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
              { label: '追蹤話題', value: siteStats ? siteStats.topicCount.toLocaleString() : '—', unit: '個' },
              { label: '已入庫新聞', value: siteStats ? siteStats.articleCount.toLocaleString() : '—', unit: '篇' },
              { label: 'RSS 新聞來源', value: siteStats ? (siteStats.rssSourceCount > 0 ? siteStats.rssSourceCount.toLocaleString() : '202') : '202', unit: '個' },
              { label: '支援語言', value: '10+', unit: '種' },
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

      {/* Points CTA Banner — 未登入時顯示 */}
      {!user && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
          <div className="container py-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF5A1F] flex items-center justify-center flex-shrink-0">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">建立議題，分享你的觀點！</p>
                  <p className="text-xs text-muted-foreground">登入後可免費建立公開議題，讓 AI 幫你追蹤事件演變。</p>
                </div>
              </div>
              <Button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold flex-shrink-0"
                size="sm"
              >
                免費登入
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hot Topics Section */}
      <section id="topics-section" className="container py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-[#FF5A1F]" />
              <h2 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                全球熱門話題
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">依「媒體家數 × 篇數」即時排序，每 15 分鐘更新</p>
          </div>
          {user && (
            <Button
              onClick={() => navigate('/create-topic')}
              size="sm"
              className="hidden md:flex items-center gap-1.5 bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
            >
              <Plus className="w-4 h-4" />
              建立議題
            </Button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setSelectedTag(null); setShowAll(false); }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                  : 'bg-white text-muted-foreground border-border hover:border-[#FF5A1F] hover:text-[#FF5A1F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>


        {topicsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-100 rounded mb-2 w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : displayTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FF5A1F]/10 flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-[#FF5A1F]" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
              {selectedTag
                ? `尚無「${selectedTag}」標籤的話題`
                : selectedCategory === '全部' ? '尚無熱門話題' : `尚無「${selectedCategory}」分類的話題`}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              先在上方搜尋框輸入一個主題，AI 就會自動建立時間軸並加入排行！
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayTopics.map((topic, i) => (
                <TopicCard
                  key={String(topic.id)}
                  topic={topic}
                  index={i}
                  onTagClick={(tag) => {
                    setSelectedTag(tag);
                    setSelectedCategory('全部');
                    setShowAll(false);
                    // 滚動到議題區塊
                    document.getElementById('topics-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              ))}
            </div>

            {/* Show More / Create CTA */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {filteredTopics.length > 24 && !showAll && (
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="flex items-center gap-2 border-border text-muted-foreground hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
                >
                  查看全部 {filteredTopics.length} 個議題
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {user ? (
                <Button
                  onClick={() => navigate('/create-topic')}
                  className="flex items-center gap-2 bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
                >
                  <Plus className="w-4 h-4" />
                  建立你自己的議題
                </Button>
              ) : (
                <Button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  variant="outline"
                  className="flex items-center gap-2 border-[#FF5A1F] text-[#FF5A1F] hover:bg-orange-50"
                >
                  <Lock className="w-4 h-4" />
                  登入後建立議題
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {/* SoWork.ai CTA Banner */}
      <section className="bg-gradient-to-r from-[#FF5A1F] to-[#e04d18]">
        <div className="container py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="text-white/80 text-sm font-medium mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>時事軸由 SoWork.ai 打造</p>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                想知道我們還做了什麼？
              </h2>
              <p className="text-white/80 text-sm mt-2 max-w-md">
                SoWork.ai 打造 AI 工作工具，幫助團隊更聪明地工作。時事軸是我們的新聞智慧層。
              </p>
            </div>
            <a
              href="https://tw.sowork.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 bg-white text-[#FF5A1F] font-bold px-8 py-3.5 rounded-2xl hover:bg-orange-50 transition-all shadow-lg text-base"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              前往 SoWork.ai ↗
            </a>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="bg-white border-t border-border">
        <div className="container py-14">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#FF5A1F] animate-pulse" />
              <span className="text-xs font-semibold text-[#FF5A1F] uppercase tracking-wide">努力開發中</span>
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
              更多功能即將推出
            </h2>
            <p className="text-sm text-muted-foreground">我們正在努力打造更好的 NewsFlow 體驗</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Plus className="w-6 h-6 text-[#FF5A1F]" />,
                title: '建立公開議題',
                desc: '登入後免費建立議題，選擇公開讓所有人瀏覽',
                badge: '現已開放',
                badgeColor: 'bg-green-50 text-green-700',
                active: true,
              },
              {
                icon: <Eye className="w-6 h-6 text-muted-foreground" />,
                title: '創作者回饋機制',
                desc: '優質議題創作者將獲得回饋獎勵，鼓勵高品質內容產出',
                badge: '開發中',
                badgeColor: 'bg-gray-100 text-gray-500',
                active: false,
              },
              {
                icon: <Coins className="w-6 h-6 text-muted-foreground" />,
                title: '進階 AI 功能',
                desc: '更強大的 AI 分析、個人化推薦與深度報告功能即將推出',
                badge: '開發中',
                badgeColor: 'bg-gray-100 text-gray-500',
                active: false,
              },
            ].map((item, i) => (
              <div key={i} className={`flex flex-col items-center text-center p-6 rounded-2xl border transition-colors ${
                item.active ? 'border-[#FF5A1F]/20 hover:border-[#FF5A1F]/40' : 'border-border opacity-60'
              }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  item.active ? 'bg-[#FF5A1F]/10' : 'bg-gray-100'
                }`}>
                  {item.icon}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <h3 className="font-bold text-foreground mb-2" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          {!user && (
            <div className="text-center mt-8">
              <Button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold px-8"
              >
                立即免費登入，搶先體驗
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* 品牌區 */}
            <div className="flex items-center gap-2">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/sowork-icon-single_b50b43e6.png"
                alt="SoWork.ai"
                className="w-6 h-6 object-contain"
              />
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                時事軸
                <span className="font-normal text-muted-foreground"> by </span>
                <a
                  href="https://tw.sowork.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF5A1F] hover:underline font-medium"
                >
                  SoWork.ai
                </a>
              </span>
            </div>
            {/* 版權聲明 */}
            <p className="text-xs text-muted-foreground text-center">
              © 2026 
              <a href="https://tw.sowork.ai" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF5A1F] transition-colors">
                SoWork.ai
              </a>
               · 時事軸。新聞資料由 AI 自動聤合，不代表本平台立場。
            </p>
            {/* 連結區 */}
            <div className="flex items-center gap-4">
              <a
                href="https://tw.sowork.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-[#FF5A1F] transition-colors"
              >
                SoWork.ai 官網
              </a>
              {['隱私政策', '服務條款'].map(link => (
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
