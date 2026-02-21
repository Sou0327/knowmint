# Archive: Phase 5 & 6 (完了済み)

## Phase 5: CLI / MCP 双方向自動化 `cc:DONE`

- **5.0** `cc:DONE`: 環境変数統一, OpenAPI整備, エラーコード文書化
- **5.1** `cc:DONE`: オンチェーン検証, 冪等性, 偽TX拒否E2Eテスト
- **5.2** `cc:DONE`: publish/dataset upload/APIキー管理
- **5.3** `cc:DONE`: CLIツール login/search/install/publish/deploy 全コマンド
- **5.4** `cc:DONE`: MCP サーバー (km_search, km_get_detail, km_purchase, km_get_content, km_publish)

---

## Phase 6: スマートコントラクト決済 `cc:DONE`

> Codex レビュー 5ラウンド全件対応済み。

### 実装ファイル

| ファイル | 内容 |
|---------|------|
| `Cargo.toml`, `Anchor.toml` | Anchor workspace 設定 |
| `programs/knowledge-market/src/lib.rs` | PaymentSplitter Program (SOL/SPL 95/5分配) |
| `tests/knowledge-market.ts` | Anchor テスト |
| `scripts/generate-fee-vault.mjs` | Fee Vault キーペア生成 |
| `src/lib/solana/program.ts` | Instruction Builder + 機能フラグ |
| `src/lib/solana/token-accounts.ts` | USDC ATA 解決ヘルパー |
| `src/lib/solana/verify-transaction.ts` | Split 検証 (replay/dust/sender 対策) |
| `src/components/features/PurchaseModal.tsx` | SOL/USDC 両経路の機能フラグ分岐 |
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | protocol_fee 保存・検証 |
| `supabase/migrations/20260220000012_add_protocol_fee.sql` | protocol_fee/fee_vault_address カラム |
| `src/types/database.types.ts` | Transaction 型拡張 |

### デプロイ手順 (未実施)

1. `node scripts/generate-fee-vault.mjs` で Fee Vault 生成
2. `programs/knowledge-market/src/lib.rs` の `FEE_VAULT_PUBKEY` を実アドレスに更新
3. `tests/knowledge-market.ts` の `FEE_VAULT_PUBKEY` も同じアドレスに更新
4. `anchor build && anchor deploy --provider.cluster devnet`
5. `.env.local` に `NEXT_PUBLIC_KM_PROGRAM_ID` と `NEXT_PUBLIC_FEE_VAULT_ADDRESS` 設定

### 設計ポイント

- `FEE_VAULT_PUBKEY` の `address =` 制約 + `FEE_VAULT_PLACEHOLDER` 実行時ガードで二重防護
- `fee_share = amount - floor(amount * 9500 / 10000)` で二重floorを防止 (Rust/TS共通)
- 機能フラグ OFF 時は P2P 直接送金にフォールバック (ゼロダウンタイム移行)
- blockTime ≤ 1h でreplay attack防止、ダスト金額拒否
