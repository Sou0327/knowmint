#!/usr/bin/env node
/**
 * Devnet 実送金 E2E テスト (Phase 15.3)
 *
 * devnet-setup.mjs で生成したキーペアを使って実際に SOL を送金し、
 * 購入 API → コンテンツ取得のフローを検証する。
 *
 * Required environment variables:
 * - TEST_API_KEY_BUYER        : buyer の API キー
 * - KM_TEST_KNOWLEDGE_ID      : 購入対象の knowledge item ID
 * - TEST_BUYER_KEYPAIR_PATH   : buyer keypair JSON ファイルパス
 * - TEST_SELLER_WALLET        : seller の Solana ウォレットアドレス (base58)
 *
 * Optional:
 * - KM_BASE_URL               : default http://127.0.0.1:3000
 * - NEXT_PUBLIC_SOLANA_RPC_URL: default https://api.devnet.solana.com
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const FETCH_TIMEOUT_MS = 30_000;

// ── 環境変数 ──────────────────────────────────────────────────────────────

const baseUrl = process.env.KM_BASE_URL || "http://127.0.0.1:3000";
const apiKey = process.env.TEST_API_KEY_BUYER;
const knowledgeId = process.env.KM_TEST_KNOWLEDGE_ID;
const buyerKeypairPath = process.env.TEST_BUYER_KEYPAIR_PATH;
const sellerWalletAddress = process.env.TEST_SELLER_WALLET;
const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const missing = [];
if (!apiKey) missing.push("TEST_API_KEY_BUYER");
if (!knowledgeId) missing.push("KM_TEST_KNOWLEDGE_ID");
if (!buyerKeypairPath) missing.push("TEST_BUYER_KEYPAIR_PATH");
if (!sellerWalletAddress) missing.push("TEST_SELLER_WALLET");
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`
  );
  process.exit(1);
}

// ── fetch + JSON ヘルパー (タイムアウト付き) ─────────────────────────────
// fetch と body 解析の両方を同一タイムアウト内で実行する。

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    // body 解析もタイムアウト内で完了させるため timer はここでは解除しない
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

// ── キーペア読み込み ───────────────────────────────────────────────────────

function loadKeypair(pathStr) {
  const absPath = resolve(process.cwd(), pathStr);
  const secretKeyArray = JSON.parse(readFileSync(absPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}

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

// RPC URL のホスト名のみ表示 (認証情報を含む可能性があるため)
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
console.log("");

// ── Step 1: knowledge item 詳細取得 (price_sol 確認) ──────────────────────

const { res: itemRes, json: itemJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (!itemRes.ok || itemJson?.success !== true) {
  console.error(`[Step 1] Failed to fetch knowledge item: ${itemRes.status}`);
  console.error(JSON.stringify(itemJson, null, 2));
  process.exit(1);
}

const priceSol = itemJson?.data?.price_sol;
if (
  typeof priceSol !== "number" ||
  !Number.isFinite(priceSol) ||
  priceSol <= 0
) {
  console.error(
    `[Step 1] Invalid price_sol: ${priceSol}. Item must have a finite price_sol > 0.`
  );
  process.exit(1);
}

console.log(`[Step 1] PASS — price_sol = ${priceSol}`);

// ── Step 2: 購入済みチェック (冪等性) ────────────────────────────────────
// 5xx エラーの場合は二重送金を防ぐため中断する。

const { res: checkRes, json: checkJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (checkRes.status >= 500) {
  console.error(
    `[Step 2] API server error (${checkRes.status}) during idempotency check. ` +
      "Aborting to prevent unintended SOL transfer."
  );
  process.exit(1);
}

if (checkRes.ok && checkJson?.success === true) {
  console.log(
    "[Step 2] Already purchased — content accessible. Skipping SOL transfer."
  );
  console.log("[Step 2] PASS (idempotent — no double spend)");
  console.log("");
  console.log("PASS: devnet purchase flow completed successfully (idempotent)");
  process.exit(0);
}

console.log("[Step 2] PASS — no prior purchase detected");

// ── Step 3: devnet 接続・buyer 残高確認 ───────────────────────────────────

const connection = new Connection(rpcUrl, "confirmed");
let buyerBalance;
try {
  buyerBalance = await connection.getBalance(buyerKeypair.publicKey);
} catch (err) {
  console.error(`[Step 3] Failed to connect to Solana RPC: ${err.message}`);
  process.exit(1);
}

const lamports = Math.ceil(priceSol * LAMPORTS_PER_SOL);
const feeBuffer = 5000; // TX 手数料バッファ (lamports)
const required = lamports + feeBuffer;

if (buyerBalance < required) {
  console.error(
    `[Step 3] Insufficient buyer balance: ${buyerBalance} lamports (need ${required})`
  );
  console.error(
    `Run: solana airdrop 2 ${buyerKeypair.publicKey.toBase58()} --url devnet`
  );
  process.exit(1);
}

console.log(`[Step 3] PASS — buyer balance = ${buyerBalance} lamports`);

// ── Step 4: SOL 送金 (buyer → seller) ────────────────────────────────────

const solanaTx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: buyerKeypair.publicKey,
    toPubkey: sellerPubkey,
    lamports,
  })
);

let txHash;
try {
  txHash = await sendAndConfirmTransaction(
    connection,
    solanaTx,
    [buyerKeypair],
    { commitment: "confirmed" }
  );
} catch (err) {
  console.error(`[Step 4] Transaction failed: ${err.message}`);
  process.exit(1);
}

console.log(`[Step 4] PASS — tx_hash = ${txHash}`);

// ── Step 5: 購入 API 呼び出し ─────────────────────────────────────────────

const { res: purchaseRes, json: purchaseJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}/purchase`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ tx_hash: txHash, token: "SOL", chain: "solana" }),
  }
);

if (!purchaseRes.ok || purchaseJson?.success !== true) {
  console.error(`[Step 5] Purchase API failed: ${purchaseRes.status}`);
  console.error(JSON.stringify(purchaseJson, null, 2));
  process.exit(1);
}

console.log(
  `[Step 5] PASS — purchase confirmed (tx_id = ${purchaseJson?.data?.id})`
);

// ── Step 6: コンテンツ取得検証 ────────────────────────────────────────────

const { res: contentRes, json: contentJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (!contentRes.ok || contentJson?.success !== true) {
  console.error(`[Step 6] Content fetch failed: ${contentRes.status}`);
  console.error(JSON.stringify(contentJson, null, 2));
  process.exit(1);
}

console.log("[Step 6] PASS — content fetched");
console.log("");
console.log("PASS: devnet purchase flow completed successfully");
