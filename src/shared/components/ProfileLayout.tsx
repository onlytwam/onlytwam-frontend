import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';

const PRI = '#6B0F2A';
const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

const navItems = [
  { path: '/account/dashboard',       label: 'Dashboard',       icon: 'bi-grid-1x2' },
  { path: '/account/update-profile',  label: 'My Profile',      icon: 'bi-person' },
  { path: '/account/orders-list',     label: 'My Orders',       icon: 'bi-bag' },
  { path: '/wishlist',                label: 'Wishlist',         icon: 'bi-heart' },
  { path: '/account/address-list',    label: 'Addresses',        icon: 'bi-geo-alt' },
  { path: '/account/coupons-list',    label: 'Coupons',          icon: 'bi-ticket-perforated' },
  { path: '/account/notifications',   label: 'Notifications',    icon: 'bi-bell' },
  { path: '/account/change-password', label: 'Change Password',  icon: 'bi-lock' },
];

function ProfileAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = (name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(255,255,255,0.25)', border: '2.5px solid rgba(255,255,255,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.34, fontWeight: 700, fontFamily: FONTS, flexShrink: 0,
    }}>
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
      <style>{`
        .pl-nav a { display:flex; align-items:center; gap:10px; padding:11px 18px; text-decoration:none; font-size:13.5px; color:#444; border-left:3px solid transparent; transition:background .15s,color .15s; font-family:inherit; }
        .pl-nav a.active { color:${PRI} !important; background:#fff5f7 !important; border-left-color:${PRI} !important; font-weight:700 !important; }
        .pl-nav a:hover:not(.active) { background:#fafafa; color:#111; }
        @media(max-width:768px){ .pl-wrap{ flex-direction:column !important; } .pl-sidebar{ position:static !important; width:100% !important; flex:unset !important; } }
      `}</style>
      <div className="container pl-wrap" style={{ padding:'32px 16px', display:'flex', gap:24, alignItems:'flex-start' }}>

        {/* ── Sidebar ── */}
        <aside className="pl-sidebar" style={{ flex:'0 0 230px', minWidth:230, position:'sticky', top:80 }}>
          <div style={{ background:'#fff', border:'1px solid #f0f0f0', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(107,15,42,.06)' }}>

            {/* Header */}
            <div style={{ background:`linear-gradient(135deg,${PRI},#A84C6B)`, padding:'22px 16px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:12, position:'relative' }}>
                <ProfileAvatar name={name} size={48} />
                <div style={{ minWidth:0 }}>
                  <p style={{ margin:0, fontWeight:700, color:'#fff', fontSize:14, fontFamily:FONTS, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</p>
                  {email && <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email}</p>}
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="pl-nav" style={{ padding:'8px 0' }}>
              {navItems.map(item => (
                <NavLink key={item.path} to={item.path}
                  style={({ isActive }) => ({ display:'flex', alignItems:'center', gap:10, padding:'11px 18px', textDecoration:'none', fontSize:'13.5px', color: isActive ? PRI : '#444', background: isActive ? '#fff5f7' : 'transparent', borderLeft: isActive ? `3px solid ${PRI}` : '3px solid transparent', fontWeight: isActive ? 700 : 400, fontFamily:'inherit', transition:'background .15s,color .15s' })}>
                  <i className={`bi ${item.icon}`} style={{ width:18, textAlign:'center', fontSize:15 }} />
                  {item.label}
                </NavLink>
              ))}
              <div style={{ height:1, background:'#f0f0f0', margin:'6px 0' }} />
              <button onClick={() => { logout(); navigate('/'); }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'11px 18px', background:'none', border:'none', cursor:'pointer', fontSize:'13.5px', color:'#e53935', borderLeft:'3px solid transparent', fontFamily:'inherit' }}
                onMouseEnter={e=>(e.currentTarget.style.background='#fff5f5')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                <i className="bi bi-box-arrow-right" style={{ width:18, textAlign:'center', fontSize:15 }} /> Sign Out
              </button>
            </nav>
          </div>

          {/* Help card */}
          <div style={{ marginTop:14, background:'#fff', border:'1px solid #f0f0f0', borderRadius:12, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}>
            <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:600, color:'#222', fontFamily:FONTS }}>Need help?</p>
            <p style={{ margin:'0 0 10px', fontSize:12, color:'#888' }}>Our support team is ready to help.</p>
            <button onClick={() => navigate('/contact-us')}
              style={{ width:'100%', background:PRI, color:'#fff', border:'none', padding:'8px 0', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
              Contact Support
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main style={{ flex:1, minWidth:0 }}>
          <Outlet />
        </main>
      </div>
    </>
  );
}