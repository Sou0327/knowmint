# Phase 16 実装計画

## Context

Phase 16「運用信頼性強化」の実装。コード変更で完結するタスクを対象とする。
外部サービス設定 (Upstash DSN, Sentry DSN) は env vars のみで対応済みのため除外。

## タスク分類

### 実装対象 (コード変更のみ)
1. **16.4** `purchase/route.ts` 購入者名ハードコード修正
2. **16.3** pending TX クリーンアップ Cron 新規作成
3. **16.x** SIWS UI 統合バグ修正

### 外部操作のみ (コード完成済み)
- **16.1** Upstash Redis: `rate-limit.ts` はコード完成済み。`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars を Vercel に設定するだけ
- **16.2** Sentry: DSN 設定が必要。今回スコープ外

---

## 実装詳細

### 1. 購入者名ハードコード修正

**ファイル**: `src/app/api/v1/knowledge/[id]/purchase/route.ts`

**変更点**:
- L150-153: `walletProfiles` クエリに `display_name` を追加
  ```typescript
  .select("id, wallet_address, display_name")
  ```
- L280: `"購入者"` を buyer の display_name に置換
  ```typescript
  const buyerProfile = walletProfiles.find((p) => p.id === user.userId);
  notifyPurchase(item.seller_id, buyerProfile?.display_name || "購入者", ...)
  ```

### 2. Pending TX クリーンアップ Cron

**新規ファイル**: `src/app/api/cron/cleanup-pending-tx/route.ts`

- `GET` ハンドラー
- `Authorization: Bearer ${CRON_SECRET}` で認可 (env 未設定時はスキップ = ローカル開発用)
- `status = 'pending'` かつ `created_at < now() - 30分` のトランザクションを `failed` に更新
- `apiSuccess({ cleaned: count })` でレスポンス
- Vercel Cron 用: `vercel.json` に `{ "crons": [{ "path": "/api/cron/cleanup-pending-tx", "schedule": "*/30 * * * *" }] }` 追記

### 3. SIWS UI 統合バグ修正

**根本原因**: `WalletButton.tsx` がウォレットアダプター接続のみ行い、SIWS フロー未実装。
**認証問題**: 既存の challenge/verify routes は `withApiAuth` (API キー必須)。ブラウザ UI は Supabase セッション認証。

**対応**: Next.js Server Actions でセッション認証ベースの SIWS フローを実装。

**新規ファイル**: `src/app/actions/wallet.ts`

```typescript
"use server";
// requestWalletChallenge(wallet) → { success, nonce, message }
//   - createClient() でセッションユーザー取得
//   - getAdminClient() でwallet_challengesにupsert
// verifyWalletSignature(wallet, signatureBase64, nonce) → { success }
//   - ed25519.verify でブラウザ署名を検証
//   - consume_wallet_challenge RPC でDB更新
```

**更新ファイル**: `src/components/features/WalletButton.tsx`

追加ロジック:
1. `useAuth()` で `profile.wallet_address` を確認 (設定済みならスキップ)
2. `useEffect([connected, publicKey])` でウォレット接続検知
3. 接続かつ未登録 → `requestWalletChallenge(publicKey.toBase58())`
4. `signMessage(textEncode(message))` → base64変換
5. `verifyWalletSignature(wallet, base64sig, nonce)`
6. 成功: `updateProfile({ wallet_address })` でコンテキスト更新
7. エラー: コンポーネント内にエラー文字列表示 (Toastなし)

---

## 実装順序

独立しているため 2並列:
- Worker A: タスク1 (purchase/route.ts) + タスク2 (cron route)
- Worker B: タスク3 (wallet.ts server action + WalletButton.tsx)

---

## 検証

```bash
npm run build  # TypeScript/lint エラーがないこと
# cron動作確認: curl -H "Authorization: Bearer test" http://localhost:3000/api/cron/cleanup-pending-tx
# SIWS: ブラウザでウォレット接続 → 署名要求が出ること → DB の wallet_address が更新されること
```

---

## 変更ファイル一覧

| ファイル | 種別 |
|---------|------|
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | 変更 |
| `src/app/api/cron/cleanup-pending-tx/route.ts` | 新規 |
| `src/app/actions/wallet.ts` | 新規 |
| `src/components/features/WalletButton.tsx` | 変更 |
| `vercel.json` | 新規 (Cron設定) |
