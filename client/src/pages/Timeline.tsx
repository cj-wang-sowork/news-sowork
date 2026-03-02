/*
 * Timeline Page — SoWork NewsFlow
 * Design: Narrative Pulse | Central orange axis, alternating cards, turning point pulses
 * Layout: Top search bar + central timeline axis + left-right alternating cards
 * Data: Fully connected to real tRPC API (no mockData)
 */

import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  Newspaper, Radio, ChevronDown, ChevronUp,
  ExternalLink, Zap, ArrowLeft, BrainCircuit, Globe, Loader2, AlertCircle,
  Bookmark, BookmarkCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

// ─── Types ────────────────────────────────────────────────────────────────────
type HeatLevel = 'extreme' | 'high' | 'medium' | 'low';

interface RealNewsItem {
  id: number | string;
  title: string;
  url: string;
  source: string;
  sourceFlag: string;
  language: string;
  time: string;
}

interface RealTurningPoint {
  id: number;
  topicId: number;
  title: string;
  titleEn?: string | null;
  summary: string;
  dateLabel: string;
  eventDate: Date | string;
  articleCount: number;
  mediaCount: number;
  heatLevel: HeatLevel;
  isActive: number;
  sortOrder: number;
  news: RealNewsItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const HEAT_CONFIG = {
  extreme: { label: '極高熱度', bg: 'bg-red-500', ring: 'ring-red-200', textColor: 'text-red-600', lightBg: 'bg-red-50' },
  high: { label: '高熱度', bg: 'bg-orange-500', ring: 'ring-orange-200', textColor: 'text-orange-600', lightBg: 'bg-orange-50' },
  medium: { label: '中熱度', bg: 'bg-yellow-500', ring: 'ring-yellow-200', textColor: 'text-yellow-600', lightBg: 'bg-yellow-50' },
  low: { label: '低熱度', bg: 'bg-gray-400', ring: 'ring-gray-200', textColor: 'text-gray-500', lightBg: 'bg-gray-50' },
};

const AI_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/ai-response-panel-bg-9sBdPYzxpxr4fjK9F9yQNj.webp';

// ─── NewsCard ─────────────────────────────────────────────────────────────────
function NewsCard({ item }: { item: RealNewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#FFF0EB] transition-colors group cursor-pointer"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FFF0EB] flex items-center justify-center text-base">
        {item.sourceFlag || '📰'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug group-hover:text-[#FF5A1F] transition-colors line-clamp-2"
          style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{item.source}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{item.language}</span>
          <span className="text-xs text-muted-foreground">{item.time}</span>
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-[#FF5A1F] flex-shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

// ─── TurningPointCard ─────────────────────────────────────────────────────────
function TurningPointCard({
  point,
  index,
  onAIClick,
}: {
  point: RealTurningPoint;
  index: number;
  onAIClick: (point: RealTurningPoint) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const heat = HEAT_CONFIG[point.heatLevel] ?? HEAT_CONFIG.medium;
  const isActive = point.isActive === 1;

  return (
    <div
      className={`w-full md:w-[calc(50%-2rem)] fade-up opacity-0 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${isActive ? 'border-[#FF5A1F]/30' : ''}`}
      style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
    >
      {isActive && (
        <div className="h-1 bg-gradient-to-r from-[#FF5A1F] to-[#ff8c5a]" />
      )}

      <div className="p-5">
        {/* Date + Heat */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-[#FF5A1F] bg-[#FFF0EB] px-2.5 py-1 rounded-lg">
              {point.dateLabel}
            </span>
            {isActive && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                進行中
              </span>
            )}
          </div>
          <span className={`text-xs font-medium ${heat.textColor} ${heat.lightBg} px-2 py-0.5 rounded-full`}>
            {heat.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-[17px] text-foreground leading-snug mb-2"
          style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
          {point.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4"
          style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
          {point.summary}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              {point.articleCount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">篇報導</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              {point.mediaCount}
            </span>
            <span className="text-xs text-muted-foreground">家媒體</span>
          </div>
        </div>

        {/* Media dots */}
        <div className="flex items-center gap-1 mb-4">
          {Array.from({ length: Math.min(point.mediaCount, 24) }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor: i < Math.ceil(point.mediaCount * 0.65) ? '#FF5A1F' : '#E8E8E8',
                opacity: i < Math.ceil(point.mediaCount * 0.65) ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Expand/Collapse news */}
        {point.news.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#FF5A1F] hover:text-[#e04d18] transition-colors mb-2"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? '收起報導' : `展開 ${point.news.length} 篇相關報導`}
            </button>

            {expanded && (
              <div className="border-t border-border pt-3 space-y-1">
                {point.news.map(item => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}

        {/* AI Response Button */}
        <div className="border-t border-border mt-4 pt-4">
          <Button
            onClick={() => onAIClick(point)}
            className="w-full bg-gradient-to-r from-[#FF5A1F] to-[#ff7a45] hover:from-[#e04d18] hover:to-[#e06835] text-white font-semibold rounded-xl shadow-sm"
          >
            <BrainCircuit className="w-4 h-4 mr-2" />
            AI 立場回覆建議
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── AIResponsePanel ──────────────────────────────────────────────────────────
function AIResponsePanel({
  point,
  onClose,
}: {
  point: RealTurningPoint | null;
  onClose: () => void;
}) {
  const RECENT_ROLES_KEY = 'newsflow_recent_roles';
  const MAX_RECENT = 5;

  // 身份記憶：從 localStorage 載入最近使用的身份
  const [recentRoles, setRecentRoles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_ROLES_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const saveRoleToRecent = (r: string) => {
    if (!r.trim()) return;
    setRecentRoles(prev => {
      const updated = [r.trim(), ...prev.filter(x => x !== r.trim())].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_ROLES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  };

  const removeRecentRole = (r: string) => {
    setRecentRoles(prev => {
      const updated = prev.filter(x => x !== r);
      try { localStorage.setItem(RECENT_ROLES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  };

  const [role, setRole] = useState('');
  const [responseType, setResponseType] = useState<'press' | 'social' | 'memo'>('press');
  const [generatedContent, setGeneratedContent] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [copied, setCopied] = useState(false);
  // 對話修改歷程：儲存每次修改的版本
  type HistoryItem = { instruction: string; content: string };
  const [refineHistory, setRefineHistory] = useState<HistoryItem[]>([]);

  // AI 推薦身份（根據議題標題自動載入）
  const { data: suggestedRoles, isLoading: rolesLoading } = trpc.ai.suggestRoles.useQuery(
    {
      topicTitle: point?.title ?? '',
      topicSummary: point?.summary ?? '',
    },
    { enabled: !!point }
  );

  const generateStance = trpc.ai.generateStance.useMutation({
    onSuccess: (data) => {
      const content = typeof data.content === 'string' ? data.content : '';
      setGeneratedContent(content);
      setRefineHistory([]);
      // 生成成功後將身份儲存到最近使用
      saveRoleToRecent(role);
    },
  });

  const refineContent = trpc.ai.refineContent.useMutation({
    onSuccess: (data) => {
      const refined = typeof data.content === 'string' ? data.content : '';
      setRefineHistory(prev => [...prev, { instruction: refineInput, content: refined }]);
      setGeneratedContent(refined);
      setRefineInput('');
    },
  });

  const handleGenerate = () => {
    if (!role.trim() || !point) return;
    setGeneratedContent('');
    setRefineHistory([]);
    generateStance.mutate({
      topicTitle: point.title,
      topicSummary: point.summary,
      role: role.trim(),
      responseType,
      language: 'zh-TW',
    });
  };

  const handleRefine = () => {
    if (!refineInput.trim() || !generatedContent || !point) return;
    refineContent.mutate({
      currentContent: generatedContent,
      instruction: refineInput.trim(),
      role: role.trim(),
      responseType,
      topicTitle: point.title,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const typeLabel = { press: '新聞稿', social: '社群貼文', memo: '內部備忘' }[responseType];
    const filename = `${typeLabel}_${role}_${point?.title?.slice(0, 15) ?? 'AI回覆'}.txt`;
    const blob = new Blob([generatedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!point) return null;

  const isGenerating = generateStance.isPending;
  const isRefining = refineContent.isPending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Panel Header */}
        <div
          className="relative p-5 pb-4 flex-shrink-0"
          style={{ backgroundImage: `url(${AI_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 bg-white/88" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF5A1F] flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>AI 立場回覆建議</h3>
                  <p className="text-xs text-muted-foreground">根據議題脈絡自動分析</p>
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 text-muted-foreground hover:text-foreground transition-colors">
                <span className="text-base">✕</span>
              </button>
            </div>
            <div className="bg-[#FFF0EB] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#FF5A1F] uppercase tracking-wide mb-0.5">事件脈絡</p>
              <p className="text-sm font-bold text-foreground line-clamp-1" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>{point.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{point.summary}</p>
            </div>
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 身份選擇區 */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block" style={{ fontFamily: 'Sora, sans-serif' }}>
              你的身份 / 立場
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="輸入或點選下方推薦身份..."
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-[#FF5A1F] outline-none text-sm bg-white transition-colors"
              style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
            />
            {/* 最近使用的身份 */}
            {recentRoles.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1.5">🕒 最近使用</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentRoles.map(r => (
                    <div key={r} className="flex items-center group">
                      <button
                        onClick={() => setRole(r)}
                        className={`text-xs px-3 py-1.5 rounded-l-full border transition-all font-medium ${
                          role === r
                            ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                            : 'bg-white text-foreground border-border hover:border-[#FF5A1F]/60 hover:text-[#FF5A1F]'
                        }`}
                      >
                        {r}
                      </button>
                      <button
                        onClick={() => removeRecentRole(r)}
                        className="text-xs px-1.5 py-1.5 rounded-r-full border border-l-0 border-border bg-white text-muted-foreground hover:text-red-500 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100"
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 推薦身份 */}
            <div className="mt-2">
              {rolesLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  AI 正在分析議題，推薦合適身份...
                </div>
              ) : suggestedRoles?.roles && suggestedRoles.roles.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">🤖 AI 推薦身份（點選即可）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedRoles.roles.map(r => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                          role === r
                            ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                            : 'bg-[#FFF0EB] text-[#FF5A1F] border-[#FF5A1F]/30 hover:bg-[#FF5A1F] hover:text-white hover:border-[#FF5A1F]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 回覆類型 */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block" style={{ fontFamily: 'Sora, sans-serif' }}>
              回覆類型
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'press', label: '新聞稿', icon: '📄' },
                { key: 'social', label: '社群貼文', icon: '📱' },
                { key: 'memo', label: '內部備忘', icon: '🔒' },
              ].map(type => (
                <button
                  key={type.key}
                  onClick={() => { setResponseType(type.key as typeof responseType); setGeneratedContent(''); setRefineHistory([]); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    responseType === type.key
                      ? 'border-[#FF5A1F] bg-[#FFF0EB] text-[#FF5A1F]'
                      : 'border-border bg-white text-muted-foreground hover:border-[#FF5A1F]/40'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 生成按鈕 */}
          <Button
            onClick={handleGenerate}
            disabled={!role.trim() || isGenerating}
            className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-3 rounded-xl shadow-sm disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在生成...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {generatedContent ? '重新生成' : '生成回覆建議'}
              </span>
            )}
          </Button>

          {/* 生成結果區 */}
          {generatedContent && (
            <div className="bg-[#FAFAFA] rounded-xl border border-border overflow-hidden">
              {/* 結果標題列 */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#FF5A1F] uppercase tracking-wide">AI 生成結果</span>
                  <span className="text-xs text-muted-foreground">· 以「{role}」身份</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all ${
                      copied ? 'bg-green-100 text-green-700' : 'bg-[#FFF0EB] text-[#FF5A1F] hover:bg-[#FF5A1F] hover:text-white'
                    }`}
                  >
                    {copied ? '✓ 已複製' : '📋 複製'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#FFF0EB] text-[#FF5A1F] hover:bg-[#FF5A1F] hover:text-white transition-all"
                  >
                    ↓ 下載
                  </button>
                </div>
              </div>
              {/* 內容文本 */}
              <div className="p-4">
                <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                  {generatedContent}
                </pre>
              </div>
            </div>
          )}

          {/* 對話修改區（生成後才顯示） */}
          {generatedContent && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium">對話修改</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* 修改歷程 */}
              {refineHistory.length > 0 && (
                <div className="space-y-2">
                  {refineHistory.map((item, i) => (
                    <div key={i} className="bg-orange-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-[#FF5A1F] font-medium mb-0.5">修改指令 {i + 1}</p>
                      <p className="text-xs text-muted-foreground">{item.instruction}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 修改輸入框 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={e => setRefineInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleRefine()}
                  placeholder="輸入修改要求，例如：請更簡短、請加入數據支持..."
                  disabled={isRefining}
                  className="flex-1 px-3 py-2.5 rounded-xl border-2 border-border focus:border-[#FF5A1F] outline-none text-sm bg-white transition-colors disabled:opacity-50"
                  style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                />
                <Button
                  onClick={handleRefine}
                  disabled={!refineInput.trim() || isRefining}
                  size="sm"
                  className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white rounded-xl px-3 disabled:opacity-50 flex-shrink-0"
                >
                  {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : '發送'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">• 每次修改消耗 5 點，可多輪對話直到滿意</p>
            </div>
          )}

          {/* 底部備註 */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 pb-2">
            <Globe className="w-3 h-3" />
            此為 AI 生成內容，僅供參考，請自行審閱後使用。
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Timeline Page ───────────────────────────────────────────────────────
export default function Timeline() {
  const [, navigate] = useLocation();
  const params = useParams<{ topicId: string }>();
  const slug = params.topicId ?? '';
  const [selectedPoint, setSelectedPoint] = useState<RealTurningPoint | null>(null);
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  // Fetch real timeline data from API
  const { data, isLoading, error } = trpc.topics.getTimeline.useQuery(
    { slug },
    { enabled: !!slug }
  );
  const topicId = data?.topic?.id;
  // Check if saved
  const { data: isSaved } = trpc.topics.isSaved.useQuery(
    { topicId: topicId! },
    { enabled: isAuthenticated && !!topicId }
  );
  const saveTopic = trpc.topics.saveTopic.useMutation({
    onSuccess: () => utils.topics.isSaved.invalidate({ topicId: topicId! }),
  });
  const unsaveTopic = trpc.topics.unsaveTopic.useMutation({
    onSuccess: () => utils.topics.isSaved.invalidate({ topicId: topicId! }),
  });
  const handleToggleSave = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!topicId) return;
    if (isSaved) {
      unsaveTopic.mutate({ topicId });
    } else {
      saveTopic.mutate({ topicId });
    }
  };
  // Record view (for creator's point reward)
  const recordView = trpc.topics.recordView.useMutation();
  const [viewRecorded, setViewRecorded] = useState(false);
  useEffect(() => {
    if (data?.topic && !viewRecorded) {
      setViewRecorded(true);
      recordView.mutate({ slug });
    }
  }, [data?.topic?.id]);;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-[#FF5A1F]/20 border-t-[#FF5A1F] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              AI 正在分析事件脈絡
            </p>
            <p className="text-sm text-muted-foreground mt-1">蒐集相關報導、偵測轉折點中...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">找不到此話題</p>
            <p className="text-sm text-muted-foreground mt-1">請返回首頁重新搜尋</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline" className="mt-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  const { topic, turningPoints: tpList } = data;

  // Map API data to component types
  const turningPoints: RealTurningPoint[] = tpList.map(tp => ({
    id: tp.id,
    topicId: tp.topicId,
    title: tp.title,
    titleEn: tp.titleEn,
    summary: tp.summary,
    dateLabel: tp.dateLabel,
    eventDate: tp.eventDate,
    articleCount: tp.articleCount,
    mediaCount: tp.mediaCount,
    heatLevel: (tp.heatLevel as HeatLevel) ?? 'medium',
    isActive: tp.isActive,
    sortOrder: tp.sortOrder,
    news: (tp.news ?? []).map(n => ({
      id: n.id,
      title: n.title,
      url: n.url,
      source: n.source,
      sourceFlag: n.sourceFlag ?? '📰',
      language: n.language,
      time: n.time,
    })),
  }));

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      {/* Topic Header */}
      <div className="bg-white border-b border-border">
        <div className="container py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回探索話題
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">追蹤主題</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  即時更新
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground"
                style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                {topic.query}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                最後更新：{new Date(topic.lastUpdated).toLocaleString('zh-TW')}
              </p>
            </div>

            <div className="flex flex-col items-end gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {topic.totalArticles.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">篇報導</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {topic.totalMedia}
                  </div>
                  <div className="text-xs text-muted-foreground">家媒體</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {turningPoints.length}
                  </div>
                  <div className="text-xs text-muted-foreground">個轉折點</div>
                </div>
              </div>
              {/* Save / Unsave button */}
              <Button
                onClick={handleToggleSave}
                disabled={saveTopic.isPending || unsaveTopic.isPending}
                variant={isSaved ? 'outline' : 'default'}
                size="sm"
                className={isSaved
                  ? 'flex items-center gap-1.5 border-[#FF5A1F] text-[#FF5A1F] hover:bg-orange-50'
                  : 'flex items-center gap-1.5 bg-[#FF5A1F] hover:bg-[#e04d18] text-white'
                }
              >
                {isSaved
                  ? <><BookmarkCheck className="w-4 h-4" />已追蹤</>
                  : <><Bookmark className="w-4 h-4" />追蹤此議題</>
                }
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="container py-12">
        {turningPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              AI 正在分析相關新聞，轉折點即將生成<br />
              <span className="text-sm">請稍後重新整理頁面</span>
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Central axis line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#FF5A1F] via-[#FF5A1F] to-[#FF5A1F]/20 -translate-x-1/2" />
            {/* Mobile axis line */}
            <div className="md:hidden absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#FF5A1F] to-[#FF5A1F]/20" />

            <div className="space-y-10">
              {turningPoints.map((point, index) => (
                <div key={point.id} className="relative">
                  {/* Desktop: center dot */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 items-center justify-center">
                    <div
                      className={`w-5 h-5 rounded-full border-4 border-white shadow-md ${HEAT_CONFIG[point.heatLevel]?.bg ?? 'bg-gray-400'} ${point.isActive === 1 ? 'animate-pulse' : ''}`}
                    />
                  </div>
                  {/* Mobile: left dot */}
                  <div className="md:hidden absolute left-6 -translate-x-1/2 z-10">
                    <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${HEAT_CONFIG[point.heatLevel]?.bg ?? 'bg-gray-400'}`} />
                  </div>

                  {/* Card — desktop alternating, mobile always right */}
                  <div className="md:grid md:grid-cols-2 md:gap-8 pl-12 md:pl-0">
                    {index % 2 === 0 ? (
                      <>
                        <TurningPointCard point={point} index={index} onAIClick={setSelectedPoint} />
                        <div className="hidden md:block" />
                      </>
                    ) : (
                      <>
                        <div className="hidden md:block" />
                        <TurningPointCard point={point} index={index} onAIClick={setSelectedPoint} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* End of timeline */}
            <div className="flex justify-center mt-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5A1F]/30" />
                <p className="text-xs text-muted-foreground">持續追蹤中...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Response Panel */}
      {selectedPoint && (
        <AIResponsePanel point={selectedPoint} onClose={() => setSelectedPoint(null)} />
      )}
    </div>
  );
}
