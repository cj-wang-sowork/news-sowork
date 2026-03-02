/*
 * Navbar — SoWork NewsFlow
 * Design: Narrative Pulse | Light, minimal, brand orange accent
 * Updated: 登入狀態、點數顯示、建立議題入口
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Zap, Coins, LogOut, Plus, User, Bookmark, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useI18n, type Locale } from '@/contexts/I18nContext';

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁中',
  'zh-CN': '简中',
  'en': 'EN',
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  // 取得點數餘額（僅登入後）
  const { data: pointsData } = trpc.points.balance.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000, // 每 30 秒刷新
  });

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A1F] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-800 text-[15px] text-foreground tracking-tight" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>
                NewsFlow
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>
                by SoWork
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className={`text-sm font-medium ${location === '/' ? 'text-[#FF5A1F]' : 'text-muted-foreground hover:text-foreground'}`}>
                {t('nav.explore')}
              </Button>
            </Link>
            {user && (
              <Link href="/my-topics">
                <Button variant="ghost" size="sm" className={`text-sm font-medium flex items-center gap-1.5 ${location === '/my-topics' ? 'text-[#FF5A1F]' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Bookmark className="w-3.5 h-3.5" />
                  我的議題
                </Button>
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* 點數顯示 */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100">
                  <Coins className="w-3.5 h-3.5 text-[#FF5A1F]" />
                  <span className="text-sm font-bold text-[#FF5A1F]" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {pointsData?.points ?? 0}
                  </span>
                  <span className="text-xs text-orange-400">點</span>
                </div>

                {/* 建立議題 */}
                <Link href="/create-topic">
                  <Button size="sm" variant="outline" className="hidden md:flex items-center gap-1.5 border-[#FF5A1F] text-[#FF5A1F] hover:bg-orange-50">
                    <Plus className="w-4 h-4" />
                    建立議題
                  </Button>
                </Link>

                {/* 用戶選單 */}
                <div className="hidden md:flex items-center gap-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-50 cursor-default">
                    <div className="w-6 h-6 rounded-full bg-[#FF5A1F]/10 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#FF5A1F]" />
                    </div>
                    <span className="text-xs text-muted-foreground max-w-[80px] truncate">{user.name ?? (locale === 'en' ? 'User' : '用戶')}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => logout()}
                    className="text-muted-foreground hover:text-foreground"
                    title="登出"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <Link href="/auth/login">
                <Button
                  size="sm"
                  className="hidden md:flex bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold shadow-sm"
                >
                  {t('nav.login')} / {locale === 'en' ? 'Free' : '免費使用'}
                </Button>
              </Link>
            )}

            {/* Language switcher — always visible */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setLangOpen(v => !v)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-[#FF5A1F] hover:text-[#FF5A1F] transition-all"
              >
                <Languages className="w-3.5 h-3.5" />
                {LOCALE_LABELS[locale]}
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg py-1 z-50 min-w-[80px]">
                  {(['zh-TW', 'zh-CN', 'en'] as Locale[]).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLocale(l); setLangOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 transition-colors ${
                        locale === l ? 'text-[#FF5A1F] font-semibold' : 'text-muted-foreground'
                      }`}
                    >
                      {LOCALE_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-1">
          <Link href="/" onClick={() => setMenuOpen(false)}>
            <Button variant="ghost" className="w-full justify-start text-sm">探索話題</Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start text-sm text-muted-foreground" onClick={() => alert('Feature coming soon')}>
            訂閱追蹤
          </Button>

          {user ? (
            <>
              {/* 點數（手機版） */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100 mt-1">
                <Coins className="w-4 h-4 text-[#FF5A1F]" />
                <span className="text-sm font-bold text-[#FF5A1F]">{pointsData?.points ?? 0} 點</span>
                <span className="text-xs text-orange-400 ml-auto">{user.name ?? '用戶'}</span>
              </div>
              <Link href="/my-topics" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-sm">
                  <Bookmark className="w-4 h-4 mr-2" />
                  我的議題
                </Button>
              </Link>
              <Link href="/create-topic" onClick={() => setMenuOpen(false)}>
                <Button className="w-full mt-1 border-[#FF5A1F] text-[#FF5A1F] bg-orange-50 hover:bg-orange-100" variant="outline">
                  <Plus className="w-4 h-4 mr-1.5" />
                  建立議題
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start text-sm text-muted-foreground" onClick={() => { logout(); setMenuOpen(false); }}>
                <LogOut className="w-4 h-4 mr-2" />
                登出
              </Button>
            </>
          ) : (
            <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
              <Button className="w-full mt-2 bg-[#FF5A1F] hover:bg-[#e04d18] text-white">
                登入 / 免費使用
              </Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
