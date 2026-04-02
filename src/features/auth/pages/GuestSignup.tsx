/**
 * GuestSignup.tsx — Fixed to match onlytwam.com reference
 *
 * Reference shows:
 * - Left: "Guest User Info" form with all address fields
 * - Right: Order Summary sidebar with totals + "Place Order" button
 * - WhatsApp notification popup appears after form submit
 * - Uses POST /api/Orders/GuestOrder (public endpoint, no auth needed)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';

const TAX_RATE = 0.05;

const GuestCart = {
  get: (): any[] => { try { return JSON.parse(localStorage.getItem('guestCart') || '[]'); } catch { return []; } },
  clear: () => { localStorage.removeItem('guestCart'); window.dispatchEvent(new Event('guestCartUpdated')); },
};

export default function GuestSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '',
    email: '', phoneNumber: '',
    addressLine: '', locality: '', city: '',
    pinCode: '', stateId: '', countryId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [isWhatsapp,   setIsWhatsapp]   = useState(false);

  // Load cart items
  const guestItems = GuestCart.get();
  const subTotal   = guestItems.reduce((s: number, i: any) => s + ((i.finalPrice || 0) * (i.processedQuantity || i.quantity || 1)), 0);
  const taxAmount  = Math.round(subTotal * TAX_RATE);
  const delivery   = 99;
  const total      = subTotal + taxAmount + delivery;

  // Countries and States
  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await api.get('/Country', { params: { 'Page.Size': 300, 'Order.Property': 'CountryName', 'Order.Ascending': true } });
      return res.data?.list ?? [];
    },
  });

  const { data: states = [] } = useQuery({
    queryKey: ['states', form.countryId],
    queryFn: async () => {
      if (!form.countryId) return [];
      const res = await api.get('/State', {
        params: {
          Filters: JSON.stringify([{ property: 'countryId', comparison: 'eq', value: Number(form.countryId) }]),
          'Page.Size': 100,
          'Order.Property': 'StateName',
          'Order.Ascending': true,
        },
      });
      return res.data?.list ?? [];
    },
    enabled: !!form.countryId,
  });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim())  e.lastName  = 'Last name is required';
    if (!form.email.trim())     e.email     = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone is required';
    else if (!/^\d{10}$/.test(form.phoneNumber)) e.phoneNumber = '10-digit number required';
    if (!form.addressLine.trim()) e.addressLine = 'Address is required';
    if (!form.countryId) e.countryId = 'Country is required';
    if (!form.stateId)   e.stateId   = 'State is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.pinCode.trim()) e.pinCode = 'Pincode is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (whatsapp: boolean) => {
      const payload = {
        firstName:   form.firstName,
        middleName:  form.middleName || '',
        lastName:    form.lastName,
        email:       form.email,
        phoneNumber: form.phoneNumber,
        addressLine: form.addressLine,
        locality:    form.locality,
        city:        form.city,
        stateId:     Number(form.stateId) || undefined,
        countryId:   Number(form.countryId) || undefined,
        pinCode:     form.pinCode,
        subTotal,
        taxAmount,
        deliveryCharge: delivery,
        totalAmount:    total,
        isWhatsappNotification: whatsapp,
        orderItems: guestItems.map((i: any) => ({
          productId:              i.productId,
          productVariantId:       i.productVariantId,
          productVariantDetailId: i.productVariantDetailId,
          quantity:               i.processedQuantity || i.quantity || 1,
          price:                  i.finalPrice,
        })),
      };
      const res = await api.post('/Orders/GuestOrder', payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      GuestCart.clear();
      toast.success('Order placed successfully! 🎉');
      navigate(`/user-products/order-confirm/${data?.orderId ?? 'new'}`);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || 'Failed to place order');
    },
  });

  const handleSubmit = () => {
    if (!validate()) {
      toast.error('Please correct the errors before submitting.');
      return;
    }
    // Show WhatsApp popup like reference
    setShowWhatsapp(true);
  };

  const confirmOrder = (whatsapp: boolean) => {
    setIsWhatsapp(whatsapp);
    setShowWhatsapp(false);
    placeOrderMutation.mutate(whatsapp);
  };

  const inp = (key: string): React.CSSProperties => ({
    width: '100%', padding: '12px 14px', border: `1px solid ${errors[key] ? '#e53935' : '#e0d0d0'}`,
    borderRadius: 4, fontSize: 14, outline: 'none', fontFamily: 'inherit',
    background: '#faf5f5', boxSizing: 'border-box',
  });
  const lbl: React.CSSProperties = { fontSize: 13, color: '#888', display: 'block', marginBottom: 0 };
  const errEl = (key: string) => errors[key]
    ? <span style={{ color: '#e53935', fontSize: 11, display: 'block', marginTop: 3 }}>{errors[key]}</span>
    : null;

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 1100 }}>
      <div className="row g-4">

        {/* ── Left: Guest User Info form */}
        <div className="col-lg-8">
          <h5 style={{ fontWeight: 600, marginBottom: 24, fontSize: 18 }}>Guest User Info</h5>

          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 28 }}>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { key: 'firstName',  ph: 'First Name*' },
                { key: 'middleName', ph: 'Middle Name' },
                { key: 'lastName',   ph: 'Last Name*' },
              ].map(({ key, ph }) => (
                <div key={key}>
                  <input placeholder={ph} style={inp(key)}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  {errEl(key)}
                </div>
              ))}
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <input placeholder="Email*" type="email" style={inp('email')}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              {errEl('email')}
            </div>

            {/* Address */}
            <div style={{ marginBottom: 16 }}>
              <textarea placeholder="Address (House No, Building, Street, Area)*"
                style={{ ...inp('addressLine'), height: 80, resize: 'vertical' }}
                value={form.addressLine}
                onChange={e => setForm(f => ({ ...f, addressLine: e.target.value }))} />
              {errEl('addressLine')}
            </div>

            {/* Country / State / Locality */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <select style={inp('countryId')}
                  value={form.countryId}
                  onChange={e => setForm(f => ({ ...f, countryId: e.target.value, stateId: '' }))}>
                  <option value="">Country*</option>
                  {(countries as any[]).map((c: any) => (
                    <option key={c.countryId} value={c.countryId}>{c.countryName}</option>
                  ))}
                </select>
                {errEl('countryId')}
              </div>
              <div>
                <select style={inp('stateId')}
                  value={form.stateId}
                  onChange={e => setForm(f => ({ ...f, stateId: e.target.value }))}>
                  <option value="">State*</option>
                  {(states as any[]).map((s: any) => (
                    <option key={s.stateId} value={s.stateId}>{s.stateName}</option>
                  ))}
                </select>
                {errEl('stateId')}
              </div>
              <div>
                <input placeholder="Locality / Town*" style={inp('locality')}
                  value={form.locality}
                  onChange={e => setForm(f => ({ ...f, locality: e.target.value }))} />
              </div>
            </div>

            {/* City / Pincode / Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <input placeholder="City*" style={inp('city')}
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                {errEl('city')}
              </div>
              <div>
                <input placeholder="Pincode*" style={inp('pinCode')}
                  value={form.pinCode}
                  onChange={e => setForm(f => ({ ...f, pinCode: e.target.value }))} />
                {errEl('pinCode')}
              </div>
              <div>
                <input placeholder="Phone Number*" type="tel" style={inp('phoneNumber')} maxLength={10}
                  value={form.phoneNumber}
                  onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                {errEl('phoneNumber')}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Order Summary */}
        <div className="col-lg-4">
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 24, position: 'sticky', top: 80 }}>
            <h6 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>Order Summary</h6>

            {[
              { label: `Price (${guestItems.length} items)`, value: `₹${subTotal.toLocaleString('en-IN')}` },
              { label: 'Discount',       value: '₹0', red: false },
              { label: 'Delivery Charges', value: `₹${delivery}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: '#888' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}

            <hr style={{ margin: '12px 0 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, marginBottom: 20 }}>
              <span>Total Amount</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>

            <button onClick={handleSubmit} disabled={placeOrderMutation.isPending}
              style={{ width: '100%', background: '#6A012A', color: '#fff', border: 'none', padding: '14px', borderRadius: 4, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', opacity: placeOrderMutation.isPending ? .7 : 1, marginBottom: 12 }}>
              {placeOrderMutation.isPending ? 'Placing Order…' : 'Place Order'}
            </button>

            <button onClick={() => navigate(-1)}
              style={{ width: '100%', background: 'none', color: '#555', border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── WhatsApp popup — matches reference */}
      {showWhatsapp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h5 style={{ marginBottom: 12, fontWeight: 600 }}>
              Would you like to receive order updates on WhatsApp?
            </h5>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
              We'll send you notifications about your order status, shipping updates, and delivery details directly to your WhatsApp
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => confirmOrder(false)}
                style={{ flex: 1, background: '#fff', color: '#333', border: '1px solid #ddd', padding: '12px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 500 }}>
                No Thanks
              </button>
              <button onClick={() => confirmOrder(true)}
                style={{ flex: 1, background: '#25D366', color: '#fff', border: 'none', padding: '12px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>
                <i className="bi bi-whatsapp me-2" />Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}