#!/usr/bin/env node
/**
 * KnowMint Autonomous Purchase Demo
 *
 * AI エージェントが MCP 経由で知識を自律的に発見・購入するフローを再現する
 * デモスクリプト。asciinema rec の中で実行し、端末出力がそのまま映像になる。
 *
 * Required environment variables:
 * - DEMO_BUYER_KEYPAIR_PATH  : buyer keypair JSON ファイルパス
 *
 * - DEMO_SELLER_WALLET        : seller の base58 アドレス (payTo 検証に必須)
 *
 * Optional:
 * - KM_BASE_URL              : default http://localhost:3000
 * - NEXT_PUBLIC_SOLANA_RPC_URL : default http://127.0.0.1:8899
 * - KM_TEST_KNOWLEDGE_ID     : 購入対象の knowledge item ID (省略時は検索結果から自動選択)
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

// ── ANSI Colors (no dependencies) ────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
};

const FETCH_TIMEOUT_MS = 30_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function banner(text) {
  const line = "=".repeat(60);
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${text}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

function step(num, title) {
  console.log(
    `\n${C.bgBlue}${C.bold}${C.white} STEP ${num} ${C.reset} ${C.bold}${C.yellow}${title}${C.reset}\n`
  );
}

function info(label, value) {
  console.log(`  ${C.dim}${label}:${C.reset} ${C.white}${value}${C.reset}`);
}

function ok(msg) {
  console.log(`  ${C.green}[OK]${C.reset} ${msg}`);
}

function fail(msg) {
  console.error(`  ${C.magenta}[FAIL]${C.reset} ${msg}`);
  process.exit(1);
}

function agentThink(msg) {
  process.stdout.write(`  ${C.dim}> ${msg}${C.reset}`);
}

function agentSay(msg) {
  console.log(`  ${C.cyan}> ${msg}${C.reset}`);
}

// ── fetch + JSON helper ──────────────────────────────────────────────────────

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    let json = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse failure
    }
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

// ── Keypair loader ───────────────────────────────────────────────────────────

function loadKeypair(pathStr) {
  const absPath = resolve(process.cwd(), pathStr);
  const secretKeyArray = JSON.parse(readFileSync(absPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}

// ── Environment ──────────────────────────────────────────────────────────────

const baseUrl = process.env.KM_BASE_URL || "http://localhost:3000";
const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "http://127.0.0.1:8899";
const buyerKeypairPath = process.env.DEMO_BUYER_KEYPAIR_PATH;

if (!buyerKeypairPath) {
  fail("Missing required: DEMO_BUYER_KEYPAIR_PATH");
}

let buyerKeypair;
try {
  buyerKeypair = loadKeypair(buyerKeypairPath);
} catch (err) {
  fail(`Failed to load keypair: ${err.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO START
// ══════════════════════════════════════════════════════════════════════════════

banner("KnowMint - Autonomous AI Agent Purchase Demo");
console.log(
  `${C.dim}  An AI agent discovers and purchases knowledge autonomously${C.reset}`
);
console.log(
  `${C.dim}  using the x402 HTTP payment protocol.${C.reset}`
);
await sleep(1500);

// ── Step 0: Environment Check ────────────────────────────────────────────────

step(0, "Environment Setup Check");
agentThink("Checking prerequisites...\n");

// Check solana-test-validator (with cluster safety check)
info("Solana RPC", rpcUrl);
const connection = new Connection(rpcUrl, "confirmed");
try {
  const version = await connection.getVersion();
  ok(`Solana RPC connected (${version["solana-core"]})`);
} catch {
  fail(`Cannot connect to Solana RPC at ${rpcUrl}`);
}

// Fail-close: reject mainnet to prevent accidental real-money transfers
const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
try {
  const genesisHash = await connection.getGenesisHash();
  if (genesisHash === MAINNET_GENESIS) {
    fail(
      "SAFETY: Connected to Solana mainnet-beta. " +
      "This demo is for devnet/local only. Aborting to prevent real SOL loss."
    );
  }
  ok("Cluster safety check passed (not mainnet)");
} catch (err) {
  fail(`Failed to verify cluster genesis hash: ${err.message}`);
}

// Check dev server health
info("Dev Server", baseUrl);
try {
  const { res } = await fetchJson(`${baseUrl}/api/health`);
  if (res.ok) {
    ok("Dev server healthy");
  } else {
    fail(`Health check returned ${res.status}`);
  }
} catch {
  fail(`Cannot connect to dev server at ${baseUrl}`);
}

info("Buyer Wallet", buyerKeypair.publicKey.toBase58());

const balance = await connection.getBalance(buyerKeypair.publicKey);
info("Buyer Balance", `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
if (balance < LAMPORTS_PER_SOL * 0.01) {
  fail("Insufficient buyer balance. Run: solana airdrop 2 <buyer_pubkey>");
}
ok("All prerequisites met");
await sleep(1000);

// ── Step 1: km_register — Account Creation ───────────────────────────────────

step(1, "km_register — Wallet Authentication & Account Creation");
agentSay("I need an API key. Let me register with my Solana wallet...");
await sleep(800);

// 1a. Challenge
agentThink("Requesting auth challenge...\n");
const { res: chalRes, json: chalJson } = await fetchJson(
  `${baseUrl}/api/v1/auth/challenge`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: buyerKeypair.publicKey.toBase58(),
      purpose: "register",
    }),
  }
);

let apiKey;
const { ed25519 } = await import("@noble/curves/ed25519");

/** Sign a challenge message and return hex signature */
function signChallenge(message) {
  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = ed25519.sign(messageBytes, buyerKeypair.secretKey.slice(0, 32));
  return Buffer.from(sigBytes).toString("hex");
}

// Try register first; on 409 Conflict (already registered) → fall back to login
const isAlreadyRegistered = chalRes.status === 409;

if (chalRes.ok && chalJson?.success) {
  // New registration flow
  ok("Challenge received");
  info("Nonce", chalJson.data.nonce.slice(0, 16) + "...");

  agentThink("Signing challenge with Ed25519...\n");
  const signature = signChallenge(chalJson.data.message);
  ok("Challenge signed");

  agentThink("Submitting registration...\n");
  const { res: regRes, json: regJson } = await fetchJson(
    `${baseUrl}/api/v1/auth/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: buyerKeypair.publicKey.toBase58(),
        signature,
        nonce: chalJson.data.nonce,
        display_name: "Demo AI Agent",
      }),
    }
  );

  if (regRes.ok && regJson?.success) {
    apiKey = regJson.data.api_key;
    ok("Account created successfully!");
    info("User ID", regJson.data.user_id);
    info("API Key", apiKey.slice(0, 10) + "..." + apiKey.slice(-4));
  } else {
    fail(`Registration failed: ${regJson?.error?.message || regRes.status}`);
  }
} else if (isAlreadyRegistered) {
  // Wallet already registered — login instead
  agentSay("Already registered. Logging in instead...");
  const { res: chal2Res, json: chal2Json } = await fetchJson(
    `${baseUrl}/api/v1/auth/challenge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: buyerKeypair.publicKey.toBase58(),
        purpose: "login",
      }),
    }
  );

  if (!chal2Res.ok || !chal2Json?.success) {
    fail(`Login challenge failed: ${chal2Json?.error?.message || chal2Res.status}`);
  }

  const sig2 = signChallenge(chal2Json.data.message);

  const { res: loginRes, json: loginJson } = await fetchJson(
    `${baseUrl}/api/v1/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: buyerKeypair.publicKey.toBase58(),
        signature: sig2,
        nonce: chal2Json.data.nonce,
        key_name: "demo-session",
      }),
    }
  );

  if (!loginRes.ok || !loginJson?.success) {
    fail(`Login failed: ${loginJson?.error?.message || loginRes.status}`);
  }

  apiKey = loginJson.data.api_key;
  ok("Logged in successfully!");
  info("API Key", apiKey.slice(0, 10) + "..." + apiKey.slice(-4));
} else {
  fail(`Challenge request failed: ${chalJson?.error?.message || chalRes.status}`);
}
await sleep(1000);

// ── Step 2: km_search — Knowledge Discovery ─────────────────────────────────

step(2, "km_search — Discovering Knowledge");
agentSay('I need knowledge about "prompt" techniques. Let me search...');
await sleep(800);

const searchQuery = "prompt";
agentThink(`Searching: "${searchQuery}"...\n`);

const { res: searchRes, json: searchJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge?query=${encodeURIComponent(searchQuery)}&page=1&per_page=5`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (!searchRes.ok || !searchJson?.success) {
  fail(`Search failed: ${searchRes.status}`);
}

const items = searchJson.data;
if (!items || items.length === 0) {
  fail("No knowledge items found. Ensure seed data is loaded.");
}

ok(`Found ${items.length} results\n`);

for (const item of items) {
  const score =
    item.usefulness_score != null
      ? `[Quality: ${Number(item.usefulness_score).toFixed(2)}]`
      : "";
  const trust =
    item.seller?.trust_score != null
      ? `[Trust: ${Number(item.seller.trust_score).toFixed(2)}]`
      : "";
  console.log(
    `  ${C.yellow}${score}${C.reset} ${C.green}${trust}${C.reset} ${C.white}${item.title}${C.reset}`
  );
  if (item.tags && item.tags.length > 0) {
    console.log(
      `    ${C.dim}Tags: ${item.tags.map((t) => `#${t}`).join(" ")}${C.reset}`
    );
  }
  console.log(`    ${C.dim}ID: ${item.id}${C.reset}`);
}

// Filter for purchasable offer items with SOL price
const offerItems = items.filter(
  (it) => it.listing_type === "offer" && it.price_sol != null && it.price_sol > 0
);
if (offerItems.length === 0) {
  fail("No purchasable offer items with SOL price found in search results.");
}
const targetItem = offerItems[0];
agentSay(`Selected: "${targetItem.title}"`);
await sleep(1000);

// ── Step 3: km_get_detail — Evaluate Before Purchase ─────────────────────────

step(3, "km_get_detail — Evaluating Knowledge Item");
agentSay("Let me check the details before purchasing...");
await sleep(800);

const knowledgeId = process.env.KM_TEST_KNOWLEDGE_ID || targetItem.id;
agentThink(`Fetching details for ${knowledgeId}...\n`);

const { res: detailRes, json: detailJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (!detailRes.ok || !detailJson?.success) {
  fail(`Detail fetch failed: ${detailRes.status}`);
}

const detail = detailJson.data;
info("Title", detail.title);
info("Price", `${detail.price_sol} SOL`);
info(
  "Preview",
  detail.preview_content
    ? detail.preview_content.slice(0, 100) + "..."
    : "(no preview)"
);
info("Content Type", detail.content_type);
info("Purchase Count", String(detail.purchase_count ?? 0));

ok("Item looks valuable. Proceeding to purchase.");
await sleep(1000);

// ── Step 4: km_get_content (x402 Flow) — Autonomous Purchase ─────────────────

step(4, "km_get_content — x402 Autonomous Payment Flow");
agentSay("Attempting to access content...");
await sleep(800);

// 4a. First request → expect HTTP 402
agentThink("GET /content → expecting 402 Payment Required...\n");

const { res: contentRes, json: contentJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

if (contentRes.status === 200 && contentJson?.success) {
  // Already purchased
  agentSay("Content already purchased! Skipping payment.");
  step(5, "Content Retrieved (Previously Purchased)");
  const fullContent = contentJson.data?.full_content || "(empty)";
  console.log(
    `\n${C.bgMagenta}${C.bold}${C.white} CONTENT ${C.reset}\n`
  );
  console.log(`  ${C.white}${fullContent.slice(0, 500)}${C.reset}`);
  if (fullContent.length > 500) {
    console.log(`  ${C.dim}... (${fullContent.length} chars total)${C.reset}`);
  }
  banner("Demo Complete — Autonomous Purchase Flow");
  process.exit(0);
}

if (contentRes.status !== 402) {
  fail(
    `Expected 402, got ${contentRes.status}: ${JSON.stringify(contentJson)}`
  );
}

ok("Received HTTP 402 — Payment Required");

// 4b. Parse x402 response — select SOL (native) payment option explicitly
const accepts = contentJson?.accepts;
if (!accepts || accepts.length === 0) {
  fail("No payment methods in 402 response");
}

const paymentOption = accepts.find(
  (a) => a.asset === "native" || !a.asset
);
if (!paymentOption) {
  fail(
    "No native SOL payment option in 402 response. " +
    `Available assets: ${accepts.map((a) => a.asset || "unknown").join(", ")}`
  );
}

info("Payment Scheme", paymentOption.scheme);
info("Pay To", paymentOption.payTo);
info("Amount (lamports)", paymentOption.maxAmountRequired);
info("Network", paymentOption.network);
info("Asset", "native (SOL)");
await sleep(500);

// 4c. Verify payTo and amount before sending
agentThink("Verifying payment parameters...\n");

const sellerAddress = paymentOption.payTo;
const lamports = Number(paymentOption.maxAmountRequired);

// Validate payTo is a valid Solana address
let sellerPubkey;
try {
  sellerPubkey = new PublicKey(sellerAddress);
  if (!PublicKey.isOnCurve(sellerPubkey)) {
    fail("payTo address is not on the Ed25519 curve");
  }
} catch {
  fail(`Invalid payTo address in 402 response: ${sellerAddress}`);
}

// Cross-check: payTo must match known seller wallet (mandatory for payment)
// detail API does not expose wallet_address, so use DEMO_SELLER_WALLET env var
const knownSellerWallet = process.env.DEMO_SELLER_WALLET;
if (!knownSellerWallet) {
  fail(
    "DEMO_SELLER_WALLET is required to verify payTo address. " +
    "Set it to the seller's base58 wallet address."
  );
}
if (sellerAddress !== knownSellerWallet) {
  fail(
    `payTo mismatch: 402 says ${sellerAddress} but DEMO_SELLER_WALLET is ${knownSellerWallet}. Aborting.`
  );
}
ok("payTo matches DEMO_SELLER_WALLET");

// Cross-check: amount must exactly match item price
// Server uses toFixed(9) → BigInt (priceToAtomic), replicate the same logic
if (detail.price_sol != null && detail.price_sol > 0) {
  const fixed = detail.price_sol.toFixed(9);
  const [whole, frac = ""] = fixed.split(".");
  const expectedLamports = Number(BigInt(`${whole}${frac.padEnd(9, "0").slice(0, 9)}`));
  if (lamports !== expectedLamports) {
    fail(
      `Amount mismatch: 402 says ${lamports} lamports but item price is ` +
      `${detail.price_sol} SOL (${expectedLamports} lamports). Aborting.`
    );
  }
  ok(`Amount matches item price: ${lamports} lamports`);
}

if (!Number.isFinite(lamports) || lamports <= 0) {
  fail(`Invalid payment amount: ${paymentOption.maxAmountRequired}`);
}

ok("Payment parameters verified");

// 4d. Send SOL payment
agentSay("Sending SOL payment on-chain...");
await sleep(500);

const buyerBal = await connection.getBalance(buyerKeypair.publicKey);
if (buyerBal < lamports + 5000) {
  fail(
    `Insufficient balance: ${buyerBal} lamports (need ${lamports + 5000})`
  );
}

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
  fail(`Transaction failed: ${err.message}`);
}

ok(`Transaction confirmed!`);
info("TX Hash", txHash);
await sleep(500);

// 4d. Build payment_proof and retry
agentSay("Building x402 payment proof...");
await sleep(500);

const paymentProof = {
  scheme: "exact",
  network: paymentOption.network,
  payload: {
    txHash,
    asset: paymentOption.asset || "native",
  },
};

const proofBase64 = Buffer.from(JSON.stringify(paymentProof)).toString(
  "base64"
);
info("X-PAYMENT", proofBase64.slice(0, 40) + "...");

// ── Step 5: Content Retrieved ────────────────────────────────────────────────

step(5, "Content Retrieved — Purchase Complete!");
agentSay("Retrying with payment proof...");
await sleep(500);

const { res: paidRes, json: paidJson } = await fetchJson(
  `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`,
  {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-PAYMENT": proofBase64,
    },
  }
);

if (!paidRes.ok || !paidJson?.success) {
  fail(
    `Content fetch after payment failed: ${paidRes.status} - ${JSON.stringify(paidJson)}`
  );
}

ok("Content access granted!");
await sleep(500);

const fullContent = paidJson.data?.full_content || "(empty)";
console.log(
  `\n${C.bgMagenta}${C.bold}${C.white} PURCHASED CONTENT ${C.reset}\n`
);
console.log(`  ${C.white}${fullContent.slice(0, 500)}${C.reset}`);
if (fullContent.length > 500) {
  console.log(`  ${C.dim}... (${fullContent.length} chars total)${C.reset}`);
}

// ── Finish ───────────────────────────────────────────────────────────────────

await sleep(500);
banner("Demo Complete — AI Agent Autonomous Purchase via x402");

console.log(
  `  ${C.dim}Flow: Register -> Search -> Detail -> 402 -> Pay -> Content${C.reset}`
);
console.log(
  `  ${C.dim}Protocol: x402 (HTTP 402 Payment Required)${C.reset}`
);
console.log(
  `  ${C.dim}Chain: Solana (devnet)${C.reset}`
);
console.log(`  ${C.dim}TX: ${txHash}${C.reset}`);
console.log();
