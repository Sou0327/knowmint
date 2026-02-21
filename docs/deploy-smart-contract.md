# Phase 6: スマートコントラクト決済 デプロイ手順書

> 対象: Knowledge Market PaymentSplitter プログラム (Anchor 0.30.1)
> ネットワーク: devnet → mainnet-beta
> 所要時間: 約30分（devnet）

---

## 前提条件

以下がインストール・設定済みであること:

```bash
# バージョン確認
rustc --version       # 1.75.0 以上
anchor --version      # 0.30.1
solana --version      # 1.18.x 以上
node --version        # 18 以上
```

Solana CLI のウォレット設定:

```bash
# デプロイアカウント（upgrade authority）を設定
solana config set --url devnet
solana config get        # Keypair Path を確認
solana balance           # 最低 2 SOL 必要（デプロイ費用）
solana airdrop 2         # 残高不足の場合
```

---

## Step 1: Fee Vault キーペア生成

**⚠️ 一度だけ実行。`fee-vault-keypair.json` が既に存在する場合はスキップ。**

```bash
node scripts/generate-fee-vault.mjs
```

出力例:
```
=== Fee Vault Keypair Generated ===
Public Key: AbCdEfGh...XyZ123

=== Next Steps ===
1. Add to .env.local:
   NEXT_PUBLIC_FEE_VAULT_ADDRESS=AbCdEfGh...XyZ123

2. Fund the account on devnet:
   solana airdrop 1 AbCdEfGh...XyZ123 --url devnet

3. Update FEE_VAULT_PUBKEY in programs/knowledge-market/src/lib.rs:
   const FEE_VAULT_PUBKEY: Pubkey = Pubkey::new_from_array([
       xx, xx, xx, ...
   ]);
```

> **重要**: `fee-vault-keypair.json` は `.gitignore` 対象。絶対にコミットしない。
> 紛失した場合、fee vault に溜まったプロトコル収益が回収不能になる。

---

## Step 2: Fee Vault にデポジット (devnet)

```bash
# スクリプトの出力に表示された pubkey を使用
solana airdrop 1 <FEE_VAULT_PUBKEY> --url devnet
```

---

## Step 3: Rust ファイルの更新

`programs/knowledge-market/src/lib.rs` の `FEE_VAULT_PUBKEY` を実アドレスに更新する。
**スクリプト出力のバイト配列をそのままコピーすること。**

```rust
// 変更前（プレースホルダー）
const FEE_VAULT_PUBKEY: Pubkey = Pubkey::new_from_array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1,
]);

// 変更後（実アドレス: スクリプト出力のバイト配列）
const FEE_VAULT_PUBKEY: Pubkey = Pubkey::new_from_array([
    xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx,
    xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx,
]);
```

> **注意**: `FEE_VAULT_PLACEHOLDER` は変更しない（プレースホルダー検出用の定数）。

---

## Step 4: テストファイルの更新

`tests/knowledge-market.ts` の `FEE_VAULT_PUBKEY` も同じアドレスに更新する。

```typescript
// 変更前
const FEE_VAULT_PUBKEY = new PublicKey("11111111111111111111111111111112");

// 変更後（Step 1 で生成した実際の Base58 アドレス）
const FEE_VAULT_PUBKEY = new PublicKey("AbCdEfGh...XyZ123");
```

---

## Step 5: ビルドとテスト

```bash
# Rustプログラムをビルド
anchor build

# ビルド成功を確認後、devnet でテスト実行
anchor test --provider.cluster devnet
```

テストが通ることを確認:
- ✅ `SOL 95/5 分配が正確に行われること`
- ✅ `amount=0 を拒否すること`

---

## Step 6: devnet デプロイ

```bash
anchor deploy --provider.cluster devnet
```

出力例:
```
Deploying program "knowledge-market"...
Program Id: XxYyZz...ProgramId123
Deploy success
```

> デプロイ後に表示される **Program Id** を控えておく。

---

## Step 7: Anchor.toml の更新

`Anchor.toml` の `[programs.devnet]` を実際の Program ID に更新する。

```toml
[programs.devnet]
knowledge_market = "XxYyZz...ProgramId123"
```

---

## Step 8: 環境変数の設定

`.env.local` に以下を追加:

```bash
# Phase 6: Smart Contract Payment (devnet)
NEXT_PUBLIC_KM_PROGRAM_ID=XxYyZz...ProgramId123
NEXT_PUBLIC_FEE_VAULT_ADDRESS=AbCdEfGh...XyZ123
```

> これらが設定されると `isSmartContractEnabled()` が `true` になり、
> 購入フローが自動的にスマートコントラクト経由に切り替わる。
> 未設定時は P2P 直接送金にフォールバックする（ゼロダウンタイム）。

---

## Step 9: 動作確認

### 9-1. フロントエンドで SOL 購入テスト

1. `npm run dev` で開発サーバー起動
2. devnet に接続した Phantom/Solflare ウォレットで購入
3. トランザクション後、Solana Explorer で確認:
   - buyer → seller: 95% 受信
   - buyer → fee_vault: 5% 受信
   - Program ID が `XxYyZz...` であること

### 9-2. API 検証確認

購入後、API が `protocol_fee` を正しく記録していることを Supabase Dashboard で確認:

```sql
SELECT tx_hash, amount, protocol_fee, fee_vault_address, status
FROM transactions
ORDER BY created_at DESC
LIMIT 5;
```

---

## mainnet-beta デプロイ (将来)

devnet での動作が安定したら:

```bash
# mainnet 用 Fee Vault を別途生成（devnet と共用しない）
node scripts/generate-fee-vault.mjs  # 別ディレクトリで実行

# mainnet に切り替え
solana config set --url mainnet-beta

# mainnet デプロイ（SOL コストに注意: 約 3-5 SOL）
anchor deploy --provider.cluster mainnet-beta

# .env.local（または Vercel 環境変数）を mainnet 用に更新
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_KM_PROGRAM_ID=<mainnet Program ID>
NEXT_PUBLIC_FEE_VAULT_ADDRESS=<mainnet Fee Vault>
```

---

## トラブルシューティング

### `InvalidFeeVault` エラー

**原因**: `FEE_VAULT_PUBKEY` がプレースホルダーのまま、または環境変数の `NEXT_PUBLIC_FEE_VAULT_ADDRESS` が `lib.rs` の値と不一致。

**対処**:
1. `lib.rs` の `FEE_VAULT_PUBKEY` バイト配列を確認
2. `.env.local` の `NEXT_PUBLIC_FEE_VAULT_ADDRESS` が同じ Base58 アドレスか確認
3. `anchor build` してから再デプロイ

### `Account not found` エラー

**原因**: Fee Vault に SOL がない（rent-exempt 未満）。

**対処**:
```bash
solana airdrop 1 <FEE_VAULT_PUBKEY> --url devnet
```

### Discriminator mismatch

**原因**: `src/lib/solana/program.ts` のハードコードされた discriminator と Program が一致しない。

**確認方法**:
```bash
# Anchor CLI でdiscriminator を確認
node -e "
const crypto = require('crypto');
const disc = (name) => crypto.createHash('sha256').update('global:' + name).digest().slice(0, 8);
console.log('execute_purchase:', [...disc('execute_purchase')]);
console.log('execute_purchase_spl:', [...disc('execute_purchase_spl')]);
"
```

期待値:
- `execute_purchase`: `[193, 193, 250, 92, 23, 221, 96, 102]`
- `execute_purchase_spl`: `[199, 21, 23, 14, 174, 235, 192, 103]`

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `programs/knowledge-market/src/lib.rs` | Anchor プログラム本体 |
| `Anchor.toml` | デプロイ設定 |
| `scripts/generate-fee-vault.mjs` | Fee Vault キーペア生成 |
| `fee-vault-keypair.json` | Fee Vault 秘密鍵 (`.gitignore` 対象) |
| `src/lib/solana/program.ts` | フロントエンド Instruction Builder |
| `src/lib/solana/verify-transaction.ts` | サーバーサイド検証ロジック |
| `.env.local.example` | 環境変数テンプレート |
