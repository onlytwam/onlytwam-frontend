import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';
import MobileBackHeader from '@/shared/components/MobileBackHeader';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
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


export default function Register() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    <>
      {isMobile && <MobileBackHeader title="Create Account" />}
      <div className="s-register-950e18">
        <div className="s-register-cdd672">
        {/* Logo */}
        <div className="s-login-9aad3d">
          <img src="/assets/Twam-Logo-Black.png" alt="TWAM"
            className="s-register-fa8330"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {!isMobile && <h2 className="s-register-916d9e">Create Account</h2>}
          <p className="s-register-d6d81a">Join TWAM today</p>
        </div>

        {/* First name + Last name */}
        <div className="s-register-84f4ff">
          {(['firstName', 'lastName'] as const).map(field => (
            <div key={field}>
              <label className="s-addressform-f1fb64">
                {field === 'firstName' ? 'First Name *' : 'Last Name *'}
              </label>
              <input
                value={form[field]}
                onChange={e => set(field, e.target.value)}
                className="inp-field"
              />
              {errors[field] && <p className="auth-err-text">{errors[field]}</p>}
            </div>
          ))}
        </div>

        {/* Email */}
        <div className="s-adminblog-22a617">
          <label className="s-addressform-f1fb64">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="inp-field"
            placeholder="you@example.com"
          />
          {errors.email && <p className="auth-err-text">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div className="s-adminblog-22a617">
          <label className="s-addressform-f1fb64">Phone Number *</label>
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={e => set('phoneNumber', e.target.value)}
            className="inp-field"
            placeholder="10-digit mobile number"
            maxLength={10}
          />
          {errors.phoneNumber && <p className="auth-err-text">{errors.phoneNumber}</p>}
        </div>

        {/* Password */}
        <div className="s-register-afacf1">
          <label className="s-addressform-f1fb64">Password *</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            className="inp-field"
            placeholder="Min. 6 characters"
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="s-register-a4e4aa">
            <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
          </button>
          {errors.password && <p className="auth-err-text">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div className="s-adminnewslet-70cb1d">
          <label className="s-addressform-f1fb64">Confirm Password *</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={e => set('confirmPassword', e.target.value)}
            className="inp-field"
            placeholder="Repeat your password"
          />
          {errors.confirmPassword && <p className="auth-err-text">{errors.confirmPassword}</p>}
        </div>

        {/* Submit */}
        <button
          onClick={() => { if (validate()) registerMutation.mutate(); }}
          disabled={registerMutation.isPending}
          className="s-register-47d940" style={ {cursor: registerMutation.isPending ? 'not-allowed' : 'pointer', opacity: registerMutation.isPending ? 0.7 : 1} }
        >
          {registerMutation.isPending ? 'Creating Account…' : 'Create Account'}
        </button>

        <p className="s-register-0a8a6b">
          Already have an account?{' '}
          <Link to="/login" className="s-register-51a817">Sign In</Link>
        </p>
      </div>
      </div>
    </>
  );
}
