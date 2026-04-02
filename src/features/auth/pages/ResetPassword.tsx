// ResetPassword.tsx — New password form after OTP verification

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPasswordWithToken } from '@/features/auth/api/auth.api';
import toast from 'react-hot-toast';

const errSt: React.CSSProperties = { color: '#e53935', fontSize: 12, margin: '4px 0 0' };

interface PasswordStrength {
  score: number;   // 0–4
  label: string;
  color: string;
}

function getStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#e53935', '#fb8c00', '#43a047', '#1b5e20'];
  return { score, label: labels[score] || '', color: colors[score] || '' };
}

export default function ResetPassword() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const email          = searchParams.get('email') || '';
  const token          = searchParams.get('token') || '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [success,         setSuccess]         = useState(false);

  const strength = getStrength(newPassword);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!newPassword)                    e.newPassword = 'New password is required';
    else if (newPassword.length < 6)     e.newPassword = 'Password must be at least 6 characters';
    else if (newPassword.length > 100)   e.newPassword = 'Password is too long';
    if (!confirmPassword)                e.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!token || !email) {
      toast.error('Invalid reset link. Please restart the process.');
      return;
    }
    if (!validate()) return;
    setLoading(true);
    try {
      await resetPasswordWithToken({ emailId: email, token, newPassword });
      setSuccess(true);
      toast.success('Password reset successfully!');
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Reset failed. The link may have expired.';
      toast.error(typeof msg === 'string' ? msg : 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 42px 12px 14px',
    border: `1px solid ${errors.newPassword || errors.confirmPassword ? '#e53935' : '#ddd'}`,
    borderRadius: 8, fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

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
            Almost there — set a strong new password.
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

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" style={{ height: 46 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Success state */}
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #43a047, #1b5e20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(67,160,71,0.3)',
              }}>
                <i className="bi bi-check-lg" style={{ fontSize: 36, color: '#fff' }} />
              </div>
              <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Password Updated!</h5>
              <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Link to="/login"
                style={{
                  display: 'block', background: '#6A012A', color: '#fff',
                  padding: '13px 24px', borderRadius: 8, textDecoration: 'none',
                  fontSize: 15, fontWeight: 700, textAlign: 'center',
                }}>
                Sign In
              </Link>
            </div>
          ) : (
            <>
              {/* Invalid link */}
              {(!token || !email) ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <i className="bi bi-exclamation-triangle" style={{ fontSize: 26, color: '#c62828' }} />
                  </div>
                  <p style={{ color: '#c62828', fontSize: 14, marginBottom: 20 }}>
                    This reset link is invalid or has expired. Please restart the forgot-password process.
                  </p>
                  <Link to="/login"
                    style={{ background: '#6A012A', color: '#fff', padding: '11px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                    Back to Login
                  </Link>
                </div>
              ) : (
                <>
                  {/* Heading */}
                  <div style={{ marginBottom: 24 }}>
                    <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Set New Password</h5>
                    <p style={{ color: '#888', fontSize: 14, margin: 0 }}>
                      Creating password for <span style={{ color: '#6A012A', fontWeight: 600 }}>{email}</span>
                    </p>
                  </div>

                  <form onSubmit={handleSubmit}>
                    {/* New password */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                        New Password <span style={{ color: '#e53935' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNew ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); setErrors(er => ({ ...er, newPassword: '' })); }}
                          style={{ ...inp, border: `1px solid ${errors.newPassword ? '#e53935' : '#ddd'}` }}
                          placeholder="Minimum 6 characters"
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowNew(v => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                          <i className={`bi ${showNew ? 'bi-eye-slash' : 'bi-eye'}`} />
                        </button>
                      </div>
                      {errors.newPassword && <p style={errSt}>{errors.newPassword}</p>}

                      {/* Strength bar */}
                      {newPassword.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                            {[1,2,3,4].map(i => (
                              <div key={i} style={{
                                flex: 1, height: 4, borderRadius: 4,
                                background: i <= strength.score ? strength.color : '#eee',
                                transition: 'background 0.2s',
                              }} />
                            ))}
                          </div>
                          <p style={{ fontSize: 11, color: strength.color, margin: 0, fontWeight: 600 }}>
                            {strength.label}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                        Confirm Password <span style={{ color: '#e53935' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => { setConfirmPassword(e.target.value); setErrors(er => ({ ...er, confirmPassword: '' })); }}
                          style={{ ...inp, border: `1px solid ${errors.confirmPassword ? '#e53935' : '#ddd'}` }}
                          placeholder="Repeat your password"
                        />
                        <button type="button" onClick={() => setShowConfirm(v => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                          <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`} />
                        </button>
                      </div>
                      {errors.confirmPassword && <p style={errSt}>{errors.confirmPassword}</p>}
                      {/* Match indicator */}
                      {confirmPassword && !errors.confirmPassword && newPassword === confirmPassword && (
                        <p style={{ fontSize: 11, color: '#43a047', margin: '4px 0 0', fontWeight: 600 }}>
                          <i className="bi bi-check-circle me-1" />Passwords match
                        </p>
                      )}
                    </div>

                    {/* Requirements hint */}
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 14px', marginBottom: 20, marginTop: 8 }}>
                      <p style={{ fontSize: 12, color: '#888', margin: '0 0 4px', fontWeight: 600 }}>Password requirements:</p>
                      {[
                        { label: 'At least 6 characters', met: newPassword.length >= 6 },
                        { label: 'At least one uppercase letter', met: /[A-Z]/.test(newPassword) },
                        { label: 'At least one number', met: /[0-9]/.test(newPassword) },
                      ].map(({ label, met }) => (
                        <p key={label} style={{ fontSize: 12, margin: '2px 0', color: met ? '#43a047' : '#aaa' }}>
                          <i className={`bi ${met ? 'bi-check-circle-fill' : 'bi-circle'} me-1`} />
                          {label}
                        </p>
                      ))}
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={loading}
                      style={{
                        width: '100%', padding: 13, background: '#6A012A', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                        cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        opacity: loading ? 0.7 : 1,
                      }}>
                      {loading
                        ? <><span className="spinner-border spinner-border-sm me-2" />Resetting…</>
                        : 'Reset Password'
                      }
                    </button>
                  </form>

                  {/* Progress indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 28 }}>
                    {['Enter Email', 'Verify OTP', 'New Password'].map((step, i) => (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: i < 2 ? '#d4a0b0' : '#6A012A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff', fontWeight: 600,
                        }}>
                          {i < 2 ? <i className="bi bi-check" style={{ fontSize: 13 }} /> : 3}
                        </div>
                        <span style={{ fontSize: 11, color: i === 2 ? '#6A012A' : '#aaa', fontWeight: i === 2 ? 600 : 400 }}>
                          {step}
                        </span>
                        {i < 2 && <div style={{ width: 24, height: 1, background: '#eee' }} />}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
