#!/usr/bin/env node
/**
 * Post-build patch: @vercel/og スタブ注入
 *
 * opennextjs-cloudflare build の後に実行。
 * .open-next/server-functions 内の standalone コピーに最小スタブを配置し、
 * wrangler (esbuild) が resvg.wasm / yoga.wasm を引き込まないようにする。
 *
 * 問題の構造:
 *   image-response.js → dynamic import('next/dist/compiled/@vercel/og/index.edge.js')
 *   → esbuild が WASM ファイルを追従してバンドルサイズが 3 MiB 超過
 */

import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const stubDir = join(
  root,
  ".open-next/server-functions/default/node_modules/next/dist/compiled/@vercel/og"
);

const stubContent = `\
"use strict";
// @vercel/og スタブ — WASM バンドル削減のため resvg/yoga を除外
Object.defineProperty(exports, "__esModule", { value: true });
class ImageResponse extends Response {
  constructor() { super("", { status: 500 }); }
}
exports.ImageResponse = ImageResponse;
`;

mkdirSync(stubDir, { recursive: true });
writeFileSync(join(stubDir, "index.edge.js"), stubContent, "utf8");
writeFileSync(join(stubDir, "index.node.js"), stubContent, "utf8");

console.log("✓ @vercel/og スタブを .open-next に注入しました");
