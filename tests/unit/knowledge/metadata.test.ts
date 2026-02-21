import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import { sanitizeMetadata } from "@/lib/knowledge/metadata";

describe("sanitizeMetadata()", () => {
  it("null → {}", () => {
    assert.deepEqual(sanitizeMetadata(null), {});
  });

  it("配列 → {}", () => {
    assert.deepEqual(sanitizeMetadata([1, 2, 3]), {});
  });

  it("文字列 → {}", () => {
    assert.deepEqual(sanitizeMetadata("hello"), {});
  });

  it("不正な domain 値 → フィールドが除去される", () => {
    const r = sanitizeMetadata({ domain: "invalid_domain" });
    assert.ok(!("domain" in r));
  });

  it("有効な domain 値 → 保持される", () => {
    const r = sanitizeMetadata({ domain: "finance" });
    assert.equal(r.domain, "finance");
  });

  it("applicable_to が 11 件超 → 先頭 10 件にスライス", () => {
    const input = { applicable_to: Array.from({ length: 11 }, () => "any") };
    const r = sanitizeMetadata(input);
    assert.equal((r.applicable_to as string[]).length, 10);
  });

  it("applicable_to が非配列 → 除去される", () => {
    const r = sanitizeMetadata({ applicable_to: "GPT-4" });
    assert.ok(!("applicable_to" in r));
  });

  it("許可外キー → 除去される", () => {
    const r = sanitizeMetadata({ injected_key: "evil", domain: "finance" });
    assert.ok(!("injected_key" in r));
    assert.equal(r.domain, "finance");
  });

  it("有効な applicable_to 値のみ残る", () => {
    const r = sanitizeMetadata({ applicable_to: ["GPT-4", "invalid", "Claude"] });
    assert.deepEqual(r.applicable_to, ["GPT-4", "Claude"]);
  });
});
