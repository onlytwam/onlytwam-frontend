import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';
import CryptoJS from 'crypto-js';

// ── AES-128-CBC encrypt — mirrors Angular CryptoService ───────────────────────
function encryptPassword(plain: string): string {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv  = CryptoJS.enc.Utf8.parse('8080808080808080');
  return CryptoJS.AES.encrypt(plain, key, {
    iv,
    mode:    CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z.object({
  firstName:       z.string().min(1, 'First name is required'),
  lastName:        z.string().min(1, 'Last name is required'),
  email:           z.string().email('Invalid email address'),
  phoneNumber:     z.string().regex(/^\d{10}$/, '10-digit phone number required'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8,
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const errSt: React.CSSProperties = { color: '#e53935', fontSize: 11, margin: '3px 0 0' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [showPw, setShowPw] = useState(false);

  const registerMutation = useMutation({
    mutationFn: () =>
      api.post('/api/register/signup', {
        FirstName:   form.firstName,
        LastName:    form.lastName,
        EmailId:     form.email,
        PhoneNumber: form.phoneNumber,
        Password:    encryptPassword(form.password),
        RoleId:      2, // Customer role
      }).then(r => r.data),
    onSuccess: () => {
      toast.success('Account created! Please sign in.');
      navigate('/login');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: { errors?: Array<{ description?: string }>; }; message?: string; }; }; };
      const msg =
        e?.response?.data?.detail?.errors?.[0]?.description ??
        (typeof e?.response?.data?.detail === 'string' ? e.response!.data!.detail : null) ??
        e?.response?.data?.message ??
        'Registration failed. Please try again.';
      toast.error(msg);
    },
  });

  // ── Validation using Zod .issues (canonical in Zod v3) ────────────────────
  const validate = (): boolean => {
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      // Use .issues (the canonical Zod v3 array) — avoids ts(2339) with .errors alias
      result.error.issues.forEach((issue: z.ZodIssue) => {
        const key = issue.path[0] as keyof FormData;
        if (key) errs[key] = issue.message;
      });
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f6fa', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 460, boxShadow: '0 4px 24px rgba(0,0,0,.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/assets/Twam-Logo-Black.png" alt="TWAM"
            style={{ height: 40, marginBottom: 10 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Create Account</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>Join TWAM today</p>
        </div>

        {/* First name + Last name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {(['firstName', 'lastName'] as const).map(field => (
            <div key={field}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                {field === 'firstName' ? 'First Name *' : 'Last Name *'}
              </label>
              <input
                value={form[field]}
                onChange={e => set(field, e.target.value)}
                style={inp}
              />
              {errors[field] && <p style={errSt}>{errors[field]}</p>}
            </div>
          ))}
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            style={inp}
            placeholder="you@example.com"
          />
          {errors.email && <p style={errSt}>{errors.email}</p>}
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Phone Number *</label>
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={e => set('phoneNumber', e.target.value)}
            style={inp}
            placeholder="10-digit mobile number"
            maxLength={10}
          />
          {errors.phoneNumber && <p style={errSt}>{errors.phoneNumber}</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Password *</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            style={inp}
            placeholder="Min. 6 characters"
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 12, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
          </button>
          {errors.password && <p style={errSt}>{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Confirm Password *</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={e => set('confirmPassword', e.target.value)}
            style={inp}
            placeholder="Repeat your password"
          />
          {errors.confirmPassword && <p style={errSt}>{errors.confirmPassword}</p>}
        </div>

        {/* Submit */}
        <button
          onClick={() => { if (validate()) registerMutation.mutate(); }}
          disabled={registerMutation.isPending}
          style={{
            width: '100%', padding: '13px', background: '#6A012A', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
            cursor: registerMutation.isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: registerMutation.isPending ? 0.7 : 1,
          }}
        >
          {registerMutation.isPending ? 'Creating Account…' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#888', marginTop: 16 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6A012A', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}