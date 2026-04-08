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


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listAddress, createAddress, updateAddress } from '@/features/orders/api/orders.api';
import api from '@/shared/api/axiosInstance';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const IVORY_DK = 'var(--ivory)';
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
  width: '100%', padding: '13px 15px', boxSizing: 'border-box',
  border: `1.5px solid ${err ? 'var(--brand)' : 'var(--ivory)'}`, borderRadius: 8,
  fontSize: 15, fontFamily: FONT_UI, outline: 'none',
  background: disabled ? 'var(--ivory)' : '#fff', color: disabled ? 'var(--heirloom)' : '#000000',
  transition: 'border-color .2s',
});

const labelSt: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, display: 'block',
  marginBottom: 5, color: 'var(--heirloom)', fontFamily: FONT_UI,
};

const errSt: React.CSSProperties = {
  color: 'var(--brand)', fontSize: 12.5, marginTop: 4,
  display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0 0',
};

// ── Checkout breadcrumb steps ─────────────────────────────────────────────────
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

  const pinBorder = pinStatus === 'ok' ? 'var(--brand)' : pinStatus === 'error' ? 'var(--brand)' : 'var(--ivory)';

  return (
    <div>
      {/* ── Geo-fill row ──────────────────────────────────────────────────── */}
      <div className="s-paymentaddre-12ca4c">
        <span className="s-paymentaddre-786faa s-paymentaddre-ffd8281d">
          <i className="bi bi-geo-alt s-paymentaddre-21c065" />
          Auto-fill your city, state &amp; area from your current location
        </span>
        <button
          type="button" onClick={handleGeoFill} disabled={geoLoading}
          className="s-paymentaddre-8db409" style={ {background: geoLoading ? 'var(--ivory)' : 'var(--brand)', color: geoLoading ? 'var(--brand)' : '#fff', fontFamily: FONT_UI, cursor: geoLoading ? 'wait' : 'pointer'} }>
          {geoLoading
            ? <><span className="s-paymentaddre-eb8efd" /> Detecting…</>
            : <><i className="bi bi-geo-alt-fill s-couponslist-030edf" /> Use My Location</>
          }
        </button>
      </div>

      {/* ── Field grid ────────────────────────────────────────────────────── */}
      <div className="s-paymentaddre-50ded3">

        {/* Full Name */}
        <div>
          <label style={labelSt}>Full Name <span className="s-resetpasswor-ddc1b2">*</span></label>
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
          <label style={labelSt}>Mobile Number <span className="s-resetpasswor-ddc1b2">*</span></label>
          <div className="s-paymentaddre-f701c4">
            <span className="s-paymentaddre-6d49e8" style={ {border: `1.5px solid ${errors.phone ? 'var(--brand)' : 'var(--ivory)'}`, fontFamily: FONT_UI} }>+91</span>
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
            Pincode <span className="s-resetpasswor-ddc1b2">*</span>
            {pinStatus === 'loading' && (
              <span className="s-paymentaddre-2afd25">
                <span className="s-paymentaddre-981cc0" />
                Verifying…
              </span>
            )}
            {pinStatus === 'ok' && (
              <span className="s-paymentaddre-b0868f">
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
          <label style={labelSt}>House / Flat / Building <span className="s-resetpasswor-ddc1b2">*</span></label>
          <input
            value={form.houseNo}
            onChange={e => { upd('houseNo')(e.target.value); clearErr('houseNo'); }}
            placeholder="Flat no., floor, building name"
            style={inpStyle(!!errors.houseNo)}
          />
          {errors.houseNo && <p style={errSt}><i className="bi bi-exclamation-circle" />{errors.houseNo}</p>}
        </div>

        {/* Street / Colony / Road — full width */}
        <div className="s-paymentaddre-97e59d">
          <label style={labelSt}>
            Street / Colony / Road <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-2afd25">(auto-fills from location)</span>
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
        <div className="s-paymentaddre-97e59d">
          <label style={labelSt}>
            Area / Locality
            <span className="s-paymentaddre-2afd25">(auto-fills from location)</span>
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
            City <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
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
            State <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
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
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
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
          <div className="s-adminbrands-bccf37">
            {(['Home', 'Work'] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => upd('addressType')(t)}
                className="s-paymentaddre-dedd1d" style={ {border: `1.5px solid ${form.addressType === t ? 'var(--brand)' : 'var(--ivory)'}`, background: form.addressType === t ? `var(--brand)10` : '#fff', color: form.addressType === t ? 'var(--brand)' : 'var(--heirloom)', fontWeight: form.addressType === t ? 700 : 400, fontFamily: FONT_UI} }>
                <i className={`bi bi-${t === 'Home' ? 'house' : 'briefcase'} s-addresslist-9eec06`} />{t}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Set as default */}
      {showDefault && (
        <label className="s-paymentaddre-132f98 s-paymentaddre-ffd8281d">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => upd('isDefault')(e.target.checked)}
            className="s-paymentaddre-b7cf92 s-paymentaddre-288743"
          />
          Set as default address
        </label>
      )}

      {/* Submit */}
      <div className="s-paymentaddre-7c6003">
        <button
          type="button" onClick={onSubmit}
          disabled={submitting || pinStatus === 'loading'}
          className="s-paymentaddre-7578d9" style={{ cursor: submitting || pinStatus === 'loading' ? 'wait' : 'pointer', fontFamily: FONT_UI, opacity: submitting ? 0.85 : 1 }}>
          {submitting
            ? <><span className="s-paymentaddre-ba4d02" /> Saving…</>
            : <>{submitLabel} <i className="bi bi-arrow-right" /></>
          }
        </button>
        {onCancel && (
          <button
            type="button" onClick={onCancel}
            className="s-paymentaddre-7d36f7 s-paymentaddre-ffd8281d">
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
    <div className="s-paymentaddre-2e2509 s-paymentaddre-ffd8281d checkout-shell checkout-shell--address">
      <h4 className="s-paymentaddre-e0ad90 s-paymentaddre-ffd02986 checkout-page-title">
        Delivery Address
      </h4>

      {/* ════════════════ GUEST FLOW ════════════════ */}
      {!isAuth && (
        <>
          {/* Sign-in nudge */}
          {showSignInBanner && (
            <div className="s-paymentaddre-8d9363">
              <span className="s-quickcart-08341f s-paymentaddre-ffd8281d">
                <i className="bi bi-person-circle s-paymentaddre-dffb97" />
                Have an account?{' '}
                <Link to="/login" className="s-paymentaddre-8b8b2d">Sign in</Link>
                {' '}to use saved addresses &amp; track orders.
              </span>
              <button onClick={() => setShowSignInBanner(false)}
                className="s-paymentaddre-d488bf">×</button>
            </div>
          )}

          {/* Step 1 — Email verify */}
          {!otpVerified && (
            <div className="s-paymentaddre-81c77f">
              <div className="s-paymentaddre-083bcb">
                <div className="s-paymentaddre-39fefb">1</div>
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">Verify your email</h6>
              </div>

              <div className="s-paymentaddre-392b28">
                <div className="s-userdashboar-6d7d28">
                  <label style={labelSt}>Email Address <span className="s-resetpasswor-ddc1b2">*</span></label>
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
                  className="s-paymentaddre-a7c6a4" style={ {background: otpSent ? '#fff' : 'var(--brand)', color: otpSent ? 'var(--brand)' : '#fff', fontFamily: FONT_UI} }>
                  {otpLoading ? 'Sending…' : otpSent ? 'Change email' : 'Send OTP'}
                </button>
              </div>

              {otpSent && (
                <div className="s-paymentaddre-10efad">
                  <label style={labelSt}>OTP sent to <strong>{guestEmail}</strong></label>
                  <div className="s-adminproduct-0f6417">
                    <input
                      type="text" inputMode="numeric"
                      value={otpValue}
                      onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                      placeholder="• • • • • •"
                      maxLength={6} autoComplete="one-time-code"
                      className="s-paymentaddre-66b84d s-paymentaddre-ffd8281d"
                    />
                    <button type="button" onClick={handleVerifyOtp}
                      disabled={otpLoading || otpValue.length < 4}
                      className="s-paymentaddre-24677c" style={ {background: otpValue.length >= 4 ? 'var(--brand)' : 'var(--ivory)', cursor: otpValue.length >= 4 ? 'pointer' : 'not-allowed', fontFamily: FONT_UI} }>
                      {otpLoading ? 'Verifying…' : 'Verify OTP'}
                    </button>
                  </div>

                  <button type="button"
                    onClick={() => { if (resendTimer > 0) return; setOtpValue(''); setOtpError(''); handleSendOtp(); }}
                    disabled={resendTimer > 0}
                    className="s-paymentaddre-3e995d" style={ {border: `1.5px solid ${resendTimer > 0 ? 'var(--ivory)' : 'var(--brand)'}`, color: resendTimer > 0 ? 'var(--heirloom)' : 'var(--brand)', fontFamily: FONT_UI, cursor: resendTimer > 0 ? 'not-allowed' : 'pointer'} }>
                    {resendTimer > 0
                      ? `Resend in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                      : <><i className="bi bi-arrow-clockwise" /> Resend OTP</>}
                  </button>
                </div>
              )}

              {emailRegistered && (
                <div className="s-paymentaddre-e5a6a2">
                  <span className="s-quickcart-08341f">
                    <i className="bi bi-info-circle s-paymentaddre-827b5f" />
                    <strong>{guestEmail}</strong> is already registered.
                  </span>
                  <div className="s-adminbrands-ac734d">
                    <Link to="/login" className="s-paymentaddre-e47eab">Sign In</Link>
                    <button type="button"
                      onClick={() => { setEmailRegistered(false); setGuestEmail(''); setOtpError(''); }}
                      className="s-paymentaddre-99313b s-paymentaddre-ffd8281d">
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
            <div className="s-ourstores-5cd98f">
              <div className="s-paymentaddre-3618cd">
                <i className="bi bi-check-circle-fill s-paymentaddre-d3e729" />
                <span className="s-cart-1c5a85">{guestEmail} verified</span>
              </div>
              <div className="s-paymentaddre-b28ef4">
                <div className="s-paymentaddre-39fefb">2</div>
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">Delivery Address</h6>
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
          <div className="s-paymentaddre-0d4697">
            <span className="s-paymentaddre-1ba117">Select a delivery address</span>
            {!showForm && (
              <button type="button"
                onClick={() => { setShowForm(true); setEditItem(null); setForm({ ...emptyForm }); setErrors({}); }}
                className="s-paymentaddre-4edcea s-paymentaddre-ffd8281d">
                <i className="bi bi-plus-circle" /> Add New Address
              </button>
            )}
          </div>

          {/* Address list */}
          {isLoading
            ? <div className="s-paymentaddre-4d4a05"><div className="spinner-border s-paymentaddre-a6f59d" /></div>
            : (addresses as any[]).map((addr: any) => (
              <div key={addr.addressId}
                className="pa-addr-card"
                onClick={() => setSelectedAddressId(addr.addressId)}
                className="s-paymentaddre-2e14df" style={ {border: `2px solid ${selectedAddressId === addr.addressId ? 'var(--brand)' : 'var(--ivory)'}`, background: selectedAddressId === addr.addressId ? `var(--brand)05` : '#fff'} }>
                <div className="s-paymentaddre-9998cf">
                  {/* Custom radio */}
                  <div className="s-paymentaddre-4e0051" style={ {border: `2px solid ${selectedAddressId === addr.addressId ? 'var(--brand)' : 'var(--ivory)'}`, background: selectedAddressId === addr.addressId ? 'var(--brand)' : '#fff'} }>
                    {selectedAddressId === addr.addressId && <div className="s-payment-108f10" />}
                  </div>

                  <div className="s-app-52dcac">
                    <div className="s-paymentaddre-87be9d">
                      <span className="s-adminsizes-5de088 s-paymentaddre-ffd02986">{addr.name}</span>
                      <span className="s-paymentaddre-5dd002">
                        <i className={`bi bi-${addr.typeId === 2 ? 'briefcase' : 'house'} s-paymentaddre-0bc507`} />
                        {addr.typeId === 2 ? 'Work' : 'Home'}
                      </span>
                      {addr.isDefault && (
                        <span className="s-paymentaddre-0f4f48">Default</span>
                      )}
                    </div>
                    <p className="s-paymentaddre-73515b">{getFullAddr(addr)}</p>
                    <p className="s-paymentaddre-9168e1">
                      <i className="bi bi-telephone s-paymentaddre-6b8f40" />{addr.phone}
                    </p>
                  </div>

                  <button type="button"
                    onClick={e => { e.stopPropagation(); editAddress(addr); }}
                    className="s-paymentaddre-737dbe s-paymentaddre-ffd8281d">
                    <i className="bi bi-pencil s-addresslist-2c42ad" /> Edit
                  </button>
                </div>
              </div>
            ))
          }

          {(addresses as any[]).length === 0 && !showForm && (
            <div className="s-paymentaddre-db9c9f">
              <i className="bi bi-geo-alt s-paymentaddre-47f187" />
              <p className="s-addresslist-92985e">No saved addresses. Add one to continue.</p>
            </div>
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div className="s-paymentaddre-01ed0c" style={{ border: `1px solid ${IVORY_DK}` }}>
              <div className="s-adminproduct-a1f2ef">
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">
                  {editItem ? 'Edit Address' : 'Add New Address'}
                </h6>
                <button type="button"
                  onClick={() => { setShowForm(false); setEditItem(null); setErrors({}); }}
                  className="s-paymentaddre-2a22b3">×</button>
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
            className="s-paymentaddre-cbec3d" style={ {cursor: selectedAddressId ? 'pointer' : 'not-allowed', opacity: selectedAddressId ? 1 : 0.45, fontFamily: FONT_UI} }>
            Continue to Shipping <i className="bi bi-arrow-right" />
          </button>
        </>
      )}
    </div>
  );
}
