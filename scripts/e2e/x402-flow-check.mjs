#!/usr/bin/env node

/**
 * E2E smoke test: x402 フロー確認
 *
 * `npm run dev` で起動中のサーバーに実リクエストを送り、
 * 402 レスポンスのフォーマットと不正ヘッダーの拒否を確認する。
 *
 * 必須環境変数:
 *   KM_API_KEY: read 権限を持つ API キー
 *
 * 任意環境変数:
 *   KM_BASE_URL           default: http://127.0.0.1:3000
 *   KM_TEST_KNOWLEDGE_ID  published な item の ID
 */

const baseUrl = process.env.KM_BASE_URL || "http://127.0.0.1:3000";
const apiKey = process.env.KM_API_KEY;
const knowledgeId =
  process.env.KM_TEST_KNOWLEDGE_ID || "00000000-0000-0000-0000-000000000000";

if (!apiKey) {
  console.error("Missing KM_API_KEY");
  process.exit(1);
}

const contentUrl = `${baseUrl}/api/v1/knowledge/${knowledgeId}/content`;
const authHeaders = { Authorization: `Bearer ${apiKey}` };

/** リクエストタイムアウト (ms) */
const REQUEST_TIMEOUT_MS = 10_000;

/** テスト用 X-PAYMENT ヘッダーを生成する */
function buildTestXPayment(txHash) {
  return Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      payload: { txHash, asset: "native" },
    })
  ).toString("base64");
}

/**
 * タイムアウト付き fetch。
 * サーバーがハング状態でも CI を詰まらせない。
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * レスポンスボディを JSON でパースする（タイムアウト付き）。
 * 機密データ (data/full_content 等) は返さず、安全なフィールドのみ抽出。
 */
async function getJson(res) {
  let timeoutId;
  try {
    // ボディ読み込みにもタイムアウトを設定（ヘッダー後にボディが詰まるケースに対応）
    const textPromise = res.text();
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("body read timeout")),
        REQUEST_TIMEOUT_MS
      );
    });
    const text = await Promise.race([textPromise, timeoutPromise]);
    const raw = JSON.parse(text);
    // ログ出力に使う安全なサブセット（機密フィールドを除外）
    return {
      x402Version: raw?.x402Version,
      accepts: raw?.accepts,
      error: raw?.error,
      errorCode: raw?.error?.code ?? raw?.error,
      success: raw?.success,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  PASS: ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL: ${label}`);
  if (detail) console.error(`        ${detail}`);
  failed++;
}

// ── Check 1: X-PAYMENT なし → 402 + x402Version:1 + accepts は配列 ──────

console.log("\n[Check 1] No X-PAYMENT → 402 with x402Version:1");
{
  let res;
  try {
    res = await fetchWithTimeout(contentUrl, { headers: authHeaders });
  } catch (err) {
    fail("fetch failed", err?.name === "AbortError" ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : String(err));
    res = null;
  }

  if (res) {
    const json = await getJson(res);
    if (res.status !== 402) {
      fail("status should be 402", `got ${res.status}, error=${json?.errorCode ?? "(none)"}`);
    } else if (json?.x402Version !== 1) {
      fail("x402Version should be 1", `got ${json?.x402Version}`);
    } else if (!Array.isArray(json?.accepts)) {
      fail("accepts should be an Array", `got type=${typeof json?.accepts}`);
    } else {
      pass("status=402, x402Version=1, accepts is Array");
    }
  }
}

// ── Check 2: 不正 X-PAYMENT → 402 + error フィールドあり ─────────────────

console.log("\n[Check 2] Malformed X-PAYMENT → 402 with error field");
{
  let res;
  try {
    res = await fetchWithTimeout(contentUrl, {
      headers: {
        ...authHeaders,
        "X-PAYMENT": "invalid-base64!!",
      },
    });
  } catch (err) {
    fail("fetch failed", err?.name === "AbortError" ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : String(err));
    res = null;
  }

  if (res) {
    const json = await getJson(res);
    if (res.status !== 402) {
      fail("status should be 402", `got ${res.status}, error=${json?.errorCode ?? "(none)"}`);
    } else if (!json?.error) {
      fail("error field should be present", `got x402Version=${json?.x402Version}`);
    } else {
      pass(`status=402, error="${json.error}"`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\nSome checks failed. Is the server running?");
  console.error(
    `  npm run dev  (then: KM_API_KEY=<key> KM_TEST_KNOWLEDGE_ID=<id> npm run test:e2e:x402-flow)`
  );
  process.exit(1);
}

console.log("\nAll checks passed.");
