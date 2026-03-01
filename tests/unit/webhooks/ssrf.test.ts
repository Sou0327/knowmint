import { expect, describe, it } from "vitest";
import { isPrivateIp } from "@/lib/webhooks/ssrf";

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
});
