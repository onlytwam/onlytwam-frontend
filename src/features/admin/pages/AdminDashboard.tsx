// Fixed:
// - /Product → /Products  (backend prefix is /api/Products)
// - /UserProfile → /People  (backend prefix is /api/People)
// - Pagination params: Page.Index / Page.Size (uppercase, matching backend)
// - Orders uses /Orders/AdminList for admin view

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';

function StatCard({ title, value, icon, color, sub, onClick }: any) {
  return (
    <div onClick={onClick}
      style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 24px', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .2s' }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>{title}</p>
          <h2 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 32, color: '#111' }}>
            {value ?? <span style={{ fontSize: 20, color: '#ccc' }}>—</span>}
          </h2>
          {sub && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{sub}</p>}
        </div>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`bi ${icon}`} style={{ fontSize: 24, color }} />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#2e7d32', Pending: '#e65100', Processing: '#1565c0',
  Shipped: '#6a1b9a', Cancelled: '#c62828',
};
const STATUS_BG: Record<string, string> = {
  Delivered: '#e8f5e9', Pending: '#fff3e0', Processing: '#e3f2fd',
  Shipped: '#f3e5f5', Cancelled: '#ffebee',
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  // FIX: /Orders/AdminList for admin order view; correct pagination params
  const { data: ordersData } = useQuery({
    queryKey: ['admin-orders-dash'],
    queryFn: () => api.get('/Orders/AdminList', {
      params: { 'Page.Size': 8, 'Order.Property': 'OrderDate', 'Order.Ascending': false }
    }).then(r => r.data),
  });

  // FIX: /Products not /Product
  const { data: productsData } = useQuery({
    queryKey: ['admin-products-dash'],
    queryFn: () => api.get('/Products', { params: { 'Page.Size': 1 } }).then(r => r.data),
  });

  // FIX: /People not /UserProfile
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-dash'],
    queryFn: () => api.get('/People', { params: { 'Page.Size': 1 } }).then(r => r.data).catch(() => null),
  });

  const recentOrders   = ordersData?.list ?? [];
  const totalOrders    = ordersData?.count ?? 0;
  const totalProducts  = productsData?.count ?? 0;
  const totalUsers     = usersData?.count ?? 0;
  const pendingOrders  = recentOrders.filter((o: any) => o.state === 'Pending' || o.state === 'Processing').length;

  const quickLinks = [
    { label: 'Manage Orders',    icon: 'bi-bag',            path: '/admin/orders',    color: '#1565c0' },
    { label: 'Manage Products',  icon: 'bi-box-seam',       path: '/admin/products',  color: '#6a1b9a' },
    { label: 'Inventory Report', icon: 'bi-clipboard-data', path: '/admin/inventory', color: '#2e7d32' },
    { label: 'View Reports',     icon: 'bi-bar-chart-line', path: '/admin/reports',   color: '#e65100' },
    { label: 'Visit Store',      icon: 'bi-shop',           path: '/',                color: '#6A012A' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Dashboard Overview</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 14 }}>Welcome back! Here's what's happening with TWAM today.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard title="Total Orders"   value={totalOrders}   icon="bi-bag-check"    color="#1565c0" sub="All time"       onClick={() => navigate('/admin/orders')} />
        <StatCard title="Total Products" value={totalProducts} icon="bi-box-seam"     color="#6a1b9a" sub="Published"      onClick={() => navigate('/admin/products')} />
        <StatCard title="Total Users"    value={totalUsers || '—'} icon="bi-people"   color="#2e7d32" sub="Registered" />
        <StatCard title="Pending Orders" value={pendingOrders} icon="bi-clock-history" color="#e65100" sub="Need attention" onClick={() => navigate('/admin/orders')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 28 }}>
        {/* Recent orders table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Orders</h3>
            <button onClick={() => navigate('/admin/orders')}
              style={{ background: 'none', border: 'none', color: '#6A012A', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>View All →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Order #', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0
                  ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>No orders yet.</td></tr>
                  : recentOrders.map((order: any) => (
                    <tr key={order.orderId} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                      onClick={() => navigate('/admin/orders')}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#6A012A' }}>#{order.orderNumber || order.orderId}</td>
                      {/* Backend admin list has userProfileId but no customer name in basic list */}
                      <td style={{ padding: '12px 16px' }}>{order.address?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{formatPrice(order.totalAmount || 0)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATUS_BG[order.state] || '#f5f5f5', color: STATUS_COLORS[order.state] || '#555' }}>
                          {order.state || 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#888' }}>
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quickLinks.map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa', cursor: 'pointer', fontSize: 14, color: '#333', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = a.color; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f0f0f0'; }}>
                <i className={`bi ${a.icon}`} style={{ color: a.color, fontSize: 18, width: 20, textAlign: 'center' }} />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
