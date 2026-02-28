import { Connection, clusterApiUrl } from "@solana/web3.js";

const VALID_NETWORKS = ["mainnet-beta", "devnet", "testnet"] as const;
type SolanaNetwork = (typeof VALID_NETWORKS)[number];

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    const rawNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    const network: SolanaNetwork | undefined = rawNetwork && (VALID_NETWORKS as readonly string[]).includes(rawNetwork)
      ? (rawNetwork as SolanaNetwork)
      : undefined;

    if (rawNetwork && !network) {
      throw new Error(`Invalid NEXT_PUBLIC_SOLANA_NETWORK: "${rawNetwork}". Must be one of: ${VALID_NETWORKS.join(", ")}`);
    }

    if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL && !network && process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL or NEXT_PUBLIC_SOLANA_NETWORK must be set in production");
    }

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network || "devnet");
    connectionInstance = new Connection(rpcUrl, "confirmed");
  }
  return connectionInstance;
}

export function getNetwork(): string {
  const net = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (!net) {
    // RPC_URL が直接設定されている場合は network 名不要（custom RPC）
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return "custom";
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SOLANA_NETWORK must be set in production");
    }
    return "devnet";
  }
  return net;
}
