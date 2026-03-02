/*
 * Navbar — SoWork NewsFlow
 * Design: Narrative Pulse | Light, minimal, brand orange accent
 * Updated: 登入狀態、點數顯示、建立議題入口 + 手機版 slide-in drawer
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Zap, Coins, LogOut, Plus, User, Bookmark, Languages, ChevronRight, Home, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useI18n, type Locale } from '@/contexts/I18nContext';
import { getLoginUrl } from '@/const';

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁中',
  'zh-CN': '简中',
  'en': 'EN',
};

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  // 取得點數餘額（僅登入後）
  const { data: pointsData } = trpc.points.balance.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  // 開啟 drawer 時鎖定 body scroll
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // 路由切換時關閉 drawer
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  const navLinks = [
    { href: '/', label: t('nav.explore'), icon: <Compass className="w-5 h-5" /> },
    ...(user ? [{ href: '/my-topics', label: '我的議題', icon: <Bookmark className="w-5 h-5" /> }] : []),
  ];

  return (
    <>
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

              {/* Language switcher — desktop only */}
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

              {/* Hamburger button — mobile only */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setDrawerOpen(v => !v)}
                aria-label={drawerOpen ? '關閉選單' : '開啟選單'}
              >
                {drawerOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[80vw] max-w-[320px] bg-white shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="導航選單"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#FF5A1F] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="font-bold text-[14px] text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>NewsFlow</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* User Info (if logged in) */}
        {user && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FF5A1F]/15 flex items-center justify-center flex-shrink-0">
              <User className="w-4.5 h-4.5 text-[#FF5A1F]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.name ?? '用戶'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Coins className="w-3 h-3 text-[#FF5A1F]" />
                <span className="text-xs font-bold text-[#FF5A1F]">{pointsData?.points ?? 0} 點</span>
              </div>
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location === link.href
                    ? 'bg-orange-50 text-[#FF5A1F]'
                    : 'text-foreground hover:bg-gray-50'
                }`}
              >
                <span className={location === link.href ? 'text-[#FF5A1F]' : 'text-muted-foreground'}>
                  {link.icon}
                </span>
                {link.label}
                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50" />
              </button>
            </Link>
          ))}

          {/* 建立議題 CTA */}
          {user && (
            <Link href="/create-topic">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-[#FF5A1F] text-white mt-2 hover:bg-[#e04d18] transition-colors">
                <Plus className="w-5 h-5" />
                建立議題
                <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
              </button>
            </Link>
          )}

          {!user && (
            <a href={getLoginUrl()}>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-[#FF5A1F] text-white mt-2 hover:bg-[#e04d18] transition-colors">
                <User className="w-5 h-5" />
                登入 / 免費使用
                <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
              </button>
            </a>
          )}
        </nav>

        {/* Drawer Footer */}
        <div className="px-4 py-4 border-t border-border space-y-2">
          {/* Language Switcher */}
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground mr-auto">語言</span>
            <div className="flex items-center gap-1">
              {(['zh-TW', 'zh-CN', 'en'] as Locale[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    locale === l
                      ? 'bg-[#FF5A1F] text-white font-semibold'
                      : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
                  }`}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Logout */}
          {user && (
            <button
              onClick={() => { logout(); setDrawerOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          )}
        </div>
      </div>
    </>
  );
}
