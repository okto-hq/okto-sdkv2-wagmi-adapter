import type { OktoClientConfig } from '@okto_web3/react-sdk';
import { OktoClient } from '@okto_web3/react-sdk';
import {
  ChainNotConfiguredError,
  ProviderNotFoundError,
  createConnector,
  type Connector,
} from '@wagmi/core';
import type { Compute } from '@wagmi/core/internal';
import { SwitchChainError, getAddress } from 'viem';
import { OktoProvider, type OktoLoginTypes } from './provider.js';

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
    loginType?: OktoLoginTypes;
  }
>;

okto.type = 'okto' as const;
export function okto(parameters: OktoParameters) {
  const {
    shimDisconnect = false,
    environment,
    clientPrivateKey,
    clientSWA,
    loginType = 'generic',
  } = parameters;

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

  return createConnector<Provider, Properties, StorageItem>((config) => ({
    id: 'okto',
    name: 'Okto',
    type: okto.type,
    async connect() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      if (!provider.isLoggedIn()) {
        try {
          await provider.connect({
            provider: loginType,
          });
        } catch (err) {
          throw new Error(
            `Failed to connect to Okto: ${(err as Error).message}`,
          );
        }
      } else {
        await provider.updateAccount();
      }

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
