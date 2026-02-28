/**
 * エージェント自律オンボーディング用 — 署名対象メッセージビルダー
 *
 * 既存 buildSiwsMessage は userId 必須 (defense-in-depth)。
 * register/login は userId がない段階で使うため、別関数として分離。
 *
 * メッセージに purpose を含めることで register/login 間のリプレイを防止。
 */
export function buildAuthMessage(params: {
  wallet: string;
  nonce: string;
  purpose: "register" | "login";
}): string {
  const action =
    params.purpose === "register"
      ? "register a new account with"
      : "log in with";
  return [
    `KnowMint wants you to ${action} your Solana wallet.`,
    "",
    `Wallet: ${params.wallet}`,
    `Nonce: ${params.nonce}`,
    "",
    "By signing this message you confirm that you own this wallet.",
    "This request does not involve any transaction or transfer of funds.",
  ].join("\n");
}
