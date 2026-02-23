export const metadata = {
  title: "お問い合わせ | KnowMint",
  description: "KnowMint へのお問い合わせ",
};

const CATEGORIES = [
  {
    title: "技術的なご質問・不具合報告",
    description:
      "ログインできない、決済が完了しない、コンテンツが表示されないなどの技術的な問題はこちら。",
    action: "GitHub Issues で報告",
    href: "https://github.com/knowmint/knowmint/issues",
    isExternal: true,
  },
  {
    title: "コンテンツに関する報告",
    description:
      "利用規約違反のコンテンツ、著作権侵害の疑いがあるコンテンツ、不適切な出品についての報告はこちら。",
    action: "メールで報告",
    href: "mailto:h.client.walletapp@gmail.com",
    isExternal: true,
  },
  {
    title: "法的開示請求・個人情報に関するお問い合わせ",
    description:
      "取引DPF消費者保護法に基づく出品者情報の開示請求、個人情報の開示・訂正・削除請求等はこちら。",
    action: "メールでお問い合わせ",
    href: "mailto:h.client.walletapp@gmail.com",
    isExternal: true,
  },
  {
    title: "ビジネス・パートナーシップに関するご相談",
    description: "提携・連携・その他ビジネス上のご相談はこちら。",
    action: "メールでご連絡",
    href: "mailto:h.client.walletapp@gmail.com",
    isExternal: true,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        お問い合わせ
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        最終更新日: 2026年2月24日
      </p>

      <p className="mb-8 leading-relaxed text-zinc-700 dark:text-zinc-300">
        お問い合わせの内容に応じて、以下の窓口をご利用ください。
        なお、返信にはお時間をいただく場合があります。
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {cat.title}
            </h2>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {cat.description}
            </p>
            <a
              href={cat.href}
              target={cat.isExternal ? "_blank" : undefined}
              rel={cat.isExternal ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
            >
              {cat.action}
              {cat.isExternal && (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              )}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          取引DPF消費者保護法に基づく開示請求について
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          特定商取引法および取引デジタルプラットフォームを利用する消費者の利益の保護に関する法律（取引DPF消費者保護法）に基づき、
          出品者に関する情報の開示を請求される場合は、上記「法的開示請求」窓口までご連絡ください。
          開示請求には本人確認書類のご提出が必要です。法令の定める範囲内で対応いたします。
        </p>
      </div>

      <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <p>
          一般的なご質問については、まず{" "}
          <a
            href="/terms"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
          >
            利用規約
          </a>
          ・
          <a
            href="/privacy"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
          >
            プライバシーポリシー
          </a>
          ・
          <a
            href="/legal"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
          >
            特商法表示
          </a>
          をご確認ください。
        </p>
      </div>
    </div>
  );
}
