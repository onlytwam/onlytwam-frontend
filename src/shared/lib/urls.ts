// src/shared/lib/urls.ts
import { slugify } from "@/shared/utils/helpers";

const MAX_SLUG = 60;

/** URL-safe slug, capped at 60 characters on a word boundary. */
export const productSlug = (name: string): string => {
  const s = slugify(name || "");
  if (s.length <= MAX_SLUG) return s;
  const cut = s.slice(0, MAX_SLUG);
  return s[MAX_SLUG] === "-"
    ? cut
    : cut.slice(0, cut.lastIndexOf("-") > 0 ? cut.lastIndexOf("-") : MAX_SLUG);
};

export const productUrl = (p: { id: number | string; name: string }) => {
  const slug = productSlug(p.name);
  return `/product/${p.id}${slug ? `-${slug}` : ""}`;
};

/** "123-full-coverage-bra" -> { id: 123, slug: "full-coverage-bra" }
 *  Also parses a plain "28" -> { id: 28, slug: "" }, so old links keep working. */
export const parseProductParam = (param?: string) => {
  const m = /^(\d+)(?:-(.*))?$/.exec(param ?? "");
  return m ? { id: Number(m[1]), slug: m[2] ?? "" } : null;
};

// ── Categories: name-only URLs ────────────────────────────────────────────────

/** Category URL, name only: /user-products/product-list/cycling-shorts
 *  Falls back to the id ONLY when no name is available. */
export const categoryUrl = (id: number | string, name?: string): string => {
  const slug = productSlug(name || "");
  return `/user-products/product-list/${slug || id}`;
};

/** "bras" -> { id: null, slug: "bras" };  "7" -> { id: 7, slug: "" } (old links) */
export const parseCategoryParam = (
  param?: string,
): { id: number | null; slug: string } => {
  const p = (param ?? "").trim();
  return /^\d+$/.test(p)
    ? { id: Number(p), slug: "" }
    : { id: null, slug: p.toLowerCase() };
};

export interface CategoryLike {
  categoryId: number;
  name: string;
  children?: CategoryLike[];
}

/** Flatten the nested menu tree (parents + children) into one list. */
export const flattenCategories = <T extends CategoryLike>(tree: T[] = []): T[] => {
  const out: T[] = [];
  const walk = (nodes: T[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children as T[]);
    }
  };
  walk(tree);
  return out;
};

/** Find the category for a URL param ("bras" or legacy "7").
 *  Pass the FLAT list. Returns null if not found (or not loaded yet). */
export const resolveCategory = <T extends CategoryLike>(
  param: string | undefined,
  flat: T[],
): T | null => {
  const { id, slug } = parseCategoryParam(param);
  if (id !== null) return flat.find((c) => c.categoryId === id) ?? null;
  if (!slug) return null;
  return flat.find((c) => productSlug(c.name) === slug) ?? null;
};
//update