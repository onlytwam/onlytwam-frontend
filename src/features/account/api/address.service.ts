// This file uses the correct axiosInstance (replaces old version that used mock useAuthStore)
import api from '@/shared/api/axiosInstance';

export const AddressService = {
  getAddress: (params: any) => api.get('/Address', { params }).then(r => r.data),
  createAddress: (data: any) => api.post('/Address', data).then(r => r.data),
  getById: (id: number) => api.get(`/Address/${id}`).then(r => r.data),
  update: (id: number, data: any) => api.put(`/Address/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/Address/${id}`).then(r => r.data),
  getCountries: () => api.get('/MDM/country').then(r => r.data),
  getStates: () => api.get('/MDM/state').then(r => r.data),
};