/**
 * MPP (Machine Payments Protocol) アダプターモジュール
 * mppx SDK を隔離し、zod@4 / zod@3 の型境界を分離する。
 * パターンは src/lib/x402/index.ts に準拠。
 * https://mpp.dev
 */

// CF Workers: per-request env を AsyncLocalStorage から取得 (x402/index.ts と同一パターン)
function getEnv(key: string): string | undefined {
  const cfCtx = (globalThis as Record<symbol, { env?: Record<string, string> } | undefined>)[
    Symbol.for("__cloudflare-context__")
  ];
  if (cfCtx?.env?.[key]) return cfCtx.env[key];
  return process.env[key];
}

/** Tempo token addresses */
export const TEMPO_PATHUSD_TESTNET: `0x${string}` = "0x20c0000000000000000000000000000000000000";
export const TEMPO_USDC_MAINNET: `0x${string}` = "0x20c000000000000000000000b9537d11c60e8b50";

/** MPP が有効かどうか */
export function isMppEnabled(): boolean {
  return getEnv("MPP_ENABLED") === "true";
}

function isTestnet(): boolean {
  return getEnv("MPP_TESTNET") !== "false";
}

function getSecretKey(): string {
  const key = getEnv("MPP_SECRET_KEY");
  if (!key) throw new Error("[mpp] MPP_SECRET_KEY is not set");
  return key;
}

function getRecipientAddress(): `0x${string}` {
  const addr = getEnv("MPP_RECIPIENT_ADDRESS");
  if (!addr) throw new Error("[mpp] MPP_RECIPIENT_ADDRESS is not set");
  if (!addr.startsWith("0x")) throw new Error("[mpp] MPP_RECIPIENT_ADDRESS must be 0x-prefixed");
  return addr as `0x${string}`;
}

function getCurrency(): `0x${string}` {
  return isTestnet() ? TEMPO_PATHUSD_TESTNET : TEMPO_USDC_MAINNET;
}

export interface MppChargeResult {
  /** true if payment credential was valid */
  paid: boolean;
  /** 402 challenge Response (only when paid=false) */
  challengeResponse?: Response;
  /** Tempo tx hash (only when paid=true) */
  txHash?: string;
  /** externalId echoed from the verified credential (for server-side scope validation) */
  verifiedExternalId?: string;
}

/**
 * MPP charge を実行する。
 * mppx SDK を dynamic import して CF Workers バンドルサイズを最小化。
 *
 * @param request - incoming HTTP request (Authorization: Payment header を含む可能性)
 * @param amountUsd - USD 建ての金額 (string, e.g. "0.50")
 * @returns MppChargeResult
 */
export async function createMppCharge(
  request: Request,
  amountUsd: string,
  resourceId?: string,
): Promise<MppChargeResult> {
  // Dynamic import to tree-shake mppx from client bundles
  // mppx/server exports: { Mppx (namespace with .create), tempo (function), stripe }
  const serverMod = await import("mppx/server");
  const { Mppx, tempo } = serverMod;

  const mppx = Mppx.create({
    methods: [
      ...tempo({
        currency: getCurrency(),
        recipient: getRecipientAddress(),
        testnet: isTestnet(),
      }),
    ],
    secretKey: getSecretKey(),
  });

  // tempo() returns [charge, session] tuple; mppx.tempo.charge is the charge handler
  const result = await mppx.tempo.charge({
    amount: amountUsd,
    description: resourceId ? `Knowledge item ${resourceId}` : undefined,
    externalId: resourceId,
  })(request);

  if (result.status === 402) {
    // result.challenge is the 402 Response with WWW-Authenticate header
    return { paid: false, challengeResponse: result.challenge };
  }

  // Payment succeeded — extract tx hash via withReceipt
  // The withReceipt function wraps a Response with Payment-Receipt header
  const wrappedResponse = result.withReceipt(new Response());
  const receiptHeader = wrappedResponse.headers.get("Payment-Receipt");
  let txHash: string | undefined;
  let verifiedExternalId: string | undefined;
  if (receiptHeader) {
    try {
      const decoded = JSON.parse(
        Buffer.from(receiptHeader, "base64url").toString("utf8"),
      ) as { reference?: string; externalId?: string; request?: { externalId?: string } };
      txHash = decoded.reference;
      // externalId may be at top level or nested in request
      verifiedExternalId = decoded.externalId ?? decoded.request?.externalId;
    } catch {
      console.warn("[mpp] Failed to parse Payment-Receipt:", receiptHeader.slice(0, 100));
    }
  }

  // Also try to extract externalId from the Authorization credential itself
  // mppx credential format: "Payment <base64url>" (NOT credential="...")
  if (!verifiedExternalId && resourceId) {
    try {
      const credHeader = request.headers.get("Authorization");
      if (credHeader?.startsWith("Payment ")) {
        const base64Part = credHeader.slice("Payment ".length).trim();
        if (base64Part) {
          const credDecoded = JSON.parse(
            Buffer.from(base64Part, "base64url").toString("utf8"),
          ) as { challenge?: { request?: { externalId?: string } }; request?: { externalId?: string } };
          verifiedExternalId =
            credDecoded.challenge?.request?.externalId ??
            credDecoded.request?.externalId;
        }
      }
    } catch {
      // Non-fatal; externalId validation will catch this downstream
    }
  }

  return { paid: true, txHash, verifiedExternalId };
}

/**
 * 402 レスポンスから MPP の WWW-Authenticate challenge ヘッダーを生成する。
 * Content route の combined 402 レスポンスで使用。
 */
export async function generateMppChallenge(
  request: Request,
  amountUsd: string,
  resourceId?: string,
): Promise<string | null> {
  try {
    const result = await createMppCharge(request, amountUsd, resourceId);
    if (!result.paid && result.challengeResponse) {
      return result.challengeResponse.headers.get("WWW-Authenticate");
    }
    return null;
  } catch (e) {
    console.error("[mpp] Failed to generate challenge:", e instanceof Error ? e.message : e);
    return null;
  }
}
