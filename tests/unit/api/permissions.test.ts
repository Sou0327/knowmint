import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import { ALLOWED_PERMISSIONS } from "@/lib/api/permissions";

describe("ALLOWED_PERMISSIONS", () => {
  it("3 要素であること", () => {
    assert.equal(ALLOWED_PERMISSIONS.length, 3);
  });

  it('"read" が含まれること', () => {
    assert.ok((ALLOWED_PERMISSIONS as readonly string[]).includes("read"));
  });

  it('"write" が含まれること', () => {
    assert.ok((ALLOWED_PERMISSIONS as readonly string[]).includes("write"));
  });

  it('"admin" が含まれること', () => {
    assert.ok((ALLOWED_PERMISSIONS as readonly string[]).includes("admin"));
  });

  it('"superuser" は含まれないこと', () => {
    assert.ok(!(ALLOWED_PERMISSIONS as readonly string[]).includes("superuser"));
  });

  it('"delete" は含まれないこと', () => {
    assert.ok(!(ALLOWED_PERMISSIONS as readonly string[]).includes("delete"));
  });

  it('空文字列は含まれないこと', () => {
    assert.ok(!(ALLOWED_PERMISSIONS as readonly string[]).includes(""));
  });
});
