# Phase 8: コードベース整理

## Context

Solana 決済とメタデータ強化 (Phase 6-7) が完了し、プロダクトのコアは動作している。現時点で EVM マルチチェーン・i18n・Request Listing は中途半端な状態で UI に露出しており、ユーザー体験を混乱させる。Phase 8 では**UI の入口だけ閉じる**（コード・DB・API は全て残す）ことで、MVP として Solana + 日本語 + Offer のみに集中する。

---

## 8.1 EVM 実装の凍結

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/features/ChainSelector.tsx` | Solana 以外のチェーンに "Coming Soon" バッジ + クリック無効化 |
| `src/components/layout/Header.tsx` | `ChainSelector` を削除（Solana 固定なので不要） |

### ChainSelector.tsx の変更

行36-48 のドロップダウン内ボタンを変更:
- `chain.id === 'solana'` の場合: 今まで通り選択可能
- それ以外: ボタンを `disabled` にし、チェーン名の横に `Coming Soon` テキストを表示、`opacity-50 cursor-not-allowed` スタイル適用

### Header.tsx の変更

- **行120**: `<ChainSelector />` を削除（デスクトップ）
- Solana 固定のためチェーン選択UIは不要。将来 EVM 復活時に `<ChainSelector />` を戻すだけで済む

> ChainSelector コンポーネント自体は Coming Soon 対応を入れて残す（将来 EVM 対応時にそのまま使える）

---

## 8.2 i18n 凍結

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/layout/Header.tsx` | 行119 `<LanguageToggle />` 削除、行241 `<LanguageToggle compact />` の div ごと削除 |
| `src/app/(auth)/layout.tsx` | 行12-14 `<LanguageToggle compact />` の div ごと削除 |
| `src/app/layout.tsx` | 行58 `<LocaleAutoTranslator />` 削除 |

import 文も未使用になるものは削除:
- `Header.tsx` 行9: `LanguageToggle` import 削除
- `(auth)/layout.tsx` 行1: `LanguageToggle` import 削除
- `layout.tsx` 行15: `LocaleAutoTranslator` import 削除

> コンポーネントファイル自体 (`LanguageToggle.tsx`, `LocaleAutoTranslator.tsx`) はそのまま残す

---

## 8.3 Request Listing の UI 整理

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/features/ListingForm/BasicInfoStep.tsx` | 掲載種別 Select を削除、`listing_type` を `"offer"` 固定に |
| `src/app/(main)/search/page.tsx` | 掲載種別フィルターセクション (行103-135) を削除 |

### BasicInfoStep.tsx の変更

- 行37-40 `listingTypeOptions` 定数を削除
- 行124-130 `<Select label="掲載種別" ...>` を削除
- フォームは常に `listing_type: "offer"` で送信される（初期値が既に `"offer"` — `list/page.tsx` 行39 で確認済み）

### search/page.tsx の変更

- 行103-135 の「掲載種別」フィルターセクション (`<div>...</div>`) をまるごと削除
- `listing_type` パラメータの処理ロジック（行30, 40, 49）はそのまま残す（API 互換性維持）

> DB スキーマ・API route の `VALID_LISTING_TYPES` (`["offer", "request"]`) は変更しない。UI の入口だけ閉じる方針。

---

## 検証手順

1. `npm run build` — ビルドエラーなし確認
2. `npm run lint` — lint エラーなし確認
3. ブラウザ確認:
   - Header: ChainSelector なし、LanguageToggle なし
   - 認証ページ: LanguageToggle なし
   - `/list` 出品フォーム: 掲載種別セレクトなし
   - `/search` 検索ページ: 掲載種別フィルターなし
   - モバイルメニュー: LanguageToggle なし
