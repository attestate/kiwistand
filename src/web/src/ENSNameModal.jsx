import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import Modal from "react-modal";
import { useAccount } from "wagmi";
import { getLocalAccount } from "./session.mjs";

if (document.querySelector("nav-ens-name-modal")) {
  Modal.setAppElement("nav-ens-name-modal");
}

async function checkENSName(address) {
  // Check Namestone for an existing .kiwinews.eth subname
  try {
    const res = await fetch(`/api/v1/ens-name?address=${encodeURIComponent(address)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return json.data[0];
      }
    }
  } catch {}

  // Check for a mainnet ENS name (reverse record)
  try {
    const res = await fetch(`https://enstate.rs/a/${address}`);
    if (res.ok) {
      const data = await res.json();
      if (data.name) return data;
    }
  } catch {}

  return null;
}

const ENSNameModal = forwardRef((props, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const account = useAccount();
  // After page reload wagmi's reconnect is async (reconnectOnMount=false),
  // so account.address may be undefined even though the delegation key is
  // already in localStorage. Fall back to the locally stored identity.
  const localAccount = getLocalAccount(account.address);
  const address = account.address || (localAccount ? localAccount.identity : null);

  const { toast } = props;

  const MODAL_DISMISSED_KEY = `ens-name-modal-dismissed-${address}`;

  function closeModal() {
    setShowModal(false);
    if (address) {
      localStorage.setItem(MODAL_DISMISSED_KEY, "true");
    }
  }

  // Auto-open after delegation completes (detected via localStorage flag)
  useEffect(() => {
    if (!address) return;

    const shouldShow = localStorage.getItem("show-ens-name-modal") === "true";
    if (!shouldShow) return;

    localStorage.removeItem("show-ens-name-modal");

    const wasDismissed = localStorage.getItem(MODAL_DISMISSED_KEY) === "true";
    if (wasDismissed) return;

    checkENSName(address).then((existing) => {
      if (!existing) {
        setShowModal(true);
      }
    });
  }, [address]);

  useImperativeHandle(ref, () => ({
    openAfterDelegation: () => {
      if (!address) return;

      const wasDismissed = localStorage.getItem(MODAL_DISMISSED_KEY) === "true";
      if (wasDismissed) return;

      checkENSName(address).then((existing) => {
        if (!existing) {
          setShowModal(true);
        }
      });
    },
  }));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);

    let tokenData;
    try {
      const tokenResponse = await fetch("/api/v1/image-upload-token");
      if (!tokenResponse.ok) {
        toast.error("Failed to get upload token");
        setIsUploading(false);
        return;
      }
      tokenData = await tokenResponse.json();
    } catch (err) {
      toast.error("Failed to connect to upload service");
      setIsUploading(false);
      return;
    }

    const { uploadURL } = tokenData.data;
    const formData = new FormData();
    formData.append("file", file);

    let uploadResponse;
    try {
      uploadResponse = await fetch(uploadURL, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      toast.error("Failed to upload image");
      setIsUploading(false);
      return;
    }

    if (!uploadResponse.ok) {
      toast.error("Failed to upload image");
      setIsUploading(false);
      return;
    }

    const imageId = tokenData.data.id;
    const accountHash = uploadURL.split("/").slice(-2)[0];
    const imageUrl = `https://imagedelivery.net/${accountHash}/${imageId}/public`;

    setAvatarUrl(imageUrl);
    setIsUploading(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    if (!address) {
      setError("Wallet not connected. Please reconnect and try again.");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError("Name can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const body = {
      name: name.toLowerCase(),
      address: address,
    };
    if (avatarUrl) {
      body.avatar = avatarUrl;
    }

    let response;
    try {
      response = await fetch("/api/v1/ens-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      setError("Failed to connect. Please try again.");
      setIsSubmitting(false);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      setError("Unexpected response. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      setError(data.details || "Failed to create profile");
      setIsSubmitting(false);
      return;
    }

    setIsSuccess(true);
    toast.success("Profile created!");
    setTimeout(() => {
      closeModal();
      setIsSuccess(false);
      setName("");
      setAvatarUrl("");
    }, 2000);
    setIsSubmitting(false);
  };

  const customStyles = {
    overlay: {
      backgroundColor: "var(--bg-overlay)",
      zIndex: 1000,
    },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      backgroundColor: "var(--bg-white)",
      border: "var(--border-subtle)",
      overflow: "hidden",
      WebkitOverflowScrolling: "touch",
      borderRadius: "2px",
      outline: "none",
      padding: "0",
      position: "absolute",
      top: "16px",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translateX(-50%)",
      maxWidth: "360px",
      minWidth: "360px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      zIndex: 1001,
    },
  };

  if (window.innerWidth < 480) {
    customStyles.content = {
      ...customStyles.content,
      top: "auto",
      left: "0",
      right: "0",
      bottom: "0",
      transform: "none",
      maxWidth: "460px",
      minWidth: "360px",
      margin: "0 auto",
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0",
      borderBottom: "none",
    };
  }

  const VerifiedIcon = () => (
    <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "16px", width: "16px", color: "var(--accent-primary)" }}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76"></path>
        <path d="m9 12l2 2l4-4"></path>
      </g>
    </svg>
  );

  const CloseIcon = () => (
    <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "18px", width: "18px" }}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12"></path>
    </svg>
  );

  const SparkleIcon = () => (
    <svg viewBox="0 0 256 256" width="1.2em" height="1.2em" style={{ width: "18px", height: "18px" }}>
      <path fill="currentColor" d="m230.86 109.25l-61.68-22.43l-22.43-61.68a19.95 19.95 0 0 0-37.5 0L86.82 86.82l-61.68 22.43a19.95 19.95 0 0 0 0 37.5l61.68 22.43l22.43 61.68a19.95 19.95 0 0 0 37.5 0l22.43-61.68l61.68-22.43a19.95 19.95 0 0 0 0-37.5m-75.14 39.29a12 12 0 0 0-7.18 7.18L128 212.21l-20.54-56.49a12 12 0 0 0-7.18-7.18L43.79 128l56.49-20.54a12 12 0 0 0 7.18-7.18L128 43.79l20.54 56.49a12 12 0 0 0 7.18 7.18L212.21 128Z"></path>
    </svg>
  );

  const domain = typeof window !== "undefined" ? window.location.hostname : "kiwistand.com";
  const domainParts = domain.split(".");
  const subdomain = domainParts.length > 2 ? domainParts[0] : "";
  const mainDomain = domainParts.length > 2 ? domainParts.slice(1).join(".") : domain;

  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isButtonActive, setIsButtonActive] = useState(false);

  return (
    <Modal
      isOpen={showModal}
      contentLabel="Create Profile"
      shouldCloseOnOverlayClick={false}
      style={customStyles}
      closeTimeoutMS={0}
    >
      {/* Porto-style header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "33px",
        borderBottom: "var(--border-subtle)",
        padding: "0 0 0 12px",
        userSelect: "none",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        width: "100%",
        backgroundColor: "var(--bg-white)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            fontSize: "13px",
            gap: "8px",
          }}>
            <div style={{
              borderRadius: "2px",
              height: "20px",
              width: "20px",
              overflow: "hidden",
            }}>
              <img height="20" width="20" alt="" src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='20'%20height='20'%20fill='none'%3e%3cpath%20fill='%23D9D9D9'%20d='M0%200h20v20H0z'/%3e%3cg%20stroke='%23000'%20stroke-linecap='round'%20stroke-linejoin='round'%20clip-path='url(%23a)'%3e%3cpath%20d='M15.565%2011.75h-2.648a1.167%201.167%200%200%200-1.167%201.167v2.648M7.083%204.948v.969a1.75%201.75%200%200%200%201.75%201.75A1.167%201.167%200%200%201%2010%208.833a1.167%201.167%200%201%200%202.333%200A1.17%201.17%200%200%201%2013.5%207.667h1.849m-5.932%208.137V13.5a1.167%201.167%200%200%200-1.167-1.167%201.167%201.167%200%200%201-1.166-1.166v-.584a1.167%201.167%200%200%200-1.167-1.166h-1.72'/%3e%3cpath%20d='M10%2015.833a5.833%205.833%200%201%200%200-11.666%205.833%205.833%200%200%200%200%2011.666Z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='a'%3e%3cpath%20fill='%23fff'%20d='M3%203h14v14H3z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e" />
            </div>
            <div style={{ fontSize: "14px", lineHeight: "22px", fontWeight: "normal" }}>
              <div style={{ display: "flex", overflow: "hidden" }} title={`https://${domain}/`}>
                {subdomain && (
                  <>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{subdomain}</div>
                    <div>.</div>
                  </>
                )}
                <div>{mainDomain}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VerifiedIcon />
            </div>
          </div>
        </div>
        <button
          onClick={closeModal}
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "0 6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            borderTopRightRadius: "2px",
          }}
          title="Close Dialog"
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div style={{
        backgroundColor: "transparent",
        maxWidth: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        borderRadius: "0",
        boxShadow: "none",
        border: "none",
        fontSize: "15px",
        lineHeight: "1.325",
        fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      }}>
        {/* Title section */}
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--color-porto-bg)",
                color: "var(--color-porto-blue)",
              }}>
                <SparkleIcon />
              </div>
              <div style={{ fontSize: "18px", fontWeight: "500", color: "var(--text-primary)" }}>
                {isSuccess ? "You're all set!" : "Create your profile"}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ flexGrow: 1, padding: "0 12px 12px" }}>
          <div style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: "22px" }}>
            {isSuccess
              ? "Your profile is live! Others can now find you on Kiwi News."
              : "Pick a display name and avatar so others can recognize you"
            }
          </div>
        </div>

        {!isSuccess && (
          <>
            {/* Name input */}
            <div style={{ padding: "0 12px 12px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                border: "var(--border-subtle)",
                borderRadius: "8px",
                overflow: "hidden",
              }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="yourname"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    padding: "10px 12px",
                    fontSize: "15px",
                    backgroundColor: "transparent",
                    color: "var(--text-primary)",
                  }}
                />
                <div style={{
                  padding: "10px 12px",
                  fontSize: "15px",
                  color: "var(--text-tertiary)",
                  borderLeft: "var(--border-subtle)",
                  whiteSpace: "nowrap",
                  backgroundColor: "var(--bg-hover-subtle)",
                }}>
                  .kiwinews.eth
                </div>
              </div>
              {error && (
                <div style={{
                  color: "var(--color-error, #e53e3e)",
                  fontSize: "13px",
                  marginTop: "6px",
                  padding: "0 2px",
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* Avatar upload */}
            <div style={{ padding: "0 12px 12px" }}>
              <div style={{
                fontSize: "13px",
                color: "var(--text-tertiary)",
                marginBottom: "6px",
              }}>
                Profile picture (optional)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "2px",
                      border: "var(--border-subtle)",
                      objectFit: "cover",
                    }}
                  />
                )}
                <label style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "34px",
                  padding: "0 14px",
                  backgroundColor: "var(--bg-hover-subtle)",
                  border: "var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  cursor: isUploading ? "default" : "pointer",
                  opacity: isUploading ? 0.6 : 1,
                }}>
                  {isUploading ? "Uploading..." : avatarUrl ? "Change" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            {/* Submit button */}
            <div style={{
              display: "flex",
              minHeight: "48px",
              width: "100%",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              paddingBottom: "12px",
            }}>
              <div style={{
                display: "flex",
                width: "100%",
                gap: "8px",
              }}>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !name.trim() || !address}
                  onMouseEnter={() => setIsButtonHovered(true)}
                  onMouseLeave={() => {
                    setIsButtonHovered(false);
                    setIsButtonActive(false);
                  }}
                  onMouseDown={() => setIsButtonActive(true)}
                  onMouseUp={() => setIsButtonActive(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    height: "38px",
                    backgroundColor: isSubmitting || !name.trim() || !address
                      ? "var(--bg-hover)"
                      : isButtonHovered
                      ? "var(--accent-primary-hover)"
                      : "var(--accent-primary)",
                    border: isSubmitting || !name.trim() || !address
                      ? "1px solid var(--bg-hover)"
                      : isButtonHovered
                      ? "1px solid var(--accent-primary-hover)"
                      : "1px solid var(--accent-primary)",
                    color: "var(--text-primary)",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: "normal",
                    cursor: isSubmitting || !name.trim() || !address ? "default" : "pointer",
                    opacity: isSubmitting || !name.trim() || !address ? 0.6 : 1,
                    transform: isButtonActive ? "translateY(1px)" : "translateY(0)",
                    transition: "background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease",
                    margin: "0 16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isSubmitting ? "Creating..." : !address ? "Connecting wallet..." : "Create profile"}
                </button>
              </div>

              {/* Account section */}
              <div style={{
                display: "flex",
                height: "100%",
                width: "100%",
                boxSizing: "border-box",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "var(--border-subtle)",
                padding: "12px 4px 0",
              }}>
                <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Account</div>
                <button
                  disabled
                  type="button"
                  style={{
                    margin: "-4px -8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    background: "transparent",
                    border: "none",
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "500",
                      fontSize: "14px",
                      color: "var(--text-primary)"
                    }}
                    title={address}
                  >
                    {address ? `${address.slice(0, 6)}…${address.slice(-6)}` : ""}
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
});

ENSNameModal.displayName = "ENSNameModal";

export default ENSNameModal;
