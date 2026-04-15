/**
 * SIWS challenge message builder — mirrors
 * `src/lib/siws/auth-message.ts` from the main Next.js app.
 *
 * The message is part of the signature oracle defense: the client rebuilds
 * the expected message from `{wallet, nonce, purpose}` and compares byte-for-byte
 * against whatever the server returned. Any drift between this function and
 * the server-side `buildAuthMessage` is a critical security bug, so keep them
 * in lockstep.
 */

export type SiwsPurpose = "register" | "login";

export interface BuildAuthMessageParams {
  wallet: string;
  nonce: string;
  purpose: SiwsPurpose;
}

/**
 * Build the expected KnowMint wallet-auth challenge message.
 *
 * NOTE: This implementation must stay byte-identical with
 * `src/lib/siws/auth-message.ts` and `cli/lib/siws.mjs`. Tests enforce the
 * invariant via string comparison.
 */
export function buildAuthMessage(params: BuildAuthMessageParams): string {
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

/**
 * Verify that the server's challenge message matches the expected template.
 * Throws when the message has been tampered with — defeats signature-oracle
 * attacks where a hostile server would trick the wallet into signing an
 * arbitrary payload.
 */
export function validateChallengeMessage(
  message: string,
  wallet: string,
  nonce: string,
  purpose: SiwsPurpose
): void {
  const expected = buildAuthMessage({ wallet, nonce, purpose });
  if (message !== expected) {
    throw new Error(
      "Challenge message does not match expected format. Server may be compromised."
    );
  }
}
