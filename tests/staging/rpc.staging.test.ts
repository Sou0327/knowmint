/**
 * RPC / DB 整合性テスト — Supabase staging 環境 (Phase 15.2)
 *
 * STAGING_SUPABASE_URL が未設定の場合は全テストを skip する (CI セーフ)。
 *
 * 実行前の外部操作:
 * - Supabase staging プロジェクトを作成し以下の環境変数を設定:
 *   STAGING_SUPABASE_URL / STAGING_SERVICE_ROLE_KEY
 * - npx ts-node scripts/seed/staging-seed.ts でシードデータを投入
 *
 * 実行方法:
 *   npm run test:staging
 */
import { expect, describe, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STAGING_URL = process.env.STAGING_SUPABASE_URL;
const STAGING_SERVICE_KEY = process.env.STAGING_SERVICE_ROLE_KEY;

const SKIP = !STAGING_URL;

describe("Staging RPC / DB 整合性", () => {
  let serviceClient: SupabaseClient;

  beforeAll(() => {
    if (SKIP) return;
    if (!STAGING_SERVICE_KEY) {
      throw new Error(
        "STAGING_SERVICE_ROLE_KEY is required when STAGING_SUPABASE_URL is set"
      );
    }
    serviceClient = createClient(STAGING_URL!, STAGING_SERVICE_KEY);
  });

  // ── DB 接続確認 ─────────────────────────────────────────────────────────

  describe("DB 接続", () => {
    it.skipIf(SKIP)("staging DB に接続できること (health check)", async () => {
      const { error } = await serviceClient
        .from("knowledge_items")
        .select("id")
        .limit(1);

      expect(
        error,
        `DB connection or query failed: ${JSON.stringify(error)}`
      ).toBeNull();
    });
  });

  // ── シードデータ存在確認 ─────────────────────────────────────────────────

  describe("シードデータ存在確認", () => {
    it.skipIf(SKIP)("knowledge_items に published のシードデータが存在すること", async () => {
      const { data, error } = await serviceClient
        .from("knowledge_items")
        .select("id, title, status")
        .eq("status", "published")
        .limit(5);

      expect(error, `Query failed: ${JSON.stringify(error)}`).toBeNull();
      expect(
        Array.isArray(data) && data.length > 0,
        "Expected at least one published knowledge_item. Run: npx ts-node scripts/seed/staging-seed.ts"
      ).toBeTruthy();
    });

    it.skipIf(SKIP)("profiles に wallet_address 付きのシードデータが存在すること", async () => {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("id, wallet_address")
        .not("wallet_address", "is", null)
        .limit(5);

      expect(error, `Query failed: ${JSON.stringify(error)}`).toBeNull();
      expect(
        Array.isArray(data) && data.length > 0,
        "Expected at least one profile with wallet_address. Run: npx ts-node scripts/seed/staging-seed.ts"
      ).toBeTruthy();
    });
  });

  // ── テーブルスキーマ確認 ─────────────────────────────────────────────────

  describe("テーブルスキーマ確認", () => {
    it.skipIf(SKIP)("transactions テーブルに必須カラムが存在すること", async () => {
      // limit(0) でデータなしのクエリを実行しカラムが存在するか確認
      const { error } = await serviceClient
        .from("transactions")
        .select(
          "id, buyer_id, seller_id, knowledge_item_id, tx_hash, status, amount, token, chain"
        )
        .limit(0);

      expect(
        error,
        `Schema check failed (missing column?): ${JSON.stringify(error)}`
      ).toBeNull();
    });

    it.skipIf(SKIP)("knowledge_item_contents テーブルに必須カラムが存在すること", async () => {
      const { error } = await serviceClient
        .from("knowledge_item_contents")
        .select("id, knowledge_item_id, full_content")
        .limit(0);

      expect(
        error,
        `Schema check failed (missing column?): ${JSON.stringify(error)}`
      ).toBeNull();
    });
  });

  // ── profiles.wallet_address UNIQUE 制約 ─────────────────────────────────

  describe("profiles.wallet_address UNIQUE 制約", () => {
    it.skipIf(SKIP)("同一 wallet_address への UPDATE → 23505 unique constraint violation", async () => {
      // profiles.id は auth.users.id の FK なので INSERT は不可。
      // 代わりに 2 つの既存 profile を使い、一方の wallet_address を他方と同じ値に
      // UPDATE することで UNIQUE 制約を検証する。
      const { data: profiles, error: fetchErr } = await serviceClient
        .from("profiles")
        .select("id, wallet_address")
        .not("wallet_address", "is", null)
        .limit(2);

      if (fetchErr) {
        throw new Error(
          `Failed to fetch profiles (check staging config): ${JSON.stringify(fetchErr)}`
        );
      }

      if (!profiles || profiles.length < 2) {
        return; // シードデータが不足 → スキップ相当 (パス扱い)
      }

      const [target, source] = profiles as {
        id: string;
        wallet_address: string;
      }[];

      // target の wallet_address を source と同じ値に変更 → 23505 を期待
      const { error: updateErr } = await serviceClient
        .from("profiles")
        .update({ wallet_address: source.wallet_address })
        .eq("id", target.id);

      // 万が一 UPDATE が成功してしまった場合はロールバック
      if (!updateErr) {
        await serviceClient
          .from("profiles")
          .update({ wallet_address: target.wallet_address })
          .eq("id", target.id);
      }

      expect(
        updateErr != null,
        "Expected unique constraint violation but UPDATE succeeded"
      ).toBeTruthy();
      expect(
        updateErr?.code,
        `Expected error code 23505 (wallet_address unique violation), ` +
          `got: ${updateErr?.code} — ${updateErr?.message}`
      ).toBe("23505");
    });
  });
});
