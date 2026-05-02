// ─── Product Types ────────────────────────────────────────────────────────────

export interface HomeProductModel {
  id: number;
  productId: number;
  productVariantId: number;
  name: string;
  description: string;
  price: number;
  oldPrice: number;
  originalPrice?: number;
  image: string;
  category: string;
  isInStock: boolean;
  bestseller: boolean;
  rating: number;
  selectedImage?: string;
  brandName?: string;
  brandId?: number;
  productCode?: string;
  fabricName?: { name: string };
  isCupSize?: boolean;
  isReturnAvailable?: boolean;
  stockQuantity?: number;
  tag?: string;
  color?: ProductColorSwatch[];
  size?: any[];
  cupSizes?: any[];
  colorOptions?: ProductColorSwatch[];
}

/**
 * Canonical color shape used everywhere in the app.
 *
 * colorName → human label ("Bark")    – labels, aria-label, search, filter grouping
 * colorHex  → CSS hex    ("#C8A882")  – background for every swatch / dot
 *
 * The legacy `color` field is kept as an alias during migration so existing
 * code that reads `c.color` still works — it maps to colorName.
 */
export interface ProductColorSwatch {
  productVariantId: number;
  /** Human-readable name: "Bark", "Midnight", "Coffee Cream" */
  colorName: string;
  /** CSS hex value: "#C8A882". Always resolved — never an empty string. */
  colorHex: string;
  /** Variant thumbnail image path */
  image: string;
  /** @deprecated Use colorName. Kept for backward compatibility. */
  color?: string;
}

/**
 * Shape returned by GET /ProductVariantDetail/GetProductColor
 * after normalisation in products.api.ts.
 */
export interface ColorListItem {
  /** e.g. "Bark" */
  name: string;
  /** e.g. "#C8A882" */
  hex: string;
}

export interface CategoryMenu {
  categoryId: number;
  groupCategoryId?: number;
  name: string;
  url?: string;
  about?: string;
  children: CategoryMenu[];
  parentCategoryId: number | null;
}

export interface MenuModel {
  menuId: number;
  name: string;
  url: string;
  children: MenuModel[];
  parentMenuId: number | null;
  groupMenuId: boolean | null;
}

export interface SizeData {
  sizeLabel: string;
  productVariantDetailId: number;
  isAvailable: boolean;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  breakdown: Record<number, number>;
}

export interface Review {
  name: string;
  date: string;
  rating: number;
  title: string;
  comment: string;
}

export interface Brand {
  brandId: number;
  brandName: string;
  brandImage: string;
  brandLogo?: string;
}

export interface BlogModel {
  blogId: number;
  title: string;
  content: string;
  image: string;
  createdDate: string;
  author?: string;
}