// Writes src/pages/changelog.md from the repository's changelog.md, so the
// changelog has one source. The output is gitignored.
import { readFile, writeFile } from 'node:fs/promises'

const source = new URL('../../changelog.md', import.meta.url)
const target = new URL('../src/pages/changelog.md', import.meta.url)

const frontmatter = [
  '---',
  'title: Changelog',
  'showAskAi: false',
  'description: Releases of kiwistand, the Kiwi News Protocol node.',
  '---',
  '',
  '',
].join('\n')

await writeFile(target, frontmatter + (await readFile(source, 'utf8')))
