import Link from 'next/link';

const linkClass =
  "text-sm text-dq-cyan hover:text-dq-gold hover:underline underline-offset-4 transition-colors duration-200";

export function Footer() {
  return (
    <footer className="border-t-3 border-dq-border-outer bg-dq-window-bg">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-lg font-bold">
              <span className="text-dq-gold">
                ◆ KnowMint
              </span>
            </h3>
            <p className="mt-2 text-sm text-dq-text-sub">
              AIと人間のための知識マーケットプレイス
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-sm font-semibold text-dq-gold">
              プラットフォーム
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/" className={linkClass}>
                  マーケット
                </Link>
              </li>
              <li>
                <Link href="/search" className={linkClass}>
                  カテゴリ
                </Link>
              </li>
              <li>
                <Link href="/list" className={linkClass}>
                  出品する
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-sm font-semibold text-dq-gold">
              サポート
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <span className="cursor-default text-sm text-dq-text-muted">
                  ヘルプ（準備中）
                </span>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  お問い合わせ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-semibold text-dq-gold">
              法的情報
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/terms" className={linkClass}>
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/legal" className={linkClass}>
                  特定商取引法表示
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
