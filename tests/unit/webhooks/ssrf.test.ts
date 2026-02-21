import * as assert from "node:assert/strict";
import { describe, it } from "mocha";
import { isPrivateIp } from "@/lib/webhooks/ssrf";

describe("isPrivateIp()", () => {
  describe("プライベート IPv4 → true", () => {
    it("127.0.0.1 (loopback)", () => assert.ok(isPrivateIp("127.0.0.1")));
    it("10.0.0.1", () => assert.ok(isPrivateIp("10.0.0.1")));
    it("192.168.1.1", () => assert.ok(isPrivateIp("192.168.1.1")));
    it("172.16.0.1", () => assert.ok(isPrivateIp("172.16.0.1")));
    it("172.31.255.255", () => assert.ok(isPrivateIp("172.31.255.255")));
  });

  describe("CGNAT → true", () => {
    it("100.64.0.1", () => assert.ok(isPrivateIp("100.64.0.1")));
    it("100.127.255.255", () => assert.ok(isPrivateIp("100.127.255.255")));
  });

  describe("CGNAT 外 → false", () => {
    it("100.128.0.0", () => assert.ok(!isPrivateIp("100.128.0.0")));
  });

  describe("link-local → true", () => {
    it("169.254.0.1", () => assert.ok(isPrivateIp("169.254.0.1")));
  });

  describe("パブリック IPv4 → false", () => {
    it("8.8.8.8", () => assert.ok(!isPrivateIp("8.8.8.8")));
    it("1.1.1.1", () => assert.ok(!isPrivateIp("1.1.1.1")));
  });

  describe("プライベート IPv6 → true", () => {
    it("::1 (loopback)", () => assert.ok(isPrivateIp("::1")));
    it("fc00::1 (ULA)", () => assert.ok(isPrivateIp("fc00::1")));
    it("fd00::1 (ULA)", () => assert.ok(isPrivateIp("fd00::1")));
    it("fe80::1 (link-local)", () => assert.ok(isPrivateIp("fe80::1")));
  });

  describe("パブリック IPv6 → false", () => {
    it("2001:4860:4860::8888 (Google DNS)", () =>
      assert.ok(!isPrivateIp("2001:4860:4860::8888")));
  });

  describe("malformed → true (fail-safe)", () => {
    it("not-an-ip", () => assert.ok(isPrivateIp("not-an-ip")));
  });
});
