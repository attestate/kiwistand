// @format
import React, { useState } from 'react';
import { usePrepareContractWrite, useContractWrite, useEnsName, WagmiConfig } from "wagmi";
import { ConnectKitProvider, useConnectKit } from "connectkit";
import { utils } from "ethers";

import { EnsName } from "./EnsName.jsx";
import client from "./client.mjs";
import { showMessage } from "./message.mjs";

const Container = (props) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        <DisperseEth {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

const DisperseEth = (props) => {
  const { connected } = useConnectKit();
  const addresses = props.addresses.split(",");
  const shares = props.shares.split(",");

  const zip = (arr1, arr2) => arr1.map((k, i) => [k, arr2[i]]);
  const pairs = zip(addresses, shares);

  const [checkedState, setCheckedState] = useState(
    new Array(pairs.length).fill(false)
  );

  // State for input
  const [inputValue, setInputValue] = useState(0);

  const handleChange = (position) => {
    const updatedCheckedState = checkedState.map((item, index) =>
      index === position ? !item : item
    );
    setCheckedState(updatedCheckedState);
  };

  const totalPoints = pairs.reduce((acc, curr, index) =>
    checkedState[index] ? acc + Number(curr[1]) : acc, 0
  );

  const recipients = [];
  const values = [];

  pairs.forEach((pair, i) => {
    if (checkedState[i]) {
      recipients.push(pair[0]);
      values.push(Math.floor((pair[1] / totalPoints) * inputValue * 10**18));
    }
  });

  let etherValue = "0";
  if (inputValue !== "" && !isNaN(inputValue) && /^[0-9.]+$/.test(`${inputValue}`)) {
    etherValue = utils.parseEther(`${inputValue}`).toString();
    console.log(etherValue);
  }

  const { config } = usePrepareContractWrite({
    address: '0xD152f549545093347A162Dce210e7293f1452150',
    abi: [
      {
        name: 'disperseEther',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: 'recipients',
            type: 'address[]',
          },
          {
            name: 'values',
            type: 'uint256[]',
          },
        ],
        outputs: [],
      },
    ],
    functionName: 'disperseEther',
    args: [recipients, values],
    enabled: Boolean(recipients.length && values.length),
    value: etherValue
  });

  const { write } = useContractWrite(config);
  
  return (
    <>
      <p style={{ fontWeight: 'bold', textAlign: 'center', margin: '20px 0' }}>
        To donate via the disperse contract at{' '}
        <a href="https://etherscan.io/address/0xD152f549545093347A162Dce210e7293f1452150#code" target="_blank" rel="noopener noreferrer">
          etherscan.io
        </a>, you can select the curators that you found useful and send them ETH!
      </p>      {pairs.map((pair, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          {connected && 
            <input type="checkbox" id={`checkbox${i}`} defaultChecked={checkedState[i]} onChange={() => handleChange(i)} />
          }
          <label htmlFor={`checkbox${i}`} style={{minWidth: '200px', whiteSpace: 'nowrap'}}>
            <span style={{ paddingRight: '5px' }}>{i + 1}. <EnsName address={pair[0]} /> ({pair[1]} points)</span>
          </label>
        </div>
      ))}
      {connected &&
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
          <input type="number" value={inputValue} 
            onChange={e => setInputValue(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="1.0" />
          <span style={{ paddingLeft: '10px' }}>Ether (use English decimal format, e.g., "1.0")</span>
          <button onClick={(e) => {
            e.preventDefault();
            showMessage("Please sign the message in your wallet!");
            write?.();
          }} disabled={!write}>Disperse</button>
        </div>
      }
    </>
  );
};

export default Container;

