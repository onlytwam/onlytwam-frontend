// scripts/check-alt.mjs
//
// Lists images without alt text in the pre-rendered pages (dist/**/index.html).
// Run after:  npm run build:web
//   node scripts/check-alt.mjs
//
//   MISSING  <img> has no alt attribute at all              -> must be fixed
//   EMPTY    alt="" on an image that is not marked as decoration -> check it
//            (alt="" is only right for decoration: add aria-hidden="true" or
//             role="presentation", or write real alt text)
//
// Exit code 1 when any MISSING image is found, so it can also run in the pipeline.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = join(process.cwd(), 'dist')

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* htmlFiles(full)
    else if (name.endsWith('.html') && name !== 'app-shell.html') yield full
  }
}

let totalMissing = 0
let totalEmpty = 0
let totalImages = 0

for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, 'utf8')
  const imgs = html.match(/<img\b[^>]*>/gi) || []
  const missing = []
  const empty = []

  for (const tag of imgs) {
    const alt = /\salt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag)
    const src = (/\ssrc\s*=\s*"([^"]*)"/i.exec(tag) || [])[1] || '(no src)'
    const decorative =
      /aria-hidden\s*=\s*"true"/i.test(tag) || /role\s*=\s*"presentation"/i.test(tag)
    if (!alt) missing.push(src)
    else if ((alt[2] ?? alt[3] ?? '').trim() === '' && !decorative) empty.push(src)
  }

  totalImages += imgs.length
  totalMissing += missing.length
  totalEmpty += empty.length

  if (missing.length || empty.length) {
    const page = '/' + relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '')
    console.log(`\n${page}  (${imgs.length} images)`)
    missing.slice(0, 8).forEach((s) => console.log(`  MISSING  ${s.slice(0, 90)}`))
    if (missing.length > 8) console.log(`  ... and ${missing.length - 8} more missing`)
    empty.slice(0, 5).forEach((s) => console.log(`  EMPTY    ${s.slice(0, 90)}`))
    if (empty.length > 5) console.log(`  ... and ${empty.length - 5} more empty`)
  }
}

console.log(
  `\nalt check: ${totalImages} images, ${totalMissing} without alt, ${totalEmpty} with empty alt (not decorative)`
)
process.exit(totalMissing > 0 ? 1 : 0)

//update