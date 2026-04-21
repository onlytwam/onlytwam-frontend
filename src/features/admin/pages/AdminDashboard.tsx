import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';

function StatCard({ title, value, icon, color: _color, sub, onClick }: any) {
  return (
    <div onClick={onClick}
      className="s-admindashboa-2a5108" style={ {cursor: onClick ? 'pointer' : 'default'} }
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}>
      <div className="s-admindashboa-630e09">
        <div>
          <p className="s-admindashboa-2b8fb1">{title}</p>
          <h2 className="s-admindashboa-a5c846">
            {value ?? <span className="s-admindashboa-90fc99">—</span>}
          </h2>
          {sub && <p className="s-admindashboa-75a6ca">{sub}</p>}
        </div>
        <div className="s-admindashboa-571d91 s-admindashboa-c740cd">
          <i className={`bi ${icon} s-admindashboa-e17804`} />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: 'var(--brand)', Pending: 'var(--brand)', Processing: 'var(--brand)',
  Shipped: 'var(--brand)', Cancelled: 'var(--brand)',
};
const STATUS_BG: Record<string, string> = {
  Delivered: 'var(--ivory)', Pending: 'var(--ivory)', Processing: 'var(--ivory)',
  Shipped: 'var(--ivory)', Cancelled: 'var(--ivory)',
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

  const { data: productsData } = useQuery({
    queryKey: ['admin-products-dash'],
    queryFn: () => api.get('/Products/', { params: { 'Page.Size': 1 } }).then(r => r.data),
  });

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
    { label: 'Manage Orders',    icon: 'bi-bag',            path: '/admin/orders',    color: 'var(--brand)' },
    { label: 'Manage Products',  icon: 'bi-box-seam',       path: '/admin/products',  color: 'var(--brand)' },
    { label: 'Inventory Report', icon: 'bi-clipboard-data', path: '/admin/inventory', color: 'var(--brand)' },
    { label: 'View Reports',     icon: 'bi-bar-chart-line', path: '/admin/reports',   color: 'var(--brand)' },
    { label: 'Visit Store',      icon: 'bi-shop',           path: '/',                color: 'var(--brand)' },
  ];

  return (
    <div>
      <div className="s-adminnewslet-70cb1d">
        <h2 className="s-admindashboa-70466b">Dashboard Overview</h2>
        <p className="s-admindashboa-f39764">Welcome back! Here's what's happening with TWAM today.</p>
      </div>

      {/* Stats */}
      <div className="s-admindashboa-842deb">
        <StatCard title="Total Orders"   value={totalOrders}   icon="bi-bag-check"    color="var(--brand)" sub="All time"       onClick={() => navigate('/admin/orders')} />
        <StatCard title="Total Products" value={totalProducts} icon="bi-box-seam"     color="var(--brand)" sub="Published"      onClick={() => navigate('/admin/products')} />
        <StatCard title="Total Users"    value={totalUsers || '—'} icon="bi-people"   color="var(--brand)" sub="Registered"     onClick={() => navigate('/admin/users')} />
        <StatCard title="Pending Orders" value={pendingOrders} icon="bi-clock-history" color="var(--brand)" sub="Need attention" onClick={() => navigate('/admin/orders')} />
      </div>

      <div className="s-admindashboa-b8d8e2">
        {/* Recent orders table */}
        <div className="s-adminbrands-a637bc">
          <div className="s-admindashboa-112c5b">
            <h3 className="s-adminblog-ffb607">Recent Orders</h3>
            <button onClick={() => navigate('/admin/orders')}
              className="s-admindashboa-402cf0">View All →</button>
          </div>
          <div className="s-admindashboa-ce7380">
            <table className="s-adminbrands-de3642">
              <thead>
                <tr className="s-adminbrands-1ba202">
                  {['Order #', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="s-adminbrands-84e069">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0
                  ? <tr><td colSpan={5} className="s-adminbrands-3e0634">No orders yet.</td></tr>
                  : recentOrders.map((order: any) => (
                    <tr key={order.orderId} className="s-admindashboa-6fabdc"
                      onClick={() => navigate('/admin/orders')}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ivory)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="s-admindashboa-c25e1c">#{order.orderNumber || order.orderId}</td>
                      {/* Backend admin list has userProfileId but no customer name in basic list */}
                      <td className="s-admindashboa-f5f90c">{order.address?.name || '—'}</td>
                      <td className="s-admindashboa-004ec1">{formatPrice(order.totalAmount || 0)}</td>
                      <td className="s-admindashboa-f5f90c">
                        <span className="s-admindashboa-dbacab" style={{ background: STATUS_BG[order.state] || 'var(--ivory)', color: STATUS_COLORS[order.state] || 'var(--heirloom)' }}>
                          {order.state || 'Pending'}
                        </span>
                      </td>
                      <td className="s-admindashboa-76859f">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div className="s-admindashboa-d368cb">
          <h3 className="s-admindashboa-2f7b3b">Quick Actions</h3>
          <div className="s-adminblog-b43398">
            {quickLinks.map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                className="s-admindashboa-43766a"
                onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = a.color; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--ivory)'; e.currentTarget.style.borderColor = 'var(--ivory)'; }}>
                <i className={`bi ${a.icon} s-admindashboa-dbc618 s-admindashboa-8cb254`} />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
