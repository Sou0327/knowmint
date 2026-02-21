import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import { validateExpiresAt } from "@/lib/api/validation";

const NOW = new Date("2026-02-22T12:00:00Z");

describe("validateExpiresAt()", () => {
  describe("undefined / null → { valid: true }", () => {
    it("undefined", () => {
      assert.deepEqual(validateExpiresAt(undefined, NOW), { valid: true });
    });

    it("null", () => {
      assert.deepEqual(validateExpiresAt(null, NOW), { valid: true });
    });
  });

  describe("非文字列 → { valid: false }", () => {
    it("数値", () => {
      const r = validateExpiresAt(123, NOW);
      assert.equal(r.valid, false);
    });

    it("boolean", () => {
      const r = validateExpiresAt(true, NOW);
      assert.equal(r.valid, false);
    });
  });

  describe("ISO 8601 形式違反 → { valid: false }", () => {
    it('"2026/12/31"', () => {
      assert.equal(validateExpiresAt("2026/12/31", NOW).valid, false);
    });

    it('"2026-13-01" (月が 13)', () => {
      assert.equal(validateExpiresAt("2026-13-01", NOW).valid, false);
    });

    it('"not-a-date"', () => {
      assert.equal(validateExpiresAt("not-a-date", NOW).valid, false);
    });
  });

  describe("存在しない日付 → { valid: false }", () => {
    it('"2026-02-29" (平年)', () => {
      assert.equal(validateExpiresAt("2026-02-29", NOW).valid, false);
    });

    it('"2026-04-31"', () => {
      assert.equal(validateExpiresAt("2026-04-31", NOW).valid, false);
    });

    it('"2026-02-30"', () => {
      assert.equal(validateExpiresAt("2026-02-30", NOW).valid, false);
    });
  });

  describe("過去日 → { valid: false, reason: '...future date' }", () => {
    it('"2026-01-01"', () => {
      const r = validateExpiresAt("2026-01-01", NOW);
      assert.equal(r.valid, false);
      assert.ok("reason" in r);
      assert.ok(r.reason.includes("future date"));
    });

    it('"2026-02-22T00:00:00Z" (NOW より前)', () => {
      const r = validateExpiresAt("2026-02-22T00:00:00Z", NOW);
      assert.equal(r.valid, false);
    });
  });

  describe("有効な未来日 → { valid: true }", () => {
    it('"2026-12-31"', () => {
      assert.deepEqual(validateExpiresAt("2026-12-31", NOW), { valid: true });
    });

    it('"2027-01-01T00:00:00Z"', () => {
      assert.deepEqual(validateExpiresAt("2027-01-01T00:00:00Z", NOW), {
        valid: true,
      });
    });

    it('"2026-03-01T12:00:00+09:00"', () => {
      assert.deepEqual(validateExpiresAt("2026-03-01T12:00:00+09:00", NOW), {
        valid: true,
      });
    });
  });
});
