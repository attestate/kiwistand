# Docs

The docs at [news.kiwistand.com/docs](https://news.kiwistand.com/docs): the
Kiwi News Protocol, the node's HTTP API and the changelog. They're built with
[Vocs](https://vocs.dev) into static files, and kiwistand serves them itself
(`src/docs.mjs`).

This folder is its own npm package, so its dependencies don't touch the app's
`package.json`.

## Run it locally

```bash
cd docs
npm ci
npm run dev       # http://localhost:5173/docs/
npm run build     # static site in dist/public
```

To see the build as production serves it, run `npm run build:docs` in the
repository root and start kiwistand as usual, then open
`http://localhost:<HTTP_PORT>/docs/`.

The fonts and the favicon are the site's own (`/fonts/…`, `/favicon.ico`), so
`npm run dev` shows them only when kiwistand serves the docs; on its own it
falls back to Arial. The build warns that the `/fonts/…` URLs in
`_root.css` "didn't resolve at build time"; that's expected.

## Layout

- `src/pages/`: one `.mdx` file per page. The URL is the path without the
  extension: `src/pages/http-api.mdx` is `/docs/http-api`.
- `src/pages/changelog.md` is generated from the repository's
  `changelog.md` by `scripts/changelog.mjs` before `dev` and `build`, and is
  gitignored. Edit `../changelog.md` instead.
- `src/pages/_root.css`: the site's look (see below) and the figures' style.
- `src/components/figures.tsx`: the guide's figures, see below.
- `public/`: files served as they are: the wordmark and `wordmark.js`.
- `vocs.config.ts`: title, sidebar, top navigation, base path, colours.
- `scripts/postbuild.mjs`: adjusts the build for serving under `/docs`, see
  below.

## Writing pages

- Link to pages without `/docs`: `[HTTP API](/http-api#message)`. Vocs adds
  the base path. The build fails on links to pages that don't exist (not on
  missing `#anchors`).
- Reference images and other files in `public/` with `/docs` in front:
  `<img src="/docs/wordmark-light.svg" />`. Vocs doesn't add the base path
  to those.
- Start every page with `showAskAi: false` in its frontmatter. Vocs's "Ask
  AI" and "Copy for AI" buttons build their URLs without the base path, so
  under `/docs` they point at the wrong page.
- Callouts are `:::note`, `:::warning`, `:::tip` and `:::danger` blocks.
  Mermaid diagrams are ```` ```mermaid ```` code blocks.

## Figures

The guide's figures are React components in `src/components/figures.tsx`
that draw inline SVG, imported into `guide.mdx` (`<Figure1 />`, `<TreeA />`).
They have no background and no colours of their own: lines and text take the
site's text colours, and the tones (blue for Node and Peer A, pink for B,
green for in sync, red for not) are the `--kf-*` tokens in `_root.css`, each
with a light and a dark value. So they sit on the page in both themes. Draw
new figures with the same building blocks (`Figure`, `Circle`, `Tree`,
`Arrow`, `Row`, …) rather than as images on a white background.

## The look

The docs use the site's design rather than Vocs's defaults:

- Colours: the `--kn-*` tokens of `src/public/news.css`, light and dark,
  mapped onto Vocs's variables in `_root.css`, with the lime
  (`#D4EC37`) as Vocs's accent colour.
- Fonts: Inter from the site's `/fonts/inter.css`, with the site's Arial
  fallback metrics, and JetBrains Mono for code.
- The "kiwi news" wordmark: `public/wordmark-light.svg` and
  `public/wordmark-dark.svg` are the paths of
  `src/views/components/header.mjs` in the text colour and the wordmark
  green. If the wordmark changes, regenerate them.
- The favicon is the site's `/favicon.ico`.
- The wordmark links to `/`, as everywhere on the site. Vocs links its logo
  to the docs home and has no setting for it, so `public/wordmark.js`
  redirects those links.

## How it's served and deployed

- `src/docs.mjs` serves `docs/dist/public` at `/docs`. `/docs` redirects to
  `/docs/`, which serves `index.html`; `/docs/<page>` serves `<page>.html`;
  `/docs/<page>/` redirects to `/docs/<page>`; unknown paths get the build's
  `404.html` with status 404. Without a build every `/docs` path is a plain
  404.
- Why `<page>.html`: Waku's client router needs the home page at `/docs/`
  with a slash, while Vocs links every other page without one.
  `scripts/postbuild.mjs` moves each `<page>/index.html` to `<page>.html`.
  It also adds `/docs` to the links in `llms.txt` and `llms-full.txt`.
- Caching: pages and the router's `RSC/` payloads
  `public, s-maxage=3600, max-age=0, stale-while-revalidate=86400`; the
  hashed files in `assets/` like the site's `/assets`; other files a day.
  Static files only get these headers when `NODE_ENV=production`, as on the
  rest of the site.
- The load balancer sends `/docs` to the workers, like the site's other
  pages.
- Deploys build the docs: `.github/workflows/deploy.yml` and
  `npm run deploy` run `npm run build:docs` (`npm ci` and `npm run build`
  here), and `scripts/deploy-files.mjs` ships `docs/dist/public`. It refuses
  to deploy without it. The server doesn't build anything. As rsync runs
  without `--delete`, a page that's removed stays on the server until it's
  deleted there.
