import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listAddress, createAddress, updateAddress, deleteAddress } from '@/features/orders/api/orders.api';
import Breadcrumb from '@/shared/components/Breadcrumb';

// FIX: form fields now match backend schema (addressLine, pinCode, phone — not addressLine1, pincode, mobileNumber)
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
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    enabled: !!userId,
    select: (d: any) => d?.list ?? d ?? [],
  });

  // FIX: createAddress/updateAddress in orders.api.ts now handles field mapping (phone→phone, addressLine→addressLine, etc.)
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
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save address'),
  });

  // FIX: deleteAddress takes number not string
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())        e.name        = 'Name is required';
    if (!form.phone.trim())       e.phone       = 'Phone is required';
    else if (!/^\d{10}$/.test(form.phone)) e.phone = 'Enter valid 10-digit phone';
    if (!form.addressLine.trim()) e.addressLine = 'Address is required';
    if (!form.city.trim())        e.city        = 'City is required';
    if (!form.pinCode.trim())     e.pinCode     = 'Pincode is required';
    else if (!/^\d{6}$/.test(form.pinCode)) e.pinCode = 'Enter valid 6-digit pincode';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getFullAddress = (a: any) =>
    [a.addressLine, a.locality, a.city, a.pinCode].filter(Boolean).join(', ');

  if (isLoading) return (
    <div className="d-flex justify-content-center py-4">
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'My Account', path: '/account/update-profile' }, { label: 'Addresses' }]} /><div className="spinner-border text-secondary" /></div>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">My Addresses</h5>
        {!showForm && (
          <button className="btn btn-sm btn-dark d-flex align-items-center gap-2"
            onClick={() => setShowForm(true)}>
            <i className="bi bi-plus-circle" />Add New Address
          </button>
        )}
      </div>

      {/* ── Address form */}
      {showForm && (
        <div className="card p-4 mb-4 shadow-sm">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">{editItem ? 'Edit Address' : 'Add New Address'}</h6>
            <button className="btn-close" onClick={handleClose} />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: 13 }}>Full Name *</label>
              <input className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {errors.name && <div className="invalid-feedback">{errors.name}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: 13 }}>Mobile Number *</label>
              <input className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                value={form.phone} maxLength={10}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
            </div>
            <div className="col-12">
              <label className="form-label" style={{ fontSize: 13 }}>Address *</label>
              <input className={`form-control ${errors.addressLine ? 'is-invalid' : ''}`}
                placeholder="House/Flat No., Building, Street"
                value={form.addressLine} onChange={e => setForm(f => ({ ...f, addressLine: e.target.value }))} />
              {errors.addressLine && <div className="invalid-feedback">{errors.addressLine}</div>}
            </div>
            <div className="col-12">
              <label className="form-label" style={{ fontSize: 13 }}>Locality / Area</label>
              <input className="form-control" placeholder="Area, Colony, Locality"
                value={form.locality} onChange={e => setForm(f => ({ ...f, locality: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label" style={{ fontSize: 13 }}>Pincode *</label>
              <input className={`form-control ${errors.pinCode ? 'is-invalid' : ''}`}
                value={form.pinCode} maxLength={6}
                onChange={e => setForm(f => ({ ...f, pinCode: e.target.value }))} />
              {errors.pinCode && <div className="invalid-feedback">{errors.pinCode}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label" style={{ fontSize: 13 }}>City *</label>
              <input className={`form-control ${errors.city ? 'is-invalid' : ''}`}
                value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              {errors.city && <div className="invalid-feedback">{errors.city}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label" style={{ fontSize: 13 }}>Address Type</label>
              <select className="form-select" value={form.addressType}
                onChange={e => setForm(f => ({ ...f, addressType: e.target.value }))}>
                <option value="Home">Home</option>
                <option value="Work">Work</option>
              </select>
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="isDefault"
                  checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
                <label className="form-check-label" htmlFor="isDefault" style={{ fontSize: 14 }}>
                  Set as default address
                </label>
              </div>
            </div>
          </div>
          <div className="d-flex gap-3 mt-4">
            <button className="btn btn-dark"
              onClick={() => validate() && saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (editItem ? 'Update Address' : 'Save Address')}
            </button>
            <button className="btn btn-outline-secondary" onClick={handleClose}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Address list */}
      {(addresses as any[]).length === 0 && !showForm ? (
        <div className="text-center py-5">
          <i className="bi bi-geo-alt" style={{ fontSize: 48, color: '#ddd' }} />
          <p className="text-muted mt-3">No addresses saved yet.</p>
          <button className="btn btn-dark btn-sm" onClick={() => setShowForm(true)}>
            Add Your First Address
          </button>
        </div>
      ) : (
        <div>
          {(addresses as any[]).map((addr: any) => (
            <div key={addr.addressId} className="border rounded p-3 mb-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <TypeIcon typeId={addr.typeId} />
                <h6 className="mb-0">{addr.typeId === 2 ? 'Work' : 'Home'}</h6>
                {addr.isDefault && (
                  <span className="badge bg-success ms-1" style={{ fontSize: 11 }}>Default</span>
                )}
              </div>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="d-flex gap-3 mb-1">
                    <span className="fw-semibold">{addr.name}</span>
                    <span className="text-muted">{addr.phone}</span>
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>{getFullAddress(addr)}</p>
                </div>
                <div className="d-flex flex-column gap-2 ms-3" style={{ flexShrink: 0 }}>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEdit(addr)}>
                    <i className="bi bi-pencil me-1" />Edit
                  </button>
                  <button className="btn btn-sm btn-outline-danger"
                    // FIX: pass number not string
                    onClick={() => { if (window.confirm('Delete this address?')) deleteMutation.mutate(addr.addressId); }}
                    disabled={deleteMutation.isPending}>
                    <i className="bi bi-trash me-1" />Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}