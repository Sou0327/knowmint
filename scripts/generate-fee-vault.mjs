#!/usr/bin/env node
/**
 * Fee Vault キーペア生成スクリプト (devnet 用)
 *
 * 使用方法:
 *   node scripts/generate-fee-vault.mjs
 *
 * 生成した pubkey を .env.local の NEXT_PUBLIC_FEE_VAULT_ADDRESS に設定すること
 */

import { Keypair } from "@solana/web3.js";
import { writeFileSync, chmodSync, existsSync } from "fs";
import { resolve } from "path";

const outputPath = resolve(process.cwd(), "fee-vault-keypair.json");

// 上書き防止: 既存ファイルがある場合は終了
if (existsSync(outputPath)) {
  console.error(`ERROR: ${outputPath} already exists.`);
  console.error("Delete it manually if you intend to rotate the Fee Vault keypair.");
  process.exit(1);
}

const keypair = Keypair.generate();
const pubkey = keypair.publicKey.toBase58();
const secretKey = Array.from(keypair.secretKey);

writeFileSync(outputPath, JSON.stringify(secretKey));
// 秘密鍵ファイルはオーナーのみ読み書き可能に設定 (Unix: 600)
chmodSync(outputPath, 0o600);

console.log("=== Fee Vault Keypair Generated ===");
console.log(`Public Key: ${pubkey}`);
console.log(`Keypair saved to: ${outputPath}`);
console.log("");
console.log("=== Next Steps ===");
console.log("1. Add to .env.local:");
console.log(`   NEXT_PUBLIC_FEE_VAULT_ADDRESS=${pubkey}`);
console.log("");
console.log("2. Fund the account on devnet:");
console.log(`   solana airdrop 1 ${pubkey} --url devnet`);
console.log("");
console.log("3. Update FEE_VAULT_PUBKEY in programs/knowledge-market/src/lib.rs:");
const bytes = Array.from(keypair.publicKey.toBytes());
console.log(`   const FEE_VAULT_PUBKEY: Pubkey = Pubkey::new_from_array([`);
console.log(`       ${bytes.join(", ")}`);
console.log(`   ]);`);
console.log("");
console.log("4. Keep fee-vault-keypair.json secret! It is in .gitignore.");
