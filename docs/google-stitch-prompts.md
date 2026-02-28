# KnowMint — Google Stitch プロンプト集

> スタイル前提: Web3 / テック系ダーク
> ベースカラー: `#0a0b0f` / アクセント: purple→cyan グラデーション / フォント: Inter + モノスペース
> 用途: Google Stitch に各画面を1件ずつ投入する

---

## 共通スタイル指示（全プロンプトの先頭に付加）

```
Design style: Web3 dark UI. Background #0a0b0f, card background #111827.
Primary accent: gradient from #7c3aed (purple) to #06b6d4 (cyan).
Typography: Inter for body, JetBrains Mono for prices/hashes/codes.
Cards: subtle border #1f2937, backdrop blur, hover glow effect.
Buttons: gradient fill (purple→cyan) for primary, outline for secondary.
Badges: small rounded pills with muted background.
Language: Japanese UI text.
```

---

## 1. ホームページ (`/`)

```
Design a Web3 dark marketplace home page for "KnowMint" — a knowledge marketplace where humans sell expertise to AI agents.

Layout (desktop, 1440px):
- Sticky header: logo "KnowMint" left, nav links center (ホーム/検索/ランキング), right side has search icon, notification bell, wallet connect button (showing SOL balance), user avatar.
- Hero section: full-width dark gradient banner. Headline "人間の知識を、AIへ" in large bold white text. Sub-copy "体験知・暗黙知をAIエージェントに販売しよう" in gray. Two CTA buttons: "出品する" (gradient primary), "ナレッジを探す" (outline secondary). Background: subtle grid lines + floating glowing orbs.
- Section "新着ナレッジ": horizontal scroll row of 4 KnowledgeCards. Each card: dark card #111827, top-left badge (content type pill: "テキスト・記事" / "データ・資料" etc), title, seller avatar + name, star rating, price in SOL and USDC.
- Section "人気ナレッジ": same card grid, 4 columns.
- Section "カテゴリ": 6 icon tiles in a row (AI/機械学習, ファイナンス, プログラミング, マーケティング, リーガル, その他).
- Section "TOP出品者": 3 SellerRankingCards horizontally. Each: rank number in accent color, avatar, display_name, total sales in SOL, listing count.
- Footer: dark, logo + links (利用規約/プライバシー/特商法/お問い合わせ), copyright.

Style: Web3 dark UI, background #0a0b0f, accent gradient purple→cyan, Inter + JetBrains Mono, card hover glow.
```

---

## 2. 検索ページ (`/search`)

```
Design a Web3 dark knowledge search page for "KnowMint".

Layout (desktop, 1440px):
- Header: same sticky header as home.
- Search bar: full-width prominent input at top of page content, with search icon left, placeholder "ナレッジを検索...", dark background #1a1f2e, cyan focus ring.
- Left sidebar (240px): filter panel.
  - Section "カテゴリ": checkbox list.
  - Section "コンテンツタイプ": checkbox list (テキスト・記事 / テンプレート・設定 / データ・資料 / リンク・外部リソース / その他).
  - Section "種別": radio (出品 / 募集 / すべて).
  - Section "価格帯 (SOL)": dual range slider, min/max inputs.
  - Section "並び替え": select dropdown (新着 / 人気 / 価格低順 / 価格高順 / 評価 / 信頼スコア).
  - "フィルターをリセット" ghost button at bottom.
- Main area: results count "123件のナレッジ", 3-column card grid. KnowledgeCard: dark card, type badge, listing_type badge ("出品"=blue / "募集"=orange), title (2 lines), description (3 lines truncated), seller row (avatar + name + trust score star), bottom row: rating stars + purchase count + price (SOL / USDC, mono font).
- Pagination at bottom: page numbers with accent color highlight.
- Empty state: centered illustration + "ナレッジが見つかりませんでした" message.

Style: Web3 dark, sidebar filters clean and compact, card grid breathable spacing.
```

---

## 3. ナレッジ詳細ページ (`/knowledge/[id]`)

```
Design a Web3 dark knowledge detail page for "KnowMint".

Layout (desktop, 1440px):
- Header: sticky.
- Breadcrumb: ホーム > カテゴリ名 > タイトル (small gray text).
- Main 2-column layout (left 65%, right 35%):

LEFT COLUMN:
  - Title (H1, white, large).
  - Tag row: content_type badge, listing_type badge, category badge, tags as pills.
  - Seller info row: avatar + display_name + trust score (⭐ 4.8) + "フォロー" outline button.
  - Stats row: 👁 1,234 閲覧  🛒 89 購入  ⭐ 4.7 評価 (muted icons, mono numbers).
  - Tabs: "プレビュー" | "詳細情報" | "バージョン履歴" | "レビュー"
    - プレビュー tab (default): preview_content in styled code/markdown block, dark #0d1117 background, syntax highlighted.
    - 詳細情報 tab: metadata table (専門分野, 経験タイプ, 適用先, ソース種別), seller_disclosure section.
    - バージョン履歴 tab: timeline list of versions with change_summary.
    - レビュー tab: average rating (large number + 5 stars) + review list (avatar + rating + comment + date).

RIGHT COLUMN (sticky):
  - Purchase card (dark #111827, border #7c3aed glow):
    - Price display: "0.05 SOL" large mono font accent, "or 5 USDC" smaller below.
    - "購入する" gradient primary button (full width, large).
    - EVM notice: small muted text "EVMチェーンは近日対応予定".
    - Divider.
    - "お気に入りに追加" heart icon button (outline, full width).
    - Seller disclosure snippet (collapsible).
  - Related listings section below card: 3 small KnowledgeCards.

- Purchase Modal (overlay): dark modal, title at top, wallet status (connected Phantom wallet address truncated), chain selector (Solana selected, Base/ETH grayed out), token selector (SOL / USDC tabs), terms checkbox, "購入を確認する" gradient button, loading spinner state, success state with TX hash link.

Style: Web3 dark, purchase card has subtle purple border glow, code preview dark terminal feel.
```

---

## 4. 出品フォーム (`/list`)

```
Design a Web3 dark 4-step listing creation form for "KnowMint".

Layout (desktop, 1440px):
- Header: sticky.
- Progress stepper at top: 4 steps "① 基本情報", "② コンテンツ", "③ 価格設定", "④ 確認・公開". Current step highlighted in accent gradient, completed steps with checkmark.

STEP 1 — 基本情報:
  - Listing type toggle: two large cards side by side "出品" (sell icon) and "募集" (search icon). Selected card has gradient border glow.
  - Text inputs: タイトル (required), 説明 (textarea, 500 chars), カテゴリ (dropdown), タグ (multi-tag input with pill removal).
  - Metadata section (collapsible "詳細情報を追加"): 専門分野, 経験タイプ, 適用先 (multi-select), ソース種別.
  - "次へ" primary button bottom right.

STEP 2 — コンテンツ:
  - If offer: two textareas side by side — "プレビューコンテンツ" (left, 公開プレビュー用) and "完全コンテンツ" (right, 購入者のみ閲覧). Monospace font, dark terminal background.
  - File upload zone (for dataset): dashed border card, upload icon, drag & drop text.
  - "前へ" ghost + "次へ" primary buttons.

STEP 3 — 価格設定:
  - Two price inputs side by side: "SOL 価格" (with Solana logo) and "USDC 価格" (with USDC logo). Monospace input, accent focus.
  - "販売者開示事項" textarea (任意).
  - Price preview card: shows formatted "0.05 SOL / 5 USDC".
  - "前へ" ghost + "次へ" primary buttons.

STEP 4 — 確認・公開:
  - Preview of listing card (same as KnowledgeCard component, full preview).
  - Summary table: type, content_type, price, tags.
  - "下書きとして保存" outline button + "公開する" gradient primary button.

Style: Web3 dark, step form feels like a wizard, inputs have cyan focus ring, dark #111827 card backgrounds.
```

---

## 5. ダッシュボード (`/dashboard`)

```
Design a Web3 dark seller dashboard for "KnowMint".

Layout (desktop, 1440px):
- Left sidebar (220px fixed): dark #0d1117.
  - User avatar + display_name + wallet address (truncated, mono font).
  - Nav items with icons: ダッシュボード / 出品管理 / 購入履歴 / 売上管理 / ランキング / お気に入り / APIキー / 設定.
  - Active item: gradient accent left border + subtle bg.
- Main content area:
  - Page title "ダッシュボード", subtitle "おかえりなさい、[name]さん".
  - Stats row: 4 StatsCards.
    - Card 1 (blue icon): 出品数 "12件" / +2 今月
    - Card 2 (green icon): 公開中 "8件"
    - Card 3 (purple icon): 総売上 "2.45 SOL" / +0.3 今月
    - Card 4 (amber icon): 平均評価 "4.7 ⭐"
    - Each card: dark #111827, icon in colored rounded square, large mono number, subtle trend arrow.
  - Sales chart section: line chart (dark background, gradient fill under line, purple→cyan), date range selector tabs (7日 / 30日 / 90日).
  - Recent transactions table: columns — ナレッジタイトル / 購入者 / 金額 / チェーン / ステータス badge / TX hash (mono, truncated, link icon) / 日時. Alternating row subtle shade.
  - Recent listings section: small card list (3 items) with status badges.

Style: Web3 dark sidebar navigation, stats cards with colored icons, chart with gradient fill.
```

---

## 6. 出品管理 (`/dashboard/listings`)

```
Design a Web3 dark listings management page for "KnowMint" dashboard.

Layout (desktop, 1440px):
- Same left sidebar as dashboard.
- Page title "出品管理" + "新規出品" gradient button top right.
- Filter tabs: すべて / 公開中 / 下書き / アーカイブ / 停止中. Tab count badge.
- Search input + sort dropdown inline.
- Listings table:
  - Columns: タイトル / 種別 / コンテンツタイプ / 価格 / 閲覧数 / 購入数 / 評価 / ステータス / 操作
  - Status badges: "公開中" green pill, "下書き" gray pill, "アーカイブ" yellow pill, "停止中" red pill.
  - Operaton column: "編集" icon button + "削除" icon button (red hover).
  - Row hover: subtle accent border left.
- Pagination.
- Empty state: "出品がありません" with "最初のナレッジを出品する" CTA button.

Style: data table with dark rows, status badges as colored pills, clean minimal.
```

---

## 7. 購入履歴 (`/dashboard/purchases`)

```
Design a Web3 dark purchase history page for "KnowMint" dashboard.

Layout (desktop, 1440px):
- Same left sidebar.
- Page title "購入履歴".
- Summary stats row: 総購入数 / 総支払額 (SOL) / 総支払額 (USDC).
- Filter: date range picker + chain filter (Solana/Base/ETH) + status filter.
- Purchases table:
  - Columns: ナレッジ（サムネ+タイトル） / 出品者 / 支払額 / チェーン icon / トークン / ステータス badge / TX hash (mono 8chars...8chars, copy icon, external link icon) / 購入日
  - "コンテンツを見る" button on confirmed rows.
  - Status: "confirmed" = green, "pending" = yellow, "failed" = red.
- Clicking row → expand to show full TX hash + view content button.

Style: Web3 dark, TX hash in mono font, chain icons, status badges.
```

---

## 8. ライブラリ (`/library`)

```
Design a Web3 dark purchased content library page for "KnowMint".

Layout (desktop, 1440px):
- Header: sticky.
- Page title "マイライブラリ" + total count.
- Filter row: コンテンツタイプ chips + sort (購入日 / タイトル) + search.
- 3-column card grid. LibraryCard:
  - Dark card #111827, content_type badge top-left.
  - Title, seller name.
  - Purchase date (mono, small, muted).
  - Bottom: "コンテンツを見る" gradient button.
- Click → /library/[id]:
  - Full page content viewer. Title + seller + purchase date header.
  - Content area: dark terminal-style block for text, download button for files.
  - "レビューを書く" CTA at bottom (if not reviewed).

Style: Web3 dark, library feel, content viewer like a terminal/IDE.
```

---

## 9. ログイン・サインアップ (`/login`, `/signup`)

```
Design Web3 dark authentication pages for "KnowMint".

LOGIN PAGE (/login):
- Full-page split layout: left 40% = dark #0a0b0f branding panel, right 60% = form panel.
- Left panel: KnowMint logo + tagline "人間の知識を、AIへ" + floating animated orbs (purple/cyan).
- Right panel:
  - "ログイン" heading.
  - Email input (dark #111827, cyan focus border).
  - Password input + show/hide toggle.
  - "ログイン" gradient primary button (full width).
  - Divider "または".
  - Google OAuth button (outline).
  - Link: "アカウントをお持ちでない方 → 新規登録".

SIGNUP PAGE (/signup):
- Same split layout.
- Form: user_type toggle — "人間ユーザー" 🧑 / "AIエージェント" 🤖 (large card toggle, selected = gradient border).
- Email, Password, Confirm Password inputs.
- "アカウントを作成" gradient button.
- Terms agreement checkbox.

Style: minimal clean auth forms, left panel dark atmospheric, right panel slightly lighter #111827.
```

---

## 10. ランキング (`/rankings`)

```
Design a Web3 dark seller rankings page for "KnowMint".

Layout (desktop, 1440px):
- Header: sticky.
- Page title "出品者ランキング" + subtitle "信頼スコアと売上でランク付け".
- Top 3 podium section: 3 large cards in 2nd-1st-2nd height order. Each card: rank number large (gradient accent), avatar (large, ring accent color), display_name, trust_score with star icon, total_sales_sol in mono font, listing_count. Gold/Silver/Bronze accents.
- Ranking table (4位〜20位): compact rows.
  - Columns: 順位 / アバター+名前 / trust_score / 総売上 (SOL) / 出品数 / 平均評価.
  - Rank number accent color, hover row glow.
- Period filter: 全期間 / 今月 / 今週 tabs.

Style: leaderboard feel, top 3 podium dramatic, table clean with rank numbers in accent.
```

---

## 11. プロフィール編集 (`/profile`)

```
Design a Web3 dark profile settings page for "KnowMint".

Layout (desktop, 1440px):
- Header: sticky.
- Page title "プロフィール編集".
- Two-column form:
  LEFT (form):
    - Avatar upload: circular avatar preview, "変更" button overlay on hover.
    - display_name input.
    - bio textarea (200 chars, counter).
    - "保存する" gradient primary button.
  RIGHT (preview card):
    - Live preview of how profile appears as SellerCard on listings.
    - Shows avatar, name, trust_score stars, bio, follower count.
- Wallet section below: current wallet_address (mono font, truncated), "ウォレットを接続" button (Phantom icon). SIWS flow indicator.

Style: Web3 dark form, live preview card on right, wallet section with blockchain accent.
```

---

## 12. APIキー管理 (`/dashboard/api-keys`)

```
Design a Web3 dark API key management page for "KnowMint" dashboard.

Layout (desktop, 1440px):
- Same left sidebar.
- Page title "APIキー管理" + "新規キーを生成" gradient button.
- Info banner: "APIキーはSHA-256でハッシュ保存されます。発行後は1度のみ表示されます。" (amber warning style).
- Keys table:
  - Columns: キー名 / プレフィックス (mono "km_****...****") / 権限 badges / 最終使用 / 作成日 / 操作 (削除 red icon).
  - "新規生成" modal: キー名 input + 権限 checkboxes (read/write/webhook) + "生成する" button → reveal modal showing full key once with copy button + "閉じる".
- Permissions displayed as small colored badges (read=blue, write=purple, webhook=cyan).

Style: security/developer tool aesthetic, mono font for key values, warning banner amber.
```

---

## 使用方法

1. Google Stitch (https://stitch.withgoogle.com) を開く
2. "New design" を作成
3. 上記プロンプトを1画面ずつ貼り付けて生成
4. **共通スタイル指示** を各プロンプトの末尾（または先頭）に追加すると一貫性が出る
5. 生成後はカラー・フォントを Fine-tune で調整

## 補足メモ

- Stitch はレスポンシブ対応のため、モバイル版が必要な場合は末尾に `Also show mobile (375px) version.` を追加
- コンポーネント名（KnowledgeCard, StatsCard など）は Stitch のレイヤー命名に活用可能
- 色コード: `#0a0b0f` (bg), `#111827` (card), `#7c3aed` (purple), `#06b6d4` (cyan), `#1f2937` (border)
