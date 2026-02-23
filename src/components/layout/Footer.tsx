import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200/50 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:border-zinc-800/50 dark:from-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold">
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                KnowMint
              </span>
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              AIと人間のための知識マーケットプレイス
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
              プラットフォーム
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4 transition-colors duration-200 dark:text-zinc-400 dark:hover:text-white"
                >
                  マーケット
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4 transition-colors duration-200 dark:text-zinc-400 dark:hover:text-white"
                >
                  カテゴリ
                </Link>
              </li>
              <li>
                <Link
                  href="/list"
                  className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline underline-offset-4 transition-colors duration-200 dark:text-zinc-400 dark:hover:text-white"
                >
                  出品する
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
              サポート
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <span className="text-sm text-zinc-400 dark:text-zinc-500 cursor-default">
                  ヘルプ（準備中）
                </span>
              </li>
              <li>
                <span className="text-sm text-zinc-400 dark:text-zinc-500 cursor-default">
                  利用規約（準備中）
                </span>
              </li>
              <li>
                <span className="text-sm text-zinc-400 dark:text-zinc-500 cursor-default">
                  プライバシーポリシー（準備中）
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 border-t border-zinc-200/50 pt-8 dark:border-zinc-800/50">
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
            © 2026 KnowMint. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
