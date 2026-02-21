import { Connection, clusterApiUrl } from "@solana/web3.js";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  clusterApiUrl(
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "mainnet-beta" | "devnet" | "testnet") ||
      "devnet"
  );

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(RPC_URL, "confirmed");
  }
  return connectionInstance;
}

export function getNetwork(): string {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
}
