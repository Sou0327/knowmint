# KnowMint - 開発計画

> AIエージェントが x402 プロトコルで SOL を直接自律支払いできる、初のナレッジマーケットプレイス
> 決済: Solana x402 自律購入 (ノンカストディアル P2P)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: エージェントが x402 で自律購入 — AIエージェントを活用した知識調達（提案→承認）でも使える
**最優先ゴール**: OpenClawエージェントによる初の自律購入デモ

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, 26, UI-1, PROD-TEST, CLI-PAY, CONTENT-1, DEMO-WEB, REVIEW-1, GEO-1~5, SEC-1~2, OB-1, MKT-1 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

**手動TODO**: SEC-2.3 style-src unsafe-inline 削除検討

---

## Phase B: Provider 最適化 + Playwright E2E [P1]

- [x] B.1 WalletProvider lazy 化 (購入・出品ページのみ) `cc:完了`
- [ ] B.2 Playwright セットアップ + Maestro 主要10フロー移植 `cc:TODO`
- [ ] B.3 CI に Playwright 組み込み `cc:TODO`

---

## Phase C: i18n URL + shadcn/ui [P1]

- [ ] C.2 shadcn/ui 段階導入 (Button, Dialog, Input, Card → 自前削除) `cc:TODO`

---

## Phase MKT-2: SEO・コンテンツ基盤 [P1 — マーケティング]

- [ ] 2.1 GSC 登録 + Google Index 確認 `cc:TODO`
- [ ] 2.2 Hashnode ブログ (CF DNS CNAME `blog`) `cc:TODO`
- [ ] 2.3 Dev.to 記事 5本 `cc:TODO` depends:2.2

---

## Phase MKT-3: ソーシャルメディア [P2 — マーケティング]

> 詳細: `docs/marketing/06-social-media.md`, `07-reddit.md`

- [ ] 3.1 X 運用 (Solana/AI agent 界隈フォロー + 初期投稿10本 + 引用RT・リプで認知) `cc:TODO`
- [ ] 3.2 LinkedIn (プロフィール最適化 + 投稿5本) `cc:TODO`
- [ ] 3.3 Reddit 実行 (r/SideProject → r/ClaudeCode → r/solana → r/ClaudeAI → r/LocalLLaMA) `cc:TODO` depends:karma 50+

---

## Phase MKT-4: ローンチプラットフォーム [P1 — マーケティング]

- [ ] 4.2 Product Hunt ローンチ (2週間活動 → アセット → Draft → 火-木 00:01 PST) `cc:TODO` depends:DEMO-WEB

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

## Phase GEO-6: GEO 監査 2026-03-13 対応 [P1 — GEO]

> GEO Full Audit 2026-03-13: Composite **45/100** → 目標 65。
> 最大ボトルネック: Brand Authority 14/100 (オフサイト=MKT担当), Content 41/100, Schema 52/100。
> Technical 82/100 は良好だが CRITICAL 修正あり。Platform Readiness 38/100。
> オフサイト施策 (Reddit, LinkedIn, Wikidata, YouTube メタ最適化) は MKT-3/6 で管理。

### Technical CRITICAL

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.1 | Cloudflare で HTTP→HTTPS リダイレクト有効化 | `curl -I http://knowmint.shop` が 301→https 返却 | - | cc:TODO (手動: Cloudflare Dashboard) |
| GEO-6.2 | `/search` の商品リストを HTML レンダリング (RSC payload のみ→SSR) | `curl https://knowmint.shop/search` にアイテムタイトルが含まれる | - | cc:完了 (2026-03-14) KnowledgeCard Server Component 化 |
| GEO-6.3 | 空ページ対策: `/rankings` と 0件カテゴリに noindex meta 追加 | 0件時に `<meta name="robots" content="noindex">` 出力 | - | cc:完了 (2026-03-14) hasAnySellers + fail-open for SEO |
| GEO-6.4 | `/knowledge` 親パス 404 修正 → `/search` へリダイレクト | `/knowledge` アクセスで 308→`/search` | - | cc:完了 (2026-03-14) locale-aware permanentRedirect |

### robots.txt 改善

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.5 | robots.txt に OAI-SearchBot, ChatGPT-User, bingbot 追加 | robots.txt に 3 bot が明示 Allow | - | cc:完了 (2026-03-14) |

### Schema 改善

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.6 | Person schema 追加 (出品者の構造化データ) | knowledge detail ページに Person JSON-LD 出力 (human seller のみ) | - | cc:完了 (2026-03-14) user_type ガード付き |
| GEO-6.7 | speakable プロパティ追加 (WebPage, FAQPage) | JSON-LD に speakable.cssSelector 含まれる | - | cc:完了 (2026-03-14) WebPage ノードに移動 |
| GEO-6.8 | HowTo schema 削除 (2023年リッチリザルト廃止済み) | homepage JSON-LD に HowTo なし | - | cc:完了 (2026-03-14) |
| GEO-6.9 | BreadcrumbList を FAQ/About/Developers/Rankings/Security に追加 | 5ページ全てに BreadcrumbList JSON-LD | - | cc:完了 (2026-03-14) |
| GEO-6.10 | Organization sameAs 拡張 (YouTube チャンネル追加) | sameAs に youtube.com URL 含む | MKT-6.1 | cc:TODO (MKT-6.1 待ち) |

### Content 改善

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.11 | 統計値にソース URL 追加 ($10M+ x402, 77% Solana AI TX) | 各数値にクリック可能リンク | - | cc:完了 (2026-03-14) StatsBanner + i18n URL キー |
| GEO-6.12 | ホームページに YouTube デモ動画埋め込み + VideoObject schema | CSP frame-src 準備済み。動画 URL 設定後に有効化 | MKT-6.1 | cc:完了 (2026-03-14) CSP 部分実装 |
| GEO-6.13 | About ページ拡充 (創業ストーリー、技術選定理由、ロードマップ → 1500語) | /about の word count 1500+ | - | cc:完了 (2026-03-14) 8セクション追加 |
| GEO-6.14 | 「0% trust」表示修正 → データ不足時「New Seller」バッジに変更 | trust score 0 の seller に "New" 表示 | - | cc:完了 (2026-03-14) SellerCard + SellerRankingCard |

### Platform 固有

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.15 | IndexNow プロトコル実装 (Bing インデックス高速化) | `/indexnow-key.txt` 存在 + publish 時 IndexNow API 呼び出し | - | cc:完了 (2026-03-14) async + keyLocation + after() |
| GEO-6.16 | homepage title 拡張 (55-60字、キーワード含む) | `<title>` が 55字以上で x402/AI agent 含む | - | cc:完了 (2026-03-14) en/ja 両方 |

### Codex レビュー検出の残課題 (GEO-6 スコープ外)

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.R1 | getTopSellers を SQL GROUP BY (RPC/view) に置換 | DB 側で seller_id 集約、JS 全件取得を廃止 | - | cc:TODO |
| GEO-6.R2 | logAuditEvent を Promise<void> に変更 + after() で await | audit ログが serverless で確実に完走 | - | cc:TODO |
| GEO-6.R3 | publish route に `.eq("status", "draft")` 追加 (TOCTOU 修正) | UPDATE 条件に status=draft 含む | - | cc:TODO |
| GEO-6.R4 | indexnow-key.txt をデプロイ時に INDEXNOW_KEY と同期 | Cloudflare env + ファイル内容一致 | - | cc:TODO (手動: デプロイ時) |

### MKT フェーズへのクロスリファレンス (手動タスク)

> 以下はオフサイト施策のため MKT で管理。GEO スコア向上に直結する。
> - **MKT-3.2**: LinkedIn 企業ページ → Brand +10, sameAs 拡張
> - **MKT-3.3**: Reddit 投稿実行 → Brand +15, Perplexity +10
> - **MKT-4.2**: Product Hunt → Brand +5
> - **MKT-6.1**: YouTube メタデータ最適化 (タイトル・説明文・タグ) → Gemini +15
> - **新規手動**: Wikidata エントリ作成 → ChatGPT/Gemini エンティティ認識

---

## Phase UX-1: ホームページ UX 改善 [P1]

> ui-ux-pro-max レビュー結果。DQ テーマ維持 + Marketplace UX ベストプラクティス適用。
> 目標: 認知負荷削減、コンバージョン動線強化、アクセシビリティ改善。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| UX-1.1 | Hero に検索バー追加（Marketplace パターン） | `/` にDQテーマの検索フォームが表示され、入力→`/search?q=` に遷移 | - | cc:完了 (2026-03-15) |
| UX-1.2 | emoji → Lucide SVG アイコン置換（ValueProps, HowItWorks, Categories, AccessMethods） | 全セクションで emoji が 0、Lucide アイコンが `text-dq-gold`/`text-dq-cyan` で表示 | - | cc:完了 (2026-03-15) |
| UX-1.3 | Stats 重複解消（Hero 内 Stats strip 削除 → StatsBanner に一本化） | Hero セクションに stats 表示なし、StatsBanner のみに集約 | - | cc:完了 (2026-03-15) |
| UX-1.4 | Definition ブロックを Hero サブテキストに統合（セクション数削減） | 独立 Definition section が消え、Hero の catchphrase に内容が統合 | UX-1.3 | cc:完了 (2026-03-15) |
| UX-1.5 | `prefers-reduced-motion` 対応（transition-all → motion-safe prefix） | `@media (prefers-reduced-motion: reduce)` でアニメーション無効化 | - | cc:完了 (2026-03-15) |
| UX-1.6 | モバイル CTA 到達改善（Hero 下にセカンダリ CTA 追加 or スティッキーバー） | モバイル375pxで出品/API CTA がスクロールなしでアクセス可能 | UX-1.1 | cc:完了 (2026-03-15) |
| UX-1.7 | カテゴリカードのアイコンを SVG に統一 | カテゴリ一覧で Lucide アイコンが表示、emoji なし | UX-1.2 | cc:完了 (2026-03-15、UX-1.2 に包含) |

---

## Phase PERF-1: sitemap パフォーマンス改善 [P3]

> Codex GEO-5 レビューで検出。sitemap の動的生成を最適化。

- [ ] PERF-1.1 sitemap.ts を `force-dynamic` → ISR (`revalidate`) or `unstable_cache` に変更 `cc:TODO`
- [ ] PERF-1.2 50k URL 上限に備え `generateSitemaps()` で sitemap index 分割対応 `cc:TODO`

---

## 依存関係

```
GEO-6 (GEO監査対応 45→65) ←─ 今ここ (オンサイト16タスク)
MKT-2 (SEO・コンテンツ) / MKT-3 (ソーシャル) / MKT-4 (PH) ←─ 並行可
MKT-5 (コミュニティ) / MKT-6 (動画) → MKT-7 (長期)
```
