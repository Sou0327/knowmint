import { expect, describe, it } from "vitest";
import {
  normalizeRequestContent,
  buildRequestFullContent,
  parseRequestFullContent,
} from "@/lib/knowledge/requestContent";

describe("normalizeRequestContent()", () => {
  it("undefined フィールド → 空文字列になること", () => {
    const r = normalizeRequestContent({ needed_info: "info", background: "bg" });
    expect(r.delivery_conditions).toBe("");
    expect(r.notes).toBe("");
  });

  it("前後スペースがトリムされること", () => {
    const r = normalizeRequestContent({
      needed_info: "  info  ",
      background: "  bg  ",
    });
    expect(r.needed_info).toBe("info");
    expect(r.background).toBe("bg");
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
    expect(r.includes("some info")).toBeTruthy();
    expect(r.includes("some background")).toBeTruthy();
  });

  it("delivery_conditions が空のときセクションが省略されること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "",
      notes: "",
    });
    expect(r.includes("## 納品条件")).toBeFalsy();
  });

  it("notes が空のときセクションが省略されること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "",
      notes: "",
    });
    expect(r.includes("## 補足")).toBeFalsy();
  });

  it("非空の delivery_conditions → '## 納品条件' セクションが含まれること", () => {
    const r = buildRequestFullContent({
      needed_info: "info",
      background: "bg",
      delivery_conditions: "some conditions",
      notes: "",
    });
    expect(r.includes("## 納品条件")).toBeTruthy();
    expect(r.includes("some conditions")).toBeTruthy();
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
    expect(parsed.needed_info).toBe(original.needed_info);
    expect(parsed.background).toBe(original.background);
    expect(parsed.delivery_conditions).toBe(original.delivery_conditions);
    expect(parsed.notes).toBe(original.notes);
  });

  it("null → 空の ParsedContent を返すこと", () => {
    const r = parseRequestFullContent(null);
    expect(r.needed_info).toBe("");
    expect(r.background).toBe("");
  });

  it("undefined → 空の ParsedContent を返すこと", () => {
    const r = parseRequestFullContent(undefined);
    expect(r.needed_info).toBe("");
  });

  it("セクションなしテキスト → needed_info にフォールバックすること", () => {
    const r = parseRequestFullContent("some plain text");
    expect(r.needed_info).toBe("some plain text");
    expect(r.background).toBe("");
  });
});
