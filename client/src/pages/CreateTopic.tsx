/**
 * Create Topic Page — NewsFlow
 * 登入用戶可建立新議題，選擇公開或私人
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Globe, Lock, Zap, Loader2, AlertCircle, Coins } from 'lucide-react';
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

export default function CreateTopic() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);

  const { data: pointsData } = trpc.points.balance.useQuery(undefined, { enabled: !!user });

  const createMutation = trpc.topics.create.useMutation({
    onSuccess: (data) => {
      navigate(`/timeline/${data.slug}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    createMutation.mutate({ query: query.trim(), visibility });
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
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首頁
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-foreground mb-1" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
            建立新議題
          </h1>
          <p className="text-sm text-muted-foreground">
            輸入你想追蹤的主題，AI 將自動分析並生成完整時間軸
          </p>
        </div>

        {/* Points Info */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Coins className="w-5 h-5 text-[#FF5A1F] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              你目前有 <span className="text-[#FF5A1F]">{pointsData?.points ?? 0} 點</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              建立公開議題免費。每次被他人瀏覽，你可賺取 1 點。AI 功能消耗 10 點。
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Topic Query */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <label className="block text-sm font-semibold text-foreground mb-3">
              議題主題 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="例如：台灣半導體產業發展"
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-[#FF5A1F] focus:outline-none text-foreground placeholder:text-muted-foreground/60 text-base transition-colors"
              style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
              maxLength={256}
              disabled={createMutation.isPending}
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

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!query.trim() || createMutation.isPending}
            className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-4 rounded-xl shadow-sm disabled:opacity-60 text-base"
          >
            {createMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                AI 正在分析議題（約 20-30 秒）...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                建立議題並生成時間軸
              </span>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            AI 將從 Google News 抓取最新報導，自動分析並生成時間軸。
          </p>
        </form>
      </div>
    </div>
  );
}
