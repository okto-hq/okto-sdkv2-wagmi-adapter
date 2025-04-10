'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  return (
    <div>
      Hello RainbowKit
      <div className="my-auto mx-auto flex flex-col items-center justify-center">
        <p className="text-2xl">Connect your wallet</p>
        <ConnectButton />
      </div>
    </div>
  );
}
