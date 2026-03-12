# KnowMint - 開発計画

> AIエージェントが x402 プロトコルで SOL を直接自律支払いできる、初のナレッジマーケットプレイス
> 決済: Solana x402 自律購入 (ノンカストディアル P2P)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: エージェントが x402 で自律購入 — AIエージェントを活用した知識調達（提案→承認）でも使える
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, 26, UI-1, PROD-TEST, CLI-PAY, CONTENT-1, DEMO-WEB, REVIEW-1, GEO-1, GEO-2, GEO-3 すべて `cc:DONE` (GEO-3 を 2026-03-13 にアーカイブ)
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

- [x] C.1 next-intl URL ベース (`/ja/`, `/en/`) + hreflang + sitemap `cc:完了`
  > Phase C (5cb7632) で URL ベースルーティング移行、GEO-2 (3ad9c6e) で hreflang HTML + sitemap 拡充
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

---

## Phase GEO-4: スコア改善 Quick Wins [P1 — GEO]

> GEO Audit 2026-03-13 で特定された改善項目。Composite Score 62→目標75。
> 最大ボトルネック: Brand Authority 28/100, Content E-E-A-T 54/100, Schema 75/100。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-4.1 | Product schema に price/offers/image 追加 (Rich Results 解放) | Google Rich Results Test で Product valid | GEO-3 | cc:完了 |
| GEO-4.2 | Category ページに CollectionPage/ItemList schema 追加 | JSON-LD に CollectionPage が出力される | GEO-3.4 | cc:完了 |
| GEO-4.3 | HowTo schema を「使い方」セクションに追加 | Rich Results Test で HowTo valid | - | cc:完了 |
| GEO-4.4 | FAQ 拡充 (トラブルシュート, ガス代, セキュリティ → 計12項目) | /faq に 12 Q&A + FAQPage schema 更新 | GEO-3.2 | cc:完了 |
| GEO-4.5 | llms.txt に料金体系・レート制限・SLA セクション追加 | /llms.txt に Pricing, Rate Limits, SLA 記載 | - | cc:完了 |
| GEO-4.6 | `/developers` ページ作成 (MCP/CLI/API ドキュメントをWeb公開) | /developers が存在 + MCP config 例含む | - | cc:完了 |
| GEO-4.7 | ReviewSchema をレビューセクションに追加 | knowledge detail で Review JSON-LD 出力 | GEO-1.4 | cc:完了 |
| GEO-4.8 | x402 ecosystem PR 送信 (coinbase/x402 へ metadata.json + logo) | PR URL 取得 | GEO-3.1 | cc:TODO (手動) |

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
GEO-1 (AI検索可視性)  ✅ 完了
  ├── GEO-2 (Technical SEO)  ✅ 完了 (59→79/100)
  ├── GEO-3 (ブランド・コンテンツ)  ✅ 完了 (59→62/100)
  │   └── GEO-4 (Quick Wins)  ✅ 完了 (7/8タスク, 4.8は手動)
  └── MKT-2 (SEO・コンテンツ)  ←─ GEO-1 後
MKT-1 (ディスカバリー)  ←─ 即実行（GEO と並行可）
  ├── MKT-3 (ソーシャル)
  ├── MKT-4 (ローンチ)  ←─ DEMO-WEB + MKT-1 後
  ├── MKT-5 (コミュニティ)  ←─ 並行可
  └── MKT-6 (動画・デモ)  ←─ DEMO-WEB 後
        └── MKT-7 (長期)
```
