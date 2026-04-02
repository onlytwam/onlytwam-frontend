// Login.tsx — OTP-based forgot password, split image layout
// IMPROVED: authStore handles sync internally, syncing overlay added

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  loginWithPassword, registerUser, sendForgotPasswordOtp,
  getCategories, normalizeUserInfo, getUserInfo,
} from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useMenuStore } from '@/shared/store/menuStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  firstName:       z.string().min(1, 'First Name is required').max(500),
  middleName:      z.string().max(500).optional(),
  lastName:        z.string().min(1, 'Last Name is required').max(500),
  email:           z.string().min(1, 'Email is required').email('Invalid email'),
  phoneNumber:     z.string().min(1, 'Phone number is required').regex(/^\d{10}$/, 'Invalid phone number'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
});

type Mode = 'signin' | 'signup' | 'forgot';

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) return '';
  if (data.detail && typeof data.detail === 'object')
    return data.detail.error_description || data.detail.error || JSON.stringify(data.detail);
  if (typeof data.detail === 'string') return data.detail;
  if (data.error_description) return data.error_description;
  if (data.error) return data.error;
  return '';
}

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isSyncing } = useAuthStore(); // Added isSyncing
  const { setMenus } = useMenuStore();

  const redirectTo = searchParams.get('redirect') || '/';
  const initialMode: Mode = (location.state as any)?.mode === 'signup' ? 'signup' : 'signin';
  const [mode,     setMode]     = useState<Mode>(initialMode);
  const [hidePass, setHidePass] = useState(true);
  const [loading,  setLoading]  = useState(false);

  // Wait for sync to complete before navigating
  useEffect(() => {
    if (isAuthenticated && !isSyncing) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isSyncing]);

  const loginForm  = useForm({ resolver: zodResolver(loginSchema),  defaultValues: { email: '', password: '' } });
  const signupForm = useForm({ resolver: zodResolver(signupSchema),  defaultValues: { firstName: '', middleName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' } });
  const forgotForm = useForm({ resolver: zodResolver(forgotSchema),  defaultValues: { email: '' } });

  // ── Sign In — authStore handles ALL sync internally (no manual bulkCart/syncGuestWishlist)
  const handleLogin = loginForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      const tokenData = await loginWithPassword(data.email, data.password);
      if (!tokenData.access_token) {
        toast.error('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const rawInfo  = await getUserInfo(tokenData.access_token);
      const userInfo = normalizeUserInfo(rawInfo);

      // Fetch and save categories
      const cats = await getCategories({ roleId: userInfo.roleId });
      sessionStorage.setItem('menus', JSON.stringify(cats));
      setMenus(cats);

      // Check role before login() call
      const ADMIN_ROLES = new Set([1, 3, 4, 5, 6]);
      const isAdmin = ADMIN_ROLES.has(userInfo.roleId);

      // Show syncing hint if guest data exists
      const guestCartExists     = !!localStorage.getItem('guestCart');
      const guestWishlistExists = !!localStorage.getItem('guestWishlist');
      if (guestCartExists || guestWishlistExists) {
        toast.success('Syncing your cart and wishlist...', { duration: 2000 });
      }

      // login() now handles ALL sync internally
      await login(userInfo as any, tokenData.access_token);

      // Navigate based on role
      if (isAdmin) {
        navigate('/admin/admin-dashboard', { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }

    } catch (err: any) {
      const msg = extractErrorMessage(err).toLowerCase();
      if (msg.includes('invalid credentials') || msg.includes('invalid_credentials') || msg.includes('invalid_grant')) {
        toast.error('Invalid email or password. Please try again.');
      } else if (msg.includes('locked')) {
        toast.error('Your account is locked. Please contact support.');
      } else if (msg.includes('not found') || msg.includes('not_allowed') || msg.includes('not allowed')) {
        toast.error('This email is not registered. Please sign up first.');
      } else if (err?.response?.status === 400) {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  });

  // ── Sign Up
  const handleSignup = signupForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      await registerUser({
        firstName:   data.firstName,
        middleName:  data.middleName || '',
        lastName:    data.lastName,
        emailId:     data.email,
        password:    data.password,
        phoneNumber: data.phoneNumber,
      });
      toast.success('Account created! Please sign in.');
      setMode('signin');
      signupForm.reset();
    } catch (err: any) {
      const errors = err?.response?.data?.errors || err?.response?.data?.detail?.errors;
      if (Array.isArray(errors)) {
        toast.error(errors.map((e: any) => e.code === 'DuplicateUserName' ? 'Email already exists' : e.description).join(', '));
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  });

  // ── Forgot Password — sends OTP then redirects to verify page
  const handleForgot = forgotForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      await sendForgotPasswordOtp(data.email);
      toast.success('OTP sent to your email! Please check your inbox.');
      navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
      forgotForm.reset();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        toast.error('No account found with this email address.');
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  });

  const inputCls = (err?: any) => `form-control${err ? ' is-invalid' : ''}`;
  const errMsg   = (msg?: string) => msg ? <div className="invalid-feedback" style={{ display: 'block' }}>{msg}</div> : null;

  // Background images per mode
  const bgImage = mode === 'signup'
    ? '/assets/images/signup-bg.jpg'
    : mode === 'forgot'
    ? '/assets/images/forgot-bg.jpg'
    : '/assets/images/login-bg.jpg';

  return (
    <>
      {/* ── Syncing Overlay — shown while authStore is syncing cart/wishlist */}
      {isSyncing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 60,
            height: 60,
            border: '5px solid rgba(255,255,255,0.2)',
            borderTop: '5px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            textAlign: 'center',
            fontFamily: '"Palatino Linotype", serif',
          }}>
            Syncing your cart and wishlist...
            <br />
            <span style={{ fontSize: 14, opacity: 0.8 }}>This will only take a moment</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Left — decorative image */}
        <div className="d-none d-md-flex" style={{ flex: '0 0 44%', overflow: 'hidden', position: 'relative' }}>
          <img
            src={bgImage}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            alt=""
          />
          {/* Subtle overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(106,1,42,0.55) 0%, rgba(0,0,0,0.25) 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            padding: '48px 40px',
          }}>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {mode === 'signup' ? '"Every body deserves a perfect fit."'
                : mode === 'forgot' ? 'No worries — we\'ll get you back in.'
                : 'Welcome Back, Beautiful.'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              Only TWAM — Crafted with love.
            </p>
          </div>
        </div>

        {/* Right — form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#fff' }}>
          <div style={{ width: '100%', maxWidth: 440 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#888', textDecoration: 'none', marginBottom: 24 }}>
              <i className="bi bi-arrow-left" /> Back to Home
            </Link>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" style={{ height: 46 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>

            {redirectTo.includes('payment-address') && (
              <div style={{ background: '#fff8f0', border: '1px solid #ffd580', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#7a4f00' }}>
                <i className="bi bi-bag me-2" />
                Sign in to complete your order. Your cart items are saved.
              </div>
            )}

            {/* ── SIGN IN */}
            {mode === 'signin' && (
              <>
                <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Sign In</h5>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Welcome Back, Beautiful. Let's get you back to feeling fabulous.</p>
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Email or Mobile No.</label>
                    <input {...loginForm.register('email')} className={inputCls(loginForm.formState.errors.email)} type="email" placeholder="Enter email" />
                    {errMsg(loginForm.formState.errors.email?.message)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input {...loginForm.register('password')} className={inputCls(loginForm.formState.errors.password)} type={hidePass ? 'password' : 'text'} placeholder="Enter password" style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setHidePass(!hidePass)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                        <i className={`bi ${hidePass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                    {errMsg(loginForm.formState.errors.password?.message)}
                  </div>
                  <div style={{ textAlign: 'right', marginBottom: 18 }}>
                    <button type="button" onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontSize: 13 }}>
                      Forgot Password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', background: '#6A012A', color: '#fff', border: 'none', padding: 13, borderRadius: 4, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: '#888' }}>
                  Don't have an account?{' '}
                  <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontWeight: 700 }}>Sign Up</button>
                </p>
              </>
            )}

            {/* ── SIGN UP */}
            {mode === 'signup' && (
              <>
                <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Sign Up</h5>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>"Every body deserves a perfect fit."</p>
                <form onSubmit={handleSignup}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px', marginBottom: 12 }}>
                    {(['firstName', 'middleName', 'lastName'] as const).map((key, i) => (
                      <div key={key}>
                        <label style={{ fontSize: 12, marginBottom: 3, display: 'block' }}>{['First Name *', 'Middle', 'Last Name *'][i]}</label>
                        <input {...signupForm.register(key)} className={inputCls((signupForm.formState.errors as any)[key])} />
                        {errMsg((signupForm.formState.errors as any)[key]?.message)}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                    {([
                      { key: 'email',           label: 'Email *',        type: 'email' },
                      { key: 'phoneNumber',     label: 'Phone *',        type: 'tel' },
                      { key: 'password',        label: 'Password *',     type: hidePass ? 'password' : 'text' },
                      { key: 'confirmPassword', label: 'Confirm Pass *', type: 'password' },
                    ] as const).map(({ key, label, type }) => (
                      <div key={key as string} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, marginBottom: 3, display: 'block' }}>{label}</label>
                        <input {...signupForm.register(key as any)} className={inputCls((signupForm.formState.errors as any)[key])} type={type} />
                        {errMsg((signupForm.formState.errors as any)[key as string]?.message)}
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', background: '#6A012A', color: '#fff', border: 'none', padding: 13, borderRadius: 4, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                    {loading ? 'Creating account…' : 'Sign Up'}
                  </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#888' }}>
                  Already have an account?{' '}
                  <button onClick={() => setMode('signin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontWeight: 700 }}>Sign In</button>
                </p>
              </>
            )}

            {/* ── FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <>
                <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Forgot Password?</h5>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Enter your registered email and we'll send you a one-time verification code.</p>
                <form onSubmit={handleForgot}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Email Address</label>
                    <input {...forgotForm.register('email')} className={inputCls(forgotForm.formState.errors.email)} type="email" placeholder="Enter registered email" />
                    {errMsg(forgotForm.formState.errors.email?.message)}
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', background: '#6A012A', color: '#fff', border: 'none', padding: 13, borderRadius: 4, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Sending OTP…' : 'Send OTP'}
                  </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#888' }}>
                  <button onClick={() => setMode('signin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontWeight: 700 }}>← Back to Sign In</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}