import type { PublicKey } from "@solana/web3.js";
import type { Chain, Token } from "./database.types";

export interface WalletContextType {
  connected: boolean;
  publicKey: PublicKey | null;
  address: string | null;
  balance: number | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface PaymentRequest {
  recipient: string;
  amount: number;
  token: Token;
  chain: Chain;
  reference?: string;
}

export interface PaymentResult {
  success: boolean;
  tx_hash: string | null;
  error?: string;
}

// EVM chain types
export type EVMChain = 'base' | 'ethereum';

export type ChainType = 'solana' | EVMChain;

export interface ChainInfo {
  id: ChainType;
  name: string;
  icon: string;
  nativeToken: string;
  chainId?: number; // EVM chain ID
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: 'solana', name: 'Solana', icon: 'SOL', nativeToken: 'SOL' },
  { id: 'base', name: 'Base', icon: 'BASE', nativeToken: 'ETH', chainId: 8453 },
  { id: 'ethereum', name: 'Ethereum', icon: 'ETH', nativeToken: 'ETH', chainId: 1 },
];
