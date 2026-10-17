// @format
import test from "ava";

import {
  sizedImageUrl,
  getImageLoading,
} from "../src/views/utils/imageLoading.mjs";

test("a Cloudflare Images /public URL asks for the shown width", (t) => {
  t.is(
    sizedImageUrl(
      "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/ee77e789-f769-4ce5-452b-c0d90744e400/public",
      480,
    ),
    "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/ee77e789-f769-4ce5-452b-c0d90744e400/w=480,fit=scale-down,f=auto",
  );
});

test("a Farcaster /original avatar asks for the shown width", (t) => {
  t.is(
    sizedImageUrl(
      "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/a43231ca-1d8d-4563-c9b3-6a8e934c2a00/original",
      72,
    ),
    "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/a43231ca-1d8d-4563-c9b3-6a8e934c2a00/w=72,fit=scale-down,f=auto",
  );
});

test("a URL that already names a size or another variant is kept", (t) => {
  const flexible =
    "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/abc/w=600,q=80,fit=cover,f=auto";
  t.is(sizedImageUrl(flexible, 72), flexible);
  const named = "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/abc/rectcrop3";
  t.is(sizedImageUrl(named, 72), named);
});

test("other hosts are left alone, except Twitter's originals", (t) => {
  t.is(
    sizedImageUrl("https://api.ensdata.net/media/avatar/timdaub.eth", 72),
    "https://api.ensdata.net/media/avatar/timdaub.eth",
  );
  t.is(
    sizedImageUrl("https://pbs.twimg.com/media/x?format=jpg&name=orig", 600),
    "https://pbs.twimg.com/media/x?format=jpg&name=large",
  );
  t.is(sizedImageUrl("not a url", 72), "not a url");
  t.is(sizedImageUrl(undefined, 72), undefined);
});

test("only above-the-fold images on our CDN load eagerly", (t) => {
  const ours = "https://imagedelivery.net/a/b/w=600,fit=scale-down,f=auto";
  t.is(getImageLoading(true, ours), "eager");
  t.is(getImageLoading(false, ours), "lazy");
  t.is(getImageLoading(true, "https://api.ensdata.net/media/avatar/x"), "lazy");
});
