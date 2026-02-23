export const metadata = {
  title: "特定商取引法に基づく表示 | KnowMint",
  description: "KnowMint の特定商取引法に基づく表示",
};

const LEGAL_ITEMS = [
  {
    label: "販売事業者名",
    value: "KnowMint 運営事務局",
  },
  {
    label: "所在地",
    value: "東京都（詳細は開示請求によりご案内します）",
  },
  {
    label: "連絡先",
    value: "お問い合わせページよりご連絡ください",
    isLink: true,
    href: "/contact",
  },
  {
    label: "代表責任者",
    value: "KnowMint 運営者",
  },
  {
    label: "販売価格",
    value:
      "各知識アイテムの詳細ページに SOL・USDC 等の暗号資産建てで表示します。円換算額は暗号資産の市場価格により変動します。",
  },
  {
    label: "販売価格以外の必要料金",
    value:
      "ブロックチェーンネットワークのトランザクション手数料（ガス代）が別途必要です。手数料はネットワークの混雑状況により変動します。",
  },
  {
    label: "商品の引渡時期",
    value:
      "決済トランザクションが確認された後、即時にデジタルコンテンツへのアクセスが提供されます。",
  },
  {
    label: "支払方法",
    value:
      "Solana ネットワークを利用した暗号資産（SOL、USDC）による決済。将来的に EVM チェーン（Base、Ethereum）への対応を予定。",
  },
  {
    label: "返品・返金について",
    value:
      "デジタルコンテンツの性質上、コンテンツ開示後の返品・返金は原則として承っておりません。ただし、コンテンツが説明と著しく異なる場合等の例外については利用規約をご参照ください。",
    isLink: true,
    href: "/terms",
    linkText: "利用規約",
  },
  {
    label: "動作環境",
    value:
      "最新版の Chrome、Firefox、Safari、Edge 等のウェブブラウザ。Solana 対応ウォレット（Phantom、Solflare 等）が必要です。",
  },
  {
    label: "コンテンツ形式",
    value:
      "テキスト形式のデジタルコンテンツ（プロンプト、ツール定義、データセット、API 仕様、一般知識等）。",
  },
  {
    label: "事業者の種別",
    value:
      "本サービスはデジタルコンテンツの取引プラットフォームです。個々のコンテンツの販売者は登録ユーザー（出品者）です。当社はマーケットプレイスの提供者であり、個々の取引の当事者ではありません。",
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        特定商取引法に基づく表示
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        最終更新日: 2026年2月24日
      </p>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {LEGAL_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-4"
            >
              <dt className="w-full shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300 sm:w-44">
                {item.label}
              </dt>
              <dd className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.isLink && item.href ? (
                  item.linkText ? (
                    <>
                      {item.value.split(item.linkText)[0]}
                      <a
                        href={item.href}
                        className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {item.linkText}
                      </a>
                      {item.value.split(item.linkText)[1] ?? ""}
                    </>
                  ) : (
                    <a
                      href={item.href}
                      className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {item.value}
                    </a>
                  )
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
        <p className="font-medium">注意事項</p>
        <p className="mt-1 leading-relaxed">
          暗号資産による決済は価格変動リスクを伴います。送金ミスの場合、当社は返金・補償を行いかねますので、
          送金前に必ず宛先ウォレットアドレスをご確認ください。
          本サービスはノンカストディアル（非管理型）であり、当社は利用者の秘密鍵を管理しません。
        </p>
      </div>
    </div>
  );
}
