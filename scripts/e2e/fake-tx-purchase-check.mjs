#!/usr/bin/env node

/**
 * E2E check:
 * Fake Solana tx hash must be rejected by purchase API.
 *
 * Required environment variables:
 * - KM_API_KEY: API key with write permission
 *
 * Optional:
 * - KM_BASE_URL: default http://127.0.0.1:3000
 * - KM_TEST_KNOWLEDGE_ID: default 00000000-0000-0000-0000-000000000000
 */

const baseUrl = process.env.KM_BASE_URL || "http://127.0.0.1:3000";
const apiKey = process.env.KM_API_KEY;
const knowledgeId =
  process.env.KM_TEST_KNOWLEDGE_ID || "00000000-0000-0000-0000-000000000000";

if (!apiKey) {
  console.error("Missing KM_API_KEY");
  process.exit(1);
}

const url = `${baseUrl}/api/v1/knowledge/${knowledgeId}/purchase`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    tx_hash: "fake_tx_hash_should_fail",
    token: "SOL",
    chain: "solana",
  }),
});

let json = null;
try {
  json = await res.json();
} catch {
  console.error("Response is not JSON");
  process.exit(1);
}

if (res.status !== 400) {
  console.error(`Expected status 400, got ${res.status}`);
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

if (json?.success !== false || json?.error?.code !== "bad_request") {
  console.error("Expected bad_request error response");
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

const message = String(json?.error?.message || "");
if (!message.includes("Invalid Solana transaction hash format")) {
  console.error("Expected invalid tx hash message");
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

console.log("PASS: fake tx hash is rejected by purchase API");
