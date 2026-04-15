import { expect, describe, it, vi, afterEach } from "vitest";
import { fireAndForget } from "@/lib/async/fire-and-forget";

describe("fireAndForget()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("成功時: console.error を呼ばない", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = Promise.resolve("ok");
    fireAndForget(p, "test.success");
    // microtask flush
    await p;
    await Promise.resolve();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("reject 時: console.error を [ff:<context>] prefix で呼ぶ", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    const p = Promise.reject(err);
    fireAndForget(p, "test.failure");
    // reject は microtask で処理される → 2 tick 待つ
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalledTimes(1);
    const [prefix, logged] = errSpy.mock.calls[0];
    expect(prefix).toBe("[ff:test.failure]");
    expect(logged).toBe(err);
  });

  it("void を返す (await 不要)", () => {
    const p = Promise.resolve();
    const ret = fireAndForget(p, "test.void");
    expect(ret).toBeUndefined();
  });

  it("文字列で reject された場合もログされる", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = Promise.reject("string error");
    fireAndForget(p, "test.string");
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toBe("[ff:test.string]");
    expect(errSpy.mock.calls[0][1]).toBe("string error");
  });

  it("複数の fireAndForget が独立して動作する", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fireAndForget(Promise.reject(new Error("a")), "ctx.a");
    fireAndForget(Promise.resolve("ok"), "ctx.ok");
    fireAndForget(Promise.reject(new Error("b")), "ctx.b");
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalledTimes(2);
    const prefixes = errSpy.mock.calls.map((c) => c[0]);
    expect(prefixes).toContain("[ff:ctx.a]");
    expect(prefixes).toContain("[ff:ctx.b]");
    expect(prefixes).not.toContain("[ff:ctx.ok]");
  });

  it("then ハンドラ内で同期 throw しても unhandled rejection にならない", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // reject ハンドラ自体がエラーを出しても fireAndForget は void を返している。
    // ここでは Promise チェーンの内部で throw された場合に reject 側で補足される
    // ことを確認する。
    const p = Promise.resolve().then(() => {
      throw new Error("sync throw in then");
    });
    fireAndForget(p, "test.sync_throw");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toBe("[ff:test.sync_throw]");
    expect((errSpy.mock.calls[0][1] as Error).message).toBe(
      "sync throw in then",
    );
  });
});
