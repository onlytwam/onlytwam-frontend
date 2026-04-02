// VerifyOtp.tsx — OTP verification page for forgot-password flow

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyForgotPasswordOtp, sendForgotPasswordOtp } from '@/features/auth/api/auth.api';
import toast from 'react-hot-toast';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyOtp() {
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const email            = searchParams.get('email') || '';

  const [digits,   setDigits]   = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading,  setLoading]  = useState(false);
  const [resendSec, setResendSec] = useState(RESEND_SECONDS);
  const [error,    setError]    = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendSec <= 0) return;
    const id = setInterval(() => setResendSec(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendSec]);

  // Auto-focus first box on mount
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    // Allow only digits
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError('');
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = useCallback(async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    if (!email) {
      toast.error('Email not found. Please restart the process.');
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyForgotPasswordOtp(email, otp);
      // Backend may return token as result.token or result.Token
      const token = result?.token || result?.Token || '';
      toast.success('OTP verified! Please set your new password.');
      navigate(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message || '';
      if (status === 400 || detail.toLowerCase().includes('invalid') || detail.toLowerCase().includes('expired')) {
        setError('Invalid or expired OTP. Please try again or resend.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [digits, email, navigate]);

  // Submit on Enter
  useEffect(() => {
    const onEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') handleVerify(); };
    window.addEventListener('keydown', onEnter);
    return () => window.removeEventListener('keydown', onEnter);
  }, [handleVerify]);

  const handleResend = async () => {
    if (resendSec > 0) return;
    try {
      await sendForgotPasswordOtp(email);
      toast.success('A new OTP has been sent to your email.');
      setResendSec(RESEND_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      inputRefs.current[0]?.focus();
    } catch {
      toast.error('Failed to resend OTP. Please try again.');
    }
  };

  const boxStyle = (filled: boolean, hasError: boolean): React.CSSProperties => ({
    width: 52, height: 60,
    border: `2px solid ${hasError ? '#e53935' : filled ? '#6A012A' : '#ddd'}`,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: 700,
    textAlign: 'center',
    outline: 'none',
    background: filled ? '#fdf3f6' : '#fafafa',
    color: '#1a1a1a',
    transition: 'border-color 0.15s, background 0.15s',
    caretColor: '#6A012A',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left — image */}
      <div className="d-none d-md-flex" style={{ flex: '0 0 44%', overflow: 'hidden', position: 'relative' }}>
        <img
          src="/assets/images/forgot-bg.jpg"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          alt=""
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(106,1,42,0.55) 0%, rgba(0,0,0,0.25) 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          padding: '48px 40px',
        }}>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            Check your inbox — your code is waiting.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            Only TWAM — Crafted with love.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#888', textDecoration: 'none', marginBottom: 24 }}>
            <i className="bi bi-arrow-left" /> Back to Sign In
          </Link>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" style={{ height: 46 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Icon + heading */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6A012A, #b0003a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', boxShadow: '0 4px 16px rgba(106,1,42,0.25)',
            }}>
              <i className="bi bi-shield-lock" style={{ fontSize: 30, color: '#fff' }} />
            </div>
            <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Verify Your Email</h5>
            <p style={{ color: '#888', fontSize: 14, margin: 0 }}>
              We sent a {OTP_LENGTH}-digit code to
            </p>
            <p style={{ color: '#6A012A', fontWeight: 600, fontSize: 14, marginTop: 2 }}>
              {email || 'your email'}
            </p>
          </div>

          {/* OTP boxes */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }} onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={boxStyle(!!digit, !!error)}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: '#e53935', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
              <i className="bi bi-exclamation-circle me-1" />{error}
            </p>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={loading}
            style={{
              width: '100%', background: '#6A012A', color: '#fff', border: 'none',
              padding: 14, borderRadius: 8, fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginTop: 8, fontFamily: 'inherit',
            }}
          >
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" />Verifying…</>
              : 'Verify OTP'
            }
          </button>

          {/* Resend */}
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
            Didn't receive the code?{' '}
            {resendSec > 0 ? (
              <span style={{ color: '#aaa' }}>Resend in {resendSec}s</span>
            ) : (
              <button
                onClick={handleResend}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontWeight: 700, fontSize: 13 }}
              >
                Resend OTP
              </button>
            )}
          </p>

          {/* Progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 28 }}>
            {['Enter Email', 'Verify OTP', 'New Password'].map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: i === 1 ? '#6A012A' : i === 0 ? '#d4a0b0' : '#eee',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: i <= 1 ? '#fff' : '#aaa', fontWeight: 600,
                }}>
                  {i === 0 ? <i className="bi bi-check" style={{ fontSize: 13 }} /> : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === 1 ? '#6A012A' : '#aaa', fontWeight: i === 1 ? 600 : 400 }}>
                  {step}
                </span>
                {i < 2 && <div style={{ width: 24, height: 1, background: '#eee' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
