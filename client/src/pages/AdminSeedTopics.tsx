/**
 * Admin Seed Topics Page — NewsFlow
 * 批次建立 50 個平台預設熱門議題
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Zap, CheckCircle, XCircle, Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

// 50 個平台預設熱門議題
const PRESET_TOPICS = [
  // 地緣政治 & 國際衝突
  { query: "俄烏戰爭最新進展", category: "地緣政治" },
  { query: "以巴衝突加薩戰爭", category: "地緣政治" },
  { query: "台海緊張局勢", category: "地緣政治" },
  { query: "伊朗核武談判", category: "地緣政治" },
  { query: "北韓飛彈試射", category: "地緣政治" },
  { query: "美中貿易戰關稅", category: "地緣政治" },
  { query: "南海主權爭議", category: "地緣政治" },
  { query: "敘利亞內戰局勢", category: "地緣政治" },
  // 科技 & AI
  { query: "OpenAI GPT 人工智慧發展", category: "科技" },
  { query: "輝達 NVIDIA AI 晶片", category: "科技" },
  { query: "特斯拉自動駕駛", category: "科技" },
  { query: "蘋果 Apple Intelligence AI", category: "科技" },
  { query: "量子電腦突破", category: "科技" },
  { query: "馬斯克 SpaceX 星艦", category: "科技" },
  { query: "Meta 元宇宙 VR", category: "科技" },
  { query: "台積電先進製程", category: "科技" },
  // 氣候 & 環境
  { query: "全球暖化氣候變遷", category: "氣候" },
  { query: "COP 氣候峰會協議", category: "氣候" },
  { query: "極端天氣颱風洪水", category: "氣候" },
  { query: "再生能源太陽能風電", category: "氣候" },
  { query: "電動車普及化", category: "氣候" },
  // 財經 & 市場
  { query: "美國聯準會升降息", category: "財經" },
  { query: "比特幣加密貨幣", category: "財經" },
  { query: "美股那斯達克科技股", category: "財經" },
  { query: "日圓匯率日本央行", category: "財經" },
  { query: "中國房地產危機恆大", category: "財經" },
  { query: "黃金油價大宗商品", category: "財經" },
  { query: "台灣股市加權指數", category: "財經" },
  // 政治 & 選舉
  { query: "美國川普政策", category: "政治" },
  { query: "台灣政治選舉", category: "政治" },
  { query: "歐盟政治整合", category: "政治" },
  { query: "印度莫迪政府", category: "政治" },
  { query: "日本政治自民黨", category: "政治" },
  { query: "英國工黨執政", category: "政治" },
  // 社會 & 文化
  { query: "人口老化少子化", category: "社會" },
  { query: "移民難民危機", category: "社會" },
  { query: "韓國流行文化 K-pop", category: "社會" },
  { query: "ChatGPT AI 教育衝擊", category: "社會" },
  { query: "社群媒體假訊息", category: "社會" },
  { query: "精神健康心理健康議題", category: "社會" },
  // 健康 & 醫療
  { query: "新冠病毒 COVID 後遺症", category: "健康" },
  { query: "癌症新藥免疫療法", category: "健康" },
  { query: "禽流感 H5N1 疫情", category: "健康" },
  { query: "減肥藥 GLP-1 Ozempic", category: "健康" },
  // 太空 & 科學
  { query: "NASA 月球登陸計畫", category: "太空" },
  { query: "火星探測任務", category: "太空" },
  { query: "黑洞宇宙天文發現", category: "太空" },
  // 能源 & 基礎建設
  { query: "核能發電復興", category: "能源" },
  { query: "半導體供應鏈重組", category: "能源" },
  { query: "5G 6G 通訊網路", category: "能源" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "地緣政治": "bg-red-50 text-red-700",
  "科技": "bg-blue-50 text-blue-700",
  "氣候": "bg-green-50 text-green-700",
  "財經": "bg-yellow-50 text-yellow-700",
  "政治": "bg-purple-50 text-purple-700",
  "社會": "bg-pink-50 text-pink-700",
  "健康": "bg-teal-50 text-teal-700",
  "太空": "bg-indigo-50 text-indigo-700",
  "能源": "bg-orange-50 text-orange-700",
};

type SeedResult = { query: string; slug: string; success: boolean; error?: string };

export default function AdminSeedTopics() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<SeedResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const seedMutation = trpc.admin.seedTopics.useMutation();
  const { data: stats, refetch: refetchStats } = trpc.admin.ingestStatus.useQuery(undefined, { enabled: !!user });

  // 分批執行（每批 5 個，避免超時）
  const BATCH_SIZE = 5;

  const handleSeedAll = async () => {
    setIsRunning(true);
    setResults([]);
    setError(null);
    setCurrentBatch(0);

    const allResults: SeedResult[] = [];

    for (let i = 0; i < PRESET_TOPICS.length; i += BATCH_SIZE) {
      const batch = PRESET_TOPICS.slice(i, i + BATCH_SIZE);
      setCurrentBatch(Math.floor(i / BATCH_SIZE) + 1);

      try {
        const res = await seedMutation.mutateAsync({
          queries: batch.map(t => t.query),
        });
        allResults.push(...res.results);
        setResults([...allResults]);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setError(`第 ${Math.floor(i / BATCH_SIZE) + 1} 批次失敗：${errMsg}`);
        break;
      }
    }

    setIsRunning(false);
    refetchStats();
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalBatches = Math.ceil(PRESET_TOPICS.length / BATCH_SIZE);

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

      <div className="container py-10 max-w-3xl">
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
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
                批次建立預設議題
              </h1>
              <p className="text-sm text-muted-foreground">一鍵生成 {PRESET_TOPICS.length} 個平台熱門議題（AI 自動分析時間軸）</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-border p-4 text-center">
            <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>{PRESET_TOPICS.length}</div>
            <div className="text-xs text-muted-foreground mt-1">待建立議題</div>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4 text-center">
            <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>{stats?.topicCount ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">資料庫現有議題</div>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4 text-center">
            <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>{stats?.articleCount ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">已入庫新聞</div>
          </div>
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="bg-white rounded-2xl border border-border p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF5A1F]" />
              <span className="font-semibold text-foreground">
                正在處理第 {currentBatch} / {totalBatches} 批次...
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-[#FF5A1F] h-2 rounded-full transition-all duration-500"
                style={{ width: `${(results.length / PRESET_TOPICS.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>已完成 {results.length} / {PRESET_TOPICS.length}</span>
              <span>成功 {successCount} · 失敗 {failCount}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !isRunning && (
          <div className="bg-white rounded-2xl border border-border p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#FF5A1F]" />
              <h3 className="font-bold text-foreground">執行結果</h3>
              <span className="ml-auto text-sm text-green-600 font-semibold">{successCount} 成功</span>
              {failCount > 0 && <span className="text-sm text-red-600 font-semibold">{failCount} 失敗</span>}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  {r.success
                    ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  }
                  <span className="text-sm text-foreground flex-1 truncate">{r.query}</span>
                  {r.success
                    ? <span className="text-xs text-green-600 font-mono">{r.slug}</span>
                    : <span className="text-xs text-red-600">{r.error}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Topic List Preview */}
        <div className="bg-white rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-bold text-foreground mb-4">預設議題清單（{PRESET_TOPICS.length} 個）</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_TOPICS.map((t, i) => {
              const result = results.find(r => r.query === t.query);
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${CATEGORY_COLORS[t.category] ?? 'bg-gray-50 text-gray-600'}`}>
                    {t.category}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{t.query}</span>
                  {result && (
                    result.success
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleSeedAll}
          disabled={isRunning}
          className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-4 rounded-xl shadow-sm disabled:opacity-60 text-base"
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              AI 正在分析議題中（第 {currentBatch}/{totalBatches} 批）...
            </span>
          ) : results.length > 0 ? (
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              重新執行（覆蓋已有議題）
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              開始批次建立 {PRESET_TOPICS.length} 個議題
            </span>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-3">
          每個議題約需 20-30 秒 AI 分析，{PRESET_TOPICS.length} 個議題預計需要 15-25 分鐘。請保持頁面開啟。
        </p>
      </div>
    </div>
  );
}
