import { expect, describe, it } from "vitest";
import { sanitizeMetadata } from "@/lib/knowledge/metadata";

describe("sanitizeMetadata()", () => {
  it("null → {}", () => {
    expect(sanitizeMetadata(null)).toEqual({});
  });

  it("配列 → {}", () => {
    expect(sanitizeMetadata([1, 2, 3])).toEqual({});
  });

  it("文字列 → {}", () => {
    expect(sanitizeMetadata("hello")).toEqual({});
  });

  it("不正な domain 値 → フィールドが除去される", () => {
    const r = sanitizeMetadata({ domain: "invalid_domain" });
    expect("domain" in r).toBeFalsy();
  });

  it("有効な domain 値 → 保持される", () => {
    const r = sanitizeMetadata({ domain: "finance" });
    expect(r.domain).toBe("finance");
  });

  it("applicable_to が 11 件超 → 先頭 10 件にスライス", () => {
    const input = { applicable_to: Array.from({ length: 11 }, () => "any") };
    const r = sanitizeMetadata(input);
    expect((r.applicable_to as string[]).length).toBe(10);
  });

  it("applicable_to が非配列 → 除去される", () => {
    const r = sanitizeMetadata({ applicable_to: "GPT-4" });
    expect("applicable_to" in r).toBeFalsy();
  });

  it("許可外キー → 除去される", () => {
    const r = sanitizeMetadata({ injected_key: "evil", domain: "finance" });
    expect("injected_key" in r).toBeFalsy();
    expect(r.domain).toBe("finance");
  });

  it("有効な applicable_to 値のみ残る", () => {
    const r = sanitizeMetadata({ applicable_to: ["GPT-4", "invalid", "Claude"] });
    expect(r.applicable_to).toEqual(["GPT-4", "Claude"]);
  });
});
