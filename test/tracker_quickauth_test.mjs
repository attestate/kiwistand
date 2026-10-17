// @format
import test from "ava";

import {
  getAuthHeadersIfAvailable,
  resetMiniAppCheck,
} from "../src/web/src/tracker.mjs";

function fakeSdk({ inMiniApp, token = "jwt" }) {
  const calls = { isInMiniApp: 0, getToken: 0 };
  return {
    calls,
    isInMiniApp: async () => {
      calls.isInMiniApp++;
      return inMiniApp;
    },
    quickAuth: {
      getToken: async () => {
        calls.getToken++;
        return { token };
      },
    },
  };
}

test.beforeEach(() => resetMiniAppCheck());

test.serial("outside a mini app no Quick Auth token is requested", async (t) => {
  const sdk = fakeSdk({ inMiniApp: false });
  t.deepEqual(await getAuthHeadersIfAvailable(sdk), {});
  t.deepEqual(await getAuthHeadersIfAvailable(sdk), {});
  t.is(sdk.calls.getToken, 0);
  // The host is asked once per page.
  t.is(sdk.calls.isInMiniApp, 1);
});

test.serial("inside a mini app the Quick Auth token becomes a bearer header", async (t) => {
  const sdk = fakeSdk({ inMiniApp: true, token: "abc" });
  t.deepEqual(await getAuthHeadersIfAvailable(sdk), {
    Authorization: "Bearer abc",
  });
  t.is(sdk.calls.getToken, 1);
});

test.serial("a failing mini app check or token counts as no token", async (t) => {
  const broken = {
    isInMiniApp: async () => {
      throw new Error("no host");
    },
    quickAuth: { getToken: async () => ({ token: "x" }) },
  };
  t.deepEqual(await getAuthHeadersIfAvailable(broken), {});

  resetMiniAppCheck();
  const failing = {
    isInMiniApp: async () => true,
    quickAuth: {
      getToken: async () => {
        throw new TypeError("reading 'result'");
      },
    },
  };
  t.deepEqual(await getAuthHeadersIfAvailable(failing), {});
  t.deepEqual(await getAuthHeadersIfAvailable(undefined), {});
});
