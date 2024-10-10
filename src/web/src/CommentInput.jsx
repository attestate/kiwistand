import { useState, useEffect } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { eligible } from "@attestate/delegator2";
import Drawer from "react-bottom-drawer";

import * as API from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { client, chains, useProvider, useSigner } from "./client.mjs";

const CommentInput = (props) => {
  const { toast, allowlist, delegations } = props;

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const provider = useProvider();
  const result = useSigner();

  const [isEligible, setIsEligible] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const result =
        signer && eligible(allowlist, delegations, await signer.getAddress());
      setIsEligible(result);
    };
    loadData();
  });

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
  }

  function getIndex() {
    return props.storyIndex;
  }

  const existingComment = localStorage.getItem(
    `-kiwi-news-comment-${address}-${getIndex()}`,
  );
  const [text, setText] = useState(existingComment || "");
  useEffect(() => {
    localStorage.setItem(`-kiwi-news-comment-${address}-${getIndex()}`, text);
  }, [text]);

  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    const index = getIndex();

    if (text.length < 15 || text.length > 10_000) {
      toast.error("Comment must be between 15 and 10000 characters.");
      setIsLoading(false);
      return;
    }
    const type = "comment";
    const value = API.messageFab(text, `kiwi:${index}`, type);

    let signature;
    try {
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );
    } catch (err) {
      console.log(err);
      toast.error(`Error! Sad Kiwi! "${err.message}"`);
      setIsLoading(false);
      return;
    }

    const wait = false;
    const response = await API.send(value, signature, wait);
    if (response && response.status === "error") {
      toast.error("Failed to submit your comment.");
      return;
    }

    // NOTE: We fetch the current page here in JavaScript to (hopefully)
    // produce a cache revalidation that then makes the new comment fastly
    // available to all other users.
    const path = `/stories?index=${getIndex()}`;
    fetch(path);
    toast.success("Thanks for submitting your comment. Reloading...");
    localStorage.removeItem(`-kiwi-news-comment-${address}-${getIndex()}`);

    const nextPage = new URL(path, window.location.origin);
    if (response?.data?.index) {
      nextPage.searchParams.set("cachebuster", response.data.index);
      nextPage.hash = `#${response.data.index}`;
    }
    window.location.href = nextPage.href;
  };

  const characterLimit = 10_000;

  function toggleNavigationItems() {
    toggleElement(".submit-button", "block");
    toggleElement(".bottom-nav", "flex");
  }

  function toggleElement(name, defaultDisplay) {
    const button = document.querySelector(name);
    if (!button) return;

    const { display } = button.style;

    if (display === "none") {
      button.style.display = defaultDisplay;
    } else if (display === defaultDisplay || display === "") {
      button.style.display = "none";
    }
  }
  if (!address || !isEligible) return null;
  return (
    <div
      style={{
        margin: "0 1rem 1rem 1rem",
        ...props.style,
      }}
    >
      <textarea
        onFocus={toggleNavigationItems}
        onBlur={toggleNavigationItems}
        rows="12"
        cols="80"
        style={{
          display: "block",
          width: "100%",
          border: "1px solid #828282",
          fontSize: "1rem",
          borderRadius: "2px",
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading || !address || !isEligible}
      ></textarea>
      <span>
        Characters remaining: {(characterLimit - text.length).toLocaleString()}
      </span>
      <br />
      <br />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          id="button-onboarding"
          style={{ width: "auto" }}
          disabled={isLoading || !address || !isEligible}
          onClick={handleSubmit}
        >
          {isLoading ? "Submitting..." : "Add comment"}
        </button>
        <CommentGuidelines />
      </div>
    </div>
  );
};

const CommentGuidelines = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Drawer
        className="drawer"
        isVisible={open}
        onClose={() => setOpen(false)}
      >
        <h4>What comments are we looking for?</h4>
        <ol>
          <li>
            <strong>Extra Context: </strong>
            Explain why you think the story is interesting.
          </li>
          <br />
          <li>
            <strong>Insider's perspective: </strong>
            Have you been involved? What was <i>your</i> experience?
          </li>
          <br />
          <li>
            <strong>Debunks: </strong>
            Do you believe the material is false or misleading? Tell us why!
          </li>
          <br />
          <li>
            <strong>Impact on you: </strong>
            How were you impacted?
          </li>
          <br />
          <li>
            <strong>Questions: </strong>
            Ask for more information.
          </li>
          <br />
        </ol>
      </Drawer>
      <span
        className="meta-link drawer-link"
        style={{ fontSize: "0.8rem" }}
        onClick={() => setOpen(true)}
      >
        comment guidelines
      </span>
    </>
  );
};

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <CommentInput {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Container;
