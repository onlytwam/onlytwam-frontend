// AdminReports.tsx — Fixed:
// - Pagination: 'Page.Size' not 'page.pageSize'
// - order: 'Order.Property' / 'Order.Ascending' not 'order.property'
// - Uses /Orders/AdminList for admin view

import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';

function ReportCard({ title, value, icon, color: _color, sub }: any) {
  return (
    <div className="s-adminreports-ae3483">
      <div className="s-adminreports-b3de5e">
        <div>
          <p className="s-adminreports-dd9dc5">{title}</p>
          <h3 className="s-admininvento-99662a">{value}</h3>
          {sub && <p className="s-adminreports-4663ee">{sub}</p>}
        </div>
        <div className="s-adminreports-0e6d5e s-adminreports-15c150">
          <i className={`bi ${icon} s-adminreports-e79899`} />
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
    Delivered: 'var(--brand)', Pending: 'var(--brand)', Processing: 'var(--brand)',
    Shipped: 'var(--brand)',  Cancelled: 'var(--brand)', Refunded: 'var(--brand)',
    'Return Initiated': 'var(--brand)', Returned: 'var(--brand)', Confirmed: 'var(--brand)',
  };

  return (
    <div>
      <div className="s-adminblog-19fd7a">
        <h2 className="s-adminblog-91c675">Reports & Analytics</h2>
        <p className="s-adminblog-1c2c10">Business performance overview</p>
      </div>

      {/* KPI Cards */}
      <div className="s-adminreports-e38261">
        <ReportCard title="Total Revenue"   value={formatPrice(totalRevenue)} icon="bi-currency-rupee" color="var(--brand)" sub="All orders" />
        <ReportCard title="Total Orders"    value={ordersData?.count || 0}    icon="bi-bag-check"      color="var(--brand)" sub="All time" />
        <ReportCard title="Avg Order Value" value={formatPrice(avgOrderValue)} icon="bi-graph-up"      color="var(--brand)" sub="Per order" />
        <ReportCard title="Delivered"       value={deliveredOrders}           icon="bi-check-circle"   color="var(--brand)" sub="Successfully fulfilled" />
        <ReportCard title="Pending"         value={pendingOrders}             icon="bi-clock"          color="var(--brand)" sub="Need attention" />
        <ReportCard title="Cancelled"       value={cancelledOrders}           icon="bi-x-circle"       color="var(--brand)" sub="Lost revenue" />
        <ReportCard title="Returns"         value={returnedOrders}            icon="bi-arrow-return-left" color="var(--brand)" sub="Return initiated/completed" />
        <ReportCard title="Total Products"  value={productsData?.count || 0}  icon="bi-box-seam"       color="var(--brand)" sub="In catalogue" />
      </div>

      {/* Status breakdown chart */}
      {orders.length > 0 && (
        <div className="s-adminreports-7f40c7">
          <h3 className="s-adminreports-e49d2d">Orders by Status</h3>
          <div className="s-adminblog-b43398">
            {Object.entries(statusGroups)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([status, count]) => (
                <div key={status} className="s-adminreports-25c771">
                  <span className="s-adminreports-00b957">{status}</span>
                  <div className="s-adminreports-860ce5">
                    <div className="s-adminreports-31c600" style={{ width: `${((count as number) / orders.length) * 100}%`, background: STATUS_COLORS[status] || 'var(--heirloom)' }} />
                  </div>
                  <span className="s-adminreports-0d29c7">{count as number}</span>
                  <span className="s-adminreports-242df6">({Math.round(((count as number) / orders.length) * 100)}%)</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Revenue table of recent orders */}
      {orders.length > 0 && (
        <div className="s-adminreports-bc1d99">
          <div className="s-adminreports-544a5c">
            <h3 className="s-adminblog-ffb607">Recent Orders Summary</h3>
          </div>
          <div className="s-admindashboa-ce7380">
            <table className="s-adminbrands-de3642">
              <thead>
                <tr className="s-adminbrands-1ba202">
                  {['Order #', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="s-adminbrands-84e069">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((o: any) => (
                  <tr key={o.orderId} className="s-adminbrands-59d787">
                    <td className="s-adminreports-552526">#{o.orderNumber || o.orderId}</td>
                    <td className="s-adminbrands-c25a6e">{formatPrice(o.totalAmount || 0)}</td>
                    <td className="s-adminbrands-7dcd2c">
                      <span className="s-adminreports-b87ad1" style={{ background: (STATUS_COLORS[o.state] || 'var(--heirloom)') + '20', color: STATUS_COLORS[o.state] || 'var(--heirloom)' }}>
                        {o.state || 'Pending'}
                      </span>
                    </td>
                    <td className="s-adminreports-15b77f">
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
