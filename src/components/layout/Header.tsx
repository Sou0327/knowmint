'use client';

import { Link } from "@/i18n/navigation";
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import NotificationBell from '@/components/features/NotificationBell';
import LanguageToggle from '@/components/i18n/LanguageToggle';

const WalletButton = dynamic(() => import('@/components/features/WalletButton'), { ssr: false });
import { ThemeToggle } from '@/components/features/ThemeToggle';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePopover } from '@/hooks/usePopover';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const {
    open: userMenuOpen,
    close: closeUserMenu,
    toggle: toggleUserMenu,
    triggerRef: userMenuTriggerRef,
    panelRef: userMenuPanelRef,
  } = usePopover();
  const { user, profile, signOut, loading } = useAuth();
  const t = useTranslations('Nav');

  const handleSignOut = async () => {
    await signOut();
    closeUserMenu();
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
    onAfter?: () => void,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get('q') ?? '').trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      onAfter?.();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-3 border-dq-border-outer bg-dq-window-bg supports-[backdrop-filter]:bg-dq-window-bg/95 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold font-display tracking-wide">
              <span className="text-dq-gold">◆</span>
              <span className="text-dq-gold text-glow-gold">
                KnowMint
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className="group px-3 py-3 text-sm text-dq-text-sub hover:text-dq-gold transition-colors"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity dq-cursor mr-1">▶</span>
              {t('market')}
            </Link>
            <Link
              href="/list"
              className="group px-3 py-3 text-sm text-dq-text-sub hover:text-dq-gold transition-colors"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity dq-cursor mr-1">▶</span>
              {t('listItem')}
            </Link>
            <Link
              href="/library"
              className="group px-3 py-3 text-sm text-dq-text-sub hover:text-dq-gold transition-colors"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity dq-cursor mr-1">▶</span>
              {t('myLibrary')}
            </Link>
            <Link
              href="/dashboard"
              className="group px-3 py-3 text-sm text-dq-text-sub hover:text-dq-gold transition-colors"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity dq-cursor mr-1">▶</span>
              {t('dashboard')}
            </Link>
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <form
              role="search"
              className="w-full"
              onSubmit={(e) => handleSearchSubmit(e)}
            >
              <label htmlFor="site-search-desktop" className="sr-only">
                {t('search')}
              </label>
              <div className="relative">
                <input
                  id="site-search-desktop"
                  type="search"
                  name="q"
                  placeholder={t('search')}
                  aria-label={t('search')}
                  className="w-full px-4 py-2 pl-10 text-sm border-2 border-dq-border rounded-sm bg-dq-surface text-dq-text placeholder:text-dq-text-muted focus:outline-none focus:ring-2 focus:ring-dq-gold focus:border-dq-gold transition-colors"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dq-text-muted"
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
            <ThemeToggle />
            <LanguageToggle compact />
            <WalletButton />
            <NotificationBell />

            {/* User Menu */}
            <div className="relative">
              <button
                ref={userMenuTriggerRef}
                type="button"
                onClick={toggleUserMenu}
                className="flex items-center gap-2 text-dq-text-sub hover:text-dq-gold transition-colors focus:outline-none focus:ring-2 focus:ring-dq-gold rounded-sm"
                aria-label={t('userMenu')}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {profile?.avatar_url ? (
                  <UserAvatar userId={profile.id} displayName={profile.display_name} avatarUrl={profile.avatar_url} size="sm" />
                ) : (
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
                )}
              </button>
              {userMenuOpen && (
                <div
                  ref={userMenuPanelRef}
                  role="menu"
                  aria-label={t('userMenu')}
                  className="absolute right-0 mt-2 w-48 dq-window-sm"
                >
                  {loading ? (
                    <div className="px-4 py-2 text-sm text-dq-text-muted">
                      Loading...
                    </div>
                  ) : user ? (
                    <>
                      <div className="border-b-2 border-dq-border px-4 py-2.5">
                        <p className="truncate text-sm font-medium text-dq-text">
                          {profile?.display_name || user.email || 'User'}
                        </p>
                        {user.email && (
                          <p className="truncate text-xs text-dq-text-muted">
                            {user.email}
                          </p>
                        )}
                      </div>
                      <Link
                        role="menuitem"
                        href="/profile"
                        className="group flex items-center px-4 py-2.5 text-sm text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface"
                        onClick={closeUserMenu}
                      >
                        <span className="opacity-0 group-hover:opacity-100 mr-1 dq-cursor">▶</span>
                        {t('profile')}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="group flex w-full items-center px-4 py-2.5 text-left text-sm text-dq-red hover:bg-dq-surface"
                        onClick={handleSignOut}
                      >
                        <span className="opacity-0 group-hover:opacity-100 mr-1 dq-cursor">▶</span>
                        {t('logout')}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        role="menuitem"
                        href="/login"
                        className="group flex items-center px-4 py-2.5 text-sm text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface"
                        onClick={closeUserMenu}
                      >
                        <span className="opacity-0 group-hover:opacity-100 mr-1 dq-cursor">▶</span>
                        {t('login')}
                      </Link>
                      <Link
                        role="menuitem"
                        href="/signup"
                        className="group flex items-center px-4 py-2.5 text-sm text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface"
                        onClick={closeUserMenu}
                      >
                        <span className="opacity-0 group-hover:opacity-100 mr-1 dq-cursor">▶</span>
                        {t('signup')}
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
            className="md:hidden p-2.5 text-dq-text-sub hover:text-dq-gold"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
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
          <div className="md:hidden py-4 border-t-2 border-dq-border transition-all duration-300">
            {/* Mobile Search */}
            <div className="mb-4">
              <form
                role="search"
                onSubmit={(e) => handleSearchSubmit(e, () => setMobileMenuOpen(false))}
              >
                <label htmlFor="site-search-mobile" className="sr-only">
                  {t('search')}
                </label>
                <input
                  id="site-search-mobile"
                  type="search"
                  name="q"
                  placeholder={t('search')}
                  aria-label={t('search')}
                  className="w-full px-4 py-2 text-sm border-2 border-dq-border rounded-sm bg-dq-surface text-dq-text placeholder:text-dq-text-muted focus:outline-none focus:ring-2 focus:ring-dq-gold focus:border-dq-gold transition-colors"
                />
              </form>
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col gap-1">
              <Link
                href="/"
                className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                {t('market')}
              </Link>
              <Link
                href="/list"
                className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                {t('listItem')}
              </Link>
              <Link
                href="/library"
                className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                {t('myLibrary')}
              </Link>
              <Link
                href="/dashboard"
                className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                {t('dashboard')}
              </Link>
              <div className="border-t-2 border-dq-border my-2" />
              {loading ? (
                <div className="px-4 py-2 text-sm text-dq-text-muted">
                  Loading...
                </div>
              ) : user ? (
                <>
                  <Link
                    href="/profile"
                    className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                    {t('profile')}
                  </Link>
                  <button
                    type="button"
                    className="group flex items-center rounded-sm px-4 py-2.5 text-left text-dq-red hover:bg-dq-surface"
                    onClick={handleSignOut}
                  >
                    <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                    {t('login')}
                  </Link>
                  <Link
                    href="/signup"
                    className="group flex items-center px-4 py-2.5 text-dq-text-sub hover:text-dq-gold hover:bg-dq-surface rounded-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="opacity-0 group-hover:opacity-100 mr-2 dq-cursor">▶</span>
                    {t('signup')}
                  </Link>
                </>
              )}
              <div className="mt-2 flex items-center gap-3">
                <WalletButton />
                <LanguageToggle compact />
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
