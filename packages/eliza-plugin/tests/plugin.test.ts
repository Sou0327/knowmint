import { describe, it, expect, vi } from "vitest";
import { knowmintPlugin } from "../src/index.js";
import { createMockRuntime } from "./helpers.js";

describe("knowmintPlugin", () => {
  it("has correct plugin metadata", () => {
    expect(knowmintPlugin.name).toBe("@knowledge-market/eliza-plugin");
    expect(knowmintPlugin.description).toBeTruthy();
  });

  it("exports 3 actions", () => {
    expect(knowmintPlugin.actions).toHaveLength(3);
    const names = knowmintPlugin.actions!.map((a) => a.name);
    expect(names).toContain("SEARCH_KNOWLEDGE");
    expect(names).toContain("PURCHASE_KNOWLEDGE");
    expect(names).toContain("GET_CONTENT");
  });

  it("exports 1 provider", () => {
    expect(knowmintPlugin.providers).toHaveLength(1);
    expect(knowmintPlugin.providers![0].name).toBe("trending-knowledge");
  });

  it("init logs warning when API key missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = createMockRuntime({});

    await knowmintPlugin.init!({}, runtime);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("KM_API_KEY"));
    warnSpy.mockRestore();
  });

  it("init does not warn when API key present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = createMockRuntime({ KM_API_KEY: "km_" + "a".repeat(64) });

    await knowmintPlugin.init!({}, runtime);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("all actions have similes", () => {
    for (const action of knowmintPlugin.actions!) {
      expect(action.similes).toBeDefined();
      expect(action.similes!.length).toBeGreaterThan(0);
    }
  });

  it("all actions have examples", () => {
    for (const action of knowmintPlugin.actions!) {
      expect(action.examples).toBeDefined();
      expect(action.examples!.length).toBeGreaterThan(0);
    }
  });

  it("default export matches named export", async () => {
    const mod = await import("../src/index.js");
    expect(mod.default).toBe(mod.knowmintPlugin);
  });

  it("re-exports utility types and classes", async () => {
    const mod = await import("../src/index.js");
    expect(mod.KmApiError).toBeDefined();
    expect(mod.loadConfigFromRuntime).toBeDefined();
  });
});
