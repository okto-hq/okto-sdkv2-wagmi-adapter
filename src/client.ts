import {
  type OktoClientConfig,
  OktoClient as OktoCoreClient,
} from '@okto_web3/core-js-sdk';
import type { SessionConfig } from '@okto_web3/core-js-sdk/core';
import type { RpcError } from '@okto_web3/core-js-sdk/errors';
import type { Address, AuthData } from '@okto_web3/core-js-sdk/types';
import { decryptData, encryptData } from './utils/encryption.js';
import {
  clearLocalStorage,
  getLocalStorage,
  setLocalStorage,
} from './utils/storage.js';

class OktoClient extends OktoCoreClient {
  private _clientPrivateKey: string;

  constructor(config: OktoClientConfig) {
    super(config);
    this._clientPrivateKey = config.clientPrivateKey;
    this.initializeSessionConfig();
  }

  private async initializeSessionConfig(): Promise<void> {
    const encryptedSession = await getLocalStorage('session');
    if (encryptedSession) {
      const sessionConfig = decryptData<SessionConfig>(
        encryptedSession,
        this._clientPrivateKey,
      );
      if (sessionConfig) {
        this.setSessionConfig(sessionConfig);
      }
    }
  }

  override loginUsingOAuth(
    data: AuthData,
  ): Promise<Address | RpcError | undefined> {
    return super.loginUsingOAuth(data, (session) => {
      setLocalStorage('session', encryptData(session, this._clientPrivateKey));
      this.setSessionConfig(session);
    });
  }

  override sessionClear(): void {
    clearLocalStorage();
    return super.sessionClear();
  }
}

export { OktoClient };
