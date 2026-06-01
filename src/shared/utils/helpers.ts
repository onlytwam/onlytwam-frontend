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
const _apiBase =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api";

const API_ORIGIN = _apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

const BLOB_BASE = (
  (import.meta as any).env?.VITE_AZURE_BLOB_BASE_URL ||
  "https://twamstorage.blob.core.windows.net/product-images"
).replace(/\/+$/, "");

export const getImageUrl = (
  path: string | null | undefined,
  fallback = "/assets/category-bg.png",
): string => {
  if (!path) return fallback;

  // Already a blob/CDN URL — return as-is
  if (
    path.startsWith("https://twamstorage") ||
    path.startsWith("https://twamlivestorage")
  ) {
    return path;
  }

  // Full URL (could be old local API URL like https://api.preprod.onlytwam.com/uploads/...)
  // Strip the host and treat the pathname as a relative path to re-route through blob
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      path = path.replace(/^https?:\/\/[^/]*/, "");
    }
  }

  const clean = path.replace(/^\/+/, "").replace(/^uploads\/+/, "");

  if (!clean) return fallback;

  return `${BLOB_BASE}/${clean}`;
};

export const getCanvasSafeImageUrl = (
  path: string | null | undefined,
  fallback = "/assets/category-bg.png",
): string => {
  if (!path) return fallback;

  const trimmed = path.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:"))
    return trimmed;
  if (trimmed.startsWith("/assets/") || trimmed.startsWith("assets/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const resolved = getImageUrl(trimmed, fallback);

  if (typeof window === "undefined") return resolved;

  try {
    const resolvedUrl = new URL(resolved, window.location.origin);

    if (resolvedUrl.origin === window.location.origin) {
      return resolvedUrl.toString();
    }

    if (resolvedUrl.origin === API_ORIGIN) {
      return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
    }

    return resolved;
  } catch {
    return resolved;
  }
};
