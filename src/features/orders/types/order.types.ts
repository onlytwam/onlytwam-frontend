// ─── Order Types ──────────────────────────────────────────────────────────────

export interface OrderModel {
  orderId: number;
  totalAmount?: number;
  orderDate?: Date;
  userProfileId?: string;
  state?: string;
  shippingAddressId?: number;
  billingAddressId?: number;
  orderItems?: OrderItemModel[];
  couponId?: number;
  couponAmount?: number;
  deliveryCharge?: number;
  shippingTypeId?: number;
  subTotal: number;
  cartId?: number[];
  orderNumber: string | null;
  isWhatsappNotification?: boolean | null;
}

export interface OrderItemModel {
  orderItemId: number;
  orderId: number;
  productVariantDetailId?: number;
  productId?: number;
  quantity?: number;
  price?: number;
}

export interface ReturnOrderItemModel {
  OrderId?: number | null;
  OrderNumber?: string | null;
  OrderItems?: any[] | null;
  ReasonId?: number | null;
  Reason?: string | null;
  otherReason?: string | null;
  ShippingOption?: string | null;
}

export interface GridParameters {
  page: { pageNumber: number; pageSize: number };
  order: { property: string; ascending: boolean };
  filters: any[];
}

export interface GridModel<T> {
  list: T[];
  count: number;
  parameters: GridParameters;
}