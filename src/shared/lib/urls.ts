// src/shared/lib/urls.ts
//
// URL helpers.
//   Product URL : /user-products/product-list/{category}/product/{slug}
//   Category URL: /user-products/product-list/{category-slug}
//
// Product URLs carry ONLY a slug (no numeric id). To open the right product,
// the slug → variant id map is remembered in memory AND localStorage, so it
// survives a page refresh in the same browser.
//
// LIMIT: a slug the browser has never seen (shared link, search-engine result,
// new device) cannot be resolved without a backend lookup. See parseProductParam.

// ── Slugs ─────────────────────────────────────────────────────────────────────

/** "Non-Wired T-Shirt Bra!" → "non-wired-t-shirt-bra" */
export const productSlug = (value: string = ""): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** name + colour → "non-wired-t-shirt-bra-black" (colour added once). */
export const variantSlug = (name: string = "", color: string = ""): string => {
  const nameSlug = productSlug(name);
  const colorSlug = productSlug(color);
  if (!nameSlug) return "";
  if (!colorSlug) return nameSlug;
  // Don't append the colour if the product name already ends with it.
  if (nameSlug === colorSlug || nameSlug.endsWith(`-${colorSlug}`)) {
    return nameSlug;
  }
  return `${nameSlug}-${colorSlug}`;
};

// ── slug → variant id registry (memory + localStorage) ───────────────────────

const SLUG_STORAGE_KEY = "twam_product_slug_map";
const slugToId = new Map<string, number>();

// Load what earlier visits remembered, so a refresh keeps working.
if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(SLUG_STORAGE_KEY) || "{}",
    );
    for (const [slug, id] of Object.entries(saved)) {
      const n = Number(id);
      if (slug && n > 0) slugToId.set(slug, n);
    }
  } catch {
    /* corrupt or blocked storage: start empty */
  }
}

const persistSlugMap = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SLUG_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(slugToId)),
    );
  } catch {
    /* storage full or blocked: memory map still works this session */
  }
};

/** Remember which variant a slug belongs to. */
export const registerProductSlug = (
  slug: string,
  id: number | string,
): void => {
  const n = Number(id);
  if (!slug || !(n > 0)) return;
  if (slugToId.get(slug) === n) return; // nothing changed
  slugToId.set(slug, n);
  persistSlugMap();
};

/** Look a slug up (or null when this browser has never seen it). */
export const lookupProductSlug = (slug: string): number | null =>
  slugToId.get(slug) ?? null;

// ── Parsing the :idSlug route param ───────────────────────────────────────────

/**
 * Accepts, in this order:
 *   "123"                      → { id: 123 }   (bare id)
 *   "123-non-wired-bra-black"  → { id: 123 }   (legacy id-slug links)
 *   "non-wired-bra-black"      → looked up in the slug registry
 * Returns null when the id cannot be determined (page shows NotFound).
 */
export const parseProductParam = (
  param?: string | null,
): { id: number; slug: string } | null => {
  if (!param) return null;
  const value = decodeURIComponent(String(param)).trim();
  if (!value) return null;

  // Bare id or legacy "123-slug"
  const legacy = /^(\d+)(?:-(.*))?$/.exec(value);
  if (legacy) {
    const id = Number(legacy[1]);
    if (id > 0) return { id, slug: legacy[2] ?? "" };
  }

  // Slug-only
  const id = slugToId.get(value);
  return id ? { id, slug: value } : null;
};

// ── Product URL ───────────────────────────────────────────────────────────────

export const productUrl = (p: {
  id: number | string;
  name: string;
  color?: string;
  category?: string;
  isDefault?: boolean; // accepted for old callers; no longer used
}): string => {
  const category = productSlug(p.category ?? "") || "all";
  const slug = variantSlug(p.name, p.color);
  const base = `/user-products/product-list/${category}/product`;

  // No usable slug → bare id keeps the link working.
  if (!slug) return `${base}/${p.id}`;

  registerProductSlug(slug, p.id);
  return `${base}/${slug}`;
};

// ── Category URL ──────────────────────────────────────────────────────────────

/** /user-products/product-list/{category-slug}; falls back to the numeric id. */
export const categoryUrl = (
  id: number | string,
  name?: string | null,
): string => {
  const slug = productSlug(name ?? "");
  return `/user-products/product-list/${slug || id}`;
};