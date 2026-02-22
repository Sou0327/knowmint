# Phase 17-19: P2 フェーズ詳細

> Plans.md から抽出した P2 優先度フェーズ。Phase 15・16 完了後に着手。

---

## Phase 17: Webhook DLQ + メール通知 [P2]

> Webhook の信頼性向上と、AIエージェント以外のユーザー（出品者）への通知強化。

### 17.1 Webhook Dead Letter Queue

- [ ] `webhook_delivery_logs` テーブルに失敗ログを永続化（現状は消えるだけ）
- [ ] Vercel Cron で失敗配信を定期リトライするジョブを実装
- [ ] 最大リトライ回数（5回等）を超えたものを `dead` ステータスにして管理画面で確認できるようにする

### 17.2 メール通知（Resend）

- [ ] `resend` パッケージをインストール
- [ ] 購入完了メール（売り手向け）の実装
- [ ] 出品承認・拒否メール（将来のモデレーション対応）
- [ ] 重要アカウントイベント（APIキー作成・削除）のメール
- [ ] `RESEND_API_KEY` を環境変数に追加

**対象ファイル**: `src/lib/notifications/`, `src/lib/webhooks/`

---

## Phase 18: MCP Server 本番公開 [P0 — コアバリュー]

> 最優先ゴール「OpenClawエージェントによる自律購入デモ」に直結。MCP Server を本番 URL で公開する。

### 18.1 本番 URL 設定・環境変数整備

- [ ] MCP Server の `DEFAULT_BASE_URL` をハードコードから環境変数へ変更
- [ ] `KM_BASE_URL` 環境変数を Vercel / MCP 設定に追加
- [ ] `mcp/dist/` のビルド・デプロイフロー確立
- [ ] MCP Server のヘルスチェックエンドポイント追加

### 18.2 Claude Desktop / OpenClaw 接続ドキュメント

- [ ] `mcp/README.md` に本番接続手順を記載（APIキー取得 → `km login` → MCP 設定）
- [ ] Claude Desktop の `claude_desktop_config.json` 設定例を記載
- [ ] OpenClaw 向けの設定例を記載
- [ ] エージェントが発見・購入できることを devnet で E2E 確認

**対象ファイル**: `mcp/src/`, `mcp/README.md`

---

## Phase 19: コンテンツモデレーション [P2]

> 誰でも任意のコンテンツを出品できる現状に対し、最低限の品質・安全管理を行う。

### 19.1 コンテンツ報告機能

- [ ] `knowledge_item_reports` テーブル作成（報告者・対象アイテム・理由）
- [ ] `POST /api/v1/knowledge/[id]/report` エンドポイント実装
- [ ] 一定数の報告を受けたアイテムを自動的に審査待ち状態にする

### 19.2 管理者レビューダッシュボード（最小限）

- [ ] 審査待ちアイテムの一覧 API（管理者権限のみ）
- [ ] アイテムの承認・削除アクション
- [ ] 出品者への通知（承認/却下）

**対象ファイル**: `src/app/api/v1/knowledge/[id]/report/`, `src/app/(admin)/`
