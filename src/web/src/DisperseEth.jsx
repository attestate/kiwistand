// @format
import React, { useState } from 'react';
import { useAccount, useEnsName, WagmiConfig } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { sendTransaction, prepareSendTransaction } from '@wagmi/core'
import { Contract, utils, BigNumber } from 'ethers'

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

const abi = [
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
  ];


const DisperseEth = (props) => {
  const { isConnected } = useAccount();
  // NOTE: takes a list of comma separated Ethereum addresses
  const addresses = props.addresses.split(",");
  // NOTE: takes a list of comma separated upvote counts 200, 30, 20, ...
  const shares = props.shares.split(",");

  const zip = (arr1, arr2) => arr1.map((k, i) => [k, arr2[i]]);
  const pairs = zip(addresses, shares);

  const [checkedState, setCheckedState] = useState(
    new Array(pairs.length).fill(true)
  );

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
    let input;
    if (!isNaN(inputValue) && inputValue === "") {
      input = utils.parseEther("0");
    } else {
      input = utils.parseEther(inputValue.toString());
    }

    if (checkedState[i]) {
      recipients.push(pair[0]);
      const share = BigNumber.from(pair[1]);
      const total = BigNumber.from(totalPoints.toString());
      const value = share.mul(input).div(total);
      values.push(value);
    }
  });

  const handleClick = async () => {
    const addr = "0xD152f549545093347A162Dce210e7293f1452150";
    const contract = new Contract(addr, abi);
    const data = contract.interface.encodeFunctionData('disperseEther', [recipients, values]);
    
    const config = await prepareSendTransaction({
      to: addr,
      value: utils.parseEther(inputValue.toString()),
      data,
    });
  
    const { hash } = await sendTransaction(config);
    console.log(hash);
  };
  
  return (
    <>
      <p style={{ fontWeight: 'bold', textAlign: 'center', margin: '20px 0' }}>
        To donate via the disperse contract at{' '}
        <a href="https://etherscan.io/address/0xD152f549545093347A162Dce210e7293f1452150#code" target="_blank" rel="noopener noreferrer">
          etherscan.io
        </a>, you can select the curators that you found useful and send them ETH!
      </p>
          {pairs.map((pair, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'start', marginBottom: '10px' }}>
          {isConnected && 
            <input type="checkbox" id={`checkbox${i}`} defaultChecked={checkedState[i]} onChange={() => handleChange(i)} />
          }
          <label htmlFor={`checkbox${i}`} style={{minWidth: '200px', whiteSpace: 'nowrap'}}>
            <span style={{ paddingRight: '5px' }}>{i + 1}. <EnsName address={pair[0]} /> ({pair[1]} points)</span>
          </label>
        </div>
      ))}
      {isConnected &&
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'start', marginTop: '20px' }}>
          <input type="number" value={inputValue} 
            onChange={e => setInputValue(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="1.0" />
          <button onClick={handleClick}>Disperse</button>
        </div>
      }
    </>
  );
};

export default Container;
