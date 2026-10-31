import { defineConfig } from 'vocs/config'

// The docs of kiwistand, served by the node itself at
// https://news.kiwistand.com/docs (src/docs.mjs). They look like the rest of
// the site: its colours, fonts, wordmark and favicon (see src/pages/_root.css).
export default defineConfig({
  title: 'Kiwi News Docs',
  description: 'Docs for the Kiwi News Protocol and kiwistand, the node that runs Kiwi News.',
  basePath: '/docs',
  baseUrl: 'https://news.kiwistand.com',
  renderStrategy: 'full-static',
  // The lime of the site (--kn-accent in src/public/news.css).
  accentColor: '#D4EC37',
  // The site's "kiwi news" wordmark (src/views/components/header.mjs) in its
  // light and dark colours. Vocs doesn't add the base path to these.
  logoUrl: { light: '/docs/wordmark-light.svg', dark: '/docs/wordmark-dark.svg' },
  // The site's own favicon; the docs are served from the same origin.
  iconUrl: '/favicon.ico',
  head: {
    // Vocs adds <base href={baseUrl}> by default. Under a base path that sends
    // in-page anchors to the site root, so leave it out.
    base: false,
    link: [
      // Inter, as the site loads it (src/views/components/head.mjs).
      { rel: 'stylesheet', href: '/fonts/inter.css' },
      ...['Regular', 'SemiBold', 'Bold'].map(
        (weight) =>
          ({
            rel: 'preload',
            href: `/fonts/Inter-${weight}-latin.woff2`,
            as: 'font',
            type: 'font/woff2',
            crossorigin: 'anonymous',
          }) as const,
      ),
    ],
    // Points the wordmark at / instead of the docs home (see the file).
    script: [{ src: '/docs/wordmark.js', defer: true }],
  },
  // Vocs writes sitemap.xml and robots.txt without the base path, and a
  // robots.txt under /docs isn't read by crawlers anyway.
  sitemap: false,
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
      match: (path) => ['/guide', '/protocol', '/delegation'].some((p) => path?.startsWith(p)),
    },
    { text: 'HTTP API', link: '/http-api' },
    { text: 'Changelog', link: '/changelog' },
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
  ],
})
