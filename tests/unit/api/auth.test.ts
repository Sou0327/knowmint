import { expect, describe, it } from "vitest";
import { generateApiKey } from "@/lib/api/auth";

describe("generateApiKey()", () => {
  it('raw が "km_" で始まること', async () => {
    const { raw } = await generateApiKey();
    expect(raw.startsWith("km_")).toBeTruthy();
  });

  it("raw が 67 文字 (km_ + 64 hex) であること", async () => {
    const { raw } = await generateApiKey();
    expect(raw.length).toBe(67);
  });

  it("hash が 64 文字の hex であること", async () => {
    const { hash } = await generateApiKey();
    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("SHA-256(raw) === hash であること", async () => {
    const { raw, hash } = await generateApiKey();
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
    const expected = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hash).toBe(expected);
  });

  it("2 回呼んで異なる raw が生成されること", async () => {
    const { raw: raw1 } = await generateApiKey();
    const { raw: raw2 } = await generateApiKey();
    expect(raw1).not.toBe(raw2);
  });
});
