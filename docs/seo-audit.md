# SEO and AI-agent audit (phases 1 and 2, code only)

Date: 2026-10-03. Source: code in this repo only (no live crawl, no analytics).
Impact: H/M/L. Effort: S (< 1h), M (half a day), L (needs data or design).
Status: FIXED = changed in this pass, OPEN = still to do.

## Per page type

All HTML pages render their `<head>` through `custom()` in
`src/views/components/head.mjs`, which emits `<title>` (= og:title),
`meta description`, `og:*`, `twitter:card`/`twitter:image`/`twitter:site`,
and `rel=canonical` when a canonical URL is passed. Pages that import the
default `Head` get the generic title "Kiwi News - handpicked web3 alpha", the
generic description and no canonical.

| Page | Title | Description | Canonical | JSON-LD | Indexable | Sitemap |
|---|---|---|---|---|---|---|
| `/` (feed.mjs) | "Kiwi News - handpicked crypto news for builders"; hidden `<h1>` and RSS `rel=alternate` (phase 2) | specific | `/` (also for `?page=N`) | WebSite + SearchAction + Organization (FIXED) | yes; `?domain=` blocked in robots | static |
| `/new` | specific | specific | `/new?cached=true` | none | yes | static (`/new?cached=true`) |
| `/best` | specific | specific | `/best` for all periods/pages | none | yes; `?domain=` blocked | static |
| `/stories/<slug>?index=0x…` | "<story> \| Kiwi News", og:title = story title, hidden `<h1>`, `og:type=article` + `article:*` tags (phase 2) | og:description of the article, else a story-specific fallback (FIXED, was "Crypto news for builders" on every such page) | canonical slug URL; wrong slugs 308-redirect | DiscussionForumPosting | yes | monthly sitemaps, lastmod = latest comment, regenerated hourly (phase 2) |
| `/stories/…&commentIndex=…` | "Comment on: …" | comment text | self (includes commentIndex) | same as story | now `noindex, follow` (FIXED) | no |
| `/stories/context?index=…` | text/plain Markdown | – | – | – | now `X-Robots-Tag: noindex`, explicitly allowed for crawlers (FIXED) | no |
| `/upvotes?address=…` (profile) | "<name> (<karma> 🥝) on Kiwi News" | specific | self | none | yes | no |
| `/<name>.eth` | same view as profile | | canonical -> `/upvotes?address=` | | blocked in robots | no |
| `/guidelines` | was generic, now "Guidelines \| Kiwi News" (FIXED) | now specific (FIXED) | now self (FIXED) | none | yes | static |
| `/privacy-policy` | was generic, now "Privacy Policy \| Kiwi News" (FIXED) | now specific (FIXED) | now self (FIXED) | none | yes | no |
| `/activity`, `/notifications` | "Activity \| Kiwi News" / generic | generic | none | none | now `X-Robots-Tag: noindex` (FIXED; `/activity?address=` was publicly cacheable and indexable) | no |
| `/search?q=` | "Search: q \| Kiwi News" | specific | none | – | now noindex (FIXED) | no |
| `/submit` | "Submit \| Kiwi News" | specific | none | – | robots-disallowed + noindex header | no |
| `/debug`, `/comment-debug` | – | – | – | – | meta noindex already, now header too | no |
| `/api/*` (443) | JSON | – | – | – | robots-disallowed + noindex header (FIXED) | no |

## Findings

### Fixed in phase 1

1. **H/S – Duplicate comment-permalink pages.** Every comment on a story page
   links to `…&commentIndex=<id>`, which rendered a near-copy of the story
   with a self-referencing canonical, i.e. N duplicates per story. These now
   carry `<meta name="robots" content="noindex, follow">`; og:url and the
   Farcaster frame still point at the comment, so sharing is unchanged.
   (`src/views/story.mjs`)
2. **H/S – Generic story descriptions.** Stories without an og:description
   from the linked page (and all text posts) used "Crypto news for builders".
   Now: text posts use the first 160 characters of the text; link posts use
   "<title> (<domain>), discussed on Kiwi News." (`src/views/story.mjs`)
3. **M/S – Story JSON-LD.** `sharedContent` was emitted with the full
   `data:text/plain,…` URL for text posts; it's now only emitted for http(s)
   links. Comments now include `dateCreated`. (`src/views/story.mjs`)
4. **M/S – Agent discovery from story pages.** Story pages now have
   `<link rel="alternate" type="text/plain" href="/stories/context?index=…">`
   so agents that land on HTML can find the LLM-friendly version.
5. **M/S – Front-page structured data.** Added `WebSite` (with
   `SearchAction` -> `/search?q=`) and `Organization` (logo, X, GitHub)
   JSON-LD to `/`. (`src/views/feed.mjs`)
6. **M/S – Duplicate titles/no canonical on /guidelines and
   /privacy-policy.** Both now pass a unique title, description and canonical
   to `custom()`.
7. **M/S – Private/noise pages indexable.** `X-Robots-Tag: noindex` is set
   for `/activity`, `/notifications`, `/search`, `/submit`,
   `/stories/context`, `/debug`, `/comment-debug` and `/api/*`
   (`src/http.mjs`). A header rather than robots.txt so crawlers can see it.
8. **M/S – robots.txt.** Explicitly names the major search and AI crawlers
   (Googlebot, Bingbot, Google-Extended, GPTBot, OAI-SearchBot,
   ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot,
   Perplexity-User, Applebot-Extended, CCBot) in the same group as `*`, so
   their rules are identical to before (a crawler with its own group would
   otherwise ignore the `*` rules). Allows `/llms.txt` and
   `/stories/context`, adds `Disallow: /redirect/` (bot hits there are
   recorded as outbound clicks by `trackOutbound`), points agents to
   llms.txt. Note: `src/public/*` is served with
   `s-maxage=604800, immutable`, so purge `robots.txt` and `llms.txt` in
   Cloudflare after deploy.
9. **M/S – llms.txt.** Was a developer README with the H1 "Kiwistand". Now
   follows llmstxt.org: H1 "Kiwi News", one-paragraph blockquote, then link
   lists for reading pages, machine-readable endpoints
   (`/stories/context`, `/api/v1/feeds/{hot,new,best}`, story and profile
   JSON) and a "How to cite" section. The existing developer guide is kept
   below unchanged.

### Fixed in phase 2

Numbers refer to the phase 1 "Open" table.

- **#1 – `<h1>`.** Story pages now have exactly one `<h1>` with the story
  title; `/`, `/new` and `/best` have one describing the page ("Kiwi News:
  handpicked crypto news for builders", "New crypto stories on Kiwi News",
  "Best crypto stories on Kiwi News this week/today/of all time"). All are
  visually hidden with a new `.visually-hidden` class (standard clip
  pattern, `src/public/news.css`), placed as the first child of `<main>`.
  Why not wrap the visible title link in `Row()`: the link sits inside two
  `<span>`s (an `<h1>` there is invalid HTML), `Row()` is shared by every
  feed, and for tweet/cast previews the title span is `display: none`, so
  the heading would disappear on exactly those stories. The hidden `<h1>`
  carries the same text as the visible title, so it isn't cloaking.
  Profile pages still have no `<h1>`.
- **#2 – Story `<title>` suffix.** `custom()` takes an options object as
  its last parameter; `documentTitle` sets `<title>` separately from
  `og:title`. Story pages: `<title>` = "<story> | Kiwi News", og:title stays
  the bare title. While there: `<title>`, og:title and the description were
  double-escaped (`&` showed as `&amp;amp;`, i.e. "&amp;" in SERPs) because
  DOMPurify returns HTML that vhtml escapes again; the sanitized value is
  now entity-decoded before vhtml escapes it once.
- **#3 – Sitemap `lastmod` and schedule.** `lastmod` is the later of
  submission time and the latest comment (one grouped `MAX(timestamp)`
  query over `comments` on a read-only SQLite connection, since `cache.mjs`
  doesn't export its handle). `launch.mjs` regenerates sitemaps at start
  and then hourly; the job is synchronous (can't overlap itself) and wrapped
  in try/catch (can't crash the primary). Files are written to a temp file
  and renamed. Because sirv indexes `src/public` once at startup (with
  Content-Length), `http.mjs` now serves `/sitemap*.xml` from disk per
  request; otherwise rewritten sitemaps would be served with stale lengths
  and new months would 404 until a restart.
- **#5 – Article OG tags.** Story pages send `og:type=article`,
  `article:published_time` (submission time, ISO 8601), `article:author`
  (submitter's Kiwi profile URL) and `<meta name="author">` (display name).
  og:type is now set explicitly by the caller (falls back to the old URL
  guess).
- **#7 – RSS.** `/feed.xml` is an RSS 2.0 rendering of the hot feed, built
  with the same `index()` call as `/api/v1/feeds/hot` (`src/rss.mjs`,
  route in `src/http.mjs`). Items link to the Kiwi story page (guid,
  comments), the description has the original link (or text-post body),
  upvotes, comments and submitter; `dc:creator` is the submitter.
  `Cache-Control: public, s-maxage=300, max-age=0,
  stale-while-revalidate=86400`, so Cloudflare absorbs polling and no purge
  is needed. `<link rel="alternate" type="application/rss+xml">` is on `/`
  and story pages, robots.txt has `Allow: /feed.xml`, llms.txt lists it.
- **#9 – CORS in llms.txt.** Both `src/http.mjs` (port 443) and
  `src/api.mjs` (8443) use `cors()` without an `origin` option, which sends
  `Access-Control-Allow-Origin: *` on every response. llms.txt now says so
  everywhere; the "requires a server-side proxy" claims are gone (the
  Next.js proxy example is kept, marked optional). Still worth one
  `curl -sI -H "Origin: https://example.com" https://news.kiwistand.com/api/v1/feeds/hot`
  after deploy in case Cloudflare strips the header.
- **#14 – Internal linking.** Story pages for https links show "More from
  <host> on Kiwi News": up to 5 other story pages from the same host (www.
  stripped, subdomains kept so `co.uk`-style suffixes don't group unrelated
  sites), top-voted first. Data comes from `getBest(…, domain)` (the query
  behind `/best?domain=`, one scan of `submissions`) filtered through the
  regular moderation lists; story pages are cached for a day at Cloudflare,
  so the query runs rarely. Not shown for text posts and Cloudflare images,
  or when there are no other stories from that host.

Deploy note: robots.txt and llms.txt are served with
`s-maxage=604800, immutable`, so purge both in Cloudflare after deploy.

### Open

| # | Impact | Effort | Finding |
|---|---|---|---|
| 4 | M | M | **Sitemap doesn't exclude moderated stories.** Moderation (`views/moderation.mjs`) is fetched async from a config sheet and only filters feeds; story pages of hidden stories still render 200, so the sitemap is at least consistent with them. Decide whether moderated stories should 404/noindex, then drop them from the sitemap. |
| 6 | M | M | **Profiles (`/upvotes?address=`) have no JSON-LD** (`ProfilePage` + `Person` with ENS/Farcaster `sameAs`) and aren't in any sitemap. Only worth it if Search Console shows profile impressions. |
| 8 | L | S | **`/stories/context` is served as `text/plain`** although it's Markdown; `text/markdown; charset=utf-8` is more precise for agents. Left as is because the iOS app or other clients may depend on it. |
| 10 | L | S | **`/llms-full.txt`** (top stories of the week rendered as Markdown with links to `/stories/context`) would let agents get a snapshot in one fetch. Not trivial (needs a route), skipped. |
| 11 | L | S | **`/` canonical is `/` for `?page=N`.** Google advises self-canonicals on paginated pages; low impact since stories are discovered via sitemaps anyway. Same for `/best?period=…`. |
| 12 | L | S | **`/new` canonical contains `?cached=true`.** Consistent with the sitemap, so harmless, but `/new` and `/new?cached=true` are both crawlable variants. |
| 13 | L | S | **Pages using the default `Head`** (`/notifications`, `/email-notifications`, `/demonstration`, `/shortcut`, app onboarding pages) share the generic title and description. Mostly app/utility pages; give them `custom()` titles or noindex if they show up in Search Console. |
| 15 | L | S | **No `<h1>` on profile pages** (`/upvotes?address=`). Left over from #1; same hidden-heading approach would work. |

## AI crawler handling

- robots.txt: all listed AI crawlers have the same access as search engines
  (public pages, `/stories/context`, `/llms.txt`), and no access to `/api/`,
  `/submit`, `/outbound`, `/redirect/`. If the owner wants to opt out of
  model training while staying in AI search, move `GPTBot`,
  `Google-Extended`, `CCBot`, `Applebot-Extended` and `ClaudeBot` into a
  separate group with `Disallow: /` and keep the search/user agents
  (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`,
  `PerplexityBot`, `Perplexity-User`) in the main group.
- Cloudflare may block AI bots independently of robots.txt ("Block AI
  bots" / "AI Crawl Control" settings). Check the dashboard; it overrides
  everything above.
- Entry points for agents: `/llms.txt` (footer link + robots.txt comment),
  `rel=alternate` on story pages -> `/stories/context`, JSON feeds.

## Phase 2 (needs data)

Code-only work stops here; the next steps depend on what the owner can
connect or export. For each source: what to share, and what we'd do with it.

1. **Google Search Console** (domain property for `news.kiwistand.com`).
   Share: Performance export (queries, pages, impressions, clicks, CTR,
   position) for the last 3 and 16 months; Page indexing report (indexed vs
   "Crawled – currently not indexed", "Duplicate without user-selected
   canonical", "Alternate page with proper canonical"); Sitemaps status;
   Crawl stats. Or add a service account with read access so we can pull it
   via API.
   Use: find story pages with high impressions and low CTR and test title
   and description templates (finding 2, fix 2); confirm the
   commentIndex duplicates drop out; see whether profiles or `/best` get
   impressions (findings 6, 11); measure how much of the sitemap gets
   indexed and how fast new stories get indexed (finding 3).
2. **Google Analytics (`ga.js`) or PostHog.** Share: landing pages by
   source/medium, referrers (including `chatgpt.com`, `perplexity.ai`,
   `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`), new vs
   returning users per landing page, and conversion events (upvote, comment,
   newsletter signup, Kiwi Pass mint) by landing page. Read-only access or a
   monthly CSV export is enough.
   Use: measure how much traffic comes from search vs AI assistants vs
   Farcaster/X; find which story landing pages turn visitors into returning
   readers or minters, and add internal links/CTAs there (finding 14);
   track whether the llms.txt and JSON-LD changes move AI-referred sessions.
3. **Cloudflare analytics** (Security/Bots -> AI Crawl Control, or Logpush /
   GraphQL analytics with a read-only API token). Share: requests by
   verified bot (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
   OAI-SearchBot, Bingbot, Googlebot) and path, status codes, cache status,
   and whether any "Block AI bots" rule is active.
   Use: verify crawlers can actually reach story pages and
   `/stories/context` (not blocked or rate limited), see which paths they
   spend budget on (e.g. `/redirect/`, `?commentIndex=`, `?domain=`), decide
   on the training opt-out question above, and correlate crawl volume with
   AI referrals from (2).
4. **Optional: Bing Webmaster Tools** (feeds ChatGPT search and Copilot)
   with the same exports as Search Console, plus IndexNow if we want
   near-instant indexing of new stories.
