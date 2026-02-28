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
