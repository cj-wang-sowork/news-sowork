/**
 * Admin Ingest Page — NewsFlow
 * Allows authenticated admin/owner to trigger RSS ingestion and view status
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Rss, Database, RefreshCw, CheckCircle, AlertCircle, Loader2, Newspaper, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export default function AdminIngest() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [lastResult, setLastResult] = useState<{ stored: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status, refetch: refetchStatus, isLoading: statusLoading } = trpc.admin.ingestStatus.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000, // refresh every 5s
  });

  const triggerIngest = trpc.admin.triggerIngest.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      setError(null);
      refetchStatus();
    },
    onError: (err) => {
      setError(err.message);
      setLastResult(null);
    },
  });

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
        <div className="container py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">需要登入</h2>
          <p className="text-muted-foreground mb-6">此頁面需要登入後才能使用</p>
          <Button onClick={() => navigate('/')} className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white">
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="container py-10 max-w-2xl">
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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A1F] flex items-center justify-center">
              <Rss className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                新聞資料入庫
              </h1>
              <p className="text-sm text-muted-foreground">觸發 RSS 抓取，將最新新聞存入資料庫</p>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="w-4 h-4 text-[#FF5A1F]" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已入庫新聞</span>
            </div>
            {statusLoading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse w-20" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                {(status?.articleCount ?? 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">篇文章</p>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-[#FF5A1F]" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">追蹤話題</span>
            </div>
            {statusLoading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse w-20" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
                {(status?.topicCount ?? 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">個主題</p>
          </div>
        </div>

        {/* RSS Sources Info */}
        <div className="bg-white rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-[#FF5A1F]" />
            <h3 className="font-bold text-foreground text-sm">已設定的 RSS 來源（10 個）</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { flag: '🇹🇼', name: '自由時報' },
              { flag: '🇹🇼', name: '聯合新聞網' },
              { flag: '🇹🇼', name: '公視新聞' },
              { flag: '🇹🇼', name: '中央社' },
              { flag: '🇬🇧', name: 'BBC 中文' },
              { flag: '🇺🇸', name: 'VOA 中文' },
              { flag: '🇬🇧', name: 'Reuters' },
              { flag: '🇺🇸', name: 'AP News' },
              { flag: '🇶🇦', name: 'Al Jazeera' },
              { flag: '🇯🇵', name: 'NHK 日本語' },
            ].map(src => (
              <div key={src.name} className="flex items-center gap-2 text-muted-foreground">
                <span>{src.flag}</span>
                <span className="text-xs">{src.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trigger Button */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="font-bold text-foreground mb-2">觸發全量抓取</h3>
          <p className="text-sm text-muted-foreground mb-5">
            系統將依序抓取所有 10 個 RSS 來源，每個來源最多取 20 篇最新文章，去重後存入資料庫。
            首次執行約需 30–60 秒。
          </p>

          <Button
            onClick={() => triggerIngest.mutate()}
            disabled={triggerIngest.isPending}
            className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-3 rounded-xl shadow-sm disabled:opacity-60"
          >
            {triggerIngest.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                正在抓取新聞中，請稍候...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                立即觸發 RSS 抓取
              </span>
            )}
          </Button>

          {/* Result */}
          {lastResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">{lastResult.message}</p>
                <p className="text-xs text-green-600 mt-0.5">資料已更新，首頁熱門話題將在下次查詢時反映最新資料。</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">抓取失敗</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
