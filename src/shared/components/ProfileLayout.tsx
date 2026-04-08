import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';

const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

const navItems = [
  { path: '/account/dashboard',       label: 'Dashboard',       icon: 'bi-grid-1x2' },
  { path: '/account/update-profile',  label: 'My Profile',      icon: 'bi-person' },
  { path: '/account/orders-list',     label: 'My Orders',       icon: 'bi-bag' },
  { path: '/account/wishlist',        label: 'Wishlist',         icon: 'bi-heart' },
  { path: '/account/address-list',    label: 'Addresses',        icon: 'bi-geo-alt' },
  { path: '/account/coupons-list',    label: 'Coupons',          icon: 'bi-ticket-perforated' },
  { path: '/account/notifications',   label: 'Notifications',    icon: 'bi-bell' },
  { path: '/account/change-password', label: 'Change Password',  icon: 'bi-lock' },
];

function ProfileAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = (name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="s-profilelayou-8aef68" style={ {width: size, height: size, fontFamily: FONTS} }>
      {initials}
    </div>
  );
}

export default function ProfileLayout() {
  const { getUserName, logout, user } = useAuthStore();
  const navigate = useNavigate();
  const name  = getUserName();
  const email = (user as any)?.email || (user as any)?.emailId || '';

  return (
    <>
      <div className="container pl-wrap s-profilelayou-8cf73f">

        {/* ── Sidebar ── */}
        <aside className="pl-sidebar s-profilelayou-a63021">
          <div className="s-profilelayou-7033d5">

            {/* Header */}
            <div className="s-profilelayou-84a313">
              <div className="s-profilelayou-e33b62" />
              <div className="s-profilelayou-92f3ba">
                <ProfileAvatar name={name} size={48} />
                <div className="s-profilelayou-e10263">
                  <p className="s-profilelayou-6b87f8 s-profilelayou-ff6baedf">{name}</p>
                  {email && <p className="s-profilelayou-a4e138">{email}</p>}
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="pl-nav s-profilelayou-4eec79">
              {navItems.map(item => (
                <NavLink key={item.path} to={item.path}
                  style={({ isActive }) => ({ display:'flex', alignItems:'center', gap:10, padding:'11px 18px', textDecoration:'none', fontSize:'13.5px', color: isActive ? 'var(--brand)' : 'var(--heirloom)', background: isActive ? 'var(--ivory)' : 'transparent', borderLeft: isActive ? `3px solid var(--brand)` : '3px solid transparent', fontWeight: isActive ? 700 : 400, fontFamily: 'var(--font-body)', transition:'background .15s,color .15s' })}>
                  <i className={`bi ${item.icon} s-profilelayou-40fc0e`} />
                  {item.label}
                </NavLink>
              ))}
              <div className="s-profilelayou-a78377" />
              <button onClick={() => { logout(); navigate('/'); }}
                className="s-profilelayou-d3b202"
                onMouseEnter={e=>(e.currentTarget.style.background='var(--ivory)')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                <i className="bi bi-box-arrow-right s-profilelayou-40fc0e" /> Sign Out
              </button>
            </nav>
          </div>

          {/* Help card */}
          <div className="s-profilelayou-e6f435">
            <p className="s-profilelayou-9e4e02 s-profilelayou-ff6baedf">Need help?</p>
            <p className="s-profilelayou-331eb0">Our support team is ready to help.</p>
            <button onClick={() => navigate('/contact-us')}
              className="s-profilelayou-a17955">
              Contact Support
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="s-userdashboar-7aa8c4">
          <Outlet />
        </main>
      </div>
    </>
  );
}
