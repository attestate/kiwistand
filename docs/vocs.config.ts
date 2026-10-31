import { defineConfig } from 'vocs/config'

// Served at https://news.kiwistand.com/docs by a Cloudflare Worker, see
// README.md and wrangler.jsonc.
export default defineConfig({
  title: 'Kiwi News Docs',
  description:
    'Docs for the Kiwi News Protocol, the kiwistand node, and the attestate libraries it is built with.',
  basePath: '/docs',
  baseUrl: 'https://news.kiwistand.com',
  // Vocs adds <base href={baseUrl}> by default. Under a basePath that sends
  // in-page anchors to the site root, so leave it out.
  head: { base: false },
  // Vocs writes sitemap.xml and robots.txt without the basePath, and a
  // robots.txt under /docs isn't read by crawlers anyway.
  sitemap: false,
  renderStrategy: 'full-static',
  // Vocs doesn't prefix these with basePath, nor Markdown image paths.
  logoUrl: { light: '/docs/logo-light.png', dark: '/docs/logo-dark.png' },
  iconUrl: '/docs/favicon.ico',
  editLink: {
    link: (filePath) =>
      filePath === 'changelog.md'
        ? 'https://github.com/attestate/kiwistand/edit/main/changelog.md'
        : `https://github.com/attestate/kiwistand/edit/main/docs/src/pages/${filePath}`,
  },
  socials: [{ icon: 'github', link: 'https://github.com/attestate/kiwistand' }],
  topNav: [
    {
      text: 'Protocol',
      link: '/guide',
      match: (path) =>
        ['/guide', '/protocol', '/http-api', '/delegation'].some((p) => path?.startsWith(p)),
    },
    {
      text: 'Libraries',
      items: [
        { text: 'crawler', link: '/crawler' },
        { text: 'crawler-call-block-logs', link: '/crawler-call-block-logs' },
        { text: 'delegator2', link: '/delegator' },
        { text: 'eth-fun', link: '/eth-fun' },
      ],
    },
    { text: 'Changelog', link: '/changelog' },
    { text: 'Kiwi News', link: 'https://news.kiwistand.com', external: true },
  ],
  sidebar: [
    { text: 'Introduction', link: '/' },
    {
      text: 'Kiwi News Protocol',
      items: [
        { text: 'How the protocol works', link: '/guide' },
        { text: 'Protocol', link: '/protocol' },
        { text: 'HTTP API', link: '/http-api' },
        { text: 'Delegation', link: '/delegation' },
      ],
    },
    { text: 'Changelog', link: '/changelog' },
    {
      text: 'Libraries',
      items: [
        {
          text: 'crawler',
          link: '/crawler',
          collapsed: true,
          items: [
            { text: 'Use cases', link: '/crawler/use-cases' },
            { text: 'Extract, transform, load', link: '/crawler/extract-transform-load' },
            { text: 'Getting started', link: '/crawler/getting-started' },
            { text: 'Configuration', link: '/crawler/configuration' },
            { text: 'JavaScript usage', link: '/crawler/javascript-usage' },
            { text: 'Command line interface', link: '/crawler/command-line-interface' },
            { text: 'Extraction worker', link: '/crawler/extraction-worker' },
            { text: 'Strategy specification', link: '/crawler/strategy-specification' },
          ],
        },
        {
          text: 'crawler-call-block-logs',
          link: '/crawler-call-block-logs',
          collapsed: true,
          items: [
            { text: 'Usage', link: '/crawler-call-block-logs/usage' },
            { text: 'Reference', link: '/crawler-call-block-logs/reference' },
          ],
        },
        { text: 'delegator2', link: '/delegator' },
        {
          text: 'eth-fun',
          link: '/eth-fun',
          collapsed: true,
          items: [{ text: 'API', link: '/eth-fun/api' }],
        },
      ],
    },
  ],
})
