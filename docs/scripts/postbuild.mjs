// Adjusts the static build in dist/public for serving under /docs.
import { readdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('../dist/public/', import.meta.url).pathname

// 1. Vocs writes each page as <page>/index.html. Waku's client router needs
//    the home page at /docs/ (with a slash), while Vocs links every other page
//    without one (/docs/protocol). kiwistand (src/docs.mjs) serves /docs/
//    from index.html and /docs/<page> from <page>.html, also where a <page>/
//    folder of sub-pages exists, so move the pages there. The home page stays
//    index.html. The *.d folders aren't pages.
async function flatten(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.endsWith('.d')) continue
    const sub = join(dir, entry.name)
    await flatten(sub)
    const files = await readdir(sub)
    if (!files.includes('index.html')) continue
    await rename(join(sub, 'index.html'), `${sub}.html`)
    if (files.length === 1) await rmdir(sub)
  }
}
await flatten(root)

// 2. Vocs writes the page links in llms.txt and llms-full.txt without the
//    basePath, e.g. "](/protocol)". Prefix them with /docs.
for (const name of ['llms.txt', 'llms-full.txt']) {
  const file = join(root, name)
  const text = await readFile(file, 'utf8')
  await writeFile(
    file,
    text.replaceAll('](/index)', '](/)').replace(/\]\(\/(?!docs(\/|\)))/g, '](/docs/'),
  )
}
