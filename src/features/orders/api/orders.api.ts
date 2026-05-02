// src/features/orders/api/orders.api.ts
//
// FIXES APPLIED:
//   1. 'Order.Property': 'orderDate' (was 'OrderDate' — wrong PascalCase)
//   2. getPaymentStatus() added — used by Payment.tsx on APK to poll
//      /api/Payment/Status/{orderId} after in-app browser opens PayG.
//   All other code unchanged.

import api from "@/shared/api/axiosInstance";

// Helper: build Filters JSON string
const toFilters = (kvs: Record<string, any>, op = "eq"): string =>
  JSON.stringify(
    Object.entries(kvs)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([property, value]) => ({ property, comparison: op, value })),
  );

// ── Orders ────────────────────────────────────────────────────────────────────

export const createOrder = async (data: any) => {
  const response = await api.post("/Orders", data);
  return response.data;
};

export const getOrderDetail = async (id: number) => {
  const response = await api.get(`/Orders/${id}`);
  return response.data;
};

export const listOrders = async (params?: {
  userProfileId?: string;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}) => {
  const filters: Array<{ property: string; comparison: string; value: any }> =
    [];
  if (params?.userProfileId)
    filters.push({
      property: "userProfileId",
      comparison: "eq",
      value: params.userProfileId,
    });
  if (params?.status)
    filters.push({ property: "state", comparison: "eq", value: params.status });

  const response = await api.get("/Orders", {
    params: {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index": params?.pageNumber ?? 1,
      "Page.Size": params?.pageSize ?? 10,
      // FIX: SQLAlchemy model attribute is camelCase 'orderDate', not PascalCase 'OrderDate'
      "Order.Property": "orderDate",
      "Order.Ascending": false,
    },
  });
  return response.data;
};

export const getOrderTracking = async (orderId: number) => {
  const response = await api.post("/Orders/order-tracking", { orderId });
  return response.data;
};

export const cancelOrder = async (data: {
  orderId: number;
  isRefund: boolean;
  reason: string;
  platform?: string;
}) => {
  const response = await api.post("/Orders/CancelOrder", data);
  return response.data;
};

// Track via Ekart Elite API (live tracking)
export const trackShipment = async (trackingId: string) => {
  const response = await api.get(`/Shipment/TrackShipment/${trackingId}`);
  return response.data;
};

/**
 * Poll payment status for APK in-app browser flow.
 *
 * Calls GET /api/Payment/Status/{orderId}.
 * Returns { orderId, orderNumber, state, paymentMethod, ... }
 * where state is one of: "Pending" | "Confirmed" | "Failed" | "Cancelled"
 *
 * Used only by Payment.tsx on Capacitor native — web uses redirect as before.
 */
export const getPaymentStatus = async (orderId: number) => {
  const response = await api.get(`/Payment/Status/${orderId}`);
  return response.data as {
    orderId: number;
    orderNumber: string | null;
    state: string;
    paymentMethod: string | null;
    paymentTransactionId: string | null;
    paymentResponseCode: number | null;
    paygStatus: string | null;
  };
};

// ── Address ───────────────────────────────────────────────────────────────────

// Normalise address list response — backend returns {list: [], totalCount: N} or []
const normaliseAddressList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data?.list && Array.isArray(data.list)) return data.list;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
};

export const listAddress = async (params?: { userProfileId?: string }) => {
  // NOTE: Backend auto-filters by authenticated user's userProfileId for non-staff.
  // We still send it so the query key is unique per user.
  const q: Record<string, any> = {
    "Page.Size": 50,
    "Order.Property": "CreatedDate",
    "Order.Ascending": false,
  };
  if (params?.userProfileId) {
    q.Filters = toFilters({ userProfileId: params.userProfileId });
  }
  const response = await api.get("/Address", { params: q });
  // Return the list array directly
  return normaliseAddressList(response.data);
};

export const getAddressById = async (id: number) => {
  const response = await api.get(`/Address/${id}`);
  return response.data;
};

export const createAddress = async (data: any) => {
  const payload = buildAddressPayload(data);
  const response = await api.post("/Address", payload);
  return response.data;
};

export const updateAddress = async (id: number, data: any) => {
  const payload = { ...buildAddressPayload(data), addressId: id };
  const response = await api.put(`/Address/${id}`, payload);
  return response.data;
};

export const deleteAddress = async (id: number) => {
  const response = await api.delete(`/Address/${id}`);
  return response.data;
};

// Build address payload — matches backend AddressCreate/AddressUpdate schema
function buildAddressPayload(data: any) {
  return {
    name: data.name,
    phone: data.phone ?? data.mobileNumber ?? "",
    addressLine: buildAddressLine(data),
    locality: data.locality ?? "",
    city: data.city ?? "",
    state: data.state ?? data.stateName ?? "",
    pinCode: data.pinCode ?? data.pincode ?? "",
    stateId: data.stateId ?? null,
    countryId: data.countryId ?? 1,
    typeId: data.addressType === "Work" ? 2 : 1,
    isDefault: data.isDefault ?? false,
    isBillingAddress: data.isBillingAddress ?? false,
    userProfileId: data.userProfileId ?? "",
    personalId: 0,
  };
}

const splitAddressParts = (value: unknown): string[] =>
  String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const normalizeAddressLine = (value: unknown): string => {
  const parts = splitAddressParts(value);
  if (parts.length === 0) return "";

  const compacted: string[] = [];
  for (const part of parts) {
    const prev = compacted[compacted.length - 1];
    if (prev && prev.toLowerCase() === part.toLowerCase()) continue;
    compacted.push(part);
  }

  return compacted.join(", ");
};

function buildAddressLine(data: any): string {
  const rawLine = normalizeAddressLine(data.addressLine || data.address || "");
  const locality = String(data.locality ?? "").trim();
  const houseNo = String(data.houseNo ?? "").trim();
  const parts = splitAddressParts(rawLine);
  const lineParts =
    locality && parts.length > 1
      ? parts[parts.length - 1].toLowerCase() === locality.toLowerCase()
        ? parts.slice(0, -1)
        : parts
      : parts;
  const cleanedLine = normalizeAddressLine(lineParts.join(", "));

  if (!houseNo) {
    return cleanedLine;
  }

  const cleanedParts = splitAddressParts(cleanedLine);
  if (cleanedParts[0]?.toLowerCase() === houseNo.toLowerCase()) {
    return cleanedLine;
  }

  return normalizeAddressLine(
    [houseNo, cleanedLine].filter(Boolean).join(", "),
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const listNotifications = async (params?: {
  userProfileId?: string;
}) => {
  const q: Record<string, any> = {};
  if (params?.userProfileId)
    q.Filters = toFilters({ userProfileId: params.userProfileId });
  const response = await api.get("/Notification", { params: q });
  return response.data;
};

// ── Coupons ───────────────────────────────────────────────────────────────────

export const listUserCoupons = async (params?: { userProfileId?: string }) => {
  const q: Record<string, any> = {
    "Page.Size": 100,
    "Order.Property": "endDate",
    "Order.Ascending": true,
  };
  if (params?.userProfileId)
    q.Filters = toFilters({ UserProfileId: params.userProfileId });
  const response = await api.get("/Coupons/UserList", { params: q });
  return response.data;
};
// ── Admin: Ekart Config ───────────────────────────────────────────────────────

export const getEkartConfig = async () => {
  const response = await api.get("/Ekart/Config");
  return response.data;
};

export const updateEkartConfig = async (
  configId: number,
  data: Record<string, any>,
) => {
  const response = await api.put(`/Ekart/Config/${configId}`, data);
  return response.data;
};

export const getEkartReadiness = async () => {
  const response = await api.get("/Ekart/Readiness");
  return response.data;
};

export const createEkartShipment = async (payload: {
  order_id: number;
  manual_tracking_id?: string;
}) => {
  const response = await api.post("/Ekart/CreateShipment", payload);
  return response.data;
};

export const updateOrderStatusAdmin = async (payload: {
  order_id: number;
  status: string;
  tracking_id?: string;
  remarks?: string;
}) => {
  const response = await api.post("/Ekart/UpdateStatus", payload);
  return response.data;
};

// ── Coupon Utilities ──────────────────────────────────────────────────────────

/**
 * Validate a physical (store-issued) coupon code.
 * Returns { valid, discount, description, message } or throws on already-used.
 */
export const validatePhysicalCoupon = async (params: {
  couponCode: string;
  userProfileId?: string;
}) => {
  const response = await api.post("/Coupons/Physical/Validate", params);
  return response.data as {
    valid: boolean;
    couponCode: string;
    discount: number | null;
    description: string | null;
    message: string;
  };
};

/**
 * Mark a digital coupon as used after a successful order.
 * Call this immediately after createOrder succeeds.
 */
export const markDigitalCouponUsed = async (params: {
  couponId: number;
  userProfileId: string;
  orderId?: number;
}) => {
  const response = await api.post("/Coupons/MarkUsed", params);
  return response.data;
};

/**
 * Mark a physical coupon as used after a successful order.
 * Call this immediately after createOrder succeeds.
 */
export const markPhysicalCouponUsed = async (params: {
  couponCode: string;
  userProfileId: string;
  orderId?: number;
}) => {
  const response = await api.post("/Coupons/Physical/MarkUsed", params);
  return response.data;
};
