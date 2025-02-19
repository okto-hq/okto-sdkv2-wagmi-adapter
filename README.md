# Okto Wagmi Adapter

[`wagmi`](https://wagmi.sh/) adapter for [okto-sdk](https://docsv2.okto.tech/docs).

## Installation

```bash
npm i @okto_web3/wagmi-adapter
```

## Setup

### Configuration

Add `okto` connector to wagmi configuration.

````

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
````

### Layout Component

Add google sign-in script to the layout component (or equivalent file).

```html
<script src="https://accounts.google.com/gsi/client" async defer />
```

**Example**

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
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer />
      </head>
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

Use `wagmi` as you normally would!

## Schema

| Param              | Description                     | Type                          |
| ------------------ | ------------------------------- | ----------------------------- |
| `environment`      | Environement to use for the SDK | `sandbox` &#124; `production` |
| `clientPrivateKey` | Client private key              | `string`                      |
| `clientSWA`        | Client SWA                      | `string`                      |

---
