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

## Phase ADMIN: 管理画面 [P1 — 運用基盤]

> **背景**: 管理UIゼロ。報告レビューAPI 2本のみ。Supabase Dashboard で直接SQL叩くしかない状態。
> 通報対応・ユーザーBAN・コンテンツ非公開化を即座にできないと運用リスク。
> 管理者判定: profiles.is_admin (boolean) を追加。API Key permissions の "admin" とは別レイヤー。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| ADM.1 | DB migration: profiles に `is_admin` boolean 追加 + 自アカウントを true に設定 | migration 適用 + `database.types.ts` 型更新 + 自分のプロフィールが is_admin=true | - | cc:完了 |
| ADM.2 | Middleware: `/admin` ルート保護 (Supabase session + is_admin チェック) | 未ログイン→/login リダイレクト、非admin→/ リダイレクト | ADM.1 | cc:完了 |
| ADM.3 | Admin レイアウト + サイドバー + ダッシュボード (ユーザー数・出品数・取引数・売上サマリー) | `/admin` にアクセスで統計表示。DQテーマ維持 | ADM.2 | cc:完了 |
| ADM.4 | ユーザー管理 (一覧・検索・BAN/凍結・詳細) + DB migration (profiles.banned_at) | `/admin/users` で一覧表示、BAN トグル動作 | ADM.2 | cc:完了 |
| ADM.5 | コンテンツモデレーション UI (報告一覧 + レビュー操作。既存 admin_review_report RPC 活用) | `/admin/reports` で報告一覧表示、resolve/dismiss 操作完了 | ADM.2 | cc:完了 |
| ADM.6 | 出品管理 (全出品一覧・検索・フィルタ・非公開化・内容プレビュー) | `/admin/listings` で全出品表示、非公開化操作動作 | ADM.2 | cc:完了 |
| ADM.7 | トランザクション履歴 (全取引一覧・フィルタ・詳細表示) | `/admin/transactions` で全取引表示、ステータスフィルタ動作 | ADM.2 | cc:完了 |
| ADM.8 | APIキー管理 (発行済み一覧・無効化・権限確認) | `/admin/api-keys` で一覧表示、無効化操作動作 | ADM.2 | cc:完了 |

**技術方針**:
- Server Components 中心 (getAdminClient で RLS バイパス)。クライアント操作のみ Client Component
- ADM.3-8 は ADM.2 完了後に並列実装可
- 既存の `/api/v1/admin/reports` API は UI から直接呼ぶか Server Action に移行
- BAN ユーザーのログインブロックは middleware で is_admin チェックと同時に実装

---

## Phase FRONTIER: Solana Frontier Hackathon 参加 [**最優先** — 時限 2026-05-10 提出]

> **背景**: 2026-04-06 〜 2026-05-11 開催の Solana Frontier Hackathon に KnowMint で参加。
> 賞金: Grand $30k / Top20 × $10k / Public Good $10k / Accelerator $250k (7% equity) × 最大10枠。
> 参加者 12,500+、Top20 入賞確率 3-8%、Accelerator 1-2%。期待値 $2-5k (30-75万円)。
> **主目的**: 露出 + Solana ecosystem 接続 + pitch 材料作成。賞金は宝くじ扱い。
> 詳細分析: `docs/frontier-hackathon-analysis.md`

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| FRN.1 | Colosseum アカウント登録 + プロフィール完成 | arena.colosseum.org で登録完了、Display Name/Headline/About You/Skills 入力済み | - | cc:完了 |
| FRN.2 | プロジェクト作成 (basic info) | KnowMint プロジェクト作成、AI Platforms/Agents カテゴリ選択、Brief Description 入力済み | FRN.1 | cc:完了 |
| FRN.3 | Submission form 本文入力 (What you're building / Why now / Technologies 等) | 全必須フィールド入力完了、save 済み | FRN.2 | cc:WIP |
| FRN.4 | Telegram アカウント作成 + フォーム入力 | Telegram username を form に登録済み (受賞連絡必須) | FRN.2 | cc:TODO |
| FRN.5 | Repo context + Access instructions + Live product link 入力 | knowmint.shop + アクセス手順入力、judges が試せる状態 | FRN.2 | cc:TODO |
| FRN.6 | Discord 参加 + 既存プロジェクト提出可否質問 | Colosseum Discord 参加、FAQ チャンネルで質問投下、運営の回答受領 | - | cc:TODO |
| FRN.7 | Eternal プログラム調査 (Frontier と並行応募可否確認) | Eternal 応募条件・採択率・Frontier との差異を整理、並行応募判断 | - | cc:TODO |
| FRN.8 | 追加機能選定 (Agent Hub / Reputation / Cross-Protocol / Creator Revenue から1つ) | 選定機能の設計メモを `docs/frontier-feature-{name}.md` に記録 | - | cc:TODO |
| FRN.9 | 選定機能の実装 + テスト | 機能動作確認 + 新規テスト追加、main ブランチに merge | FRN.8 | cc:TODO |
| FRN.10 | Demo video 撮影 (3分以内・live product) | YouTube/Loom/Vimeo にアップロード、live product 映像、英語ナレーション | FRN.9 | cc:TODO |
| FRN.11 | Pitch video 撮影 (2分以内・founder 自己紹介) | YouTube/Loom にアップロード、顔出し・英語、自己紹介+なぜ作るか+why now | FRN.9 | cc:TODO |
| FRN.12 | Pitch deck 作成 (5-10 slides、英語) | PDF/Figma で pitch deck 完成、Problem/Solution/Market/Traction/Team/Ask 構成 | FRN.9 | cc:TODO |
| FRN.13 | Submission form 最終仕上げ (動画 URL・deck URL・GitHub URL) | 全フィールド完了、「Submit」押下前状態 | FRN.3, FRN.10, FRN.11, FRN.12 | cc:TODO |
| FRN.14 | 最終提出 + Twitter 告知 (#SolanaFrontier + @colosseum タグ) | 5/10 23:59 PDT までに submit、X で告知投稿完了 | FRN.13 | cc:TODO |
| FRN.15 | 副業並行: Upwork + Contra プロフィール作成 | Senior Next.js + Solana + AI Agent Engineer として登録完了、初動 5 案件応募 | - | cc:TODO |

**戦略メモ**:
- **Pitch は Public Good Award 狙い** (確率 4-8%、Top20 3-8% より高い)
- 「first marketplace for AI agents」は既出フレーズ (MCPay/Latinum が過去受賞)。「**Tacit knowledge layer for Solana agents**」「**OSS counterweight to proprietary x402 plays**」に reframe
- KnowMint 初コミット 2026-02-16 (ハッカソン開始 2ヶ月前ギリギリ) → 既存プロジェクト懸念があるため FRN.9 で「during hackathon」として追加したものを明確に切り分けて見せる
- Accelerator 採択されても Week 2-3 の SF 渡航必須 (ESTA 無ビザ可、旅費 $4-7k)
- 副業 (FRN.15) は Frontier に全振りせず平行で生活費確保。時給 $50-100 想定

**工数見積もり (残り 27日)**:
- FRN.3-7: 2-3日 (Discord 回答待ち含む)
- FRN.8-9: 2-3週間 (機能実装)
- FRN.10-12: 5-7日 (動画 + deck)
- FRN.13-14: 1日
- FRN.15: 0.5日 + 継続応募

**撤退条件**:
- FRN.6 の Discord 回答で「既存プロジェクト disqualify」と明確に言われた場合 → Eternal 応募に切り替え
- FRN.8 実装開始後 1週間で機能実装が 50% 未満 → 機能なし magazineで提出に降格 (Public Good Award 狙い)

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
| MPP.5a | testnet PoC | mppx CLI → 402 → Payment → 200 + content + DB chain=tempo 記録 | MPP.1-4 | cc:完了 |
| MPP.5b | mainnet 切り替え (MPP_TESTNET=false, CF Workers env 設定, デプロイ) | Tempo mainnet で実決済 → コンテンツ取得 | MPP.5a | blocked (MPP-2 の Connect 実装が先。Tempo 単体はカストディアルになるため本番無効のまま) |
| MPP.6 | 発表: README 更新 + X/Reddit 投稿 + 記事ドラフト | README に MPP セクション追加、X 投稿完了 | MPP-2 完了後 | blocked |

**技術メモ**:
- `mppx/tempo` は Stripe ゼロ依存。Tempo RPC で直接オンチェーン検証
- Testnet (Moderato): `rpc.moderato.tempo.xyz`、ファウセットで 1M pathUSD 無料
- Mainnet: `rpc.tempo.xyz`、USDC: `0x20c000000000000000000000b9537d11c60e8b50`
- mppx SDK は Fetch API ベース → Next.js / Cloudflare Workers 互換
- **本番では `MPP_ENABLED` 未設定 = 無効**。Tempo 単体はプラットフォームウォレット受取 → カストディアルになるため、Stripe Connect 実装まで有効化しない

**⚠️ カストディアル問題**:
- MPP Tempo 単体: プラットフォームウォレットに入金 → 売り手への分配手段なし → 資金決済法に抵触リスク
- 有効化条件: (1) Stripe Connect で売り手に自動分配 OR (2) 売り手 EVM アドレスに直接送金

---

## Phase MPP-2: Stripe SPT + Connect (fiat, ノンカストディアル) [P2 — Stripe 承認後]

> **前提**: Stripe early access 承認 + Stripe Connect 実装が両方必要。
> Connect なしで SPT を有効化すると、プラットフォームが資金を預かる形になり日本の資金決済法に抵触する。
> SPT 有効化 = Connect で売り手に自動分配できる状態であること。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| MPP-2.1 | Stripe early access 有効化確認 | Dashboard に「ステーブルコインと暗号資産」表示 | Stripe の地域拡大 | blocked (US only — sandbox 含む。Ben が地域拡大時に即有効化を約束 2026-03-20) |
| MPP-2.2 | Stripe Connect 実装 (売り手 onboarding + 自動分配) | 売り手が Stripe アカウント連携 → 購入時に transfer_data.destination で自動送金 | MPP-2.1 | blocked |
| MPP-2.3 | profiles テーブルに stripe_account_id カラム追加 | migration 適用 + 型更新 | MPP-2.2 | blocked |
| MPP-2.4 | Stripe SPT 統合（カード/Apple Pay/Link 決済を MPP 経由で受付） | sandbox で SPT 決済 → 売り手 Stripe アカウントに入金確認 | MPP-2.2, MPP-2.3 | blocked |
| MPP-2.5 | 本番デプロイ + `MPP_ENABLED=true` | Stripe Dashboard に tx 表示 + 売り手に自動分配 | MPP-2.4 | blocked |

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
ADMIN (管理画面) ←─ 運用基盤・即着手可
  ├─ ADM.1 → ADM.2 (DB + Middleware: 直列)
  └─ ADM.3-8 並列可 (ADM.2 完了後)
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
