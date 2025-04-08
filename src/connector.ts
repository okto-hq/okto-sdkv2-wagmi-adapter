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

      try {
        // Create a dummy configuration to disable auto prompt
        google.accounts.id.initialize({
          client_id: googleClientId,
          auto_select: false,
          use_fedcm_for_prompt: false, // Explicitly disable FedCM
          disable_auto_prompt: true, // Disable auto prompt
          callback: () => {
            /* Intentionally empty */
          },
        });

        // Cancel any existing prompts
        google.accounts.id.cancel();
      } catch (e) {
        console.log('Error disabling Google One Tap:', e);
        // Continue with the popup approach regardless
      }

      // Create a centered popup window for Google Sign-In
      const openGoogleAuthPopup = () => {
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        // This URL directly triggers Google's OAuth flow
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', googleClientId);
        authUrl.searchParams.set('response_type', 'token id_token'); // Request ID token directly
        authUrl.searchParams.set('scope', `openid email profile`); // Always include openid scope plus user-configured scopes
        authUrl.searchParams.set('redirect_uri', window.location.origin);
        authUrl.searchParams.set(
          'nonce',
          Math.random().toString(36).substring(2),
        );
        authUrl.searchParams.set('prompt', 'select_account'); // Always show account selection
        authUrl.searchParams.set('use_fedcm', 'false'); // Explicitly disable FedCM in URL params

        // Open the popup
        const popup = window.open(
          authUrl.toString(),
          'google-oauth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
        );

        if (!popup) {
          reject(
            new Error(
              'Failed to open popup. Please allow popups for this site.',
            ),
          );
          return;
        }

        // Poll for redirect back to origin with token
        const intervalId = setInterval(() => {
          try {
            // Check if popup has been closed by user
            if (popup.closed) {
              clearInterval(intervalId);
              reject(
                new Error('Authentication popup was closed before completion'),
              );
              return;
            }

            // Try to access the popup location to see if it redirected to our origin
            const redirectedUrl = popup.location.href;

            if (redirectedUrl.startsWith(window.location.origin)) {
              clearInterval(intervalId);
              popup.close();

              // Parse the URL for tokens
              const urlParams = new URLSearchParams(
                redirectedUrl.split('#')[1],
              );
              const idToken = urlParams.get('id_token');

              if (idToken) {
                console.log('Successfully obtained ID token from popup');
                resolve(idToken);
              } else {
                reject(
                  new Error('No ID token found in authentication response'),
                );
              }
            }
          } catch (e) {
            // Cross-origin errors will happen while the user is on Google's domain
            // We can safely ignore these as part of the normal flow
          }
        }, 100);

        // Set a timeout to avoid hanging indefinitely
        setTimeout(() => {
          clearInterval(intervalId);
          if (!popup.closed) {
            popup.close();
          }
          reject(new Error('Authentication timed out. Please try again.'));
        }, 120000); // 2 minutes timeout
      };

      // Try the pure OAuth popup approach
      try {
        openGoogleAuthPopup();
      } catch (e) {
        console.error('Failed to open auth popup:', e);
        reject(new Error(`Authentication failed: ${(e as Error).message}`));
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

        try {
          const googleIdToken = await getGoogleIdToken();

          if (!googleIdToken) {
            throw new Error('Failed to obtain Google ID token');
          }

          try {
            await provider.connect({
              idToken: googleIdToken,
              provider: 'google',
            });
          } catch (connectError) {
            console.error(
              'Error connecting to Okto with ID token:',
              connectError,
            );
            throw new Error(
              `Failed to connect to Okto: ${(connectError as Error).message}`,
            );
          }
        } catch (error) {
          console.error('Authentication failed:', error);

          // Provide meaningful error messages based on error type
          const errorMessage = (error as Error)?.message || '';

          if (
            errorMessage.includes('popup') ||
            errorMessage.includes('click')
          ) {
            console.warn(
              'Google Sign-In popup was blocked or closed. Please allow popups for this site and try again.',
            );
            throw new Error(
              'Google Sign-In popup was blocked or closed. Please allow popups for this site and try again.',
            );
          }

          if (errorMessage.includes('timed out')) {
            throw new Error('Authentication timed out. Please try again.');
          }

          if (errorMessage.includes('token')) {
            throw new Error(
              'Failed to get authentication token. Please try again with a different Google account.',
            );
          }

          // For all other errors
          throw error;
        }
      } else {
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
