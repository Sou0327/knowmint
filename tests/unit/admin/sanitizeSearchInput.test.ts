import { describe, it, expect } from "vitest";
import { sanitizeSearchInput } from "@/lib/admin/queries";

/**
 * RP1 (L-4): sanitizeSearchInput は Unicode プロパティエスケープ
 * (`\p{L}` / `\p{N}`) を用いて全スクリプトの文字・数字を許可しつつ、
 * サロゲート・絵文字・制御文字・LIKE ワイルドカード (%_\\) を排除する。
 * 呼び出し側は戻り値長 >= 2 の場合のみ検索に使う。
 */
describe("sanitizeSearchInput()", () => {
  describe("正常系: 文字・数字・空白・ハイフン・アンダースコアは保持", () => {
    it("CJK Unified (日本語) をそのまま返す", () => {
      // 「奥村想一朗」はすべて `\p{L}` にマッチする Han 文字
      expect(sanitizeSearchInput("奥村想一朗")).toBe("奥村想一朗");
    });

    it("ハングル / Cyrillic / Greek も保持される (従来レンジでは漏れていた)", () => {
      expect(sanitizeSearchInput("안녕하세요")).toBe("안녕하세요"); // 韓国語
      expect(sanitizeSearchInput("Привет")).toBe("Привет"); // ロシア語
      expect(sanitizeSearchInput("Γειά")).toBe("Γειά"); // ギリシャ語
    });

    it("英数字 + ハイフン + 空白は保持、アンダースコアは LIKE エスケープされる", () => {
      // `_` は最初の regex では許可 (`\p{L}\p{N}\s_-`)、後段で LIKE ワイルドカード
      // として `\_` にエスケープされる。
      expect(sanitizeSearchInput("Hello_world-123 foo")).toBe(
        "Hello\\_world-123 foo"
      );
    });

    it("内部空白は保持しつつ前後空白のみ trim される", () => {
      expect(sanitizeSearchInput("  hello world  ")).toBe("hello world");
    });
  });

  describe("異常系: 危険文字は除去・エスケープされる", () => {
    it("絵文字・サロゲートペアは除去される", () => {
      // 😀 (U+1F600) は `\p{So}` カテゴリなので `\p{L}\p{N}` にマッチしない
      expect(sanitizeSearchInput("hello😀world")).toBe("helloworld");
      expect(sanitizeSearchInput("🎉🚀")).toBe("");
    });

    it("空白のみ入力は trim 後に空文字となり呼び出し側で弾かれる", () => {
      expect(sanitizeSearchInput("   ")).toBe("");
      expect(sanitizeSearchInput("\t\n")).toBe("");
    });

    it("LIKE ワイルドカード (%_\\) は最初の regex で扱われエスケープ対象のみ残る", () => {
      // `%` と `\` は `\p{L}\p{N}\s_-` に含まれないため最初の replace で除去される。
      // `_` のみ許可後にエスケープされるので `\_` で残る。
      expect(sanitizeSearchInput("100%")).toBe("100");
      expect(sanitizeSearchInput("foo_bar")).toBe("foo\\_bar");
      expect(sanitizeSearchInput("a\\b")).toBe("ab");
      // 3 種同時: `%` と `\` は除去、`_` のみ escape
      expect(sanitizeSearchInput("a%b_c\\d")).toBe("ab\\_cd");
    });

    it("SQL injection 的文字は除去される (;/'/()/=)", () => {
      // `;` `'` `=` は除去、`-` は許可文字なので `--` は保持される。
      // 先頭の `'` が除去された後 `.trim()` で空白も除去される。
      expect(sanitizeSearchInput("'; DROP TABLE users;--")).toBe(
        "DROP TABLE users--"
      );
      // `'` と `=` は除去される
      expect(sanitizeSearchInput("admin' OR '1'='1")).toBe("admin OR 11");
    });

    it("PostgREST .or() を破壊する文字 (, .) も除去される", () => {
      // カンマ・ドットは `\p{L}\p{N}` 外なので除去 → DSL injection 不可。
      // `_` は後段の LIKE escape により `\_` として残る。
      expect(sanitizeSearchInput("display_name.ilike.foo,wallet")).toBe(
        "display\\_nameilikefoowallet"
      );
    });
  });

  describe("空文字入力", () => {
    it("空文字 → 空文字", () => {
      expect(sanitizeSearchInput("")).toBe("");
    });
  });

  describe("safe.length >= 2 ガードの前提条件", () => {
    it("1 文字のみの入力 (length === 1) は呼び出し側でスキップ対象", () => {
      // 呼び出し側 (getAdminUsers/getAdminListings) は safe.length >= 2 を検証する。
      // ここでは sanitize 関数自体は 1 文字でも空にはしない ことを確認。
      expect(sanitizeSearchInput("a").length).toBe(1);
      expect(sanitizeSearchInput("あ").length).toBe(1);
    });
  });
});
