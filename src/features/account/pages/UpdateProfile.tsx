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

  const s: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #f5f0e6', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' };
  const err = (key: string, errors: Record<string, string>): React.CSSProperties => errors[key] ? { ...s, borderColor: 'var(--brand)' } : s;

  return (
    <>
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'My Account', path: '/account/update-profile' },
        { label: isPasswordPage ? 'Change Password' : 'My Profile' }
      ]} />
      <div className="s-updateprofil-245770">
      <h5 className="s-updateprofil-e41087">Account Settings</h5>

      {/* Tabs */}
      <div className="s-updateprofil-3898ca">
        {(['profile', 'password'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="s-updateprofil-b9cc95" style={ {fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? '#000000' : 'var(--heirloom)', borderBottom: `3px solid ${activeTab === tab ? '#000000' : 'transparent'}`} }>
            {tab === 'profile' ? '👤 Personal Info' : '🔒 Change Password'}
          </button>
        ))}
      </div>

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <div className="s-updateprofil-3d6779">
          <div className="s-updateprofil-84866b">
            {[
              { key: 'firstName', label: 'First Name *' },
              { key: 'middleName', label: 'Middle Name' },
              { key: 'lastName', label: 'Last Name *' },
            ].map(({ key, label }) => (
              <div key={key} className="s-updateprofil-246fef">
                <label className="s-addressform-f1fb64">{label}</label>
                <input
                  style={err(key, profileErrors)}
                  value={(profile as any)[key]}
                  onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                />
                {profileErrors[key] && <p className="s-updateprofil-ecc872">{profileErrors[key]}</p>}
              </div>
            ))}
          </div>
          <div className="s-updateprofil-900022">
            <div className="s-updateprofil-246fef">
              <label className="s-addressform-f1fb64">Email *</label>
              <input type="email" style={err('email', profileErrors)} value={profile.email}
                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
              {profileErrors.email && <p className="s-updateprofil-ecc872">{profileErrors.email}</p>}
            </div>
            <div className="s-updateprofil-246fef">
              <label className="s-addressform-f1fb64">Phone Number *</label>
              <input style={err('phoneNumber', profileErrors)} value={profile.phoneNumber} maxLength={10}
                onChange={e => setProfile(p => ({ ...p, phoneNumber: e.target.value }))} />
              {profileErrors.phoneNumber && <p className="s-updateprofil-ecc872">{profileErrors.phoneNumber}</p>}
            </div>
          </div>
          <button
            onClick={() => validateProfile() && profileMutation.mutate()}
            disabled={profileMutation.isPending}
            className="s-updateprofil-7be3db">
            {profileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Password Form */}
      {activeTab === 'password' && (
        <div className="s-updateprofil-340e9f">
          {[
            { key: 'currentPassword', label: 'Current Password *', showToggle: true },
            { key: 'newPassword',     label: 'New Password * (min 6 chars)', showToggle: false },
            { key: 'confirmPassword', label: 'Confirm New Password *', showToggle: false },
          ].map(({ key, label, showToggle }) => (
            <div key={key} className="s-updateprofil-246fef">
              <label className="s-addressform-f1fb64">{label}</label>
              <div className="s-updateprofil-1d5e50">
                <input
                  type={showToggle ? (showPw ? 'text' : 'password') : 'password'}
                  style={{ ...err(key, pwErrors), paddingRight: showToggle ? 42 : 12 }}
                  value={(pwForm as any)[key]}
                  onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                />
                {showToggle && (
                  <button type="button" onClick={() => setShowPw(v => !v)} className="s-updateprofil-24c8ba">
                    <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                )}
              </div>
              {pwErrors[key] && <p className="s-updateprofil-ecc872">{pwErrors[key]}</p>}
            </div>
          ))}
          <button
            onClick={() => validatePassword() && passwordMutation.mutate()}
            disabled={passwordMutation.isPending}
            className="s-updateprofil-7be3db">
            {passwordMutation.isPending ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      )}
    </div>
    </>
  );
}
