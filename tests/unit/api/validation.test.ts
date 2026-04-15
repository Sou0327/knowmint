import { expect, describe, it } from "vitest";
import { validateExpiresAt } from "@/lib/api/validation";

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
