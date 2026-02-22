/**
 * x402 互換ユーティリティ
 * HTTP 402 Payment Required の x402 プロトコル互換実装
 * https://x402.org
 */

/** CAIP-2 Solana ネットワーク識別子 */
export const SOLANA_DEVNET_NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const SOLANA_MAINNET_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** USDC SPL mint アドレス */
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/** 許可 CAIP-2 network → USDC mint の厳密マッピング */
const NETWORK_USDC_MINT: Readonly<Record<string, string>> = {
  [SOLANA_MAINNET_NETWORK]: USDC_MINT_MAINNET,
  [SOLANA_DEVNET_NETWORK]: USDC_MINT_DEVNET,
};

export function getNetwork(): string {
  const network = process.env.X402_NETWORK;
  // fail-close: 未設定・不正値は例外で停止。devnet へのフォールバックは行わない
  if (!network || !Object.hasOwn(NETWORK_USDC_MINT, network)) {
    throw new Error(
      `[x402] X402_NETWORK is not set or invalid: "${network}". ` +
        `Set to "${SOLANA_MAINNET_NETWORK}" or "${SOLANA_DEVNET_NETWORK}".`
    );
  }
  return network;
}

/**
 * decimal → atomic 変換 helper。
 * toFixed ベースで verify-transaction.ts の decimalToAtomic と同一ロジック。
 * buildX402Body() と route.ts の両方から使用して丸め境界の一致を保証する。
 */
export function priceToAtomic(amount: number, decimals: number): bigint {
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  return BigInt(`${whole}${frac.padEnd(decimals, "0").slice(0, decimals)}`);
}

/** 許可された CAIP-2 network かどうかを検証する (mainnet / devnet のみ) */
export function isSupportedNetwork(network: string): boolean {
  // prototype pollution 対策: hasOwn で自身のキーのみ許可
  return Object.hasOwn(NETWORK_USDC_MINT, network);
}

/**
 * 指定 CAIP-2 network に対応する USDC mint アドレスを返す。
 * 未知の network は undefined を返し、USDC を提供しない。
 * prototype pollution 対策のため hasOwn チェック後に lookup する。
 */
export function getUsdcMintForNetwork(network: string): string | undefined {
  return Object.hasOwn(NETWORK_USDC_MINT, network)
    ? NETWORK_USDC_MINT[network]
    : undefined;
}

/** once ガード: プロセス内で一度だけチェックを実行 */
let _networkConsistencyChecked = false;
let _networkConsistent = true;

/**
 * X402_NETWORK と NEXT_PUBLIC_SOLANA_NETWORK の整合チェック。
 * プロセス内で初回のみ実行し、結果をキャッシュして返す。
 * @returns true = 設定一致 / false = 設定不一致（呼び出し側は 500 を返すべき）
 */
export function checkNetworkConsistency(): boolean {
  if (_networkConsistencyChecked) return _networkConsistent;
  _networkConsistencyChecked = true;
  const x402Net = process.env.X402_NETWORK;
  // X402_NETWORK 未設定・許可リスト外は即 false (devnet へのフォールバックなし)
  if (!x402Net || !isSupportedNetwork(x402Net)) {
    console.error(
      `[x402] X402_NETWORK is not set or invalid: "${x402Net}". ` +
        `Must be "${SOLANA_MAINNET_NETWORK}" or "${SOLANA_DEVNET_NETWORK}".`
    );
    _networkConsistent = false;
    return _networkConsistent;
  }
  const solNet = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  // NEXT_PUBLIC_SOLANA_NETWORK も許可リストで厳密検証 (testnet/不正値を fail-close)
  const ALLOWED_SOL_NETWORKS = new Set(["mainnet-beta", "devnet"]);
  if (!solNet || !ALLOWED_SOL_NETWORKS.has(solNet)) {
    console.error(
      `[x402] Invalid NEXT_PUBLIC_SOLANA_NETWORK="${solNet}". ` +
        `Must be "mainnet-beta" or "devnet".`
    );
    _networkConsistent = false;
    return _networkConsistent;
  }
  const x402IsMainnet = x402Net === SOLANA_MAINNET_NETWORK;
  const solIsMainnet = solNet === "mainnet-beta";
  if (x402IsMainnet !== solIsMainnet) {
    console.error(
      `[x402] CRITICAL: Network mismatch — X402_NETWORK=${x402Net} vs ` +
        `NEXT_PUBLIC_SOLANA_NETWORK=${solNet}. Payment verification will fail. ` +
        "Check environment variables."
    );
    _networkConsistent = false;
    return _networkConsistent;
  }
  // NEXT_PUBLIC_SOLANA_RPC_URL から known クラスタパターンで cross-check
  // new URL() でパース後、hostname+pathname に境界正規表現を適用して誤検知を防ぐ
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
  if (rpcUrl) {
    try {
      const { hostname, pathname } = new URL(rpcUrl);
      const urlTarget = `${hostname}${pathname}`.toLowerCase();
      const rpcLooksMainnet = /\bmainnet\b/.test(urlTarget);
      const rpcLooksDevnet = /\bdevnet\b/.test(urlTarget);
      if (rpcLooksMainnet && rpcLooksDevnet) {
        // 両方含む → 判定不能、warning のみ
        console.warn(
          `[x402] Ambiguous cluster in NEXT_PUBLIC_SOLANA_RPC_URL="${rpcUrl}". ` +
            "Ensure it matches NEXT_PUBLIC_SOLANA_NETWORK."
        );
      } else if (rpcLooksMainnet || rpcLooksDevnet) {
        // 一方のみ明確 → 不整合を fail-close
        if ((rpcLooksMainnet && !solIsMainnet) || (rpcLooksDevnet && solIsMainnet)) {
          console.error(
            `[x402] RPC cluster mismatch — NEXT_PUBLIC_SOLANA_RPC_URL="${rpcUrl}" ` +
              `is inconsistent with NEXT_PUBLIC_SOLANA_NETWORK="${solNet}". ` +
              "Check environment variables."
          );
          _networkConsistent = false;
        }
      } else {
        // 判定不能 → warning のみ
        console.warn(
          `[x402] Cannot determine cluster from NEXT_PUBLIC_SOLANA_RPC_URL="${rpcUrl}". ` +
            "Ensure it matches NEXT_PUBLIC_SOLANA_NETWORK."
        );
      }
    } catch {
      console.warn(`[x402] Invalid NEXT_PUBLIC_SOLANA_RPC_URL="${rpcUrl}". Skipping cluster check.`);
    }
  }
  return _networkConsistent;
}

/** x402 accepts エントリ */
export interface X402Accept {
  scheme: "exact";
  network: string;
  /** atomic units (SOL: lamports / USDC: 1e-6) */
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  /** 売り手のウォレットアドレス */
  payTo: string;
  maxTimeoutSeconds: number;
  /** "native" = SOL, mint アドレス = SPL トークン */
  asset: string;
}

/** x402 HTTP 402 レスポンスボディ */
export interface X402Body {
  x402Version: 1;
  accepts: X402Accept[];
  error?: string;
}

/**
 * x402 互換の 402 レスポンスボディを生成する
 */
export function buildX402Body(params: {
  resourceUrl: string;
  description: string;
  price_sol: number | null;
  price_usdc: number | null;
  sellerAddress: string;
  error?: string;
}): X402Body {
  const network = getNetwork();
  const accepts: X402Accept[] = [];

  if (params.price_sol != null && params.price_sol > 0) {
    const lamports = priceToAtomic(params.price_sol, 9);
    // 0 atomic は浮動小数点誤差による無料決済を防ぐため省略
    if (lamports >= BigInt(1)) {
      accepts.push({
        scheme: "exact",
        network,
        maxAmountRequired: String(lamports),
        resource: params.resourceUrl,
        description: params.description,
        mimeType: "application/json",
        payTo: params.sellerAddress,
        maxTimeoutSeconds: 300,
        asset: "native",
      });
    }
  }

  if (params.price_usdc != null && params.price_usdc > 0) {
    const usdcAtomic = priceToAtomic(params.price_usdc, 6);
    const usdcMint = getUsdcMintForNetwork(network);
    if (!usdcMint) {
      // price_usdc が設定されているのに mint を解決できない = 設定不備
      console.error(`[x402] USDC not supported for network: ${network}. Check X402_NETWORK env var.`);
    } else if (usdcAtomic >= BigInt(1)) {
      // 0 atomic は省略
      accepts.push({
        scheme: "exact",
        network,
        maxAmountRequired: String(usdcAtomic),
        resource: params.resourceUrl,
        description: params.description,
        mimeType: "application/json",
        payTo: params.sellerAddress,
        maxTimeoutSeconds: 300,
        asset: usdcMint,
      });
    }
  }

  const body: X402Body = { x402Version: 1, accepts };
  if (params.error) body.error = params.error;
  return body;
}

/** X-PAYMENT ヘッダーのパース結果 */
export interface ParsedXPayment {
  txHash: string;
  network: string;
  scheme: string;
  /** "native" = SOL, mint アドレス = SPL トークン。省略時は "native" に正規化済み */
  asset: string;
}

/**
 * X-PAYMENT ヘッダーをパースして支払い情報を抽出する
 *
 * 期待フォーマット (base64 エンコード JSON):
 * {
 *   scheme: "exact",
 *   network: "solana:...",
 *   payload: { txHash: "<signature>", asset?: "native" | "<mint>" }
 * }
 *
 * payload なし (フラット) フォーマットにも対応:
 * { scheme, network, txHash, asset? }
 */
/** X-PAYMENT ヘッダーの最大許容文字数 (base64 文字列の長さ) */
const MAX_X_PAYMENT_HEADER_CHARS = 2048;

export function parseXPaymentHeader(header: string): ParsedXPayment | null {
  try {
    const trimmed = header.trim();
    // サイズ制限: 過大なヘッダーによる CPU/メモリ攻撃を防ぐ
    if (trimmed.length > MAX_X_PAYMENT_HEADER_CHARS) return null;
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    const obj = JSON.parse(decoded) as Record<string, unknown>;

    const scheme = typeof obj["scheme"] === "string" ? obj["scheme"] : null;
    const network = typeof obj["network"] === "string" ? obj["network"] : null;

    // payload ネストあり / フラット両対応
    const payload = (
      obj["payload"] != null && typeof obj["payload"] === "object"
        ? obj["payload"]
        : obj
    ) as Record<string, unknown>;

    const txHash =
      typeof payload["txHash"] === "string" ? payload["txHash"] : null;
    // asset 未指定は "native" (SOL) としてデフォルト化（後方互換性維持）
    const asset =
      typeof payload["asset"] === "string" ? payload["asset"] : "native";

    if (!scheme || !network || !txHash) return null;
    return { txHash, network, scheme, asset };
  } catch {
    return null;
  }
}
