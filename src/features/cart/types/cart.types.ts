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
  colorName: string | null;
  colorHex: string | null;
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

export interface ShippingOption {
  deliveryChargeId: number;
  shippingTypeId: number | null;
  deliveryCharges: number | null;
  isFree: boolean | null;
  days: string | null;
  description: string | null;
  orderValueRange: string | null;
  minOrderValue?: number | null;
  isEligible?: boolean | null;
  unlockAmount?: number | null;
  shippingType: { shippingTypeId: number; shippingType: string } | null;
  cost?: number;
  name?: string;
  estimatedDays?: number;
}

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
