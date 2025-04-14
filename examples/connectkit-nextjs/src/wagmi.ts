import { okto, OktoParameters } from '@okto_web3/wagmi-adapter';
import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';

const oktoParams: OktoParameters = {
  environment: process.env.NEXT_PUBLIC_OKTO_ENVIRONMENT,
  clientPrivateKey: process.env.NEXT_PUBLIC_OKTO_CLIENT_PRIVATE_KEY,
  clientSWA: process.env.NEXT_PUBLIC_OKTO_CLIENT_SWA,
} as OktoParameters;

export const config = createConfig(
  getDefaultConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(),
    },
    connectors: [okto(oktoParams)],
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID as string,

    // enableFamily: false,
    appName: 'Okto Test App',
    appDescription: 'Your App Description',
    appUrl: 'https://family.co', // your app's url
    appIcon: 'https://family.co/logo.png', // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);
