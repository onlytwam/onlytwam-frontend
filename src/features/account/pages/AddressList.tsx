// src/features/account/pages/AddressList.tsx — Fixed
// Fixes:
//   1. useQuery enabled only when userId is present
//   2. listAddress returns array directly (normalised in orders.api.ts)
//   3. Proper empty state
//   4. Form fields match backend schema

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listAddress, createAddress, updateAddress, deleteAddress } from '@/features/orders/api/orders.api';

const emptyForm = {
  name: '', phone: '', addressLine: '', locality: '',
  city: '', pinCode: '', addressType: 'Home', isDefault: false,
};

function TypeIcon({ typeId }: { typeId?: number }) {
  return typeId === 2
    ? <i className="bi bi-briefcase me-1" />
    : <i className="bi bi-house-door me-1" />;
}

export default function AddressList() {
  const qc = useQueryClient();
  const { getUserId } = useAuthStore();
  const userId = getUserId();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // Fetch addresses — backend auto-scopes to authenticated user
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', userId],
    queryFn:  () => listAddress({ userProfileId: userId }),
    enabled:  !!userId,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editItem
        ? updateAddress(editItem.addressId, { ...data, userProfileId: userId })
        : createAddress({ ...data, userProfileId: userId }),
    onSuccess: () => {
      toast.success(editItem ? 'Address updated!' : 'Address saved!');
      qc.invalidateQueries({ queryKey: ['addresses', userId] });
      handleClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || 'Failed to save address'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAddress(id),
    onSuccess: () => {
      toast.success('Address deleted');
      qc.invalidateQueries({ queryKey: ['addresses', userId] });
    },
    onError: () => toast.error('Failed to delete address'),
  });

  const handleEdit = (addr: any) => {
    setEditItem(addr);
    setForm({
      name:        addr.name        ?? '',
      phone:       addr.phone       ?? '',
      addressLine: addr.addressLine ?? '',
      locality:    addr.locality    ?? '',
      city:        addr.city        ?? '',
      pinCode:     addr.pinCode     ?? '',
      addressType: addr.typeId === 2 ? 'Work' : 'Home',
      isDefault:   addr.isDefault   ?? false,
    });
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditItem(null);
    setForm({ ...emptyForm });
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim())        e.name        = 'Name is required';
    if (!form.phone.trim())       e.phone       = 'Phone is required';
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = '10-digit number required';
    if (!form.addressLine.trim()) e.addressLine = 'Address is required';
    if (!form.city.trim())        e.city        = 'City is required';
    if (!form.pinCode.trim())     e.pinCode     = 'Pincode is required';
    else if (!/^\d{6}$/.test(form.pinCode.trim())) e.pinCode = '6-digit pincode required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  if (!userId) {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted">Please log in to manage your addresses.</p>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0" style={{ fontFamily: 'Palatino, serif', color: '#6B0F2A' }}>
          Saved Addresses
        </h5>
        <button
          className="btn btn-sm"
          style={{ background: '#6B0F2A', color: '#fff', borderRadius: 8 }}
          onClick={() => { handleClose(); setShowForm(true); }}
        >
          + Add Address
        </button>
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div className="card mb-4 shadow-sm" style={{ borderRadius: 12, border: '1.5px solid #e5c9d0' }}>
          <div className="card-body">
            <h6 className="mb-3" style={{ color: '#6B0F2A' }}>
              {editItem ? 'Edit Address' : 'New Address'}
            </h6>
            <div className="row g-3">
              {[
                { field: 'name',        label: 'Full Name',     type: 'text',  col: 6 },
                { field: 'phone',       label: 'Phone',         type: 'tel',   col: 6 },
                { field: 'addressLine', label: 'Address Line',  type: 'text',  col: 12 },
                { field: 'locality',    label: 'Locality / Area', type: 'text', col: 6 },
                { field: 'city',        label: 'City',          type: 'text',  col: 6 },
                { field: 'pinCode',     label: 'Pincode',       type: 'text',  col: 6 },
              ].map(({ field, label, type, col }) => (
                <div key={field} className={`col-${col}`}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#6B0F2A' }}>
                    {label} {['name','phone','addressLine','city','pinCode'].includes(field) && <span style={{color:'red'}}>*</span>}
                  </label>
                  <input
                    type={type}
                    className={`form-control form-control-sm ${errors[field] ? 'is-invalid' : ''}`}
                    value={(form as any)[field]}
                    onChange={e => set(field, e.target.value)}
                    style={{ borderRadius: 8 }}
                  />
                  {errors[field] && <div className="invalid-feedback">{errors[field]}</div>}
                </div>
              ))}

              <div className="col-6">
                <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#6B0F2A' }}>Type</label>
                <select
                  className="form-select form-select-sm"
                  value={form.addressType}
                  onChange={e => set('addressType', e.target.value)}
                  style={{ borderRadius: 8 }}
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                </select>
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={e => set('isDefault', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="isDefault" style={{ fontSize: 13 }}>
                    Set as default address
                  </label>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                className="btn btn-sm"
                style={{ background: '#6B0F2A', color: '#fff', borderRadius: 8, minWidth: 100 }}
                disabled={saveMutation.isPending}
                onClick={() => { if (validate()) saveMutation.mutate(form); }}
              >
                {saveMutation.isPending ? 'Saving…' : editItem ? 'Update' : 'Save'}
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ borderRadius: 8 }}
                onClick={handleClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Cards */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="spinner-border" style={{ color: '#6B0F2A' }} />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-geo-alt" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
          No saved addresses yet. Add one to get started.
        </div>
      ) : (
        <div className="row g-3">
          {addresses.map((addr: any) => (
            <div key={addr.addressId} className="col-12 col-md-6">
              <div
                className="card h-100"
                style={{
                  borderRadius: 12,
                  border: addr.isDefault ? '2px solid #6B0F2A' : '1px solid #e5e7eb',
                  position: 'relative',
                }}
              >
                {addr.isDefault && (
                  <span
                    style={{
                      position: 'absolute', top: -1, right: 12,
                      background: '#6B0F2A', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 10px', borderRadius: '0 0 8px 8px',
                    }}
                  >
                    DEFAULT
                  </span>
                )}
                <div className="card-body pb-3">
                  <div className="fw-bold mb-1" style={{ color: '#1f2937' }}>
                    <TypeIcon typeId={addr.typeId} />
                    {addr.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {addr.addressLine && <div>{addr.addressLine}</div>}
                    {addr.locality   && <div>{addr.locality}</div>}
                    <div>{[addr.city, addr.pinCode].filter(Boolean).join(' - ')}</div>
                    {addr.phone && <div style={{ marginTop: 4, color: '#6b7280' }}>📞 {addr.phone}</div>}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: 12, borderRadius: 6 }}
                      onClick={() => handleEdit(addr)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      style={{ fontSize: 12, borderRadius: 6 }}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Delete this address?'))
                          deleteMutation.mutate(addr.addressId);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
