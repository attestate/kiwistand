# SEO and AI-agent audit (phase 1, code only)

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
| `/` (feed.mjs) | "Kiwi News - handpicked crypto news for builders" | specific | `/` (also for `?page=N`) | WebSite + SearchAction + Organization (FIXED) | yes; `?domain=` blocked in robots | static |
| `/new` | specific | specific | `/new?cached=true` | none | yes | static (`/new?cached=true`) |
| `/best` | specific | specific | `/best` for all periods/pages | none | yes; `?domain=` blocked | static |
| `/stories/<slug>?index=0x…` | story title | og:description of the article, else a story-specific fallback (FIXED, was "Crypto news for builders" on every such page) | canonical slug URL; wrong slugs 308-redirect | DiscussionForumPosting | yes | monthly sitemaps |
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

### Fixed in this pass

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

### Open

| # | Impact | Effort | Finding |
|---|---|---|---|
| 1 | H | S | **No `<h1>` on `/`, `/new`, `/best`, story and profile pages.** The story title is only a link inside the row table. A story page should have exactly one `<h1>` with the title. Needs a decision on markup inside `Row()` (visual risk), so not done here. |
| 2 | M | S | **Story `<title>` has no brand suffix.** `<title>` and `og:title` are the same variable in `head.mjs`. A separate `title` (e.g. "<story> \| Kiwi News") would help SERP recognition while keeping og:title clean for cards. Needs an extra parameter on `custom()`. |
| 3 | M | M | **Sitemap `lastmod` is the submission time.** Pages change when comments/upvotes arrive. Use `MAX(comment.timestamp)` per story. Also only regenerated at process start (`launch.mjs`); stories submitted after a deploy only appear on the next restart. Schedule `generateSitemaps()` hourly. |
| 4 | M | M | **Sitemap doesn't exclude moderated stories.** Moderation (`views/moderation.mjs`) is fetched async from a config sheet and only filters feeds; story pages of hidden stories still render 200, so the sitemap is at least consistent with them. Decide whether moderated stories should 404/noindex, then drop them from the sitemap. |
| 5 | M | S | **Story pages: no `article:published_time` / `article:author` OG tags** and og:type is guessed from the URL. Cheap to add when touching `head.mjs`. |
| 6 | M | M | **Profiles (`/upvotes?address=`) have no JSON-LD** (`ProfilePage` + `Person` with ENS/Farcaster `sameAs`) and aren't in any sitemap. Only worth it if Search Console shows profile impressions. |
| 7 | M | M | **No RSS/Atom feed.** Many aggregators and agents look for `<link rel="alternate" type="application/rss+xml">`. The JSON feeds exist; an RSS rendering of `/api/v1/feeds/hot` would be small. |
| 8 | L | S | **`/stories/context` is served as `text/plain`** although it's Markdown; `text/markdown; charset=utf-8` is more precise for agents. Left as is because the iOS app or other clients may depend on it. |
| 9 | L | S | **llms.txt contradicts itself on CORS** for port 443 ("Fully enabled" vs "require a server-side proxy"). The code applies `cors()` with default `*` to all routes, so port 443 probably does send CORS headers; verify with `curl -I` against production and fix the developer section. |
| 10 | L | S | **`/llms-full.txt`** (top stories of the week rendered as Markdown with links to `/stories/context`) would let agents get a snapshot in one fetch. Not trivial (needs a route), skipped. |
| 11 | L | S | **`/` canonical is `/` for `?page=N`.** Google advises self-canonicals on paginated pages; low impact since stories are discovered via sitemaps anyway. Same for `/best?period=…`. |
| 12 | L | S | **`/new` canonical contains `?cached=true`.** Consistent with the sitemap, so harmless, but `/new` and `/new?cached=true` are both crawlable variants. |
| 13 | L | S | **Pages using the default `Head`** (`/notifications`, `/email-notifications`, `/demonstration`, `/shortcut`, app onboarding pages) share the generic title and description. Mostly app/utility pages; give them `custom()` titles or noindex if they show up in Search Console. |
| 14 | L | S | **Internal linking.** Story pages link to submitter/commenter/curator profiles and the nav, but not to related stories or the domain listing (`/?domain=` is robots-blocked). A "more from <domain>" or "related" block would strengthen crawl paths to older stories. |

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
