import { OktoClient } from '@okto_web3/react-sdk';
import { getAccount, getOrdersHistory } from '@okto_web3/react-sdk/explorer';
import type { SocialAuthType, Wallet } from '@okto_web3/react-sdk/types';
import { evmRawTransaction } from '@okto_web3/react-sdk/userop';
import { EventEmitter } from 'events';
import type { EIP1193Provider } from './types.js';
import { numberToHex } from './utils/converstion.js';

export type OktoLoginTypes = 'generic' | SocialAuthType;

// The API is based on Ethereum JavaScript API Provider Standard. Link: https://eips.ethereum.org/EIPS/eip-1193
export class OktoProvider extends EventEmitter implements EIP1193Provider {
  private readonly client: OktoClient;
  private chain: number;
  private address: string;
  private accounts: Wallet[];

  constructor(oc: OktoClient) {
    super();
    this.client = oc;
    this.chain = 1;
    this.address = '';
    this.accounts = [];
  }

  async connect(data: { provider: OktoLoginTypes }): Promise<void> {
    this.emit('connect', { chainId: this.chainId });

    if (!this.client.userSWA) {
      if (data.provider === 'generic') {
        await this.client.authenticateWithWebView({
          onSuccess(user) {
            console.log('User authenticated', user);
          },
          onError(error) {
            throw new Error('Failed to login', {
              cause: error,
            });
          },
          onClose() {
            console.log('WebView closed');
          },
        });
      } else {
        await this.client.loginUsingSocial(data.provider);
      }
    }

    await this.updateAccount();
    return;
  }

  async disconnect(): Promise<void> {
    this.emit('disconnect');
    this.client.sessionClear();
    return;
  }

  public get chainId(): number {
    return this.chain;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async request(request: { method: string; params?: any[] }): Promise<any> {
    const { method, params = [] } = request;

    switch (method) {
      case 'eth_accounts':
        return [this.address];

      case 'net_version':
      case 'eth_chainId':
        return numberToHex(this.chainId);
      case 'wallet_switchEthereumChain': {
        this.updateChainId(params[0]);
        return true;
      }

      case 'personal_sign': {
        try {
          const [message, address] = params;
          if (this.address.toLowerCase() !== address.toLowerCase()) {
            throw new Error('The address or message hash is invalid');
          }
          const signature = await this.client.signMessage(message);
          return signature || '0x';
        } catch (_) {
          return '0x';
        }
      }

      case 'eth_sign': {
        try {
          const [address, messageHash] = params;
          if (
            this.address.toLowerCase() !== address.toLowerCase() ||
            !messageHash.startsWith('0x')
          ) {
            throw new Error('The address or message hash is invalid');
          }
          const signature = await this.client.signMessage(messageHash);
          return signature || '0x';
        } catch (_) {
          return '0x';
        }
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        try {
          const [address, typedData] = params;
          const parsedTypedData =
            typeof typedData === 'string' ? JSON.parse(typedData) : typedData;
          if (this.address.toLowerCase() !== address.toLowerCase()) {
            throw new Error('The address is invalid');
          }
          const signature = await this.client.signTypedData(parsedTypedData);
          return signature || '0x';
        } catch (_) {
          return '0x';
        }
      }

      case 'eth_sendTransaction': {
        try {
          // `value` or `data` can be explicitly set as `undefined` for example in Viem. The spread will overwrite the fallback value.
          const tx = {
            ...params[0],
            value: params[0].value || '0',
            data: params[0].data || '0x',
          };

          // Some ethereum libraries might pass the gas as a hex-encoded string
          // We need to convert it to a number because the SDK expects a number and our backend only supports
          // Decimal numbers
          if (typeof tx.gas === 'string' && tx.gas.startsWith('0x')) {
            tx.gas = Number.parseInt(tx.gas, 16);
          }
          if (typeof tx.value === 'string') {
            tx.value = BigInt(tx.value);
          }

          const rawTxnUserOp = await evmRawTransaction(this.client, {
            caip2Id: `eip155:${this.chainId}`,
            transaction: {
              from: tx.from,
              to: tx.to,
              data: tx.data,
              value: tx.value,
            },
          });

          const rawTxnSignedUserOp = await this.client.signUserOp(rawTxnUserOp);

          const res = await this.client.executeUserOp(rawTxnSignedUserOp);

          let txhash = '';
          let retryCount = 0;
          while (true) {
            const order = await getOrdersHistory(this.client, {
              intentId: res,
            });

            if (order.length > 0 && order[0]!.downstreamTransactionHash[0]) {
              txhash = order[0]!.downstreamTransactionHash[0];
              break;
            }

            if (
              order.length > 0 &&
              [
                'SUCCESSFUL',
                'FAILED',
                'EXPIRED',
                'BUNDLER_DISCARDED',
                'FAILED_ON_CHAIN',
              ].indexOf(order[0]!.status) >= 0
            ) {
              throw new Error('Transaction Hash not found');
            }

            if (retryCount >= 25) {
              throw new Error('Transaction Hash not found');
            }

            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Math.min(1000 * Math.pow(2, retryCount++), 30000),
              ),
            );
          }

          return txhash;
        } catch (error) {
          throw error;
        }
      }

      default:
        throw new Error(`"${request.method}" not implemented`);
    }
  }

  // this method is needed for ethers v4
  // https://github.com/ethers-io/ethers.js/blob/427e16826eb15d52d25c4f01027f8db22b74b76c/src.ts/providers/web3-provider.ts#L41-L55
  send(request: any, callback: (error: any, response?: any) => void): void {
    if (!request) callback('Undefined request');
    this.request(request)
      .then((result) =>
        callback(null, { jsonrpc: '2.0', id: request.id, result }),
      )
      .catch((error) => callback(error, null));
  }

  isLoggedIn(): boolean {
    return this.client.isLoggedIn();
  }

  async updateAccount(): Promise<void> {
    const accounts = await this.getEthAccounts();

    await this.client.syncUserKeys();

    this.chain = accounts[0]!.chainId;
    this.address = accounts[0]!.address;

    this.emit('accountsChanged', [this.address]);
  }

  private async getEthAccounts(): Promise<
    {
      chainId: number;
      address: string;
    }[]
  > {
    if (this.accounts.length == 0) {
      this.accounts = await getAccount(this.client);
    }

    if (this.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const eipAccounts = this.accounts.filter((account) =>
      account.caipId.startsWith('eip155:'),
    );

    if (eipAccounts.length === 0) {
      throw new Error('No EIP155 accounts found');
    }

    return eipAccounts.map((account) => {
      return {
        chainId: Number.parseInt(account.caipId.split(':')[1] ?? '0'),
        address: account.address,
      };
    });
  }

  private async updateChainId(chainId: number): Promise<void> {
    const accounts = await this.getEthAccounts();
    const account = accounts.find((account) => account.chainId === chainId);

    if (!account) {
      throw new Error('Chain not supported');
    }

    this.chain = chainId;
    this.address = account.address;

    this.emit('chainChanged', this.chainId);
  }
}
