/*
 * Navbar — SoWork NewsFlow
 * Design: Narrative Pulse | Light, minimal, brand orange accent
 * Updated: 登入狀態、點數顯示、建立議題入口
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Globe, Menu, X, Zap, Coins, LogOut, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // 取得點數餘額（僅登入後）
  const { data: pointsData } = trpc.points.balance.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000, // 每 30 秒刷新
  });

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

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
                探索話題
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => alert('Feature coming soon')}>
              訂閱追蹤
            </Button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Globe className="w-4 h-4" />
              <span className="text-sm">繁中</span>
            </Button>

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
                    <span className="text-xs text-muted-foreground max-w-[80px] truncate">{user.name ?? '用戶'}</span>
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
              <Button
                size="sm"
                className="hidden md:flex bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold shadow-sm"
                onClick={handleLogin}
              >
                登入 / 免費使用
              </Button>
            )}

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
            <Button className="w-full mt-2 bg-[#FF5A1F] hover:bg-[#e04d18] text-white" onClick={handleLogin}>
              登入 / 免費使用
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
