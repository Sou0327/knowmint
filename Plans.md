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

Phase 1-14, 15, 15.6, 16-25, 27-32, 34, 36-46, 38.R, 45, R, A, B.1, 26, UI-1, PROD-TEST, CLI-PAY, CONTENT-1, DEMO-WEB, REVIEW-1, GEO-1~9, SEC-1~2, OB-1, MKT-1, UX-1~2, AVATAR, GEO-7~8 すべて `cc:DONE`
詳細は `plans/archive-*.md` 参照。Maestro E2E: 18フロー (21/22 ページ, 95%)

---

## Phase MKT-CS: コールドスタート解消 [**最優先** — マーケティング以前の前提条件]

> **2026-03-15 パネル合意**: マーケットプレイスの鶏卵問題を解決しない限り、全マーケティング施策の変換率はゼロ。
> 出品側を自分で埋め、リスクなしで体験できる導線を作り、5人に直接声をかける。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| CS.1 | 自作ナレッジ 20-30件出品 (Claude Code tips, MCP パターン, Solana tx 検証, x402 実装ガイド等) | knowledge_items テーブルに 20件以上、全カテゴリ (prompt/tool_def/dataset/api/general) カバー | - | cc:TODO |
| CS.2 | 無料ナレッジ導線 (price=0 で支払いスキップ → コンテンツ直接閲覧) | 無料アイテム 3-5件が支払いなしで閲覧可能。CS.1 の一部を無料で出品 | - | cc:TODO |
| CS.3 | 開発者5人に直接声をかけて使ってもらう (Do things that don't scale) | 5人が実際に MCP or Web UI で検索→購入を完了。フィードバック記録 | CS.1, CS.2 | cc:TODO |
| CS.4 | 経済エンジン設計 (手数料率、平均単価、損益分岐取引件数の明文化) | `docs/business-model.md` に数値入り | - | cc:TODO |

**撤退条件**: CS.3 で5人中4人以上が「使わない/必要ない」と回答した場合、ピボットまたはプロジェクト方針見直し。

---

## Phase MPP-1: Machine Payments Protocol (Tempo レール) [**最優先** — ファーストムーバー]

> **2026-03-20 戦略判断**: Stripe + Tempo が MPP を 3/18 に発表。発表から2日。
> Tempo レールは Stripe 不要で即実装可能（`mppx` SDK, MIT）。
> 「最速で MPP 対応したマーケットプレイス」を取る。実装自体がマーケティングイベント。
> Stripe SPT レール (fiat) は early access 申請済み (3/20) → 承認後に Phase MPP-2 で追加。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| MPP.1 | `mppx` SDK 調査 + 依存追加 + CF Workers 互換性検証 | ビルド成功 + テスト全通過 + バンドルサイズ 3MB 以内 | - | cc:完了 |
| MPP.2 | content route に MPP 決済レール追加 + DB migration + MPP アダプター + CORS + Codex レビュー 6R | 既存 x402 テスト不壊 + MPP challenge 返却 + Codex ISSUES_FOUND: 1 (medium: generated types のみ) | - | cc:完了 |
| MPP.3 | Tempo ウォレット受取設定（プラットフォーム EVM ウォレット: 0x208F6Ae8...） | testnet でウォレット作成+fund済み | MPP.2 | cc:完了 |
| MPP.4 | MCP サーバー (`km_get_content`) に MPP payment_authorization 対応追加 | `mppx` CLI or MCP 経由で content 取得が testnet で完了 | MPP.2 | cc:完了 |
| MPP.5 | testnet PoC + mainnet 切り替え + E2E テスト | Tempo testnet 決済成功 (mppx CLI → 402 → Payment → 200 + content) + DB に chain=tempo 記録確認 | MPP.1-4 | cc:完了 (testnet PoC) / mainnet は MPP.6 前に実施 |
| MPP.6 | 発表: README 更新 + X/Reddit 投稿 + 記事ドラフト ("First marketplace supporting both x402 AND MPP") | README に MPP セクション追加、X 投稿完了 | MPP.5 | cc:TODO |

**技術メモ**:
- `mppx/tempo` は Stripe ゼロ依存。Tempo RPC で直接オンチェーン検証
- Testnet (Moderato): `rpc.moderato.tempo.xyz`、ファウセットで 1M pathUSD 無料
- Mainnet: `rpc.tempo.xyz`、USDC: `0x20c000000000000000000000b9537d11c60e8b50`
- mppx SDK は Fetch API ベース → Next.js / Cloudflare Workers 互換

---

## Phase MPP-2: Stripe SPT レール (fiat) [P2 — Stripe 承認後]

> Stripe early access 承認待ち。承認後に着手。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| MPP-2.1 | Stripe SPT 統合（カード/BNPL 決済を MPP 経由で受付） | sandbox で SPT 決済が通る | Stripe 承認 | blocked (early access 申請中 2026-03-20) |
| MPP-2.2 | 本番デプロイ + Stripe Dashboard 確認 | Stripe Dashboard に tx が表示される | MPP-2.1 | blocked |

---

## Phase MKT-2: SEO 基盤 + ディレクトリ一括登録 [P1 — マーケティング]

> 受動的チャネル確保。半日で全部やる。やらない理由がない施策群。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | GSC 登録 + Google Index 確認 + sitemap 送信 | GSC にプロパティ追加、sitemap.xml 送信済み | - | cc:完了 |
| 2.2 | MCP Registry + mcp.so + PulseMCP + Smithery 一括登録 | 4ディレクトリに掲載確認 | - | cc:WIP (mcpservers.org 承認済み 2026-03-17) |
| 2.3 | Awesome MCP Servers + x402 ecosystem + awesome-x402 + awesome-solana-ai に PR | 4 PR 作成 | - | cc:WIP (awesome-x402 PR#106 マージ済み 2026-03-17) |
| 2.4 | BetaList 提出 (2ヶ月待ちなので即日) | BetaList にサブミット完了 | - | pm:確認済 (2026-03-18) |
| 2.5 | Colosseum Eternal ハッカソン登録 (非対称リターン: 工数2日 / 最大 $250K) | Arena アカウント作成 + スプリント開始 | - | cc:TODO |
| 2.6 | HN second chance メール送信 | hn@ycombinator.com にメール送信 | - | cc:TODO |

---

## Phase MKT-3: 記事シリーズ + Reddit [P1 — マーケティング]

> 技術記事で認知 → Reddit で直接ターゲットにリーチ。
> 公開順序: Hashnode (原文) → Dev.to (canonical=hashnode) → Reddit (1-2日後)
> 投稿時間: 火-木 JST 21:00-24:00 (US東部 8-11AM)
> 詳細: `docs/marketing/05-blog-content.md`, `docs/marketing/reddit-promotion-guide.md`, `memory/content_strategy.md`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.1 | Hashnode ブログ (blog.knowmint.shop CNAME 設定) | `https://blog.knowmint.shop` にアクセス可能 | - | cc:完了 (2026-03-15) |
| 3.2a | 記事1: 個人開発ストーリー — "I Built a Marketplace Where AI Agents Buy Knowledge Autonomously" | Hashnode 公開 + Dev.to クロスポスト (canonical設定) + 1500-2000語 + Demo GIF 埋め込み | 3.1 | cc:完了 (ドラフト: drafts/blog/01-ai-agents-buy-knowledge.md, 1524語) |
| 3.2b | 記事2: Claude 自律購入 — "I Made Claude Buy Knowledge Autonomously — Here's the x402 Flow" | Hashnode + Dev.to + MCP 設定コード付き + tags: ai, webdev, opensource, javascript | 3.2a | cc:完了 (ドラフト: drafts/blog/02-claude-autonomous-x402.md, 1544語) |
| 3.2c | 記事3: x402 技術解説 — "x402 Explained: HTTP 402 + Crypto for AI Agent Payments" | Hashnode + Dev.to + コードウォークスルー付き + tags: web3, ai, opensource, javascript | 3.2b | cc:完了 (ドラフト: drafts/blog/03-x402-explained.md, 1490語) |
| 3.2d | 記事4: 技術スタック — "Next.js 16 + Cloudflare Workers + Solana: Full Stack Guide" | Hashnode + Dev.to + tags: webdev, nextjs, typescript, javascript | 3.2c | cc:完了 (ドラフト: drafts/blog/04-nextjs-cf-solana-stack.md, 1484語) |
| 3.3a | Reddit r/SideProject 投稿 (記事1と連動。本文はストーリー、記事リンクはOPコメント) | 投稿完了 | 3.2a | cc:TODO (テキスト準備済: drafts/social/reddit/r-sideproject.md) |
| 3.3b | Reddit r/ClaudeCode 投稿 (記事2と連動。MCP 設定コードを本文に) | 投稿完了 | 3.2b | cc:TODO (テキスト準備済: drafts/social/reddit/r-claudecode.md) |
| 3.3c | Reddit r/solana 投稿 (記事3と連動。x402 実装の技術詳細) | 投稿完了 | 3.2c | cc:TODO (テキスト準備済: drafts/social/reddit/r-solana.md) |
| 3.3d | Reddit r/ClaudeAI + r/LocalLLaMA 投稿 | 投稿完了 | 3.2b | cc:TODO (テキスト準備済: drafts/social/reddit/r-claudeai.md, r-localllama.md) |
| 3.4 | Reddit 「Why not Stripe?」回答テンプレート追加 | reddit-promotion-guide.md 更新済み | - | cc:完了 (2026-03-18) |
| 3.6 | Bluesky アカウント + カスタムドメイン + 毎日投稿開始 | @knowmint.shop ハンドルで 10投稿以上 | - | cc:TODO (手順書: docs/marketing/06-social-media.md 既存) |

**書き方ルール**: 80% 教育 / 20% プロダクト。CTA 末尾1箇所。失敗談も正直に。
**Reddit 撤退条件**: 3本投稿して合計 upvote 20未満なら Reddit 停止、Dev.to 記事集中に切り替え。

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

---

## 依存関係

```
MPP-1 (Tempo レール) ←─ 最優先・即着手 (Stripe 不要)
  ├─ MPP.1-4 並列可 (MPP.3-4 は MPP.2 に依存)
  ├─ MPP.5 mainnet → MPP.6 発表
  └─ MPP-2 (Stripe SPT) ←─ early access 承認後
MKT-CS (コールドスタート) ←─ MPP-1 と並行可
  ├─ CS.1 自作コンテンツ + CS.2 デモサンドボックス → CS.3 5人テスト
  │    撤退条件: 4/5人「不要」→ ピボット
MKT-2 (ディレクトリ一括) ←─ 並行可
MKT-3 (記事+Reddit) ←─ CS.1 完了後。MPP 発表記事も追加可
MKT-4 (PH) ←─ CS.3 + MKT-3 完了後
MKT-5/6 (グラント/長期) ←─ 実績後
```
