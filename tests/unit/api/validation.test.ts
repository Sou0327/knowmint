import { expect, describe, it } from "vitest";
import { isUuid, parsePagination, validateExpiresAt } from "@/lib/api/validation";

const NOW = new Date("2026-02-22T12:00:00Z");

describe("validateExpiresAt()", () => {
  describe("undefined / null → { valid: true, normalizedIso: null }", () => {
    it("undefined", () => {
      expect(validateExpiresAt(undefined, NOW)).toEqual({
        valid: true,
        normalizedIso: null,
      });
    });

    it("null", () => {
      expect(validateExpiresAt(null, NOW)).toEqual({
        valid: true,
        normalizedIso: null,
      });
    });
  });

  describe("非文字列 → { valid: false }", () => {
    it("数値", () => {
      const r = validateExpiresAt(123, NOW);
      expect(r.valid).toBe(false);
    });

    it("boolean", () => {
      const r = validateExpiresAt(true, NOW);
      expect(r.valid).toBe(false);
    });
  });

  describe("ISO 8601 形式違反 → { valid: false }", () => {
    it('"2026/12/31"', () => {
      expect(validateExpiresAt("2026/12/31", NOW).valid).toBe(false);
    });

    it('"2026-13-01" (月が 13)', () => {
      expect(validateExpiresAt("2026-13-01", NOW).valid).toBe(false);
    });

    it('"not-a-date"', () => {
      expect(validateExpiresAt("not-a-date", NOW).valid).toBe(false);
    });
  });

  describe("存在しない日付 → { valid: false }", () => {
    it('"2026-02-29" (平年)', () => {
      expect(validateExpiresAt("2026-02-29", NOW).valid).toBe(false);
    });

    it('"2026-04-31"', () => {
      expect(validateExpiresAt("2026-04-31", NOW).valid).toBe(false);
    });

    it('"2026-02-30"', () => {
      expect(validateExpiresAt("2026-02-30", NOW).valid).toBe(false);
    });
  });

  describe("過去日 → { valid: false, reason: '...future date' }", () => {
    it('"2026-01-01"', () => {
      const r = validateExpiresAt("2026-01-01", NOW);
      expect(r.valid).toBe(false);
      expect("reason" in r).toBeTruthy();
      expect((r as { valid: false; reason: string }).reason.includes("future date")).toBeTruthy();
    });

    it('"2026-02-22T00:00:00Z" (NOW より前)', () => {
      const r = validateExpiresAt("2026-02-22T00:00:00Z", NOW);
      expect(r.valid).toBe(false);
      expect("reason" in r).toBeTruthy();
      expect((r as { valid: false; reason: string }).reason.includes("future date")).toBeTruthy();
    });
  });

  describe("当日（日付のみ形式）→ { valid: true, normalizedIso: '...T23:59:59.999Z' }", () => {
    it('"2026-02-22" (NOW と同じ日・日付のみ) → 当日終端に正規化', () => {
      expect(validateExpiresAt("2026-02-22", NOW)).toEqual({
        valid: true,
        normalizedIso: "2026-02-22T23:59:59.999Z",
      });
    });
  });

  describe("有効な未来日 → { valid: true, normalizedIso: <string> }", () => {
    it('"2026-12-31" (日付のみ → 当日終端)', () => {
      expect(validateExpiresAt("2026-12-31", NOW)).toEqual({
        valid: true,
        normalizedIso: "2026-12-31T23:59:59.999Z",
      });
    });

    it('"2027-01-01T00:00:00Z" (ISO はそのまま)', () => {
      expect(validateExpiresAt("2027-01-01T00:00:00Z", NOW)).toEqual({
        valid: true,
        normalizedIso: "2027-01-01T00:00:00Z",
      });
    });

    it('"2026-03-01T12:00:00+09:00" (TZ 付き ISO はそのまま)', () => {
      expect(validateExpiresAt("2026-03-01T12:00:00+09:00", NOW)).toEqual({
        valid: true,
        normalizedIso: "2026-03-01T12:00:00+09:00",
      });
    });
  });
});

describe("isUuid()", () => {
  it("valid v4 UUID → true", () => {
    expect(isUuid("0d17f6a2-1b3c-4d5e-8fa7-0123456789ab")).toBe(true);
  });

  it("uppercase → accepted (case-insensitive)", () => {
    expect(isUuid("0D17F6A2-1B3C-4D5E-8FA7-0123456789AB")).toBe(true);
  });

  it("non-string → false", () => {
    expect(isUuid(12345)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid({ id: "00000000-0000-0000-0000-000000000000" })).toBe(false);
  });

  it("malformed UUID → false", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("0d17f6a2-1b3c-4d5e-8fa7-0123456789a")).toBe(false); // 最後が 11 桁
    expect(isUuid("0d17f6a2_1b3c_4d5e_8fa7_0123456789ab")).toBe(false); // underscore
  });
});

describe("parsePagination()", () => {
  it("空の searchParams → default { page: 1, perPage: 20 }", () => {
    const sp = new URLSearchParams();
    expect(parsePagination(sp)).toEqual({ page: 1, perPage: 20 });
  });

  it("page=0 → 1 にクランプ", () => {
    const sp = new URLSearchParams("page=0");
    expect(parsePagination(sp).page).toBe(1);
  });

  it("page=-5 → 1 にクランプ", () => {
    const sp = new URLSearchParams("page=-5");
    expect(parsePagination(sp).page).toBe(1);
  });

  it('page="abc" (非数値) → default の 1', () => {
    const sp = new URLSearchParams("page=abc");
    expect(parsePagination(sp).page).toBe(1);
  });

  it("page=2.9 → 2 (parseInt で切り捨て)", () => {
    const sp = new URLSearchParams("page=2.9");
    expect(parsePagination(sp).page).toBe(2);
  });

  it("page=9999 → 1000 の上限にクランプ", () => {
    const sp = new URLSearchParams("page=9999");
    expect(parsePagination(sp).page).toBe(1000);
  });

  it("per_page=50 → そのまま", () => {
    const sp = new URLSearchParams("per_page=50");
    expect(parsePagination(sp).perPage).toBe(50);
  });

  it("per_page=200 → 100 の上限にクランプ", () => {
    const sp = new URLSearchParams("per_page=200");
    expect(parsePagination(sp).perPage).toBe(100);
  });

  it("per_page=0 → default の 20 にフォールバック (rawPerPage <= 0)", () => {
    const sp = new URLSearchParams("per_page=0");
    expect(parsePagination(sp).perPage).toBe(20);
  });

  it("per_page=-10 → default の 20 にフォールバック", () => {
    const sp = new URLSearchParams("per_page=-10");
    expect(parsePagination(sp).perPage).toBe(20);
  });

  it('per_page="xyz" → default の 20 にフォールバック', () => {
    const sp = new URLSearchParams("per_page=xyz");
    expect(parsePagination(sp).perPage).toBe(20);
  });

  it("page=Infinity (文字列表現) → 非数値扱いで default", () => {
    // URLSearchParams は "Infinity" 文字列を保持するが、parseInt は NaN を返す
    const sp = new URLSearchParams("page=Infinity");
    expect(parsePagination(sp).page).toBe(1);
  });

  it("opts.defaultPage / defaultPerPage が効く", () => {
    const sp = new URLSearchParams();
    expect(parsePagination(sp, { defaultPage: 3, defaultPerPage: 50 })).toEqual({
      page: 3,
      perPage: 50,
    });
  });

  it("opts.maxPage / maxPerPage でクランプ", () => {
    const sp = new URLSearchParams("page=500&per_page=60");
    expect(parsePagination(sp, { maxPage: 100, maxPerPage: 50 })).toEqual({
      page: 100,
      perPage: 50,
    });
  });

  it("page と per_page を両方指定", () => {
    const sp = new URLSearchParams("page=3&per_page=25");
    expect(parsePagination(sp)).toEqual({ page: 3, perPage: 25 });
  });
});
