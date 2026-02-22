# Archive: Phase 6-10

## Phase 6 デプロイ完了 (2026-02-20)

- [x] Fee Vault 生成: `GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc`
- [x] `anchor build` 成功 (blake3 1.5.5 ピン留めで platform-tools Cargo 1.84 対応)
- [x] `anchor deploy --provider.cluster devnet` 成功
- [x] devnet テスト合格 (SOL 95/5 分配 + ZeroAmount 拒否)
- [x] `.env.local` に `NEXT_PUBLIC_KM_PROGRAM_ID` / `NEXT_PUBLIC_FEE_VAULT_ADDRESS` 設定済み
- Program ID: `B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb`

---

## Phase 7 完了 (2026-02-20)

- [x] `metadata JSONB` + `usefulness_score` カラム + `knowledge_feedbacks` テーブル
- [x] RLS: INSERT ポリシーに transaction 整合性 EXISTS 検証
- [x] JSONB 検索用インデックス (式インデックス3本 + GIN)
- [x] `sanitizeMetadata()` で許可リストバリデーション (API route + Server Action 両方)
- [x] 出品/編集フォームにメタデータ折りたたみセクション追加
- [x] API GET/POST に metadata select + JSONB フィルタ4種
- [x] フィードバック API (`POST /api/v1/knowledge/[id]/feedback`) — 購入確認 + 重複防止 + UNIQUE 違反 409 マッピング
- [x] MCP `km_search` に metadata フィルタ (enum) + 品質スコア表示
- [x] Codex レビュー 3ラウンド: Critical 1 → 0, High 3 → 0
- [x] セキュリティレビュー APPROVE

---

## Phase 8: コードベース整理 (2026-02-21)

### 8.1 EVM 実装の凍結
- [x] `ChainSelector` で Solana 以外を `disabled` + Coming Soon 表示に変更
- [x] `Header.tsx` から `ChainSelector` 削除 (Solana 固定)
- [x] `layout.tsx` から `EVMWalletProvider` 除外 (バンドル軽量化)

### 8.2 i18n 凍結
- [x] `LanguageToggle` / `LocaleAutoTranslator` を UI から非表示に (コード自体は残す)
- [x] `layout.tsx` を `ja` 固定に変更 (cookie 読み取り廃止)

### 8.3 Request Listing の UI 整理
- [x] 出品フォームで `listing_type: 'request'` の選択肢を非表示に (DB・API は残す)
- [x] 検索フィルターから `listing_type` フィルタを削除
- [x] `buildUrl` から `listing_type` パラメータ伝播を除外
- Codex レビュー 3ラウンド: High 1 → 0, Medium 2 → 0, Low 1 → 0
- 復活手順: EVMWalletProvider / ChainSelector / LanguageToggle / LocaleAutoTranslator を戻すだけ

---

## Phase 9: 信頼・品質基盤 (2026-02-21)

- [x] 売り手信頼スコア: trust_score カラム、recalculate_trust_score PL/pgSQL 関数、5トリガー
  - SECURITY DEFINER + GRANT EXECUTE + partial index
  - API/UI (SellerCard・SellerRankingCard)/MCP/CLI すべてに反映
- [x] ナレッジバージョニング: advisory lock + atomic RPC `create_version_snapshot`
  - VersionHistory UI (useReducer + Server Action)、MCP/CLI/SDK に pagination 対応
- [x] TypeScript SDK (`@knowledge-market/sdk`): KnowledgeMarketClient、型定義、examples
- Codex レビュー 13ラウンド: Critical 0 / High 0 達成

---

## Phase 10: セキュリティ修正 (2026-02-21)

- [x] 10.1 permissions ホワイトリスト: `src/lib/api/permissions.ts` 新規、keys/route.ts 検証追加、ApiKeyManager import 統一
- [x] 10.2 full_content サイズ制限: POST/PATCH で 500,000文字超 → 400
- [x] 10.3 Webhook シークレット: SHA-256 ハッシュ保存、`chk_secret_hash_format` / `chk_secret_revoked` DB 制約
- [x] expires_at ISO 8601 正規表現 + カレンダー妥当性検証 (UTC 非依存)
- Codex レビュー 4ラウンド: Critical 0 / High 0 / Medium 0 (LGTM)
- 既知課題: `isPublicUrl` SSRF (DNS 解決ベース) → Phase 11 で対応
