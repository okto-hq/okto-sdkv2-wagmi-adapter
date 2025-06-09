# Okto Wagmi Adapter

This package provides an adapter for the Okto SDK to be used with the [Wagmi](https://wagmi.sh/) library. It allows you to easily integrate Okto's authentication and wallet management features into your web3 applications.
The connector is designed to work seamlessly with the Wagmi library, providing a simple and efficient way to manage user authentication and wallet connections.

Refer to the [Okto SDK documentation](https://docs.okto.tech/) for more information on how to use the Okto SDK.

## Installation

```bash
npm i @okto_web3/wagmi-adapter@latest @okto_web3/react-sdk@latest
```

## Setup

### Configuration

Add `okto` connector to wagmi configuration.

**Example**

```typescript
import { okto } from '@okto_web3/wagmi-adapter';
import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { mainnet, optimism, polygon } from 'wagmi/chains';

export function getConfig() {
  return createConfig({
    chains: [polygon],
    connectors: [
      okto({
        environment: 'sandbox',
        clientPrivateKey: '0xprivatekey',
        clientSWA: '0xswa',
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [polygon.id]: http(),
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
```

```tsx
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { cookieToInitialState } from 'wagmi';
import { getConfig } from '../wagmi';

export default async function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    getConfig(),
    (await headers()).get('cookie'),
  );

  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config} initialState={initialState}>
          <QueryClientProvider client={queryClient}>
            {props.children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
```

## Usage

Use `wagmi` as you normally would! Refer to the [wagmi documentation](https://wagmi.sh/react/getting-started) for more information on how to use wagmi.

## Schema

| Param              | Description                     | Type      |
| ------------------ | ------------------------------- | --------- |
| `environment`      | Environement to use for the SDK | `sandbox` |
| `clientPrivateKey` | Client private key              | `string`  |
| `clientSWA`        | Client SWA                      | `string`  |

---

## RainbowKit Integration

To use the Okto connector with RainbowKit, you can use the `getOktoSdkConnector` function to create a connector for the Okto SDK. This function takes an object with the following properties:

- `type`: The type of Okto connector you want to create. This can be either `'google'` or `'generic'`. (More will be added in the future)
- `params`: An object containing the Okto SDK parameters. This should include the `environment`, `clientPrivateKey`, and `clientSWA` properties.

Use the `getOktoSdkConnector` function to create a connectors object for RainbowKit. You can then pass this object to the `connectors` property of the RainbowKit configuration.

Refer to the [RainbowKit documentation](https://www.rainbowkit.com/docs/custom-wallet-list) for more information on how to set up connectors.

### Example

```tsx
import { getOktoSdkConnector, OktoParameters } from '@okto_web3/wagmi-adapter';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { mainnet, optimism, polygon } from 'wagmi/chains';

const oktoParams: OktoParameters = {
  environment: 'sandbox',
  clientPrivateKey: '0xprivatekey',
  clientSWA: '0xswa',
};

// create a 'Social Login' group in rainbowkit config connectors list
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Social Login',
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
  ],
  {
    appName: 'My Okto Rainbowkit App',
    projectId: 'xxx',
  },
);

export const config = createConfig({
  chains: [mainnet, optimism, polygon],
  connectors: connectors,
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});
```

---
