import { useContractRead, WagmiConfig } from "wagmi";
import { parseEther, formatEther } from "@ethersproject/units";

import { client, chains } from "./client.mjs";

const abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
    ],
    name: "purchase",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "saleDetails",
    outputs: [
      {
        components: [
          {
            internalType: "bool",
            name: "publicSaleActive",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "presaleActive",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "publicSalePrice",
            type: "uint256",
          },
          {
            internalType: "uint64",
            name: "publicSaleStart",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "publicSaleEnd",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "presaleStart",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "presaleEnd",
            type: "uint64",
          },
          {
            internalType: "bytes32",
            name: "presaleMerkleRoot",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "maxSalePurchasePerAddress",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "totalMinted",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxSupply",
            type: "uint256",
          },
        ],
        internalType: "struct IERC721Drop.SaleDetails",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const address = "0xebb15487787cbf8ae2ffe1a6cca5a50e63003786";

export const PriceComponent = (props) => {
  const salesDetails = useContractRead({
    address,
    abi,
    functionName: "saleDetails",
    chainId: 1,
  });

  const salesPrice = salesDetails?.data?.publicSalePrice || 0;
  let total = salesPrice;
  if (props.fee) {
    total = total.add(parseEther(props.fee));
  }

  return <span>{formatEther(total)}</span>;
};

const WrappedPriceComponent = (props) => {
  return (
    <WagmiConfig client={client}>
      <PriceComponent {...props} />
    </WagmiConfig>
  );
};

export default WrappedPriceComponent;
