# @knowledge-market/cli

Knowledge Market の CLI ツール (`km`) です。  
このディレクトリは Web アプリ本体から分離された、公開用 npm パッケージです。

## ローカル実行

```bash
npm run km -- help
```

## ローカルリンク

```bash
npm link
km help
```

## 公開

```bash
npm publish --access public
```

事前に `cli/package.json` の `version` を更新してください。
