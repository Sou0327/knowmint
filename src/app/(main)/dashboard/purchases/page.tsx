import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPurchaseHistory } from "@/lib/dashboard/queries";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPurchasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const purchases = await getPurchaseHistory(user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dq-text">購入履歴</h1>

      {purchases.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-dq-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          <p className="text-dq-text-muted">まだ購入履歴がありません</p>
          <Link href="/" className="mt-4 inline-block text-sm text-dq-cyan hover:text-dq-gold">マーケットを見る →</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dq-border">
                <th className="pb-3 text-left font-medium text-dq-text-muted">アイテム</th>
                <th className="pb-3 text-left font-medium text-dq-text-muted">金額</th>
                <th className="pb-3 text-left font-medium text-dq-text-muted">チェーン</th>
                <th className="pb-3 text-left font-medium text-dq-text-muted">ステータス</th>
                <th className="pb-3 text-left font-medium text-dq-text-muted">日時</th>
                <th className="pb-3 text-left font-medium text-dq-text-muted">TX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dq-border">
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-dq-surface">
                  <td className="py-3 pr-4">
                    {purchase.knowledge_item ? (
                      <Link href={`/knowledge/${purchase.knowledge_item.id}`} className="font-medium text-dq-text hover:text-dq-cyan">
                        {purchase.knowledge_item.title}
                      </Link>
                    ) : (
                      <span className="text-dq-text-muted">削除されたアイテム</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-medium text-dq-text">
                    {purchase.amount} {purchase.token}
                  </td>
                  <td className="py-3 pr-4 text-dq-text-sub capitalize">
                    {purchase.chain}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={purchase.status === 'confirmed' ? 'success' : purchase.status === 'pending' ? 'warning' : 'error'}>
                      {purchase.status === 'confirmed' ? '完了' : purchase.status === 'pending' ? '処理中' : '失敗'}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-dq-text-muted whitespace-nowrap">
                    {new Date(purchase.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="py-3">
                    {purchase.tx_hash && (
                      <span className="font-mono text-xs text-dq-text-muted" title={purchase.tx_hash}>
                        {purchase.tx_hash.slice(0, 8)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
