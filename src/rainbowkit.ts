import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit';
import { createConnector } from '@wagmi/core';
import { okto, type OktoParameters } from './connector';

export interface OktoSdkParams {
  params: OktoParameters;
  type: 'email' | 'google' | 'generic';
}

export const getOktoSdkConnector = ({ params, type }: OktoSdkParams) => {
  let id = 'okto-sdk';
  let name = 'Okto SDK';
  let shortName = 'okto';
  let iconUrl = 'https://docs.okto.tech/images/brand-kit/icons/icon.png';
  let iconBackground = '#ffffff';

  // TODO: Update the iconUrl and iconBackground for each type
  switch (type) {
    case 'google':
      id = 'okto-sdk-google';
      name = 'Login with Google';
      shortName = 'Google';
      iconUrl = 'https://docs.okto.tech/images/brand-kit/icons/google.png';
      iconBackground = '#ffffff';
      break;
    case 'email':
      id = 'okto-sdk-email';
      name = 'Login with Email';
      shortName = 'Email';
      iconUrl = 'https://docs.okto.tech/images/brand-kit/icons/email.png';
      iconBackground = '#ffffff';
      break;
    case 'generic':
    default:
      id = 'okto-sdk-generic';
      name = 'Okto SDK';
      shortName = 'Okto';
      iconUrl = 'https://docs.okto.tech/images/brand-kit/icons/icon.png';
      iconBackground = '#ffffff';
      break;
  }

  const createWalletFn = (): Wallet => ({
    id: id,
    name: name,
    shortName: shortName,
    iconBackground: iconBackground,
    iconUrl: iconUrl,
    createConnector: (walletDetails: WalletDetailsParams) => {
      return createConnector((config) => ({
        ...okto(params)(config),
        ...walletDetails,
      }));
    },
  });

  return createWalletFn;
};
