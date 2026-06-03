// Mirrors Angular's slugify used in product routes
export const slugify = (name: string): string => {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Format price in Indian Rupees
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
};

export const getDiscountPercentage = (
  original: number,
  current: number,
): number => {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
};

export const getCartItemTotal = (quantity: number, price: number): string =>
  formatPrice(quantity * price);

export const getStarArray = (): number[] => [1, 2, 3, 4, 5];

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const getCategoryImage = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("bra")) return "assets/images/categories/bras.jpg";
  if (n.includes("pant")) return "assets/images/categories/panties.jpg";
  if (n.includes("swim")) return "assets/images/explore-2.png";
  if (n.includes("active")) return "assets/images/categories/active.jfif";
  if (n.includes("essential")) return "assets/images/categories/essentials.jpg";
  if (n.includes("leak")) return "assets/images/categories/leakproof.jpg";
  return "assets/images/categories/bras.jpg";
};

export const scrollToTop = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

// ─── Image URL helper ──────────────────────────────────────────────────────────
// The backend always resolves images to full URLs before sending to the
// frontend (via resolve_url in url_helpers.py). The frontend must NOT
// construct or modify URLs — just pass them through as-is.
export const getImageUrl = (
  path: string | null | undefined,
  fallback = "",
): string => {
  if (!path) return fallback;
  const value = path.trim();
  if (!value) return fallback;
  // Local blob/data previews (e.g. before upload completes)
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  // Static bundled assets
  if (value.startsWith("/assets/")) return value;
  if (value.startsWith("assets/")) return `/${value}`;
  // Full URL from backend — return as-is
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  // Any other value (should not happen if backend is correct) — return fallback
  return fallback;
};

// Same as getImageUrl — kept for canvas/image-editor callers
export const getCanvasSafeImageUrl = (
  path: string | null | undefined,
  fallback = "",
): string => getImageUrl(path, fallback);
