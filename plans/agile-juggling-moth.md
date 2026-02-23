# Maestro 未カバーページ E2E フロー追加

## Context

`/maestro-test coverage` の結果、22ページ中15ページがカバー済み (68%)。
残り未カバーのうち現実的にテスト可能な4ページを追加し 19/22 (86%) に引き上げる。

スキップ: `/library/[id]`（実際の購入が必要）

---

## 追加フロー一覧

| ファイル | ページ | 前提条件 |
|----------|--------|---------|
| `15-dashboard-rankings.yaml` | `/dashboard/rankings` | ログイン |
| `16-library.yaml` | `/library` | ログイン（空状態確認） |
| `17-list-edit.yaml` | `/list/[id]/edit` | 09-publish-offer で作成済みアイテム |
| `18-category.yaml` | `/category/business` | なし（公開ページ） |

---

## 各フロー実装

### 15-dashboard-rankings.yaml

```yaml
# ダッシュボード出品者ランキング — 表示確認（ログイン必須）
url: http://localhost:3000/login
---
[ログインパターン]
- openLink: http://localhost:3000/dashboard/rankings
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "出品者ランキング"
    timeout: 8000
- assertVisible: "出品者ランキング"
- assertVisible: "販売実績の多い出品者をランキング表示しています"
```

### 16-library.yaml

```yaml
# マイライブラリ — 空状態確認（ログイン必須）
url: http://localhost:3000/login
---
[ログインパターン]
- openLink: http://localhost:3000/library
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "マイライブラリ"
    timeout: 8000
- assertVisible: "マイライブラリ"
- assertVisible: "購入した知識はまだありません"
- assertVisible: "マーケットを探す"
```

### 17-list-edit.yaml

```yaml
# 出品編集ページ — 表示確認（09-publish-offer 実行後前提）
url: http://localhost:3000/login
---
[ログインパターン]
- openLink: http://localhost:3000/dashboard/listings
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "出品管理"
    timeout: 8000
- assertVisible: "テスト用プロンプト集"
- scrollUntilVisible:
    element:
      text: "編集"
- tapOn: "編集"
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "掲載を編集する"
    timeout: 10000
- assertVisible: "掲載を編集する"
- assertVisible: "基本情報"
```

### 18-category.yaml

```yaml
# カテゴリ別一覧 — 公開ページ確認（認証不要）
url: http://localhost:3000/category/business
---
- clearState
- launchApp
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "ビジネス・仕事"
    timeout: 8000
- assertVisible: "ビジネス・仕事"
```

---

## run-tests.sh 変更

```
TOTAL=18

追加実行（順序）:
- run_flow "15-dashboard-rankings.yaml"   ← 06-dashboard.yaml の直後
- run_flow "16-library.yaml"              ← 15 の直後
- run_flow "17-list-edit.yaml"            ← 10-knowledge-detail.yaml の直後（09依存）
- run_flow "18-category.yaml"             ← 未ログインテスト群に追加（04-search の後）
```

---

## 変更ファイル

- `maestro/flows/15-dashboard-rankings.yaml` — 新規作成
- `maestro/flows/16-library.yaml` — 新規作成
- `maestro/flows/17-list-edit.yaml` — 新規作成
- `maestro/flows/18-category.yaml` — 新規作成
- `maestro/run-tests.sh` — TOTAL=18 + 4フロー追加

## 検証

```bash
# 全テスト実行
bash maestro/run-tests.sh
# → ✅ 全テスト通過 (18/18) を確認
```

失敗時の対処:
- `17-list-edit`: "編集" ボタンが複数ある場合 `tapOn: { text: "編集", index: 0 }` を使用
- `18-category`: カテゴリページが 404 の場合は別のスラッグ（`technology-it` 等）を試す
