import { expect, describe, it } from "vitest";
import {
  computeProtocolFee,
  getTokenDecimals,
} from "@/lib/solana/fees";

describe("getTokenDecimals()", () => {
  it("SOL → 9", () => {
    expect(getTokenDecimals("SOL")).toBe(9);
  });

  it("USDC → 6", () => {
    expect(getTokenDecimals("USDC")).toBe(6);
  });
});

describe("computeProtocolFee()", () => {
  describe("hasFeeVault=false (コントラクト未デプロイ) → 0% 徴収", () => {
    it("SOL 1.0 → 0", () => {
      expect(computeProtocolFee(1.0, "SOL", false)).toBe(0);
    });

    it("USDC 100 → 0", () => {
      expect(computeProtocolFee(100, "USDC", false)).toBe(0);
    });

    it("0 → 0", () => {
      expect(computeProtocolFee(0, "SOL", false)).toBe(0);
    });
  });

  describe("hasFeeVault=true → 5% 徴収", () => {
    it("SOL 1.0 → 0.05", () => {
      // atomicTotal = 1_000_000_000 lamports
      // sellerAtomic = floor(1_000_000_000 * 9500 / 10000) = 950_000_000
      // feeAtomic = 50_000_000 = 0.05 SOL
      expect(computeProtocolFee(1.0, "SOL", true)).toBeCloseTo(0.05, 9);
    });

    it("USDC 100 → 5.0", () => {
      // atomicTotal = 100_000_000 (6 decimals)
      // sellerAtomic = floor(100_000_000 * 9500 / 10000) = 95_000_000
      // feeAtomic = 5_000_000 = 5.0 USDC
      expect(computeProtocolFee(100, "USDC", true)).toBeCloseTo(5.0, 6);
    });

    it("SOL 10.0 → 0.5", () => {
      expect(computeProtocolFee(10, "SOL", true)).toBeCloseTo(0.5, 9);
    });

    it("USDC 1 → 0.05", () => {
      expect(computeProtocolFee(1, "USDC", true)).toBeCloseTo(0.05, 6);
    });
  });

  describe("境界値", () => {
    it("最小 atomic 単位 SOL: 1 lamport → fee は 0 (floor で seller 取得)", () => {
      // amount = 1 lamport = 1e-9 SOL
      // atomicTotal = 1
      // sellerAtomic = floor(1 * 0.95) = 0
      // feeAtomic = 1 → fee = 1e-9
      const fee = computeProtocolFee(1e-9, "SOL", true);
      // 正確には 1 lamport (1e-9) が fee として徴収される
      expect(fee).toBeCloseTo(1e-9, 12);
    });

    it("最小 atomic 単位 USDC: 1 unit (1e-6) → fee は 1e-6", () => {
      const fee = computeProtocolFee(1e-6, "USDC", true);
      // atomicTotal = 1, sellerAtomic = 0, feeAtomic = 1
      expect(fee).toBeCloseTo(1e-6, 9);
    });

    it("amount=0 → 0", () => {
      expect(computeProtocolFee(0, "SOL", true)).toBe(0);
      expect(computeProtocolFee(0, "USDC", true)).toBe(0);
    });

    it("負の amount → 0 (Finite チェック)", () => {
      expect(computeProtocolFee(-1, "SOL", true)).toBe(0);
    });

    it("NaN → 0", () => {
      expect(computeProtocolFee(NaN, "SOL", true)).toBe(0);
    });

    it("Infinity → 0 (Finite チェック)", () => {
      expect(computeProtocolFee(Infinity, "SOL", true)).toBe(0);
    });
  });

  describe("オンチェーン丸めとの整合性", () => {
    it("SOL 0.1 → fee は atomicTotal - sellerAtomic を正確に計算", () => {
      // atomicTotal = 100_000_000
      // sellerAtomic = floor(100_000_000 * 9500 / 10000) = 95_000_000
      // feeAtomic = 5_000_000 = 0.005 SOL
      expect(computeProtocolFee(0.1, "SOL", true)).toBeCloseTo(0.005, 9);
    });

    it("USDC 12.345678 → 正確な atomic 計算", () => {
      // atomicTotal = 12_345_678
      // sellerAtomic = floor(12_345_678 * 9500 / 10000) = 11_728_394 (.1 → floor)
      // feeAtomic = 617_284 = 0.617284
      expect(computeProtocolFee(12.345678, "USDC", true)).toBeCloseTo(
        0.617284,
        6,
      );
    });
  });
});
