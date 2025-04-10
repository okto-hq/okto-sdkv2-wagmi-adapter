import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  ledgerWallet,
  phantomWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [rainbowWallet, injectedWallet, phantomWallet, ledgerWallet],
    },
  ],
  {
    appName: 'My RainbowKit App',
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID as string,
  },
);

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  multiInjectedProviderDiscovery: false,
});
