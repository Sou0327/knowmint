#!/usr/bin/env node
/**
 * CLI 購入フロー E2E テスト (Phase 15.6.3)
 *
 * 実 Solana TX を送金し、km CLI の `install --tx-hash` でダウンロードまでを検証する。
 * devnet-purchase-flow.mjs (Solana 送金) と cli-empty-env-flow.mjs (km spawn) を組み合わせた統合フロー。
 *
 * Required environment variables:
 * - TEST_API_KEY_BUYER        : buyer の API キー (km_<64hex>)
 * - KM_TEST_KNOWLEDGE_ID      : 購入対象の knowledge item UUID
 * - TEST_BUYER_KEYPAIR_PATH   : buyer keypair JSON ファイルパス
 * - TEST_SELLER_WALLET        : seller の Solana ウォレットアドレス (base58、DB の wallet_address と一致必須)
 *
 * Optional:
 * - KM_BASE_URL               : default http://127.0.0.1:3000
 * - NEXT_PUBLIC_SOLANA_RPC_URL: default http://127.0.0.1:8899
 * - NEXT_PUBLIC_KM_PROGRAM_ID : スマートコントラクト Program ID (NEXT_PUBLIC_FEE_VAULT_ADDRESS と両方設定)
 * - NEXT_PUBLIC_FEE_VAULT_ADDRESS: Fee Vault アドレス (NEXT_PUBLIC_KM_PROGRAM_ID と両方設定)
 * - KEEP_KM_E2E_ARTIFACTS     : "1" で tmpdir を保持
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const FETCH_TIMEOUT_MS = 30_000;
const KM_TIMEOUT_MS = 60_000;

// ── ファイルパス設定 ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const kmEntryPath = path.join(repoRoot, "cli/bin/km.mjs");
const keepArtifacts = process.env.KEEP_KM_E2E_ARTIFACTS === "1";

// ── 環境変数 ──────────────────────────────────────────────────────────────────

const baseUrl = process.env.KM_BASE_URL || "http://127.0.0.1:3000";
const apiKey = process.env.TEST_API_KEY_BUYER;
const knowledgeId = process.env.KM_TEST_KNOWLEDGE_ID;
const buyerKeypairPath = process.env.TEST_BUYER_KEYPAIR_PATH;
const sellerWalletAddress = process.env.TEST_SELLER_WALLET;
const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "http://127.0.0.1:8899";
const programIdStr = process.env.NEXT_PUBLIC_KM_PROGRAM_ID?.trim() || "";
const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS?.trim() || "";

// Anchor discriminator for execute_purchase: sha256("global:execute_purchase")[0..8]
const EXECUTE_PURCHASE_DISCRIMINATOR = new Uint8Array([
  193, 193, 250, 92, 23, 221, 96, 102,
]);

// ── Step 0: 環境変数検証 (try の外で実施 — cleanup 不要な段階) ────────────────

const missing = [];
if (!apiKey) missing.push("TEST_API_KEY_BUYER");
if (!knowledgeId) missing.push("KM_TEST_KNOWLEDGE_ID");
if (!buyerKeypairPath) missing.push("TEST_BUYER_KEYPAIR_PATH");
if (!sellerWalletAddress) missing.push("TEST_SELLER_WALLET");
if (missing.length > 0) {
  console.error(
    `[Step 0] Missing required environment variables: ${missing.join(", ")}`
  );
  process.exit(1);
}

// コントラクト設定は両方設定するか両方省略するかのどちらかのみ許可
if (!!programIdStr !== !!feeVaultStr) {
  console.error(
    "[Step 0] NEXT_PUBLIC_KM_PROGRAM_ID and NEXT_PUBLIC_FEE_VAULT_ADDRESS " +
      "must both be set or both be unset."
  );
  process.exit(1);
}

console.log("[Step 0] PASS — all required env vars present");

// ── ヘルパー関数 ──────────────────────────────────────────────────────────────

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    let json = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse 失敗は呼び出し元で ok/error を見て判断
    }
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

function loadKeypair(pathStr) {
  const absPath = resolve(process.cwd(), pathStr);
  const secretKeyArray = JSON.parse(readFileSync(absPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}

// NOTE: km login の --api-key はプロセス引数経由であり ps コマンドで可視。
// これは km CLI の設計上の制約。CI 環境では ps へのアクセス制限を設けること。
async function runKm(args, env, cwd) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, [kmEntryPath, ...args], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        rejectP(
          new Error(`km ${args[0]} timed out after ${KM_TIMEOUT_MS}ms`)
        );
      }
    }, KM_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rejectP(err);
      }
    });
    child.once("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolveP({ code: code ?? 1, stdout, stderr });
      }
    });
  });
}

function assertSuccess(step, result) {
  if (result.code !== 0) {
    throw new Error(
      `${step} failed (exit ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
}

function extractLineValue(output, prefix) {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).trim();
}

// ── キーペア・アドレス解析 ────────────────────────────────────────────────────

let buyerKeypair, sellerPubkey;
try {
  buyerKeypair = loadKeypair(buyerKeypairPath);
  sellerPubkey = new PublicKey(sellerWalletAddress);
} catch (err) {
  console.error(
    `Failed to load keypair or parse seller address: ${err.message}`
  );
  process.exit(1);
}

const rpcHost = (() => {
  try {
    return new URL(rpcUrl).hostname;
  } catch {
    return "(invalid url)";
  }
})();

console.log(`Buyer  : ${buyerKeypair.publicKey.toBase58()}`);
console.log(`Seller : ${sellerPubkey.toBase58()}`);
console.log(`RPC    : ${rpcHost}`);
console.log(`Item   : ${knowledgeId}`);
console.log(`Server : ${baseUrl}`);
console.log("");

// ── メイン処理 ─────────────────────────────────────────────────────────────────
// process.exit() は try 内では使わず throw で統一。finally のクリーンアップを保証する。

let tempHome = "";
let tempWork = "";
let exitCode = 1;

try {
  // ── Step 1: knowledge item 詳細取得 (price_sol 確認) ───────────────────────

  const { res: itemRes, json: itemJson } = await fetchJson(
    `${baseUrl}/api/v1/knowledge/${knowledgeId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!itemRes.ok || itemJson?.success !== true) {
    throw new Error(
      `[Step 1] Failed to fetch knowledge item: ${itemRes.status}\n` +
        JSON.stringify(itemJson, null, 2)
    );
  }

  const priceSol = itemJson?.data?.price_sol;
  if (
    typeof priceSol !== "number" ||
    !Number.isFinite(priceSol) ||
    priceSol <= 0
  ) {
    throw new Error(
      `[Step 1] Invalid price_sol: ${priceSol}. Item must have a finite price_sol > 0.`
    );
  }

  console.log(`[Step 1] PASS — price_sol = ${priceSol}`);

  // Step 2 の amount 照合で使うため、Step 1 完了直後に lamports を計算
  const lamports = Math.ceil(priceSol * LAMPORTS_PER_SOL);

  // ── Step 2: 購入済みチェック + payTo 検証 (fail-closed) ─────────────────────
  // 期待するステータス:
  //   200 → 購入済み → 冪等成功で終了
  //   402 → 未購入 (x402 Payment Required) → accepts[].payTo を検証してから送金へ進む
  //   それ以外 → 状態不明 → 二重送金防止のため中断

  const { res: checkRes, json: checkJson } = await fetchJson(
    `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (checkRes.status >= 500) {
    throw new Error(
      `[Step 2] Server error (${checkRes.status}) during idempotency check. ` +
        "Aborting to prevent unintended SOL transfer."
    );
  }

  if (checkRes.ok && checkJson?.success === true) {
    console.log("[Step 2] Already purchased — content accessible.");
    console.log("[Step 2] PASS (idempotent — no double spend)");
    console.log("");
    console.log(
      "PASS: cli purchase flow completed successfully (idempotent — already purchased)"
    );
    exitCode = 0;
    // finally でクリーンアップしてから終了
    throw Object.assign(new Error("__early_exit__"), { earlyExit: true });
  }

  // 未購入を示す唯一の期待レスポンスは 402 (x402 Payment Required)
  if (checkRes.status !== 402) {
    throw new Error(
      `[Step 2] Unexpected status ${checkRes.status} (expected 402). ` +
        "Aborting to prevent unintended SOL transfer."
    );
  }

  // 402 レスポンスの accepts[].payTo (asset=native) を検証して誤送金を防止
  const nativeAccept = Array.isArray(checkJson?.accepts)
    ? checkJson.accepts.find((a) => a.asset === "native")
    : null;
  if (!nativeAccept?.payTo) {
    throw new Error(
      "[Step 2] 402 response missing accepts[].payTo for native asset."
    );
  }
  let serverPayTo;
  try {
    serverPayTo = new PublicKey(nativeAccept.payTo).toBase58();
  } catch {
    throw new Error(
      `[Step 2] Invalid payTo address in 402 response: ${nativeAccept.payTo}`
    );
  }
  const configuredSeller = sellerPubkey.toBase58();
  if (serverPayTo !== configuredSeller) {
    throw new Error(
      `[Step 2] Seller wallet mismatch: server expects ${serverPayTo} ` +
        `but TEST_SELLER_WALLET is ${configuredSeller}. Aborting.`
    );
  }

  // 送金額を 402 の maxAmountRequired (lamports 文字列) と照合して過不足送金を防止
  // maxAmountRequired は x402 仕様上必須フィールド — 欠落時は仕様逸脱として中断
  if (nativeAccept.maxAmountRequired == null) {
    throw new Error(
      "[Step 2] 402 response missing maxAmountRequired for native asset."
    );
  }
  let serverLamports;
  try {
    serverLamports = BigInt(nativeAccept.maxAmountRequired);
  } catch {
    throw new Error(
      `[Step 2] Invalid maxAmountRequired in 402 response: ${nativeAccept.maxAmountRequired}`
    );
  }
  const clientLamports = BigInt(lamports);
  if (serverLamports !== clientLamports) {
    throw new Error(
      `[Step 2] Amount mismatch: server expects ${serverLamports} lamports ` +
        `but price_sol=${priceSol} computes to ${clientLamports} lamports. Aborting.`
    );
  }

  console.log(`[Step 2] PASS — no prior purchase, payTo=${serverPayTo}, amount=${lamports} lamports`);

  // ── Step 3: Solana RPC 接続・buyer 残高確認 ──────────────────────────────────

  const connection = new Connection(rpcUrl, "confirmed");
  let buyerBalance;
  try {
    buyerBalance = await connection.getBalance(buyerKeypair.publicKey);
  } catch (err) {
    throw new Error(
      `[Step 3] Failed to connect to Solana RPC: ${err.message}`
    );
  }

  const feeBuffer = 5000; // TX 手数料バッファ (lamports)
  const required = lamports + feeBuffer;

  if (buyerBalance < required) {
    throw new Error(
      `[Step 3] Insufficient buyer balance: ${buyerBalance} lamports (need ${required})\n` +
        `Run: solana airdrop 2 ${buyerKeypair.publicKey.toBase58()} --url ${rpcUrl}`
    );
  }

  console.log(`[Step 3] PASS — buyer balance = ${buyerBalance} lamports`);

  // ── Step 4: SOL 送金 (コントラクト経由 or 直接送金) ─────────────────────────

  let solanaTx;
  let useContract = false;

  try {
    const programId = programIdStr ? new PublicKey(programIdStr) : null;
    const feeVault = feeVaultStr ? new PublicKey(feeVaultStr) : null;
    useContract = programId !== null && feeVault !== null;

    if (useContract) {
      // execute_purchase instruction: discriminator(8B) + amount_u64_LE(8B)
      const data = Buffer.alloc(16);
      data.set(EXECUTE_PURCHASE_DISCRIMINATOR, 0);
      data.writeBigUInt64LE(BigInt(lamports), 8);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: buyerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: sellerPubkey, isSigner: false, isWritable: true },
          { pubkey: feeVault, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
      });
      solanaTx = new Transaction().add(instruction);
      console.log(`[Step 4] Using smart contract: ${programIdStr}`);
      console.log(`[Step 4] Fee vault: ${feeVaultStr}`);
    } else {
      solanaTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: buyerKeypair.publicKey,
          toPubkey: sellerPubkey,
          lamports,
        })
      );
      console.log("[Step 4] Using direct SOL transfer (no contract)");
    }
  } catch (err) {
    throw new Error(`[Step 4] Failed to build transaction: ${err.message}`);
  }

  let txHash;
  try {
    txHash = await sendAndConfirmTransaction(
      connection,
      solanaTx,
      [buyerKeypair],
      { commitment: "confirmed" }
    );
  } catch (err) {
    throw new Error(`[Step 4] Transaction failed: ${err.message}`);
  }

  const txMode = useContract ? "contract" : "direct";
  console.log(`[Step 4] PASS — tx_hash = ${txHash} (${txMode})`);

  // ── Step 5: tempHome / tempWork 作成 ─────────────────────────────────────────

  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "km-cli-e2e-home-"));
  tempWork = await fs.mkdtemp(path.join(os.tmpdir(), "km-cli-e2e-work-"));
  const downloadDir = path.join(tempWork, "downloads");

  console.log(`[Step 5] PASS — tempHome = ${tempHome}`);

  // ── Step 6: km login ──────────────────────────────────────────────────────────

  const env = {
    ...process.env,
    HOME: tempHome,
    USERPROFILE: tempHome,
  };

  const login = await runKm(
    ["login", "--api-key", apiKey, "--base-url", baseUrl],
    env,
    repoRoot
  );
  assertSuccess("[Step 6] km login", login);
  assert.match(login.stdout, /Logged in successfully\./);

  console.log("[Step 6] PASS — km login OK");

  // ── Step 7: km install <id> --tx-hash <hash> --dir <tmpdir> ──────────────────

  const install = await runKm(
    [
      "install",
      knowledgeId,
      "--tx-hash",
      txHash,
      "--token",
      "SOL",
      "--chain",
      "solana",
      "--dir",
      downloadDir,
    ],
    env,
    repoRoot
  );
  assertSuccess("[Step 7] km install", install);
  assert.match(install.stdout, /Purchase recorded\./);

  console.log("[Step 7] PASS — km install completed");

  // ── Step 8: ダウンロードファイル存在・保存先確認 ──────────────────────────────

  const savedPath = extractLineValue(install.stdout, "Saved:");
  if (!savedPath) {
    throw new Error(
      `[Step 8] "Saved:" line not found in km install output:\n${install.stdout}`
    );
  }

  // ファイルが期待する downloadDir 配下に保存されていること
  const resolvedSaved = path.resolve(savedPath);
  const resolvedDownload = path.resolve(downloadDir);
  if (!resolvedSaved.startsWith(resolvedDownload + path.sep)) {
    throw new Error(
      `[Step 8] Saved path "${savedPath}" is not inside expected download directory "${downloadDir}"`
    );
  }

  try {
    await fs.access(savedPath);
  } catch {
    throw new Error(
      `[Step 8] Downloaded file does not exist at: ${savedPath}`
    );
  }

  console.log(`[Step 8] PASS — file saved at ${savedPath}`);
  console.log("");
  console.log("PASS: cli purchase flow completed successfully");
  exitCode = 0;
} catch (err) {
  if (!err.earlyExit) {
    console.error(err.message);
  }
} finally {
  if (!keepArtifacts) {
    if (tempHome) await fs.rm(tempHome, { recursive: true, force: true });
    if (tempWork) await fs.rm(tempWork, { recursive: true, force: true });
  } else {
    if (tempHome) console.log(`KEEP_KM_E2E_ARTIFACTS: HOME=${tempHome}`);
    if (tempWork) console.log(`KEEP_KM_E2E_ARTIFACTS: WORK=${tempWork}`);
  }
}

process.exit(exitCode);
