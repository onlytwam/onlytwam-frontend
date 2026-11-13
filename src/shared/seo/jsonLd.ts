// src/shared/seo/jsonLd.ts
//
// Builders for schema.org structured data (JSON-LD).
// Rule from Google: structured data must match what the visitor can see on the
// page. Only output a price, stock status or rating that the page really shows.

const SITE = "https://www.onlytwam.com";
const abs = (p: string) =>
  /^https?:\/\//i.test(p) ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`;

// ── Home page ────────────────────────────────────────────────────────────────
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TWAM",
    url: SITE,
    logo: `${SITE}/assets/Twam-Logo-Burgundy.png`,
    // Taken from the links in the site footer.
    sameAs: [
      "https://www.facebook.com/onlyTwam/",
      "https://www.instagram.com/onlytwam/",
      "https://x.com/Only_Twam",
      "https://www.youtube.com/channel/UCHeGOyt3gARVUcWuYTvUdgg",
    ],
  };
}

export function websiteJsonLd() {
  // No SearchAction on purpose: add it only after confirming the exact query
  // parameter that /global-search reads.
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TWAM",
    url: SITE,
  };
}

// ── Category and product pages ───────────────────────────────────────────────
export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export type ProductLdInput = {
  name: string;
  description?: string;
  /** Absolute urls or paths. At least one image is expected by Google. */
  images: string[];
  sku?: string | number;
  brand?: string;
  color?: string;
  /** Canonical path of the product page, e.g. "/product/12-minimizer-bra". */
  path: string;
  price: number;
  currency?: string; // default INR
  inStock: boolean;
  /** Only pass real review data. Leave both out when there are no reviews. */
  ratingValue?: number;
  ratingCount?: number;
};

export function productJsonLd(p: ProductLdInput) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images.map(abs),
    ...(p.description ? { description: p.description } : {}),
    ...(p.sku !== undefined ? { sku: String(p.sku) } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.color ? { color: p.color } : {}),
    offers: {
      "@type": "Offer",
      url: abs(p.path),
      priceCurrency: p.currency || "INR",
      price: Number(p.price.toFixed(2)),
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (p.ratingValue && p.ratingCount && p.ratingCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(p.ratingValue.toFixed(1)),
      reviewCount: p.ratingCount,
    };
  }
  return ld;
}

