// @vercel/og スタブ — 未使用のため resvg.wasm/yoga.wasm のバンドルを防ぐ
// Turbopack resolveAlias で next/dist/compiled/@vercel/og/index.edge.js を差し替え
export class ImageResponse extends Response {
  constructor() {
    super("", { status: 500 });
  }
}
