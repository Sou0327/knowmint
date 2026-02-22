# Phase 27: 購入フロー有効化 プラン

## Context

購入ボタンは UI として表示されているが `onClick` が未接続のため機能しない。
`PurchaseModal.tsx` は Solana/EVM 両対応で完全実装済み。
売り手のウォレットアドレスがクエリに含まれていないこと・ページが RSC のため
Client Component への分離が必要なことが唯一のブロッカー。

---

## 変更ファイル一覧

| # | ファイル | 変更種別 |
|---|---------|---------|
| 1 | `src/lib/knowledge/queries.ts` | 修正 (wallet_address 追加) |
| 2 | `src/app/actions/purchase.ts` | 新規作成 (Server Action) |
| 3 | `src/components/features/PurchaseSection.tsx` | 新規作成 (Client Component) |
| 4 | `src/app/(main)/knowledge/[id]/page.tsx` | 修正 (静的ボタン → PurchaseSection 差し替え) |

---

## Step 1 — queries.ts: seller に wallet_address を追加

**ファイル**: `src/lib/knowledge/queries.ts:130`

```diff
- seller:profiles!seller_id(id, display_name, avatar_url, trust_score, bio, user_type),
+ seller:profiles!seller_id(id, display_name, avatar_url, trust_score, bio, user_type, wallet_address),
```

Supabase 型推論により `data.seller.wallet_address: string | null` が自動的に利用可能になる
（`database.types.ts` の `Profile` に `wallet_address: string | null` が定義済み）。

---

## Step 2 — Server Action: recordPurchase

**ファイル**: `src/app/actions/purchase.ts` (新規)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  knowledgeId: z.string().uuid(),
  txHash: z.string().min(1).max(256),
  chain: z.enum(["solana", "evm"]),
});

export async function recordPurchase(
  knowledgeId: string,
  txHash: string,
  chain: "solana" | "evm"
): Promise<{ success: boolean; error?: string }> {
  const parsed = schema.safeParse({ knowledgeId, txHash, chain });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminClient();

  // 冪等性: 同一 tx_hash の購入が既にあれば成功として返す
  const { data: existing } = await admin
    .from("purchases")
    .select("id")
    .eq("tx_hash", txHash)
    .single();
  if (existing) return { success: true };

  // アイテムの存在・価格チェック
  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, status, price_sol, price_usdc")
    .eq("id", knowledgeId)
    .single();
  if (itemError || !item || item.status !== "published") {
    return { success: false, error: "Item not found or not available" };
  }
  if (item.seller_id === user.id) {
    return { success: false, error: "Cannot purchase your own item" };
  }

  // 購入レコード挿入
  const { error: insertError } = await admin.from("purchases").insert({
    knowledge_item_id: knowledgeId,
    buyer_id: user.id,
    tx_hash: txHash,
    chain,
    status: "confirmed",
  });
  if (insertError) {
    console.error("[recordPurchase] insert error", insertError);
    return { success: false, error: "Failed to record purchase" };
  }

  return { success: true };
}
```

**ポイント**:
- `createClient()` (server): ユーザーセッション取得 (RLS 適用)
- `getAdminClient()`: 購入レコード挿入 (RLS バイパス、Phase 22 パターン踏襲)
- tx_hash 冪等性チェックで二重購入防止
- 自己購入ガード

---

## Step 3 — PurchaseSection: Client Component

**ファイル**: `src/components/features/PurchaseSection.tsx` (新規)

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PurchaseModal } from "@/components/features/PurchaseModal";
import { recordPurchase } from "@/app/actions/purchase";

interface Props {
  knowledgeId: string;
  title: string;
  priceSol: number | null;
  priceUsdc: number | null;
  sellerWallet: string | null;
  isRequest: boolean;
}

export function PurchaseSection({
  knowledgeId, title, priceSol, priceUsdc, sellerWallet, isRequest,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePurchaseComplete = async (txHash: string) => {
    setIsOpen(false);
    const chain = txHash.startsWith("0x") ? "evm" : "solana";
    const result = await recordPurchase(knowledgeId, txHash, chain);
    if (!result.success) {
      console.error("[PurchaseSection] recordPurchase failed:", result.error);
    }
  };

  if (isRequest || !sellerWallet) {
    return (
      <Button variant="secondary" size="lg" className="w-full" disabled>
        {isRequest ? "募集掲載（購入不可）" : "購入する"}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        購入する
      </Button>
      <PurchaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        knowledgeId={knowledgeId}
        title={title}
        priceSol={priceSol}
        priceUsdc={priceUsdc}
        sellerWallet={sellerWallet}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </>
  );
}
```

**ポイント**:
- `sellerWallet` が null の場合はボタンを disabled (ウォレット未登録の売り手)
- `txHash.startsWith("0x")` で EVM/Solana チェーンを自動判定
- RSC ページはそのまま維持、インタラクティブ部分のみ `"use client"`

---

## Step 4 — page.tsx: 静的ボタン → PurchaseSection 差し替え

**ファイル**: `src/app/(main)/knowledge/[id]/page.tsx`

```diff
+ import { PurchaseSection } from "@/components/features/PurchaseSection";

  // 既存の静的ボタン部分を削除:
- <Button
-   variant={isRequest ? "secondary" : "primary"}
-   size="lg"
-   className="w-full"
-   disabled={isRequest}
- >
-   {isRequest ? "募集掲載（購入不可）" : "購入する"}
- </Button>
- <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
-   {isRequest ? "この掲載は情報募集です" : "ウォレット接続が必要です"}
- </p>

+ <PurchaseSection
+   knowledgeId={item.id}
+   title={item.title}
+   priceSol={item.price_sol}
+   priceUsdc={item.price_usdc}
+   sellerWallet={item.seller?.wallet_address ?? null}
+   isRequest={isRequest}
+ />
```

---

## 型安全について

`getKnowledgeById` の戻り値に `seller.wallet_address` が含まれることを
TypeScript が推論できるか確認が必要。Supabase の型推論が不完全な場合は
`KnowledgeWithSeller` 型（`src/types/knowledge.types.ts`）に `wallet_address` を追加する。

---

## 検証手順

1. `npm run build` — TypeScript エラーなし
2. `npm run lint` — lint エラーなし
3. 手動: devnet でウォレット接続 → 「購入する」ボタンクリック → モーダル開く
4. 手動: devnet 送金 → `recordPurchase` Server Action 実行 → purchases テーブルに行追加確認
5. 手動: `/library/[id]` でコンテンツ表示確認 (既存 RLS で purchases テーブルを参照しているはず)

---

## 成果物

- `src/components/features/PurchaseSection.tsx` (新規)
- `src/app/actions/purchase.ts` (新規)
- `src/lib/knowledge/queries.ts` (1行追加)
- `src/app/(main)/knowledge/[id]/page.tsx` (ボタン差し替え)
