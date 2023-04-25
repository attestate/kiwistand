// @format
import { useState } from 'react';
import { useSignTypedData, useAccount, WagmiConfig, createClient } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";

import * as API from "./API.mjs";
import client from "./client.mjs";
import './SubmitForm.css';

const LinkSubmissionForm = () => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const value = API.messageFab(title, url);
  const { data, error, isError, isLoading, isSuccess, signTypedDataAsync } =
    useSignTypedData({
      domain: API.EIP712_DOMAIN,
      types: API.EIP712_TYPES,
      value,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const signature = await signTypedDataAsync();
    await API.send(value, signature);
    window.location.replace('/');
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <div className="label-input-container">
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxlength="80"
          required
        />
      </div>
      <div className="label-input-container">
        <label htmlFor="url">URL:</label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      <button type="submit">Submit</button>
      <p>
        NOTE: Your submission will only be accepted by the Kiwi News p2p network if
        the address that's signing the message also minted the <a target="_blank" style={{color: "black"}} href="https://kiwistand.com">kiwistand.com</a> NFT.
      </p>
    </form>
  );
};

const CenteredConnectKitButton = () => {
  return (
    <div className="connect-kit-wrapper">
      <b>
        To submit a link, you'll have to connect your wallet first.
      </b>
      <ConnectKitButton />
    </div>
  );
};


const Form = () => {
  const { isConnected } = useAccount()
  return (
    <WagmiConfig client={client}>
    <ConnectKitProvider>
      {isConnected ? <LinkSubmissionForm /> : <CenteredConnectKitButton />}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Form;
