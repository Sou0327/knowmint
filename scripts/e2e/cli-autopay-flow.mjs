#!/usr/bin/env node
/**
 * CLI 自動送金購入 E2E テスト (Phase CLI-PAY)
 *
 * km install <id> --keypair <path> で SOL 自動送金 → 購入 → コンテンツ取得を検証。
 *
 * Required environment variables:
 * - KM_API_KEY               : buyer の API キー
 * - KM_TEST_KNOWLEDGE_ID     : 購入対象の knowledge item ID
 * - TEST_BUYER_KEYPAIR_PATH  : buyer keypair JSON ファイルパス (chmod 600)
 *
 * Optional:
 * - KM_BASE_URL              : default http://127.0.0.1:3000
 * - SOLANA_RPC_URL           : default http://127.0.0.1:8899
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const KM_BIN = resolve(import.meta.dirname, "../../cli/bin/km.mjs");
const baseUrl = process.env.KM_BASE_URL || "http://127.0.0.1:3000";
const rpcUrl = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
const apiKey = process.env.KM_API_KEY;
const knowledgeId = process.env.KM_TEST_KNOWLEDGE_ID;
const keypairPath = process.env.TEST_BUYER_KEYPAIR_PATH;

const missing = [];
if (!apiKey) missing.push("KM_API_KEY");
if (!knowledgeId) missing.push("KM_TEST_KNOWLEDGE_ID");
if (!keypairPath) missing.push("TEST_BUYER_KEYPAIR_PATH");
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// keypair 権限チェック
const kpStat = statSync(resolve(keypairPath));
const kpMode = kpStat.mode & 0o777;
if ((kpMode & 0o077) !== 0) {
  console.error(`Keypair file is readable by group/others (${kpMode.toString(8)}). Run: chmod 600 ${keypairPath}`);
  process.exit(1);
}

const env = {
  ...process.env,
  KM_API_KEY: apiKey,
  KM_BASE_URL: baseUrl,
  SOLANA_RPC_URL: rpcUrl,
};

function runKm(args, label) {
  console.log(`\n[${label}] km ${args.join(" ")}`);
  try {
    const stdout = execFileSync(process.execPath, [KM_BIN, ...args], {
      env,
      encoding: "utf8",
      timeout: 60_000,
    });
    console.log(stdout);
    return { ok: true, stdout };
  } catch (err) {
    console.error(`[${label}] FAIL`);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    return { ok: false, stdout: err.stdout || "", stderr: err.stderr || "" };
  }
}

let failures = 0;

// ── Test 1: 自動送金購入 ─────────────────────────────────────────────────

const tmpDir1 = mkdtempSync(join(tmpdir(), "km-autopay-"));
const result1 = runKm(
  ["install", knowledgeId, "--keypair", keypairPath, "--rpc-url", rpcUrl, "--dir", tmpDir1],
  "Test 1: autopay install"
);

if (!result1.ok) {
  console.error("[Test 1] FAIL — autopay install failed");
  failures += 1;
} else {
  const files1 = readdirSync(tmpDir1);
  if (files1.length === 0) {
    console.error("[Test 1] FAIL — no file saved");
    failures += 1;
  } else {
    console.log(`[Test 1] PASS — saved: ${files1.join(", ")}`);
  }
}

// ── Test 2: 冪等性 — 同コマンド再実行で二重送金なし ────────────────────────

const tmpDir2 = mkdtempSync(join(tmpdir(), "km-autopay-idem-"));
const result2 = runKm(
  ["install", knowledgeId, "--keypair", keypairPath, "--rpc-url", rpcUrl, "--dir", tmpDir2],
  "Test 2: idempotent re-run"
);

if (!result2.ok) {
  console.error("[Test 2] FAIL — idempotent re-run failed");
  failures += 1;
} else if (!result2.stdout.includes("Already purchased")) {
  console.error("[Test 2] FAIL — expected 'Already purchased' skip, but payment was attempted again");
  failures += 1;
} else if (result2.stdout.includes("Transaction confirmed")) {
  console.error("[Test 2] FAIL — re-run should not send a new transaction");
  failures += 1;
} else {
  const files2 = readdirSync(tmpDir2);
  if (files2.length === 0) {
    console.error("[Test 2] FAIL — no file saved on idempotent re-run");
    failures += 1;
  } else {
    console.log("[Test 2] PASS — skipped payment, file saved (idempotent)");
  }
}

// ── Test 3: --keypair + --tx-hash 排他エラー ─────────────────────────────

const result3 = runKm(
  ["install", knowledgeId, "--keypair", keypairPath, "--tx-hash", "fakehash", "--dir", tmpDir1],
  "Test 3: mutually exclusive flags"
);

if (result3.ok) {
  console.error("[Test 3] FAIL — should have rejected --keypair + --tx-hash");
  failures += 1;
} else if ((result3.stdout + (result3.stderr || "")).includes("mutually exclusive")) {
  console.log("[Test 3] PASS — correctly rejected mutually exclusive flags");
} else {
  console.error("[Test 3] FAIL — unexpected error message");
  failures += 1;
}

// ── Test 4: 無効な keypair パス ──────────────────────────────────────────

const result4 = runKm(
  ["install", knowledgeId, "--keypair", "/nonexistent/keypair.json", "--rpc-url", rpcUrl, "--dir", tmpDir1],
  "Test 4: invalid keypair path"
);

if (result4.ok) {
  console.error("[Test 4] FAIL — should have failed with invalid keypair");
  failures += 1;
} else {
  console.log("[Test 4] PASS — correctly rejected invalid keypair");
}

// ── Cleanup ──────────────────────────────────────────────────────────────

try { rmSync(tmpDir1, { recursive: true, force: true }); } catch {}
try { rmSync(tmpDir2, { recursive: true, force: true }); } catch {}

// ── Summary ──────────────────────────────────────────────────────────────

console.log("");
if (failures > 0) {
  console.error(`FAIL: ${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log("PASS: all cli-autopay tests passed");
}
