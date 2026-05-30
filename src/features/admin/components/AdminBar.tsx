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
    <div className="s-adminbar-5bb105">
      <div className="s-adminbar-877368">
        <i className="bi bi-shield-fill s-addresslist-92985e" />
        <span>You are browsing as <strong>{getUserName()}</strong> (Admin view)</span>
      </div>
      <button
        onClick={goBack}
        className="s-adminbar-7a3f93">
        <i className="bi bi-arrow-left" /> Back to Admin Panel
      </button>
    </div>
  );
}
