// @format
// The protocol's EIP-712 domain, in a module without dependencies, so code
// that only signs (delegation.mjs) can use it without loading API.mjs and
// its cbor-x, which the node's tests resolve to another version.
export const EIP712_DOMAIN = {
  name: "kiwinews",
  version: "1.0.0",
  salt: "0xfe7a9d68e99b6942bb3a36178b251da8bd061c20ed1e795207ae97183b590e5b",
};
