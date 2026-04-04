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

  if (isLoading) return <div className="s-invoice-cf706b"><div className="spinner-border text-secondary" /></div>;
  if (!order) return <div className="s-invoice-28e22e">Invoice not found.</div>;

  const handlePrint = () => window.print();

  return (
    <div className="container s-invoice-5c9003">
      <div id="invoice-print">
        {/* Header */}
        <div className="s-invoice-841451">
          <div>
            <img src="/assets/images/Twam-Logo-Black.png" alt="TWAM" className="s-invoice-d9d21a" />
            <p className="s-admindashboa-75a6ca">Only TWAM — It's all about you</p>
          </div>
          <div className="s-quickcart-f66ceb">
            <h5 className="s-invoice-b2b6eb">INVOICE</h5>
            <p className="s-invoice-fb8e99">#{order.orderNumber || id}</p>
            <p className="s-admindashboa-75a6ca">Date: {formatDate(order.orderDate || order.createdAt)}</p>
          </div>
        </div>

        {/* Addresses */}
        {order.shippingAddress && (
          <div className="s-adminnewslet-70cb1d">
            <h6 className="s-login-e50f28">Bill / Ship To</h6>
            <p className="s-invoice-765d91">{order.shippingAddress.name}</p>
            <p className="s-userdashboar-bc8be4">
              {[order.shippingAddress.addressLine, order.shippingAddress.locality, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pinCode].filter(Boolean).join(', ')}
            </p>
            <p className="s-userdashboar-bc8be4">{order.shippingAddress.phone}</p>
          </div>
        )}

        {/* Items table */}
        <table className="s-invoice-de333d">
          <thead>
            <tr className="s-invoice-05182c">
              {['Product', 'Size', 'Qty', 'Price', 'Total'].map(h => (
                <th key={h} className="s-invoice-b29995">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(order.orderItems || order.items || []).map((item: any, i: number) => (
              <tr key={i} className="s-adminbrands-59d787">
                <td className="s-invoice-4473dd">{item.productName || item.name}</td>
                <td className="s-invoice-52bde2">{item.size || '—'}</td>
                <td className="s-invoice-4473dd">{item.quantity}</td>
                <td className="s-invoice-4473dd">₹{(item.price || 0).toLocaleString('en-IN')}</td>
                <td className="s-invoice-244c34">₹{((item.price || 0) * item.quantity).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="s-invoice-c5795d">
          <table className="s-invoice-423b00">
            <tbody>
              {[
                { label: 'Subtotal', value: `₹${(order.subTotal || 0).toLocaleString('en-IN')}` },
                { label: 'Tax', value: `₹${(order.taxAmount || 0).toLocaleString('en-IN')}` },
                { label: 'Shipping', value: (order.deliveryCharge || 0) === 0 ? 'FREE' : `₹${order.deliveryCharge}` },
                ...(order.couponAmount > 0 ? [{ label: 'Coupon Discount', value: `−₹${order.couponAmount}`, green: true }] : []),
              ].map(({ label, value, green }: any) => (
                <tr key={label}>
                  <td className="s-invoice-178719">{label}</td>
                  <td className="s-invoice-d7f350" style={ {color: green ? 'var(--brand)' : '#000000'} }>{value}</td>
                </tr>
              ))}
              <tr className="s-invoice-a5a8f6">
                <td className="s-invoice-6817f0">Total</td>
                <td className="s-invoice-e5e76a">₹{(order.totalAmount || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="s-invoice-fc3840 no-print">
        <button onClick={handlePrint}
          className="s-invoice-a6f8ad">
          <i className="bi bi-printer me-2" />Print / Download
        </button>
        <Link to="/account/orders-list"
          className="s-invoice-4ce0f5">
          Back to Orders
        </Link>
      </div>
    </div>
  );
}
