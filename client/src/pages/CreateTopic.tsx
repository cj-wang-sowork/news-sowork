/**
 * Create Topic Page — NewsFlow
 * 登入用戶可建立新議題，選擇公開或私人
 * Step 1: 輸入關鍵字 → AI 歧義消解（確認議題方向）
 * Step 2: 選擇可見性 → 建立
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, Globe, Lock, Zap, Loader2, AlertCircle,
  ChevronRight, CheckCircle2, Search, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

const SUGGESTED_TOPICS = [
  "台灣半導體產業發展", "日本核廢水排放", "AI 取代工作浪潮",
  "美國通膨與升息", "中東石油危機", "歐洲能源轉型",
  "韓國少子化政策", "印度崛起與全球製造", "非洲糧食危機",
];

type DisambiguateCandidate = {
  title: string;
  description: string;
  refinedQuery: string;
};

type Step = 'input' | 'disambiguate' | 'confirm';

export default function CreateTopic() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<DisambiguateCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DisambiguateCandidate | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);

  // Step 1 → 歧義消解
  const disambiguateMutation = trpc.topics.disambiguate.useMutation({
    onSuccess: (data) => {
      if (data.candidates.length <= 1) {
        // 只有一個方向或無歧義，直接跳到確認步驟
        const candidate = data.candidates[0] ?? { title: query, description: '直接建立此議題', refinedQuery: query };
        setSelectedCandidate(candidate);
        setStep('confirm');
      } else {
        setCandidates(data.candidates);
        setStep('disambiguate');
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // 自動追蹤議題
  const saveTopicMutation = trpc.topics.saveTopic.useMutation();

  // Step 2 → 建立議題
  const createMutation = trpc.topics.create.useMutation({
    onSuccess: (data) => {
      // 建立後自動將議題加入「我的議題」追蹤清單
      if (data.topicId) {
        saveTopicMutation.mutate({ topicId: data.topicId });
      }
      navigate(`/timeline/${data.slug}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    disambiguateMutation.mutate({ query: query.trim() });
  };

  const handleSelectCandidate = (candidate: DisambiguateCandidate) => {
    setSelectedCandidate(candidate);
    setStep('confirm');
  };

  const handleCreate = () => {
    if (!selectedCandidate) return;
    setError(null);
    createMutation.mutate({ query: selectedCandidate.refinedQuery, visibility });
  };

  const handleBack = () => {
    if (step === 'disambiguate') {
      setStep('input');
      setCandidates([]);
    } else if (step === 'confirm') {
      if (candidates.length > 1) {
        setStep('disambiguate');
      } else {
        setStep('input');
      }
      setSelectedCandidate(null);
    }
    setError(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF5A1F]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="container py-20 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[#FF5A1F]/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#FF5A1F]" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
            需要登入才能建立議題
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">
            登入後可建立公開議題，每次被其他用戶瀏覽都能為你賺取點數！
          </p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold"
          >
            立即登入 / 免費註冊
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="container py-10 max-w-xl">
        {/* Back */}
        <button
          onClick={step === 'input' ? () => navigate('/') : handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'input' ? '返回首頁' : '返回上一步'}
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['input', 'disambiguate', 'confirm'] as Step[]).map((s, i) => {
            const labels = ['輸入關鍵字', '確認方向', '建立議題'];
            const isActive = step === s;
            const isDone = (step === 'disambiguate' && i === 0) || (step === 'confirm' && i <= 1);
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                  isActive ? 'bg-[#FF5A1F] text-white' :
                  isDone ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                  {labels[i]}
                </div>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Zap className="w-5 h-5 text-[#FF5A1F] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              免費建立議題，無限追蹤
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI 自動分析轉折點，讓你在 30 秒內握握一個事件的完整演變。
            </p>
          </div>
        </div>

        {/* ── Step 1: 輸入關鍵字 ── */}
        {step === 'input' && (
          <form onSubmit={handleQuerySubmit} className="space-y-5">
            <div className="bg-white rounded-2xl border border-border p-5">
              <label className="block text-sm font-semibold text-foreground mb-1">
                議題關鍵字 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                輸入你想追蹤的主題，AI 會先確認你的意圖，再搜尋 50 篇以上相關新聞
              </p>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="例如：肯德基蛋塔、台積電、伊朗核協議"
                className="w-full px-4 py-3 rounded-xl border border-border focus:border-[#FF5A1F] focus:outline-none text-foreground placeholder:text-muted-foreground/60 text-base transition-colors"
                style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
                maxLength={256}
                disabled={disambiguateMutation.isPending}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">{query.length}/256 字</p>

              {/* Suggestions */}
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">熱門建議：</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TOPICS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuery(t)}
                      className="text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-border text-muted-foreground hover:border-[#FF5A1F] hover:text-[#FF5A1F] transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!query.trim() || disambiguateMutation.isPending}
              className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-4 rounded-xl shadow-sm disabled:opacity-60 text-base"
            >
              {disambiguateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI 正在分析議題方向...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  分析議題方向
                </span>
              )}
            </Button>
          </form>
        )}

        {/* ── Step 2: 歧義消解 — 選擇議題方向 ── */}
        {step === 'disambiguate' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-4 h-4 text-[#FF5A1F]" />
                <h2 className="text-sm font-bold text-foreground">
                  「{query}」可能對應以下議題方向
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                請選擇你真正想追蹤的方向，AI 將針對該方向搜尋 50 篇以上相關新聞
              </p>

              <div className="space-y-2.5">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectCandidate(c)}
                    className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-[#FF5A1F] hover:bg-orange-50 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-[#FF5A1F] transition-colors">
                          {c.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {c.description}
                        </p>
                        <p className="text-xs text-[#FF5A1F]/70 mt-1 font-mono">
                          搜尋詞：{c.refinedQuery}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FF5A1F] flex-shrink-0 mt-0.5 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 以上都不是 */}
            <button
              type="button"
              onClick={() => {
                setStep('input');
                setCandidates([]);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              以上都不是，重新輸入
            </button>
          </div>
        )}

        {/* ── Step 3: 確認並建立 ── */}
        {step === 'confirm' && selectedCandidate && (
          <div className="space-y-5">
            {/* 確認卡片 */}
            <div className="bg-white rounded-2xl border-2 border-[#FF5A1F]/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[#FF5A1F]" />
                <span className="text-sm font-semibold text-foreground">已選擇議題方向</span>
              </div>
              <h3 className="text-base font-bold text-foreground mb-1" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                {selectedCandidate.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">{selectedCandidate.description}</p>
              <div className="bg-orange-50 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  搜尋詞：<span className="font-semibold text-[#FF5A1F]">{selectedCandidate.refinedQuery}</span>
                </p>
              </div>
              {candidates.length > 1 && (
                <button
                  type="button"
                  onClick={() => setStep('disambiguate')}
                  className="text-xs text-muted-foreground hover:text-[#FF5A1F] mt-2 underline transition-colors"
                >
                  更換方向
                </button>
              )}
            </div>

            {/* Visibility */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <label className="block text-sm font-semibold text-foreground mb-3">
                可見性
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                    visibility === 'public'
                      ? 'border-[#FF5A1F] bg-orange-50'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe className={`w-4 h-4 ${visibility === 'public' ? 'text-[#FF5A1F]' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-semibold ${visibility === 'public' ? 'text-[#FF5A1F]' : 'text-foreground'}`}>
                      公開
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    所有人可瀏覽，每次被瀏覽為你賺取 1 點
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                    visibility === 'private'
                      ? 'border-[#FF5A1F] bg-orange-50'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-[#FF5A1F]' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-semibold ${visibility === 'private' ? 'text-[#FF5A1F]' : 'text-foreground'}`}>
                      私人
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    僅自己可見，不會出現在公開列表
                  </p>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-4 rounded-xl shadow-sm disabled:opacity-60 text-base"
            >
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI 正在搜尋 50+ 篇新聞並生成時間軸（約 30-60 秒）...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  建立議題並生成時間軸
                </span>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              AI 將從 Google News 搜尋 50 篇以上相關報導，自動分析並生成時間軸。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
