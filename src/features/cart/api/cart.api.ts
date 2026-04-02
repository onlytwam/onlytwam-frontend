// src/api/cart.api.ts — Fixed
// - listCart: was passing {userProfileId} as plain param; backend requires Filters JSON
// - listCoupons: was calling /Coupon (singular) → must be /Coupons

import api from '@/shared/api/axiosInstance';

// Helper: build Filters JSON string from a plain key-value object
const filtersFor = (kvs: Record<string, any>, op = 'eq'): string =>
  JSON.stringify(
    Object.entries(kvs)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([property, value]) => ({ property, comparison: op, value }))
  );

// GET /api/Cart — requires Filters JSON
export const listCart = async (params?: { userProfileId?: string }) => {
  const q: Record<string, any> = {};
  if (params?.userProfileId)
    q.Filters = filtersFor({ userProfileId: params.userProfileId });
  const response = await api.get('/Cart', { params: q });
  return response.data;
};

// POST /api/Cart
export const addToCart = async (data: any) => {
  const response = await api.post('/Cart', data);
  return response.data;
};

// PUT /api/Cart/{id}
export const updateCart = async (id: number, data: any) => {
  const response = await api.put(`/Cart/${id}`, data);
  return response.data;
};

// DELETE /api/Cart/{id}
export const deleteCartItem = async (id: number) => {
  const response = await api.delete(`/Cart/${id}`);
  return response.data;
};

// POST /api/Cart/DeleteMutiple  (typo is in the backend)
export const deleteMultipleCartItems = async (ids: number[]) => {
  const response = await api.post('/Cart/DeleteMutiple', ids);
  return response.data;
};

// POST /api/Cart/BulkCart
export const bulkCart = async (data: any) => {
  const response = await api.post('/Cart/BulkCart', data);
  return response.data;
};

// PUT /api/Orders/CheckOutOfStock
export const checkOutOfStock = async (data: any) => {
  const response = await api.put('/Orders/CheckOutOfStock', data);
  return response.data;
};

// GET /api/Coupons  (FIX: was /Coupon singular)
export const listCoupons = async (params?: any) => {
  const response = await api.get('/Coupons/', { params });
  return response.data;
};

// GET /api/DeliveryCharge
export const listDeliveryCharges = async (params?: any) => {
  const response = await api.get('/DeliveryCharge', { params });
  return response.data;
};