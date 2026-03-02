/*
 * RegisterPage — SoWork NewsFlow
 * Design: Narrative Pulse | Clean, minimal auth form
 * Supports: Email/Password registration
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Zap, Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate('/');
    },
    onError: (err) => {
      setError(err.message || '註冊失敗，請稍後再試');
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
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('請填寫所有欄位');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    registerMutation.mutate({ email: email.trim(), password, name: name.trim() });
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
            免費加入 NewsFlow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            追蹤全球議題，獲得 100 歡迎點數
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
            使用 Manus 帳號快速加入
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-muted-foreground">或使用 Email 註冊</span>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                姓名 / 暱稱
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="您的名字"
                  className="pl-9 h-11"
                  autoComplete="name"
                  disabled={registerMutation.isPending}
                />
              </div>
            </div>

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
                  disabled={registerMutation.isPending}
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
                  placeholder="至少 8 個字元"
                  className="pl-9 pr-10 h-11"
                  autoComplete="new-password"
                  disabled={registerMutation.isPending}
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

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                確認密碼
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再次輸入密碼"
                  className="pl-9 h-11"
                  autoComplete="new-password"
                  disabled={registerMutation.isPending}
                />
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  建立帳號中...
                </>
              ) : '建立帳號，獲得 100 點'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              點擊「建立帳號」即表示您同意我們的服務條款與隱私政策
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          已有帳號？{' '}
          <Link href="/auth/login" className="text-[#FF5A1F] font-semibold hover:underline">
            立即登入
          </Link>
        </p>
      </div>
    </div>
  );
}
