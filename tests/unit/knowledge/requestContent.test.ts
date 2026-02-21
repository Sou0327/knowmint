import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  normalizeRequestContent,
  buildRequestFullContent,
  parseRequestFullContent,
} from "@/lib/knowledge/requestContent";

describe("normalizeRequestContent()", () => {
  it("undefined フィールド → 空文字列になること", () => {
    const r = normalizeRequestContent({ needed_info: "info", background: "bg" });
    assert.equal(r.delivery_conditions, "");
    assert.equal(r.notes, "");
  });

  it("前後スペースがトリムされること", () => {
    const r = normalizeRequestContent({
      needed_info: "  info  ",
      background: "  bg  ",
    });
    assert.equal(r.needed_info, "info");
    assert.equal(r.background, "bg");
  });
});

describe("buildRequestFullContent()", () => {
  it("needed_info と background が含まれること", () => {
    const r = buildRequestFullContent({
      needed_info: "some info",
      background: "some background",
      delivery_conditions: "",
      notes: "",
    });
    assert.ok(r.includes("some info"));
    assert.ok(r.includes("some background"));
  });

  it("delivery_conditions が空のときセクションが省略されること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "",
      notes: "",
    });
    assert.ok(!r.includes("## 納品条件"));
  });

  it("notes が空のときセクションが省略されること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "",
      notes: "",
    });
    assert.ok(!r.includes("## 補足"));
  });

  it("非空の delivery_conditions → '## 納品条件' セクションが含まれること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "some conditions",
      notes: "",
    });
    assert.ok(r.includes("## 納品条件"));
    assert.ok(r.includes("some conditions"));
  });
});

describe("parseRequestFullContent()", () => {
  it("buildRequestFullContent の出力でラウンドトリップすること", () => {
    const original = {
      needed_info: "test info",
      background: "test background",
      delivery_conditions: "test conditions",
      notes: "test notes",
    };
    const built = buildRequestFullContent(original);
    const parsed = parseRequestFullContent(built);
    assert.equal(parsed.needed_info, original.needed_info);
    assert.equal(parsed.background, original.background);
    assert.equal(parsed.delivery_conditions, original.delivery_conditions);
    assert.equal(parsed.notes, original.notes);
  });

  it("null → 空の ParsedContent を返すこと", () => {
    const r = parseRequestFullContent(null);
    assert.equal(r.needed_info, "");
    assert.equal(r.background, "");
  });

  it("undefined → 空の ParsedContent を返すこと", () => {
    const r = parseRequestFullContent(undefined);
    assert.equal(r.needed_info, "");
  });

  it("セクションなしテキスト → needed_info にフォールバックすること", () => {
    const r = parseRequestFullContent("some plain text");
    assert.equal(r.needed_info, "some plain text");
    assert.equal(r.background, "");
  });
});
