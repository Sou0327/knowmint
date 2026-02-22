# Phase 27: 購入フロー有効化 `cc:DONE`

> 購入ボタンの onClick が未接続だったため機能しなかった問題を解消。
> PurchaseModal は完全実装済み。Client Component への分離・Server Action の新規作成が主作業。

## 実装概要

### 27.1 queries.ts — seller に wallet_address 追加
- `src/lib/knowledge/queries.ts:130` の seller select に `wallet_address` を追加

### 27.2 購入フロー実装

**`src/app/actions/purchase.ts`** (新規 — Server Action)
- `transactions` テーブルに挿入（正しいスキーマ、`purchases` ではない）
- Zod で `chain+token` 組み合わせ検証 (`solana→SOL|USDC`, `base|ethereum→ETH`)
- EVM 購入は `chain !== "solana"` で明示拒否（既存 API route と同様）
- `isValidSolanaTxHash` で tx_hash フォーマット検証
- `maybeSingle()` + `buyer_id` 検証による冪等性チェック
- 23505 unique violation 時に再 SELECT で正確な成否判定
- DB から `seller_id`, `amount` を取得（クライアント値不使用）

**`src/components/features/PurchaseSection.tsx`** (新規 — Client Component)
- DB 記録完了後にモーダルクローズ（失敗時は throw → PurchaseModal の setError で表示）
- `onPurchaseComplete(txHash, chain, token): Promise<void>` で chain/token を Server Action へ伝播

**`src/components/features/PurchaseModal.tsx`** (修正)
- `onPurchaseComplete` を `Promise<void>` に変更し `await` 追加
- EVM チェーン選択時に購入ボタン無効化 + 準備中メッセージ表示

**`src/app/(main)/knowledge/[id]/page.tsx`** (修正)
- 静的ボタン → `PurchaseSection` 差し替え
- `SellerData` 型を一元定義 + Supabase join 型推論限界対応のランタイムガード追加

### 27.3 動作確認（手動）
- [ ] devnet でウォレット接続 → SOL 購入フローが通ること確認
- [ ] 購入後 `/library/[id]` でコンテンツが表示されること確認

## Codex レビュー結果
- 3ラウンド実施 → **ISSUES_FOUND: 0**
- 主な修正: `purchases`→`transactions`テーブル修正、chain/token組み合わせ検証、冪等性強化、モーダルクローズタイミング修正
