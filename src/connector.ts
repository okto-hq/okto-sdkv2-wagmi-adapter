import type { OktoClientConfig } from '@okto_web3/core-js-sdk';
import {
  ChainNotConfiguredError,
  type Connector,
  ProviderNotFoundError,
  createConnector,
} from '@wagmi/core';
import type { Compute } from '@wagmi/core/internal';
import { SwitchChainError, getAddress } from 'viem';
import { OktoClient } from './client.js';
import { OktoProvider } from './provider.js';

export type OktoParameters = Compute<
  OktoClientConfig & {
    /**
     * Connector automatically connects when used as Okto App.
     *
     * This flag simulates the disconnect behavior by keeping track of connection status in storage
     * and only autoconnecting when previously connected by user action (e.g. explicitly choosing to connect).
     *
     * @default false
     */
    shimDisconnect?: boolean | undefined;
    googleClientId?: string | undefined;
  }
>;

okto.type = 'okto' as const;
export function okto(parameters: OktoParameters) {
  const {
    shimDisconnect = false,
    environment,
    clientPrivateKey,
    clientSWA,
  } = parameters;
  let { googleClientId } = parameters;

  if (!googleClientId) {
    googleClientId =
      '1046271521155-0m453poi5gua03kehdcn5uon1vvu5u9j.apps.googleusercontent.com';
  }

  type Provider = OktoProvider | undefined;
  type Properties = Record<string, unknown>;

  //TODO: Can be used to maintain chainId in storage
  type StorageItem = {
    'okto.disconnected': true;
    'okto.currentChain': string;
  };

  let provider_: Provider | undefined;

  let accountsChanged: Connector['onAccountsChanged'] | undefined;
  let chainChanged: Connector['onChainChanged'] | undefined;
  let disconnect: Connector['onDisconnect'] | undefined;

  const getGoogleIdToken = () => {
    return new Promise<string>((resolve, reject) => {
      const google = (window as any).google;
      if (!google) {
        reject(new Error('Google Sign-In SDK not loaded'));
        return;
      }

      google.accounts.id.initialize({
        client_id: googleClientId,
        auto_select: false,
        callback: (response: any) => {
          if (response.credential) {
            // Using credential directly as it's already a JWT token
            resolve(response.credential);
          } else {
            reject(new Error('No credential received'));
          }
        },
      });

      try {
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            reject(
              new Error(
                'Prompt could not be displayed: ' +
                  notification.getNotDisplayedReason(),
              ),
            );
          } else if (notification.isSkippedMoment()) {
            reject(
              new Error(
                'Prompt was skipped: ' + notification.getSkippedReason(),
              ),
            );
          }
        });
      } catch (e) {
        reject(new Error(`Failed to prompt: ${(e as any).message}`));
      }
    });
  };

  return createConnector<Provider, Properties, StorageItem>((config) => ({
    id: 'okto',
    name: 'Okto',
    type: okto.type,
    async connect() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      if (!provider.isLoggedIn()) {
        console.info('Connecting to Okto');

        const googleIdToken = await getGoogleIdToken();
        await provider.connect({
          idToken: googleIdToken,
          provider: 'google',
        });

        console.info('Connected to Okto');
      } else {
        console.log('Already connected to Okto');
        await provider.updateAccount();
      }

      console.info('Getting accounts and chainId');

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();

      if (!accountsChanged) {
        accountsChanged = this.onAccountsChanged.bind(this);
        provider.on('accountsChanged', accountsChanged);
      }
      if (!chainChanged) {
        chainChanged = this.onChainChanged.bind(this);
        provider.on('chainChanged', chainChanged);
      }
      if (!disconnect) {
        disconnect = this.onDisconnect.bind(this);
        provider.on('disconnect', disconnect);
      }

      // Remove disconnected shim if it exists
      if (shimDisconnect) await config.storage?.removeItem('okto.disconnected');

      return { accounts, chainId };
    },
    async disconnect() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      // Not Relevant
      // if (accountsChanged) {
      //   provider.removeListener("accountsChanged", accountsChanged);
      //   accountsChanged = undefined;
      // }
      if (chainChanged) {
        provider.removeListener('chainChanged', chainChanged);
        chainChanged = undefined;
      }
      if (disconnect) {
        provider.removeListener('disconnect', disconnect);
        disconnect = undefined;
      }

      // Add shim signalling connector is disconnected
      if (shimDisconnect)
        await config.storage?.setItem('okto.disconnected', true);

      provider.disconnect();
      // provider.close?.();
    },
    async getAccounts() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();
      return (await provider.request({ method: 'eth_accounts' })).map(
        getAddress,
      );
    },
    async getProvider() {
      if (!provider_) {
        const oc = new OktoClient({
          environment: environment,
          clientPrivateKey: clientPrivateKey,
          clientSWA: clientSWA,
        });

        if (!oc) throw new Error('Could not load Okto SDK');
        provider_ = new OktoProvider(oc);
      }
      return provider_;
    },
    async getChainId() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();
      return Number(provider.chainId);
    },
    async isAuthorized() {
      try {
        const isDisconnected =
          shimDisconnect &&
          // If shim exists in storage, connector is disconnected
          (await config.storage?.getItem('okto.disconnected'));
        if (isDisconnected) return false;

        const accounts = await this.getAccounts();
        return !!accounts.length;
      } catch {
        return false;
      }
    },
    onAccountsChanged() {
      //TODO: Not relevant
    },
    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit('change', { chainId });
    },
    async switchChain({ chainId }) {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      const chain = config.chains.find((x) => x.id === chainId);
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      return await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [chainId],
      });
    },
    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}
