export const metadata = {
  title: "利用規約 | KnowMint",
  description: "KnowMint の利用規約",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        利用規約
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        最終更新日: 2026年2月24日
      </p>

      <div className="space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第1条（サービス概要）
          </h2>
          <p className="leading-relaxed">
            KnowMint（以下「本サービス」）は、人間の暗黙知・体験知をデジタルコンテンツとして出品・購入できるナレッジマーケットプレイスです。
            運営者（以下「当社」）は、ユーザー間の取引の場を提供しますが、取引の当事者は出品者と購入者であり、当社は取引の当事者となりません。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第2条（利用登録）
          </h2>
          <p className="leading-relaxed">
            本サービスの利用には、有効なアカウントの作成が必要です。登録情報は正確かつ最新の情報を提供してください。
            アカウントの管理は利用者自身の責任で行うものとし、不正利用が判明した場合は直ちに当社に通知してください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第3条（禁止事項）
          </h2>
          <p className="mb-2 leading-relaxed">以下の行為を禁止します。</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>虚偽情報の出品・提供</li>
            <li>他者の著作権・知的財産権を侵害するコンテンツの出品</li>
            <li>違法または公序良俗に反するコンテンツの出品</li>
            <li>本サービスのシステムへの不正アクセスまたは妨害行為</li>
            <li>マネーロンダリングその他の違法な資金移動</li>
            <li>スパム・フィッシング・詐欺行為</li>
            <li>未成年者を欺く行為</li>
            <li>本サービスを通じた不正競争行為</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第4条（デジタルコンテンツの返金ポリシー）
          </h2>
          <p className="mb-2 leading-relaxed">
            デジタルコンテンツの性質上、購入後のコンテンツ開示が完了した場合は原則として返金を行いません。
          </p>
          <p className="mb-2 leading-relaxed">
            ただし、以下の場合に限り、出品者と当社が協議の上で対応を検討します。
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>購入したコンテンツが出品説明と著しく異なる場合</li>
            <li>技術的障害により購入者がコンテンツにアクセスできない場合</li>
            <li>出品者が虚偽の説明を行ったことが確認された場合</li>
          </ul>
          <p className="mt-2 leading-relaxed">
            なお、暗号資産による送金が完了した後の取引キャンセルは技術的に困難であるため、購入前に十分ご確認ください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第5条（暗号資産決済に関する免責）
          </h2>
          <p className="mb-2 leading-relaxed">
            本サービスは Solana 等のブロックチェーンネットワークを利用した暗号資産（SOL、USDC 等）による決済に対応しています。
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              暗号資産の価格は著しく変動することがあり、購入時点の円換算価値を保証しません。
            </li>
            <li>
              ウォレットアドレスの入力誤りによる送金ミスについて、当社は一切責任を負いません。
              送金前に必ず宛先アドレスをご確認ください。
            </li>
            <li>
              ブロックチェーンネットワークの障害・遅延・手数料変動は当社の制御外であり、当社は責任を負いません。
            </li>
            <li>
              送金完了後の取引は原則として取り消しできません。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第6条（ノンカストディアル決済）
          </h2>
          <p className="leading-relaxed">
            当社は利用者のウォレットの秘密鍵を管理しません。決済は購入者のウォレットから出品者のウォレットへの P2P（ピアツーピア）直接送金です。
            当社はトランザクションハッシュの検証と記録のみを行い、資金の管理・保管は行いません。
            秘密鍵の管理はユーザー自身の責任で行ってください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第7条（知的財産権）
          </h2>
          <p className="leading-relaxed">
            出品者は、出品するコンテンツについて必要な権利を保有または権限を取得していることを保証します。
            購入者は、購入したコンテンツを個人的・業務的目的で利用できますが、第三者への無断再配布・再販売は禁止します。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第8条（免責事項）
          </h2>
          <p className="mb-2 leading-relaxed">
            当社は、以下について責任を負いません。
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>出品コンテンツの品質・正確性・有用性に関する一切の保証</li>
            <li>ユーザー間の取引に起因するトラブル</li>
            <li>
              天災、通信障害、サイバー攻撃等、当社の合理的な制御の及ばない事由による損害
            </li>
            <li>本サービスの一時的な停止・終了による損害</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第9条（サービスの変更・終了）
          </h2>
          <p className="leading-relaxed">
            当社は、ユーザーへの事前通知をもって本サービスの内容を変更または終了することができます。
            やむを得ない事情がある場合は事前通知なく変更または停止する場合があります。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第10条（準拠法・管轄裁判所）
          </h2>
          <p className="leading-relaxed">
            本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            第11条（規約の改定）
          </h2>
          <p className="leading-relaxed">
            当社は必要に応じ、本規約を改定することがあります。改定後の規約は本サービス上に掲示した時点から効力を生じ、
            改定後に本サービスを利用したユーザーは改定後の規約に同意したものとみなします。
          </p>
        </section>
      </div>
    </div>
  );
}
