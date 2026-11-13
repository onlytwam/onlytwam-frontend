// scripts/prerender.mjs
//
// Build-time pre-rendering for the TWAM Vite/React app.
//
// Run AFTER `vite build` and AFTER public/generate-sitemap.mjs:
//   node scripts/prerender.mjs
//
// What it does
//   1. Reads every URL from dist/sitemap.xml (one source of truth for routes).
//   2. Serves dist/ on a local port (unknown paths get the untouched SPA shell).
//   3. Opens each URL in headless Chrome, waits for the page to finish loading,
//      and saves the finished HTML to dist/<route>/index.html.
//   4. Keeps the original SPA shell as dist/app-shell.html. App-only routes
//      (cart, account, admin, ...) and any URL that was not pre-rendered fall
//      back to that shell, exactly like today.
//
// Needs:  npm install -D puppeteer
// Env:
//   PRERENDER_CONCURRENCY  pages rendered at once (default 4)
//   PRERENDER_STRICT=1     fail the build if any page fails or comes out empty

import { createServer } from 'node:http'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { join, extname, normalize, dirname } from 'node:path'
import puppeteer from 'puppeteer'

const DIST = join(process.cwd(), 'dist')
const PORT = 4180
const CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY || 4)
const STRICT = process.env.PRERENDER_STRICT === '1'
const MIN_TEXT_LENGTH = 200 // a page with less visible text than this is suspicious

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

// ── Checks ───────────────────────────────────────────────────────────────────
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('prerender: dist/index.html not found. Run the build first.')
  process.exit(1)
}
if (!existsSync(join(DIST, 'sitemap.xml'))) {
  console.error('prerender: dist/sitemap.xml not found. Run generate-sitemap.mjs first.')
  process.exit(1)
}

// ── Keep the untouched SPA shell ─────────────────────────────────────────────
// (Only copied once: a second run must not overwrite it with the pre-rendered home.)
const SHELL = join(DIST, 'app-shell.html')
if (!existsSync(SHELL)) copyFileSync(join(DIST, 'index.html'), SHELL)

// ── Routes ───────────────────────────────────────────────────────────────────
// dist/prerender-routes.json (written by generate-sitemap.mjs) lists every public
// page, including pages that are not in the sitemap (duplicates, noindex).
// Without it, fall back to the URLs in sitemap.xml.
const ROUTES_FILE = join(DIST, 'prerender-routes.json')
let routes
if (existsSync(ROUTES_FILE)) {
  routes = JSON.parse(readFileSync(ROUTES_FILE, 'utf8'))
  console.log(`prerender: ${routes.length} routes found in prerender-routes.json`)
} else {
  const sitemapXml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8')
  routes = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1].replace(/&amp;/g, '&')).pathname
  )
  console.log(`prerender: ${routes.length} routes found in sitemap.xml`)
}

// The 404 page is not in the sitemap. It is rendered through the app's catch-all
// route and saved as dist/404.html (served with status 404 for unknown URLs).
if (!routes.includes('/404')) routes.push('/404')

// ── Tiny static server ───────────────────────────────────────────────────────
// Real files (js, css, images, sitemap.xml) are served as they are.
// Every other path gets the SPA shell, so React Router renders the route.
const server = createServer((req, res) => {
  let urlPath = '/'
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400)
    return res.end()
  }
  const file = normalize(join(DIST, urlPath))
  if (!file.startsWith(DIST)) {
    res.writeHead(403)
    return res.end()
  }
  let target = SHELL
  if (extname(urlPath) && existsSync(file) && statSync(file).isFile()) target = file
  res.writeHead(200, {
    'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
  })
  res.end(readFileSync(target))
})
await new Promise((resolve) => server.listen(PORT, resolve))

// ── Render one route ─────────────────────────────────────────────────────────
async function render(browser, route) {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1366, height: 900 })

    // The app fires these events when a page has finished loading its data.
    await page.evaluateOnNewDocument(() => {
      window.__ready = false
      const done = () => {
        window.__ready = true
      }
      window.addEventListener('page-content-ready', done)
      window.addEventListener('twam-home-ready', done)
    })

    try {
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      })
    } catch (e) {
      console.warn(`prerender: ${route} did not go idle (${e.message}), using what loaded`)
    }

    // Wait until the app says it is ready, or an <h1> has text, then settle.
    await page
      .waitForFunction(
        () =>
          window.__ready ||
          ((document.querySelector('h1') || {}).textContent || '').trim().length > 0,
        { timeout: 8000 }
      )
      .catch(() => {})
    await new Promise((r) => setTimeout(r, 400))

    await page.evaluate(async () => {
      // 1. Remove loading overlays and the route progress bar.
      document
        .querySelectorAll('.twam-overlay, div[style*="z-index: 10000"]')
        .forEach((el) => el.remove())

      // 2. Head tags. Find the ones the page added (not in the plain shell),
      //    drop the shell's default tag when the page has its own, and mark the
      //    page's tags so main.tsx can remove them before React renders again.
      const SEL =
        'title, link[rel="canonical"], meta[name], meta[property], script[type="application/ld+json"]'
      const keyOf = (el) =>
        el.tagName === 'SCRIPT'
          ? 'ld:' + el.outerHTML
          : el.tagName === 'TITLE'
            ? 'title'
            : el.tagName === 'LINK'
              ? 'link:' + el.getAttribute('rel')
              : 'meta:' + (el.getAttribute('name') || el.getAttribute('property'))

      const shellDoc = new DOMParser().parseFromString(
        await (await fetch('/app-shell.html')).text(),
        'text/html'
      )
      const shellTags = new Set(
        [...shellDoc.head.querySelectorAll(SEL)].map((el) => el.outerHTML)
      )
      const added = [...document.head.querySelectorAll(SEL)].filter(
        (el) => !shellTags.has(el.outerHTML)
      )
      const addedKeys = new Set(added.map(keyOf))
      document.head.querySelectorAll(SEL).forEach((el) => {
        if (shellTags.has(el.outerHTML) && addedKeys.has(keyOf(el))) el.remove()
      })
      added.forEach((el) => el.setAttribute('data-prerendered', '1'))
    })

    const html = await page.content()
    const textLength = await page.evaluate(
      () => document.body.innerText.trim().length
    )
    return { html, textLength }
  } finally {
    await page.close()
  }
}

// ── Where to write a route ───────────────────────────────────────────────────
function outFile(route) {
  if (route === '/') return join(DIST, 'index.html')
  if (route === '/404') return join(DIST, '404.html')
  const segments = route
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s).replace(/[<>:"|?*\\]/g, '-'))
  if (segments.some((s) => s === '.' || s === '..')) return null
  return join(DIST, ...segments, 'index.html')
}

// ── Run ──────────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: true,
  // --disable-web-security: the app calls the live API from http://localhost,
  // which the API's CORS rules may reject. Only this build-time browser uses it.
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
})

const results = new Map()
const failures = []
const queue = [...routes]

async function worker() {
  while (queue.length) {
    const route = queue.shift()
    let lastError = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        results.set(route, await render(browser, route))
        lastError = null
        break
      } catch (e) {
        lastError = e
      }
    }
    if (lastError) failures.push(`${route}: ${lastError.message}`)
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
await browser.close()
server.close()

// ── Write all files at the end (so the shell stays intact while rendering) ──
const thin = []
let written = 0
for (const [route, { html, textLength }] of results) {
  const file = outFile(route)
  if (!file) {
    failures.push(`${route}: unsafe path`)
    continue
  }
  if (textLength < MIN_TEXT_LENGTH) thin.push(`${route} (${textLength} chars)`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  written++
}

// The route list is only a build helper: do not publish it.
try {
  unlinkSync(ROUTES_FILE)
} catch {
  /* not there */
}

console.log(`prerender: wrote ${written} of ${routes.length} pages`)
if (thin.length) console.warn(`prerender: pages with very little text:\n  ${thin.join('\n  ')}`)
if (failures.length) console.warn(`prerender: failed pages:\n  ${failures.join('\n  ')}`)

if (STRICT && (failures.length || thin.length)) process.exit(1)
if (written === 0) process.exit(1)

  //update