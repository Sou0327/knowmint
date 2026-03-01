import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const linkClass =
  "text-sm text-dq-cyan hover:text-dq-gold hover:underline underline-offset-4 transition-colors duration-200";

export async function Footer() {
  const t = await getTranslations('Footer');
  const tNav = await getTranslations('Nav');
  return (
    <footer className="border-t-3 border-dq-border-outer bg-dq-window-bg">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-lg font-bold font-display tracking-wide">
              <span className="text-dq-gold text-glow-gold">
                ◆ KnowMint
              </span>
            </h3>
            <p className="mt-2 text-sm text-dq-text-sub">
              {t('tagline')}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://x.com/gensou_ongaku"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dq-cyan hover:text-dq-gold transition-colors duration-200 flex items-center gap-1"
                aria-label="X @gensou_ongaku"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                @gensou_ongaku
              </a>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-sm font-semibold font-display text-dq-gold">
              {t('platform')}
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/" className={linkClass}>
                  {tNav('market')}
                </Link>
              </li>
              <li>
                <Link href="/search" className={linkClass}>
                  {t('categories')}
                </Link>
              </li>
              <li>
                <Link href="/list" className={linkClass}>
                  {tNav('listItem')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-sm font-semibold font-display text-dq-gold">
              {t('support')}
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <span className="cursor-default text-sm text-dq-text-muted">
                  {t('helpComingSoon')}
                </span>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-semibold font-display text-dq-gold">
              {t('legal')}
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/terms" className={linkClass}>
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/legal" className={linkClass}>
                  {t('commercialLaw')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 border-t-2 border-dq-border pt-8">
          <p className="text-center text-xs text-dq-text-muted">
            &copy; 2026 KnowMint. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
