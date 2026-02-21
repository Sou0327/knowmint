import { parseEther, type Address } from "viem";

export function buildEthTransferParams(recipient: string, amountEth: number) {
  return {
    to: recipient as Address,
    value: parseEther(amountEth.toString()),
  };
}
