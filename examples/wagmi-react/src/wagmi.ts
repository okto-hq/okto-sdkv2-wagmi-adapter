import { okto } from '@okto_web3/wagmi-adapter';
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    okto({
      environment: import.meta.env.VITE_OKTO_ENVIRONMENT,
      clientSWA: import.meta.env.VITE_OKTO_CLIENT_SWA,
      clientPrivateKey: import.meta.env.VITE_OKTO_CLIENT_PRIVATE_KEY,
      googleClientId: import.meta.env.VITE_OKTO_GOOGLE_CLIENT_ID,
    }),
    injected(),
    coinbaseWallet(),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
