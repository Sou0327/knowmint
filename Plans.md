# KnowMint - 開発計画

> AIエージェントが x402 プロトコルで SOL を直接自律支払いできる、初のナレッジマーケットプレイス
> 決済: Solana x402 自律購入 (ノンカストディアル P2P)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: エージェントが x402 で自律購入 — AIエージェントを活用した知識調達（提案→承認）でも使える
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, 26, UI-1, PROD-TEST, CLI-PAY, CONTENT-1, DEMO-WEB, REVIEW-1 すべて `cc:DONE` (CONTENT-1, DEMO-WEB, REVIEW-1 を 2026-03-12 にアーカイブ)
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

**R.3 手動TODO**: GitHub Description/Topics/Website URL 設定 (knowmint.shop)

---

## Phase OB-1: エラー可視性強化 [P2]

- [ ] `queries.ts:142` DB エラーを console.error でログ `cc:TODO`
- [ ] `auth.ts:41` APIキールックアップ失敗時 console.error `cc:TODO`
- [ ] `knowledge/[id]/route.ts:42` reviews error ログ `cc:TODO`

---

## Phase SEC-1: エージェント出品ブロック [P2]

- [ ] `publish/route.ts` で `profiles.user_type === 'agent'` なら 403 `cc:TODO`

---

## Phase REVIEW-1: レビュー・スコア UI 有効化 [P2] `cc:完了`

> コミット e9e7920 — ReviewForm, FeedbackButton, trust_score 表示。10ファイル変更。

- [x] 1.1 ReviewForm を knowledge/[id]/page.tsx に組み込み (購入済み＆未レビュー時のみ) `cc:完了`
- [x] 1.2 購入済みコンテンツに FeedbackButton (Server Action) `cc:完了`
- [x] 1.3 usefulness_score を詳細ページに表示 `cc:完了`
- [x] 1.4 売り手プロフィールに trust_score 表示 `cc:完了`

---

## Phase B: Provider 最適化 + Playwright E2E [P1]

- [ ] B.1 WalletProvider lazy 化 (購入・出品ページのみ) `cc:TODO`
- [ ] B.2 Playwright セットアップ + Maestro 主要10フロー移植 `cc:TODO`
- [ ] B.3 CI に Playwright 組み込み `cc:TODO`

---

## Phase C: i18n URL + shadcn/ui [P1]

- [ ] C.1 next-intl URL ベース (`/ja/`, `/en/`) + hreflang + sitemap `cc:TODO`
- [ ] C.2 shadcn/ui 段階導入 (Button, Dialog, Input, Card → 自前削除) `cc:TODO`

---

## Phase MKT-1: ディスカバリー基盤 [P1 — マーケティング]

> 詳細: `docs/marketing/01-mcp-directories.md`, `02-awesome-lists.md`, `03-github-optimization.md`

- [ ] 1.1 公式 MCP Registry 登録 (mcpName → server.json → publish) `cc:TODO`
- [ ] 1.2 MCP ディレクトリ 5箇所 (mcp.so, PulseMCP, Smithery, MCP Server Finder, MCPServers.org) `cc:TODO`
- [ ] 1.3 Awesome Lists PR 7箇所 (awesome-mcp-servers, x402×3, awesome-solana-ai, selfhosted-data, awesome-agents) `cc:TODO`
- [ ] 1.4 GitHub 最適化 (Social Preview, Topics 20個, Discussions, FUNDING.yml) `cc:TODO`
- [ ] 1.5 HN Second Chance メール `cc:TODO`

---

## Phase GEO-1: AI 検索可視性 — Critical [P0 — GEO]

> GEO Audit Score: 25/100。AI クローラーブロック + llms.txt 未設置 + JSON-LD 不足が致命的。
> 監査実施: 2026-03-12

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-1.1 | robots.txt AI クローラー許可 (GPTBot, ClaudeBot, PerplexityBot, Google-Extended を Allow) | curl robots.txt で対象 UA が Disallow でない | - | cc:TODO |
| GEO-1.2 | `public/llms.txt` 作成 (サイト構造・API・MCP の説明) | /llms.txt が 200 返却 | - | cc:TODO |
| GEO-1.3 | meta description 改善 ("AI-native knowledge marketplace using x402...") + ホームページに引用可能な定義文ブロック追加 | meta description 100文字以上 + 定義 3-4文が SSR 出力に含まれる | - | cc:TODO |
| GEO-1.4 | Product JSON-LD 充実 (knowledge item: offers, priceCurrency, aggregateRating, author, image, datePublished) | Google Rich Results Test で Product が valid | - | cc:TODO |
| GEO-1.5 | Organization JSON-LD 追加 (name, url, logo, sameAs, description) | Google Rich Results Test で Organization が valid | - | cc:TODO |

---

## Phase GEO-2: Technical SEO 修正 [P1 — GEO]

> canonical 欠落、hreflang HTML なし、OG 不完全、Rankings バグ

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-2.1 | 全ページに canonical タグ設定 (homepage, rankings, search, knowledge item) | curl -s で `<link rel="canonical">` が全ページにある | - | cc:TODO |
| GEO-2.2 | HTML hreflang タグ追加 (sitemap だけでなく `<head>` にも) | `<link rel="alternate" hreflang="ja">` が HTML に出力 | - | cc:TODO |
| GEO-2.3 | Rankings ページ修正: "404" h1 バグ修正 + 空の場合 noindex | h1 が 1 つのみ + データなし時に meta robots noindex | - | cc:TODO |
| GEO-2.4 | OG/Twitter 修正: knowledge item に og:image fallback、全ページに twitter:site 設定 | og:image が全ページにある + twitter:site="@gensou_ongaku" | - | cc:TODO |
| GEO-2.5 | sitemap に /search, /category/* ページ追加 | sitemap.xml に /search と category ページが含まれる | - | cc:TODO |
| GEO-2.6 | HowItWorksSection を SSR 化 (`"use client"` 除去 or SSR 保証) | curl でホームページ取得時に How It Works のテキストが含まれる | - | cc:TODO |

---

## Phase GEO-3: ブランド & コンテンツ強化 [P1 — GEO]

> Brand Authority Score: 3/100。外部プラットフォームでの存在感ゼロ。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-3.1 | x402.org/ecosystem に KnowMint 登録申請 | PR or 申請フォーム送信済み | - | cc:TODO |
| GEO-3.2 | FAQ ページ作成 + FAQPage JSON-LD (x402 とは？, AI エージェント購入方法, etc.) | /faq が存在 + FAQPage schema valid | - | cc:TODO |
| GEO-3.3 | ホームページ統計値に出典リンク追加 ($10M+, 77% に Dune/Coinbase/業界レポートのソース) | 各数値にツールチップ or 脚注で出典が表示 | - | cc:TODO |
| GEO-3.4 | BreadcrumbList JSON-LD 追加 (knowledge item, category ページ) | Rich Results Test で BreadcrumbList valid | GEO-1.4 | cc:TODO |
| GEO-3.5 | npm `@knowmint/mcp-server` が検索可能か確認・対応 | `npm search knowmint` で表示される | - | cc:TODO |

---

## Phase MKT-2: SEO・コンテンツ基盤 [P1 — マーケティング]

> 詳細: `docs/marketing/04-seo-foundations.md`, `05-blog-content.md`
> 前提: GEO-1 完了後

- [ ] 2.1 GSC 登録 + Google Index 確認 `cc:TODO` depends:GEO-1
- [ ] 2.2 Hashnode ブログ (CF DNS CNAME `blog`) `cc:TODO`
- [ ] 2.3 Dev.to 記事 5本 `cc:TODO` depends:2.2

---

## Phase MKT-3: ソーシャルメディア [P2 — マーケティング]

> 詳細: `docs/marketing/06-social-media.md`, `07-reddit.md`

- [ ] 3.1 Bluesky (カスタムドメイン @knowmint.shop + 初期投稿10本 → 100フォロワー) `cc:TODO`
- [ ] 3.2 LinkedIn (プロフィール最適化 + 投稿5本) `cc:TODO`
- [ ] 3.3 Reddit 実行 (r/SideProject → r/ClaudeCode → r/solana → r/ClaudeAI → r/LocalLLaMA) `cc:TODO` depends:karma 50+

---

## Phase MKT-4: ローンチプラットフォーム [P1 — マーケティング]

> 詳細: `docs/marketing/08-launch-platforms.md`
> 前提: MKT-1 + DEMO-WEB 完了後

- [ ] 4.1 先行提出 (BetaList, DevHunt, Uneed) `cc:TODO`
- [ ] 4.2 Product Hunt ローンチ (2週間活動 → アセット → Draft → 火-木 00:01 PST) `cc:TODO` depends:DEMO-WEB, 4.1

---

## Phase MKT-5: コミュニティ・パートナーシップ [P2 — マーケティング]

> 詳細: `docs/marketing/09-communities.md`, `10-grants-hackathons.md`

- [ ] 5.1 コミュニティ参加 (CDP Discord, LangChain Slack, CrewAI, Solana SE 回答3件) `cc:TODO`
- [ ] 5.2 Superteam Earn グラント申請 ($10K USDC) `cc:TODO`
- [ ] 5.3 Colosseum Eternal ハッカソン (4週間スプリント + ビデオピッチ) `cc:TODO`

---

## Phase MKT-6: 動画・デモ [P2 — マーケティング]

> 詳細: `docs/marketing/11-video-demo.md`
> 前提: DEMO-WEB 完了後

- [ ] 6.1 YouTube チャンネル + Short + チュートリアル 2本 `cc:TODO`
- [ ] 6.2 デモサンドボックス (demo.knowmint.shop: devnet + airdrop + シード + ガイドツアー) `cc:TODO`

---

## Phase MKT-7: 長期施策 [P3 — マーケティング]

> 詳細: `docs/marketing/12-newsletters-pr.md`, `13-conferences.md`

- [ ] 7.1 ニュースレター (Console.dev, Changelog, JS/Node Weekly) `cc:TODO`
- [ ] 7.2 カンファレンス (AI Agents 4/26, NVIDIA GTC) `cc:TODO`
- [ ] 7.3 Anthropic MCP ディレクトリ (要: Streamable HTTP + Safety Annotations) `cc:TODO`
- [ ] 7.4 Solana Foundation グラント `cc:TODO` depends:MKT-5.2

---

## マーケティング依存関係

```
GEO-1 (AI検索可視性)  ←─ 最優先・即実行
  ├── GEO-2 (Technical SEO)  ←─ 並行可
  ├── GEO-3 (ブランド・コンテンツ)  ←─ 並行可
  └── MKT-2 (SEO・コンテンツ)  ←─ GEO-1 後
MKT-1 (ディスカバリー)  ←─ 即実行（GEO と並行可）
  ├── MKT-3 (ソーシャル)
  ├── MKT-4 (ローンチ)  ←─ DEMO-WEB + MKT-1 後
  ├── MKT-5 (コミュニティ)  ←─ 並行可
  └── MKT-6 (動画・デモ)  ←─ DEMO-WEB 後
        └── MKT-7 (長期)
```
