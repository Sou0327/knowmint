# Phase 22: ソース全体リファクタリング

## Context

Phase 14-21 の Codex レビューで蓄積された品質・セキュリティ課題を一括解消する。
機能追加なし。コードの正確性・一貫性・保守性向上のみ。

## 実装計画 (Plans.md Phase 22 参照)

Phase 22 の詳細タスクは Plans.md に記載済み。優先順位:

1. **22.1** セキュリティ修正 (CRITICAL/HIGH)
2. **22.2** 命名規則統一 (snake_case → camelCase)
3. **22.3** 型安全性改善
4. **22.4** エラーロギング標準化
5. **22.5** 不要依存削除 (`@metamask/sdk`)
6. **22.6** 大ファイル分割 (任意)

## 検証

- `npm run lint` — ESLint エラーなし
- `npm run build` — TypeScript エラーなし
- `npm run test:unit` — 既存テスト全通過
- `npm run test:integration` — 既存テスト全通過
- Codex レビュー → ISSUES_FOUND: 0
