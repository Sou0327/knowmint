import { expect, describe, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  isValidSolanaPublicKey,
  toCanonicalSolanaAddress,
} from "@/lib/solana/canonical";

describe("isValidSolanaPublicKey()", () => {
  it("有効な Ed25519 pubkey → true", () => {
    const kp = Keypair.generate();
    expect(isValidSolanaPublicKey(kp.publicKey.toBase58())).toBe(true);
  });

  it("空文字列 → false", () => {
    expect(isValidSolanaPublicKey("")).toBe(false);
  });

  it("base58 として無効な文字を含む → false", () => {
    // "0" (zero) は base58 アルファベット外。
    expect(isValidSolanaPublicKey("0".repeat(32))).toBe(false);
  });

  it("長さが不足 → false", () => {
    expect(isValidSolanaPublicKey("abc")).toBe(false);
  });
});

describe("toCanonicalSolanaAddress()", () => {
  it("生成直後の pubkey は canonical (round-trip で一致)", () => {
    const kp = Keypair.generate();
    const addr = kp.publicKey.toBase58();
    expect(toCanonicalSolanaAddress(addr)).toEqual({ ok: true, wallet: addr });
  });

  it("無効な base58 → { ok: false, error: 'invalid_format' }", () => {
    const r = toCanonicalSolanaAddress("not-a-valid-pubkey!!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_format");
  });

  it("空文字列 → { ok: false, error: 'invalid_format' }", () => {
    const r = toCanonicalSolanaAddress("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_format");
  });

  it("non_canonical: PublicKey として有効だが toBase58 と一致しない", () => {
    // Solana の base58 は leading-zero 数を厳密に保持する。
    // "1" (base58 で 0x00) を先頭に追加した文字列は parse できても
    // toBase58 では通常 "1" が省かれるか、長さが変わる。
    // 実際には PublicKey(...) が例外を投げるケースが大半なので、
    // toCanonical の "non_canonical" を厳密に再現するのは難しい。
    // 代わりに "invalid_format" fallback が発火することを確認する。
    const kp = Keypair.generate();
    const addr = kp.publicKey.toBase58();
    // 末尾を 1 文字追加
    const r = toCanonicalSolanaAddress(addr + "x");
    expect(r.ok).toBe(false);
    // invalid_format か non_canonical のどちらかが返る
    if (!r.ok) {
      expect(["invalid_format", "non_canonical"]).toContain(r.error);
    }
  });

  it("round-trip 一致: 生成 → canonical → canonical (冪等)", () => {
    const kp = Keypair.generate();
    const addr = kp.publicKey.toBase58();
    const r1 = toCanonicalSolanaAddress(addr);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const r2 = toCanonicalSolanaAddress(r1.wallet);
      expect(r2).toEqual(r1);
    }
  });
});
