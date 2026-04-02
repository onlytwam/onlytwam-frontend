// src/api/orders.api.ts — Fixed
// - listOrders: was passing plain params; backend requires Filters JSON + Page.Index/Page.Size
// - listAddress: same fix
// - listUserCoupons: was /Coupon/UserCoupons → /Coupons/UserList with Filters JSON

import api from '@/shared/api/axiosInstance';
import type { OrderModel } from '@/shared/types';

// Helper: JSON Filters string
const toFilters = (kvs: Record<string, any>, op = 'eq'): string =>
  JSON.stringify(
    Object.entries(kvs)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([property, value]) => ({ property, comparison: op, value }))
  );

// POST /api/Orders
export const createOrder = async (data: OrderModel) => {
  const response = await api.post('/Orders', data);
  return response.data;
};

// GET /api/Orders/{id}
export const getOrderDetail = async (id: number) => {
  const response = await api.get(`/Orders/${id}`);
  return response.data;
};

// GET /api/Orders — requires Filters JSON + Page.Index/Page.Size
export const listOrders = async (params?: {
  userProfileId?: string;
  status?:        string;   // maps to State filter
  pageNumber?:    number;
  pageSize?:      number;
}) => {
  const filters: Array<{ property: string; comparison: string; value: any }> = [];

  if (params?.userProfileId)
    filters.push({ property: 'userProfileId', comparison: 'eq', value: params.userProfileId });
  if (params?.status)
    filters.push({ property: 'State',         comparison: 'eq', value: params.status });

  const response = await api.get('/Orders', {
    params: {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      'Page.Index':      params?.pageNumber ?? 1,
      'Page.Size':       params?.pageSize   ?? 10,
      'Order.Property':  'OrderDate',
      'Order.Ascending': false,
    },
  });
  return response.data;
};

// GET /api/Address — requires Filters JSON
export const listAddress = async (params?: { userProfileId?: string }) => {
  const q: Record<string, any> = {};
  if (params?.userProfileId)
    q.Filters = toFilters({ userProfileId: params.userProfileId });
  const response = await api.get('/Address', { params: q });
  return response.data;
};

// POST /api/Address
export const createAddress = async (data: any) => {
  // Map frontend field names → backend AddressCreate schema
  const payload = {
    name:             data.name,
    phone:            data.phone         ?? data.mobileNumber,
    addressLine:      data.addressLine   ?? data.address,
    locality:         data.locality,
    city:             data.city,
    pinCode:          data.pinCode       ?? data.pincode,
    stateId:          data.stateId       ?? null,
    countryId:        data.countryId     ?? 1,
    typeId:           data.addressType === 'Work' ? 2 : 1,
    isDefault:        data.isDefault     ?? false,
    userProfileId:    data.userProfileId,
    isBillingAddress: data.isBillingAddress ?? false,
  };
  const response = await api.post('/Address', payload);
  return response.data;
};

// PUT /api/Address/{id}
export const updateAddress = async (id: number, data: any) => {
  const payload = {
    name:          data.name,
    phone:         data.phone        ?? data.mobileNumber,
    addressLine:   data.addressLine  ?? data.address,
    locality:      data.locality,
    city:          data.city,
    pinCode:       data.pinCode      ?? data.pincode,
    stateId:       data.stateId      ?? null,
    countryId:     data.countryId    ?? 1,
    typeId:        data.addressType === 'Work' ? 2 : 1,
    isDefault:     data.isDefault    ?? false,
    userProfileId: data.userProfileId,
  };
  const response = await api.put(`/Address/${id}`, payload);
  return response.data;
};

// DELETE /api/Address/{id}
export const deleteAddress = async (id: number) => {
  const response = await api.delete(`/Address/${id}`);
  return response.data;
};

// GET /api/Notification
export const listNotifications = async (params?: { userProfileId?: string }) => {
  const q: Record<string, any> = {};
  if (params?.userProfileId)
    q.Filters = toFilters({ userProfileId: params.userProfileId });
  const response = await api.get('/Notification', { params: q });
  return response.data;
};

// GET /api/Coupons/UserList — FIX: was /Coupon/UserCoupons
export const listUserCoupons = async (params?: { userProfileId?: string }) => {
  const q: Record<string, any> = {};
  if (params?.userProfileId)
    q.Filters = toFilters({ userProfileId: params.userProfileId });
  const response = await api.get('/Coupons/UserList', { params: q });
  return response.data;
};
