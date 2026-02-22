#!/usr/bin/env node
/**
 * Devnet テスト用キーペア生成スクリプト (Phase 15.3)
 *
 * 使用方法:
 *   node scripts/e2e/devnet-setup.mjs
 *
 * 生成した pubkey と keypair パスを .env.test に設定すること
 */

import { Keypair } from "@solana/web3.js";
import { writeFileSync, chmodSync, existsSync } from "fs";
import { resolve } from "path";

const buyerPath = resolve(process.cwd(), "devnet-buyer-keypair.json");
const sellerPath = resolve(process.cwd(), "devnet-seller-keypair.json");

// 上書き防止: どちらかのファイルが既存の場合は終了
if (existsSync(buyerPath) || existsSync(sellerPath)) {
  if (existsSync(buyerPath)) {
    console.error(`ERROR: ${buyerPath} already exists.`);
  }
  if (existsSync(sellerPath)) {
    console.error(`ERROR: ${sellerPath} already exists.`);
  }
  console.error("Delete them manually if you intend to rotate the devnet keypairs.");
  process.exit(1);
}

const buyerKeypair = Keypair.generate();
const sellerKeypair = Keypair.generate();

const buyerPubkey = buyerKeypair.publicKey.toBase58();
const sellerPubkey = sellerKeypair.publicKey.toBase58();

writeFileSync(buyerPath, JSON.stringify(Array.from(buyerKeypair.secretKey)));
chmodSync(buyerPath, 0o600);

writeFileSync(sellerPath, JSON.stringify(Array.from(sellerKeypair.secretKey)));
chmodSync(sellerPath, 0o600);

console.log("=== Devnet Keypairs Generated ===");
console.log(`Buyer  Public Key: ${buyerPubkey}`);
console.log(`Seller Public Key: ${sellerPubkey}`);
console.log("");
console.log("=== Airdrop SOL (devnet) ===");
console.log(`solana airdrop 2 ${buyerPubkey} --url devnet`);
console.log(`solana airdrop 2 ${sellerPubkey} --url devnet`);
console.log("");
console.log("=== Add to .env.test ===");
console.log(`TEST_BUYER_WALLET=${buyerPubkey}`);
console.log(`TEST_SELLER_WALLET=${sellerPubkey}`);
console.log(`TEST_BUYER_KEYPAIR_PATH=./devnet-buyer-keypair.json`);
console.log(`TEST_SELLER_KEYPAIR_PATH=./devnet-seller-keypair.json`);
