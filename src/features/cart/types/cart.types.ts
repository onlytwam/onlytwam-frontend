// ─── Cart Types ───────────────────────────────────────────────────────────────

export interface CartModel {
  cartId: number;
  productId: number | null;
  productVariantId: number | null;
  productVariantDetailId: number | null;
  productCode: string | null;
  productName: string | null;
  name: string | null;
  productDescription: string | null;
  brandName: string | null;
  categoryId: number | null;
  brandId: number | null;
  variantName: string | null;
  variantDescription: string | null;
  size: string | null;
  cupSize?: string | null;
  /**
   * Human-readable color name: "Bark", "Midnight", "Coffee Cream".
   * Used for display labels. Auto-resolved from colorHex if absent.
   */
  colorName: string | null;
  /**
   * CSS hex color: "#C8A882".
   * Used for swatch dots in cart / quick-cart. Auto-resolved from colorName if absent.
   */
  colorHex: string | null;
  /**
   * @deprecated Raw value from backend — may be a name OR a hex.
   * Read colorName / colorHex instead. Kept for backwards compat.
   */
  color?: string | null;
  stockQuantity: number | null;
  processedQuantity: number | null;
  returnedQuantity: number | null;
  discountPercent: number | null;
  mrpPrice: number | null;
  finalPrice: number | null;
  personalId: number | null;
  userProfileId: string | null;
  state: string | null;
  image: string | null;
  isSelected?: boolean;
  couponId?: number | null;
  couponAmount?: number | null;
  couponDiscount?: number | null;
  taxAmount?: number | null;
}

// FIX: matches actual backend DeliveryCharge response fields
export interface ShippingOption {
  deliveryChargeId: number;
  shippingTypeId: number | null;
  deliveryCharges: number | null;
  isFree: boolean | null;
  days: string | null;
  description: string | null;
  orderValueRange: string | null;
  shippingType: { shippingTypeId: number; shippingType: string } | null;
  cost?: number;
  name?: string;
  estimatedDays?: number;
}

// FIX: matches actual backend CouponResponse fields
export interface CouponModel {
  couponId: number;
  couponCode: string | null;
  couponName: string | null;
  description: string | null;
  discount: number | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  isCommon: boolean | null;
  toUserProfileId: string | null;
  state: string | null;
  isExpire?: boolean;
  title?: string;
  discountValue?: number;
  expiryDate?: Date | null;
}

export interface AppliedCouponModel {
  couponCode: string;
  discountAmount: number;
  couponId: number;
}