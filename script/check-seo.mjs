// scripts/check-seo.mjs
//
// Checks a DEPLOYED site against the 10 SEO conditions. Needs Node 18+ (fetch).
//
//   node scripts/check-seo.mjs https://qa.onlytwam.com
//   node scripts/check-seo.mjs https://www.onlytwam.com --all
//
//   --all         check every sitemap URL (default: all pages + up to 20 products)
//   --products=N  how many product pages to sample (default 20)
//
// It reads the RAW HTML the server sends (no JavaScript), which is what a crawler
// sees first. Exit code is 1 when any FAIL is found.

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || '').replace(/\/$/, '')
if (!BASE) {
  console.error('Usage: node scripts/check-seo.mjs https://www.onlytwam.com [--all] [--products=20]')
  process.exit(2)
}
const ALL = args.includes('--all')
const PRODUCT_SAMPLE = Number((args.find((a) => a.startsWith('--products=')) || '').split('=')[1] || 20)
const DEFAULT_TITLE = 'TWAM — Comfort Meets Confidence'
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; TwamSeoCheck/1.0)' }

let fails = 0
const log = (level, msg) => {
  if (level === 'FAIL') fails++
  console.log(`${level.padEnd(4)}  ${msg}`)
}
const section = (t) => console.log(`\n== ${t}`)

// ── tiny HTML helpers (no dependencies) ──────────────────────────────────────
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? decode(m[2] ?? m[3]) : null
}
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []
const metaContent = (html, by, key) => {
  const t = tags(html, 'meta').find((x) => (attr(x, by) || '').toLowerCase() === key)
  return t ? attr(t, 'content') : null
}
const norm = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/'
const pathOf = (u) => { try { return norm(new URL(u, BASE).pathname) } catch { return norm(u) } }

function analyse(html) {
  const titles = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1].trim()))
  const descriptions = tags(html, 'meta').filter((t) => (attr(t, 'name') || '').toLowerCase() === 'description')
  const canonicals = tags(html, 'link').filter((t) => (attr(t, 'rel') || '').toLowerCase() === 'canonical')
  const ldTypes = []
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1])
      for (const d of Array.isArray(data) ? data : [data]) ldTypes.push(...[].concat(d['@type'] || []))
    } catch { ldTypes.push('INVALID-JSON') }
  }
  const imgs = tags(html, 'img')
  const noAlt = imgs.filter((t) => attr(t, 'alt') === null).length
  const emptyAlt = imgs.filter(
    (t) => attr(t, 'alt') === '' && !/aria-hidden\s*=\s*"true"/i.test(t) && !/role\s*=\s*"presentation"/i.test(t)
  ).length
  const text = decode(
    html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
  return {
    title: titles[0] ?? null, titleCount: titles.length,
    description: descriptions.length ? attr(descriptions[0], 'content') : null, descriptionCount: descriptions.length,
    canonical: canonicals.length ? attr(canonicals[0], 'href') : null, canonicalCount: canonicals.length,
    robots: metaContent(html, 'name', 'robots'),
    h1: (html.match(/<h1\b/gi) || []).length,
    ogTitle: metaContent(html, 'property', 'og:title'), ogDesc: metaContent(html, 'property', 'og:description'),
    ogImage: metaContent(html, 'property', 'og:image'), twitterCard: metaContent(html, 'name', 'twitter:card'),
    ldTypes, images: imgs.length, noAlt, emptyAlt,
    links: (html.match(/<a\b[^>]*\shref=/gi) || []).length,
    textLength: text.length,
  }
}

async function get(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', headers: UA, ...opts })
  return { res, status: res.status, body: opts.method === 'HEAD' ? '' : await res.text() }
}

const report = (label, bad, hint = '') => {
  if (!bad.length) return log('PASS', label)
  log('FAIL', `${label}: ${bad.length} page(s)${hint ? ' - ' + hint : ''}`)
  bad.slice(0, 8).forEach((b) => console.log(`        ${b}`))
  if (bad.length > 8) console.log(`        ... and ${bad.length - 8} more`)
}

// ── 8. sitemap + robots ──────────────────────────────────────────────────────
section('8. Sitemap and robots.txt')
const sm = await get('/sitemap.xml')
let urls = []
if (sm.status !== 200) log('FAIL', `/sitemap.xml returned ${sm.status} (expected 200)`)
else {
  const type = sm.res.headers.get('content-type') || ''
  if (!/xml/i.test(type)) log('FAIL', `/sitemap.xml content-type is "${type}" (expected xml): the site is returning a page, not the file`)
  else log('PASS', '/sitemap.xml is served as XML')
  urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
  log(urls.length ? 'PASS' : 'FAIL', `sitemap lists ${urls.length} URLs`)
  const paths = urls.map(pathOf)
  const products = paths.filter((p) => p.startsWith('/product/')).length
  const cats = paths.filter((p) => /^\/user-products\/product-list\/\d/.test(p)).length
  console.log(`      (${products} product URLs, ${cats} category URLs)`)
  for (const bad of ['/unsubscribe', '/news-privacy-policy', '/all-products', '/cart', '/login', '/admin'])
    if (paths.includes(bad)) log('FAIL', `sitemap should not list ${bad}`)
}
const robots = await get('/robots.txt')
log(/Sitemap:\s*https:\/\/www\.onlytwam\.com\/sitemap\.xml/i.test(robots.body) ? 'PASS' : 'FAIL',
  'robots.txt contains "Sitemap: https://www.onlytwam.com/sitemap.xml"')

// ── pick pages to check ──────────────────────────────────────────────────────
const sitePaths = [...new Set(urls.map(pathOf))]
const isProduct = (p) => p.startsWith('/product/')
const nonProducts = sitePaths.filter((p) => !isProduct(p))
let productPaths = sitePaths.filter(isProduct)
if (!ALL && productPaths.length > PRODUCT_SAMPLE) {
  const step = productPaths.length / PRODUCT_SAMPLE
  productPaths = Array.from({ length: PRODUCT_SAMPLE }, (_, i) => productPaths[Math.floor(i * step)])
}
const pages = [...nonProducts, ...productPaths]
console.log(`\nChecking ${pages.length} pages (raw HTML, no JavaScript)...`)

const results = []
let idx = 0
await Promise.all(Array.from({ length: 5 }, async () => {
  while (idx < pages.length) {
    const p = pages[idx++]
    try {
      const r = await get(p)
      results.push({ path: p, status: r.status, location: r.res.headers.get('location'), ...analyse(r.body) })
    } catch (e) {
      results.push({ path: p, status: 0, error: e.message })
    }
  }
}))
results.sort((a, b) => a.path.localeCompare(b.path))

// ── 1, 2, 4, 7, 9, 10 on the sampled pages ───────────────────────────────────
section('1. Readable without JavaScript')
report('HTTP 200 straight from the server (no redirect)', results.filter((r) => r.status !== 200).map((r) => `${r.path} -> ${r.status}${r.location ? ' ' + r.location : ''}`))
const ok = results.filter((r) => r.status === 200)
report('visible text in the raw HTML (not an empty shell)', ok.filter((r) => r.textLength < 200).map((r) => `${r.path} (${r.textLength} chars)`))
report('real <a href> links present', ok.filter((r) => r.links < 3).map((r) => `${r.path} (${r.links} links)`))

section('2. Unique title and meta description')
report('title is not the default one', ok.filter((r) => !r.title || r.title === DEFAULT_TITLE).map((r) => `${r.path}: ${r.title}`))
report('exactly one <title> and one description', ok.filter((r) => r.titleCount !== 1 || r.descriptionCount !== 1).map((r) => `${r.path}: ${r.titleCount} titles, ${r.descriptionCount} descriptions`))
report('description is 140-160 characters', ok.filter((r) => !r.description || r.description.length < 140 || r.description.length > 160).map((r) => `${r.path}: ${r.description ? r.description.length : 'none'}`))
const dup = (key) => {
  const seen = new Map()
  ok.forEach((r) => r[key] && seen.set(r[key], [...(seen.get(r[key]) || []), r.path]))
  return [...seen.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${v.join(', ')}  <- same ${key}: "${k.slice(0, 50)}"`)
}
report('titles are unique', dup('title'))
report('descriptions are unique', dup('description'))
const longTitles = ok.filter((r) => r.title && r.title.length > 70).map((r) => `${r.path}: ${r.title.length} chars`)
if (longTitles.length) log('WARN', `${longTitles.length} title(s) over 70 characters (Google may cut them)`)
const suspect = ok.filter((r) => isProduct(r.path) && r.title && /(^|\s)[A-Za-z](\s|$)/.test(r.title.replace(/\s\|.*$/, '').replace(/\b[aAI]\b|&/g, '')))
if (suspect.length) log('WARN', `${suspect.length} product title(s) look broken (stray single letters, e.g. "Soli d"): ${suspect.slice(0, 3).map((r) => r.title).join(' / ')}`)

section('4. Canonical tags')
report('exactly one canonical tag', ok.filter((r) => r.canonicalCount !== 1).map((r) => `${r.path}: ${r.canonicalCount}`))
report('canonical points to the page itself (sitemap pages must be canonical)', ok.filter((r) => r.canonical && pathOf(r.canonical) !== r.path).map((r) => `${r.path} -> ${pathOf(r.canonical)}`))
report('no noindex on sitemap pages', ok.filter((r) => /noindex/i.test(r.robots || '')).map((r) => r.path))

section('7. Structured data and social tags')
const home = ok.find((r) => r.path === '/')
if (home) {
  report('home has Organization schema', ['Organization'].filter((t) => !home.ldTypes.includes(t)).map(() => '/'))
  report('home has WebSite schema', ['WebSite'].filter((t) => !home.ldTypes.includes(t)).map(() => '/'))
}
const prods = ok.filter((r) => isProduct(r.path))
if (prods.length) {
  report('product pages have Product schema', prods.filter((r) => !r.ldTypes.includes('Product')).map((r) => r.path))
  report('product pages have BreadcrumbList', prods.filter((r) => !r.ldTypes.includes('BreadcrumbList')).map((r) => r.path))
}
const cats = ok.filter((r) => /^\/user-products\/product-list\/\d/.test(r.path))
if (cats.length) report('category pages have BreadcrumbList', cats.filter((r) => !r.ldTypes.includes('BreadcrumbList')).map((r) => r.path))
report('JSON-LD parses without errors', ok.filter((r) => r.ldTypes.includes('INVALID-JSON')).map((r) => r.path))
report('Open Graph + Twitter tags (og:title, og:description, og:image, twitter:card)', ok.filter((r) => !r.ogTitle || !r.ogDesc || !r.ogImage || !r.twitterCard).map((r) => r.path))
const catWithPaging = cats.length ? cats[0] : null
if (catWithPaging) console.log(`      (item 5: also open ${catWithPaging.path}?page=2 and check the "Next" link is a real <a href>)`)

section('9. Image alt text')
report('every <img> has an alt attribute', ok.filter((r) => r.noAlt > 0).map((r) => `${r.path}: ${r.noAlt} of ${r.images} images`))
const emptyAlt = ok.filter((r) => r.emptyAlt > 0).map((r) => `${r.path}: ${r.emptyAlt}`)
if (emptyAlt.length) log('WARN', `${emptyAlt.length} page(s) have empty alt on non-decorative images: ${emptyAlt.slice(0, 3).join(', ')}`)

section('10. One H1 per page')
report('exactly one <h1>', ok.filter((r) => r.h1 !== 1).map((r) => `${r.path}: ${r.h1} h1`))

// ── 3, 4, 8: server behaviour ────────────────────────────────────────────────
section('3. Real 404s and redirects')
const rnd = `/zzz-seo-check-${Date.now()}`
const nf = await get(rnd)
log(nf.status === 404 ? 'PASS' : 'FAIL', `unknown URL ${rnd} returns ${nf.status} (expected 404)`)
log(/Page not found/i.test(nf.body) && !/<h1[^>]*>\s*Welcome/i.test(nf.body) ? 'PASS' : 'WARN', '404 response shows the site\'s own "Page not found" page (not Azure\'s default)')
const h = await get('/home')
log([301, 308].includes(h.status) && /\/$|\.com$/.test(h.res.headers.get('location') || '') ? 'PASS' : 'FAIL', `/home answers ${h.status} -> ${h.res.headers.get('location')} (expected 301 to /)`)
for (const p of ['/about', '/our-blog'])
  { const r = results.find((x) => x.path === p); if (r) log(r.status === 200 && r.h1 === 1 && r.textLength > 200 ? 'PASS' : 'FAIL', `${p} is its own page (200, own heading, own text)`) }

section('4/8. Duplicates and noindex')
for (const [from, to] of [['/news-privacy-policy', '/privacy-policy'], ['/all-products', '/user-products/product-list']]) {
  const r = await get(from)
  const c = r.status === 200 ? analyse(r.body).canonical : null
  log(c && pathOf(c) === to ? 'PASS' : 'FAIL', `${from} canonical -> ${c ? pathOf(c) : r.status} (expected ${to})`)
}
const un = await get('/unsubscribe')
const unNoindex = /noindex/i.test(analyse(un.body).robots || '') || /noindex/i.test(un.res.headers.get('x-robots-tag') || '')
log(unNoindex ? 'PASS' : 'FAIL', '/unsubscribe has noindex (meta tag or X-Robots-Tag header)')

section('6. Product URLs')
const old = await get('/user-products/product-detail/1/test')
log([301, 308].includes(old.status) ? 'PASS' : 'WARN', `old product URL answers ${old.status}${old.res.headers.get('location') ? ' -> ' + old.res.headers.get('location') : ''} (a real 301 is best; a client-side redirect is a weaker signal)`)
const names = new Map()
prods.forEach((r) => r.title && names.set(r.title, [...(names.get(r.title) || []), r.path]))
const sameName = [...names.entries()].filter(([, v]) => v.length > 1)
if (sameName.length) log('WARN', `${sameName.length} product name(s) shared by several products, e.g. "${sameName[0][0].slice(0, 40)}"`)
console.log('      (catalog typos and duplicate names are data problems: they need fixing in the product database)')

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : `${fails} FAIL(S) - see above`}`)
process.exit(fails ? 1 : 0)
