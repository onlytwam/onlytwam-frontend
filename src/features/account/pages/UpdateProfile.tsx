// Fixed: API endpoints now point to correct backend routes
// Profile update: POST /register/update  (not PUT /Account/UpdateProfile)
// Change password: POST /register/ChangePassword (not POST /Account/ChangePassword)

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBeforeUnload, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { updateProfile, changePassword } from '@/features/auth/api/auth.api';
import UserAvatar from '@/shared/components/UserAvatar';
import { getCanvasSafeImageUrl } from '@/shared/utils/helpers';
import { useProfileLeaveGuard } from '@/shared/components/profileLeaveGuard';

type EditorState = {
  zoom: number;
  rotation: number;
  brightness: number;
  contrast: number;
  offsetX: number;
  offsetY: number;
};

type ProfileImageUpdateOverrides = {
  profileImage?: File | null;
  profileImageData?: string | null;
  removeProfileImage?: boolean;
};

const DEFAULT_EDITOR_STATE: EditorState = {
  zoom: 1,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  offsetX: 0,
  offsetY: 0,
};

export default function UpdateProfile() {
  const { user, setUser } = useAuthStore();
  const { setGuard } = useProfileLeaveGuard();
  const location = useLocation();
  const isPasswordPage = location.pathname.includes('change-password');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentProfileImage = (user as any)?.profileImageUrl || '';
  const initialProfileValues = useMemo(() => ({
    firstName:   (user as any)?.firstName   || '',
    middleName:  (user as any)?.middleName  || '',
    lastName:    (user as any)?.lastName    || '',
    email:       (user as any)?.email       || '',
    phoneNumber: (user as any)?.phoneNumber || (user as any)?.phone || '',
  }), [user]);

  const [profile, setProfile] = useState({
    firstName:   (user as any)?.firstName   || '',
    middleName:  (user as any)?.middleName  || '',
    lastName:    (user as any)?.lastName    || '',
    email:       (user as any)?.email       || '',
    phoneNumber: (user as any)?.phoneNumber || (user as any)?.phone || '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState(currentProfileImage);
  const [editedProfileImageData, setEditedProfileImageData] = useState<string | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);

  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState('');
  const [editorState, setEditorState] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorImageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

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

  useEffect(() => {
    if (removeProfileImage) {
      setProfilePreviewUrl('');
      return;
    }

    if (editedProfileImageData) {
      setProfilePreviewUrl(editedProfileImageData);
      return;
    }

    if (!selectedProfileImage) {
      setProfilePreviewUrl(currentProfileImage);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedProfileImage);
    setProfilePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedProfileImage, currentProfileImage, editedProfileImageData, removeProfileImage]);

  useEffect(() => {
    if (!editorImageUrl) {
      editorImageRef.current = null;
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      editorImageRef.current = image;
      setEditorState((prev) => ({ ...prev }));
    };
    image.onerror = () => {
      editorImageRef.current = null;
      toast.error('Failed to load image editor preview.');
    };
    image.src = editorImageUrl;

    return () => {
      if (editorImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(editorImageUrl);
      }
    };
  }, [editorImageUrl]);

  const drawEditorCanvas = useCallback(() => {
    const canvas = editorCanvasRef.current;
    const image = editorImageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, width, height);

    const fitScale = Math.max(width / image.width, height / image.height);
    const finalScale = fitScale * editorState.zoom;

    ctx.save();
    ctx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%)`;
    ctx.translate(width / 2 + editorState.offsetX, height / 2 + editorState.offsetY);
    ctx.rotate((editorState.rotation * Math.PI) / 180);

    const drawWidth = image.width * finalScale;
    const drawHeight = image.height * finalScale;

    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }, [editorState]);

  useEffect(() => {
    drawEditorCanvas();
  }, [drawEditorCanvas]);

  const resetEditor = () => {
    setEditorState(DEFAULT_EDITOR_STATE);
  };

  const openImageEditor = (source?: File | string | null) => {
    const targetSource =
      source ||
      editedProfileImageData ||
      selectedProfileImage ||
      (!removeProfileImage ? currentProfileImage : null);

    if (!targetSource) return;

    setRemoveProfileImage(false);
    setEditorState(DEFAULT_EDITOR_STATE);
    setEditorImageUrl(
      typeof targetSource === 'string'
        ? getCanvasSafeImageUrl(targetSource, targetSource)
        : URL.createObjectURL(targetSource)
    );
    setIsImageEditorOpen(true);
  };

  const applyImageEdit = () => {
    const canvas = editorCanvasRef.current;
    if (!canvas) {
      toast.error('Editor canvas not ready yet.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    setEditedProfileImageData(dataUrl);
    setProfilePreviewUrl(dataUrl);
    setIsImageEditorOpen(false);
    toast.success('Crop/edit applied. Click Save Changes to upload.');
  };

  const closeImageEditor = () => {
    setIsImageEditorOpen(false);
    dragRef.current = null;
  };

  const onEditorPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: editorState.offsetX,
      startOffsetY: editorState.offsetY,
    };
  };

  const onEditorPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    setEditorState((prev) => ({
      ...prev,
      offsetX: drag.startOffsetX + dx,
      offsetY: drag.startOffsetY + dy,
    }));
  };

  const onEditorPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (canvas && dragRef.current?.pointerId === event.pointerId) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
      dragRef.current = null;
    }
  };

  const buildProfileUpdatePayload = (overrides: ProfileImageUpdateOverrides = {}) => ({
    emailId: profile.email,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    phoneNumber: profile.phoneNumber,
    profileImage: overrides.profileImage !== undefined ? overrides.profileImage : selectedProfileImage,
    profileImageData: overrides.profileImageData !== undefined ? overrides.profileImageData : editedProfileImageData,
    removeProfileImage: overrides.removeProfileImage ?? removeProfileImage,
  });

  const profileMutation = useMutation({
    mutationFn: (overrides: ProfileImageUpdateOverrides = {}) => updateProfile(buildProfileUpdatePayload(overrides)),
    onSuccess: (response: any, variables?: ProfileImageUpdateOverrides) => {
      const didRemoveImage = Boolean(variables?.removeProfileImage);
      toast.success('Profile updated successfully!');
      if (user) {
        const nextProfileImageUrl = didRemoveImage
          ? ''
          : (response?.profileImageUrl || currentProfileImage);
        const nextOriginalProfileImageUrl = didRemoveImage
          ? ''
          : (response?.profileImageOriginalUrl || (user as any)?.profileImageOriginalUrl);

        setUser({
          ...user,
          ...profile,
          email: response?.emailId || profile.email,
          phoneNumber: response?.phoneNumber || profile.phoneNumber,
          profileImageUrl: nextProfileImageUrl,
          profileImageOriginalUrl: nextOriginalProfileImageUrl,
          name: [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') || response?.emailId || profile.email,
        } as any);
      }
      setSelectedProfileImage(null);
      setEditedProfileImageData(null);
      setRemoveProfileImage(false);
      setIsImageEditorOpen(false);
      setEditorImageUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (e: any, variables?: ProfileImageUpdateOverrides) => {
      if (variables?.removeProfileImage) {
        setRemoveProfileImage(false);
        setProfilePreviewUrl(currentProfileImage);
      }
      const msg = e?.response?.data?.detail || e?.response?.data?.message;
      if (msg?.includes('No changes detected')) {
        toast('No changes detected.', { icon: 'i' });
      } else {
        toast.error(msg || 'Failed to update profile');
      }
    },
  });

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

  const s: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #f5f0e6', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' };
  const err = (key: string, errors: Record<string, string>): CSSProperties => errors[key] ? { ...s, borderColor: 'var(--brand)' } : s;
  const secondaryBtnStyle: CSSProperties = { border: '1px solid #d9c4cb', background: '#fff', color: 'var(--brand)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };

  const handleProfileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedProfileImage(null);
      setEditedProfileImageData(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile image must be 5MB or smaller.');
      event.target.value = '';
      return;
    }

    setRemoveProfileImage(false);
    setSelectedProfileImage(file);
    setEditedProfileImageData(null);
    openImageEditor(file);
  };

  const discardProfileImageChanges = () => {
    setSelectedProfileImage(null);
    setEditedProfileImageData(null);
    setRemoveProfileImage(false);
    setProfilePreviewUrl(currentProfileImage);
    setEditorImageUrl('');
    setIsImageEditorOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteProfileImage = () => {
    setSelectedProfileImage(null);
    setEditedProfileImageData(null);
    setRemoveProfileImage(true);
    setProfilePreviewUrl('');
    setEditorImageUrl('');
    setIsImageEditorOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    profileMutation.mutate({
      removeProfileImage: true,
      profileImage: null,
      profileImageData: null,
    });
  };

  const openCurrentProfileImageEditor = () => {
    const source = editedProfileImageData || selectedProfileImage || (!removeProfileImage ? currentProfileImage : null);
    if (source) {
      openImageEditor(source);
      return;
    }

    fileInputRef.current?.click();
  };

  const profileFieldsDirty = !isPasswordPage && (
    profile.firstName.trim() !== initialProfileValues.firstName.trim() ||
    profile.middleName.trim() !== initialProfileValues.middleName.trim() ||
    profile.lastName.trim() !== initialProfileValues.lastName.trim() ||
    profile.email.trim() !== initialProfileValues.email.trim() ||
    profile.phoneNumber.trim() !== initialProfileValues.phoneNumber.trim()
  );

  const profileImageDirty = !isPasswordPage && Boolean(
    selectedProfileImage ||
    editedProfileImageData ||
    removeProfileImage
  );

  const passwordFieldsDirty = isPasswordPage && Boolean(
    pwForm.currentPassword ||
    pwForm.newPassword ||
    pwForm.confirmPassword
  );

  const isDirty = isPasswordPage
    ? Boolean(passwordFieldsDirty)
    : Boolean(profileFieldsDirty || profileImageDirty);

  const saveChangesRef = useRef<() => Promise<boolean>>(async () => false);
  const discardChangesRef = useRef<() => void>(() => {});

  saveChangesRef.current = async () => {
    if (isPasswordPage) {
      if (!validatePassword()) return false;
      try {
        await passwordMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    }

    if (!validateProfile()) return false;
    try {
      await profileMutation.mutateAsync({});
      return true;
    } catch {
      return false;
    }
  };

  discardChangesRef.current = () => {
    if (isPasswordPage) {
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwErrors({});
      setShowPw(false);
      return;
    }

    setProfile(initialProfileValues);
    discardProfileImageChanges();
  };

  const saveChanges = useCallback(() => saveChangesRef.current(), []);
  const discardChanges = useCallback(() => discardChangesRef.current(), []);

  useBeforeUnload((event) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  useEffect(() => {
    if (!isDirty) {
      setGuard(null);
      return;
    }

    setGuard({
      isDirty: true,
      saveChanges,
      discardChanges,
    });
  }, [discardChanges, isDirty, saveChanges, setGuard]);

  useEffect(() => () => {
    setGuard(null);
  }, [setGuard]);

  useEffect(() => {
    setShowPw(false);
    setPwErrors({});
  }, [isPasswordPage]);

  return (
    <div className="s-updateprofil-245770">
      <h5 className="s-updateprofil-e41087">
        {isPasswordPage ? 'Change Password' : 'My Profile'}
      </h5>

      {!isPasswordPage ? (
        <div className="s-updateprofil-3d6779">
          <div className="s-updateprofil-246fef" style={{ marginBottom: 24 }}>
            <label className="s-addressform-f1fb64">Profile Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', padding: '18px', border: '1px solid var(--ivory)', borderRadius: 14, background: 'var(--ivory)' }}>
              <UserAvatar
                name={profile.firstName || profile.email || 'User'}
                imageUrl={profilePreviewUrl}
                size={88}
                fallbackMode="initial"
                className="s-updateprofil-avatar"
              />
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>
                  Edit the current image, or upload a new one before saving
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--heirloom)' }}>
                  JPG, PNG, WEBP up to 5MB. Drag inside editor to move crop area.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleProfileImageChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={openCurrentProfileImageEditor}
                    className="s-updateprofil-7be3db"
                    style={{ width: 'auto', padding: '10px 18px' }}
                  >
                    Edit Image
                  </button>
                  {(selectedProfileImage || editedProfileImageData || removeProfileImage) && (
                    <>
                      <button type="button" onClick={discardProfileImageChanges} style={secondaryBtnStyle}>
                        Cancel Changes
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isImageEditorOpen && (
            <div style={{ marginBottom: 24, border: '1px solid #eadce1', borderRadius: 14, padding: 16, background: '#fff' }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>
                Crop and Edit Profile Image
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '0 0 320px' }}>
                  <canvas
                    ref={editorCanvasRef}
                    width={320}
                    height={320}
                    onPointerDown={onEditorPointerDown}
                    onPointerMove={onEditorPointerMove}
                    onPointerUp={onEditorPointerUp}
                    onPointerCancel={onEditorPointerUp}
                    style={{ width: 320, height: 320, borderRadius: 12, border: '1px solid #e2d4d9', touchAction: 'none', cursor: 'grab' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 10 }}>
                  <label style={{ fontSize: 13, color: 'var(--heirloom)' }}>
                    Zoom
                    <input type="range" min={1} max={3} step={0.01}
                      value={editorState.zoom}
                      onChange={(e) => setEditorState((prev) => ({ ...prev, zoom: Number(e.target.value) }))}
                      style={{ width: '100%' }} />
                  </label>
                  <label style={{ fontSize: 13, color: 'var(--heirloom)' }}>
                    Rotate
                    <input type="range" min={-180} max={180} step={1}
                      value={editorState.rotation}
                      onChange={(e) => setEditorState((prev) => ({ ...prev, rotation: Number(e.target.value) }))}
                      style={{ width: '100%' }} />
                  </label>
                  <label style={{ fontSize: 13, color: 'var(--heirloom)' }}>
                    Brightness
                    <input type="range" min={50} max={150} step={1}
                      value={editorState.brightness}
                      onChange={(e) => setEditorState((prev) => ({ ...prev, brightness: Number(e.target.value) }))}
                      style={{ width: '100%' }} />
                  </label>
                  <label style={{ fontSize: 13, color: 'var(--heirloom)' }}>
                    Contrast
                    <input type="range" min={50} max={150} step={1}
                      value={editorState.contrast}
                      onChange={(e) => setEditorState((prev) => ({ ...prev, contrast: Number(e.target.value) }))}
                      style={{ width: '100%' }} />
                  </label>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={secondaryBtnStyle}>Upload</button>
                    <button type="button" onClick={deleteProfileImage} style={secondaryBtnStyle}>Delete</button>
                    <button type="button" onClick={resetEditor} style={secondaryBtnStyle}>Reset</button>
                    <button type="button" onClick={closeImageEditor} style={secondaryBtnStyle}>Close</button>
                    <button type="button" onClick={applyImageEdit} className="s-updateprofil-7be3db" style={{ width: 'auto', padding: '10px 18px' }}>
                      Apply Crop/Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
            onClick={() => validateProfile() && profileMutation.mutate({})}
            disabled={profileMutation.isPending}
            className="s-updateprofil-7be3db">
            {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
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
            {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      )}
    </div>
  );
}
