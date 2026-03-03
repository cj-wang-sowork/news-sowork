/**
 * Organize Page — 協作式議題整理
 * 登入用戶可拖拉議題卡片進行合併，系統學習用戶的歸納方式
 */

import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Merge, GitBranch, Flame, Newspaper, ArrowLeft, Info, Loader2, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TopicItem {
  id: number;
  query: string;
  slug: string;
  heatLevel: string;
  totalArticles: number;
  totalMedia: number;
  tags: string[] | null;
  category: string | null;
}

// ─── Draggable Topic Card ─────────────────────────────────────────────────────
function DraggableTopicCard({
  topic,
  isOver,
  isDragging,
}: {
  topic: TopicItem;
  isOver?: boolean;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `topic-${topic.id}`,
    data: { topic },
  });

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `drop-${topic.id}`,
    data: { topic },
  });

  const heatConfig: Record<string, { label: string; color: string; dot: string }> = {
    extreme: { label: '極高熱度', color: 'text-red-600', dot: 'bg-red-500' },
    high: { label: '高熱度', color: 'text-orange-500', dot: 'bg-orange-500' },
    medium: { label: '中熱度', color: 'text-yellow-600', dot: 'bg-yellow-500' },
    low: { label: '低熱度', color: 'text-gray-400', dot: 'bg-gray-400' },
  };
  const heat = heatConfig[topic.heatLevel] ?? heatConfig.medium;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const tags: string[] = Array.isArray(topic.tags)
    ? topic.tags
    : typeof topic.tags === 'string'
    ? (() => { try { return JSON.parse(topic.tags as string); } catch { return []; } })()
    : [];

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        'relative bg-white rounded-2xl border-2 p-4 cursor-grab active:cursor-grabbing transition-all duration-200 select-none',
        isDragging ? 'opacity-40 scale-95' : '',
        isDropOver && !isDragging ? 'border-[#FF5A1F] shadow-lg shadow-orange-100 scale-[1.02] bg-orange-50/30' : 'border-border hover:border-[#FF5A1F]/40 hover:shadow-md',
      ].join(' ')}
    >
      {/* Drop indicator */}
      {isDropOver && !isDragging && (
        <div className="absolute inset-0 rounded-2xl border-2 border-[#FF5A1F] border-dashed flex items-center justify-center bg-orange-50/60 z-10">
          <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md border border-[#FF5A1F]/30">
            <Merge className="w-4 h-4 text-[#FF5A1F]" />
            <span className="text-sm font-semibold text-[#FF5A1F]">放開以合併</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-[15px] text-foreground leading-snug flex-1" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
          {topic.query}
        </h3>
        <span className={`flex items-center gap-1 text-xs font-semibold flex-shrink-0 ${heat.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${heat.dot} ${topic.heatLevel === 'extreme' ? 'animate-pulse' : ''}`} />
          {heat.label}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Newspaper className="w-3 h-3" />
          <span className="font-semibold text-foreground">{topic.totalArticles}</span> 篇
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span className="font-semibold text-foreground">{topic.totalMedia}</span> 媒體
        </span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Drag hint */}
      <div className="absolute bottom-2 right-2 opacity-20">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="4" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/>
          <circle cx="4" cy="6" r="1.2"/><circle cx="8" cy="6" r="1.2"/>
          <circle cx="4" cy="9" r="1.2"/><circle cx="8" cy="9" r="1.2"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Overlay Card (while dragging) ───────────────────────────────────────────
function DragOverlayCard({ topic }: { topic: TopicItem }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#FF5A1F] p-4 shadow-2xl shadow-orange-200/50 rotate-2 scale-105 w-64">
      <h3 className="font-bold text-[15px] text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
        {topic.query}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">{topic.totalArticles} 篇 · {topic.totalMedia} 媒體</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Organize() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [activeTopic, setActiveTopic] = useState<TopicItem | null>(null);
  const [overTopicId, setOverTopicId] = useState<number | null>(null);

  // Merge confirm dialog
  const [mergeDialog, setMergeDialog] = useState<{
    source: TopicItem;
    target: TopicItem;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetch all topics
  const { data: topicsData, isLoading, refetch } = trpc.topics.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const recordSignalMutation = trpc.organize.recordSignal.useMutation();
  const mergeTopicsMutation = trpc.organize.mergeTopics.useMutation({
    onSuccess: (data) => {
      toast.success(`已合併！議題已整合到「${data.targetQuery}」`);
      setMergeDialog(null);
      refetch();
    },
    onError: (err) => {
      toast.error(`合併失敗：${err.message}`);
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const topic = event.active.data.current?.topic as TopicItem;
    setActiveTopic(topic ?? null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (overId?.startsWith('drop-')) {
      const targetId = parseInt(overId.replace('drop-', ''), 10);
      setOverTopicId(targetId);
    } else {
      setOverTopicId(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTopic(null);
    setOverTopicId(null);

    if (!over) return;

    const sourceTopic = active.data.current?.topic as TopicItem;
    const targetTopic = over.data.current?.topic as TopicItem;

    if (!sourceTopic || !targetTopic) return;
    if (sourceTopic.id === targetTopic.id) return;

    // 記錄學習信號（非同步，不阻塞 UI）
    if (isAuthenticated) {
      recordSignalMutation.mutate({
        sourceTopicId: sourceTopic.id,
        targetTopicId: targetTopic.id,
        action: 'merge',
        confidence: 3,
      });
    }

    // 顯示合併確認 dialog
    setMergeDialog({ source: sourceTopic, target: targetTopic });
  }, [isAuthenticated, recordSignalMutation]);

  const handleConfirmMerge = () => {
    if (!mergeDialog) return;
    mergeTopicsMutation.mutate({
      sourceTopicId: mergeDialog.source.id,
      targetTopicId: mergeDialog.target.id,
    });
  };

  const topics = (topicsData?.items ?? []) as TopicItem[];

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF5A1F]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="container py-24 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Merge className="w-8 h-8 text-[#FF5A1F]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
            請先登入
          </h1>
          <p className="text-muted-foreground max-w-sm">
            登入後即可拖拉議題卡片進行合併，幫助系統學習更好的議題歸納方式。
          </p>
          <Button
            className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
            onClick={() => window.location.href = getLoginUrl()}
          >
            登入 / 免費註冊
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="container py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回首頁
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground mb-1" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
              整理議題
            </h1>
            <p className="text-sm text-muted-foreground">
              將相似的議題卡片<strong>拖拉到另一個卡片上方</strong>，即可合併。系統會從你的整理方式中學習。
            </p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>你的整理方式會成為 AI 的學習資料</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-6 p-4 bg-white rounded-2xl border border-border">
          <div>
            <p className="text-xs text-muted-foreground">議題總數</p>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>{topics.length}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">操作說明</p>
            <p className="text-xs text-foreground mt-0.5">拖拉卡片 → 放到另一卡片上 → 確認合併</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">合併後可在議題頁面手動分割</span>
          </div>
        </div>

        {/* DnD Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF5A1F]" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topics.map((topic) => (
                <DraggableTopicCard
                  key={topic.id}
                  topic={topic}
                  isOver={overTopicId === topic.id}
                  isDragging={activeTopic?.id === topic.id}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTopic ? <DragOverlayCard topic={activeTopic} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Merge Confirm Dialog */}
      <Dialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-[#FF5A1F]" />
              確認合併議題
            </DialogTitle>
            <DialogDescription>
              合併後，<strong>「{mergeDialog?.source.query}」</strong>的所有轉折點和文章將移入<strong>「{mergeDialog?.target.query}」</strong>，原議題將被刪除。此操作<strong>無法復原</strong>。
            </DialogDescription>
          </DialogHeader>

          {mergeDialog && (
            <div className="space-y-3 my-2">
              {/* Source → Target visual */}
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-500 font-semibold mb-0.5">將被刪除</p>
                  <p className="font-bold text-sm text-foreground truncate">{mergeDialog.source.query}</p>
                  <p className="text-xs text-muted-foreground">{mergeDialog.source.totalArticles} 篇文章</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Merge className="w-3.5 h-3.5" />
                  合併進入
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-600 font-semibold mb-0.5">保留</p>
                  <p className="font-bold text-sm text-foreground truncate">{mergeDialog.target.query}</p>
                  <p className="text-xs text-muted-foreground">{mergeDialog.target.totalArticles} 篇文章</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setMergeDialog(null)}
              disabled={mergeTopicsMutation.isPending}
            >
              取消
            </Button>
            <Button
              className="bg-[#FF5A1F] hover:bg-[#e04d18] text-white"
              onClick={handleConfirmMerge}
              disabled={mergeTopicsMutation.isPending}
            >
              {mergeTopicsMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />合併中...</>
              ) : (
                <><Merge className="w-4 h-4 mr-1" />確認合併</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
