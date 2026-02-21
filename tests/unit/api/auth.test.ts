import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import { generateApiKey } from "@/lib/api/auth";

describe("generateApiKey()", () => {
  it('raw が "km_" で始まること', async () => {
    const { raw } = await generateApiKey();
    assert.ok(raw.startsWith("km_"));
  });

  it("raw が 67 文字 (km_ + 64 hex) であること", async () => {
    const { raw } = await generateApiKey();
    assert.equal(raw.length, 67);
  });

  it("hash が 64 文字の hex であること", async () => {
    const { hash } = await generateApiKey();
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("SHA-256(raw) === hash であること", async () => {
    const { raw, hash } = await generateApiKey();
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
    const expected = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    assert.equal(hash, expected);
  });

  it("2 回呼んで異なる raw が生成されること", async () => {
    const { raw: raw1 } = await generateApiKey();
    const { raw: raw2 } = await generateApiKey();
    assert.notEqual(raw1, raw2);
  });
});
