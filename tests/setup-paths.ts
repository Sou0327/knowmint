/**
 * vitest.node.config.ts の setupFiles で読み込まれるセットアップ。
 * tsconfig-paths を登録し、require.resolve("@/...") が正しく解決できるようにする。
 */
import { register } from "tsconfig-paths";
import * as path from "path";

register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});
