import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAllowedOrigins, resolveAllowedOrigin } from "@/lib/http/cors";

/**
 * RP1 (B-4): CORS allowlist ロジックの分離テスト。
 * middleware.ts は next-intl / @supabase/ssr を副作用 import するため、
 * pure function は `@/lib/http/cors` に分離済み。middleware からは
 * そのまま re-export せず同モジュールを import して使用する。
 */

const ORIGINAL_ENV = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
};

function setNodeEnv(value: string | undefined) {
  // NODE_ENV は read-only (readonly string) として推論されるため
  // TS 的に型を緩めて上書きする (テスト専用)。
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

beforeEach(() => {
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_ORIGIN;
  setNodeEnv("test");
});

afterEach(() => {
  // 元の値に復元 (undefined の場合はキー削除)
  if (ORIGINAL_ENV.ALLOWED_ORIGINS === undefined) {
    delete process.env.ALLOWED_ORIGINS;
  } else {
    process.env.ALLOWED_ORIGINS = ORIGINAL_ENV.ALLOWED_ORIGINS;
  }
  if (ORIGINAL_ENV.ALLOWED_ORIGIN === undefined) {
    delete process.env.ALLOWED_ORIGIN;
  } else {
    process.env.ALLOWED_ORIGIN = ORIGINAL_ENV.ALLOWED_ORIGIN;
  }
  setNodeEnv(ORIGINAL_ENV.NODE_ENV);
});

describe("getAllowedOrigins()", () => {
  describe("CSV パース", () => {
    it("ALLOWED_ORIGINS の CSV を配列化・空白 trim・空要素除去", () => {
      process.env.ALLOWED_ORIGINS =
        " https://knowmint.shop , https://www.knowmint.shop ,, ";
      expect(getAllowedOrigins()).toEqual([
        "https://knowmint.shop",
        "https://www.knowmint.shop",
      ]);
    });

    it("ALLOWED_ORIGIN (単一値・後方互換) も解釈", () => {
      process.env.ALLOWED_ORIGIN = "https://legacy.knowmint.shop";
      expect(getAllowedOrigins()).toEqual(["https://legacy.knowmint.shop"]);
    });

    it("ALLOWED_ORIGINS が優先される (ALLOWED_ORIGIN は無視)", () => {
      process.env.ALLOWED_ORIGINS = "https://a.example,https://b.example";
      process.env.ALLOWED_ORIGIN = "https://c.example";
      expect(getAllowedOrigins()).toEqual([
        "https://a.example",
        "https://b.example",
      ]);
    });
  });

  describe("production ガード", () => {
    it("production + 未設定 → throw (fail-fast)", () => {
      setNodeEnv("production");
      expect(() => getAllowedOrigins()).toThrow(/ALLOWED_ORIGINS must be set/);
    });

    it("production + 空白のみ → throw", () => {
      setNodeEnv("production");
      process.env.ALLOWED_ORIGINS = "   ,  ";
      expect(() => getAllowedOrigins()).toThrow(/ALLOWED_ORIGINS must be set/);
    });

    it("production + 正しい設定 → 配列を返す", () => {
      setNodeEnv("production");
      process.env.ALLOWED_ORIGINS = "https://knowmint.shop";
      expect(getAllowedOrigins()).toEqual(["https://knowmint.shop"]);
    });

    it("development + 未設定 → 空配列 (throw しない)", () => {
      setNodeEnv("development");
      expect(getAllowedOrigins()).toEqual([]);
    });
  });
});

describe("resolveAllowedOrigin()", () => {
  it("allowlist 一致 → Origin を echo する (safe)", () => {
    setNodeEnv("production");
    const allowed = ["https://knowmint.shop", "https://www.knowmint.shop"];
    expect(
      resolveAllowedOrigin("https://knowmint.shop", allowed)
    ).toBe("https://knowmint.shop");
  });

  it("allowlist 不一致 + production → null (ヘッダ出さない)", () => {
    setNodeEnv("production");
    const allowed = ["https://knowmint.shop"];
    expect(
      resolveAllowedOrigin("https://evil.example", allowed)
    ).toBeNull();
  });

  it("allowlist 不一致 + development → '*' (DX 維持)", () => {
    setNodeEnv("development");
    const allowed = ["https://knowmint.shop"];
    expect(resolveAllowedOrigin("https://evil.example", allowed)).toBe("*");
  });

  it("requestOrigin が null + production → null", () => {
    setNodeEnv("production");
    expect(resolveAllowedOrigin(null, ["https://knowmint.shop"])).toBeNull();
  });

  it("requestOrigin が null + development → '*'", () => {
    setNodeEnv("development");
    expect(resolveAllowedOrigin(null, ["https://knowmint.shop"])).toBe("*");
  });

  it("allowlist が空 + production → null", () => {
    setNodeEnv("production");
    expect(resolveAllowedOrigin("https://knowmint.shop", [])).toBeNull();
  });
});
