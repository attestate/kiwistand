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
  const { url, setURL, toast } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Get upload URL from our backend
      const tokenResponse = await fetch("/api/v1/image-upload-token");
      if (!tokenResponse.ok) throw new Error("Failed to get upload token");

      const tokenData = await tokenResponse.json();
      const { uploadURL } = tokenData.data;

      // Step 2: Upload file directly to Cloudflare
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(uploadURL, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload image");

      // Step 3: Generate the final image URL
      // The URL pattern for Cloudflare Images is:
      // https://imagedelivery.net/[account hash]/[image id]/[variant]
      const imageId = tokenData.data.id;
      const accountHash = uploadURL.split("/").slice(-2)[0];
      const imageUrl = `https://imagedelivery.net/${accountHash}/${imageId}/public`;

      // Set the URL in the input field
      setURL(imageUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading image: " + error.message);
    } finally {
      setIsUploading(false);
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
          placeholder="Enter or paste article URL"
          id="urlInput"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          style={{
            borderRadius: "2px",
            border:
              url.length > 2048 ||
              url.length === 0 ||
              (!url.startsWith("https://") && !url.startsWith("http://"))
                ? "2px solid black"
                : "1px solid green",
            color:
              url.length > 2048 ||
              url.length === 0 ||
              (!url.startsWith("https://") && !url.startsWith("http://"))
                ? "black"
                : "#828282",

            width: "80%",
            padding: "12px 16px",
            fontSize: "16px",
            boxSizing: "border-box",
            background: "white",
            minHeight: "50px",
          }}
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <input
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
        <label
          htmlFor="imageUpload"
          style={{
            marginLeft: "10px",
            padding: "0 16px",
            backgroundColor: "#000",
            color: "#fff",
            borderRadius: "2px",
            cursor: "pointer",
            fontSize: "14px",
            height: "50px" /* Match exactly the height of the URL input */,
            boxSizing: "border-box",
            display: "flex",
            textAlign: "center",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isUploading ? "Uploading..." : "Upload Image"}
        </label>
      </div>
    </div>
  );
};

const buttonStyles = {
  width: "100%",
  maxWidth: "600px",
  marginTop: "2rem",
  padding: "5px",
  fontSize: "16px",
  cursor: "pointer",
};

const SubmitButton = (props) => {
  const { toast, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [remainingChars, setRemainingChars] = useState(80);

  const params = new URLSearchParams(window.location.search);
  const adParam = params.get("isad") === "true";
  const [isAd, setIsAd] = useState(adParam);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = url;

    if (canonicalURL.includes("imagedelivery.net")) {
      embedPreview.innerHTML = `<img src="${DOMPurify.sanitize(
        canonicalURL.includes("/public")
          ? canonicalURL
          : canonicalURL + "/public",
      )}" style="border: 1px solid black; max-width: 100%; max-height: 500px; display: block; margin: 0 auto;" alt="Uploaded image" />`;
      return;
    }

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
      fetch(
        `/api/v1/metadata?url=${encodeURIComponent(
          canonicalURL,
        )}&generateTitle=true`,
      )
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
            document.querySelector(".remaining").style.color =
              remaining > 0 ? "#828282" : "red";
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
        document.querySelector(".remaining").style.color =
          remaining > 0 ? "#828282" : "red";
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
    // Check for emojis in the title
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    if (emojiRegex.test(title)) {
      toast.error("Emojis are not allowed in the title.");
      setIsLoading(false);
      return;
    }

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
        <>
          <button
            id="button-onboarding"
            style={buttonStyles}
            onClick={handleClick}
            disabled={
              isLoading ||
              !isEligible ||
              title.length > 80 ||
              url.length > 2048 ||
              title.length === 0 ||
              url.length === 0 ||
              (!url.startsWith("https://") && !url.startsWith("http://"))
            }
          >
            {isLoading
              ? !localAccount
                ? "Please confirm signature..."
                : "Submitting..."
              : "Submit"}
          </button>
          <p>
            Please <b>only</b> submit Ethereum-related content
          </p>
        </>
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
const adContractAddress = "0xffcc6b6c5c066b23992758a4fc408f09d6cc4eda";

const AdForm = (props) => {
  const titleInputElem = document.getElementById("titleInput");
  const title = titleInputElem.innerText;
  const { isAd, setIsAd, url, toast } = props;
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { switchNetwork } = useSwitchNetwork();
  const [referrer, setReferrer] = useState("");

  const buildURL = (baseURL) => {
    let url;
    try {
      url = new URL(baseURL);
    } catch (err) {
      return baseURL;
    }

    if (referrer?.trim()) {
      const safe = encodeURIComponent(referrer.trim().slice(0, 100));
      url.searchParams.set("kiwi_news_referrer", safe);
    }
    return url.toString();
  };

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
  const [userPriceETH, setUserPriceETH] = useState("");
  const [minAdPrice, setMinAdPrice] = useState(0n);

  const { data: priceData } = useContractRead({
    address: adContractAddress,
    abi: adContractABI,
    functionName: "price",
    chainId: optimism.id,
  });

  useEffect(
    () => setIsValid(userPriceETH > minAdPrice),
    [userPriceETH, minAdPrice],
  );

  useEffect(() => {
    if (priceData) {
      const [nextPrice] = priceData;
      if (nextPrice > minAdPrice) {
        setMinAdPrice(nextPrice + 1n);
      }
    }
  }, [priceData]);

  let parsedUserPrice;
  if (isNaN(userPriceETH)) {
    parsedUserPrice = 0n;
  } else {
    parsedUserPrice = parseEther(userPriceETH);
  }

  const transferFee = minAdPrice === 0n ? 0n : minAdPrice - 1n;
  const finalUrl = buildURL(url);
  const { config, error } = usePrepareContractWrite({
    address: adContractAddress,
    abi: adContractABI,
    functionName: "set",
    args: [title, finalUrl],
    value: parsedUserPrice + transferFee,
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
  const formattedTransferFee = parseFloat(formatEther(transferFee)).toFixed(5);
  const feeDenominator = 2629746n;
  const dailyFee =
    ((parsedUserPrice * (oneEther / feeDenominator)) / oneEther) *
    60n *
    60n *
    24n;
  const formattedDailyFee = parseFloat(formatEther(dailyFee)).toFixed(5);

  const minPriceSet = minAdPrice > parsedUserPrice;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        maxWidth: "600px",
        marginTop: "2rem",
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
          <div
            style={{
              backgroundColor: "var(--background-color0)",
              border: "var(--border)",
              padding: "16px",
              borderRadius: "2px",
              marginTop: "12px",
            }}
          >
            {/* Current Price Display */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                color: "#666",
                fontSize: "14px",
              }}
            >
              <span>Current Price:</span>
              <span>${(formattedTransferFee * ethUSD).toFixed(2)}</span>
            </div>

            {/* Price Input Section */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                Set Your Price
              </span>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginRight: "8px",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder={new Intl.NumberFormat(navigator.language, {
                    style: "decimal",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(0)}
                  value={parseInt(userPrice)}
                  onChange={(e) => {
                    const usdValue = e.target.value;
                    const ethValue = (usdValue / ethUSD).toString();
                    setUserPrice(usdValue);
                    setUserPriceETH(ethValue);
                  }}
                  style={{
                    width: "100px",
                    padding: "6px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    textAlign: "right",
                  }}
                />
              </div>
            </div>

            {/* Cost Breakdown */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#666",
                marginBottom: "12px",
                fontSize: "14px",
              }}
            >
              <span>Your Daily Cost:</span>
              <span>${(userPrice / 30).toFixed(2)}</span>
            </div>

            {/* Total Section */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #ddd",
                paddingTop: "12px",
                fontSize: "14px",
              }}
            >
              <span style={{ fontWeight: "bold" }}>Total Due:</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "bold" }}>
                  $
                  {(
                    formatEther(parsedUserPrice) * ethUSD +
                    formattedTransferFee * ethUSD
                  ).toFixed(2)}
                </div>
                <div style={{ fontSize: "13px", color: "#666" }}>
                  ({formatEther(parsedUserPrice + transferFee).slice(0, 7)} ETH)
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "12px", marginBottom: "10px" }}>
            <label
              style={{
                fontSize: "14px",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Who referred you? (optional)
            </label>
            <input
              type="text"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
            <span style={{ fontSize: "8pt" }}>
              We share 50% of the ad fee income with the person who is named as
              the referrer.
            </span>
          </div>

          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const connected = account && chain && mounted;

              let clickHandler, copy, disabled;
              if (connected) {
                if (chain.id === optimism.id) {
                  disabled =
                    isLoading ||
                    isValid ||
                    (balanceData?.value &&
                      parsedUserPrice + transferFee > balanceData.value);
                  copy = isLoading
                    ? "Please sign transaction"
                    : balanceData?.value &&
                      parsedUserPrice + transferFee > balanceData.value
                    ? `Insufficient balance (${Number(
                        formatEther(parsedUserPrice + transferFee),
                      ).toFixed(5)} ETH)`
                    : `Place ad (${Number(
                        formatEther(parsedUserPrice + transferFee),
                      ).toFixed(5)} ETH)`;
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
                  {isConnected ? (
                    <span style={{ fontSize: "8pt", marginBottom: "10px" }}>
                      Connected with {address} <SimpleDisconnectButton />
                    </span>
                  ) : null}
                  <button
                    id="button-onboarding"
                    style={{ ...buttonStyles, ...{ marginTop: 0 } }}
                    onClick={clickHandler}
                    disabled={disabled}
                  >
                    {copy}
                  </button>
                  <span style={{ fontSize: "10pt" }}>
                    Others can buy your ad spot by paying your set price. You'll
                    receive your remaining balance plus their payment.
                  </span>
                  <br />
                  <br />
                  <br />
                  <br />
                </>
              );
            }}
          </ConnectButton.Custom>
          <b style={{ marginTop: "0.1rem" }}>What is this?</b>
          <p style={{ marginTop: 0 }}>
            Check the forth story on the Kiwi News front page. Notice how it
            says "(sponsored)" next to the submitter's username? That's because
            the forth story on Kiwi News is always an ad.
            <br />
            <br />
            Ads are like regular Kiwi News stories except that they don't need
            to be upvoted to reach the fourth spot on the front page.
          </p>
          <b style={{ marginTop: 0 }}>How does it work?</b>
          <p style={{ marginTop: 0 }}>
            You can set the ad's price, but you have to pay daily fees for
            renting it at that price. We charge 1/30th of the price per day.
            <br />
            <br />
            Let’s say the ad is free and you make it cost $30, it'll cost you
            $1/day to display the ad.
            <br />
            <br />
            Others can buy the ad at the current price. When they buy you'll get
            your left over collateral back and the price at which the ad sold.
            <br />
            <br />
            Say someone bought you ad at day 15 (price $15), then you'll get
            your $15 worth of collateral back, and $15 from the buyer.
          </p>
          <b style={{ marginTop: 0 }}>
            What if I want my collateral back earlier?
          </b>
          <p style={{ marginTop: 0 }}>
            You can technically buy your own ad and set the new price to 1 Wei.
            But this means you're going to sell the ad space very cheaply!
          </p>
          <b style={{ marginTop: 0 }}>Is this safe?</b>
          <p style={{ marginTop: 0 }}>
            The contract has been written by timdaub.eth. Some folks from the
            Rico Credit System audited the math a while ago. But please bear in
            mind that it’s still experimental, so don't put more than you can
            afford to lose.
          </p>
          <b style={{ marginTop: 0 }}>I have more questions!</b>
          <p style={{ marginTop: 0 }}>
            Reach out on our groupchat or DM @timdaub on telegram.
          </p>
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
        <UrlInput url={url} setURL={setURL} toast={toast} />
        <SubmitButton {...props} url={url} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
