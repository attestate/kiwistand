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

export function getLocalAccount(identity) {
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

export function isIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  return iOS;
}

export function isIOSApp() {
  return document.documentElement.classList.contains("kiwi-ios-app");
}

export function isAndroid() {
  const ua = navigator.userAgent;
  const android = !!ua.match(/Android/i);
  return android;
}

export function isSafariOnIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  return iOS && webkit;
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

// Logout that clears essential session data and disconnects wallet
export async function logout() {
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

  // Clear identity and lastUpdate from localStorage (fallback storage)
  localStorage.removeItem('identity');
  localStorage.removeItem('lastUpdate');

  // Clear identity and lastUpdate cookies
  document.cookie = 'identity=;path=/;max-age=0';
  document.cookie = 'lastUpdate=;path=/;max-age=0';

  // Reload the page to reset app state
  window.location.reload();
}

// NOTE: The header's islands (Bell.jsx on desktop and in the tab bar) are
// separate React roots that read the account from localStorage and cookies
// when they render. After a login that happens without a page load (the
// onboarding: passkey sign-in, new account, wallet), announceAccountChange()
// makes them read it again, so the bell and avatar show up in place.
export const ACCOUNT_CHANGE_EVENT = "kiwi-account-change";

export function announceAccountChange() {
  try {
    document.documentElement.removeAttribute("data-signed-out");
    document.documentElement.classList.remove("kn-no-account");
    document.body.classList.add("kiwi-logged-in");
  } catch (err) {}
  window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
}
