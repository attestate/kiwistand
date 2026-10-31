# Docs

The docs site at [news.kiwistand.com/docs](https://news.kiwistand.com/docs),
built with [Vocs](https://vocs.dev). It covers the Kiwi News Protocol, the
node's HTTP API, the changelog, and attestate's libraries (crawler,
crawler-call-block-logs, delegator2, eth-fun).

This folder is its own npm package: its dependencies don't touch the app's
`package.json`.

## Run it locally

```bash
cd docs
npm ci
npm run dev       # http://localhost:5173/docs/
npm run build     # static site in dist/public
npm run preview   # serves dist/public with wrangler, as Cloudflare does: http://localhost:8787/docs/
```

## Layout

- `src/pages/`: one `.mdx` file per page. The URL is the path without the
  extension, e.g. `src/pages/crawler/configuration.mdx` is
  `/docs/crawler/configuration`.
- `src/pages/changelog.md` is generated from the repository's
  `changelog.md` by `scripts/changelog.mjs` before `dev` and `build`, and is
  gitignored. Edit `../changelog.md` instead.
- `src/pages/_root.css`: the few styles of our own (figures, the video).
- `public/`: files served as they are: the logo, the favicon and the
  protocol figures in `public/figures/`.
- `vocs.config.ts`: title, sidebar, top navigation, base path.
- `scripts/postbuild.mjs`: adjusts the build for serving under `/docs`, see
  below.
- `wrangler.jsonc`: the Cloudflare Worker that serves the site.

## Writing pages

- Link to pages without `/docs`: `[HTTP API](/http-api#message)`. Vocs adds
  the base path. The build fails on links to pages that don't exist (not on
  missing `#anchors`).
- Reference images and other files in `public/` with `/docs` in front:
  `<img src="/docs/figures/set-recon-hash.svg" />`. Vocs doesn't add the
  base path to those.
- Start every page with `showAskAi: false` in its frontmatter. Vocs's "Ask
  AI" and "Copy for AI" buttons build their URLs without the base path, so
  under `/docs` they point at the wrong page.
- Callouts are `:::note`, `:::warning`, `:::tip` and `:::danger` blocks.
  Mermaid diagrams are ```` ```mermaid ```` code blocks.

The pages for the libraries are copies of the docs in their own
repositories, as of their `main` branch on 2026-10-31. A change there
doesn't show up here by itself.

## Hosting

The site is static. A Cloudflare Worker with static assets and no script
serves `dist/public` on the route `news.kiwistand.com/docs*`. All other paths
on news.kiwistand.com keep going to the node, and the more specific route
takes precedence over a Worker on `news.kiwistand.com/*`.

Two things in the build are specific to the base path:

- The HTML links to `/docs/...`, while the files sit at the root of
  `dist/public`. `assets.base_path: "/docs"` in `wrangler.jsonc` maps one
  onto the other (needs wrangler 4.148.0 or later).
- The client-side router needs the home page at `/docs/` with a trailing
  slash, while Vocs links every other page without one. So
  `scripts/postbuild.mjs` moves each `<page>/index.html` to `<page>.html`,
  and Cloudflare's default `auto-trailing-slash` handling then serves
  `/docs/` and `/docs/protocol`, and redirects `/docs` and `/docs/protocol/`
  to them. It also adds `/docs` to the links in `llms.txt` and
  `llms-full.txt`.

### Setting it up in Cloudflare

Deploys run on Cloudflare's Workers Builds. To connect it once:

1. In the Cloudflare dashboard, go to **Workers & Pages** and click
   **Create application**.
2. Choose **GitHub**, authorize it if asked, and pick `attestate/kiwistand`.
3. Configure the project:
   - **Project name:** `kiwistand-docs`. It must match `name` in
     `wrangler.jsonc`, or the build fails.
   - **Root directory:** `docs`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Production branch:** `main`
4. Click **Save and Deploy**.

Workers Builds installs the dependencies from `package-lock.json` and uses
Node 22 from `.node-version`. On deploy, wrangler creates the route
`news.kiwistand.com/docs*` on the `kiwistand.com` zone from
`wrangler.jsonc`; the API token Workers Builds generates by default may edit
Workers Routes. `workers_dev` is off, so the site isn't also published on a
`*.workers.dev` URL.

After that, every push to `main` rebuilds and deploys the docs. If the build
settings offer build watch paths, set them to `docs/*` and `changelog.md` so
that other pushes don't rebuild the docs.

To check the setup: `https://news.kiwistand.com/docs` should redirect to
`/docs/` and show the docs, and `https://news.kiwistand.com/` should still
show Kiwi News.
