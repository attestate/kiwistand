import { Wallet } from "@ethersproject/wallet";

export function setCookie(name, value, maxAge = 60 * 60 * 24 * 7) {
  // Always try to set cookie for backward compatibility
  try {
    document.cookie = `${name}=${value};path=/;max-age=${maxAge}`;
  } catch (e) {
    // Cookies might be blocked in some contexts
  }
  
  // Always store in localStorage as well (primary storage in iframe context)
  try {
    localStorage.setItem(name, value);
  } catch (e) {
    console.warn("Could not store to localStorage:", e);
  }
}

export function getCookie(name) {
  // Try cookie first
  const matches = document.cookie.match(
    new RegExp(
      "(?:^|; )" +
        name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") +
        "=([^;]*)",
    ),
  );
  
  if (matches) {
    return decodeURIComponent(matches[1]);
  }
  
  // Fallback to localStorage (for iframe context where cookies are blocked)
  try {
    const value = localStorage.getItem(name);
    if (value) return value;
    
    // For identity, also try extracting from wallet key if not stored separately
    if (name === "identity") {
      const schema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/;
      const keys = Object.keys(localStorage).filter(k => k.match(schema));
      if (keys.length > 0) {
        const match = keys[0].match(schema);
        return match ? match[1] : undefined;
      }
    }
  } catch (e) {
    // localStorage might be blocked
  }
  
  return undefined;
}

export const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60;

// Cache anon wallet per page session to avoid infinite re-renders
let _sessionAnonWallet = null;

export function getLocalAccount(identity) {
  // Check for anon mode first - if enabled, return same wallet for this page session
  const isAnonMode = localStorage.getItem('anon-mode') === 'true';
  if (isAnonMode) {
    // Use cached wallet for this page session, create new one only if not exists
    if (!_sessionAnonWallet) {
      const wallet = Wallet.createRandom();
      _sessionAnonWallet = {
        identity: wallet.address,
        privateKey: wallet.privateKey,
        signer: wallet.address,
      };
    }
    return _sessionAnonWallet;
  }

  const schema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/;
  const keys = Object.entries(localStorage).reduce((obj, [key, value]) => {
    const match = key.match(schema);
    if (match) {
      const addr = match[1];
      obj[addr] = value;
    }
    return obj;
  }, {});

  if (Object.keys(keys).length === 1) {
    const [[key, value]] = Object.entries(keys);
    if (identity && key !== identity) {
      return;
    }

    setCookie("identity", key, tenYearsInSeconds);
    const signer = new Wallet(value);
    return { identity: key, privateKey: value, signer: signer.address };
  }
  // NOTE: When there are several keys in localStorage and the caller didn't
  // pass an identity (e.g. no wallet connected), fall back to the wallet-less
  // local account if the user created or restored one.
  const localAccountAddress = getLocalAccountAddress();
  if (
    Object.keys(keys).length > 1 &&
    !identity &&
    localAccountAddress &&
    keys[localAccountAddress]
  ) {
    identity = localAccountAddress;
  }

  if (Object.keys(keys).length > 1 && identity && keys[identity]) {
    const signer = new Wallet(keys[identity]);
    setCookie("identity", identity, tenYearsInSeconds);
    return {
      identity,
      privateKey: keys[identity],
      signer: signer.address,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Wallet-less local accounts
//
// A local account is a secp256k1 key generated in the browser. Nodes accept
// any validly signed EIP-712 message and `resolveIdentity(delegations, signer)`
// returns the signer itself when it has no delegation, so the key's own
// address IS the user's identity - no onchain transaction, no gas, no wallet.
//
// The private key is stored under the same `-kiwi-news-<identity>-key` schema
// used for delegated app keys (with <identity> = the key's own address), so
// every existing signing path (Vote, CommentInput, SubmitButton, Bell, ...)
// picks it up through getLocalAccount() without changes.
// ---------------------------------------------------------------------------
const LOCAL_ACCOUNT_MARKER = "-kiwi-news-local-account";
const LOCAL_ACCOUNT_BACKED_UP = "-kiwi-news-local-account-backed-up";
const ACCOUNT_CREATED_FLAG = "-kiwi-news-account-created";

function keyStorageName(address) {
  return `-kiwi-news-${address}-key`;
}

function mnemonicStorageName(address) {
  return `-kiwi-news-${address}-mnemonic`;
}

export function getLocalAccountAddress() {
  try {
    const address = localStorage.getItem(LOCAL_ACCOUNT_MARKER);
    if (address && localStorage.getItem(keyStorageName(address))) {
      return address;
    }
  } catch (err) {}
  return null;
}

function saveLocalAccount(wallet, phrase) {
  const { address, privateKey } = wallet;
  // A local account replaces anon mode (whose wallet is per page session)
  localStorage.removeItem("anon-mode");
  localStorage.setItem(keyStorageName(address), privateKey);
  if (phrase) {
    localStorage.setItem(mnemonicStorageName(address), phrase);
  } else {
    localStorage.removeItem(mnemonicStorageName(address));
  }
  localStorage.setItem(LOCAL_ACCOUNT_MARKER, address);
  setCookie("identity", address, tenYearsInSeconds);
  return { address, privateKey, phrase };
}

// Generates a brand new wallet-less account and stores it in this browser.
export function createLocalAccount() {
  const wallet = Wallet.createRandom();
  const phrase = wallet.mnemonic && wallet.mnemonic.phrase;
  localStorage.removeItem(LOCAL_ACCOUNT_BACKED_UP);
  return saveLocalAccount(wallet, phrase);
}

export function normalizeRecoveryInput(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

// Restores an account from a 12-word recovery phrase (or a raw private key).
export function restoreLocalAccount(input) {
  const normalized = normalizeRecoveryInput(input);
  if (!normalized) throw new Error("Please enter your recovery phrase");

  let wallet;
  let phrase;
  if (/^(0x)?[0-9a-f]{64}$/.test(normalized)) {
    const key = normalized.startsWith("0x") ? normalized : `0x${normalized}`;
    wallet = new Wallet(key);
  } else {
    try {
      wallet = Wallet.fromMnemonic(normalized);
    } catch (err) {
      throw new Error(
        "That doesn't look like a valid recovery phrase. Check the words and their order.",
      );
    }
    phrase = normalized;
  }
  // The user evidently has the backup, so don't nag them again.
  localStorage.setItem(LOCAL_ACCOUNT_BACKED_UP, "true");
  return saveLocalAccount(wallet, phrase);
}

// Returns the recovery material of the wallet-less account, if there is one.
export function getLocalAccountBackup() {
  const address = getLocalAccountAddress();
  if (!address) return null;
  return {
    address,
    privateKey: localStorage.getItem(keyStorageName(address)),
    phrase: localStorage.getItem(mnemonicStorageName(address)),
    backedUp: localStorage.getItem(LOCAL_ACCOUNT_BACKED_UP) === "true",
  };
}

export function markLocalAccountBackedUp() {
  try {
    localStorage.setItem(LOCAL_ACCOUNT_BACKED_UP, "true");
  } catch (err) {}
}

// Called right before reloading after account creation, so that the next page
// load can announce the new account (see announceAccountCreated).
export function flagAccountCreated(address) {
  try {
    localStorage.setItem(ACCOUNT_CREATED_FLAG, address);
  } catch (err) {}
}

// Runs once on the first page load after a wallet-less account was created.
// If a name modal entry point is available it's opened directly; otherwise a
// `kiwi:account-created` window event is dispatched (detail: { address }) and
// `window.kiwiAccountCreated` is set so late listeners can still pick it up.
export function announceAccountCreated() {
  let address;
  try {
    address = localStorage.getItem(ACCOUNT_CREATED_FLAG);
    if (!address) return;
    localStorage.removeItem(ACCOUNT_CREATED_FLAG);
  } catch (err) {
    return;
  }

  const detail = { address };
  window.kiwiAccountCreated = detail;
  const opener =
    (typeof window.openNameModal === "function" && window.openNameModal) ||
    (typeof window.showENSNameModal === "function" && window.showENSNameModal);
  if (opener) {
    try {
      opener(detail);
    } catch (err) {
      console.error("Could not open name modal:", err);
    }
  }
  window.dispatchEvent(new CustomEvent("kiwi:account-created", { detail }));
}

export function isIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  return iOS;
}

export function isIOSApp() {
  return document.documentElement.classList.contains("kiwi-ios-app");
}

export function isFirefox() {
  const ua = navigator.userAgent;
  return !!ua.match(/Firefox/i);
}

export function isLinux() {
  const platform = navigator.platform;
  return !!platform.match(/Linux/i);
}

export function isBraveOnIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const brave = !!ua.match(/Brave/i);
  return iOS && brave;
}

export function isChromeOnIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const chrome = !!ua.match(/Chrome/i);
  return iOS && chrome;
}


export function isAndroid() {
  const ua = navigator.userAgent;
  const android = !!ua.match(/Android/i);
  return android;
}

export function isSafariOnMacOS() {
  const ua = navigator.userAgent;
  const macOS = !!ua.match(/Macintosh/i);
  const safari = !!ua.match(/Safari/i) && !ua.match(/Chrome/i);
  return macOS && safari;
}

export function isSafariOnIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  return iOS && webkit;
}

export function isChromeOnAndroid() {
  const ua = navigator.userAgent;
  const chrome = !!ua.match(/Chrome/i);
  return isAndroid() && chrome;
}

export function isRunningPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone ||
    document.referrer.includes("android-app://")
  );
}

// Check if user has a single localStorage wallet key (logged in without wallet connection)
export function hasSingleLocalStorageKey() {
  const schema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/;
  const keys = Object.keys(localStorage).filter(k => k.match(schema));
  return keys.length === 1;
}

export function hasStaleDelegationKeys() {
  const delegationSchema = /^delegation-modal-dismissed-0x[a-fA-F0-9]{40}$/;
  return Object.keys(localStorage).some(k => k.match(delegationSchema));
}

// Logout that clears essential session data and disconnects wallet.
//
// NOTE: A wallet-less local account only exists in this browser, so deleting
// its key without a backup loses the account for good. Unless called with
// { force: true }, we first show a warning that offers the recovery phrase.
export async function logout(options) {
  const force = !!(options && options.force === true);
  if (!force && getLocalAccountBackup()) {
    try {
      const { openAccountModal } = await import("./AccountModal.jsx");
      openAccountModal("logout");
      return;
    } catch (err) {
      console.error("Could not open logout warning:", err);
      const confirmed = window.confirm(
        "Your Kiwi account only exists in this browser. If you haven't saved your recovery phrase, logging out deletes your account forever. Log out anyway?",
      );
      if (!confirmed) return;
    }
  }

  // Disconnect wallet if connected
  try {
    const { disconnect } = await import('@wagmi/core');
    const { client } = await import('./client.mjs');
    await disconnect(client);
  } catch (err) {
    console.log('Could not disconnect wallet:', err);
  }

  // Clear wallet key(s) from localStorage
  const walletKeySchema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/;
  // Clear delegation modal dismissed flags
  const delegationModalSchema = /^delegation-modal-dismissed-0x[a-fA-F0-9]{40}$/;

  Object.keys(localStorage).forEach(key => {
    if (key.match(walletKeySchema) || key.match(delegationModalSchema)) {
      localStorage.removeItem(key);
    }
  });

  // Clear wallet-less local account data (recovery phrase and markers)
  const mnemonicSchema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-mnemonic$/;
  Object.keys(localStorage).forEach((key) => {
    if (key.match(mnemonicSchema)) localStorage.removeItem(key);
  });
  localStorage.removeItem(LOCAL_ACCOUNT_MARKER);
  localStorage.removeItem(LOCAL_ACCOUNT_BACKED_UP);
  localStorage.removeItem(ACCOUNT_CREATED_FLAG);

  // Clear identity and lastUpdate from localStorage (fallback storage)
  localStorage.removeItem('identity');
  localStorage.removeItem('lastUpdate');

  // Clear anon-mode flag
  localStorage.removeItem('anon-mode');

  // Clear identity and lastUpdate cookies
  document.cookie = 'identity=;path=/;max-age=0';
  document.cookie = 'lastUpdate=;path=/;max-age=0';

  // Reload the page to reset app state
  window.location.reload();
}

// Helper to add auth params to URLs in mini app context
export function addAuthParams(url) {
  // Only modify URLs in iframe/mini app context
  if (window.parent === window && !window.location.search.includes('miniapp=true')) {
    return url;
  }

  try {
    const urlObj = new URL(url, window.location.origin);
    const identity = getCookie("identity");

    // Always preserve miniapp param
    if (window.location.search.includes('miniapp=true')) {
      urlObj.searchParams.set('miniapp', 'true');
    }

    // Add identity if available and it's a protected path
    const protectedPaths = ['/profile', '/submit', '/upvotes'];
    const needsAuth = protectedPaths.some(path => urlObj.pathname.startsWith(path));

    if (identity && needsAuth) {
      urlObj.searchParams.set('identity', identity);
    }

    return urlObj.pathname + urlObj.search;
  } catch (e) {
    return url;
  }
}
