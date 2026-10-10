// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "extract-"));
const {
  extractArticle,
  isXUrl,
  discourseJsonUrl,
  parseDiscourseTopic,
  youTubeVideoId,
  parseYouTubePage,
  youTubeArticle,
  arxivAbsUrl,
  parseArxivAbs,
  requiresCaptcha,
  stripBoilerplate,
} = await import("../src/lib/listen/extract.mjs");
const { JSDOM } = await import("jsdom");

// Answers requests from a map of URL -> response (or function returning one)
// and records which URLs were requested and with which options.
function mockFetch(t, routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const route = routes[String(url)];
    if (!route) return new Response("not found", { status: 404 });
    return typeof route === "function" ? route(options) : route.clone();
  };
  t.teardown(() => {
    globalThis.fetch = original;
  });
  return calls;
}

const html = (body, head = "") =>
  new Response(`<!doctype html><html><head><title>Page</title>${head}</head><body>${body}</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

const SENTENCE = "Validators who fail together should be penalized more than validators who fail alone. ";
const paragraph = (n) => SENTENCE.repeat(n).trim();

test("isXUrl routes X mirrors through the X path", (t) => {
  for (const url of [
    "https://x.com/a/status/1",
    "https://twitter.com/a/status/1",
    "https://xcancel.com/a/status/1",
    "https://vxtwitter.com/a/status/1",
    "https://fxtwitter.com/a/status/1",
    "https://fixupx.com/a/status/1",
    "https://www.fixvx.com/a/status/1",
    "https://nitter.net/a/status/1",
    "https://nitter.poast.org/a/status/1",
    "https://firefly.social/post/x/1",
  ]) {
    t.true(isXUrl(url), url);
  }
  t.false(isXUrl("https://example.com/a/status/1"));
  t.false(isXUrl("https://notx.com/a/status/1"));
  t.false(isXUrl("https://firefly.social/post/farcaster/0xabc"));
});

test("tweets on mirrors are read through fxtwitter, also with a /photo suffix", async (t) => {
  const calls = mockFetch(t, {
    "https://api.fxtwitter.com/status/123": json({
      tweet: { text: "A short tweet.", author: { screen_name: "alice" } },
    }),
  });
  const article = await extractArticle("https://xcancel.com/alice/status/123/photo/1");
  t.deepEqual(
    calls.map((c) => c.url),
    ["https://api.fxtwitter.com/status/123"],
  );
  t.is(article.title, "@alice on X");
  t.is(article.plainText, "A short tweet.");
});

test("discourseJsonUrl maps topic URLs to their JSON", (t) => {
  t.is(
    discourseJsonUrl("https://ethresear.ch/t/some-topic/19116"),
    "https://ethresear.ch/t/some-topic/19116.json",
  );
  t.is(
    discourseJsonUrl("https://governance.aave.com/t/incident/18821/12?u=bob"),
    "https://governance.aave.com/t/incident/18821.json",
  );
  t.is(discourseJsonUrl("https://example.com/blog/post"), null);
  t.is(discourseJsonUrl("https://example.com/t/slug"), null);
  t.is(discourseJsonUrl("not a url"), null);
});

const TOPIC = {
  title: "Anti-correlation incentives",
  post_stream: {
    posts: [
      {
        cooked: `<h1>Anti-correlation incentives</h1>
<div class="poll"><ul><li>In favour</li><li>Against</li></ul><span>0 voters</span></div>
<p>${paragraph(3)} <img class="emoji" alt=":slight_smile:" src="/e.png"></p>
<p>${paragraph(3)}</p>
<div class="lightbox-wrapper"><a class="lightbox" href="/big.png"><img src="/small.png" alt="chart"><div class="meta"><span class="filename">chart.png</span><span class="informations">1200×800 90 KB</span></div></a></div>
<aside class="onebox"><article><h3>Another site</h3><p>Preview text of another site.</p></article></aside>
<ul><li>First point</li><li>Second point</li></ul>`,
      },
      { cooked: "<p>A reply that is not part of the article.</p>" },
    ],
  },
};

test("parseDiscourseTopic keeps the first post's paragraphs and drops widgets", (t) => {
  const article = parseDiscourseTopic(TOPIC, "https://ethresear.ch/t/anti/1");
  t.is(article.title, "Anti-correlation incentives");
  t.is(
    article.plainText,
    ["Anti-correlation incentives", paragraph(3), paragraph(3), "First point", "Second point"].join("\n\n"),
  );
  t.false(article.plainText.includes("voters"));
  t.false(article.plainText.includes("KB"));
  t.false(article.plainText.includes("Another site"));
  t.true(article.wrappedHtml.includes("https://ethresear.ch/small.png"));
  t.false(article.wrappedHtml.includes("/e.png"));
  t.is(parseDiscourseTopic({ post_stream: { posts: [] } }, "https://a.b/t/x/1"), null);
  t.is(parseDiscourseTopic(null, "https://a.b/t/x/1"), null);
});

test("Discourse topics are read from JSON, not the JavaScript page", async (t) => {
  const url = "https://ethresear.ch/t/anti/19116";
  mockFetch(t, {
    "https://ethresear.ch/t/anti/19116.json": json(TOPIC),
    // The HTML page would trip the old CAPTCHA check.
    [url]: html(`<script>var captcha = true;</script><div id="main"></div>`),
  });
  const article = await extractArticle(url);
  t.true(article.plainText.startsWith("Anti-correlation incentives\n\n"));
});

test("Discourse-like URLs fall back to the page when there's no JSON", async (t) => {
  const url = "https://example.com/t/slug/42";
  const calls = mockFetch(t, {
    [url]: html(`<article><h1>Slug</h1><p>${paragraph(4)}</p><p>${paragraph(4)}</p></article>`),
  });
  const article = await extractArticle(url);
  t.deepEqual(
    calls.map((c) => c.url),
    ["https://example.com/t/slug/42.json", url],
  );
  t.true(article.plainText.includes(paragraph(4)));
});

test("generic pages keep paragraph breaks and fetch with a timeout", async (t) => {
  const url = "https://blog.example.com/post";
  const calls = mockFetch(t, {
    [url]: html(`<article><h1>Title</h1><p>${paragraph(4)}</p><p>${paragraph(4)}</p></article>`),
  });
  const article = await extractArticle(url);
  t.true(article.plainText.includes(`${paragraph(4)}\n\n${paragraph(4)}`));
  t.true(calls[0].options.signal instanceof AbortSignal);
});

test("pages over the size cap are cut off instead of read whole", async (t) => {
  const url = "https://blog.example.com/huge";
  const start = `<!doctype html><html><head><title>Huge</title></head><body><article><p>${paragraph(4)}</p><p>${paragraph(4)}</p></article><div>`;
  const filler = new TextEncoder().encode("x".repeat(1024 * 1024));
  let sent = 0;
  mockFetch(t, {
    [url]: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(start));
          },
          pull(controller) {
            // An endless body: only the cap ends the read.
            sent++;
            controller.enqueue(filler);
          },
        }),
        { headers: { "content-type": "text/html" } },
      ),
  });
  const article = await extractArticle(url);
  t.true(article.plainText.includes(paragraph(4)));
  t.true(sent <= 7);
});

test("requiresCaptcha ignores the word in scripts but sees challenge pages", (t) => {
  const check = (markup) => requiresCaptcha(markup, new JSDOM(markup).window.document);
  t.false(check(`<html><body><script>loadCaptcha("captcha")</script><p>Hello</p></body></html>`));
  t.true(check(`<html><body><p>Please complete the CAPTCHA to continue</p></body></html>`));
  t.true(check(`<html><head><title>Just a moment...</title></head><body></body></html>`));
  t.true(check(`<html><body><div class="g-recaptcha"></div></body></html>`));
});

test("pages with captcha only in scripts don't report a CAPTCHA", async (t) => {
  const url = "https://app.example.com/";
  mockFetch(t, {
    [url]: html(`<script>window.captchaKey = "abc"; // robot</script><div id="root"></div>`),
  });
  const err = await t.throwsAsync(() => extractArticle(url));
  t.is(err.message, "Could not extract article content");
});

test("youTubeVideoId understands watch, short and shorts links", (t) => {
  t.is(youTubeVideoId("https://www.youtube.com/watch?v=zLvFc_24vSM&t=10"), "zLvFc_24vSM");
  t.is(youTubeVideoId("https://m.youtube.com/watch?v=zLvFc_24vSM"), "zLvFc_24vSM");
  t.is(youTubeVideoId("https://youtu.be/9DUyblTC32w?feature=shared"), "9DUyblTC32w");
  t.is(youTubeVideoId("https://youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  t.is(youTubeVideoId("https://www.youtube.com/live/abcdefghijk"), "abcdefghijk");
  t.is(youTubeVideoId("https://www.youtube.com/@channel"), null);
  t.is(youTubeVideoId("https://example.com/watch?v=zLvFc_24vSM"), null);
});

const DESCRIPTION = `${paragraph(3)}\n\n${paragraph(3)}\nSpotify: https://open.spotify.com/show/1\nhttps://example.com/sponsor`;

test("parseYouTubePage reads the player response", (t) => {
  const player = {
    videoDetails: { title: "A \"quoted\" {title}", author: "Channel", shortDescription: DESCRIPTION },
  };
  const page = `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};var meta = {};</script>`;
  t.deepEqual(parseYouTubePage(page), {
    title: 'A "quoted" {title}',
    channel: "Channel",
    description: DESCRIPTION,
  });
});

test("parseYouTubePage falls back to the watch-next data when sign-in is required", (t) => {
  const player = { playabilityStatus: { status: "LOGIN_REQUIRED" } };
  const data = {
    contents: {
      twoColumnWatchNextResults: {
        results: {
          results: {
            contents: [
              { videoPrimaryInfoRenderer: { title: { runs: [{ text: "Video " }, { text: "title" }] } } },
              {
                videoSecondaryInfoRenderer: {
                  owner: { videoOwnerRenderer: { title: { runs: [{ text: "Channel" }] } } },
                  attributedDescription: { content: DESCRIPTION },
                },
              },
            ],
          },
        },
      },
    },
  };
  const page = `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script><script>var ytInitialData = ${JSON.stringify(data)};</script>`;
  t.deepEqual(parseYouTubePage(page), { title: "Video title", channel: "Channel", description: DESCRIPTION });
  t.deepEqual(parseYouTubePage("<html></html>"), { title: "", channel: "", description: "" });
});

test("youTubeArticle drops link-only lines", (t) => {
  const article = youTubeArticle({ title: "Title", channel: "Channel", description: DESCRIPTION });
  t.is(article.plainText, `Title\n\nVideo by Channel on YouTube\n\n${paragraph(3)}\n\n${paragraph(3)}`);
});

test("YouTube falls back to oEmbed for title and channel", async (t) => {
  mockFetch(t, {
    "https://www.youtube.com/watch?v=zLvFc_24vSM": html("<p>Sign in to confirm you're not a bot</p>"),
    "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DzLvFc_24vSM&format=json":
      json({ title: "Video title", author_name: "Channel" }),
  });
  const article = await extractArticle("https://youtu.be/zLvFc_24vSM");
  t.is(article.title, "Video title");
  t.is(article.plainText, "Video title\n\nVideo by Channel on YouTube");
});

test("YouTube without any details fails", async (t) => {
  mockFetch(t, {});
  const err = await t.throwsAsync(() => extractArticle("https://www.youtube.com/watch?v=zLvFc_24vSM"));
  t.is(err.message, "Could not fetch YouTube video details");
});

test("arxivAbsUrl maps PDF links to the abstract page", (t) => {
  t.is(arxivAbsUrl("https://arxiv.org/pdf/2407.13931"), "https://arxiv.org/abs/2407.13931");
  t.is(arxivAbsUrl("https://arxiv.org/pdf/2407.13931v2.pdf"), "https://arxiv.org/abs/2407.13931v2");
  t.is(arxivAbsUrl("https://arxiv.org/abs/2405.08007"), "https://arxiv.org/abs/2405.08007");
  t.is(arxivAbsUrl("https://export.arxiv.org/pdf/hep-th/9901001"), "https://arxiv.org/abs/hep-th/9901001");
  t.is(arxivAbsUrl("https://arxiv.org/list/cs.CR/recent"), null);
  t.is(arxivAbsUrl("https://example.com/pdf/2407.13931"), null);
});

const ABS = `<!doctype html><html><body><div id="abs">
<h1 class="title mathjax"><span class="descriptor">Title:</span>Who Wins Auctions?</h1>
<div class="authors"><span class="descriptor">Authors:</span><a href="#">A. One</a>, <a href="#">B. Two</a></div>
<blockquote class="abstract mathjax"><span class="descriptor">Abstract:</span>${paragraph(3)}
<br>${paragraph(2)}</blockquote>
<div class="full-text"><ul><li>View PDF</li><li>HTML (experimental)</li></ul></div>
<div class="submission-history"><h2>Submission history</h2>From: A. One</div>
</div></body></html>`;

test("parseArxivAbs keeps title, authors and abstract only", (t) => {
  const article = parseArxivAbs(ABS);
  t.is(article.title, "Who Wins Auctions?");
  t.is(
    article.plainText,
    `Who Wins Auctions?\n\nAuthors: A. One, B. Two\n\n${paragraph(3)}\n\n${paragraph(2)}`,
  );
  t.is(parseArxivAbs("<html><body><p>Not found</p></body></html>"), null);
});

test("arXiv PDF links are read from the abstract page", async (t) => {
  const calls = mockFetch(t, {
    "https://arxiv.org/abs/2407.13931": new Response(ABS, { headers: { "content-type": "text/html" } }),
  });
  const article = await extractArticle("https://arxiv.org/pdf/2407.13931");
  t.is(article.title, "Who Wins Auctions?");
  t.deepEqual(
    calls.map((c) => c.url),
    ["https://arxiv.org/abs/2407.13931"],
  );
});

const text = (content) => ({ type: "text", content });

test("stripBoilerplate removes known trailing chrome", (t) => {
  const body = [text("First."), text("Second.")];
  const strip = (url, tail) => stripBoilerplate([...body, ...tail], url).map((e) => e.content);

  t.deepEqual(
    strip("https://x.substack.com/p/a", [text("Share"), text("Discussion about this post"), text("Comments"), text("Ready for more?")]),
    ["First.", "Second.", "Share"],
  );
  t.deepEqual(
    strip("https://cointelegraph.com/news/a", [
      text("Magazine: Another story"),
      text("Cointelegraph is committed to independent, transparent journalism. This news article is produced in accordance with Cointelegraph’s Editorial Policy."),
    ]),
    ["First.", "Second."],
  );
  t.deepEqual(strip("https://www.coindesk.com/a", [text("1 2 3 4 5 6 7 8 9 10")]), ["First.", "Second."]);
  t.deepEqual(strip("https://www.coindesk.com/a", [text("1"), text("2"), text("3")]), ["First.", "Second."]);
  t.deepEqual(
    strip("https://decrypt.co/1/a", [
      text("Daily Debrief Newsletter"),
      text("Start every day with the top news stories right now, plus original features, a podcast, videos and more."),
    ]),
    ["First.", "Second."],
  );
  t.deepEqual(
    stripBoilerplate([text("Copy link to headingOur use case"), text("Copy link to heading")], "https://vercel.com/blog/a").map((e) => e.content),
    ["Our use case"],
  );
});

test("stripBoilerplate is conservative", (t) => {
  // The same lines on other sites, or not at the end, stay.
  const elements = [text("1 2 3 4 5"), text("Magazine: Another story"), text("Body.")];
  t.deepEqual(stripBoilerplate(elements, "https://www.coindesk.com/a"), elements);
  const other = [text("Body."), text("Magazine: Another story"), text("1 2 3")];
  t.deepEqual(stripBoilerplate(other, "https://example.com/a"), other);
  const image = { type: "image", src: "https://example.com/a.png", alt: "" };
  t.deepEqual(stripBoilerplate([text("Body."), image], "https://www.coindesk.com/a"), [text("Body."), image]);
});
