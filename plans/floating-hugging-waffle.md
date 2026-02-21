# Phase 6: スマートコントラクト決済 — 実装計画

## Context

現行の支払いは `buildSolTransfer` による P2P 直接送金（売り手に全額）。
Phase 6 では Anchor プログラム (`PaymentSplitter`) を介して、1 TX 内で **売り手 95% + プロトコル手数料 5%** に自動分配する。

**環境制約**: Rust/Anchor CLI 未インストール → Rust コードは書けるが `anchor build` は別マシンで実施
**デプロイ先**: devnet のみ（mainnet は将来）
**Fee Vault**: 今は placeholder。セットアップスクリプトで devnet 用アドレスを生成

---

## アーキテクチャ決定

| 決定事項 | 選択 | 理由 |
|---------|------|------|
| フロント SDK | `@solana/web3.js` 手動 instruction 構築 | `@coral-xyz/anchor` 不要、バンドルサイズ削減 |
| フロント USDC | `@solana/spl-token` 追加 | ATA 解決に必要 |
| 検証方式 | 残高差分検証を拡張 | ログパースより堅牢、既存コードを再利用 |
| 機能フラグ | `NEXT_PUBLIC_KM_PROGRAM_ID` 環境変数 | 未デプロイ時は直接送金にフォールバック |
| プログラムステート | なし (stateless) | PDA 不要、シンプル、監査容易 |

---

## 実装ステップ

### Step 1: Anchor プログラム (Rust)

**新規ファイル一覧:**

```
Cargo.toml                                  # workspace root
Anchor.toml                                 # Anchor 設定 (cluster=devnet)
programs/
  knowledge-market/
    Cargo.toml                              # anchor-lang = "0.30.1", anchor-spl = "0.30.1"
    src/
      lib.rs                               # PaymentSplitter program
tests/
  knowledge-market.ts                      # Anchor テスト (TypeScript)
```

`programs/knowledge-market/src/lib.rs` の主要内容:

- `PROTOCOL_FEE_BPS = 500` (5%) をハードコード
- `execute_purchase(amount: u64)`: SOL split — seller 95% + fee_vault 5%
  → `system_program::transfer` を 2 回 CPI
- `execute_purchase_spl(amount: u64)`: USDC split — seller ATA 95% + fee_vault ATA 5%
  → `spl_token::transfer` を 2 回 CPI
- `fee_vault` アカウントは `address = FEE_VAULT_PUBKEY` 制約でハードコード検証
- `#[error_code]`: `ZeroAmount`, `Overflow`

テストケース (`tests/knowledge-market.ts`):
- 正常系: SOL 95/5 分配が正確か
- 正常系: USDC 95/5 分配が正確か
- 異常系: amount=0 拒否
- 異常系: 不正な fee_vault アドレス拒否

### Step 2: セットアップスクリプトと環境変数

**新規ファイル: `scripts/generate-fee-vault.mjs`**
- `@solana/web3.js` で Keypair 生成
- pubkey を表示 → `NEXT_PUBLIC_FEE_VAULT_ADDRESS` に設定する値
- `fee-vault-keypair.json` に保存 (devnet 用)
- airdrop コマンドを表示

**`.env.local.example` に追記:**
```bash
# Phase 6: Smart Contract Payment
NEXT_PUBLIC_KM_PROGRAM_ID=          # anchor deploy 後に設定
NEXT_PUBLIC_FEE_VAULT_ADDRESS=      # generate-fee-vault.mjs で生成
```

**`.gitignore` に追記:** `fee-vault-keypair.json`

### Step 3: フロントエンド — Instruction Builder

**新規ファイル: `src/lib/solana/program.ts`**

```typescript
// 主要エクスポート:
getProgramId(): PublicKey | null        // NEXT_PUBLIC_KM_PROGRAM_ID
getFeeVault(): PublicKey | null         // NEXT_PUBLIC_FEE_VAULT_ADDRESS
isSmartContractEnabled(): boolean       // 両方設定済みなら true
PROTOCOL_FEE_BPS = 500

// Anchor discriminator 計算 (crypto.createHash)
// sha256("global:execute_purchase")[0..8]
// sha256("global:execute_purchase_spl")[0..8]

buildSmartContractPurchase(buyer, sellerAddress, amountSol): Promise<Transaction>
  // discriminator(8B) + amount_u64_LE(8B) の instruction data
  // accounts: buyer(signer,writable), seller(writable), feeVault(writable), SystemProgram

buildSmartContractPurchaseSpl(buyer, buyerAta, sellerAta, feeVaultAta, amountAtomic): Promise<Transaction>
  // accounts: buyer, buyerAta, sellerAta, feeVault, feeVaultAta, TOKEN_PROGRAM_ID
```

**新規ファイル: `src/lib/solana/token-accounts.ts`**
- `resolveUsdcAccounts(buyer, sellerAddress)` → `{ buyerAta, sellerAta, feeVaultAta }`
- `getAssociatedTokenAddress` を使用 (`@solana/spl-token`)
- `getUsdcMint()` (既存 `payment.ts` から) を再利用

**`package.json` に追加:**
```json
"@solana/spl-token": "^0.4.9"
```

### Step 4: PurchaseModal 統合

**変更ファイル: `src/components/features/PurchaseModal.tsx`**

SOL パス:
```typescript
if (isSmartContractEnabled()) {
  transaction = await buildSmartContractPurchase(publicKey, sellerWallet, amount);
} else {
  transaction = await buildSolTransfer(publicKey, sellerWallet, amount);  // 既存フォールバック
}
```

USDC パス (現在は「準備中」→ スマコン有効時に実装):
```typescript
if (isSmartContractEnabled()) {
  const { buyerAta, sellerAta, feeVaultAta } = await resolveUsdcAccounts(publicKey, sellerWallet);
  transaction = await buildSmartContractPurchaseSpl(publicKey, buyerAta, sellerAta, feeVaultAta, amountAtomic);
}
```

### Step 5: 検証ロジック更新

**変更ファイル: `src/lib/solana/verify-transaction.ts`**

インターフェース拡張:
```typescript
interface VerifySolanaPurchaseInput {
  // 既存フィールドはそのまま
  feeVaultAddress?: string;  // 追加: スマコンモード時に渡す
}
```

新規関数 `verifySolSplitTransfer`:
- seller 残高増加 ≥ `expectedLamports * 9500 / 10000`
- feeVault 残高増加 ≥ `expectedLamports * 500 / 10000`
- BigInt 演算 (既存 `decimalToAtomic` を再利用)

新規関数 `verifyUsdcSplitTransfer`:
- seller ATA トークン残高増加 ≥ 95%
- feeVault ATA トークン残高増加 ≥ 5%
- 既存 `verifyUsdcTransfer` の split 版

ディスパッチロジック:
- `feeVaultAddress` が渡された場合: split 検証
- なし: 既存の直接送金検証 (後方互換)

### Step 6: API ルート更新

**変更ファイル: `src/app/api/v1/knowledge/[id]/purchase/route.ts`**

```typescript
const feeVaultAddress = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS || undefined;

const verification = await verifySolanaPurchaseTransaction({
  txHash, token, expectedRecipient: sellerWallet,
  expectedAmount, expectedSender: buyerWallet,
  feeVaultAddress,  // 追加
});

// INSERT に追加:
protocol_fee: feeVaultAddress ? expectedAmount * 0.05 : 0,
fee_vault_address: feeVaultAddress || null,
```

### Step 7: DB マイグレーション

**新規ファイル: `supabase/migrations/20260220000012_add_protocol_fee.sql`**

```sql
ALTER TABLE transactions ADD COLUMN protocol_fee DECIMAL(18, 9) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN fee_vault_address TEXT;
```

**変更ファイル: `src/types/database.types.ts`**
- `Transaction` インターフェースに `protocol_fee`, `fee_vault_address` を追加

---

## 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---------|------|---------|
| `Cargo.toml` | 新規 | Anchor workspace |
| `Anchor.toml` | 新規 | devnet 設定 |
| `programs/knowledge-market/Cargo.toml` | 新規 | Rust 依存 |
| `programs/knowledge-market/src/lib.rs` | 新規 | PaymentSplitter program |
| `tests/knowledge-market.ts` | 新規 | Anchor テスト |
| `scripts/generate-fee-vault.mjs` | 新規 | Fee Vault 生成スクリプト |
| `.env.local.example` | 変更 | Phase 6 env vars |
| `.gitignore` | 変更 | fee-vault-keypair.json |
| `src/lib/solana/program.ts` | 新規 | Instruction builder |
| `src/lib/solana/token-accounts.ts` | 新規 | ATA 解決ヘルパー |
| `src/components/features/PurchaseModal.tsx` | 変更 | スマコン分岐 |
| `src/lib/solana/verify-transaction.ts` | 変更 | Split 検証追加 |
| `src/app/api/v1/knowledge/[id]/purchase/route.ts` | 変更 | feeVault 渡し、protocol_fee 保存 |
| `supabase/migrations/20260220000012_add_protocol_fee.sql` | 新規 | protocol_fee カラム |
| `src/types/database.types.ts` | 変更 | Transaction 型更新 |
| `package.json` | 変更 | @solana/spl-token 追加 |

---

## 検証方法

1. **Rust コード**: 別マシン (Rust/Anchor インストール済み) で `anchor build && anchor test`
2. **フロントエンド (スマコン無効)**: `NEXT_PUBLIC_KM_PROGRAM_ID` を空にして既存フローが動作することを確認
3. **フロントエンド (スマコン有効)**: devnet deploy 後に env 設定して PurchaseModal でトランザクション送信
4. **検証ロジック**: `npm run test:e2e:fake-tx` で偽TX拒否を確認。手動でスマコンTXを送信し API 検証を通ることを確認
5. **USDC**: devnet USDC で end-to-end 購入フロー確認

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| Rust コードがコンパイルできない | 最小限の Anchor 実装、公式サンプル準拠。CI または別マシンでビルド |
| Discriminator 計算ミス | TypeScript 側で単体テスト。既知の Anchor プログラムと照合 |
| USDC ATA が存在しない | Fee Vault の ATA は `getOrCreateAssociatedTokenAccount` で事前作成 |
| デプロイ前は動作不可 | 環境変数フラグで既存フォールバックを維持 → ゼロダウンタイム移行 |
| 端数計算の精度 | BigInt 整数除算 (`* 9500 / 10000`)。20 lamports 未満は fee=0 に丸め → devnet では許容 |
