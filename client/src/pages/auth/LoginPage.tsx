/*
 * LoginPage — SoWork NewsFlow
 * Design: Narrative Pulse | Clean, minimal auth form
 * Supports: Email/Password login + Manus OAuth redirect
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Zap, Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { useEffect } from 'react';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate('/');
    },
    onError: (err) => {
      setError(err.message || '登入失敗，請稍後再試');
    },
  });

  // 若已登入，跳回首頁
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('請填寫所有欄位');
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleManusLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A1F] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div className="flex flex-col leading-none text-left">
              <span className="font-display font-800 text-[18px] text-foreground tracking-tight" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>
                NewsFlow
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>
                by SoWork
              </span>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground" style={{ fontFamily: 'Sora, Noto Sans TC, sans-serif' }}>
            歡迎回來
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            登入以追蹤議題、賺取點數
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
          {/* Manus OAuth Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-semibold border-border hover:border-[#FF5A1F] hover:text-[#FF5A1F] transition-colors"
            onClick={handleManusLogin}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#FF5A1F" opacity="0.15"/>
              <path d="M12 6l4 6-4 6-4-6 4-6z" fill="#FF5A1F"/>
            </svg>
            使用 Manus 帳號登入
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-muted-foreground">或使用 Email 登入</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-9 h-11"
                  autoComplete="email"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                密碼
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="輸入密碼"
                  className="pl-9 pr-10 h-11"
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#FF5A1F] hover:bg-[#e04d18] text-white font-semibold shadow-sm"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登入中...
                </>
              ) : '登入'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          還沒有帳號？{' '}
          <Link href="/auth/register" className="text-[#FF5A1F] font-semibold hover:underline">
            免費註冊
          </Link>
        </p>
      </div>
    </div>
  );
}
