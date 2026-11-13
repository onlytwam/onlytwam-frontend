// scripts/generate-sitemap.mjs
//
// Runs after `vite build` (see package.json "build"). Writes into dist/:
//   sitemap.xml            every URL that should be indexed (static + categories + products)
//   robots.txt             crawl rules and the Sitemap: line
//   prerender-routes.json  every public URL the pre-render step must save
//
// Env:
//   VITE_API_BASE_URL   API root
//   SITEMAP_STRICT=1    FAIL the build if the API call fails or returns nothing.
//                       Use only in the deploy pipeline once endpoints work.

import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.onlytwam.com'
const API = (process.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const STRICT = process.env.SITEMAP_STRICT === '1'

// /new-arrivals shows "No new arrivals" when nothing is new. Keep it out of the
// sitemap unless the page always has products (an empty page is a "soft 404").
const INCLUDE_NEW_ARRIVALS = false

// ── CONFIG ───────────────────────────────────────────────────────────────────
// ⚠ If VITE_API_BASE_URL does not already end in "/api", add "/api" to the
//   start of each endpoint below.
const PRODUCTS = {
  // Product URLs use the VARIANT id, so list variants.
  endpoint: '/ProductVariantDetail/UserProductVariantDetail?page.index=1&page.size=1000',
  listKey: 'list',
  idField: 'productVariantId',
  nameField: 'name',
  updatedField: '', // e.g. 'modifiedDate' (optional, used for <lastmod>)
}


// ── URL builders: MUST match src/shared/lib/urls.ts ─────────────────────────
// ⚠ slugify below is a stand-in. Copy the exact logic of `slugify` from
//   src/shared/utils/helpers.ts here, or category URLs will not match the
//   canonical URLs the pages declare.
const slugify = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const MAX_SLUG = 60
const productSlug = (name) => {
  const s = slugify(name || '')
  if (s.length <= MAX_SLUG) return s
  const cut = s.slice(0, MAX_SLUG)
  return s[MAX_SLUG] === '-'
    ? cut
    : cut.slice(0, cut.lastIndexOf('-') > 0 ? cut.lastIndexOf('-') : MAX_SLUG)
}
const productPath = (id, name) => {
  const slug = productSlug(name)
  return `/product/${id}${slug ? `-${slug}` : ''}`
}
// Name-only category URL, same as categoryUrl() in urls.ts
const categoryPath = (id, name) => {
  const slug = productSlug(name)
  return `/user-products/product-list/${slug || id}`
}

const CATEGORIES = {
  endpoint: '/Category/GetProductDetailCategory?page.size=200&order.property=DisplayOrder&order.ascending=true',
  listKey: 'list',
  idField: 'categoryId',
  nameField: 'name',
  activeField: 'isActive', // harmless if the field doesn't exist; only an explicit false is skipped
  childrenField: '',
}

// ── Static pages ─────────────────────────────────────────────────────────────
// Canonical, indexable pages only. (/all-products and /news-privacy-policy point
// their canonical at another page, and /unsubscribe is noindex.)
const sitemapRoutes = new Set([
  '/',
  '/about',
  '/contact-us',
  '/our-stores',
  '/our-blog',
  '/only-twam',
  '/shop-by-size',
  '/size-guide',
  '/twam-brands',
  '/your-fit-founder',
  '/take-quiz',
  '/best-sellers',
  '/user-products/product-list',
  '/privacy-policy',
  '/terms-conditions',
  '/shipping-info',
  '/return-refund-policy',
])
if (INCLUDE_NEW_ARRIVALS) sitemapRoutes.add('/new-arrivals')

// Public pages that must exist as real pages (pre-rendered) but are not in the sitemap.
const extraPrerenderRoutes = ['/all-products', '/news-privacy-policy']

const lastmod = new Map() // route -> YYYY-MM-DD
const today = new Date().toISOString().split('T')[0]

// ── API helpers ──────────────────────────────────────────────────────────────
async function getList({ endpoint, listKey }) {
  const res = await fetch(`${API}${endpoint}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${endpoint}`)
  const data = await res.json()
  const items = listKey ? data?.[listKey] : data
  if (!Array.isArray(items)) throw new Error(`no array found at "${listKey || '(root)'}"`)
  return items
}

function fail(what, e) {
  const msg = `sitemap: ${what} failed: ${e.message}`
  if (STRICT) {
    console.error(msg)
    process.exit(1)
  }
  console.warn(msg + ' (continuing without them; set SITEMAP_STRICT=1 to fail instead)')
}

async function addCategories() {
  if (!API || !CATEGORIES.endpoint) {
    console.warn('sitemap: categories skipped (no API URL or endpoint set)')
    return
  }
  try {
    let items = await getList(CATEGORIES)
    if (CATEGORIES.activeField) items = items.filter((c) => c[CATEGORIES.activeField])
    items.forEach((c) =>
      sitemapRoutes.add(categoryPath(c[CATEGORIES.idField], c[CATEGORIES.nameField]))
    )
    console.log(`sitemap: ${items.length} categories`)
    if (STRICT && items.length === 0) throw new Error('0 categories returned')
  } catch (e) {
    fail('categories', e)
  }
}

async function addProducts() {
  if (!API || !PRODUCTS.endpoint) {
    console.warn('sitemap: products skipped (no API URL or endpoint set)')
    return
  }
  try {
    const items = await getList(PRODUCTS)
    for (const p of items) {
      const id = p[PRODUCTS.idField]
      const name = p[PRODUCTS.nameField]
      if (id === undefined || id === null || !name) continue
      const route = productPath(id, name)
      sitemapRoutes.add(route)
      const raw = PRODUCTS.updatedField && p[PRODUCTS.updatedField]
      const d = raw ? new Date(raw) : null
      if (d && !Number.isNaN(d.getTime())) lastmod.set(route, d.toISOString().split('T')[0])
    }
    console.log(`sitemap: ${items.length} products`)
    if (STRICT && items.length === 0) throw new Error('0 products returned')
  } catch (e) {
    fail('products', e)
  }
}

await addCategories()
await addProducts()

// ── Files ────────────────────────────────────────────────────────────────────
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const routes = [...sitemapRoutes]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${xmlEscape(SITE + (r === '/' ? '' : r))}</loc>
    <lastmod>${lastmod.get(r) || today}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`

// Private and checkout pages stay out of crawling. The Sitemap: line must stay.
// /unsubscribe is NOT disallowed on purpose: Google has to crawl it to see its noindex tag.
const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /login
Disallow: /register
Disallow: /verify-otp
Disallow: /reset-password
Disallow: /cart
Disallow: /wishlist
Disallow: /notifications
Disallow: /global-search
Disallow: /order-details
Disallow: /user-products/cart
Disallow: /user-products/payment
Disallow: /user-products/payment-address
Disallow: /user-products/shipping-option
Disallow: /user-products/payment-callback
Disallow: /user-products/order-confirm
Disallow: /user-products/invoice-details
Disallow: /user-products/return-

Sitemap: ${SITE}/sitemap.xml
`

// Google accepts up to 50,000 URLs per sitemap file.
if (routes.length > 50000) {
  console.error(`sitemap: ${routes.length} URLs is over the 50,000 limit: split into several files.`)
  process.exit(1)
}

mkdirSync('dist', { recursive: true })
writeFileSync('dist/sitemap.xml', xml)
writeFileSync('dist/robots.txt', robots)
writeFileSync(
  'dist/prerender-routes.json',
  JSON.stringify([...new Set([...routes, ...extraPrerenderRoutes])], null, 2)
)
console.log(`sitemap.xml generated (${routes.length} URLs)`)
