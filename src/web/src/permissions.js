// Kiwi News delegation contract on OP Mainnet
const DELEGATION_CONTRACT = "0x418910Fef46896eb0bfE38F656E2f7df3ECA7198";

// 6000000000 wei (3x ~2000000000 for 3 delegations)
const TOTAL_FEE_LIMIT = 6000000000n;

export const permissions = () => ({
  expiry: Math.floor(Date.now() / 1_000) + 60 * 60 * 24 * 365, // 1 year
  feeToken: {
    limit: "0.0001", // feeToken limit is in ETH string format
  },
  permissions: {
    calls: [
      {
        to: DELEGATION_CONTRACT,
        signature: "etch(bytes32[3])", // etch function signature
      },
    ],
    spend: [
      {
        limit: TOTAL_FEE_LIMIT, // spend limit must be bigint
        period: "year",
      },
    ],
  },
});
