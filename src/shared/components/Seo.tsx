// src/shared/components/Seo.tsx
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, matchPath } from "react-router-dom";
import { useMenuStore } from "@/shared/store/menuStore";
import {
  STATIC_SEO,
  PRIVATE_PAGES,
  PRIVATE_DESCRIPTION,
} from "@/shared/seo/staticSeo";
import { productSlug } from "@/shared/lib/urls";
import {
  organizationJsonLd,
  websiteJsonLd,
  breadcrumbJsonLd,
} from "@/shared/seo/jsonLd";

export const SITE = "https://www.onlytwam.com";
const BRAND = "TWAM";
// Fallback share image. Ideally replace with a 1200x630 brand image.
const DEFAULT_IMAGE = `${SITE}/assets/Twam-Logo-Burgundy.png`;

export type JsonLd = Record<string, any>;

export const absoluteUrl = (path: string) =>
  /^https?:\/\//i.test(path)
    ? path
    : `${SITE}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
  /** One or more schema.org JSON-LD objects to embed on the page. */
  jsonLd?: JsonLd | JsonLd[];
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function humanize(value: string) {
  return decodeURIComponent(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fitDescription(value: string) {
  const d = value.trim().replace(/\s+/g, " ");
  if (d.length <= 160) return d;
  const cut = d.slice(0, 159);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:\s]+$/, "") + "…";
}

// ⚠ Field names are guesses. Adjust to your real menu data.
function menuId(m: any): string {
  return String(m.id ?? m.categoryId ?? m.menuId ?? "");
}
function menuLabel(m: any): string {
  return m.name ?? m.categoryName ?? m.menuName ?? "";
}
function menuKids(m: any): any[] {
  return m.children ?? m.subCategories ?? m.subMenus ?? [];
}

function findMenuName(menus: any[], id: string): string | null {
  for (const m of menus ?? []) {
    if (menuId(m) === id) return menuLabel(m) || null;
    const found = findMenuName(menuKids(m), id);
    if (found) return found;
  }
  return null;
}

function findNameBySlug(menus: any[], slug: string): string | null {
  for (const m of menus ?? []) {
    const name = menuLabel(m);
    if (name && productSlug(name) === slug) return name;
    const found = findNameBySlug(menuKids(m), slug);
    if (found) return found;
  }
  return null;
}

export default function Seo({
  title,
  description,
  path,
  image,
  type = "website",
  noindex,
  jsonLd,
}: SeoProps) {
  const { pathname } = useLocation();
  const menus = useMenuStore((s: any) => s.menus);
  const cleanPath = normalizePath(path ?? pathname);

  let autoTitle: string | undefined;
  let autoDescription: string | undefined;
  let canonicalPath = cleanPath;
  let isNoindex = noindex ?? false;
  let categoryName: string | null = null;

  // 1. Static pages
  const staticPage = STATIC_SEO[cleanPath];
  if (staticPage) {
    autoTitle = staticPage.title;
    autoDescription = staticPage.description;
    if (staticPage.canonicalPath) canonicalPath = staticPage.canonicalPath;
    if (staticPage.noindex) isNoindex = true;
  }

  // 2. Category listing — name-only URL (/cycling-shorts) or legacy (/28, /28-name)
  const list = matchPath("/user-products/product-list/:slug", cleanPath);
  if (!autoTitle && list?.params.slug) {
    const slug = list.params.slug;
    const legacyId = /^(\d+)(?:-.*)?$/.exec(slug)?.[1];
    categoryName =
      findNameBySlug(menus, slug) ||
      (legacyId ? findMenuName(menus, legacyId) : null);
    if (categoryName) {
      autoTitle = `${categoryName} for Women | ${BRAND}`;
      autoDescription = `Shop ${categoryName.toLowerCase()} for women at ${BRAND}. Discover comfortable, confident styles in every size, with easy returns and free shipping over ₹5000.`;
      // Legacy id URLs point their canonical at the name-only URL.
      canonicalPath = `/user-products/product-list/${productSlug(categoryName)}`;
    }
  }

  // 3. Private pages
  if (!autoTitle) {
    const priv = PRIVATE_PAGES.find(
      (p) => cleanPath === p.path || cleanPath.startsWith(p.path + "/"),
    );
    if (priv) {
      autoTitle = priv.title;
      autoDescription = PRIVATE_DESCRIPTION;
      isNoindex = true;
    }
  }

  // 4. Last resort (skipped for category pages while menus load, and for
  //    product pages, which render their own <Seo />)
  if (
    !autoTitle &&
    !list &&
    cleanPath !== "/" &&
    !cleanPath.startsWith("/product/")
  ) {
    const seg = cleanPath.split("/").filter((s) => s && !/^\d+$/.test(s)).pop();
    if (seg) {
      const name = humanize(seg);
      autoTitle = `${name} | ${BRAND}`;
      autoDescription = `Explore ${name.toLowerCase()} at ${BRAND}. Comfortable, confident styles for women where every body finds its perfect fit, with easy returns.`;
    }
  }

  const finalTitle = title ?? autoTitle;
  const finalDescription = description ?? autoDescription;
  const canonicalUrl = `${SITE}${canonicalPath === "/" ? "" : canonicalPath}`;

  useEffect(() => {
    if (!finalTitle) return;
    document.head
      .querySelectorAll("[data-prerendered]")
      .forEach((el) => el.remove());
  }, [finalTitle]);

  if (!finalTitle || !finalDescription) return null;

  const desc = fitDescription(finalDescription);
  const ogImage = image ? absoluteUrl(image) : DEFAULT_IMAGE;

  // ── Structured data ───────────────────────────────────────────────────────
  const blocks: JsonLd[] = [];
  if (jsonLd) blocks.push(...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]));

  if (cleanPath === "/") {
    blocks.push(organizationJsonLd(), websiteJsonLd());
  }

  if (categoryName) {
    blocks.push(
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "All Products", path: "/user-products/product-list" },
        { name: categoryName, path: canonicalPath },
      ]),
    );
  }

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={desc} />
      {isNoindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <link rel="canonical" href={canonicalUrl} />
      )}

      {/* Open Graph */}
      <meta property="og:site_name" content={BRAND} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD (not emitted on noindex pages) */}
      {!isNoindex &&
        blocks.map((block, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(block).replace(/</g, "\\u003c")}
          </script>
        ))}
    </Helmet>
  );
}
//update