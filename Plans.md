# KnowMint - 開発計画

> AIエージェントが x402 プロトコルで SOL を直接自律支払いできる、初のナレッジマーケットプレイス
> 決済: Solana x402 自律購入 (ノンカストディアル P2P)
> アクセス: Web UI / CLI (`km`) / REST API + MCP

**コアバリュー**: エージェントが x402 で自律購入 — AIエージェントを活用した知識調達（提案→承認）でも使える
**最優先ゴール**: 最初の10件の実購入トランザクション達成

> **2026-03-15 戦略レビュー結果**: ビジネスパネル批評により MKT フェーズを再構成。
> 根本問題: 出品コンテンツゼロ・体験導線なし・需要未検証の状態でディレクトリ掲載を優先していた。
> 修正方針: (1) 供給側を自分で埋める (2) 体験導線を作る (3) 5人に直接使ってもらう → その後マーケティング。

## 完了済みフェーズ

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, 26, UI-1, PROD-TEST, CLI-PAY, CONTENT-1, DEMO-WEB, REVIEW-1, GEO-1~6, SEC-1~2, OB-1, MKT-1, UX-1 すべて `cc:DONE`
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

## Phase MKT-CS: コールドスタート解消 [**最優先** — マーケティング以前の前提条件]

> **2026-03-15 パネル合意**: マーケットプレイスの鶏卵問題を解決しない限り、全マーケティング施策の変換率はゼロ。
> 出品側を自分で埋め、リスクなしで体験できる導線を作り、5人に直接声をかける。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| CS.1 | 自作ナレッジ 20-30件出品 (Claude Code tips, MCP パターン, Solana tx 検証, x402 実装ガイド等) | knowledge_items テーブルに 20件以上、全カテゴリ (prompt/tool_def/dataset/api/general) カバー | - | cc:TODO |
| CS.2 | devnet デモサンドボックス構築 (demo.knowmint.shop) | ウォレット接続→自動 airdrop→購入→コンテンツ閲覧が devnet で完結。ガイドツアー付き | - | cc:TODO |
| CS.3 | 開発者5人に直接声をかけて使ってもらう (Do things that don't scale) | 5人が実際に MCP or Web UI で検索→購入を完了。フィードバック記録 | CS.1, CS.2 | cc:TODO |
| CS.4 | 経済エンジン設計 (手数料率、平均単価、損益分岐取引件数の明文化) | `docs/business-model.md` に数値入り | - | cc:TODO |

**撤退条件**: CS.3 で5人中4人以上が「使わない/必要ない」と回答した場合、ピボットまたはプロジェクト方針見直し。

---

## Phase MKT-2: SEO 基盤 + ディレクトリ一括登録 [P1 — マーケティング]

> 受動的チャネル確保。半日で全部やる。やらない理由がない施策群。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | GSC 登録 + Google Index 確認 + sitemap 送信 | GSC にプロパティ追加、sitemap.xml 送信済み | - | cc:完了 |
| 2.2 | MCP Registry + mcp.so + PulseMCP + Smithery 一括登録 | 4ディレクトリに掲載確認 | - | cc:TODO |
| 2.3 | Awesome MCP Servers + x402 ecosystem + awesome-x402 + awesome-solana-ai に PR | 4 PR 作成 | - | cc:TODO |
| 2.4 | BetaList 提出 (2ヶ月待ちなので即日) | BetaList にサブミット完了 | - | cc:TODO |
| 2.5 | Colosseum Eternal ハッカソン登録 (非対称リターン: 工数2日 / 最大 $250K) | Arena アカウント作成 + スプリント開始 | - | cc:TODO |
| 2.6 | HN second chance メール送信 | hn@ycombinator.com にメール送信 | - | cc:TODO |

---

## Phase MKT-3: コンテンツ + Reddit [P1 — マーケティング]

> CS 完了後に実行。技術記事で認知 → Reddit で直接ターゲットにリーチ。
> 詳細: `docs/reddit-promotion-guide.md`, `docs/marketing-deep-dive.md`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.1 | Hashnode ブログ (blog.knowmint.shop CNAME 設定) | `https://blog.knowmint.shop` にアクセス可能 | - | cc:完了 (2026-03-15) |
| 3.2 | Dev.to 技術記事 1本目 (x402 + MCP 実装解説。宣伝ではなく技術教育) | Dev.to に公開、canonical URL 設定済み | 3.1 | cc:TODO |
| 3.3 | Reddit 投稿 5本 (r/SideProject → r/ClaudeCode → r/solana → r/ClaudeAI → r/LocalLLaMA) | 5 subreddit に投稿完了。各テンプレートを自分の言葉で書き直し | CS.1 | cc:TODO |
| 3.4 | Reddit 「Why not Stripe?」回答テンプレート追加 + 各投稿のリンク構成分散 | reddit-promotion-guide.md 更新済み | - | cc:TODO |
| 3.5 | Colosseum ビデオピッチ提出 (3分) | ビデオピッチ + 技術ウォークスルー動画提出 | 2.5 | cc:TODO |
| 3.6 | Bluesky アカウント + カスタムドメイン + 毎日投稿開始 | @knowmint.shop ハンドルで 10投稿以上 | - | cc:TODO |

**Reddit 撤退条件**: 3本投稿して合計 upvote 20未満なら Reddit 戦略を停止し、Dev.to 記事集中に切り替え。

---

## Phase MKT-4: ローンチプラットフォーム [P2 — マーケティング]

> **前提**: CS.3 完了 + アクティブユーザー10人以上。それ以前の Product Hunt は空振りリスク大。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 4.1 | Product Hunt ローンチ (2週間活動 → アセット → Draft → 火-木 00:01 PST) | PH にローンチ完了 | CS.3, MKT-3.3 | cc:TODO |
| 4.2 | DevHunt + Uneed 提出 | 2プラットフォームに提出完了 | - | cc:TODO |

---

## Phase MKT-5: コミュニティ + グラント [P2 — マーケティング]

> 詳細: `docs/marketing/09-communities.md`, `10-grants-hackathons.md`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 5.1 | CDP Discord + Solana Tech Discord 参加 (2-3日信頼構築後に紹介) | 2コミュニティで KnowMint 紹介済み | - | cc:TODO |
| 5.2 | Superteam Earn グラント申請 ($10K USDC) | 申請書提出 | CS.1 | cc:TODO |
| 5.3 | Dev.to 残り 4記事 (x402 解説, Missing Piece, CF+Supabase+Solana, Solo Dev to OSS) | 4記事公開、シリーズ設定済み | 3.2 | cc:TODO |
| 5.4 | AI Agents Conference (4/26-30) CFP 応募 | CFP 提出。締切を即確認 (期限切れなら skip) | - | cc:TODO |

---

## Phase MKT-6: 長期施策 [P3 — マーケティング]

> 実ユーザー・実績ができてから実行する施策。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 6.1 | Anthropic MCP ディレクトリ (要: Streamable HTTP + Safety Annotations) | Streamable HTTP 対応 + 提出 | - | cc:TODO |
| 6.2 | Solana Foundation 直接グラント申請 | 申請書提出 | 5.2 (Superteam 実績後) | cc:TODO |
| 6.3 | X 運用 (Solana/AI agent 界隈フォロー + 投稿) | 週2-3投稿ペース確立 | - | cc:TODO |

### 明示的にやらない施策 (ROI 不足 or 時期尚早)

> パネルレビューにより除外。状況変化で再検討。

| 施策 | 除外理由 |
|------|----------|
| YouTube チャンネル開設 | 視聴者ゼロから動画制作は ROI 最悪。デモ GIF で十分 |
| LinkedIn 投稿 | B2B/エンタープライズ向けでない限り効果薄 |
| TikTok | 開発者がターゲットなのにチャネルミスマッチ |
| ニュースレター掲載依頼 | 実績ゼロでは無視される。実ユーザー獲得後に再検討 |
| r/webdev, r/opensource, r/indiehackers | ターゲットが薄くリソース分散 |
| NVIDIA GTC (3/16-19) | 日程経過済み。2027年版で再検討 |

---

## Phase MKT-NOW: 知名度ゼロから即実行できるコード実装 [P1 — MKT-CS と並行可]

> TPP プレイブック (docs/marketing-tpp-playbook.md) より抽出。
> フォロワー・実績・信頼が一切不要で、CC が即実装できるタスクのみ。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| NOW.1 | SKILL.md をリポジトリルートに追加 (SkillsMP 96K+ skills が自動クロール) | `/SKILL.md` が存在し、name/description/tags/capabilities/install セクションを含む | - | cc:完了 |
| NOW.2 | knowmint.shop にメールキャプチャフォーム追加 | ホームページにメール入力フォーム表示。Supabase `email_subscribers` テーブルに保存。重複排除 | - | cc:完了 |
| NOW.3 | 購入後シェアカード生成 + Twitter シェアボタン | 購入完了画面に ShareCard + Twitter intent URL + リンクコピー表示 | - | cc:完了 |
| NOW.4 | awesome-x402 リポジトリ作成 (GitHub) | `docs/marketing/awesome-x402-readme.md` に README 生成済み。人間が GitHub リポ作成+push | - | cc:完了 |
| NOW.5 | MCP ディレクトリ一括登録用テキスト生成 (6 箇所分) | `docs/marketing/mcp-directory-submissions.md` 生成済み。人間がコピペ提出 | - | cc:完了 |
| NOW.6 | Agent ディレクトリ一括登録用テキスト生成 (Skills.sh / AI Agent Store / agentregistry 等) | `docs/marketing/agent-directory-submissions.md` 生成済み。人間がコピペ提出 | NOW.1 | cc:完了 |
| NOW.7 | x402 エコシステム PR 用ファイル一式生成 (coinbase/x402 + awesome-x402 2リポ + awesome-solana-ai) | `docs/marketing/x402-pr-templates.md` 生成済み。人間が PR 作成 | - | cc:完了 |

> **人間がやること**: NOW.5-7 の生成テキストを各サイト/リポにコピペ提出。NOW.4 の GitHub リポ作成+push。

---

## Phase GEO-6 残課題 [P2]

> GEO-6 の14/16タスク完了。残りの未完了タスクのみ。完了分は `plans/archive-geo6-ux1.md` 参照。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-6.1 | Cloudflare で HTTP→HTTPS リダイレクト有効化 | `curl -I http://knowmint.shop` が 301→https | - | cc:TODO (手動) |
| GEO-6.R1 | getTopSellers を SQL GROUP BY に置換 | DB 側で集約 | - | cc:完了 |
| GEO-6.R2 | logAuditEvent → Promise<void> + after() | serverless 完走保証 | - | cc:完了 |
| GEO-6.R3 | publish route TOCTOU 修正 | status=draft 条件追加 | - | cc:完了 |
| GEO-6.R4 | indexnow-key.txt デプロイ同期 | env+ファイル一致 | - | cc:TODO (手動) |

> GEO オフサイト施策は MKT-3 (Reddit → Brand +15) / MKT-6 (X → Brand) で管理。

---

## Phase GEO-7: コストゼロ技術修正バッチ [P2 — MKT-CS と並行可]

> GEO 監査 (2026-03-14, 51/100) で検出。コードだけで完結し MKT-CS と並行実行可能な改善。
> Brand Authority (11/100) は技術修正では動かないため、スキーマ/コンテンツの低コスト改善に絞る。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| GEO-7.1 | llms.txt を標準仕様にリライト (`# Title`, `> Summary`, `## Section`) | Perplexity/ChatGPT の retrieval パイプラインが期待する形式に準拠 | - | cc:完了 (既に準拠済み) |
| GEO-7.2 | FAQ Q4/Q17 重複統合 | MCP セットアップ FAQ が1つに統合、冗長解消 | - | cc:完了 |
| GEO-7.3 | BreadcrumbList を /search, /contact, /terms, /privacy に追加 | 4ページに JSON-LD BreadcrumbList 出力 | - | cc:完了 |
| GEO-7.4 | ContactPage + ContactPoint スキーマを /contact に追加 | JSON-LD 検証通過 | - | cc:完了 |
| GEO-7.5 | Organization スキーマ強化 (foundingDate, knowsAbout, logo→ImageObject) | ホームページ JSON-LD に反映 | - | cc:完了 |
| GEO-7.6 | SoftwareApplication スキーマ強化 (softwareVersion, downloadUrl, codeRepository, license) | /developers の JSON-LD に反映 | - | cc:完了 |
| GEO-7.7 | title タグを 60文字以内に短縮 | SERP 切り詰めなし | - | cc:完了 |

> **CS 完了後に再検討**: Wikidata Q-ID、「AI-Native Commerce」定義ページ、創業者身元公開、固有メトリクス公開

---

## Phase PERF-1: sitemap パフォーマンス改善 [P3]

> Codex GEO-5 レビューで検出。sitemap の動的生成を最適化。

- [ ] PERF-1.1 sitemap.ts を `force-dynamic` → ISR (`revalidate`) or `unstable_cache` に変更 `cc:TODO`
- [ ] PERF-1.2 50k URL 上限に備え `generateSitemaps()` で sitemap index 分割対応 `cc:TODO`

---

## 依存関係

```
MKT-NOW (即実装) ←─ 今すぐ並行可 (CC がコード実装)
MKT-CS (コールドスタート) ←─ 最優先
  ├─ CS.1 自作コンテンツ + CS.2 デモサンドボックス → CS.3 5人テスト
  │    撤退条件: 4/5人「不要」→ ピボット
MKT-2 (ディレクトリ一括) ←─ NOW.5-7 のテキストでコピペ提出
MKT-3 (記事+Reddit) ←─ CS.1 完了後
MKT-4 (PH) ←─ CS.3 + MKT-3 完了後
MKT-5/6 (グラント/長期) ←─ 実績後
```
