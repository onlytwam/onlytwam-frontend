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
      <div className="s-addressform-bafc04">
        <button onClick={() => navigate('/account/address-list')}
          className="s-addressform-be2487">
          <i className="bi bi-arrow-left" />
        </button>
        <h2 className="s-addressform-638cea">
          {isEdit ? 'Edit Address' : 'Add New Address'}
        </h2>
      </div>

      <div className="s-addressform-b04dc9">

        {/* Full name */}
        <div>
          <label className="s-addressform-f1fb64">Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="inp-field" placeholder="Full name" />
          {errors.name && <p className="auth-err-text">{errors.name}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label className="s-addressform-f1fb64">Mobile Number *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="inp-field" placeholder="10-digit mobile number" maxLength={10} />
          {errors.phone && <p className="auth-err-text">{errors.phone}</p>}
        </div>

        {/* Address line */}
        <div>
          <label className="s-addressform-f1fb64">Address Line *</label>
          <input value={form.addressLine} onChange={e => set('addressLine', e.target.value)} className="inp-field" placeholder="House no., building, street, area" />
          {errors.addressLine && <p className="auth-err-text">{errors.addressLine}</p>}
        </div>

        {/* Locality */}
        <div>
          <label className="s-addressform-f1fb64">Locality / Landmark</label>
          <input value={form.locality} onChange={e => set('locality', e.target.value)} className="inp-field" placeholder="Near landmark or area name" />
        </div>

        {/* City + Pincode */}
        <div className="s-addressform-cdfbe9">
          <div>
            <label className="s-addressform-f1fb64">City *</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} className="inp-field" placeholder="City" />
            {errors.city && <p className="auth-err-text">{errors.city}</p>}
          </div>
          <div>
            <label className="s-addressform-f1fb64">Pincode *</label>
            <input value={form.pinCode} onChange={e => set('pinCode', e.target.value)} className="inp-field" placeholder="6-digit pincode" maxLength={6} />
            {errors.pinCode && <p className="auth-err-text">{errors.pinCode}</p>}
          </div>
        </div>

        {/* State */}
        {states.length > 0 && (
          <div>
            <label className="s-addressform-f1fb64">State</label>
            <select
              value={form.stateId ?? ''}
              onChange={e => set('stateId', e.target.value ? Number(e.target.value) : null)}
              className="inp-field s-addressform-ebd15a"
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
          <label className="s-addressform-dd104a">Address Type</label>
          <div className="s-addressform-be0342">
            {['Home', 'Work'].map(t => (
              <label key={t} className="s-addressform-e997cd" style={ {border: `2px solid ${form.addressType === t ? 'var(--brand)' : 'var(--ivory)'}`, background: form.addressType === t ? 'var(--ivory)' : '#fff', color: form.addressType === t ? 'var(--brand)' : 'var(--heirloom)'} }>
                <input
                  type="radio" name="addressType" value={t}
                  checked={form.addressType === t}
                  onChange={() => set('addressType', t)}
                  className="s-addressform-8251cb"
                />
                <i className={`bi ${t === 'Home' ? 'bi-house-door' : 'bi-briefcase'}`} />
                {t}
              </label>
            ))}
          </div>
        </div>

        {/* Default toggle */}
        <label className="s-addressform-b28077">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => set('isDefault', e.target.checked)}
            className="s-addressform-040894"
          />
          Set as default address
        </label>

        {/* Actions */}
        <div className="s-addressform-4a7f76">
          <button
            onClick={() => navigate('/account/address-list')}
            className="s-addressform-3fedb2">
            Cancel
          </button>
          <button
            onClick={() => { if (validate()) saveMutation.mutate(); }}
            disabled={saveMutation.isPending}
            className="s-addressform-54d247" style={ {opacity: saveMutation.isPending ? 0.7 : 1} }>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update Address' : 'Save Address'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}