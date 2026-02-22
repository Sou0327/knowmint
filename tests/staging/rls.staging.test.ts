/**
 * RLS 統合テスト — Supabase staging 環境 (Phase 15.1)
 *
 * STAGING_SUPABASE_URL が未設定の場合は全テストを skip する (CI セーフ)。
 *
 * 実行前の外部操作:
 * - Supabase staging プロジェクトを作成し以下の環境変数を設定:
 *   STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY / STAGING_SERVICE_ROLE_KEY
 * - npx ts-node scripts/seed/staging-seed.ts でシードデータを投入
 *
 * 実行方法:
 *   npm run test:staging
 */
import * as assert from "node:assert/strict";
import { describe, it, before } from "mocha";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STAGING_URL = process.env.STAGING_SUPABASE_URL;
const STAGING_ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
const STAGING_SERVICE_KEY = process.env.STAGING_SERVICE_ROLE_KEY;

const SKIP = !STAGING_URL;

describe("Staging RLS 検証", function () {
  this.timeout(30000);

  let anonClient: SupabaseClient;
  let serviceClient: SupabaseClient;

  before(function () {
    if (SKIP) {
      this.skip();
      return;
    }
    if (!STAGING_ANON_KEY) {
      throw new Error(
        "STAGING_SUPABASE_ANON_KEY is required when STAGING_SUPABASE_URL is set"
      );
    }
    if (!STAGING_SERVICE_KEY) {
      throw new Error(
        "STAGING_SERVICE_ROLE_KEY is required when STAGING_SUPABASE_URL is set"
      );
    }

    anonClient = createClient(STAGING_URL!, STAGING_ANON_KEY);
    serviceClient = createClient(STAGING_URL!, STAGING_SERVICE_KEY);
  });

  // ── knowledge_item_contents アクセス制御 ────────────────────────────────

  describe("knowledge_item_contents アクセス制御", () => {
    it("anon client → knowledge_item_contents に行が見えない (RLS で空配列)", async function () {
      if (SKIP) return this.skip();

      const { data, error } = await anonClient
        .from("knowledge_item_contents")
        .select("id")
        .limit(1);

      if (error) {
        // 42501 = permission denied → RLS が機能している → 合格
        if (error.code === "42501") return;

        // その他のエラーは設定ミスの可能性 → 失敗
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("permission") || msg.includes("denied")) return;

        assert.fail(
          `Unexpected DB error (check staging config): ${JSON.stringify(error)}`
        );
      }

      // エラーなし → RLS が正しく機能していれば 0 行が返る
      assert.ok(
        Array.isArray(data) && data.length === 0,
        `Expected RLS to return empty array for anon, got ${data?.length} rows`
      );
    });

    it("service_role client → knowledge_item_contents にアクセス可能", async function () {
      if (SKIP) return this.skip();

      const { error } = await serviceClient
        .from("knowledge_item_contents")
        .select("id")
        .limit(1);

      assert.equal(
        error,
        null,
        `service_role should be able to access knowledge_item_contents: ${JSON.stringify(error)}`
      );
    });
  });

  // ── 未購入ユーザーのコンテンツアクセス制御 ─────────────────────────────

  describe("未購入ユーザーのコンテンツアクセス", () => {
    it("anon で knowledge_item_contents を照会 → 0 行 (RLS が購入者以外を遮断)", async function () {
      if (SKIP) return this.skip();

      // knowledge_item_contents にデータがある行を service_role で取得
      // (content が存在する item のみを対象にして "0 行 = data なし" の偽陽性を防ぐ)
      const { data: contents, error: contentsErr } = await serviceClient
        .from("knowledge_item_contents")
        .select("knowledge_item_id")
        .not("full_content", "is", null)
        .limit(1);

      if (contentsErr) {
        assert.fail(
          `Failed to fetch contents (check staging config): ${JSON.stringify(contentsErr)}`
        );
      }

      if (!contents || contents.length === 0) {
        this.skip(); // コンテンツデータなし → スキップ
        return;
      }

      const itemId = contents[0].knowledge_item_id as string;

      const { data, error } = await anonClient
        .from("knowledge_item_contents")
        .select("id, full_content")
        .eq("knowledge_item_id", itemId)
        .limit(1);

      if (error) {
        // permission denied は合格
        const msg = (error.message ?? "").toLowerCase();
        const isPermission =
          error.code === "42501" ||
          msg.includes("permission") ||
          msg.includes("denied");
        assert.ok(
          isPermission,
          `Expected permission denied, got unexpected error: ${JSON.stringify(error)}`
        );
        return;
      }

      assert.ok(
        Array.isArray(data) && data.length === 0,
        `Expected RLS to hide contents for item ${itemId} from anon, got: ${data?.length} rows`
      );
    });
  });

  // ── confirm_transaction RPC アクセス制御 ────────────────────────────────

  describe("confirm_transaction RPC アクセス制御", () => {
    it("anon client で confirm_transaction → permission denied (42501)", async function () {
      if (SKIP) return this.skip();

      // 存在しない UUID で呼ぶ — permission エラーが先に返るはず (Phase 21 で REVOKE 済み)
      const { error } = await anonClient.rpc("confirm_transaction", {
        tx_id: "00000000-0000-0000-0000-000000000000",
      });

      assert.ok(
        error != null,
        "Expected error when calling confirm_transaction as anon, but got no error"
      );

      const msg = (error.message ?? "").toLowerCase();
      const isPermissionDenied =
        error.code === "42501" ||
        msg.includes("permission") ||
        msg.includes("denied") ||
        msg.includes("not allowed") ||
        msg.includes("execute");

      assert.ok(
        isPermissionDenied,
        `Expected permission denied (42501), got code=${error.code}, message="${error.message}"`
      );
    });

    it("service_role で confirm_transaction → 42501 以外 (関数は実行できる)", async function () {
      if (SKIP) return this.skip();

      // service_role なら関数自体は実行できる。存在しない TX の場合はエラーなし (0件UPDATE)
      const { error } = await serviceClient.rpc("confirm_transaction", {
        tx_id: "00000000-0000-0000-0000-000000000000",
      });

      // エラーがある場合、42501 でないこと AND 関数未定義エラーでないことを確認
      if (error != null) {
        assert.notEqual(
          error.code,
          "42501",
          `service_role must not get permission denied (42501): ${JSON.stringify(error)}`
        );
        // PGRST202 = function not found — RPC 定義が欠落していることを示すため失敗
        assert.notEqual(
          error.code,
          "PGRST202",
          `confirm_transaction function not found in staging DB. ` +
            `Run migrations first. error=${JSON.stringify(error)}`
        );
        const msg = (error.message ?? "").toLowerCase();
        assert.ok(
          !msg.includes("permission denied") &&
            !msg.includes("not allowed to execute"),
          `service_role must not get permission denied. error=${JSON.stringify(error)}`
        );
      }
      // エラーなし (0件 UPDATE で正常終了) も合格
    });
  });
});
