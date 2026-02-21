'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/features/NotificationBell';
import WalletButton from '@/components/features/WalletButton';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, loading } = useAuth();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600" />
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Knowledge Market
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="relative text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 hover:after:w-full after:transition-all after:duration-300"
            >
              マーケット
            </Link>
            <Link
              href="/list"
              className="relative text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 hover:after:w-full after:transition-all after:duration-300"
            >
              出品する
            </Link>
            <Link
              href="/library"
              className="relative text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 hover:after:w-full after:transition-all after:duration-300"
            >
              マイライブラリ
            </Link>
            <Link
              href="/dashboard"
              className="relative text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-600 hover:after:w-full after:transition-all after:duration-300"
            >
              ダッシュボード
            </Link>
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <form
              className="w-full"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const query = formData.get('q') as string;
                if (query) {
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                }
              }}
            >
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  placeholder="検索..."
                  className="w-full px-4 py-2 pl-10 text-sm border border-zinc-300 rounded-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-white"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </form>
          </div>

          {/* Right side: Wallet & User Menu */}
          <div className="hidden md:flex items-center gap-3">
            <WalletButton />
            <NotificationBell />

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                aria-label="ユーザーメニュー"
                aria-expanded={userMenuOpen}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg">
                  {loading ? (
                    <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      読み込み中...
                    </div>
                  ) : user ? (
                    <>
                      <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {profile?.display_name || user.email || 'ユーザー'}
                        </p>
                        {user.email && (
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {user.email}
                          </p>
                        )}
                      </div>
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        プロフィール
                      </Link>
                      <button
                        type="button"
                        className="block w-full rounded-b-lg px-4 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-700"
                        onClick={handleSignOut}
                      >
                        ログアウト
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-t-lg"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        ログイン
                      </Link>
                      <Link
                        href="/signup"
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-b-lg"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        サインアップ
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 text-zinc-700 dark:text-zinc-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={mobileMenuOpen}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-zinc-200/60 dark:border-zinc-800/60 transition-all duration-300">
            {/* Mobile Search */}
            <div className="mb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const query = formData.get('q') as string;
                  if (query) {
                    router.push(`/search?q=${encodeURIComponent(query)}`);
                    setMobileMenuOpen(false);
                  }
                }}
              >
                <input
                  type="text"
                  name="q"
                  placeholder="検索..."
                  className="w-full px-4 py-2 text-sm border border-zinc-300 rounded-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-white"
                />
              </form>
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col gap-2">
              <Link
                href="/"
                className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                マーケット
              </Link>
              <Link
                href="/list"
                className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                出品する
              </Link>
              <Link
                href="/library"
                className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                マイライブラリ
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                ダッシュボード
              </Link>
              <div className="border-t border-zinc-200/60 dark:border-zinc-800/60 my-2" />
              {loading ? (
                <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  読み込み中...
                </div>
              ) : user ? (
                <>
                  <Link
                    href="/profile"
                    className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    プロフィール
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-left text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
                    onClick={handleSignOut}
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    サインアップ
                  </Link>
                </>
              )}
              <div className="mt-2">
                <WalletButton />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
