import { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { formatEther, parseEther, formatUnits } from "viem";
import {
  useAccount,
  useBalance,
  WagmiConfig,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useSwitchNetwork,
} from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";
import { optimism } from "wagmi/chains";

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import { getLocalAccount } from "./session.mjs";
import { SimpleDisconnectButton } from "./Navigation.jsx";

function safeExtractDomain(link) {
  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch (err) {
    return "";
  }

  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

const UrlInput = (props) => {
  const { url, setURL } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());

  useEffect(() => {
    if (
      !checkedURLs.has(url) &&
      (url.includes("http") || url.includes("https"))
    ) {
      fetchMetadata(url);
    }
  }, [url]);
  const fetchMetadata = async (url) => {
    try {
      const response = await fetch(`/api/v1/metadata?url=${url}`);
      const data = await response.json();

      if (data.data && data.data.canonicalLink) {
        setURL(data.data.canonicalLink);
        setCheckedURLs(new Set(checkedURLs).add(url));
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <label
        style={{ marginBottom: "5px", display: "block", fontSize: "16px" }}
      >
        Link:
      </label>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          placeholder="https://bitcoin.org/bitcoin.pdf"
          id="urlInput"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          style={{
            borderRadius: "2px",
            border: "1px solid #828282",
            flexGrow: 8,
            padding: "5px 10px",
            fontSize: "16px",
            boxSizing: "border-box",
          }}
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
      </div>
    </div>
  );
};

const buttonStyles = {
  width: "100%",
  maxWidth: "600px",
  marginTop: "1rem",
  padding: "5px",
  fontSize: "16px",
  cursor: "pointer",
};

const SubmitButton = (props) => {
  const { toast, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [remainingChars, setRemainingChars] = useState(80);
  const [isAd, setIsAd] = useState(false);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = url;
    if (canonicalURL) {
      fetch(`/api/v1/parse?url=${encodeURIComponent(canonicalURL)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then((data) => {
          embedPreview.innerHTML = DOMPurify.sanitize(data);
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
        });
      fetch(`/api/v1/metadata?url=${encodeURIComponent(canonicalURL)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.data.ogTitle) {
            const titleInputElem = document.getElementById("titleInput");
            const isTitleBlank = titleInputElem.innerText.length === 0;
            // NOTE: We don't want to overwrite the title in case the user has
            // already typed something in the title box.
            if (!isTitleBlank) return;

            const title = data.data.ogTitle;
            titleInputElem.innerText = title;
            const remaining = 80 - title.length;
            document.querySelector(".remaining").textContent = remaining;
            setTitle(title);
          }
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
        });
    } else {
      embedPreview.innerHTML = "";
    }
  }, [url]);

  useEffect(() => {
    const previewLink = document.querySelector(".story-link");
    const previewDomain = document.querySelector(".story-domain");

    const placeholderTitle = document
      .querySelector("#titleInput")
      .getAttribute("data-placeholder");
    const placeholderUrl = document.querySelector("#urlInput").placeholder;
    const placeholderDomain = `(${safeExtractDomain(placeholderUrl)})`;

    if (previewLink) {
      previewLink.textContent = title || placeholderTitle;
    }

    const canonicalURL = url;
    if (previewLink && canonicalURL) {
      previewLink.href = DOMPurify.sanitize(canonicalURL);
    } else if (previewLink) {
      previewLink.href = DOMPurify.sanitize(placeholderUrl);
    }

    if (previewDomain) {
      previewDomain.textContent = canonicalURL
        ? `(${safeExtractDomain(canonicalURL)})`
        : placeholderDomain;
    }
  }, [title, url]);

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const provider = useProvider();
  const result = useSigner();

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
  }

  useEffect(() => {
    const titleInput = document.getElementById("titleInput");

    if (titleInput) {
      setTitle(titleInput.textContent);
      titleInput.addEventListener("input", () => {
        setTitle(titleInput.textContent);
        const remaining = 80 - titleInput.textContent.length;
        document.querySelector(".remaining").textContent = remaining;
      });
    }

    return () => {
      if (titleInput) {
        titleInput.removeEventListener("input", () =>
          setTitle(titleInput.textContent),
        );
      }
    };
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();

    const canonicalURL = url;
    const value = API.messageFab(
      title.replace(/(\r\n|\n|\r)/gm, " "),
      canonicalURL,
    );

    if (title.length > 80 || canonicalURL.length > 2048) {
      toast.error(
        "The title should be no more than 80 characters, and the URL should be no more than 2048 characters.",
      );
      setIsLoading(false);
      return;
    }
    if (title.length === 0) {
      toast.error("Please add a title.");
      setIsLoading(false);
      return;
    }
    if (
      canonicalURL.length === 0 ||
      (!canonicalURL.startsWith("https://") &&
        !canonicalURL.startsWith("http://"))
    ) {
      toast.error("Please add a valid link.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (!localAccount) toast("Please sign the message in your wallet!");

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

    let redirectTo = "/new";
    let wait = true;
    const domain = safeExtractDomain(canonicalURL);
    const response = await API.send(value, signature, wait);

    let message;
    if (response.status === "success") {
      message = "Thanks for your submission, have a 🥝";
    } else {
      message = `Error! Sad Kiwi! "${response.details}"`;
    }

    if (
      response.status === "error" &&
      response.details.includes("Message with marker")
    ) {
      toast.success(
        "You've voted on this link already earlier, redirecting...",
      );
    } else if (response.status === "error") {
      toast.error(
        "Unexpected error during submission. Please report this to the team!",
      );
      return;
    }

    let nextPage;
    if (response?.data?.index && response?.data?.isResubmission) {
      redirectTo = "/stories";
      nextPage = new URL(window.location.origin + redirectTo);
      nextPage.searchParams.set("index", response.data.index);
    } else if (response?.data?.index) {
      nextPage = new URL(window.location.origin + redirectTo);
      nextPage.searchParams.set("index", response.data.index);
    } else {
      nextPage = new URL(window.location.origin + redirectTo);
    }
    window.location.href = nextPage.href;
  };

  return (
    <div>
      <AdForm toast={toast} isAd={isAd} setIsAd={setIsAd} url={url} />
      {isAd ? null : (
        <button
          id="button-onboarding"
          style={buttonStyles}
          onClick={handleClick}
          disabled={isLoading || !isEligible}
        >
          {isLoading
            ? !localAccount
              ? "Please confirm signature..."
              : "Submitting..."
            : "Submit"}
        </button>
      )}
    </div>
  );
};

const adContractABI = [
  { inputs: [], name: "ErrUnauthorized", type: "error" },
  { inputs: [], name: "ErrValue", type: "error" },
  {
    inputs: [],
    name: "collateral",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "controller",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "href",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "price",
    outputs: [
      { internalType: "uint256", name: "nextPrice", type: "uint256" },
      { internalType: "uint256", name: "taxes", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ragequit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_title", type: "string" },
      { internalType: "string", name: "_href", type: "string" },
    ],
    name: "set",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "timestamp",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "title",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];
const adContractAddress = "0xb0c9502ea7c11ea0fe6157bfc43e3507fa69bba0";

const AdForm = (props) => {
  const titleInputElem = document.getElementById("titleInput");
  const title = titleInputElem.innerText;
  const { isAd, setIsAd, url, toast } = props;
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { switchNetwork } = useSwitchNetwork();

  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({
    address: address,
  });
  const [ethUSD, setETHUSD] = useState(0);
  useEffect(() => {
    (async () => {
      const price = await API.fetchEthUsdPrice();
      setETHUSD(parseFloat(formatUnits(price, 8)));
    })();
  });

  const [userPrice, setUserPrice] = useState("");
  const [minAdPrice, setMinAdPrice] = useState(10000000000000000n);

  const { data: priceData } = useContractRead({
    address: adContractAddress,
    abi: adContractABI,
    functionName: "price",
    chainId: optimism.id,
  });

  useEffect(() => setIsValid(userPrice > minAdPrice), [userPrice, minAdPrice]);

  useEffect(() => {
    if (priceData) {
      const [nextPrice] = priceData;
      if (nextPrice > minAdPrice) {
        setMinAdPrice(nextPrice);
      }
    }
  }, [priceData]);

  let parsedUserPrice;
  if (isNaN(userPrice)) {
    parsedUserPrice = 0n;
  } else {
    parsedUserPrice = parseEther(userPrice);
  }

  const { config, error } = usePrepareContractWrite({
    address: adContractAddress,
    abi: adContractABI,
    functionName: "set",
    args: [title, url],
    value: parsedUserPrice,
    chainId: optimism.id,
  });

  const { writeAsync } = useContractWrite(config);
  const handleAdSubmission = async (e) => {
    e.preventDefault();

    if (title.length > 80 || url.length > 2048) {
      toast.error(
        "The title should be no more than 80 characters, and the URL should be no more than 2048 characters.",
      );
      setIsLoading(false);
      return;
    }
    if (title.length === 0) {
      toast.error("Please add a title.");
      setIsLoading(false);
      return;
    }
    if (
      url.length === 0 ||
      (!url.startsWith("https://") && !url.startsWith("http://"))
    ) {
      toast.error("Please add a valid link.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    if (writeAsync) {
      try {
        await writeAsync();
        toast.success("Submitted onchain...");
        window.location.href = "/";
      } catch (err) {
        console.log(err);
        setIsLoading(false);
      }
    }
  };

  const oneEther = parseEther("1000000000000000000");
  const formattedAdPrice = parseFloat(formatEther(minAdPrice));
  const dailyFee =
    ((parsedUserPrice * (oneEther / 31556952n)) / oneEther) * 60n * 60n * 24n;
  const formattedDailyFee = parseFloat(formatEther(dailyFee)).toFixed(5);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        maxWidth: "600px",
        marginTop: "1rem",
      }}
    >
      <label style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={isAd}
          onChange={(e) => setIsAd(e.target.checked)}
          style={{ transform: "scale(1.5)" }}
        />
        Submit story as an ad
      </label>
      {isAd && (
        <>
          <p style={{ marginBottom: 0 }}>
            Minimum Ad Collateral: {formattedAdPrice} ETH ($
            {(formattedAdPrice * ethUSD).toFixed(2)})
          </p>
          <p style={{ marginTop: 0 }}>
            Daily fee: {formattedDailyFee} ETH ($
            {(formattedDailyFee * ethUSD).toFixed(
              formattedDailyFee * ethUSD > 1 ? 2 : 3,
            )}
            )
          </p>
          <p style={{ fontSize: "16px", marginTop: 0, marginBottom: 0 }}>
            Collateral:
          </p>
          <div
            style={{
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              borderRadius: "2px",
              border: "1px solid #828282",
              padding: "5px 10px",
              boxSizing: "border-box",
            }}
          >
            <input
              type="text"
              placeholder="0.0000"
              value={userPrice.toString()}
              onChange={(e) => setUserPrice(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                width: "100%",
                fontSize: "16px",
                padding: "0",
                marginRight: "5px",
              }}
            />
            <span style={{ whiteSpace: "nowrap" }}>ETH</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
            }}
          >
            <p style={{ margin: 0 }}>
              ≈ ${(formatEther(parsedUserPrice) * ethUSD).toFixed(2)}
            </p>
            {isConnected && balanceData ? (
              <p
                style={{
                  color:
                    parsedUserPrice > balanceData.value ? "red" : "inherit",
                  margin: 0,
                }}
              >
                Balance: {parseFloat(balanceData.formatted).toFixed(4)} ETH
              </p>
            ) : null}
          </div>
          <b style={{ marginTop: "0.5rem" }}>What is this?</b>
          <p style={{ marginTop: 0 }}>
            Check the forth story on the Kiwi News front page. Notice how it
            says "(sponsored)" next to the submitter's username? That's because
            the forth story on Kiwi News is always an ad. Ads are like regular
            Kiwi News stories except that they don't need to be upvoted to reach
            the fourth spot on the front page.
          </p>
          <b style={{ marginTop: 0 }}>How much does it cost?</b>
          <p style={{ marginTop: 0 }}>
            You'll be charged the "Daily fee" on your collateral. Upon
            submitting the ad, you'll be asked to send all of your collateral.
            However, you'll get back most of your collateral when someone else
            runs an ad. We'll simply subtract the accumulated daily fees from
            the collateral.
          </p>
          <b style={{ marginTop: 0 }}>
            What if I want my collateral back earlier?
          </b>
          <p style={{ marginTop: 0 }}>
            Currently, the contract will just return your collateral when
            someone else buys the ad. Keep this in mind! We have however admin
            rights to rescue your collateral if you direly need it back
            immediately.
          </p>
          <b style={{ marginTop: 0 }}>Is this safe?</b>
          <p style={{ marginTop: 0 }}>Use at your own risk!</p>
          <b style={{ marginTop: 0 }}>I have more questions!</b>
          <p style={{ marginTop: 0 }}>
            Please reach out to us via Telegram, we're happy to help you!
          </p>
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const connected = account && chain && mounted;

              let clickHandler, copy, disabled;
              if (connected) {
                if (chain.id === optimism.id) {
                  disabled = isLoading || isValid;
                  copy = isLoading
                    ? "Please sign transaction"
                    : "Submit onchain ad";
                  clickHandler = handleAdSubmission;
                } else {
                  disabled = false;
                  copy = "Switch to OP Mainnet";
                  clickHandler = (e) => {
                    e.preventDefault();
                    switchNetwork?.(optimism.id);
                  };
                }
              } else {
                copy = "Connect Wallet";
                disabled = false;
                clickHandler = (e) => {
                  e.preventDefault();
                  openConnectModal();
                };
              }
              return (
                <>
                  <span>Connected with {address}</span>
                  <button
                    id="button-onboarding"
                    style={{ ...buttonStyles, ...{ marginTop: 0 } }}
                    onClick={clickHandler}
                    disabled={disabled}
                  >
                    {copy}
                  </button>
                  <br />
                  <SimpleDisconnectButton />
                </>
              );
            }}
          </ConnectButton.Custom>
        </>
      )}
    </div>
  );
};

const Form = (props) => {
  const urlInput = document.getElementById("urlInput");
  const [url, setURL] = useState(urlInput.value);

  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <UrlInput url={url} setURL={setURL} />
        <SubmitButton {...props} url={url} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
