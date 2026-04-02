// AdminBar.tsx — Floating bar shown when an admin is browsing the store
// Appears at the top when sessionStorage.adminViewingStore === 'true'
// Disappears when the admin goes back to /admin

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';

export default function AdminBar() {
  const { isAdmin, isAuthenticated, getUserName } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show bar when admin is browsing the store (not on /admin/* routes)
    const flag     = sessionStorage.getItem('adminViewingStore') === 'true';
    const onAdmin  = location.pathname.startsWith('/admin');
    setVisible(isAuthenticated && isAdmin && flag && !onAdmin);
  }, [location.pathname, isAdmin, isAuthenticated]);

  const goBack = () => {
    sessionStorage.removeItem('adminViewingStore');
    navigate('/admin/admin-dashboard');
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#6A012A', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 20px', fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="bi bi-shield-fill" style={{ fontSize: 14 }} />
        <span>You are browsing as <strong>{getUserName()}</strong> (Admin view)</span>
      </div>
      <button
        onClick={goBack}
        style={{
          background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)',
          color: '#fff', padding: '5px 16px', borderRadius: 4,
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
        <i className="bi bi-arrow-left" /> Back to Admin Panel
      </button>
    </div>
  );
}
