# アーカイブ: Phase 20

---

## Phase 20: x402 対応 `cc:DONE` [P1]

> 実装アプローチ: x402 SDK 不使用・カスタム互換実装（route handler 内 HTTP 402 ゲート）
> Codex レビュー 5 ラウンドで指摘ゼロ達成。

### 実装内容

- [x] `src/lib/x402/index.ts` 新規 — x402 互換ユーティリティ (buildX402Body / parseXPaymentHeader)
- [x] `GET /api/v1/knowledge/[id]/content` に x402 ゲート追加
  - 未払い → HTTP 402 + accepts[] (payTo, maxAmountRequired, asset)
  - X-PAYMENT ヘッダーあり → verifySolanaPurchaseTransaction → 購入記録 → コンテンツ返却
  - tx_hash 再利用防止: buyer_id + knowledge_item_id + status の完全一致検証
  - TOCTOU 対策: 23505 後に再読込・再検証して fail-close
  - expectedSender 必須化: フロントラン防止
  - status/listing_type チェック追加: draft/request は取得不可
  - Supabase error 全箇所で明示判定 (PGRST116 vs 500)
- [x] `km_get_content` に `payment_proof?: string` 追加 → X-PAYMENT ヘッダーに変換
- [x] `mcp/src/api.ts` に `apiRequestWithPayment` 追加 (402 → PaymentRequiredResponse)
- [x] `mcp/README.md` に x402 自律購入フロー追記 (Phantom MCP 不要)
- [x] `X402_NETWORK` 環境変数対応 (.env.local.example)

### 発見した既存セキュリティ課題 (→ Phase 21 へ)

- **Critical**: `confirm_transaction` RPC の GRANT が PUBLIC に開放されている
- **High**: `profiles.wallet_address` に UNIQUE 制約なし + 所有証明なし

### 変更ファイル

- `src/lib/x402/index.ts` (新規)
- `src/app/api/v1/knowledge/[id]/content/route.ts`
- `mcp/src/tools.ts`
- `mcp/src/api.ts`
- `mcp/README.md`
- `.env.local.example`

### x402 E2E テスト (Phase 20.4) — 未着手

- [ ] devnet + CDP testnet で x402 フロー動作確認
- [ ] エージェント自律購入デモスクリプト作成
- [ ] 既存 `test:e2e:fake-tx` との並存確認
