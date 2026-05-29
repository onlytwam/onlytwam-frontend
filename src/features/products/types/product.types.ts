// Product Types

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

export interface ProductColorSwatch {
  productVariantId: number;
  /** Human-readable variant color name, e.g. "Bark" or "Coffee Cream". */
  colorName: string;
  /** MDM color family id used for filtering. */
  colorFamilyId?: number | null;
  /** MDM color family display name. */
  colorFamily?: string | null;
  /** MDM color family swatch hex. */
  colorFamilyHex?: string | null;
  /** Compatibility alias for the MDM color family swatch hex. */
  colorHex: string;
  /** Variant thumbnail image path. */
  image: string;
  /** @deprecated Use colorName. Kept for backward compatibility. */
  color?: string;
}

export interface ColorListItem {
  /** MDM ProductColor id. */
  id: number;
  /** MDM family name, e.g. "Brown". */
  name: string;
  /** Family swatch CSS hex, e.g. "#795548" for Brown. */
  hex: string;
  orderNo?: number | null;
  isActive?: boolean;
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
