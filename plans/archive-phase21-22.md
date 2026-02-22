# Archive: Phase 21 & 22 (完了済み)

## Phase 21: セキュリティ修正 — DB RPC 権限 & ウォレット所有証明 `cc:DONE`

> 13 ラウンドの Codex レビューを経て ISSUES_FOUND: 0 達成。

### 21.1 confirm_transaction RPC の GRANT 制限 `cc:DONE`
- `supabase/migrations/20260222000019_phase21_security_fixes.sql` でスキーマ修飾済み REVOKE ALL + GRANT service_role のみ
- RLS + API 経由以外では `pending → confirmed` 遷移が不可能なことをテストで確認（Phase 15 で対応）

### 21.2 ウォレットアドレスの一意制約と ownership 検証 `cc:DONE`
- `profiles.wallet_address` に UNIQUE 制約追加（楽観的ロック戦略 + unique_violation 限定例外処理）
- Sign-In With Solana (SIWS): `POST /api/v1/me/wallet/challenge` + `POST /api/v1/me/wallet/verify` 実装
- `consume_wallet_challenge` RPC で challenge 消費 + profile 更新を原子的に実行

**成果物**: `supabase/migrations/20260222000019_phase21_security_fixes.sql`, `src/app/api/v1/me/wallet/challenge/route.ts`, `src/app/api/v1/me/wallet/verify/route.ts`, `src/lib/siws/message.ts`

---

## Phase 22: ソース全体リファクタリング `cc:DONE`

> Codex 3ラウンド → ISSUES_FOUND: 0。

### 22.1 セキュリティ修正
- `purchase/route.ts`: PublicKey.toBase58() canonical 検証 + Promise.resolve().then().catch()

### 22.2 命名統一
- `knowledge/route.ts`: snake_case → camelCase リネーム

### 22.3 型安全性
- `admin.ts` / `rate-limit.ts`: `declare global` + `typeof globalThis &` 型安全パターン
- `recommendations/queries.ts`: `isKnowledgeItemRef` 型ガード

### 22.4 ログ標準化
- 全 route: `[prefix]` 統一、console.warn→error

### 22.5 依存削除
- `@metamask/sdk` 直接依存を `npm uninstall`

### 22.6 大ファイル分割 (未着手・低優先)
- `knowledge/route.ts` / `ApiKeyManager.tsx` の分割は未実施

**成果物**: `supabase/migrations/20260222000020_phase22_audit_action_feedback.sql`
