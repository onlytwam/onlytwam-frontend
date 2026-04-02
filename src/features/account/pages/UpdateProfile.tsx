// Fixed: API endpoints now point to correct backend routes
// Profile update: POST /register/update  (not PUT /Account/UpdateProfile)
// Change password: POST /register/ChangePassword (not POST /Account/ChangePassword)

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { updateProfile, changePassword } from '@/features/auth/api/auth.api';
import Breadcrumb from '@/shared/components/Breadcrumb';

export default function UpdateProfile() {
  const { user, setUser } = useAuthStore();
  const isPasswordPage = window.location.pathname.includes('change-password');
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(isPasswordPage ? 'password' : 'profile');

  const [profile, setProfile] = useState({
    firstName:   (user as any)?.firstName   || '',
    middleName:  (user as any)?.middleName  || '',
    lastName:    (user as any)?.lastName    || '',
    email:       (user as any)?.email       || '',
    phoneNumber: (user as any)?.phoneNumber || (user as any)?.phone || '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [pwForm, setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw]   = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        firstName:   (user as any).firstName   || '',
        middleName:  (user as any).middleName  || '',
        lastName:    (user as any).lastName    || '',
        email:       (user as any).email       || '',
        phoneNumber: (user as any).phoneNumber || (user as any).phone || '',
      });
    }
  }, [user]);

  // FIX: calls updateProfile() from auth.api.ts which posts to /register/update
  const profileMutation = useMutation({
    mutationFn: () => updateProfile({
      emailId:     profile.email,
      firstName:   profile.firstName,
      middleName:  profile.middleName,
      lastName:    profile.lastName,
      phoneNumber: profile.phoneNumber,
    }),
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      if (user) setUser({ ...user, ...profile } as any);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || e?.response?.data?.message;
      if (msg?.includes('No changes detected')) {
        toast('No changes detected.', { icon: 'ℹ️' });
      } else {
        toast.error(msg || 'Failed to update profile');
      }
    },
  });

  // FIX: calls changePassword() from auth.api.ts which posts to /register/ChangePassword
  const passwordMutation = useMutation({
    mutationFn: () => changePassword({
      emailId:         profile.email,
      currentPassword: pwForm.currentPassword,
      newPassword:     pwForm.newPassword,
    }),
    onSuccess: () => {
      toast.success('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: any) => toast.error(
      e?.response?.data?.detail || e?.response?.data?.message ||
      'Failed to change password. Please check your current password.'
    ),
  });

  const validateProfile = () => {
    const e: Record<string, string> = {};
    if (!profile.firstName.trim()) e.firstName = 'First name is required';
    if (!profile.lastName.trim())  e.lastName  = 'Last name is required';
    if (!profile.email.trim())     e.email     = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(profile.email)) e.email = 'Invalid email';
    if (!profile.phoneNumber.trim()) e.phoneNumber = 'Phone is required';
    else if (!/^\d{10}$/.test(profile.phoneNumber)) e.phoneNumber = 'Enter valid 10-digit phone';
    setProfileErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePassword = () => {
    const e: Record<string, string> = {};
    if (!pwForm.currentPassword) e.currentPassword = 'Current password is required';
    if (!pwForm.newPassword) e.newPassword = 'New password is required';
    else if (pwForm.newPassword.length < 6) e.newPassword = 'Min 6 characters';
    if (!pwForm.confirmPassword) e.confirmPassword = 'Confirm your password';
    else if (pwForm.newPassword !== pwForm.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setPwErrors(e);
    return Object.keys(e).length === 0;
  };

  const s: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const err = (key: string, errors: Record<string, string>): React.CSSProperties => errors[key] ? { ...s, borderColor: '#e53935' } : s;

  return (
    <>
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'My Account', path: '/account/update-profile' },
        { label: isPasswordPage ? 'Change Password' : 'My Profile' }
      ]} />
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 28 }}>
      <h5 style={{ margin: '0 0 20px', fontWeight: 700 }}>Account Settings</h5>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 24 }}>
        {(['profile', 'password'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? '#111' : '#888',
            borderBottom: `3px solid ${activeTab === tab ? '#111' : 'transparent'}`,
            marginBottom: -2, fontFamily: 'inherit',
          }}>
            {tab === 'profile' ? '👤 Personal Info' : '🔒 Change Password'}
          </button>
        ))}
      </div>

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 16px' }}>
            {[
              { key: 'firstName', label: 'First Name *' },
              { key: 'middleName', label: 'Middle Name' },
              { key: 'lastName', label: 'Last Name *' },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  style={err(key, profileErrors)}
                  value={(profile as any)[key]}
                  onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                />
                {profileErrors[key] && <p style={{ color: '#e53935', fontSize: 12, margin: '3px 0 0' }}>{profileErrors[key]}</p>}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Email *</label>
              <input type="email" style={err('email', profileErrors)} value={profile.email}
                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
              {profileErrors.email && <p style={{ color: '#e53935', fontSize: 12, margin: '3px 0 0' }}>{profileErrors.email}</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Phone Number *</label>
              <input style={err('phoneNumber', profileErrors)} value={profile.phoneNumber} maxLength={10}
                onChange={e => setProfile(p => ({ ...p, phoneNumber: e.target.value }))} />
              {profileErrors.phoneNumber && <p style={{ color: '#e53935', fontSize: 12, margin: '3px 0 0' }}>{profileErrors.phoneNumber}</p>}
            </div>
          </div>
          <button
            onClick={() => validateProfile() && profileMutation.mutate()}
            disabled={profileMutation.isPending}
            style={{ background: '#111', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>
            {profileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Password Form */}
      {activeTab === 'password' && (
        <div style={{ maxWidth: 400 }}>
          {[
            { key: 'currentPassword', label: 'Current Password *', showToggle: true },
            { key: 'newPassword',     label: 'New Password * (min 6 chars)', showToggle: false },
            { key: 'confirmPassword', label: 'Confirm New Password *', showToggle: false },
          ].map(({ key, label, showToggle }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToggle ? (showPw ? 'text' : 'password') : 'password'}
                  style={{ ...err(key, pwErrors), paddingRight: showToggle ? 42 : 12 }}
                  value={(pwForm as any)[key]}
                  onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                />
                {showToggle && (
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#888',
                  }}>
                    <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                )}
              </div>
              {pwErrors[key] && <p style={{ color: '#e53935', fontSize: 12, margin: '3px 0 0' }}>{pwErrors[key]}</p>}
            </div>
          ))}
          <button
            onClick={() => validatePassword() && passwordMutation.mutate()}
            disabled={passwordMutation.isPending}
            style={{ background: '#111', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>
            {passwordMutation.isPending ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      )}
    </div>
    </>
  );
}
