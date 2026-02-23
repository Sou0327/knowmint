/**
 * Sign-In With Solana (SIWS) — 署名対象メッセージビルダー
 *
 * challenge/route.ts と verify/route.ts の両方で使用する共通モジュール。
 * このファイルを変更するときは、既存の署名が無効になることを考慮すること。
 * (nonce が変わるため既存チャレンジは自動的に失効するので後方互換は問題なし)
 *
 * ## 設計判断: User ID を署名メッセージに含める理由
 * User ID (UUID) をメッセージに含めることで、署名が特定のアカウントに束縛される。
 * nonce はサーバ側の challenge 行で user_id と紐付いているため技術的には冗長だが、
 * 多層防御 (defense-in-depth) として維持する。
 * UUID は認証済み JWT に含まれる値であり、秘密情報ではない。
 * ウォレット UI に表示されることへの懸念がある場合は将来的に短命な challenge_id に置換可。
 *
 * ## 設計判断: 簡易フォーマット (CAIP-122 非準拠)
 * 完全な CAIP-122 / EIP-4361 準拠 (domain/uri/issuedAt/expirationTime 等) は
 * フィッシング耐性を高めるが、実装コストが大きい。
 * 現時点では nonce によるリプレイ防止と認証コンテキスト (withApiAuth) が
 * 十分なセキュリティ保証を提供する。CAIP-122 準拠は将来フェーズの改善項目とする。
 */
export function buildSiwsMessage(params: {
  wallet: string;
  userId: string;
  nonce: string;
}): string {
  return [
    "KnowMint wants you to prove ownership of your Solana wallet.",
    "",
    `Wallet: ${params.wallet}`,
    `User ID: ${params.userId}`,
    `Nonce: ${params.nonce}`,
    "",
    "By signing this message you confirm that you own this wallet.",
    "This request does not involve any transaction or transfer of funds.",
  ].join("\n");
}
