import { expect, describe, it } from "vitest";
import { ALLOWED_PERMISSIONS } from "@/lib/api/permissions";

describe("ALLOWED_PERMISSIONS", () => {
  it("3 要素であること", () => {
    expect(ALLOWED_PERMISSIONS.length).toBe(3);
  });

  it('"read" が含まれること', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("read")).toBeTruthy();
  });

  it('"write" が含まれること', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("write")).toBeTruthy();
  });

  it('"admin" が含まれること', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("admin")).toBeTruthy();
  });

  it('"superuser" は含まれないこと', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("superuser")).toBeFalsy();
  });

  it('"delete" は含まれないこと', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("delete")).toBeFalsy();
  });

  it('空文字列は含まれないこと', () => {
    expect((ALLOWED_PERMISSIONS as readonly string[]).includes("")).toBeFalsy();
  });
});
