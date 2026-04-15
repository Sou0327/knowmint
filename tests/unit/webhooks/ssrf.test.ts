import { expect, describe, it, vi, afterEach } from "vitest";
import * as dnsModule from "node:dns";
import { isPrivateIp, checkPublicUrl } from "@/lib/webhooks/ssrf";

describe("isPrivateIp()", () => {
  describe("プライベート IPv4 → true", () => {
    it("127.0.0.1 (loopback)", () => expect(isPrivateIp("127.0.0.1")).toBeTruthy());
    it("10.0.0.1", () => expect(isPrivateIp("10.0.0.1")).toBeTruthy());
    it("192.168.1.1", () => expect(isPrivateIp("192.168.1.1")).toBeTruthy());
    it("172.16.0.1", () => expect(isPrivateIp("172.16.0.1")).toBeTruthy());
    it("172.31.255.255", () => expect(isPrivateIp("172.31.255.255")).toBeTruthy());
  });

  describe("CGNAT → true", () => {
    it("100.64.0.1", () => expect(isPrivateIp("100.64.0.1")).toBeTruthy());
    it("100.127.255.255", () => expect(isPrivateIp("100.127.255.255")).toBeTruthy());
  });

  describe("CGNAT 外 → false", () => {
    it("100.128.0.0", () => expect(isPrivateIp("100.128.0.0")).toBeFalsy());
  });

  describe("link-local → true", () => {
    it("169.254.0.1", () => expect(isPrivateIp("169.254.0.1")).toBeTruthy());
  });

  describe("パブリック IPv4 → false", () => {
    it("8.8.8.8", () => expect(isPrivateIp("8.8.8.8")).toBeFalsy());
    it("1.1.1.1", () => expect(isPrivateIp("1.1.1.1")).toBeFalsy());
  });

  describe("プライベート IPv6 → true", () => {
    it("::1 (loopback)", () => expect(isPrivateIp("::1")).toBeTruthy());
    it("fc00::1 (ULA)", () => expect(isPrivateIp("fc00::1")).toBeTruthy());
    it("fd00::1 (ULA)", () => expect(isPrivateIp("fd00::1")).toBeTruthy());
    it("fe80::1 (link-local)", () => expect(isPrivateIp("fe80::1")).toBeTruthy());
  });

  describe("パブリック IPv6 → false", () => {
    it("2001:4860:4860::8888 (Google DNS)", () =>
      expect(isPrivateIp("2001:4860:4860::8888")).toBeFalsy());
  });

  describe("malformed → true (fail-safe)", () => {
    it("not-an-ip", () => expect(isPrivateIp("not-an-ip")).toBeTruthy());
  });

  // B-7 補完: 追加ケース
  describe("0.0.0.0/8 → true", () => {
    it("0.0.0.0", () => expect(isPrivateIp("0.0.0.0")).toBeTruthy());
    it("0.255.255.255", () => expect(isPrivateIp("0.255.255.255")).toBeTruthy());
  });

  describe("multicast / reserved → true", () => {
    it("224.0.0.1 (multicast)", () => expect(isPrivateIp("224.0.0.1")).toBeTruthy());
    it("255.255.255.255 (broadcast)", () => expect(isPrivateIp("255.255.255.255")).toBeTruthy());
    it("ff02::1 (IPv6 multicast)", () => expect(isPrivateIp("ff02::1")).toBeTruthy());
    it("fec0::1 (IPv6 site-local deprecated)", () => expect(isPrivateIp("fec0::1")).toBeTruthy());
  });

  describe("IPv6 unspecified / loopback edge cases → true", () => {
    it(":: (unspecified)", () => expect(isPrivateIp("::")).toBeTruthy());
    it("::7f00:1 (IPv4-compatible 127.0.0.1)", () => expect(isPrivateIp("::7f00:1")).toBeTruthy());
  });

  describe("IPv4-mapped IPv6 → delegates to IPv4 check", () => {
    it("::ffff:127.0.0.1 (loopback) → true", () => expect(isPrivateIp("::ffff:127.0.0.1")).toBeTruthy());
    it("::ffff:192.168.1.1 (private) → true", () => expect(isPrivateIp("::ffff:192.168.1.1")).toBeTruthy());
    it("::ffff:8.8.8.8 (public) → false", () => expect(isPrivateIp("::ffff:8.8.8.8")).toBeFalsy());
  });

  describe("IPv4 malformed formats → true (fail-safe)", () => {
    it("leading zero '01.2.3.4'", () => expect(isPrivateIp("01.2.3.4")).toBeTruthy());
    it("out-of-range '256.0.0.1'", () => expect(isPrivateIp("256.0.0.1")).toBeTruthy());
    it("missing octet '1.2.3'", () => expect(isPrivateIp("1.2.3")).toBeTruthy());
    it("double-dot '1..1.1'", () => expect(isPrivateIp("1..1.1")).toBeTruthy());
    it("hex octet '0xff.0.0.1'", () => expect(isPrivateIp("0xff.0.0.1")).toBeTruthy());
    it("empty string", () => expect(isPrivateIp("")).toBeTruthy());
  });

  describe("IPv6 malformed → true (fail-safe)", () => {
    it("too many groups '1:2:3:4:5:6:7:8:9'", () => expect(isPrivateIp("1:2:3:4:5:6:7:8:9")).toBeTruthy());
    it("invalid hex 'gggg::1'", () => expect(isPrivateIp("gggg::1")).toBeTruthy());
  });

  describe("boundary: 172.32.0.0 just outside 172.16/12 → false", () => {
    it("172.32.0.0", () => expect(isPrivateIp("172.32.0.0")).toBeFalsy());
  });
});

// ── checkPublicUrl — URL validation (no DNS) ─────────────────────────────────

describe("checkPublicUrl — URL-level rejections (no DNS)", () => {
  it("http:// → invalid_url", async () => {
    const r = await checkPublicUrl("http://example.com/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("invalid_url");
  });

  it("URL with credentials → invalid_url", async () => {
    const r = await checkPublicUrl("https://user:pass@example.com/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("invalid_url");
  });

  it("not-a-url → invalid_url", async () => {
    const r = await checkPublicUrl("not-a-url");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("invalid_url");
  });

  it("IP literal 127.0.0.1 → private_ip", async () => {
    const r = await checkPublicUrl("https://127.0.0.1/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("private_ip");
  });

  it("IP literal [::1] → private_ip", async () => {
    const r = await checkPublicUrl("https://[::1]/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("private_ip");
  });

  it("IP literal 192.168.1.1 → private_ip", async () => {
    const r = await checkPublicUrl("https://192.168.1.1/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("private_ip");
  });
});

// ── checkPublicUrl — DNS rebinding / NXDOMAIN (mocked) ───────────────────────
// Uses vi.spyOn on the already-imported dns.promises.lookup to intercept DNS
// resolution. vi.mock() inside it() is hoisted by vitest and cannot be used
// per-test; spyOn + restoreAllMocks is the correct pattern.

describe("checkPublicUrl — DNS resolution (mocked)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("NXDOMAIN (ENOTFOUND) → dns_notfound", async () => {
    vi.spyOn(dnsModule.promises, "lookup").mockRejectedValue(
      Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" })
    );
    const r = await checkPublicUrl("https://nxdomain.invalid/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("dns_notfound");
  });

  it("transient DNS error (EAI_AGAIN) → dns_error", async () => {
    vi.spyOn(dnsModule.promises, "lookup").mockRejectedValue(
      Object.assign(new Error("EAI_AGAIN"), { code: "EAI_AGAIN" })
    );
    const r = await checkPublicUrl("https://transient.example.com/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("dns_error");
  });

  it("DNS rebinding: resolves to private IP → private_ip", async () => {
    vi.spyOn(dnsModule.promises, "lookup").mockResolvedValue(
      [{ address: "10.0.0.1", family: 4 }] as Awaited<ReturnType<typeof dnsModule.promises.lookup>>
    );
    const r = await checkPublicUrl("https://rebind.example.com/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("private_ip");
  });

  it("multi-IP: one private IP → private_ip (all must be public)", async () => {
    vi.spyOn(dnsModule.promises, "lookup").mockResolvedValue(
      [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ] as Awaited<ReturnType<typeof dnsModule.promises.lookup>>
    );
    const r = await checkPublicUrl("https://multi-ip.example.com/hook");
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toBe("private_ip");
  });

  it("DNS resolves to public IP → safe=true with resolvedIp", async () => {
    vi.spyOn(dnsModule.promises, "lookup").mockResolvedValue(
      [{ address: "93.184.216.34", family: 4 }] as Awaited<ReturnType<typeof dnsModule.promises.lookup>>
    );
    const r = await checkPublicUrl("https://example.com/hook");
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.resolvedIp).toBe("93.184.216.34");
      expect(r.family).toBe(4);
    }
  });
});
