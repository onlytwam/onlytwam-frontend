/**
 * PaymentAddress.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Checkout step 1 — Delivery Address
 *
 * Features:
 *  • Pincode verification via India Post API (real-time city / state / country)
 *  • Geolocation auto-fill (country, state, city, locality via Nominatim)
 *  • 10-digit phone validation with +91 prefix
 *  • Guest: email → OTP verify → address form
 *  • Auth: saved-address list + add / edit
 *  • Matches brand palette: Burgundy #6B0F2A · Heirloom #9E6070 · Ivory #F5F0E6
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { useBreadcrumb } from '@/shared/hooks/useBreadcrumb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listAddress, createAddress, updateAddress } from '@/features/orders/api/orders.api';
import api from '@/shared/api/axiosInstance';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const PRI      = '#6B0F2A';
const HEIRLOOM = '#9E6070';
const IVORY    = '#F5F0E6';
const IVORY_DK = '#ede4d8';
const FONTS    = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI  = '"Trebuchet MS", Arial, sans-serif';

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = {
  name:        '',
  phone:       '',
  houseNo:     '',       // house / flat / building — user fills
  addressLine: '',       // street / colony / road  — geo auto-fill
  locality:    '',       // area / neighbourhood    — geo auto-fill
  city:        '',       // pincode / geo auto-fill
  state:       '',       // pincode / geo auto-fill
  country:     'India',  // geo auto-fill
  pinCode:     '',
  addressType: 'Home',
  isDefault:   false,
};
type FormState = typeof emptyForm;

// ── Pincode lookup — India Post API ──────────────────────────────────────────
interface PinData { city: string; state: string; country: string }

async function lookupPincode(pin: string): Promise<PinData | null> {
  try {
    const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (!Array.isArray(data) || data[0]?.Status !== 'Success') return null;
    const po = data[0]?.PostOffice?.[0];
    if (!po) return null;
    return {
      city:    po.Block || po.Taluk || po.District || '',
      state:   po.State || '',
      country: po.Country || 'India',
    };
  } catch { return null; }
}

// ── Reverse geocode — Nominatim (OpenStreetMap) ──────────────────────────────
interface GeoData {
  road: string; suburb: string; city: string;
  state: string; country: string; postcode: string;
}

async function reverseGeocode(lat: number, lon: number): Promise<GeoData | null> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a    = data?.address ?? {};
    return {
      road:     a.road || a.pedestrian || a.footway || '',
      suburb:   a.suburb || a.neighbourhood || a.village || a.town || '',
      city:     a.city || a.town || a.village || a.county || '',
      state:    a.state || '',
      country:  a.country || 'India',
      postcode: a.postcode || '',
    };
  } catch { return null; }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inpStyle = (err?: boolean, disabled?: boolean): React.CSSProperties => ({
  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
  border: `1.5px solid ${err ? '#e53935' : '#ddd'}`, borderRadius: 8,
  fontSize: 14, fontFamily: FONT_UI, outline: 'none',
  background: disabled ? '#f9f9f9' : '#fff', color: disabled ? '#888' : '#111',
  transition: 'border-color .2s',
});

const labelSt: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, display: 'block',
  marginBottom: 5, color: '#444', fontFamily: FONT_UI,
};

const errSt: React.CSSProperties = {
  color: '#e53935', fontSize: 11.5, marginTop: 4,
  display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0 0',
};

// ── Checkout breadcrumb steps ─────────────────────────────────────────────────
function CheckoutSteps({ active }: { active: 'address' | 'shipping' | 'payment' }) {
  const steps = ['Address', 'Shipping', 'Payment'];
  const idx   = steps.findIndex(s => s.toLowerCase() === active);
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, fontFamily: FONT_UI }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%',
            background: i <= idx ? PRI : '#e8e0d8',
            color: i <= idx ? '#fff' : '#aaa',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s',
          }}>
            {i < idx ? '✓' : i + 1}
          </span>
          <span style={{
            marginLeft: 7, fontSize: 13,
            fontWeight: i === idx ? 700 : 400,
            color: i < idx ? HEIRLOOM : i === idx ? PRI : '#bbb',
            marginRight: i < steps.length - 1 ? 8 : 0,
          }}>{s}</span>
          {i < steps.length - 1 && (
            <span style={{ width: 28, height: 1, background: i < idx ? HEIRLOOM : '#e0d6cc', margin: '0 10px 0 10px' }} />
          )}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Address Form Panel
// ─────────────────────────────────────────────────────────────────────────────
interface FormPanelProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  onCancel?: () => void;
  showDefault?: boolean;
}

function AddressFormPanel({
  form, setForm, errors, setErrors,
  onSubmit, submitLabel, submitting, onCancel, showDefault,
}: FormPanelProps) {
  const [pinStatus, setPinStatus]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [geoLoading, setGeoLoading] = useState(false);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upd = (key: keyof FormState) => (val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  const clearErr = (...keys: string[]) =>
    setErrors(e => { const n = { ...e }; keys.forEach(k => delete n[k]); return n; });

  // ── Pincode live lookup (debounced 600 ms) ─────────────────────────────
  useEffect(() => {
    if (pinTimer.current) clearTimeout(pinTimer.current);
    const pin = form.pinCode.trim();
    if (pin.length < 6) { if (pin.length > 0) setPinStatus('idle'); return; }
    if (!/^\d{6}$/.test(pin)) { setPinStatus('error'); return; }

    setPinStatus('loading');
    pinTimer.current = setTimeout(async () => {
      const data = await lookupPincode(pin);
      if (!data) {
        setPinStatus('error');
        setErrors(e => ({ ...e, pinCode: 'Please enter a valid pincode' }));
      } else {
        setPinStatus('ok');
        clearErr('pinCode');
        // Auto-fill only if field is still blank
        setForm(f => ({
          ...f,
          city:    f.city    || data.city,
          state:   f.state   || data.state,
          country: f.country || data.country,
        }));
      }
    }, 600);
    return () => { if (pinTimer.current) clearTimeout(pinTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pinCode]);

  // ── Geolocation auto-fill ───────────────────────────────────────────────
  const handleGeoFill = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser'); return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (!geo) {
          toast.error('Could not fetch location details. Please fill manually.');
          setGeoLoading(false); return;
        }
        setForm(f => ({
          ...f,
          addressLine: f.addressLine || geo.road,
          locality:    f.locality    || geo.suburb,
          city:        f.city        || geo.city,
          state:       f.state       || geo.state,
          country:     f.country     || geo.country || 'India',
          pinCode:     f.pinCode     || geo.postcode,
        }));
        toast.success('Location auto-filled! Please verify and add your house / flat number.');
        setGeoLoading(false);
      },
      err => {
        setGeoLoading(false);
        if (err.code === 1)
          toast.error('Location access denied. Enable location or fill address manually.');
        else
          toast.error('Could not detect location. Please fill manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const pinBorder = pinStatus === 'ok' ? '#2e7d32' : pinStatus === 'error' ? '#e53935' : '#ddd';

  return (
    <div>
      {/* ── Geo-fill row ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 20,
        padding: '10px 14px', background: `${PRI}06`,
        border: `1px solid ${PRI}20`, borderRadius: 8,
      }}>
        <span style={{ fontSize: 12.5, color: '#555', fontFamily: FONT_UI }}>
          <i className="bi bi-geo-alt" style={{ color: HEIRLOOM, marginRight: 6 }} />
          Auto-fill your city, state &amp; area from your current location
        </span>
        <button
          type="button" onClick={handleGeoFill} disabled={geoLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 20,
            background: geoLoading ? IVORY : PRI,
            border: `1.5px solid ${PRI}`,
            color: geoLoading ? PRI : '#fff',
            fontSize: 12.5, fontWeight: 600, fontFamily: FONT_UI,
            cursor: geoLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          }}>
          {geoLoading
            ? <><span style={{ width: 11, height: 11, border: '2px solid #ddd', borderTopColor: PRI, borderRadius: '50%', display: 'inline-block', animation: 'pa-spin .8s linear infinite' }} /> Detecting…</>
            : <><i className="bi bi-geo-alt-fill" style={{ fontSize: 12 }} /> Use My Location</>
          }
        </button>
      </div>

      {/* ── Field grid ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

        {/* Full Name */}
        <div>
          <label style={labelSt}>Full Name <span style={{ color: '#e53935' }}>*</span></label>
          <input
            value={form.name}
            onChange={e => { upd('name')(e.target.value); clearErr('name'); }}
            placeholder="As on ID"
            style={inpStyle(!!errors.name)}
          />
          {errors.name && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label style={labelSt}>Mobile Number <span style={{ color: '#e53935' }}>*</span></label>
          <div style={{ display: 'flex' }}>
            <span style={{
              padding: '11px 12px',
              background: IVORY, border: `1.5px solid ${errors.phone ? '#e53935' : '#ddd'}`,
              borderRight: 'none', borderRadius: '8px 0 0 8px',
              fontSize: 13, color: '#666', fontFamily: FONT_UI, whiteSpace: 'nowrap',
            }}>+91</span>
            <input
              value={form.phone}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                upd('phone')(v); clearErr('phone');
              }}
              placeholder="10-digit number"
              inputMode="numeric"
              maxLength={10}
              style={{ ...inpStyle(!!errors.phone), borderRadius: '0 8px 8px 0', flex: 1 }}
            />
          </div>
          {errors.phone && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.phone}</p>}
        </div>

        {/* Pincode — col 1 */}
        <div>
          <label style={labelSt}>
            Pincode <span style={{ color: '#e53935' }}>*</span>
            {pinStatus === 'loading' && (
              <span style={{ marginLeft: 8, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>
                <span style={{ display: 'inline-block', width: 9, height: 9, border: '2px solid #ddd', borderTopColor: PRI, borderRadius: '50%', animation: 'pa-spin .8s linear infinite', marginRight: 4 }} />
                Verifying…
              </span>
            )}
            {pinStatus === 'ok' && (
              <span style={{ marginLeft: 8, fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>
                <i className="bi bi-check-circle-fill" /> Valid
              </span>
            )}
          </label>
          <input
            value={form.pinCode}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              upd('pinCode')(v);
              if (v.length < 6) setPinStatus('idle');
              clearErr('pinCode');
            }}
            placeholder="6-digit pincode"
            inputMode="numeric"
            maxLength={6}
            style={{ ...inpStyle(!!errors.pinCode), borderColor: pinBorder }}
          />
          {errors.pinCode && pinStatus === 'error' && (
            <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.pinCode}</p>
          )}
        </div>

        {/* House / Flat — col 2 */}
        <div>
          <label style={labelSt}>House / Flat / Building <span style={{ color: '#e53935' }}>*</span></label>
          <input
            value={form.houseNo}
            onChange={e => { upd('houseNo')(e.target.value); clearErr('houseNo'); }}
            placeholder="Flat no., floor, building name"
            style={inpStyle(!!errors.houseNo)}
          />
          {errors.houseNo && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.houseNo}</p>}
        </div>

        {/* Street / Colony / Road — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>
            Street / Colony / Road <span style={{ color: '#e53935' }}>*</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>(auto-fills from location)</span>
          </label>
          <input
            value={form.addressLine}
            onChange={e => { upd('addressLine')(e.target.value); clearErr('addressLine'); }}
            placeholder="Street name, road, colony"
            style={inpStyle(!!errors.addressLine)}
          />
          {errors.addressLine && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.addressLine}</p>}
        </div>

        {/* Locality — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>
            Area / Locality
            <span style={{ marginLeft: 8, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>(auto-fills from location)</span>
          </label>
          <input
            value={form.locality}
            onChange={e => upd('locality')(e.target.value)}
            placeholder="Neighbourhood, area, village"
            style={inpStyle()}
          />
        </div>

        {/* City */}
        <div>
          <label style={labelSt}>
            City <span style={{ color: '#e53935' }}>*</span>
            <span style={{ marginLeft: 6, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>(auto-fills)</span>
          </label>
          <input
            value={form.city}
            onChange={e => { upd('city')(e.target.value); clearErr('city'); }}
            placeholder="City"
            style={inpStyle(!!errors.city)}
          />
          {errors.city && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.city}</p>}
        </div>

        {/* State */}
        <div>
          <label style={labelSt}>
            State <span style={{ color: '#e53935' }}>*</span>
            <span style={{ marginLeft: 6, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>(auto-fills)</span>
          </label>
          <input
            value={form.state}
            onChange={e => { upd('state')(e.target.value); clearErr('state'); }}
            placeholder="State"
            style={inpStyle(!!errors.state)}
          />
          {errors.state && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.state}</p>}
        </div>

        {/* Country */}
        <div>
          <label style={labelSt}>
            Country
            <span style={{ marginLeft: 6, fontSize: 11, color: HEIRLOOM, fontWeight: 400 }}>(auto-fills)</span>
          </label>
          <input
            value={form.country}
            onChange={e => upd('country')(e.target.value)}
            placeholder="Country"
            style={inpStyle()}
          />
        </div>

        {/* Address Type */}
        <div>
          <label style={labelSt}>Address Type</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['Home', 'Work'] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => upd('addressType')(t)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: `1.5px solid ${form.addressType === t ? PRI : '#ddd'}`,
                  background: form.addressType === t ? `${PRI}10` : '#fff',
                  color: form.addressType === t ? PRI : '#777',
                  fontSize: 13, fontWeight: form.addressType === t ? 700 : 400,
                  cursor: 'pointer', fontFamily: FONT_UI, transition: 'all .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <i className={`bi bi-${t === 'Home' ? 'house' : 'briefcase'}`} style={{ fontSize: 13 }} />{t}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Set as default */}
      {showDefault && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
          cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: FONT_UI,
        }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => upd('isDefault')(e.target.checked)}
            style={{ accentColor: PRI, width: 15, height: 15 }}
          />
          Set as default address
        </label>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          type="button" onClick={onSubmit}
          disabled={submitting || pinStatus === 'loading'}
          style={{
            flex: 1, padding: '12px', background: PRI, color: '#fff',
            border: 'none', borderRadius: 8,
            cursor: submitting || pinStatus === 'loading' ? 'wait' : 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: FONT_UI,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: submitting ? 0.85 : 1, transition: 'opacity .2s',
          }}>
          {submitting
            ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'pa-spin .8s linear infinite' }} /> Saving…</>
            : <>{submitLabel} <i className="bi bi-arrow-right" /></>
          }
        </button>
        {onCancel && (
          <button
            type="button" onClick={onCancel}
            style={{
              padding: '12px 22px', background: '#fff', color: '#666',
              border: '1.5px solid #e0d6cc', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, fontFamily: FONT_UI,
            }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentAddress() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const isBuyNow       = searchParams.get('buyNow') === '1';
  const breadcrumbs    = useBreadcrumb({ staticItems: [{ label: 'Checkout' }, { label: 'Address' }] });
  const qc             = useQueryClient();
  const { getUserId, hasValidToken } = useAuthStore();
  const userId = getUserId();
  const isAuth = hasValidToken();

  // Auth
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [form,       setForm]       = useState<FormState>({ ...emptyForm });
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  // Guest
  const [guestEmail,       setGuestEmail]       = useState('');
  const [otpSent,          setOtpSent]          = useState(false);
  const [otpValue,         setOtpValue]         = useState('');
  const [otpVerified,      setOtpVerified]      = useState(false);
  const [otpLoading,       setOtpLoading]       = useState(false);
  const [otpError,         setOtpError]         = useState('');
  const [showSignInBanner, setShowSignInBanner] = useState(true);
  const [emailRegistered,  setEmailRegistered]  = useState(false);
  const [resendTimer,      setResendTimer]      = useState(0);

  // Guest address form state
  const [guestForm,   setGuestForm]   = useState<FormState>({ ...emptyForm });
  const [guestErrors, setGuestErrors] = useState<Record<string, string>>({});

  // Fetch saved addresses
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', userId],
    queryFn:  () => listAddress({ userProfileId: userId }),
    enabled:  isAuth && !!userId,
    select:   (d: any) => d?.list ?? d ?? [],
  });

  useEffect(() => {
    const addrs = addresses as any[];
    if (addrs.length > 0 && !selectedAddressId) {
      const def = addrs.find((a: any) => a.isDefault) ?? addrs[0];
      setSelectedAddressId(def.addressId);
    }
  }, [addresses]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editItem
        ? updateAddress(editItem.addressId, { ...data, userProfileId: userId })
        : createAddress({ ...data, userProfileId: userId }),
    onSuccess: () => {
      toast.success(editItem ? 'Address updated!' : 'Address saved!');
      qc.invalidateQueries({ queryKey: ['addresses', userId] });
      setShowForm(false); setEditItem(null); setForm({ ...emptyForm }); setErrors({});
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save address'),
  });

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = (f: FormState, setE: React.Dispatch<React.SetStateAction<Record<string, string>>>): boolean => {
    const e: Record<string, string> = {};
    if (!f.name.trim())        e.name        = 'Full name is required';
    if (!f.phone.trim())       e.phone       = 'Mobile number is required';
    else if (!/^\d{10}$/.test(f.phone)) e.phone = 'Please enter a valid 10-digit mobile number';
    if (!f.houseNo.trim())     e.houseNo     = 'House / flat details are required';
    if (!f.addressLine.trim()) e.addressLine = 'Street / road is required';
    if (!f.city.trim())        e.city        = 'City is required';
    if (!f.state.trim())       e.state       = 'State is required';
    if (!f.pinCode.trim())     e.pinCode     = 'Pincode is required';
    else if (!/^\d{6}$/.test(f.pinCode)) e.pinCode = 'Please enter a valid 6-digit pincode';
    setE(e);
    return Object.keys(e).length === 0;
  };

  // ── OTP flow ────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!guestEmail || !/\S+@\S+\.\S+/.test(guestEmail)) {
      setOtpError('Enter a valid email address'); return;
    }
    setOtpLoading(true); setOtpError(''); setEmailRegistered(false);
    try {
      await api.post('/auth/send-otp', { email: guestEmail.toLowerCase(), purpose: 'guest_checkout' });
      setOtpSent(true); setResendTimer(120);
      toast.success('OTP sent to ' + guestEmail);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409 || (typeof detail === 'object' && detail?.exists)) setEmailRegistered(true);
      else if (status === 400) setOtpError(typeof detail === 'string' ? detail : 'Invalid email.');
      else setOtpError('Failed to send OTP. Please try again.');
    } finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.length < 4) { setOtpError('Enter the OTP sent to your email'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      const res = await api.post('/auth/verify-otp', {
        email: guestEmail.toLowerCase(),
        otp:   otpValue.replace(/\s/g, '').trim(),
        purpose: 'guest_checkout',
      });
      if (res.data?.access_token) {
        const { login } = useAuthStore.getState();
        login({ userId: '', email: guestEmail, roleId: 2, firstName: '' } as any, res.data.access_token);
      }
      setOtpVerified(true); setResendTimer(0);
      toast.success('Email verified! Now fill in your delivery address.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setOtpError(typeof detail === 'string' ? detail : typeof detail === 'object' ? (detail?.message ?? 'Invalid OTP') : 'Invalid OTP. Try again.');
    } finally { setOtpLoading(false); }
  };

  // ── Continue handlers ───────────────────────────────────────────────────
  const handleGuestContinue = () => {
    if (!validate(guestForm, setGuestErrors)) { toast.error('Please fix the highlighted errors'); return; }
    const fullLine = [guestForm.houseNo, guestForm.addressLine, guestForm.locality].filter(Boolean).join(', ');
    sessionStorage.setItem('guestAddress', JSON.stringify({ ...guestForm, addressLine: fullLine, email: guestEmail }));
    navigate('/user-products/shipping-option?buyNow=' + (isBuyNow ? '1' : '0'));
  };

  const handleAuthContinue = () => {
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return; }
    sessionStorage.setItem('selectedAddressId', String(selectedAddressId));
    navigate('/user-products/shipping-option' + (isBuyNow ? '?buyNow=1' : ''));
  };

  const handleSaveAddress = () => {
    if (!validate(form, setErrors)) return;
    const fullLine = [form.houseNo, form.addressLine, form.locality].filter(Boolean).join(', ');
    saveMutation.mutate({ ...form, addressLine: fullLine });
  };

  const editAddress = (addr: any) => {
    setEditItem(addr);
    const parts  = (addr.addressLine ?? '').split(',').map((s: string) => s.trim());
    setForm({
      name:        addr.name      ?? '',
      phone:       addr.phone     ?? '',
      houseNo:     parts[0]       ?? '',
      addressLine: parts.slice(1).join(', ') || '',
      locality:    addr.locality  ?? '',
      city:        addr.city      ?? '',
      state:       addr.state     ?? addr.stateName ?? '',
      country:     addr.country   ?? 'India',
      pinCode:     addr.pinCode   ?? '',
      addressType: addr.typeId === 2 ? 'Work' : 'Home',
      isDefault:   addr.isDefault ?? false,
    });
    setErrors({});
    setShowForm(true);
  };

  const getFullAddr = (a: any) =>
    [a.addressLine, a.city, a.state, a.pinCode].filter(Boolean).join(', ');

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 16px', maxWidth: 680, margin: '0 auto', fontFamily: FONT_UI }}>
      <style>{`
        @keyframes pa-spin { to { transform: rotate(360deg); } }
        .pa-addr-card:hover { border-color: ${HEIRLOOM} !important; }
      `}</style>

      <Breadcrumb items={breadcrumbs} />
      <CheckoutSteps active="address" />

      <h4 style={{ fontFamily: FONTS, color: PRI, fontWeight: 700, marginBottom: 22, fontSize: 22, margin: '0 0 22px' }}>
        Delivery Address
      </h4>

      {/* ════════════════ GUEST FLOW ════════════════ */}
      {!isAuth && (
        <>
          {/* Sign-in nudge */}
          {showSignInBanner && (
            <div style={{
              background: IVORY, border: `1px solid ${HEIRLOOM}35`,
              borderRadius: 10, padding: '11px 16px', marginBottom: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#555', fontFamily: FONT_UI }}>
                <i className="bi bi-person-circle" style={{ color: PRI, marginRight: 8, fontSize: 15 }} />
                Have an account?{' '}
                <Link to="/login" style={{ color: PRI, fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                {' '}to use saved addresses &amp; track orders.
              </span>
              <button onClick={() => setShowSignInBanner(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Step 1 — Email verify */}
          {!otpVerified && (
            <div style={{ background: '#fff', border: '1px solid #ece4d8', borderRadius: 12, padding: 24, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: PRI, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</div>
                <h6 style={{ margin: 0, fontFamily: FONTS, color: PRI, fontWeight: 700, fontSize: 15 }}>Verify your email</h6>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={labelSt}>Email Address <span style={{ color: '#e53935' }}>*</span></label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => { setGuestEmail(e.target.value); setOtpError(''); setOtpSent(false); setOtpValue(''); }}
                    placeholder="you@example.com"
                    disabled={otpSent}
                    style={inpStyle(false, otpSent)}
                  />
                </div>
                <button type="button"
                  onClick={otpSent ? () => { setOtpSent(false); setOtpValue(''); setEmailRegistered(false); } : handleSendOtp}
                  disabled={otpLoading || emailRegistered}
                  style={{
                    marginTop: 22, padding: '11px 20px',
                    background: otpSent ? '#fff' : PRI, color: otpSent ? PRI : '#fff',
                    border: `1.5px solid ${PRI}`, borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_UI, whiteSpace: 'nowrap',
                  }}>
                  {otpLoading ? 'Sending…' : otpSent ? 'Change email' : 'Send OTP'}
                </button>
              </div>

              {otpSent && (
                <div style={{ marginTop: 18 }}>
                  <label style={labelSt}>OTP sent to <strong>{guestEmail}</strong></label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text" inputMode="numeric"
                      value={otpValue}
                      onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                      placeholder="• • • • • •"
                      maxLength={6} autoComplete="one-time-code"
                      style={{
                        width: 162, padding: '11px 14px',
                        border: '1.5px solid #ddd', borderRadius: 8,
                        fontSize: 22, textAlign: 'center', fontWeight: 700,
                        letterSpacing: 10, fontFamily: FONT_UI, outline: 'none',
                      }}
                    />
                    <button type="button" onClick={handleVerifyOtp}
                      disabled={otpLoading || otpValue.length < 4}
                      style={{
                        padding: '11px 24px',
                        background: otpValue.length >= 4 ? PRI : '#ddd', color: '#fff',
                        border: 'none', borderRadius: 8,
                        cursor: otpValue.length >= 4 ? 'pointer' : 'not-allowed',
                        fontSize: 13, fontWeight: 600, fontFamily: FONT_UI,
                      }}>
                      {otpLoading ? 'Verifying…' : 'Verify OTP'}
                    </button>
                  </div>

                  <button type="button"
                    onClick={() => { if (resendTimer > 0) return; setOtpValue(''); setOtpError(''); handleSendOtp(); }}
                    disabled={resendTimer > 0}
                    style={{
                      marginTop: 10, padding: '6px 14px', borderRadius: 20,
                      background: 'transparent',
                      border: `1.5px solid ${resendTimer > 0 ? '#e0d6cc' : PRI}`,
                      color: resendTimer > 0 ? '#bbb' : PRI,
                      fontSize: 12, fontWeight: 600, fontFamily: FONT_UI,
                      cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                    {resendTimer > 0
                      ? `Resend in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                      : <><i className="bi bi-arrow-clockwise" /> Resend OTP</>}
                  </button>
                </div>
              )}

              {emailRegistered && (
                <div style={{ marginTop: 14, padding: '12px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#555' }}>
                    <i className="bi bi-info-circle" style={{ color: '#f9a825', marginRight: 6 }} />
                    <strong>{guestEmail}</strong> is already registered.
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to="/login" style={{ background: PRI, color: '#fff', padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
                    <button type="button"
                      onClick={() => { setEmailRegistered(false); setGuestEmail(''); setOtpError(''); }}
                      style={{ background: '#fff', border: '1px solid #ddd', color: '#555', padding: '7px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: FONT_UI }}>
                      Use different email
                    </button>
                  </div>
                </div>
              )}

              {otpError && !emailRegistered && (
                <p style={{ ...errSt, marginTop: 10, fontSize: 13 }}>
                  <i className="bi bi-exclamation-circle" /> {otpError}
                </p>
              )}
            </div>
          )}

          {/* Step 2 — Delivery Address form */}
          {otpVerified && (
            <div style={{ background: '#fff', border: '1px solid #ece4d8', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <i className="bi bi-check-circle-fill" style={{ color: '#2e7d32', fontSize: 16 }} />
                <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>{guestEmail} verified</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 20px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: PRI, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</div>
                <h6 style={{ margin: 0, fontFamily: FONTS, color: PRI, fontWeight: 700, fontSize: 15 }}>Delivery Address</h6>
              </div>
              <AddressFormPanel
                form={guestForm} setForm={setGuestForm}
                errors={guestErrors} setErrors={setGuestErrors}
                onSubmit={handleGuestContinue}
                submitLabel="Continue to Shipping"
                showDefault={false}
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════ AUTH FLOW ════════════════ */}
      {isAuth && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: '#555' }}>Select a delivery address</span>
            {!showForm && (
              <button type="button"
                onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...emptyForm }); setErrors({}); }}
                style={{
                  background: 'none', border: `1.5px solid ${PRI}`, color: PRI,
                  padding: '7px 16px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontFamily: FONT_UI, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <i className="bi bi-plus-circle" /> Add New Address
              </button>
            )}
          </div>

          {/* Address list */}
          {isLoading
            ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner-border" style={{ color: PRI }} /></div>
            : (addresses as any[]).map((addr: any) => (
              <div key={addr.addressId}
                className="pa-addr-card"
                onClick={() => setSelectedAddressId(addr.addressId)}
                style={{
                  border: `2px solid ${selectedAddressId === addr.addressId ? PRI : '#ece4d8'}`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                  background: selectedAddressId === addr.addressId ? `${PRI}05` : '#fff',
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Custom radio */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${selectedAddressId === addr.addressId ? PRI : '#ccc'}`,
                    background: selectedAddressId === addr.addressId ? PRI : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedAddressId === addr.addressId && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, fontFamily: FONTS }}>{addr.name}</span>
                      <span style={{ fontSize: 11, background: '#f3ede4', padding: '2px 8px', borderRadius: 20, color: '#666' }}>
                        <i className={`bi bi-${addr.typeId === 2 ? 'briefcase' : 'house'}`} style={{ marginRight: 4 }} />
                        {addr.typeId === 2 ? 'Work' : 'Home'}
                      </span>
                      {addr.isDefault && (
                        <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Default</span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 3px', fontSize: 13, color: '#555', lineHeight: 1.55 }}>{getFullAddr(addr)}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#888' }}>
                      <i className="bi bi-telephone" style={{ marginRight: 5, fontSize: 11 }} />{addr.phone}
                    </p>
                  </div>

                  <button type="button"
                    onClick={e => { e.stopPropagation(); editAddress(addr); }}
                    style={{
                      background: 'none', border: '1.5px solid #e8e0d8', borderRadius: 6,
                      padding: '5px 11px', cursor: 'pointer', fontSize: 12, color: '#666',
                      flexShrink: 0, fontFamily: FONT_UI,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                    <i className="bi bi-pencil" style={{ fontSize: 11 }} /> Edit
                  </button>
                </div>
              </div>
            ))
          }

          {(addresses as any[]).length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '52px 0', color: '#ccc' }}>
              <i className="bi bi-geo-alt" style={{ fontSize: 46, display: 'block', marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>No saved addresses. Add one to continue.</p>
            </div>
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div style={{
              background: IVORY, border: `1px solid ${IVORY_DK}`,
              borderRadius: 12, padding: 24, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h6 style={{ margin: 0, fontFamily: FONTS, color: PRI, fontWeight: 700, fontSize: 15 }}>
                  {editItem ? 'Edit Address' : 'Add New Address'}
                </h6>
                <button type="button"
                  onClick={() => { setShowForm(false); setEditItem(null); setErrors({}); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <AddressFormPanel
                form={form} setForm={setForm}
                errors={errors} setErrors={setErrors}
                onSubmit={handleSaveAddress}
                submitLabel={editItem ? 'Update Address' : 'Save Address'}
                submitting={saveMutation.isPending}
                onCancel={() => { setShowForm(false); setEditItem(null); setErrors({}); }}
                showDefault
              />
            </div>
          )}

          {/* Continue CTA */}
          <button type="button" onClick={handleAuthContinue}
            disabled={!selectedAddressId}
            style={{
              marginTop: 6, width: '100%', background: PRI, color: '#fff',
              border: 'none', padding: '13px', borderRadius: 8,
              cursor: selectedAddressId ? 'pointer' : 'not-allowed',
              opacity: selectedAddressId ? 1 : 0.45,
              fontSize: 14, fontWeight: 700, fontFamily: FONT_UI,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity .2s',
            }}>
            Continue to Shipping <i className="bi bi-arrow-right" />
          </button>
        </>
      )}
    </div>
  );
}