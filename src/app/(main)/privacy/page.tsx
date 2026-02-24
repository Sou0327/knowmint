export const metadata = {
  title: "プライバシーポリシー | KnowMint",
  description: "KnowMint のプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-dq-gold">
        プライバシーポリシー
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">
        最終更新日: 2026年2月24日
      </p>

      <div className="font-legal space-y-8 text-dq-text-sub">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            1. 収集する情報
          </h2>
          <p className="mb-2 leading-relaxed">
            本サービスは以下の情報を収集・保管します。
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dq-border rounded-sm border border-dq-border text-sm">
              <thead className="bg-dq-surface">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-dq-text-sub">
                    データ種別
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-dq-text-sub">
                    収集目的
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dq-border bg-dq-window-bg">
                {[
                  ["メールアドレス", "アカウント認証・通知送信"],
                  ["ウォレットアドレス", "決済処理・取引記録"],
                  ["APIキー（SHA-256ハッシュ）", "API認証（平文は保存しません）"],
                  ["取引履歴・tx_hash", "決済検証・コンテンツ提供"],
                  ["出品コンテンツ", "マーケットプレイス運営"],
                  ["閲覧・購入履歴", "レコメンデーション・統計"],
                  ["IPアドレス", "レート制限・不正アクセス防止"],
                ].map(([type, purpose]) => (
                  <tr key={type}>
                    <td className="px-4 py-2.5 text-dq-text-sub">
                      {type}
                    </td>
                    <td className="px-4 py-2.5 text-dq-text-sub">
                      {purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            2. 情報の利用目的
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>アカウント作成・認証・管理</li>
            <li>取引の処理・検証・記録</li>
            <li>不正利用・セキュリティ脅威の検知・防止</li>
            <li>サービス品質の向上・機能改善</li>
            <li>法令上の義務の履行</li>
            <li>利用規約違反への対応</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            3. Cookie・アナリティクス
          </h2>
          <p className="leading-relaxed">
            本サービスはセッション管理のために Cookie を使用します。アクセス解析には Supabase の組み込み統計機能を使用する場合があります。
            外部広告ネットワークへの情報提供は行いません。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            4. 第三者への提供
          </h2>
          <p className="mb-2 leading-relaxed">
            当社は原則として個人情報を第三者に提供しません。ただし、以下の場合を除きます。
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく開示請求がある場合</li>
            <li>人の生命・身体または財産の保護のために必要な場合</li>
          </ul>
          <p className="mt-2 leading-relaxed">
            なお、本サービスはインフラとして Supabase（PostgreSQL クラウドサービス）を利用しています。
            Supabase のプライバシーポリシーは Supabase 社のウェブサイトをご参照ください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            5. データの保管・セキュリティ
          </h2>
          <p className="leading-relaxed">
            個人情報は Supabase が管理するデータベースに保管され、行レベルセキュリティ（RLS）により保護されています。
            APIキーは SHA-256 ハッシュ形式でのみ保存し、平文での保存は行いません。
            不要になったデータは適切に削除します。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            6. ユーザーの権利
          </h2>
          <p className="mb-2 leading-relaxed">
            ユーザーは以下の権利を有します。
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>保有する個人情報の開示請求</li>
            <li>不正確な情報の訂正請求</li>
            <li>個人情報の削除請求（法令上の保存義務がある場合を除く）</li>
            <li>個人情報処理の制限請求</li>
          </ul>
          <p className="mt-2 leading-relaxed">
            これらの請求は下記お問い合わせ先までご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            7. ポリシーの変更
          </h2>
          <p className="leading-relaxed">
            本ポリシーは必要に応じて改定することがあります。重要な変更がある場合はサービス内でお知らせします。
            継続してサービスを利用することで、改定後のポリシーに同意したものとみなします。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            8. お問い合わせ
          </h2>
          <p className="leading-relaxed">
            個人情報の取り扱いに関するご質問・開示請求等は、
            <a
              href="/contact"
              className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
            >
              お問い合わせページ
            </a>
            よりご連絡ください。
          </p>
        </section>
      </div>
    </div>
  );
}
