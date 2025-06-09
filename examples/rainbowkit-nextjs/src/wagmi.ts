import { getOktoSdkConnector, OktoParameters } from '@okto_web3/wagmi-adapter';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  ledgerWallet,
  phantomWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { arbitrum, base, polygon } from 'wagmi/chains';

const oktoParams: OktoParameters = {
  environment: process.env.NEXT_PUBLIC_OKTO_ENVIRONMENT,
  clientPrivateKey: process.env.NEXT_PUBLIC_OKTO_CLIENT_PRIVATE_KEY,
  clientSWA: process.env.NEXT_PUBLIC_OKTO_CLIENT_SWA,
} as OktoParameters;

const connectors = connectorsForWallets(
  [
    {
      groupName: ' Social Login',
      wallets: [
        getOktoSdkConnector({
          type: 'google',
          params: oktoParams,
        }),
        getOktoSdkConnector({
          type: 'generic',
          params: oktoParams,
        }),
      ],
    },
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
  chains: [arbitrum, base, polygon],
  connectors: connectors,
  transports: {
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
});
