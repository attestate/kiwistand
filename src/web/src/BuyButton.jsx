import { usePrepareContractWrite, useContractWrite, WagmiConfig, useAccount, useContractRead } from 'wagmi'
import { ConnectKitProvider, ConnectKitButton } from "connectkit";
import { utils } from "ethers";
import { mainnet } from 'wagmi/chains'

import client from "./client.mjs";
import { showMessage } from "./message.mjs";

const abi = [
  {
  "inputs": [{
    "internalType": "uint256",
    "name": "quantity",
    "type": "uint256"
  }],
  "name": "purchase",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
  }],
  "stateMutability": "payable",
  "type": "function"
},
  {
  "inputs": [],
  "name": "saleDetails",
  "outputs": [
    {
      "components": [
        {
          "internalType": "bool",
          "name": "publicSaleActive",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "presaleActive",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "publicSalePrice",
          "type": "uint256"
        },
        {
          "internalType": "uint64",
          "name": "publicSaleStart",
          "type": "uint64"
        },
        {
          "internalType": "uint64",
          "name": "publicSaleEnd",
          "type": "uint64"
        },
        {
          "internalType": "uint64",
          "name": "presaleStart",
          "type": "uint64"
        },
        {
          "internalType": "uint64",
          "name": "presaleEnd",
          "type": "uint64"
        },
        {
          "internalType": "bytes32",
          "name": "presaleMerkleRoot",
          "type": "bytes32"
        },
        {
          "internalType": "uint256",
          "name": "maxSalePurchasePerAddress",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalMinted",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "maxSupply",
          "type": "uint256"
        }
      ],
      "internalType": "struct IERC721Drop.SaleDetails",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}];

const ZORA_MINT_FEE = utils.parseEther("0.000777");

const address = "0xebB15487787cBF8Ae2ffe1a6Cca5a50E63003786";
const BuyButton = () => {
  const salesDetails = useContractRead({
    address,
    abi,
    functionName: 'saleDetails',
  })

  const quantity = 1;
  const value = ZORA_MINT_FEE.add(salesDetails.data.publicSalePrice);
  const { config, error } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'purchase',
    args: [quantity],
    overrides: {
      value,
    },
    chainId: mainnet.id
  })
  if (error) {
    showMessage("Can't mint because of configuration error");
  }
  const { data, write, isLoading, isSuccess } = useContractWrite(config)
  return (
    <div>
    <button className="buy-button" disabled={!write || isLoading} onClick={() => write?.()}>
      {!isLoading && !isSuccess && <div>Buy Kiwi NFT for {utils.formatEther(salesDetails.data.publicSalePrice)} Ξ</div>}
      {isLoading && <div>Please sign transaction</div>}
      {isSuccess && <div>Thanks for minting!</div>}
    </button>
    {isSuccess && <div>Transaction: <a href="https://etherscan.io/tx/{data.hash}">Transaction (etherscan)</a>}</div>}
    </div>
  );
};

const CenteredConnectKitButton = () => {
  return (
    <div className="connect-kit-wrapper">
      <h3>You're almost there!</h3>
      <p>
        To submit links to the p2p network you'll need to:
        <br />
        <br />
        🥝 connect your wallet
        <br />
        🥝 mint our News Access NFT.
      </p>
      <ConnectKitButton />
    </div>
  );
};

const Form = () => {
  const { isConnected } = useAccount()
  return (
    <WagmiConfig client={client}>
    <ConnectKitProvider>
      {isConnected ? <BuyButton/> : <CenteredConnectKitButton />}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Form;
