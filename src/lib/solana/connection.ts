import { Connection, clusterApiUrl } from "@solana/web3.js";

const VALID_NETWORKS = ["mainnet-beta", "devnet", "testnet"] as const;
type SolanaNetwork = (typeof VALID_NETWORKS)[number];

// NEXT_PUBLIC_* は Next.js がビルド時にインライン化するため runtime 上書き不可。
// サーバーサイド専用の SOLANA_RPC_URL / SOLANA_NETWORK を優先する。
//
// CF Workers の warm isolate は opennextjs-cloudflare の `initialized` フラグにより
// secret 更新後も stale な process.env を保持する。
// そのため Cloudflare context (AsyncLocalStorage) から直接 env を読む。
// 非 CF 環境では process.env にフォールバック。

// Next.js は NEXT_PUBLIC_* をリテラル参照でのみビルド時インライン化する。
// process.env[key] の動的参照はクライアントバンドルで undefined になるため、
// 静的参照をオブジェクトに保持してフォールバックに使う。
const NEXT_PUBLIC_STATIC: Record<string, string | undefined> = {
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
};

function getEnv(key: string): string | undefined {
  // CF Workers: per-request の最新 env を AsyncLocalStorage から取得
  const cfCtx = (globalThis as Record<symbol, { env?: Record<string, string> } | undefined>)[
    Symbol.for("__cloudflare-context__")
  ];
  if (cfCtx?.env?.[key]) return cfCtx.env[key];
  // Client-side: 静的参照 (Next.js ビルド時インライン済み)
  if (key in NEXT_PUBLIC_STATIC) return NEXT_PUBLIC_STATIC[key];
  // Server-side: 動的参照
  return process.env[key];
}

export function getConnection(): Connection {
  const rawNetwork = getEnv("SOLANA_NETWORK") || getEnv("NEXT_PUBLIC_SOLANA_NETWORK");
  const network: SolanaNetwork | undefined = rawNetwork && (VALID_NETWORKS as readonly string[]).includes(rawNetwork)
    ? (rawNetwork as SolanaNetwork)
    : undefined;

  if (rawNetwork && !network) {
    throw new Error(`Invalid SOLANA_NETWORK: "${rawNetwork}". Must be one of: ${VALID_NETWORKS.join(", ")}`);
  }

  const rpcUrl = getEnv("SOLANA_RPC_URL") || getEnv("NEXT_PUBLIC_SOLANA_RPC_URL");

  if (!rpcUrl && !network && process.env.NODE_ENV === "production") {
    throw new Error("SOLANA_RPC_URL or SOLANA_NETWORK must be set in production");
  }

  return new Connection(rpcUrl || clusterApiUrl(network || "devnet"), "confirmed");
}

export function getNetwork(): string {
  const net = getEnv("SOLANA_NETWORK") || getEnv("NEXT_PUBLIC_SOLANA_NETWORK");
  if (!net) {
    if (getEnv("SOLANA_RPC_URL") || getEnv("NEXT_PUBLIC_SOLANA_RPC_URL")) {
      return "custom";
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("SOLANA_NETWORK must be set in production");
    }
    return "devnet";
  }
  return net;
}
