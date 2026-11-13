// src/shared/seo/seoText.ts
//
// Builds unique titles and descriptions for product and category pages.
// (URLs live in src/shared/lib/urls.ts: productUrl(), categoryUrl().)

/** Collapse whitespace and trim ("Active Wear " becomes "Active Wear"). */
export const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Cut at a word boundary so the text is at most `max` characters. */
export function clamp(text: string, max: number) {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:.\-–—]+$/,
    ""
  );
}

const slugEq = (a: string, b: string) => clean(a).toLowerCase() === b;

// ── Product ──────────────────────────────────────────────────────────────────
export const productTitle = (name: string) =>
  `${clamp(name, 40)} | Buy Online | TWAM`;

export function productDescription(p: {
  name: string;
  color?: string;
  brand?: string;
}) {
  const parts = [
    `Buy ${clamp(p.name, 60)}${p.color ? ` in ${clean(p.color)}` : ""} online at TWAM.`,
    p.brand && slugEq(p.brand, "twam") ? "" : p.brand ? `From ${clean(p.brand)}.` : "",
    "Comfortable fit with easy 15-day returns.",
    "Free shipping on orders over ₹5000.",
    "Fast delivery across India.",
    "Secure online payment.",
  ].filter(Boolean);

  // Add each sentence that still fits (max 160). A sentence that is too long is
  // skipped, so a shorter one after it can still be used to reach 140+.
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length <= 160) out = next;
  }
  return out;
}

// ── Category ─────────────────────────────────────────────────────────────────
export const categoryTitle = (name: string) => `${clean(name)} for Women | TWAM`;

export function categoryDescription(name: string) {
  const n = clean(name);
  const parts = [
    `Shop ${n} for women at TWAM.`,
    "Find your perfect fit with inclusive sizes from XS to 5XL, comfortable fabrics and easy 15-day returns.",
    "Free shipping over ₹5000.",
    "Secure payment.",
    "Easy exchanges.",
  ];
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length <= 160) out = next;
  }
  return out;
}

//update