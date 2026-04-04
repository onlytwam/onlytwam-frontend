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
  const errMsg   = (msg?: string) => msg ? <div className="invalid-feedback s-login-78f9a3">{msg}</div> : null;

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
        <div className="s-login-a10a06">
          <div className="s-login-21c8cb" />
          <div className="s-login-044594">
            Syncing your cart and wishlist...
            <br />
            <span className="s-login-1c4695">This will only take a moment</span>
          </div>
        </div>
      )}

      <div className="s-login-2bb036">
        {/* Left — decorative image */}
        <div className="d-none d-md-flex s-login-2da0c0">
          <img
            src={bgImage}
            className="s-userdashboar-4ebae2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            alt=""
          />
          {/* Subtle overlay */}
          <div className="s-login-da6116">
            <p className="s-login-f18190">
              {mode === 'signup' ? '"Every body deserves a perfect fit."'
                : mode === 'forgot' ? 'No worries — we\'ll get you back in.'
                : 'Welcome Back, Beautiful.'}
            </p>
            <p className="s-login-6854c0">
              Only TWAM — Crafted with love.
            </p>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="s-login-5c2ebc">
          <div className="s-login-d3c5f3">
            <Link to="/" className="s-login-0aef96">
              <i className="bi bi-arrow-left" /> Back to Home
            </Link>
            <div className="s-login-9aad3d">
              <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" className="s-login-cd2062"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>

            {redirectTo.includes('payment-address') && (
              <div className="s-login-3b11d9">
                <i className="bi bi-bag me-2" />
                Sign in to complete your order. Your cart items are saved.
              </div>
            )}

            {/* ── SIGN IN */}
            {mode === 'signin' && (
              <>
                <h5 className="s-login-b4f13d">Sign In</h5>
                <p className="s-login-7a79e7">Welcome Back, Beautiful. Let's get you back to feeling fabulous.</p>
                <form onSubmit={handleLogin}>
                  <div className="s-adminblog-22a617">
                    <label className="s-login-b4e387">Email or Mobile No.</label>
                    <input {...loginForm.register('email')} className={inputCls(loginForm.formState.errors.email)} type="email" placeholder="Enter email" />
                    {errMsg(loginForm.formState.errors.email?.message)}
                  </div>
                  <div className="s-login-e50f28">
                    <label className="s-login-b4e387">Password</label>
                    <div className="s-updateprofil-1d5e50">
                      <input {...loginForm.register('password')} className={`${inputCls(loginForm.formState.errors.password)} s-login-51c683`} type={hidePass ? 'password' : 'text'} placeholder="Enter password" />
                      <button type="button" onClick={() => setHidePass(!hidePass)}
                        className="s-login-af8e0d">
                        <i className={`bi ${hidePass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                    {errMsg(loginForm.formState.errors.password?.message)}
                  </div>
                  <div className="s-login-8007bc">
                    <button type="button" onClick={() => setMode('forgot')} className="s-login-aef348">
                      Forgot Password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading}
                    className="s-login-c6af62" style={ {cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1} }>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
                <p className="s-login-89ef73">
                  Don't have an account?{' '}
                  <button onClick={() => setMode('signup')} className="s-login-182bea">Sign Up</button>
                </p>
              </>
            )}

            {/* ── SIGN UP */}
            {mode === 'signup' && (
              <>
                <h5 className="s-login-b4f13d">Sign Up</h5>
                <p className="s-login-7a79e7">"Every body deserves a perfect fit."</p>
                <form onSubmit={handleSignup}>
                  <div className="s-login-9f425c">
                    {(['firstName', 'middleName', 'lastName'] as const).map((key, i) => (
                      <div key={key}>
                        <label className="s-login-4d06e1">{['First Name *', 'Middle', 'Last Name *'][i]}</label>
                        <input {...signupForm.register(key)} className={inputCls((signupForm.formState.errors as any)[key])} />
                        {errMsg((signupForm.formState.errors as any)[key]?.message)}
                      </div>
                    ))}
                  </div>
                  <div className="s-login-863afe">
                    {([
                      { key: 'email',           label: 'Email *',        type: 'email' },
                      { key: 'phoneNumber',     label: 'Phone *',        type: 'tel' },
                      { key: 'password',        label: 'Password *',     type: hidePass ? 'password' : 'text' },
                      { key: 'confirmPassword', label: 'Confirm Pass *', type: 'password' },
                    ] as const).map(({ key, label, type }) => (
                      <div key={key as string} className="s-adminproduct-02d219">
                        <label className="s-login-4d06e1">{label}</label>
                        <input {...signupForm.register(key as any)} className={inputCls((signupForm.formState.errors as any)[key])} type={type} />
                        {errMsg((signupForm.formState.errors as any)[key as string]?.message)}
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={loading}
                    className="s-login-8c5379" style={ {cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1} }>
                    {loading ? 'Creating account…' : 'Sign Up'}
                  </button>
                </form>
                <p className="s-login-5d4ce1">
                  Already have an account?{' '}
                  <button onClick={() => setMode('signin')} className="s-login-182bea">Sign In</button>
                </p>
              </>
            )}

            {/* ── FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <>
                <h5 className="s-login-b4f13d">Forgot Password?</h5>
                <p className="s-login-7a79e7">Enter your registered email and we'll send you a one-time verification code.</p>
                <form onSubmit={handleForgot}>
                  <div className="s-adminblog-19fd7a">
                    <label className="s-login-b4e387">Email Address</label>
                    <input {...forgotForm.register('email')} className={inputCls(forgotForm.formState.errors.email)} type="email" placeholder="Enter registered email" />
                    {errMsg(forgotForm.formState.errors.email?.message)}
                  </div>
                  <button type="submit" disabled={loading}
                    className="s-login-c6af62" style={ {cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1} }>
                    {loading ? 'Sending OTP…' : 'Send OTP'}
                  </button>
                </form>
                <p className="s-login-c80d80">
                  <button onClick={() => setMode('signin')} className="s-login-182bea">← Back to Sign In</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}