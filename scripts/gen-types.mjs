#!/usr/bin/env node
/**
 * Supabase 型自動生成スクリプト
 *
 * - `node scripts/gen-types.mjs`         → src/types/database.generated.ts を生成/上書き
 * - `node scripts/gen-types.mjs --check` → 既存ファイルと比較し、不一致なら exit 1 (CI 用)
 */

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "src/types/database.generated.ts");
const isCheck = process.argv.includes("--check");

// CI と同一バージョンの supabase CLI を期待 (single source of truth: .supabase-version)
const EXPECTED_CLI_VERSION = readFileSync(join(root, ".supabase-version"), "utf8").trim();

// バージョンチェック
const ver = spawnSync("supabase", ["--version"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 10_000,
});

if (ver.error) {
  console.error("supabase CLI が見つかりません:", ver.error.message);
  console.error("https://supabase.com/docs/guides/cli を参照してインストールしてください。");
  process.exit(1);
}

const localVersion = (ver.stdout || "").trim();
if (!localVersion.includes(EXPECTED_CLI_VERSION)) {
  console.warn(
    `⚠ supabase CLI バージョン不一致: local=${localVersion}, expected=${EXPECTED_CLI_VERSION}`
  );
  console.warn("CI と出力が異なる可能性があります。");
}

// supabase gen types typescript --local
const result = spawnSync("supabase", ["gen", "types", "typescript", "--local"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 60_000,
});

if (result.error) {
  console.error("supabase gen types の実行に失敗しました:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("supabase gen types failed:");
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const generated = result.stdout;

if (!generated.trim()) {
  console.error("supabase gen types returned empty output");
  process.exit(1);
}

if (isCheck) {
  let existing;
  try {
    existing = readFileSync(outPath, "utf8");
  } catch {
    console.error(`${outPath} が存在しません。npm run gen:types で生成してください。`);
    process.exit(1);
  }

  if (existing !== generated) {
    console.error("database.generated.ts が最新のマイグレーションと一致しません。");
    console.error("npm run gen:types を実行してコミットしてください。");
    process.exit(1);
  }

  console.log("✓ database.generated.ts は最新です");
  process.exit(0);
}

// 書き込みモード
writeFileSync(outPath, generated, "utf8");
console.log(`✓ ${outPath} を生成しました`);
