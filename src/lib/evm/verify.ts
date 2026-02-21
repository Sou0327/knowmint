import { createPublicClient, http, type Address, type Chain } from "viem";
import { base, mainnet } from "viem/chains";

const chainMap: Record<string, Chain> = {
  base,
  ethereum: mainnet,
};

export async function verifyEVMTransaction(
  txHash: string,
  chain: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountWei: bigint
): Promise<{ verified: boolean; error?: string }> {
  const viemChain = chainMap[chain];
  if (!viemChain) {
    return { verified: false, error: `Unsupported chain: ${chain}` };
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(),
  });

  try {
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });

    if (!tx) {
      return { verified: false, error: "Transaction not found" };
    }

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== "success") {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    if (tx.from.toLowerCase() !== (expectedSender as Address).toLowerCase()) {
      return { verified: false, error: "Sender mismatch" };
    }

    if (tx.to?.toLowerCase() !== (expectedRecipient as Address).toLowerCase()) {
      return { verified: false, error: "Recipient mismatch" };
    }

    if (tx.value < expectedAmountWei) {
      return { verified: false, error: "Amount insufficient" };
    }

    return { verified: true };
  } catch {
    return { verified: false, error: "Failed to verify transaction" };
  }
}
