/*
 * Timeline Page — SoWork NewsFlow
 * Design: Narrative Pulse | Central orange axis, alternating cards, turning point pulses
 * Layout: Top search bar + central timeline axis + left-right alternating cards
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Newspaper, Radio, ChevronDown, ChevronUp,
  ExternalLink, Zap, ArrowLeft, BrainCircuit, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { iranTopic, type TurningPoint, type NewsItem } from '@/lib/mockData';

const HEAT_CONFIG = {
  extreme: { label: '極高熱度', bg: 'bg-red-500', ring: 'ring-red-200', textColor: 'text-red-600', lightBg: 'bg-red-50' },
  high: { label: '高熱度', bg: 'bg-orange-500', ring: 'ring-orange-200', textColor: 'text-orange-600', lightBg: 'bg-orange-50' },
  medium: { label: '中熱度', bg: 'bg-yellow-500', ring: 'ring-yellow-200', textColor: 'text-yellow-600', lightBg: 'bg-yellow-50' },
  low: { label: '低熱度', bg: 'bg-gray-400', ring: 'ring-gray-200', textColor: 'text-gray-500', lightBg: 'bg-gray-50' },
};

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#FFF0EB] transition-colors group cursor-pointer">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FFF0EB] flex items-center justify-center text-base">
        {item.sourceFlag}
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
    </div>
  );
}

function TurningPointCard({
  point,
  index,
  isLeft,
  onAIClick,
}: {
  point: TurningPoint;
  index: number;
  isLeft: boolean;
  onAIClick: (point: TurningPoint) => void;
}) {
  const [expanded, setExpanded] = useState(index === 3); // default expand latest
  const heat = HEAT_CONFIG[point.heatLevel];

  return (
    <div className={`relative flex items-start gap-0 ${isLeft ? 'flex-row-reverse' : 'flex-row'} mb-0`}>
      {/* Card */}
      <div
        className={`w-full md:w-[calc(50%-2rem)] fade-up opacity-0 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${point.isActive ? 'border-[#FF5A1F]/30' : ''}`}
        style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
      >
        {/* Active indicator */}
        {point.isActive && (
          <div className="h-1 bg-gradient-to-r from-[#FF5A1F] to-[#ff8c5a]" />
        )}

        <div className="p-5">
          {/* Date + Heat */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#FF5A1F] bg-[#FFF0EB] px-2.5 py-1 rounded-lg">
                {point.dateShort}
              </span>
              {point.isActive && (
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

      {/* Spacer for axis */}
      <div className="hidden md:block w-16 flex-shrink-0" />
    </div>
  );
}

function AIResponsePanel({
  point,
  onClose,
}: {
  point: TurningPoint | null;
  onClose: () => void;
}) {
  const [role, setRole] = useState('');
  const [responseType, setResponseType] = useState<'press' | 'social' | 'memo'>('press');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const AI_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/ai-response-panel-bg-9sBdPYzxpxr4fjK9F9yQNj.webp';

  const mockResponses: Record<string, string> = {
    press: `【新聞稿範本】\n\n針對近期伊朗局勢，本部表示高度關注。我方已啟動緊急應變機制，密切監控中東地區情勢發展。\n\n本部強調，維護地區穩定與和平是我方一貫立場。我方呼籲各方保持克制，透過外交途徑化解分歧。\n\n如有最新進展，本部將即時對外說明。`,
    social: `【社群媒體貼文】\n\n🔔 最新聲明\n\n關於伊朗局勢，我方立場如下：\n\n✅ 密切關注事態發展\n✅ 已啟動緊急應變\n✅ 呼籲各方保持克制\n\n我方將持續更新最新資訊，請關注官方頻道。\n\n#伊朗 #中東局勢 #聲明`,
    memo: `【內部決策建議備忘錄】\n\n主旨：伊朗局勢應對策略建議\n\n一、現況評估\n目前局勢屬高度不確定性，哈梅內伊身亡後政權走向未明，需持續觀察。\n\n二、建議行動\n1. 短期：暫停非必要的中東業務往來\n2. 中期：評估供應鏈替代方案\n3. 長期：建立地緣政治風險預警機制\n\n三、風險等級：高`,
  };

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGenerated(true);
    }, 1500);
  };

  if (!point) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl slide-in-right flex flex-col h-full overflow-hidden">
        {/* Panel Header with bg */}
        <div
          className="relative p-6 pb-4"
          style={{
            backgroundImage: `url(${AI_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-white/85" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF5A1F] flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>AI 立場回覆建議</h3>
                  <p className="text-xs text-muted-foreground">根據事件脈絡生成</p>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="text-lg">✕</span>
              </button>
            </div>
            <div className="bg-[#FFF0EB] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#FF5A1F] uppercase tracking-wide mb-0.5">事件脈絡</p>
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>{point.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{point.summary}</p>
            </div>
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Role Input */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block" style={{ fontFamily: 'Sora, sans-serif' }}>
              你的身份 / 立場
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="例如：國防部發言人、肯德基公關、石油公司 CEO..."
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-[#FF5A1F] outline-none text-sm bg-white transition-colors"
              style={{ fontFamily: 'Noto Sans TC, sans-serif' }}
            />
            {/* Quick role suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {['國防部發言人', '肯德基公關', '石油公司 CEO', '台灣外交部'].map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#FFF0EB] text-[#FF5A1F] hover:bg-[#FF5A1F] hover:text-white transition-all font-medium"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Response Type */}
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
                  onClick={() => { setResponseType(type.key as typeof responseType); setGenerated(false); }}
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

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!role.trim() || loading}
            className="w-full bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-bold py-3 rounded-xl shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI 正在生成...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                生成回覆建議
              </span>
            )}
          </Button>

          {/* Generated Result */}
          {generated && (
            <div className="fade-up opacity-0 bg-[#FAFAFA] rounded-xl border border-border p-4" style={{ animationFillMode: 'forwards' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#FF5A1F] uppercase tracking-wide">AI 生成結果</span>
                  <span className="text-xs text-muted-foreground">· 以「{role}」身份</span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(mockResponses[responseType])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  複製
                </button>
              </div>
              <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans"
                style={{ fontFamily: 'Noto Sans TC, sans-serif' }}>
                {mockResponses[responseType]}
              </pre>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                此為 AI 模擬生成，僅供參考，請自行審閱後使用。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Timeline() {
  const [, navigate] = useLocation();
  const [selectedPoint, setSelectedPoint] = useState<TurningPoint | null>(null);
  const topic = iranTopic;

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
              <p className="text-sm text-muted-foreground mt-1">最後更新：{topic.lastUpdated}</p>
            </div>

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
                  {topic.turningPoints.length}
                </div>
                <div className="text-xs text-muted-foreground">個轉折點</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="container py-12">
        <div className="relative">
          {/* Central axis line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#FF5A1F] via-[#FF5A1F] to-[#FF5A1F]/20 -translate-x-1/2 timeline-draw" />

          {/* Mobile axis line */}
          <div className="md:hidden absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#FF5A1F] to-[#FF5A1F]/20" />

          <div className="space-y-10">
            {topic.turningPoints.map((point, index) => (
              <div key={point.id} className="relative">
                {/* Desktop: center dot */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 items-center justify-center">
                  <div
                    className={`w-5 h-5 rounded-full border-4 border-white shadow-md ${HEAT_CONFIG[point.heatLevel].bg} ${point.isActive ? 'timeline-pulse' : ''}`}
                  />
                </div>

                {/* Mobile: left dot */}
                <div className="md:hidden absolute left-6 -translate-x-1/2 z-10">
                  <div className={`w-4 h-4 rounded-full border-3 border-white shadow-sm ${HEAT_CONFIG[point.heatLevel].bg} ${point.isActive ? 'timeline-pulse' : ''}`} />
                </div>

                {/* Card — desktop alternating, mobile always right */}
                <div className="md:grid md:grid-cols-2 md:gap-8 pl-12 md:pl-0">
                  {index % 2 === 0 ? (
                    <>
                      <TurningPointCard point={point} index={index} isLeft={false} onAIClick={setSelectedPoint} />
                      <div className="hidden md:block" />
                    </>
                  ) : (
                    <>
                      <div className="hidden md:block" />
                      <TurningPointCard point={point} index={index} isLeft={true} onAIClick={setSelectedPoint} />
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
      </div>

      {/* AI Response Panel */}
      {selectedPoint && (
        <AIResponsePanel point={selectedPoint} onClose={() => setSelectedPoint(null)} />
      )}
    </div>
  );
}
