/*
 * Navbar — SoWork NewsFlow
 * Design: Narrative Pulse | Light, minimal, brand orange accent
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Globe, Menu, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

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
            <Link href="/timeline/iran-war">
              <Button variant="ghost" size="sm" className={`text-sm font-medium ${location.startsWith('/timeline') ? 'text-[#FF5A1F]' : 'text-muted-foreground hover:text-foreground'}`}>
                時間軸
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
            <Button
              size="sm"
              className="hidden md:flex bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold shadow-sm"
              onClick={() => alert('Feature coming soon')}
            >
              免費使用
            </Button>
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
          <Link href="/timeline/iran-war" onClick={() => setMenuOpen(false)}>
            <Button variant="ghost" className="w-full justify-start text-sm">時間軸</Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start text-sm text-muted-foreground" onClick={() => alert('Feature coming soon')}>
            訂閱追蹤
          </Button>
          <Button className="w-full mt-2 bg-[#FF5A1F] hover:bg-[#e04d18] text-white" onClick={() => alert('Feature coming soon')}>
            免費使用
          </Button>
        </div>
      )}
    </header>
  );
}
