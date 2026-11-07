import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.onlytwam.com'

// Static pages that should be indexed
const routes = ['/']

// For product pages, fetch from your API here and push the URLs:
// const products = await (await fetch('https://your-api/products')).json()
// products.forEach(p => routes.push(`/product/${p.slug}`))

const today = new Date().toISOString().split('T')[0]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${SITE}${r}</loc>
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
console.log('sitemap.xml generated')