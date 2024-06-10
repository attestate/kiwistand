import { Wallet } from "@ethersproject/wallet";

export function setCookie(name, value, maxAge = 60 * 60 * 24 * 7) {
  document.cookie = `${name}=${value};path=/;max-age=${maxAge}`;
}

export function getCookie(name) {
  const matches = document.cookie.match(
    new RegExp(
      "(?:^|; )" +
        name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") +
        "=([^;]*)",
    ),
  );
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

export function getLocalAccount(identity, allowlist) {
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
    if (
      (identity && key !== identity) ||
      (allowlist && !allowlist.includes(key)) ||
      !allowlist
    )
      return;

    // TODO: We can probably remove this
    setCookie("identity", key);
    const signer = new Wallet(value);
    return { identity: key, privateKey: value, signer: signer.address };
  }
  if (Object.keys(keys).length > 1 && identity && keys[identity]) {
    const signer = new Wallet(keys[identity]);
    return {
      identity,
      privateKey: keys[identity],
      signer: signer.address,
    };
  }

  // TODO: We can probably remove this
  if (Object.keys(keys).length === 0 && identity) {
    setCookie("identity", identity);
  }
  return null;
}

export function isIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  return iOS;
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

export function supportsPasskeys() {
  return (
    isSafariOnMacOS() || isSafariOnIOS() || isBraveOnIOS() || isChromeOnIOS()
  );
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
  const android = !!ua.match(/Android/i);
  const chrome = !!ua.match(/Chrome/i);
  return android && chrome;
}

export function isRunningPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone ||
    document.referrer.includes("android-app://")
  );
}
