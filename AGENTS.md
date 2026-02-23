# AGENTS.md - 開発運用ガイド

> **プロジェクト**: KnowMint  
> **モード**: Solo (Claude Code 単体開発)  
> **更新日**: 2026-02-16

このファイルは、日々の開発を迷わず進めるための最小運用ルールです。

---

## 1. 参照ドキュメントと優先順位

| 優先 | ファイル | 役割 |
|------|---------|------|
| 1 | `CLAUDE.md` | Claude Code 固有ルール・開発原則 |
| 2 | `Plans.md` | タスク一覧・進捗・受け入れ基準 |
| 3 | `AGENTS.md` | 開発フロー（このファイル） |

運用上の判断に迷ったら、上から順に解釈する。

---

## 2. 標準ワークフロー (Solo)

```text
1. /plan-with-agent  : Plans.md にタスクと受け入れ基準を定義
2. /work             : 実装 (必要に応じて設計更新)
3. /verify           : lint/build/test で検証
4. /harness-review   : Codex レビューで指摘を解消
5. git commit        : 完了記録
```

各ステップで「何を満たせば次へ進むか」を明確にすること。

---

## 3. タスク管理ルール (Plans.md)

### 3.1 マーカー

| マーカー | 意味 |
|---------|------|
| `cc:TODO` | 未着手 |
| `cc:WIP` | 作業中 |
| `cc:完了` | 完了 |
| `cc:DONE` | 完了（旧表記。新規は `cc:完了` を推奨） |
| `blocked` | ブロック中 |

### 3.2 状態遷移

```text
cc:TODO -> cc:WIP -> cc:完了
```

### 3.3 更新ルール

- 着手時: 対象タスクを `cc:WIP` に変更
- 完了時: 受け入れ基準を満たした証跡を残し `cc:完了` に変更
- ブロック時: `blocked` を明記し、原因と解除条件を1行で追記

---

## 4. 実装時の必須チェック

### 4.1 最低限の検証コマンド

```bash
npm run lint
npm run build
```

### 4.2 変更内容に応じた追加検証

```bash
# 購入検証の退行防止
npm run test:e2e:fake-tx

# CLI 空環境フロー (login -> search -> install -> publish -> deploy)
npm run test:e2e:cli-flow
```

関連箇所を変更した場合は、対応する検証を必ず実行する。

---

## 5. レビューと品質ゲート

- 実装完了後は `/harness-review` を実施
- 指摘は「再現確認 -> 修正 -> 再検証」の順で解消
- レビュー未実施のまま完了扱いにしない

### 参照ルール

- `.claude/rules/test-quality.md`  
  テストを通すための改ざん（skip/緩和/削除）を禁止
- `.claude/rules/implementation-quality.md`  
  形骸化実装（ハードコード、スタブ、握り潰し）を禁止

---

## 6. コミットメッセージ規約

```text
feat: 新機能
fix: バグ修正
docs: ドキュメント
refactor: リファクタリング
test: テスト
chore: その他
```

例:

```text
feat: CLI の dataset publish フローを追加
fix: purchase API の tx_hash 検証不備を修正
docs: Plans.md の Phase 5 進捗を更新
```

---

## 7. Definition of Done (DoD)

タスク完了は、以下をすべて満たした時点とする。

1. `Plans.md` の対象タスクが `cc:完了`
2. 受け入れ基準に対する実行証跡がある
3. 必要な `lint/build/test` が通過
4. `/harness-review` 指摘が解消済み
5. 変更内容に対応するドキュメント更新済み（必要時）

---

Solo モードでは、Claude Code が Plan -> Work -> Verify -> Review を一貫して実行する。
