/*
 * My Topics Page — SoWork NewsFlow
 * 登入用戶的議題追蹤管理頁面
 */

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'wouter';
import {
  Bookmark, BookmarkCheck, Pin, PinOff, ArrowRight,
  Newspaper, Radio, Tag, Plus, Lock, Trash2, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

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

type TabType = 'saved' | 'created';

export default function MyTopics() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('saved');

  const utils = trpc.useUtils();

  // 追蹤的議題
  const { data: savedTopics, isLoading: savedLoading } = trpc.topics.savedTopics.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // 自己建立的議題
  const { data: myTopics, isLoading: myLoading } = trpc.topics.myTopics.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // 取消追蹤
  const unsave = trpc.topics.unsaveTopic.useMutation({
    onSuccess: () => {
      utils.topics.savedTopics.invalidate();
    },
  });

  // 釘選/取消釘選
  const pin = trpc.topics.pinTopic.useMutation({
    onSuccess: () => {
      utils.topics.savedTopics.invalidate();
    },
  });

  // 未登入狀態
  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="container py-24 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-[#FF5A1F]" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
            登入後才能查看我的議題
          </h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            登入後可以追蹤感興趣的議題、建立私有議題，並管理你的 NewsFlow 內容。
          </p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold px-8"
          >
            免費登入
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = loading || savedLoading || myLoading;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Helmet>
        <title>我的議題 — 時事軸 by SoWork.ai</title>
        <link rel="canonical" href="https://newsflow.sowork.ai/my-topics" />
        <meta name="description" content="管理您追蹤的新聞議題，查看 AI 分析的轉折點和最新報導。" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-border">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                我的議題
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理你追蹤的議題與自建內容
              </p>
            </div>
            <Button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-1.5 bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              探索更多議題
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-6">
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'saved'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              追蹤中
              {savedTopics && savedTopics.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'saved' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {savedTopics.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'created'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              我建立的
              {myTopics && myTopics.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'created' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {myTopics.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-100 rounded mb-2 w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : activeTab === 'saved' ? (
          <>
            {!savedTopics || savedTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                  <Bookmark className="w-8 h-8 text-gray-300" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">尚未追蹤任何議題</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  在首頁瀏覽議題，點擊「追蹤」按鈕即可加入此列表。
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
                >
                  探索議題
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedTopics.map((item) => {
                  let parsedTags: string[] = [];
                  if (item.topicTags) {
                    try {
                      const raw = typeof item.topicTags === 'string' ? JSON.parse(item.topicTags) : item.topicTags;
                      if (Array.isArray(raw)) parsedTags = raw.filter((x): x is string => typeof x === 'string');
                    } catch { /* ignore */ }
                  }
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-border p-5 hover:border-[#FF5A1F]/30 hover:shadow-lg transition-all duration-300 group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          {item.topicCategory && (
                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border mb-1 bg-gray-50 text-gray-500 border-gray-100">
                              {item.topicCategory}
                            </span>
                          )}
                          <h3
                            className="font-bold text-[15px] text-foreground leading-snug group-hover:text-[#FF5A1F] transition-colors line-clamp-2 cursor-pointer"
                            style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}
                            onClick={() => navigate(`/timeline/${item.topicSlug}`)}
                          >
                            {item.topicQuery}
                          </h3>
                        </div>
                        {/* Pin button */}
                        <button
                          onClick={() => pin.mutate({ topicId: item.topicId!, pin: !item.isPinned })}
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                            item.isPinned
                              ? 'bg-orange-50 text-[#FF5A1F]'
                              : 'text-gray-300 hover:text-[#FF5A1F] hover:bg-orange-50'
                          }`}
                          title={item.isPinned ? '取消釘選' : '釘選'}
                        >
                          {item.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                            {(item.topicTotalArticles ?? 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">篇</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                            {item.topicTotalMedia ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">家媒體</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {parsedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {parsedTags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(item.topicLastUpdated)}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Remove button */}
                          <button
                            onClick={() => unsave.mutate({ topicId: item.topicId! })}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            title="取消追蹤"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* View button */}
                          <button
                            onClick={() => navigate(`/timeline/${item.topicSlug}`)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#FF5A1F] transition-colors"
                          >
                            查看 <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {!myTopics || myTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                  <TrendingUp className="w-8 h-8 text-gray-300" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">尚未建立任何議題</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  在首頁搜尋框輸入主題，AI 會自動建立時間軸並加入你的議題列表。
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
                >
                  建立議題
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTopics.map((topic) => {
                  let parsedTags: string[] = [];
                  if (topic.tags) {
                    try {
                      const raw = typeof topic.tags === 'string' ? JSON.parse(topic.tags) : topic.tags;
                      if (Array.isArray(raw)) parsedTags = raw.filter((x): x is string => typeof x === 'string');
                    } catch { /* ignore */ }
                  }
                  return (
                    <div
                      key={topic.id}
                      className="bg-white rounded-2xl border border-border p-5 hover:border-[#FF5A1F]/30 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                      onClick={() => navigate(`/timeline/${topic.slug}`)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {topic.category && (
                              <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-100">
                                {topic.category}
                              </span>
                            )}
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                              topic.visibility === 'public'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                              {topic.visibility === 'public' ? '公開' : '私有'}
                            </span>
                          </div>
                          <h3
                            className="font-bold text-[15px] text-foreground leading-snug group-hover:text-[#FF5A1F] transition-colors line-clamp-2"
                            style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}
                          >
                            {topic.query}
                          </h3>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                            {(topic.totalArticles ?? 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">篇</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                            {topic.totalMedia ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">家媒體</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {parsedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {parsedTags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(topic.lastUpdated)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FF5A1F] group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
