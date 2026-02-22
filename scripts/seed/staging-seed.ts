#!/usr/bin/env ts-node
/**
 * Supabase Staging シードスクリプト (Phase 15.1)
 *
 * 実行前提:
 *   - .env.test に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
 *   - SUPABASE_URL が staging/localhost を示すパターンを含むこと
 *   - STAGING_SEED_CONFIRMED=true を明示的に設定すること
 *
 * 使用方法:
 *   STAGING_SEED_CONFIRMED=true dotenv -e .env.test -- npx ts-node scripts/seed/staging-seed.ts
 *
 * 出力:
 *   生成した API キーは stdout ではなく .staging-keys.tmp に保存されます。
 *   .staging-keys.tmp は .gitignore に登録済みです。
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// ── 環境変数チェック ──────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test"
  );
  process.exit(1);
}

// ── 本番誤実行防止ガード (AND 条件: 両方必須) ────────────────────
const confirmed = process.env.STAGING_SEED_CONFIRMED;
if (confirmed !== "true") {
  console.error(
    "ERROR: STAGING_SEED_CONFIRMED=true が設定されていません。\n" +
      "本番環境への誤実行を防ぐため、意図的に実行する場合は:\n" +
      "  STAGING_SEED_CONFIRMED=true dotenv -e .env.test -- npx ts-node scripts/seed/staging-seed.ts"
  );
  process.exit(1);
}

// URL の hostname を厳密な許可リストで検査（部分一致は使わない）
// ラベル境界を考慮し、localhost.attacker.example のような偽装を防ぐ
let parsedUrl: URL;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  console.error(`ERROR: NEXT_PUBLIC_SUPABASE_URL が不正な URL です: ${supabaseUrl}`);
  process.exit(1);
}
const { hostname, protocol } = parsedUrl;

/**
 * 許可される staging ホスト名かどうかを厳密に検証する。
 *   - ローカル: "localhost", "127.0.0.1", "::1" の完全一致
 *   - Supabase クラウド: hostname が ".supabase.co" で終わり、
 *     かつサブドメインが "-staging" で終わる（例: xxxxx-staging.supabase.co）
 */
function isAllowedStagingHostname(h: string): boolean {
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".supabase.co")) {
    const subdomain = h.slice(0, -".supabase.co".length);
    return subdomain.endsWith("-staging");
  }
  return false;
}

if (!isAllowedStagingHostname(hostname)) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL のホスト名が許可された staging ホストではありません。\n" +
      `  hostname: ${hostname}\n` +
      "許可ホスト: localhost / 127.0.0.1 / *-staging.supabase.co\n" +
      "本番 URL に対してシードスクリプトを実行することは禁止されています。"
  );
  process.exit(1);
}

// ローカル以外は https を強制
if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" &&
    protocol !== "https:") {
  console.error(
    `ERROR: staging Supabase URL は https: を使用してください (got: ${protocol})`
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── テストユーザー定義 ────────────────────────────────────────
const SEED_SELLER_EMAIL = "test-seller@km-staging.example.com";
const SEED_BUYER_EMAIL = "test-buyer@km-staging.example.com";
const TEST_PASSWORD = "TestPassword123!";

// ── ユーティリティ ────────────────────────────────────────────

/**
 * Auth ユーザーを作成または既存ユーザーの ID を取得する。
 * Supabase Auth admin.createUser は重複ユーザーで status 422 を返す。
 */
async function upsertAuthUser(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (!error) {
    return data.user.id;
  }

  // 重複ユーザー: status 422 または "already" を含むメッセージ
  const isDuplicate =
    (error as { status?: number }).status === 422 ||
    error.message.toLowerCase().includes("already");

  if (isDuplicate) {
    const { data: listData, error: listError } =
      await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      console.error(`ERROR: Failed to list users: ${listError.message}`);
      process.exit(1);
    }
    const existing = listData.users.find((u) => u.email === email);
    if (!existing) {
      console.error(`ERROR: User ${email} not found after creation conflict.`);
      process.exit(1);
    }
    console.log(`  → User ${email} already exists, reusing ID: ${existing.id}`);
    return existing.id;
  }

  console.error(`ERROR: Failed to create user ${email}: ${error.message}`);
  process.exit(1);
}

/**
 * SHA-256 ハッシュを生成する。
 */
function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * 既存のシードキー（同一 user_id + name）を削除してから新規発行する。
 * raw キーは戻り値として返すのみ（stdout/log に出力しない）。
 */
async function upsertApiKey(
  userId: string,
  keyName: string,
  permissions: string[]
): Promise<string> {
  // 既存の同名キーを削除（冪等化）
  const { error: deleteError } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", userId)
    .eq("name", keyName);
  if (deleteError) {
    console.error(`ERROR: Failed to delete existing key "${keyName}": ${deleteError.message}`);
    process.exit(1);
  }

  // 新規発行
  const rawKey = "km_test_" + randomBytes(32).toString("hex");
  const { error: insertError } = await supabase.from("api_keys").insert({
    user_id: userId,
    name: keyName,
    key_hash: sha256(rawKey),
    permissions,
  });
  if (insertError) {
    console.error(`ERROR: Failed to insert API key "${keyName}": ${insertError.message}`);
    process.exit(1);
  }

  return rawKey;
}

// ── メイン処理 ────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Auth ユーザー作成
  console.log("Creating auth users...");
  const sellerUserId = await upsertAuthUser(SEED_SELLER_EMAIL);
  const buyerUserId = await upsertAuthUser(SEED_BUYER_EMAIL);

  // 2. profiles upsert
  console.log("Upserting profiles...");
  const sellerWallet = process.env.TEST_SELLER_WALLET ?? null;
  const buyerWallet = process.env.TEST_BUYER_WALLET ?? null;

  const { error: sellerProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: sellerUserId,
        display_name: "Test Seller",
        user_type: "human",
        wallet_address: sellerWallet,
      },
      { onConflict: "id" }
    );
  if (sellerProfileError) {
    console.error(`ERROR: Failed to upsert seller profile: ${sellerProfileError.message}`);
    process.exit(1);
  }

  const { error: buyerProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: buyerUserId,
        display_name: "Test Buyer",
        user_type: "human",
        wallet_address: buyerWallet,
      },
      { onConflict: "id" }
    );
  if (buyerProfileError) {
    console.error(`ERROR: Failed to upsert buyer profile: ${buyerProfileError.message}`);
    process.exit(1);
  }

  // 3. knowledge_items upsert
  console.log("Upserting knowledge items...");

  // published 3件
  const publishedItems = [
    {
      seller_id: sellerUserId,
      listing_type: "offer" as const,
      title: "Test Knowledge Item 1",
      description: "Integration test item 1",
      content_type: "general" as const,
      price_sol: 0.01,
      status: "published" as const,
      tags: ["test"],
    },
    {
      seller_id: sellerUserId,
      listing_type: "offer" as const,
      title: "Test Knowledge Item 2",
      description: "Integration test item 2",
      content_type: "prompt" as const,
      price_sol: 0.05,
      status: "published" as const,
      tags: ["test", "prompt"],
    },
    {
      seller_id: sellerUserId,
      listing_type: "offer" as const,
      title: "Test Knowledge Item 3",
      description: "Integration test item 3",
      content_type: "tool_def" as const,
      price_sol: 0.1,
      status: "published" as const,
      tags: ["test", "tool"],
    },
  ];

  // draft 1件
  const draftItem = {
    seller_id: sellerUserId,
    listing_type: "offer" as const,
    title: "Test Knowledge Item Draft",
    description: "Integration test draft item",
    content_type: "general" as const,
    price_sol: 0.02,
    status: "draft" as const,
    tags: ["test", "draft"],
  };

  // request 1件
  const requestItem = {
    seller_id: sellerUserId,
    listing_type: "request" as const,
    title: "Test Knowledge Request",
    description: "Integration test request item",
    content_type: "general" as const,
    price_sol: null,
    status: "published" as const,
    tags: ["test", "request"],
  };

  const { data: insertedItems, error: itemsError } = await supabase
    .from("knowledge_items")
    .upsert([...publishedItems, draftItem, requestItem], {
      onConflict: "id",
      ignoreDuplicates: false,
    })
    .select("id, title, status, listing_type");

  if (itemsError) {
    console.error(`ERROR: Failed to upsert knowledge items: ${itemsError.message}`);
    process.exit(1);
  }

  // 4. knowledge_item_contents upsert (published 3件のみ)
  console.log("Upserting knowledge item contents...");
  const publishedInserted = (insertedItems ?? []).filter(
    (item) => item.status === "published" && item.listing_type === "offer"
  );

  for (let i = 0; i < publishedInserted.length; i++) {
    const item = publishedInserted[i];
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .upsert(
        {
          knowledge_item_id: item.id,
          full_content: `Test content for item ${i + 1}`,
        },
        { onConflict: "knowledge_item_id" }
      );
    if (contentError) {
      console.error(
        `ERROR: Failed to upsert content for item ${item.id}: ${contentError.message}`
      );
      process.exit(1);
    }
  }

  // 5. API キー生成 (seller + buyer) — 既存キーを削除してから再発行（冪等）
  // raw キーは stdout に出力せず .staging-keys.tmp に書き出す
  console.log("Generating API keys (old keys for this name will be revoked)...");

  const sellerRaw = await upsertApiKey(sellerUserId, "staging-seed-seller", ["read", "write"]);
  const buyerRaw = await upsertApiKey(buyerUserId, "staging-seed-buyer", ["read", "write"]);

  // 6. API キーをファイルに保存（CI ログへの漏洩を防ぐため stdout には出力しない）
  const keyOutput = [
    "# Staging Seed API Keys",
    "# Generated: " + new Date().toISOString(),
    "# WARNING: This file contains sensitive plain-text API keys.",
    "# Add to .env.test, then delete or protect this file.",
    "",
    "# Seller ID: " + sellerUserId,
    "# Buyer ID:  " + buyerUserId,
    "",
    "TEST_API_KEY_SELLER=" + sellerRaw,
    "TEST_API_KEY_BUYER=" + buyerRaw,
    "",
  ].join("\n");

  const outputPath = ".staging-keys.tmp";
  writeFileSync(outputPath, keyOutput, { mode: 0o600 });

  // 7. 完了サマリ（API キー値は stdout に出さない）
  console.log("");
  console.log("=== Staging Seed Complete ===");
  console.log(`Seller ID: ${sellerUserId}`);
  console.log(`Buyer ID:  ${buyerUserId}`);
  console.log("");
  console.log(`API keys saved to: ${outputPath}  (mode 600, gitignored)`);
  console.log("Add the values from that file to .env.test, then delete it.");
  console.log("");
  console.log("⚠️  Keys are shown once. If lost, re-run this script to rotate them.");
}

main().catch((err: unknown) => {
  console.error("ERROR: Unexpected error during seed:", err);
  process.exit(1);
});
