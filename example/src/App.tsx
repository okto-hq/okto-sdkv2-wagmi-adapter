import { useState } from 'react';
import { Hash, Hex, parseEther } from 'viem';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSignMessage,
  useVerifyMessage,
} from 'wagmi';

function App() {
  const [recipient, setRecipient] = useState('');
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransaction } = useSendTransaction();
  const { signMessage } = useSignMessage();

  const [message, setMessage] = useState<string>('');
  const [signedMessage, setSignedMessage] = useState<Hash>('0x');

  // Use the useVerifyMessage hook properly
  const {
    data: isVerified,
    isSuccess,
    dataUpdatedAt,
    isLoading,
    queryKey,
  } = useVerifyMessage({
    message,
    signature: signedMessage,
    address: account.address,
  });

  return (
    <>
      <div>
        <h2>Account</h2>

        <div>
          status: {account.status}
          <br />
          addresses: {JSON.stringify(account.addresses)}
          <br />
          chainId: {account.chainId}
        </div>

        {account.status === 'connected' && (
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        )}
      </div>

      <div>
        <h2>Connect</h2>
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            type="button"
          >
            {connector.name}
          </button>
        ))}
        <div>{status}</div>
        <div>{error?.message}</div>
      </div>

      <div>
        <h2>Send 0.01 ETH</h2>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Enter recipient address"
          style={{ width: '400px' }}
        />
        <br />
        <button
          type="button"
          disabled={
            account.status !== 'connected' ||
            !recipient ||
            recipient.length !== 42
          }
          onClick={() => {
            sendTransaction({
              to: recipient as Hex,
              value: parseEther('0.01'),
            });
          }}
        >
          Send
        </button>

        <br />
        <br />

        {/* Sign Message */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message"
          style={{ width: '400px' }}
        />
        <button
          type="button"
          onClick={() => {
            console.log('Signing message', message);

            signMessage(
              { message: message },
              {
                onSuccess: (data) => {
                  console.log('Signed message', data);
                  setSignedMessage(data);
                },
                onError: (error) => {
                  console.error(error);
                },
                onSettled: (data, error) => {
                  console.log('Settled', data, error);
                },
              },
            );
          }}
        >
          Sign Message
        </button>

        <div>
          <h2>Signed Message</h2>
          <pre>{signedMessage}</pre>
        </div>

        <div>
          <h2>Verify Message</h2>
          <div>
            {isSuccess && isVerified && (
              <p>✅ Message verified successfully!</p>
            )}
            {isSuccess && !isVerified && <p>❌ Message verification failed!</p>}
            {isLoading && <p>Loading...</p>}
            {dataUpdatedAt && <p>Data updated at: {dataUpdatedAt}</p>}
            {queryKey && (
              <pre>Query key: {JSON.stringify(queryKey, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
