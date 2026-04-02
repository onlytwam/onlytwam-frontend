// AdminReports.tsx — Fixed:
// - Pagination: 'Page.Size' not 'page.pageSize'
// - order: 'Order.Property' / 'Order.Ascending' not 'order.property'
// - Uses /Orders/AdminList for admin view

import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';

function ReportCard({ title, value, icon, color, sub }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#888' }}>{title}</p>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: 28, color: '#111' }}>{value}</h3>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>{sub}</p>}
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`bi ${icon}`} style={{ fontSize: 22, color }} />
        </div>
      </div>
    </div>
  );
}

export default function AdminReports() {
  // FIX: use /Orders/AdminList, correct param casing
  const { data: ordersData } = useQuery({
    queryKey: ['report-orders'],
    queryFn: () => api.get('/Orders/AdminList', {
      params: {
        'Page.Size':       100,
        'Order.Property':  'OrderDate',
        'Order.Ascending': false,
      }
    }).then(r => r.data),
  });

  // FIX: /Products not /Product
  const { data: productsData } = useQuery({
    queryKey: ['report-products'],
    queryFn: () => api.get('/Products', { params: { 'Page.Size': 1 } }).then(r => r.data),
  });

  const orders = ordersData?.list ?? [];
  const totalRevenue    = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
  // FIX: state field (not status)
  const deliveredOrders = orders.filter((o: any) => o.state === 'Delivered').length;
  const cancelledOrders = orders.filter((o: any) => o.state === 'Cancelled').length;
  const returnedOrders  = orders.filter((o: any) => o.state === 'Returned' || o.state === 'Return Initiated').length;
  const pendingOrders   = orders.filter((o: any) => o.state === 'Pending' || o.state === 'Processing').length;
  const avgOrderValue   = orders.length ? Math.round(totalRevenue / orders.length) : 0;

  const statusGroups = orders.reduce((acc: any, o: any) => {
    acc[o.state || 'Pending'] = (acc[o.state || 'Pending'] || 0) + 1;
    return acc;
  }, {});

  const STATUS_COLORS: Record<string, string> = {
    Delivered: '#2e7d32', Pending: '#e65100', Processing: '#1565c0',
    Shipped: '#6a1b9a',  Cancelled: '#c62828', Refunded: '#0277bd',
    'Return Initiated': '#f57f17', Returned: '#558b2f', Confirmed: '#1b5e20',
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Reports & Analytics</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Business performance overview</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <ReportCard title="Total Revenue"   value={formatPrice(totalRevenue)} icon="bi-currency-rupee" color="#2e7d32" sub="All orders" />
        <ReportCard title="Total Orders"    value={ordersData?.count || 0}    icon="bi-bag-check"      color="#1565c0" sub="All time" />
        <ReportCard title="Avg Order Value" value={formatPrice(avgOrderValue)} icon="bi-graph-up"      color="#6a1b9a" sub="Per order" />
        <ReportCard title="Delivered"       value={deliveredOrders}           icon="bi-check-circle"   color="#2e7d32" sub="Successfully fulfilled" />
        <ReportCard title="Pending"         value={pendingOrders}             icon="bi-clock"          color="#e65100" sub="Need attention" />
        <ReportCard title="Cancelled"       value={cancelledOrders}           icon="bi-x-circle"       color="#c62828" sub="Lost revenue" />
        <ReportCard title="Returns"         value={returnedOrders}            icon="bi-arrow-return-left" color="#f57f17" sub="Return initiated/completed" />
        <ReportCard title="Total Products"  value={productsData?.count || 0}  icon="bi-box-seam"       color="#8b5cf6" sub="In catalogue" />
      </div>

      {/* Status breakdown chart */}
      {orders.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Orders by Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(statusGroups)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 140, fontSize: 13, color: '#555', flexShrink: 0 }}>{status}</span>
                  <div style={{ flex: 1, height: 20, background: '#f5f5f5', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: STATUS_COLORS[status] || '#9ca3af', width: `${((count as number) / orders.length) * 100}%`, borderRadius: 10, transition: 'width .5s' }} />
                  </div>
                  <span style={{ width: 40, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right', flexShrink: 0 }}>{count as number}</span>
                  <span style={{ width: 40, fontSize: 12, color: '#aaa', flexShrink: 0 }}>({Math.round(((count as number) / orders.length) * 100)}%)</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Revenue table of recent orders */}
      {orders.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Orders Summary</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Order #', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((o: any) => (
                  <tr key={o.orderId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#6A012A' }}>#{o.orderNumber || o.orderId}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{formatPrice(o.totalAmount || 0)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[o.state] || '#888') + '20', color: STATUS_COLORS[o.state] || '#888' }}>
                        {o.state || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#888', fontSize: 12 }}>
                      {o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
