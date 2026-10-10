// @format
import test from "ava";

import {
  cleanText,
  clip,
  storyDescription,
  storyDocumentTitle,
  usableArticleDescription,
  DESC_MAX,
} from "../src/seo.mjs";
import { custom } from "../src/views/components/head.mjs";

const SUMMARY =
  "Artizen, a crypto fundraising platform used by Bread and its partners, has ceased operations, according to a post from Bread. Founder René Pinnell has suffered medical emergencies and stepped away.";

test("cleanText strips markup, entities, URLs and line breaks", (t) => {
  t.is(
    cleanText(
      "Gnosis bridges now use FCR.<br><br>Starting today &amp; more:\n\nhttps://x.com/a/b  done",
    ),
    "Gnosis bridges now use FCR. Starting today & more: done",
  );
  t.is(cleanText(null), "");
});

test("clip keeps whole sentences that fit", (t) => {
  const out = clip(SUMMARY);
  t.is(
    out,
    "Artizen, a crypto fundraising platform used by Bread and its partners, has ceased operations, according to a post from Bread.",
  );
  t.true(out.length <= DESC_MAX);
});

test("clip cuts a long first sentence at a word with an ellipsis", (t) => {
  const long = `${"word ".repeat(60).trim()}. Second sentence.`;
  const out = clip(long);
  t.true(out.length <= DESC_MAX);
  t.true(out.endsWith("word…"));
});

test("clip doesn't split at one-letter abbreviations", (t) => {
  const text =
    "The U.S. Treasury sanctioned a mixer on Monday after a long investigation into the service and its operators. A second sentence follows here and is long enough to not fit anymore.";
  t.true(
    clip(text).startsWith("The U.S. Treasury sanctioned a mixer on Monday"),
  );
});

test("storyDescription prefers the summary over the publisher's description", (t) => {
  t.is(
    storyDescription({
      title: "Artizen has Ceased Operations",
      href: "https://paragraph.com/@breadcoop/artizen",
      summary: SUMMARY,
      articleDescription: "Here's what we know, and how to chase your refund.",
    }),
    clip(SUMMARY),
  );
});

test("storyDescription without a summary uses a cleaned publisher description", (t) => {
  t.is(
    storyDescription({
      title: "Binance Stablecoin Reserves Surpass $45B",
      href: "https://watcher.guru/news/binance",
      summary: null,
      articleDescription:
        "Binance's stablecoin reserves have now surpassed $45 billion, holding 65% of all stablecoins on centralized exchanges.",
    }),
    "Binance's stablecoin reserves have now surpassed $45 billion, holding 65% of all stablecoins on centralized exchanges.",
  );
});

test("storyDescription skips boilerplate and pads short descriptions", (t) => {
  t.is(
    usableArticleDescription(
      "GitHub Gist: instantly share code, notes, and snippets.",
      "Town Hall",
    ),
    "",
  );
  t.is(usableArticleDescription("Available on iOS", "Anon beta"), "");
  t.is(
    storyDescription({
      title: "GrapheneOS donations",
      href: "https://grapheneos.org/donate",
      articleDescription: "Donating to support development of GrapheneOS.",
    }),
    "Donating to support development of GrapheneOS. Shared from grapheneos.org and discussed on Kiwi News.",
  );
});

test("storyDescription falls back to the title and the link's host", (t) => {
  t.is(
    storyDescription({
      title: "Aether OS",
      href: "https://aetheros.computer",
      summary: null,
      articleDescription: undefined,
    }),
    "Aether OS. Shared from aetheros.computer and discussed on Kiwi News, the community-curated crypto and Ethereum news feed.",
  );
  const long = storyDescription({
    title:
      "Apple Issues Security Updates After Two WebKit Flaws Found Exploited in the Wild",
    href: "https://thehackernews.com/2025/12/apple.html",
  });
  t.is(
    long,
    "Apple Issues Security Updates After Two WebKit Flaws Found Exploited in the Wild. Shared from thehackernews.com and discussed on Kiwi News.",
  );
  t.true(long.length <= DESC_MAX);
});

test("storyDescription uses a text post's text", (t) => {
  t.is(
    storyDescription({
      title: "How do we transform the crypto space?",
      href: "data:text/plain,ignored",
      textContent: "Short text post body.",
    }),
    "Short text post body.",
  );
});

test("storyDocumentTitle adds the brand only when it fits", (t) => {
  t.is(
    storyDocumentTitle(
      "Claude for Creative Work",
      "https://www.anthropic.com/news/x",
    ),
    "Claude for Creative Work | Kiwi News",
  );
  const long =
    "Introducing Workspace: The onchain operating environment for treasury teams";
  t.is(storyDocumentTitle(long, "https://safe.global/blog/x"), long);
});

test("storyDocumentTitle adds the host to vague titles, not to social links", (t) => {
  t.is(
    storyDocumentTitle("Pacto", "https://covenant-gov.github.io/pacto-app"),
    "Pacto – covenant-gov.github.io | Kiwi News",
  );
  t.is(
    storyDocumentTitle("Imaginationmaxxing", "https://x.com/a/status/1"),
    "Imaginationmaxxing | Kiwi News",
  );
  t.is(
    storyDocumentTitle(
      "EIP-8141: Frame Transaction",
      "https://eips.ethereum.org/EIPS/eip-8141",
    ),
    "EIP-8141: Frame Transaction – eips.ethereum.org | Kiwi News",
  );
});

test("head escapes the description and title in the HTML", (t) => {
  const description = storyDescription({
    title: 'Quotes "and" <b>tags</b>',
    href: "https://example.com/a",
    articleDescription:
      'A description with "quotes", <br>markup</br> & an attempt to "><script>alert(1)</script> break out of the attribute.',
  });
  const out = custom(
    undefined,
    'Quotes "and" tags',
    description,
    undefined,
    [],
    "https://news.kiwistand.com/stories/x?index=0x1",
    null,
    null,
    {
      documentTitle: storyDocumentTitle(
        'Some "quoted" words & more',
        "https://example.com/a",
      ),
    },
  );
  const html = Array.isArray(out) ? out.join("") : String(out);
  t.false(html.includes("<script>alert(1)"));
  t.false(html.includes("<br>markup"));
  const meta = html.match(/<meta name="description" content="([^"]*)"/);
  t.truthy(meta);
  t.true(meta[1].includes("&quot;quotes&quot;"));
  t.true(
    html.includes(
      "<title>Some &quot;quoted&quot; words &amp; more | Kiwi News</title>",
    ),
  );
});
