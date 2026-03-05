# KnowMint - 開発計画

> AIエージェントが x402 プロトコルで SOL を直接自律支払いできる、初のナレッジマーケットプレイス
> 決済: Solana x402 自律購入 (ノンカストディアル P2P)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: エージェントが x402 で自律購入 — AIエージェントを活用した知識調達（提案→承認）でも使える
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, 26, UI-1 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)
Phase 26 (CLIデモ GIF + HowItWorks): `plans/archive-phase26-ui1.md`
Phase UI-1 (Xリンク + Lighthouse): `plans/archive-phase26-ui1.md`
Phase R (OSS公開): `plans/archive-phase-r-a.md`
Phase A (EVM削除+vitest統一+fire-and-forget可視化): `plans/archive-phase-r-a.md`

**R.3 手動TODO**: GitHub Description/Topics/Website URL 設定 (knowmint.shop)

---

## Phase CONTENT-1: Cardano Byron ESK調査報告 — 安全なナレッジ記事へ変換 [P1 — コンテンツ]

> `drafts/references/SESSION_INVESTIGATION_REPORT_20260217.md` を KnowMint 出品形式に変換。
> 暗号学的に価値ある発見（2経路分離・INC-1メカニズム）を保持しつつ、
> 実際のキー値・ウォレット固有情報を完全除去する。

### CONTENT-1.1 サニタイズ（個人情報・キー値の除去）

- [ ] 削除対象を特定してリストアップ `cc:TODO`
  - `SECRET_ESK` / `DB5_ESK` の hex 値 → `[REDACTED_ESK_HEX_64B]` に置換
  - `TARGET_PUB` / `TARGET_CC` の hex 値 → `[REDACTED_PUBKEY_32B]` に置換
  - `scrypt_salt` / `hdPassphrase` / `Root XPub` の具体値 → 除去
  - `G3↔G4↔G2` 遷移の具体パスワード (`Pekopeko4649` / `pekopeko4649`) → `[EXAMPLE_PASS_A]` / `[EXAMPLE_PASS_B]` に置換
  - Koios API で照合した TxID 27件 → 個数と期間のみ残し具体値除去
  - ESKグループ表の先頭16B hex → 除去
  - `scrypt導出値` / `pbkdf2` 具体値 → 除去
- [ ] サニタイズ済みファイルを `drafts/content-cardano-byron-esk-recovery.md` として出力 `cc:TODO`

### CONTENT-1.2 KnowMint 出品形式へ整形

出品フォーマット（`drafts/content-01-claude-code-solo-build.md` 準拠）:

- [ ] **メタデータ** を記載 `cc:TODO`
  - `title`: `How Byron-era Cardano Wallet ESK Decryption Actually Works — A Forensic Investigation`
  - `content_type`: `general`
  - `tags`: `cardano, byron-wallet, cryptography, wallet-recovery, forensics, daedalus`
  - `price_sol`: `1.0`（Claude Codeドラフトの0.05より高価。希少性に対応）
  - `listing_type`: `offer`
- [ ] **preview_content**（誰でも閲覧可）を執筆 `cc:TODO`
  - 発見の価値を訴求: 2経路問題・INC-1メカニズム・22,000件テスト結果
  - 「この調査が解決する問いは何か」を冒頭に明示
  - 500文字以内に収める
- [ ] **full_content**（購入者のみ）を整形 `cc:TODO`
  - セクション構成: 暗号化パイプライン → 2経路分離 → INC-1メカニズム → テスト設計 → 次アクション指針
  - コードブロック（C実装・Python実装）はそのまま保持（実装詳細が価値の核心）
  - 具体的なkeyやhexは`[REDACTED]`表記のまま

### CONTENT-1.3 品質確認

- [ ] サニタイズ漏れチェック: hex 文字列 64文字以上のパターンを grep で確認 `cc:TODO`
  ```bash
  grep -oE '[0-9a-f]{48,}' drafts/content-cardano-byron-esk-recovery.md
  ```
- [ ] preview が「買いたくなる」内容になっているか読み返し確認 `cc:TODO`
- [ ] 価格設定の妥当性再確認（`1.0 SOL` ≒ ¥2万、ターゲット層が払える額か） `cc:TODO`

---

## Phase OB-1: エラー可視性強化 [P2 — 可観測性]

> Codex レビューで発見したサイレントエラー抑制の残件。障害時の原因調査を困難にしている。

- [ ] `src/lib/knowledge/queries.ts:142` — `getPublishedKnowledge()` の DB エラーを空配列に変換せず `console.error` でログ出力 `cc:TODO`
- [ ] `src/lib/api/auth.ts:41` — APIキールックアップ失敗時に `console.error` 追加 (インフラ障害と認証失敗を区別) `cc:TODO`
- [ ] `src/app/api/v1/knowledge/[id]/route.ts:42` — reviews クエリの `error` フィールドを無視せずログ出力 `cc:TODO`

---

## Phase PROD-TEST: 本番 devnet 購入テスト `cc:完了`

> 本番インフラ（CF Workers + Supabase prod + Solana devnet）で購入フローを手動 E2E 検証。
> CLI 登録・検索・購入、MCP x402 自律購入すべて通過。

### 確認済み (2026-03-04)

- [x] CLI 登録 (`km register`)
- [x] CLI 検索 (`km search`)
- [x] CLI 購入 (`tx_hash` 提出 → 保存)
- [x] MCP 登録
- [x] MCP x402 402 → `payment_proof` 購入
- [x] MCP コンテンツ取得

### 修正内容

- `src/lib/x402/index.ts`: `getEnv()` 追加 (CF Workers AsyncLocalStorage 対応)、once ガード除去、`SOLANA_NETWORK` > `NEXT_PUBLIC_SOLANA_NETWORK` 優先順位
- `src/lib/solana/connection.ts`: 同上 (`getEnv()` + `SOLANA_RPC_URL` > `NEXT_PUBLIC_SOLANA_RPC_URL`)
- `src/lib/solana/verify-transaction.ts`: `getNetwork()` 経由で USDC mint 解決
- `src/app/api/v1/knowledge/[id]/purchase/route.ts`: `fireWebhookEvent`/`logAuditEvent` 除去 (undici CF Workers 非互換)
- wrangler secret: `SOLANA_RPC_URL` / `SOLANA_NETWORK` (NEXT_PUBLIC_ なし) でランタイム切替可能

### 環境切替コマンド

devnet:
```bash
echo "https://devnet.helius-rpc.com/?api-key=<KEY>" | npx wrangler secret put SOLANA_RPC_URL
echo "devnet" | npx wrangler secret put SOLANA_NETWORK
echo "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" | npx wrangler secret put X402_NETWORK
```

mainnet:
```bash
echo "https://mainnet.helius-rpc.com/?api-key=<KEY>" | npx wrangler secret put SOLANA_RPC_URL
echo "mainnet-beta" | npx wrangler secret put SOLANA_NETWORK
echo "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" | npx wrangler secret put X402_NETWORK
```

---

## Phase CLI-PAY: CLI 自動送金購入 [P1 — UX]

> 現状 `km purchase` は `--tx-hash` の手動提出が必要。
> keypair を使って送金 → purchase API → コンテンツ取得を1コマンドで完結させる。

### CLI-PAY.1 seller wallet 取得手段

- [ ] `GET /api/v1/me/profile` エンドポイント追加（`wallet_address` 返却）— 作成済み、デプロイ待ち `cc:TODO`
- [ ] knowledge item 詳細 API (`GET /api/v1/knowledge/[id]`) のレスポンスに `seller_wallet_address` を追加 `cc:TODO`
  - 購入者が seller wallet を知る必要がある（送金先）
  - RLS / セキュリティ考慮: 公開情報（Solana アドレスは公開台帳）

### CLI-PAY.2 CLI 自動送金実装

- [ ] `km purchase <id>` に `--keypair <path>` オプション追加 `cc:TODO`
  - `--keypair` あり: 自動送金モード
  - `--tx-hash` あり: 従来の手動提出モード（互換維持）
  - 両方なし: コンテンツ直取得を試行（既存動作）
- [ ] 自動送金フロー実装 `cc:TODO`
  1. `GET /api/v1/knowledge/<id>` → `price_sol`, `seller_wallet_address` 取得
  2. RPC 接続（config の `rpcUrl` or devnet/mainnet 自動判定）
  3. buyer 残高チェック（price + 手数料バッファ）
  4. `SystemProgram.transfer(buyer → seller)` 送信・confirmed 待ち
  5. `POST /api/v1/knowledge/<id>/purchase` に `tx_hash` 提出
  6. `GET /api/v1/knowledge/<id>/content` でコンテンツ取得・保存
- [ ] `~/.km/config.json` に `rpcUrl` フィールド追加（オプション、未設定時は mainnet 公開 RPC） `cc:TODO`

### CLI-PAY.3 テスト

- [ ] devnet E2E: keypair で自動送金 → 購入 → コンテンツ取得 `cc:TODO`
- [ ] エラーケース: 残高不足、seller wallet 未設定、無効な keypair `cc:TODO`

### 変更ファイル

| File | Change |
|------|--------|
| `src/app/api/v1/knowledge/[id]/route.ts` | seller_wallet_address をレスポンスに追加 |
| `src/app/api/v1/me/profile/route.ts` | 新規（作成済み、デプロイ待ち） |
| `cli/bin/km.mjs` | `--keypair` 自動送金ロジック追加 (~60行) |

---

## Phase DEMO-WEB: WebUI 購入フロー GIF 作成 [P1 — Show HN 必須]

> 現在の demo GIF はターミナル録画（asciinema）のみで、実際の DQ スタイル Web UI が一切映っていない。
> Show HN 訪問者はプロダクトの見た目を最初の3秒で判断する。WebUI GIF は必須。
> **前提**: PROD-TEST 完了後（devnet で実データが存在する状態）に実施。

- [ ] 事前準備: ナレッジアイテム 10件以上を本番に出品（デモ映えするコンテンツ） `cc:TODO`
- [ ] 画面録画: ブラウザで購入フルフロー録画（検索→詳細→購入モーダル→Solana TX→コンテンツ表示） `cc:TODO`
  - ツール: QuickTime（Mac）または OBS
  - 解像度: 1280×800 推奨（HN サイドバー幅を考慮）
  - 長さ: 30〜45秒以内
- [ ] GIF 変換: `ffmpeg` で mp4→gif 変換、`gifsicle` で最適化（目標 < 5MB） `cc:TODO`
  ```bash
  ffmpeg -i recording.mov -vf "fps=15,scale=1280:-1" -loop 0 webui-demo.gif
  gifsicle --optimize=3 webui-demo.gif -o webui-demo-opt.gif
  ```
- [ ] README 更新: 現行の CLI GIF の上に WebUI GIF を追加（2段構成） `cc:TODO`
  - 上段: WebUI GIF（人間・投資家向け）
  - 下段: 既存 CLI GIF（エンジニア・エージェント向け）
- [ ] OGP 確認: GitHub の README プレビューで GIF が正しく表示されることを確認 `cc:TODO`

---

## Phase SEC-1: エージェントによる出品ブロック [P2 — コンテンツ品質]

> `profiles.user_type = 'agent'` のユーザーが出品できてしまう。KnowMint のコアバリュー（人間の体験知）と矛盾するため、publish 時にチェックを追加する。
> 実効性は低い（自己申告制）が、抑止力として有効。変更箇所は1ファイル。

- [ ] `src/app/api/v1/knowledge/[id]/publish/route.ts` — publish 時に `profiles.user_type` を取得し `agent` なら 403 を返す `cc:TODO`
  - `admin.from("profiles").select("user_type").eq("id", user.userId).single()` で取得
  - `user_type === "agent"` → `apiError(API_ERRORS.FORBIDDEN, "Agents cannot publish knowledge items")`
  - item fetch の前（早期リターン）に配置

---

## Phase REVIEW-1: レビュー・スコア UI 有効化 [P2 — UX]

> バックエンド（reviews テーブル、feedback API、trust_score トリガー）は全て実装済み。
> UI が繋がっていないためデータが入らず、スコアが全て 0 のまま。
> ReviewForm.tsx は実装済みだがページ未組み込み。有用性フィードバック UI は未作成。

### REVIEW-1.1 レビュー投稿 UI 組み込み

- [ ] `src/app/(main)/knowledge/[id]/page.tsx` に `ReviewForm` を組み込み（購入済みユーザーのみ表示） `cc:TODO`
  - `transactions` テーブルで confirmed な取引があるかチェック
  - 既にレビュー済みの場合は非表示 or 「レビュー済み」表示
  - ReviewList の上に配置

### REVIEW-1.2 有用性フィードバック UI

- [ ] 購入済みコンテンツ閲覧ページに 👍/👎 ボタンを追加 `cc:TODO`
  - `POST /api/v1/knowledge/[id]/feedback` を呼び出し
  - トリガーが `usefulness_score` を自動更新

### REVIEW-1.3 スコア表示の改善

- [ ] ナレッジ詳細ページに `average_rating` と `usefulness_score` を見やすく表示 `cc:TODO`
- [ ] 売り手プロフィールに `trust_score` を表示 `cc:TODO`

---

## Phase B: Provider 最適化 + Playwright E2E [P1 — パフォーマンス・品質]

> バンドルサイズ削減 + E2E テスト基盤の近代化。

### B.1 WalletProvider lazy 化

- [ ] root layout.tsx から SolanaWalletProvider を除去 `cc:TODO`
- [ ] 購入ページ (`/knowledge/[id]`) と出品ページ (`/list`) にのみ WalletProvider を配置 `cc:TODO`
- [ ] WalletButton を wallet 不要ページでは非表示 or ConnectWallet CTA に変更 `cc:TODO`

### B.2 Playwright E2E 導入

- [ ] Playwright セットアップ (`playwright.config.ts`, `tests/e2e/`) `cc:TODO`
- [ ] Maestro 18 フローのうち主要 10 フローを Playwright に移植 `cc:TODO`
- [ ] CI に Playwright を組み込み `cc:TODO`
- [ ] Maestro フロー・設定を `_archived/` に移動 `cc:TODO`

---

## Phase C: i18n URL 化 + shadcn/ui 段階導入 [P1 — SEO・保守性]

> SEO の根本改善 + 自前 UI コンポーネント保守からの解放。

### C.1 i18n URL ベース化

- [ ] next-intl middleware を URL ベース (`/ja/`, `/en/`) に変更 `cc:TODO`
- [ ] `hreflang` タグ出力 `cc:TODO`
- [ ] 既存 cookie ベースからのリダイレクト (後方互換) `cc:TODO`
- [ ] sitemap.xml に言語別 URL 追加 `cc:TODO`

### C.2 shadcn/ui 段階導入

- [ ] shadcn/ui セットアップ (`components.json`, Tailwind 統合) `cc:TODO`
- [ ] Button → shadcn/ui Button に置換 (DQ テーマ維持) `cc:TODO`
- [ ] Modal → shadcn/ui Dialog に置換 (focus trap 自動解決) `cc:TODO`
- [ ] Input / Textarea / Select → shadcn/ui に置換 `cc:TODO`
- [ ] Card → shadcn/ui Card に置換 `cc:TODO`
- [ ] 自前 `src/components/ui/` の旧コンポーネント削除 `cc:TODO`

### C.3 ダークモード `cc:完了` → `plans/archive-future-phases.md`

> Phase 33/35/47/50/32.3/削除済み/将来フェーズ → `plans/archive-future-phases.md`
