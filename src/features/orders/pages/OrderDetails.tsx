// Fixed:
// - item.productImage not item.image
// - order.subTotal not order.subtotalAmount
// - shippingAddress has addressLine/pinCode/phone (no state string)
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/features/orders/api/orders.api';
import { formatDate, formatPrice, getImageUrl} from '@/shared/utils/helpers';
import Breadcrumb from '@/shared/components/Breadcrumb';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Delivered:  { background: '#e8f5e9', color: '#2e7d32' },
  Pending:    { background: '#fff3e0', color: '#e65100' },
  Cancelled:  { background: '#ffebee', color: '#c62828' },
  Processing: { background: '#e3f2fd', color: '#1565c0' },
  Shipped:    { background: '#f3e5f5', color: '#6a1b9a' },
  Confirmed:  { background: '#e8f5e9', color: '#1b5e20' },
  Refunded:   { background: '#e1f5fe', color: '#0277bd' },
};

export default function OrderDetails() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn:  () => getOrderDetail(Number(id)),
    enabled:  !!id,
  });

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'My Orders', path: '/account/orders-list' }, { label: 'Order Details' }]} />
      <div className="spinner-border text-secondary" />
    </div>
  );

  if (!order) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <i className="bi bi-box-seam" style={{ fontSize: 48, color: '#ddd', display: 'block', marginBottom: 16 }} />
      <h3 style={{ color: '#555' }}>Order not found</h3>
      <button onClick={() => navigate('/account/orders-list')}
        style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', marginTop: 16 }}>
        Back to Orders
      </button>
    </div>
  );

  // FIX: backend uses 'state' not 'status'
  const state       = order.state || 'Processing';
  const statusStyle = STATUS_STYLE[state] || STATUS_STYLE.Processing;

  const STEPS = [
    { label: 'Order Placed', done: true,                                                     icon: 'bi-bag-check' },
    { label: 'Confirmed',    done: ['Processing','Shipped','Delivered'].includes(state),      icon: 'bi-check-circle' },
    { label: 'Shipped',      done: ['Shipped','Delivered'].includes(state),                  icon: 'bi-truck' },
    { label: 'Delivered',    done: state === 'Delivered',                                    icon: 'bi-house-check' },
  ];

  return (
    <div className="container" style={{ padding: '32px 16px' }}>
      <nav className="mb-3" style={{ fontSize: 13, color: '#888' }}>
        <Link to="/" style={{ color: '#888', textDecoration: 'none' }}>Home</Link>
        <span className="mx-2">/</span>
        <Link to="/account/orders-list" style={{ color: '#888', textDecoration: 'none' }}>My Orders</Link>
        <span className="mx-2">/</span>
        <span className="text-dark">Order #{order.orderNumber || id}</span>
      </nav>

      <div className="row g-4">
        {/* Left — Status + summary */}
        <div className="col-md-4">
          <div className="border rounded p-4 mb-3">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, background: '#f5f5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="bi bi-bag-check" style={{ fontSize: 28, color: '#111' }} />
              </div>
              <h5 className="mb-1" style={{ fontSize: 16 }}>Order #{order.orderNumber || id}</h5>
              <p className="text-muted mb-2" style={{ fontSize: 13 }}>{formatDate(order.orderDate)}</p>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, ...statusStyle }}>
                {state}
              </span>
            </div>

            {/* Tracking */}
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {STEPS.map((step, i) => (
                <div key={step.label} style={{ position: 'relative', paddingBottom: i < STEPS.length - 1 ? 20 : 0, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flexShrink: 0, position: 'relative' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.done ? '#111' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
                      <i className={`bi ${step.icon}`} style={{ fontSize: 13, color: step.done ? '#fff' : '#aaa' }} />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ position: 'absolute', left: 13, top: 28, width: 2, height: 20, background: step.done ? '#111' : '#eee' }} />
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: step.done ? '#111' : '#aaa', fontWeight: step.done ? 500 : 400, paddingTop: 4 }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className="border rounded p-3">
            <h6 className="mb-3 fw-semibold">Order Summary</h6>
            {[
              ['Subtotal',         formatPrice(order.subTotal       || 0)],
              ['Shipping',         formatPrice(order.deliveryCharge || 0)],
              ['Tax',              formatPrice(order.taxAmount      || 0)],
              ['Coupon Discount',  order.couponAmount ? `−${formatPrice(order.couponAmount)}` : null],
            ].filter(([, v]) => v !== null).map(([label, value]) => (
              <div key={label as string} className="d-flex justify-content-between py-1" style={{ fontSize: 13 }}>
                <span className="text-muted">{label}</span>
                <span style={{ color: (label as string).includes('Discount') ? '#16a34a' : '#111', fontWeight: (label as string).includes('Discount') ? 600 : 400 }}>
                  {value}
                </span>
              </div>
            ))}
            <div className="d-flex justify-content-between pt-2 mt-1 border-top" style={{ fontSize: 16, fontWeight: 700 }}>
              <span>Total</span>
              <span>{formatPrice(order.totalAmount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Right — Items + Address */}
        <div className="col-md-8">
          <div className="border rounded p-3 mb-3">
            <h6 className="mb-3 fw-semibold">Order Items</h6>
            {(order.orderItems || []).map((item: any, i: number) => (
              <div key={i} className="d-flex gap-3 pb-3 mb-3" style={{ borderBottom: i < (order.orderItems?.length ?? 0) - 1 ? '1px solid #f5f5f5' : 'none' }}>
                {/* FIX: use item.productImage not item.image */}
                <img src={getImageUrl(item.productImage || item.image)}
                  alt={item.productName}
                  style={{ width: 70, height: 84, objectFit: 'cover', borderRadius: 6, background: '#f9f9f9', flexShrink: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                <div className="flex-fill">
                  <p className="mb-1 fw-semibold" style={{ fontSize: 14 }}>{item.productName || item.name}</p>
                  <p className="mb-1 text-muted" style={{ fontSize: 12 }}>
                    {[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`, item.cupSize && `Cup: ${item.cupSize}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mb-0" style={{ fontSize: 13 }}>
                    <span className="text-muted">Qty: {item.quantity}</span>
                    <span className="ms-3 fw-semibold">₹{item.price}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="border rounded p-3 mb-3">
              <h6 className="mb-2 fw-semibold">Delivery Address</h6>
              {/* FIX: backend AddressResponse has addressLine, pinCode, phone — no .state string */}
              <p className="mb-0 fw-semibold" style={{ fontSize: 14 }}>{order.shippingAddress.name}</p>
              <p className="mb-0 text-muted" style={{ fontSize: 13 }}>
                {order.shippingAddress.addressLine}
              </p>
              <p className="mb-0 text-muted" style={{ fontSize: 13 }}>
                {[order.shippingAddress.city, order.shippingAddress.pinCode].filter(Boolean).join(' — ')}
              </p>
              {order.shippingAddress.phone && (
                <p className="mb-0 text-muted mt-1" style={{ fontSize: 13 }}>📞 {order.shippingAddress.phone}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="d-flex gap-3 flex-wrap">
            <button onClick={() => navigate('/account/orders-list')}
              className="btn btn-dark btn-sm">← Back to Orders</button>
            {!['Delivered', 'Cancelled', 'Refunded'].includes(state) && (
              <button onClick={() => { sessionStorage.setItem('returnOrderId', String(order.orderId)); navigate('/user-products/return-order'); }}
                className="btn btn-outline-secondary btn-sm">
                Cancel / Return
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}