# Growth loop

A running list for the loop between Tim and Claude: Claude works through the
open items, reports results, and Tim answers the "Needs Tim" items (often by
voice). Each round updates this file.

## Running loops

| Loop | What Claude does each round | Input it needs |
|---|---|---|
| Link previews | Run `scripts/preview-audit.mjs` results through failure classes, fix the parser for the biggest class, re-measure | Audit report from the server |
| SEO / AI agents | Work through `docs/seo-audit.md`; once data is connected, pick pages/queries with the most upside | Search Console, analytics, Cloudflare data |
| Newsletter | Weekly digest is built and sent automatically (draft first, auto-send once trusted) | Crontab on the server |
| Telegram scout (later) | Suggest stories from channels/groups using `AGENTS.md` criteria; Tim says yes/no and why; criteria get sharper | Channel/group list, Telegram API access |

## Baseline (PostHog, 2026-10-03)

Consented visitors only; bots excluded. "Engaged" = 2+ pageviews in the
month. One-hit visitors are mostly referral spam (www.aocr.org, Chrome,
1 view each) and single hits on /best from CN, so they're left out.

| Month | Engaged visitors | Upvoters | Commenters | Upvotes | Outbound clicks |
|---|---|---|---|---|---|
| 2025-09 | 686 | 49 | 9 | 306 | 880 |
| 2025-12 | 417 | 24 | 9 | 299 | 415 |
| 2026-03 | 187 | 14 | 7 | 298 | 729 |
| 2026-06 | 105 | 4 | 3 | 118 | 181 |
| 2026-09 | 43 | 5 | 4 | 68 | 104 |

Last 30 days: almost no search (2 visits), social (2) or AI (1) referrals;
74% direct. Next: cross-check upvotes with the protocol data (PostHog
only sees consented browsers), then find where returning readers drop off.

## Needs Tim

### Urgent: Cloudflare challenges crawlers on story pages
The crawl check (`scripts/crawl-check.mjs`, metrics workflow) gets a
**403 "Just a moment…" challenge with `noindex,nofollow`** on `/new`,
`/best` and every story page, for all user agents (browser, Googlebot,
Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot); only `/`,
robots.txt and llms.txt return 200. It runs from a datacenter IP, so real
crawlers (verified by IP) may be let through, but new engaged visitors from
Google, Farcaster and X all went to zero in Q2 2026, which fits link
previews and crawlers being challenged.
- [ ] Cloudflare → Security → Events: filter Action = Managed Challenge,
      Path contains `/stories/`. Which rule or feature is it (a custom
      rule, Bot Fight Mode, Security Level "I'm under attack")? Are
      Googlebot / Twitterbot / facebookexternalhit / TelegramBot in there?
- [ ] If it's a custom rule: add `and not cf.client.bot` to its expression,
      or put a Skip rule for `(cf.client.bot)` first (Cloudflare's
      recommendation). If it's Bot Fight Mode (Free plan), it can't be
      skipped by rules; consider turning it off and using a custom rule
      instead. If it's "I'm under attack", switch the security level back.
- [ ] Afterwards Search Console → URL inspection on a story page → "Test
      live URL" should show 200 and the page.


### After deploying #183
- [ ] Purge `/robots.txt` and `/llms.txt` in Cloudflare (cached as
      immutable for 7 days); check `https://news.kiwistand.com/feed.xml`
      and a story page's `<title>` ("… | Kiwi News").
- [ ] Search Console → Sitemaps: resubmit `sitemap.xml`; add
      `https://news.kiwistand.com/feed.xml` nowhere (RSS is for readers
      and agents, linked from the pages).

### Previews
- [ ] Run the audit on the server and send Claude the Markdown report:
      `node scripts/preview-audit.mjs --days 180` (see the script header for options).
- [ ] Optional: allow outbound web access for Claude's cloud environment
      (session title bar → environment → Edit → Network access) so Claude can
      test parser fixes against real pages.

### SEO and analytics (see `docs/seo-audit.md`, "Phase 2")
- [x] PostHog connected (Claude reads it directly). The native iOS app now
      sends to the same project (attestate/kiwinews-ios, `Core/Analytics.swift`).
- [ ] Cloudflare (no Claude connector): create an API token with
      *Account Analytics: Read* and *Zone Analytics: Read* for kiwistand.com.
      In GitHub → kiwistand → Settings → Secrets and variables → Actions add
      secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ZONE_ID` (zone
      overview page, right column). `.github/workflows/metrics.yml` then
      reports weekly (Mondays), and on every change to the script.
- [ ] Google Search Console (no Claude connector): in Google Cloud create a
      service account, enable the "Google Search Console API", create a JSON
      key. In Search Console → Settings → Users add the service account's
      email (Restricted is enough). Add secret `GSC_SERVICE_ACCOUNT` (the
      whole JSON) and variable `GSC_SITE_URL` (`sc-domain:kiwistand.com` for
      a domain property, or the URL-prefix property as shown in Search
      Console).
- Google Analytics: not needed, PostHog covers the same visits.
- App Store Connect (later, once the native app is live): an API key with
  the Sales role (Users and Access → Integrations) as secrets; same
  workflow pattern.

### Newsletter
- [ ] Add the weekly job to the server's crontab (Mondays 08:00), creating a
      Buttondown draft to review:
      `0 8 * * 1 cd /path/to/kiwistand/newsletter && npm run export && npm run send >> /tmp/newsletter.log 2>&1`
- [ ] Once a few drafts looked good: switch to sending automatically by
      changing the last step to `npm run send -- --publish`.

### Telegram scout (later)
- [ ] List of channels and groups (and which are groups), plus for groups:
      all links or only from certain people.
- [ ] API ID and API hash from my.telegram.org → `.env` on the server (never
      in chat). One-time login on the server with phone number and code.
- [ ] Decide: submit under your name, or a separate scout account.

### P2P sync (#184)
- [ ] Review and merge #184 (after #183).
- [ ] Decide how nodes should treat the 2 upvotes the duplicate check rejects
      during sync (roots never match otherwise): keep them in the trie but
      out of counts, or compare leaf sets instead of roots. See #184.

### iOS app / App Store
- [ ] Demo wallet for the reviewer (seed only in App Store Connect notes).
- [ ] Google Form for reports and deletion requests (prefilled link with
      KIWITYPE / KIWIID / KIWIREASON) → Claude wires it in.
- [ ] New screenshots, age rating 17+, App Privacy answers, privacy/support URLs.
- [ ] Paste the old App Store rejection messages so each point can be checked.
- [ ] Merge attestate/kiwinews-ios#1 when happy; new TestFlight build.

## Done
- Native iOS app (attestate/kiwinews-ios#1), login via own wallet picker +
  Base over the Mobile Wallet Protocol.
- JSON endpoints and cache purges for the app (#180, #181, #182), Cloudflare
  worker no longer serves stale copies forever. Checked via the Cloudflare
  MCP (2026-10-03): the deployed `stale-while-revalidate` worker matches
  `cf-worker.js` in the repo.
