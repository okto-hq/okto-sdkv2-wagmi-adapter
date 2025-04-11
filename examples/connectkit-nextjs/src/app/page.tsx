'use client';

import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';

export default function Home() {
  return (
    <div>
      Hello RainbowKit
      <div className="my-auto mx-auto flex flex-col items-center justify-center">
        <p className="text-2xl my-6">Connect your wallet</p>
        <ConnectKitButton />
      </div>
      <div className="my-auto mx-auto flex flex-col items-center justify-center mt-10">
        <MyComponent />
      </div>
    </div>
  );
}

const MyComponent = () => {
  const { address, isConnecting, isDisconnected } = useAccount();
  if (isConnecting) return <div>Connecting...</div>;
  if (isDisconnected) return <div>Disconnected</div>;
  return <div>Connected Wallet: {address}</div>;
};
