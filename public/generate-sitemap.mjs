import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.onlytwam.com'
// The pipeline passes VITE_API_BASE_URL to the build step, so Node can read it here
const API = (process.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// ── Static public pages ──────────────────────────────────────────────────────
const routes = new Set([
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
  '/all-products',
  '/user-products/product-list',
  '/privacy-policy',
  '/terms-conditions',
  '/shipping-info',
  '/return-refund-policy',
  '/news-privacy-policy',
])

// ── Dynamic pages from the API ───────────────────────────────────────────────
// Fill in the endpoints and field names once confirmed (see notes below).
// Each block is skipped safely when the endpoint is empty or the call fails,
// so a failed fetch can never break the build.
const PRODUCTS_ENDPOINT = '' // e.g. '/Products/List?pageSize=1000'
const CATEGORIES_ENDPOINT = '' // e.g. '/Categories/List'

async function getJson(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function addProducts() {
  if (!API || !PRODUCTS_ENDPOINT) return
  try {
    const data = await getJson(PRODUCTS_ENDPOINT)
    const items = data.list ?? data // adjust to the real response shape
    items.forEach((p) => {
      // adjust field names (productId, name) to match the real API
      routes.add(
        `/user-products/product-detail/${p.productId}/${encodeURIComponent(p.name)}`
      )
    })
    console.log(`products added: ${items.length}`)
  } catch (e) {
    console.warn('products skipped:', e.message)
  }
}

async function addCategories() {
  if (!API || !CATEGORIES_ENDPOINT) return
  try {
    const data = await getJson(CATEGORIES_ENDPOINT)
    const items = data.list ?? data // adjust to the real response shape
    items.forEach((c) => {
      // adjust the field name (categoryId) to match the real API
      routes.add(`/user-products/product-list/${c.categoryId}`)
    })
    console.log(`categories added: ${items.length}`)
  } catch (e) {
    console.warn('categories skipped:', e.message)
  }
}

await addProducts()
await addCategories()

// ── Build the files ──────────────────────────────────────────────────────────
const xmlEscape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const today = new Date().toISOString().split('T')[0]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...routes]
  .map(
    (r) => `  <url>
    <loc>${xmlEscape(SITE + r)}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`

mkdirSync('dist', { recursive: true })
writeFileSync('dist/sitemap.xml', xml)
writeFileSync(
  'dist/robots.txt',
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
)
console.log(`sitemap.xml generated (${routes.size} URLs)`)