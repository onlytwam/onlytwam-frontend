// Fixed: removed unused useQuery import (ts6133 warning)
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { createAddress, updateAddress, listAddress } from '@/features/orders/api/orders.api';
import api from '@/shared/api/axiosInstance';
import Breadcrumb from '@/shared/components/Breadcrumb';

const emptyForm = {
  name: '', phone: '', addressLine: '', locality: '',
  city: '', pinCode: '', stateId: null as number | null,
  addressType: 'Home', isDefault: false,
};

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 8,
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const errSt: React.CSSProperties = { color: '#e53935', fontSize: 12, marginTop: 3 };

export default function AddressForm() {
  const navigate = useNavigate();
  const { id }         = useParams<{ id?: string }>();
  const qc             = useQueryClient();
  const { getUserId }  = useAuthStore();
  const userId         = getUserId();
  const isEdit         = !!id;

  const [form, setForm]     = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [states, setStates] = useState<any[]>([]);

  // Load states from MDM (public endpoint — no auth needed)
  useEffect(() => {
    api.get('/MDM/state', { params: { 'Page.Size': 100 } })
      .then(r => setStates(r.data?.list ?? r.data ?? []))
      .catch(() => { /* states are optional — silently skip */ });
  }, []);

  // If editing, load the existing address
  useEffect(() => {
    if (!isEdit) return;
    listAddress({ userProfileId: userId }).then((d: any) => {
      const addr = (d?.list ?? d ?? []).find((a: any) => String(a.addressId) === id);
      if (addr) {
        setForm({
          name:        addr.name        ?? '',
          phone:       addr.phone       ?? '',
          addressLine: addr.addressLine ?? '',
          locality:    addr.locality    ?? '',
          city:        addr.city        ?? '',
          pinCode:     addr.pinCode     ?? '',
          stateId:     addr.stateId     ?? null,
          addressType: addr.typeId === 2 ? 'Work' : 'Home',
          isDefault:   addr.isDefault   ?? false,
        });
      }
    });
  }, [id, isEdit, userId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateAddress(Number(id), { ...form, userProfileId: userId })
        : createAddress({ ...form, userProfileId: userId }),
    onSuccess: () => {
      toast.success(isEdit ? 'Address updated!' : 'Address added!');
      qc.invalidateQueries({ queryKey: ['addresses'] });
      navigate('/account/address-list');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || 'Failed to save address'),
  });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim())        e.name        = 'Name is required';
    if (!form.phone.trim())       e.phone       = 'Phone is required';
    else if (!/^\d{10}$/.test(form.phone)) e.phone = 'Enter 10-digit number';
    if (!form.addressLine.trim()) e.addressLine = 'Address line is required';
    if (!form.city.trim())        e.city        = 'City is required';
    if (!form.pinCode.trim())     e.pinCode     = 'Pincode is required';
    else if (!/^\d{6}$/.test(form.pinCode)) e.pinCode = '6-digit pincode required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (field: string, val: any) =>
    setForm(f => ({ ...f, [field]: val }));

  return (
    <>
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'My Account', path: '/account/update-profile' },
        { label: 'Addresses', path: '/account/address-list' },
        { label: isEdit ? 'Edit Address' : 'Add New Address' }
      ]} />
      <div>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/account/address-list')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555', padding: 0 }}>
          <i className="bi bi-arrow-left" />
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          {isEdit ? 'Edit Address' : 'Add New Address'}
        </h2>
      </div>

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Full name */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="Full name" />
          {errors.name && <p style={errSt}>{errors.name}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Mobile Number *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} placeholder="10-digit mobile number" maxLength={10} />
          {errors.phone && <p style={errSt}>{errors.phone}</p>}
        </div>

        {/* Address line */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Address Line *</label>
          <input value={form.addressLine} onChange={e => set('addressLine', e.target.value)} style={inp} placeholder="House no., building, street, area" />
          {errors.addressLine && <p style={errSt}>{errors.addressLine}</p>}
        </div>

        {/* Locality */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Locality / Landmark</label>
          <input value={form.locality} onChange={e => set('locality', e.target.value)} style={inp} placeholder="Near landmark or area name" />
        </div>

        {/* City + Pincode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>City *</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} style={inp} placeholder="City" />
            {errors.city && <p style={errSt}>{errors.city}</p>}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Pincode *</label>
            <input value={form.pinCode} onChange={e => set('pinCode', e.target.value)} style={inp} placeholder="6-digit pincode" maxLength={6} />
            {errors.pinCode && <p style={errSt}>{errors.pinCode}</p>}
          </div>
        </div>

        {/* State */}
        {states.length > 0 && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>State</label>
            <select
              value={form.stateId ?? ''}
              onChange={e => set('stateId', e.target.value ? Number(e.target.value) : null)}
              style={{ ...inp, cursor: 'pointer', background: '#fff' }}
            >
              <option value="">Select State</option>
              {states.map((s: any) => (
                <option key={s.stateId} value={s.stateId}>{s.stateName || s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Address type */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Address Type</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Home', 'Work'].map(t => (
              <label key={t} style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14,
                padding: '8px 16px', borderRadius: 8,
                border: `2px solid ${form.addressType === t ? '#6A012A' : '#ddd'}`,
                background: form.addressType === t ? '#fff5f5' : '#fff',
                color: form.addressType === t ? '#6A012A' : '#555',
              }}>
                <input
                  type="radio" name="addressType" value={t}
                  checked={form.addressType === t}
                  onChange={() => set('addressType', t)}
                  style={{ display: 'none' }}
                />
                <i className={`bi ${t === 'Home' ? 'bi-house-door' : 'bi-briefcase'}`} />
                {t}
              </label>
            ))}
          </div>
        </div>

        {/* Default toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => set('isDefault', e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Set as default address
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={() => navigate('/account/address-list')}
            style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={() => { if (validate()) saveMutation.mutate(); }}
            disabled={saveMutation.isPending}
            style={{
              flex: 2, padding: '12px', background: '#6A012A', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              fontWeight: 600, fontFamily: 'inherit',
              opacity: saveMutation.isPending ? 0.7 : 1,
            }}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update Address' : 'Save Address'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}