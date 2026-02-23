import { http, createConfig } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { metaMask, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: "KnowMint" }),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});
