import React, { useEffect, useState, useRef } from "react";
import { useAccount, useSendCalls } from "wagmi";
import { encodeFunctionData } from "viem";
import { Wallet } from "@ethersproject/wallet";
import { getAddress } from "@ethersproject/address";
import { create } from "@attestate/delegator2";
import { optimism } from "wagmi/chains";
import posthog from "posthog-js";

import { getLocalAccount } from "./session.mjs";
import { fetchDelegations } from "./API.mjs";

const DELEGATOR3 = "0x418910fef46896eb0bfe38f656e2f7df3eca7198";

const abi = [
  {
    inputs: [{ internalType: "bytes32[3]", name: "data", type: "bytes32[3]" }],
    name: "etch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const PortoAutoDelegation = ({ delegations }) => {
  const account = useAccount();
  const { sendCalls, isPending, isSuccess, data } = useSendCalls();
  const [newKey, setNewKey] = useState(null);
  const [payload, setPayload] = useState(null);
  const [fired, setFired] = useState(false);
  const [keyStored, setKeyStored] = useState(false);
  const pollRef = useRef(null);

  const isPorto = account.connector?.id === "xyz.ithaca.porto";
  const hasLocalKey = account.address
    ? !!getLocalAccount(account.address)
    : true;

  // Generate key and payload when Porto user connects without a local key
  useEffect(() => {
    if (!isPorto || !account.address || hasLocalKey) return;

    const generate = async () => {
      const key = Wallet.createRandom();
      const delegationPayload = await create(
        key,
        account.address,
        key.address,
        true,
      );
      setNewKey(key);
      setPayload(delegationPayload);
    };
    generate();
  }, [isPorto, account.address, hasLocalKey]);

  // Auto-fire sendCalls once payload is ready
  useEffect(() => {
    if (!payload || !newKey || fired || isPending || hasLocalKey) return;

    const calldata = encodeFunctionData({
      abi,
      functionName: "etch",
      args: [payload],
    });

    sendCalls({
      calls: [{ to: DELEGATOR3, data: calldata }],
      chainId: optimism.id,
    });
    setFired(true);
  }, [payload, newKey, fired, isPending, hasLocalKey]);

  // Store key on success
  useEffect(() => {
    if (!isSuccess || !data || !newKey || !account.address || keyStored) return;

    const keyName = `-kiwi-news-${getAddress(account.address)}-key`;
    localStorage.setItem(keyName, newKey.privateKey);
    setKeyStored(true);
  }, [isSuccess, data, newKey, account.address, keyStored]);

  // Poll for indexing after key is stored
  useEffect(() => {
    if (!keyStored || !newKey) return;

    const checkDelegations = async () => {
      const allDelegations = await fetchDelegations(true);
      if (Object.keys(allDelegations).includes(newKey.address)) {
        clearInterval(pollRef.current);
        const isAnonMode = localStorage.getItem("anon-mode") === "true";
        if (!isAnonMode) {
          posthog.capture("delegation_performed");
        }
        localStorage.setItem("show-ens-name-modal", "true");
        window.location.pathname = "/";
      }
    };

    checkDelegations();
    pollRef.current = setInterval(checkDelegations, 5000);

    return () => clearInterval(pollRef.current);
  }, [keyStored, newKey]);

  // This component renders nothing visible
  return null;
};

export default PortoAutoDelegation;
