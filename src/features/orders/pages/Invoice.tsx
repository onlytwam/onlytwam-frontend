// ─── Invoice.tsx ──────────────────────────────────────────────────────────────
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/features/orders/api/orders.api';
import { formatDate, formatPrice } from '@/shared/utils/helpers';

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner-border text-secondary" /></div>;
  if (!order) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Invoice not found.</div>;

  const handlePrint = () => window.print();

  return (
    <div className="container" style={{ padding: '32px 16px', maxWidth: 700 }}>
      <div id="invoice-print">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" style={{ height: 40, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Only TWAM — It's all about you</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h5 style={{ margin: 0, fontWeight: 700 }}>INVOICE</h5>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>#{order.orderNumber || id}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Date: {formatDate(order.orderDate || order.createdAt)}</p>
          </div>
        </div>

        {/* Addresses */}
        {order.shippingAddress && (
          <div style={{ marginBottom: 24 }}>
            <h6 style={{ marginBottom: 8 }}>Bill / Ship To</h6>
            <p style={{ margin: 0, fontWeight: 600 }}>{order.shippingAddress.name}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
              {[order.shippingAddress.addressLine, order.shippingAddress.locality, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pinCode].filter(Boolean).join(', ')}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#555' }}>{order.shippingAddress.phone}</p>
          </div>
        )}

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#111', color: '#fff' }}>
              {['Product', 'Size', 'Qty', 'Price', 'Total'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(order.orderItems || order.items || []).map((item: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.productName || item.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#666' }}>{item.size || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>₹{(item.price || 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>₹{((item.price || 0) * item.quantity).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <table style={{ minWidth: 240 }}>
            <tbody>
              {[
                { label: 'Subtotal', value: `₹${(order.subTotal || 0).toLocaleString('en-IN')}` },
                { label: 'Tax', value: `₹${(order.taxAmount || 0).toLocaleString('en-IN')}` },
                { label: 'Shipping', value: (order.deliveryCharge || 0) === 0 ? 'FREE' : `₹${order.deliveryCharge}` },
                ...(order.couponAmount > 0 ? [{ label: 'Coupon Discount', value: `−₹${order.couponAmount}`, green: true }] : []),
              ].map(({ label, value, green }: any) => (
                <tr key={label}>
                  <td style={{ padding: '4px 12px', fontSize: 13, color: '#666' }}>{label}</td>
                  <td style={{ padding: '4px 12px', fontSize: 13, color: green ? '#16a34a' : '#111', textAlign: 'right' }}>{value}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #111' }}>
                <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 15 }}>Total</td>
                <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 15, textAlign: 'right' }}>₹{(order.totalAmount || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32 }} className="no-print">
        <button onClick={handlePrint}
          style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
          <i className="bi bi-printer me-2" />Print / Download
        </button>
        <Link to="/account/orders-list"
          style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '10px 24px', borderRadius: 4, textDecoration: 'none', fontSize: 14 }}>
          Back to Orders
        </Link>
      </div>
    </div>
  );
}
