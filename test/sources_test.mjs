// @format
import test from "ava";
import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

import normalizeUrl from "normalize-url";

import {
  sourceKey,
  sourcePath,
  resolveRequest,
  sourceName,
  farcasterAliases,
  twitterFrontends,
} from "../src/sourcekey.mjs";
import { twitterFrontends as parserFrontends } from "../src/parser.mjs";
import * as sources from "../src/sources.mjs";
import * as summaries from "../src/summaries.mjs";
import {
  buildSourcesSitemap,
  buildSitemapIndex,
  newSourceUrls,
} from "../src/sitemap.mjs";
import {
  sourcePage,
  indexPage,
  sourceDescription,
  sourceJsonLd,
  indexMeta,
} from "../src/views/source.mjs";
import { DESC_MAX } from "../src/seo.mjs";

test("sourceKey: a plain site is its host without www", (t) => {
  const cases = {
    "https://vitalik.eth.limo/general/2024/05/17/hello.html":
      "vitalik.eth.limo",
    "https://www.a16zcrypto.com/posts/article/x/": "a16zcrypto.com",
    "https://ethresear.ch/t/some-topic/123": "ethresear.ch",
    "http://WWW.Example.COM/Path": "example.com",
    "https://example.com.": "example.com",
    "https://example.com:8443/a?b=c#d": "example.com",
    "https://blog.ethereum.org/2026/01/01/x": "blog.ethereum.org",
    "https://kiwinews.substack.com/p/issue-1": "kiwinews.substack.com",
    "https://name.mirror.xyz/abc": "name.mirror.xyz",
    "https://someone.medium.com/post-123": "someone.medium.com",
    "https://bsky.app/profile/a.bsky.social": "bsky.app",
  };
  for (const [href, key] of Object.entries(cases)) {
    t.is(sourceKey(href), key, href);
  }
});

test("sourceKey: multi-author platforms add the author", (t) => {
  const cases = {
    "https://paragraph.xyz/@kiwi-weekly/issue-1": "paragraph.xyz/@kiwi-weekly",
    "https://paragraph.com/@Kiwi-Weekly/issue-2": "paragraph.xyz/@kiwi-weekly",
    "https://www.paragraph.com/@kiwi-weekly": "paragraph.xyz/@kiwi-weekly",
    "https://mirror.xyz/vitalik.eth/abc": "mirror.xyz/vitalik.eth",
    "https://mirror.xyz/0xAbC123/xyz": "mirror.xyz/0xabc123",
    "https://medium.com/@Alice/post-1": "medium.com/@alice",
    "https://medium.com/coinmonks/some-post-123": "medium.com/coinmonks",
    "https://x.com/VitalikButerin/status/1": "x.com/vitalikbuterin",
    "https://twitter.com/VitalikButerin/status/1": "x.com/vitalikbuterin",
    "https://mobile.twitter.com/_foo/status/1": "x.com/_foo",
    "https://fxtwitter.com/jessepollak/status/1": "x.com/jessepollak",
    "https://warpcast.com/dwr.eth/0x123": "farcaster.xyz/dwr.eth",
    "https://farcaster.xyz/dwr.eth/0x123": "farcaster.xyz/dwr.eth",
    "https://github.com/attestate/kiwistand/pull/1": "github.com/attestate",
    "https://gist.github.com/Someone/abc": "github.com/someone",
    "https://www.youtube.com/@Bankless/videos": "youtube.com/@bankless",
    "https://m.youtube.com/@bankless": "youtube.com/@bankless",
    "https://substack.com/@writer/note/1": "substack.com/@writer",
    "https://hackmd.io/@timdaub/abc": "hackmd.io/@timdaub",
    "https://x.com/%40weird": null,
  };
  for (const [href, key] of Object.entries(cases)) {
    t.is(sourceKey(href), key, href);
  }
});

test("sourceKey: no source without an author on a platform, or no link", (t) => {
  for (const href of [
    "https://x.com/i/status/1",
    "https://x.com/",
    "https://x.com/search?q=eth",
    "https://twitter.com/intent/tweet",
    "https://warpcast.com/~/channel/kiwi",
    "https://paragraph.xyz/home",
    "https://paragraph.com/",
    "https://medium.com/p/123",
    "https://github.com/",
    "https://github.com/orgs/x",
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://youtube.com/channel/UC123",
    "https://imagedelivery.net/abc/def/public",
    "https://news.kiwistand.com/stories/x?index=0x1",
    "https://t.co/abc",
    "data:text/plain;charset=utf-8,hello",
    "kiwi:0x123",
    "ftp://example.com/x",
    "https://localhost/x",
    "http://[::1]/x",
    "not a url",
    "",
    null,
    undefined,
  ]) {
    t.is(sourceKey(href), null, String(href));
  }
});

test("sourceKey: X frontends and mirrors map to x.com/<handle>", (t) => {
  t.is(parserFrontends, twitterFrontends);
  const cases = {
    "https://xcancel.com/VitalikButerin/status/1": "x.com/vitalikbuterin",
    "https://xcancel.com/alice/status/123/photo/1": "x.com/alice",
    "https://nitter.net/Bob/status/2": "x.com/bob",
    "https://nitter.poast.org/bob": "x.com/bob",
    "https://vxtwitter.com/carol/status/3": "x.com/carol",
    "https://fixupx.com/carol/status/3": "x.com/carol",
    "https://xcancel.com/i/status/1": null,
    "https://xcancel.com/": null,
    "https://nitter.net/search?q=eth": null,
  };
  for (const [href, key] of Object.entries(cases)) {
    t.is(sourceKey(href), key, href);
  }
  for (const host of twitterFrontends) {
    t.is(sourceKey(`https://${host}/alice/status/1`), "x.com/alice", host);
  }
});

test("sourceKey: Substack app links, Firefly and T2", (t) => {
  const cases = {
    "https://open.substack.com/pub/kiwinews/p/issue-1": "kiwinews.substack.com",
    "https://open.substack.com/pub/Kiwi-News/p/issue-1?r=abc":
      "kiwi-news.substack.com",
    "https://open.substack.com/pub/": null,
    "https://open.substack.com/home": null,
    "https://open.substack.com/pub/a.b/p/x": null,
    "https://firefly.social/profile/farcaster/dwr.eth": "farcaster.xyz/dwr.eth",
    "https://firefly.social/profile/x/VitalikButerin": "x.com/vitalikbuterin",
    "https://firefly.social/post/farcaster/0xabc": null,
    "https://firefly.social/post/x/2107837081313505768": null,
    "https://firefly.social/post/lens/0x01-0x02": null,
    "https://firefly.social/profile/lens/stani": null,
    "https://firefly.social/profile/farcaster/~": null,
    "https://firefly.social/": null,
    "https://app.t2.world/@alice/some-post": "app.t2.world/@alice",
    "https://t2.world/@alice": "app.t2.world/@alice",
    "https://app.t2.world/article/clx123abc": null,
    "https://app.t2.world/t/territory": null,
  };
  for (const [href, key] of Object.entries(cases)) {
    t.is(sourceKey(href), key, href);
  }
  t.is(sourceName("app.t2.world/@alice"), "@alice on T2");
});

test("sourceKey: file hosts, gateways, Google Docs and shorteners aren't sources", (t) => {
  for (const href of [
    "https://files.catbox.moe/abc.png",
    "https://catbox.moe/c/abc",
    "https://litter.catbox.moe/abc.pdf",
    "https://imgur.com/a/abc",
    "https://i.imgur.com/abc.png",
    "https://ipfs.io/ipfs/bafy",
    "https://bafybeigdyrzt.ipfs.dweb.link/",
    "https://bafy.ipfs.w3s.link/x.pdf",
    "https://cloudflare-ipfs.com/ipfs/bafy",
    "https://gateway.pinata.cloud/ipfs/bafy",
    "https://kiwi.mypinata.cloud/ipfs/bafy",
    "https://arweave.net/abc",
    "https://docs.google.com/document/d/1abc/edit",
    "https://drive.google.com/file/d/1abc/view",
    "https://tinyurl.com/abc",
    "https://bit.ly/abc",
  ]) {
    t.is(sourceKey(href), null, href);
  }
  // Only the hosts and their subdomains, not lookalikes.
  t.is(sourceKey("https://notimgur.com/x"), "notimgur.com");
  t.is(sourceKey("https://google.com/x"), "google.com");
});

test("resolveRequest redirects mirror and app keys to the canonical key", (t) => {
  t.deepEqual(resolveRequest("xcancel.com/alice"), {
    status: 308,
    location: "/source/x.com/alice",
  });
  t.deepEqual(resolveRequest("open.substack.com/pub/kiwi"), {
    status: 308,
    location: "/source/kiwi.substack.com",
  });
  t.deepEqual(resolveRequest("files.catbox.moe"), { status: 404 });
});

test("farcasterAliases merges name and name.eth into the larger one", (t) => {
  const aliases = farcasterAliases(
    new Map([
      ["farcaster.xyz/alice", 3],
      ["farcaster.xyz/alice.eth", 7],
      ["farcaster.xyz/bob", 4],
      ["farcaster.xyz/bob.eth", 4],
      ["farcaster.xyz/carol.eth", 9],
      ["x.com/dave", 1],
      ["x.com/dave.eth", 1],
    ]),
  );
  t.deepEqual(
    [...aliases],
    [
      ["farcaster.xyz/alice", "farcaster.xyz/alice.eth"],
      ["farcaster.xyz/bob.eth", "farcaster.xyz/bob"],
    ],
  );
});

test("sourcePath and sourceName", (t) => {
  t.is(sourcePath("vitalik.eth.limo"), "/source/vitalik.eth.limo");
  t.is(
    sourcePath("paragraph.xyz/@kiwi-weekly"),
    "/source/paragraph.xyz/@kiwi-weekly",
  );
  t.is(sourceName("vitalik.eth.limo"), "vitalik.eth.limo");
  t.is(sourceName("x.com/vitalikbuterin"), "@vitalikbuterin on X");
  t.is(sourceName("farcaster.xyz/dwr.eth"), "@dwr.eth on Farcaster");
  t.is(sourceName("paragraph.xyz/@kiwi"), "@kiwi on Paragraph");
  t.is(sourceName("github.com/attestate"), "attestate on GitHub");
});

test("resolveRequest: canonical keys, redirects, context and 404s", (t) => {
  const ok = (key, context = false) => ({ status: 200, key, context });
  const redirect = (location) => ({ status: 308, location });
  t.deepEqual(resolveRequest("vitalik.eth.limo"), ok("vitalik.eth.limo"));
  t.deepEqual(
    resolveRequest("paragraph.xyz/@kiwi-weekly"),
    ok("paragraph.xyz/@kiwi-weekly"),
  );
  t.deepEqual(
    resolveRequest("vitalik.eth.limo/context"),
    ok("vitalik.eth.limo", true),
  );
  t.deepEqual(
    resolveRequest("x.com/vitalik/context"),
    ok("x.com/vitalik", true),
  );
  // A platform host alone is never a key, so this is the user "context".
  t.deepEqual(resolveRequest("x.com/context"), ok("x.com/context"));
  t.deepEqual(
    resolveRequest("x.com/context/context"),
    ok("x.com/context", true),
  );

  t.deepEqual(
    resolveRequest("www.vitalik.eth.limo"),
    redirect("/source/vitalik.eth.limo"),
  );
  t.deepEqual(
    resolveRequest("Vitalik.eth.limo/"),
    redirect("/source/vitalik.eth.limo"),
  );
  t.deepEqual(
    resolveRequest("twitter.com/VitalikButerin"),
    redirect("/source/x.com/vitalikbuterin"),
  );
  t.deepEqual(
    resolveRequest("twitter.com/VitalikButerin/context"),
    redirect("/source/x.com/vitalikbuterin/context"),
  );
  t.deepEqual(
    resolveRequest("paragraph.com/@kiwi-weekly"),
    redirect("/source/paragraph.xyz/@kiwi-weekly"),
  );
  t.deepEqual(
    resolveRequest("paragraph.xyz/%40kiwi-weekly"),
    redirect("/source/paragraph.xyz/@kiwi-weekly"),
  );
  t.deepEqual(
    resolveRequest("warpcast.com/dwr.eth/0xabc"),
    redirect("/source/farcaster.xyz/dwr.eth"),
  );
  // Redirects never leave /source/.
  t.deepEqual(resolveRequest("/evil.com"), redirect("/source/evil.com"));

  for (const rest of [
    "",
    "x.com",
    "x.com/i",
    "youtube.com/watch",
    "%E0%A4%A",
    "a b.com",
    "localhost",
    "imagedelivery.net/x",
  ]) {
    t.deepEqual(resolveRequest(rest), { status: 404 }, rest);
  }
});

const DAY = 24 * 60 * 60;
const T0 = Date.UTC(2025, 2, 1) / 1000;
const BANNED = "0x000000000000000000000000000000000000dead";
const SUMMARY =
  "Ethereum researchers propose a change to how blobs are priced. The change lowers fees for rollups and keeps the base fee stable when demand spikes, according to the proposal. It is planned for the next hard fork after Fusaka.";

let n = 0;
function entry(href, { upvotes = 1, comments = 0, title, ...rest } = {}) {
  n += 1;
  return {
    index: `${String(n).padStart(4, "0")}${"ab".repeat(4)}`,
    title: title || `Story ${n}`,
    href,
    identity: "0x1111111111111111111111111111111111111111",
    timestamp: T0 + n * DAY,
    upvotes,
    comments,
    ...rest,
  };
}

const policy = {
  titles: {},
  hrefs: {},
  addresses: [BANNED],
  links: [normalizeUrl("https://blog.example/banned")],
  labels: {},
};

function fixture() {
  return [
    // Five indexable stories (three by upvotes, two by comments).
    entry("https://blog.example/1", { upvotes: 9 }),
    entry("https://blog.example/2", { upvotes: 5, comments: 4 }),
    entry("https://www.blog.example/3", { upvotes: 3 }),
    entry("https://blog.example/4", { upvotes: 1, comments: 1 }),
    entry("https://blog.example/5", { upvotes: 1, comments: 2 }),
    entry("https://blog.example/6", { upvotes: 1 }),
    // Moderated: neither counted nor listed.
    entry("https://blog.example/banned", { upvotes: 50 }),
    entry("https://blog.example/7", { upvotes: 40, identity: BANNED }),
    // Four indexable stories: one short of the gate.
    entry("https://thin.example/1", { upvotes: 4 }),
    entry("https://thin.example/2", { upvotes: 4 }),
    entry("https://thin.example/3", { upvotes: 4 }),
    entry("https://thin.example/4", { upvotes: 4 }),
    entry("https://thin.example/5", { upvotes: 1 }),
    // Platform authors.
    entry("https://twitter.com/Alice/status/1", { upvotes: 2 }),
    entry("https://x.com/alice/status/2", { upvotes: 2 }),
    entry("data:text/plain,a text post", { upvotes: 30 }),
  ];
}

test("buildSources groups stories by source and applies the quality gate", (t) => {
  n = 0;
  const entries = fixture();
  const lastComments = new Map([[`kiwi:0x${entries[1].index}`, T0 + 400 * DAY]]);
  const list = sources.buildSources(entries, { policy, lastComments });
  t.deepEqual(
    list.map(({ key }) => key),
    ["blog.example", "thin.example", "x.com/alice"],
  );
  const [blog, thin, alice] = list;
  t.is(blog.stories, 6);
  t.is(blog.indexable, 5);
  t.is(blog.upvotes, 20);
  t.is(blog.comments, 7);
  t.is(blog.first, entries[0].timestamp);
  t.is(blog.latest, entries[5].timestamp);
  t.is(blog.lastmod, T0 + 400 * DAY);
  t.deepEqual(
    blog.top.map(({ href }) => href),
    [
      "https://blog.example/1",
      "https://blog.example/2",
      "https://www.blog.example/3",
      "https://blog.example/5",
      "https://blog.example/4",
      "https://blog.example/6",
    ],
  );
  t.deepEqual(
    blog.discussed.map(({ href }) => href),
    ["https://blog.example/2", "https://blog.example/5", "https://blog.example/4"],
  );
  t.false("indexable" in blog.top[0]);
  t.true(sources.isIndexableSource(blog));

  t.is(thin.indexable, 4);
  t.false(sources.isIndexableSource(thin));
  t.is(alice.stories, 2);
  t.false(sources.isIndexableSource(alice));
  t.false(sources.isIndexableSource(undefined));
  t.deepEqual(
    sources.listedSources(list).map(({ key }) => key),
    ["blog.example"],
  );

  // Without moderation the banned stories count.
  const open = sources.buildSources(entries);
  t.is(open[0].key, "blog.example");
  t.is(open[0].stories, 8);
});

test("buildSources: a summary makes a story count with one extra upvote", (t) => {
  n = 0;
  const entries = [1, 2, 3, 4, 5].map(() =>
    entry("https://summaries.example/x", { upvotes: 2 }),
  );
  const none = sources.buildSources(entries);
  t.is(none[0].indexable, 0);
  const all = new Map(entries.map(({ index }) => [index, SUMMARY]));
  const withSummaries = sources.buildSources(entries, { summaries: all });
  t.is(withSummaries[0].indexable, 5);
  t.true(sources.isIndexableSource(withSummaries[0]));
});

test("buildSources caps the listed stories", (t) => {
  n = 0;
  const entries = Array.from({ length: 70 }, (_, i) =>
    entry("https://big.example/x", { upvotes: i + 1 }),
  );
  const [big] = sources.buildSources(entries);
  t.is(big.stories, 70);
  t.is(big.top.length, sources.MAX_STORIES);
  t.is(big.top[0].upvotes, 70);
  t.is(big.discussed.length, 0);
});

test("the sources sitemap lists only indexable sources and /sources", (t) => {
  n = 0;
  const list = sources.buildSources(fixture(), { policy });
  const xml = buildSourcesSitemap(list);
  t.true(xml.includes("<loc>https://news.kiwistand.com/sources</loc>"));
  t.true(
    xml.includes("<loc>https://news.kiwistand.com/source/blog.example</loc>"),
  );
  t.false(xml.includes("thin.example"));
  t.false(xml.includes("x.com"));
  t.is(xml.match(/<url>/g).length, 2);
  t.regex(xml, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);

  const empty = buildSourcesSitemap(
    list.filter((source) => !sources.isIndexableSource(source)),
  );
  t.false(empty.includes("<url>"));

  t.true(
    buildSitemapIndex([], { "sitemap-sources.xml": "2026-10-01" }).includes(
      "<sitemap><loc>https://news.kiwistand.com/sitemap-sources.xml</loc><lastmod>2026-10-01</lastmod></sitemap>",
    ),
  );
});

test("newSourceUrls: only sources that just became indexable", (t) => {
  n = 0;
  const list = sources.buildSources(fixture(), { policy });
  t.deepEqual(newSourceUrls(null, list), []);
  t.deepEqual(newSourceUrls(new Set(["blog.example"]), list), []);
  t.deepEqual(newSourceUrls(new Set(), list), [
    "https://news.kiwistand.com/source/blog.example",
  ]);
});

test("sources.json round trip: getSources, indexableSourcePath, readIndexableKeys", async (t) => {
  n = 0;
  const dir = mkdtempSync(join(tmpdir(), "kiwi-sources-"));
  const path = join(dir, "sources.json");
  sources.reset();
  t.is(sources.readIndexableKeys(path), null);
  t.is((await sources.getSources(path)).list.length, 0);

  sources.reset();
  sources.write(sources.buildSources(fixture(), { policy }), path);
  t.deepEqual([...sources.readIndexableKeys(path)], ["blog.example"]);
  const { byKey, list } = await sources.getSources(path);
  t.is(list.length, 3);
  t.is(byKey.get("blog.example").indexable, 5);

  t.deepEqual(sources.indexableSourcePath("https://www.blog.example/9", path), {
    key: "blog.example",
    path: "/source/blog.example",
  });
  t.is(sources.indexableSourcePath("https://thin.example/9", path), null);
  t.is(sources.indexableSourcePath("https://x.com/alice/status/3", path), null);
  t.is(sources.indexableSourcePath("data:text/plain,x", path), null);
  sources.reset();
});

async function pageData(key, list) {
  const byKey = new Map(list.map((source) => [source.key, source]));
  return sources.getSourcePage(key, { sources: { byKey }, policy });
}

test("getSourcePage applies moderation and adds safe summaries", async (t) => {
  n = 0;
  const entries = fixture();
  summaries.write(entries[0].index, SUMMARY);
  const list = sources.buildSources(entries, { policy });
  const withTitle = {
    ...policy,
    titles: { [normalizeUrl("https://blog.example/2")]: "Better title" },
  };
  const byKey = new Map(list.map((source) => [source.key, source]));
  const data = await sources.getSourcePage("blog.example", {
    sources: { byKey },
    policy: withTitle,
  });
  t.true(data.indexable);
  t.is(data.top[0].summary, SUMMARY);
  t.is(data.top[1].title, "Better title");
  t.is(data.top[2].summary, null);
  t.is(await pageData("nope.example", list), null);
  t.false((await pageData("thin.example", list)).indexable);
});

test("sourcePage renders JSON-LD, canonical and the stories", async (t) => {
  n = 0;
  const entries = fixture();
  entries[0].title = 'Blobs & "fees" <explained>';
  summaries.write(entries[0].index, SUMMARY);
  const data = await pageData(
    "blog.example",
    sources.buildSources(entries, { policy }),
  );
  const page = await sourcePage(null, data);
  t.is(page.match(/<h1[ >]/g).length, 1);
  t.true(page.includes("<h1>Best of blog.example on Kiwi News</h1>"));
  t.true(page.includes("<title>Best of blog.example on Kiwi News</title>"));
  t.true(
    page.includes(
      '<link rel="canonical" href="https://news.kiwistand.com/source/blog.example"',
    ),
  );
  t.true(
    page.includes('href="https://news.kiwistand.com/source/blog.example/context"'),
  );
  t.false(page.includes('name="robots"'));
  t.true(page.includes('<base href="/"'));
  t.true(page.includes("Blobs &amp; &quot;fees&quot; &lt;explained&gt;"));
  t.true(page.includes(SUMMARY));
  t.true(page.includes(`?index=0x${entries[1].index}`));
  t.true(page.includes('href="https://blog.example/1"'));
  t.true(page.includes("6 stories from blog.example have been shared"));
  t.true(page.includes("Most discussed"));
  t.true(page.includes('href="/sources"'));

  const ld = page.match(
    /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s,
  );
  t.truthy(ld);
  t.false(ld[1].includes("<"));
  const json = JSON.parse(ld[1]);
  t.is(json["@type"], "CollectionPage");
  t.is(json.url, "https://news.kiwistand.com/source/blog.example");
  t.is(json.mainEntity["@type"], "ItemList");
  t.is(json.mainEntity.numberOfItems, 6);
  t.is(json.mainEntity.itemListElement[0].name, entries[0].title);
  // No inline scripts besides the JSON-LD.
  const inline = page.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
  t.deepEqual(inline, ['<script type="application/ld+json">']);

  const description = sourceDescription(data);
  t.true(description.length <= DESC_MAX);
  t.true(description.startsWith("6 stories from blog.example shared on Kiwi News (2025), ranked by upvotes: "));
  t.false(sourceJsonLd(data, "a </script> b").includes("<"));
});

test("sourcePage says noindex, follow for a thin source", async (t) => {
  n = 0;
  const data = await pageData(
    "x.com/alice",
    sources.buildSources(fixture(), { policy }),
  );
  t.false(data.indexable);
  const page = await sourcePage(null, data);
  t.true(page.includes('<meta name="robots" content="noindex, follow"'));
  t.true(page.includes("<h1>Best of x.com/alice on Kiwi News</h1>"));
  t.true(page.includes("2 stories by @alice on X have been shared"));
  t.true(page.includes('<script type="application/ld+json">'));
});

test("sourceDescription stays within 155 characters", (t) => {
  const description = sourceDescription({
    key: "a-very-long-publication-name-for-testing.substack.com",
    stories: 12,
    first: T0,
    latest: T0 + 400 * DAY,
    top: [{ title: "word ".repeat(60).trim() }],
  });
  t.true(description.length <= DESC_MAX);
  t.true(description.endsWith("…"));
  t.true(description.includes("(2025–2026)"));
});

test("indexPage lists sources", async (t) => {
  n = 0;
  const list = sources.listedSources(
    sources.buildSources(fixture(), { policy }),
  );
  const page = await indexPage(null, list);
  t.is(page.match(/<h1[ >]/g).length, 1);
  t.true(
    page.includes('<link rel="canonical" href="https://news.kiwistand.com/sources"'),
  );
  t.true(page.includes('href="/source/blog.example"'));
  t.false(page.includes("thin.example"));
  t.false(page.includes('name="robots"'));
  const ld = page.match(
    /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s,
  );
  t.is(JSON.parse(ld[1]).mainEntity.numberOfItems, 1);

  const empty = await indexPage(null, []);
  t.true(empty.includes('<meta name="robots" content="noindex, follow"'));
});

test("sourceMarkdown lists the stories as plain text", async (t) => {
  n = 0;
  const entries = fixture();
  summaries.write(entries[0].index, SUMMARY);
  const data = await pageData(
    "blog.example",
    sources.buildSources(entries, { policy }),
  );
  const md = sources.sourceMarkdown(data);
  t.true(md.startsWith("# Best of blog.example on Kiwi News\n"));
  t.true(md.includes("Page: https://news.kiwistand.com/source/blog.example"));
  t.true(md.includes(`## 1. ${entries[0].title}`));
  t.true(
    md.includes(
      `- Kiwi News: https://news.kiwistand.com/stories/Story-1?index=0x${entries[0].index}`,
    ),
  );
  t.true(md.includes("- Source: https://blog.example/1"));
  t.true(md.includes("9 upvotes, 0 comments"));
  t.true(md.includes(SUMMARY));
  t.true(md.includes("Summaries are AI summaries"));
});

test("story pages link More from <site> to an indexable source page", async (t) => {
  const { RelatedBox } = await import("../src/views/story.mjs");
  const stories = [{ title: "Older story", index: "0abc" }];
  const own = RelatedBox(
    { site: "blog.example", stories },
    { key: "blog.example", path: "/source/blog.example" },
  );
  t.true(own.includes('More from <a href="/source/blog.example"'));
  t.false(own.includes("Best of"));

  const author = RelatedBox(
    { site: "x.com", stories },
    { key: "x.com/alice", path: "/source/x.com/alice" },
  );
  t.true(author.includes('href="/source/x.com/alice">Best of x.com/alice →'));

  const none = RelatedBox({ site: "thin.example", stories }, null);
  t.false(none.includes("/source/"));
  t.true(none.includes("More from thin.example"));
});

test("buildSources merges Farcaster name and name.eth into the larger one", async (t) => {
  n = 0;
  const entries = [
    ...[1, 2, 3, 4].map(() =>
      entry("https://farcaster.xyz/alice.eth/0x1", { upvotes: 3 }),
    ),
    ...[1, 2].map(() =>
      entry("https://warpcast.com/alice/0x2", { upvotes: 3 }),
    ),
    entry("https://farcaster.xyz/bob.eth/0x3", { upvotes: 1 }),
  ];
  const list = sources.buildSources(entries);
  t.deepEqual(
    list.map(({ key, stories, upvotes, aliases }) => [key, stories, upvotes, aliases]),
    [
      ["farcaster.xyz/alice.eth", 6, 18, ["farcaster.xyz/alice"]],
      ["farcaster.xyz/bob.eth", 1, 1, undefined],
    ],
  );
  t.true(sources.isIndexableSource(list[0]));

  // The alias finds the merged source, so its page and story links use the
  // canonical key.
  const byKey = sources.byKeyOf(list);
  t.is(byKey.get("farcaster.xyz/alice").key, "farcaster.xyz/alice.eth");
  const data = await sources.getSourcePage("farcaster.xyz/alice", {
    sources: { byKey },
    policy,
  });
  t.is(data.key, "farcaster.xyz/alice.eth");

  const dir = mkdtempSync(join(tmpdir(), "kiwi-sources-"));
  const path = join(dir, "sources.json");
  sources.reset();
  sources.write(list, path);
  await sources.getSources(path);
  t.deepEqual(
    sources.indexableSourcePath("https://farcaster.xyz/alice/0x9", path),
    {
      key: "farcaster.xyz/alice.eth",
      path: "/source/farcaster.xyz/alice.eth",
    },
  );
  sources.reset();
});

test("buildSources ranks by upvotes in the last 90 days, then all-time", (t) => {
  n = 0;
  const now = T0 + 1000 * DAY;
  const at = (days) => now - days * DAY;
  const entries = [
    // Big all-time, quiet lately.
    entry("https://old.example/1", { upvotes: 100, timestamp: at(400) }),
    entry("https://old.example/2", { upvotes: 2, timestamp: at(30) }),
    // Smaller, active lately.
    entry("https://new.example/1", { upvotes: 10, timestamp: at(10) }),
    entry("https://new.example/2", { upvotes: 5, timestamp: at(89) }),
    entry("https://new.example/3", { upvotes: 50, timestamp: at(91) }),
    // Nothing recent: all-time breaks the tie.
    entry("https://a.example/1", { upvotes: 7, timestamp: at(200) }),
    entry("https://b.example/1", { upvotes: 8, timestamp: at(300) }),
  ];
  const list = sources.buildSources(entries, { now });
  t.deepEqual(
    list.map(({ key, recentUpvotes, recentStories }) => [
      key,
      recentUpvotes,
      recentStories,
    ]),
    [
      ["new.example", 15, 2],
      ["old.example", 2, 1],
      ["b.example", 0, 0],
      ["a.example", 0, 0],
    ],
  );
  t.is(list[0].upvotes, 65);
});

test("indexPage rows: space before the dot, stories, upvotes and last story", async (t) => {
  n = 0;
  const list = sources.listedSources(
    sources.buildSources(fixture(), { policy }),
  );
  const page = await indexPage(null, list);
  const blog = list[0];
  t.is(
    indexMeta(blog),
    `6 stories · 20 upvotes · last story ${new Date(
      blog.latest * 1000,
    ).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`,
  );
  t.regex(page, /last story March 2025/);
  t.regex(
    page,
    /<a href="\/source\/blog\.example">blog\.example<\/a> <span class="wk-meta">· 6 stories · 20 upvotes · last story/,
  );
  const rows = page.match(/<ol class="wk-list">.*?<\/ol>/s)[0];
  t.notRegex(rows, /<\/a><span/);
  t.notRegex(rows, /[^\s>]·/);
  t.notRegex(rows, /·\S/);
  t.notRegex(rows, /\d(stories|upvotes)/);
});
