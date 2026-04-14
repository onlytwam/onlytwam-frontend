// Fixed:
// - item.productImage not item.image
// - order.subTotal not order.subtotalAmount
// - shippingAddress has addressLine/pinCode/phone (no state string)
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/features/orders/api/orders.api';
import { formatDate, formatPrice, getImageUrl} from '@/shared/utils/helpers';


export default function OrderDetails() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn:  () => getOrderDetail(Number(id)),
    enabled:  !!id,
  });

  if (isLoading) return (
    <div className="s-blog1-3b196e">
      <div className="spinner-border text-secondary" />
    </div>
  );

  if (!order) return (
    <div className="s-ourblog-f6d3dd">
      <i className="bi bi-box-seam s-orderdetails-d04b3b" />
      <h3 className="s-adminbrands-95b451">Order not found</h3>
      <button onClick={() => navigate('/account/orders-list')}
        className="s-orderdetails-beb80e">
        Back to Orders
      </button>
    </div>
  );

  // FIX: backend uses 'state' not 'status'
  const state = order.state || 'Processing';

  const STEPS = [
    { label: 'Order Placed', done: true,                                                     icon: 'bi-bag-check' },
    { label: 'Confirmed',    done: ['Processing','Shipped','Delivered'].includes(state),      icon: 'bi-check-circle' },
    { label: 'Shipped',      done: ['Shipped','Delivered'].includes(state),                  icon: 'bi-truck' },
    { label: 'Delivered',    done: state === 'Delivered',                                    icon: 'bi-house-check' },
  ];

  return (
    <div className="container s-orderdetails-c93f0f">
      <nav className="mb-3 s-quickcart-08341f">
        <Link to="/" className="s-ourstores-53c135">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/account/orders-list" className="s-ourstores-53c135">My Orders</Link>
        <span className="mx-2">/</span>
        <span className="text-dark">Order #{order.orderNumber || id}</span>
      </nav>

      <div className="row g-4">
        {/* Left — Status + summary */}
        <div className="col-md-4">
          <div className="border rounded p-4 mb-3">
            <div className="s-orderdetails-f4f4fa">
              <div className="s-orderdetails-e54aff">
                <i className="bi bi-bag-check s-orderdetails-04dff7" />
              </div>
              <h5 className="mb-1 s-userdashboar-c14ee8">Order #{order.orderNumber || id}</h5>
              <p className="text-muted mb-2 s-addresslist-9eec06">{formatDate(order.orderDate)}</p>
              <span className="s-orderdetails-070dde">
                {state}
              </span>
            </div>

            {/* Tracking */}
            <div className="s-orderdetails-8ca9d7">
              {STEPS.map((step, i) => (
                <div key={step.label} className="s-orderdetails-360e9e" style={ {paddingBottom: i < STEPS.length - 1 ? 20 : 0} }>
                  <div className="s-orderdetails-bc0a39">
                    <div className="s-orderdetails-f3412a" style={ {background: step.done ? '#000000' : 'var(--ivory)'} }>
                      <i className={`bi ${step.icon} s-orderdetails-e6a477`} style={ {color: step.done ? '#fff' : 'var(--heirloom)'} } />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="s-orderdetails-efd56e" style={ {background: step.done ? '#000000' : 'var(--ivory)'} } />
                    )}
                  </div>
                  <span className="s-orderdetails-560d09" style={ {color: step.done ? '#000000' : 'var(--heirloom)', fontWeight: step.done ? 500 : 400} }>
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
              <div key={label as string} className="d-flex justify-content-between py-1 s-addresslist-9eec06">
                <span className="text-muted">{label}</span>
                <span style={{ color: (label as string).includes('Discount') ? 'var(--heirloom)' : '#000', fontWeight: (label as string).includes('Discount') ? 600 : 400 }}>
                  {value}
                </span>
              </div>
            ))}
            <div className="d-flex justify-content-between pt-2 mt-1 border-top s-orderdetails-7b45f4">
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
              <div key={i} className="d-flex gap-3 pb-3 mb-3" style={ { borderBottom: i < (order.orderItems?.length ?? 0) - 1 ? '1px solid #f5f0e6' : 'none' } }>
                {/* FIX: use item.productImage not item.image */}
                <img src={getImageUrl(item.productImage || item.image)}
                  alt={item.productName}
                  className="s-orderdetails-3566c0"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                <div className="flex-fill">
                  <p className="mb-1 fw-semibold s-addresslist-92985e">{item.productName || item.name}</p>
                  <p className="mb-1 text-muted s-couponslist-030edf">
                    {[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`, item.cupSize && `Cup: ${item.cupSize}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mb-0 s-addresslist-9eec06">
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
              <p className="mb-0 fw-semibold s-addresslist-92985e">{order.shippingAddress.name}</p>
              <p className="mb-0 text-muted s-addresslist-9eec06">
                {order.shippingAddress.addressLine}
              </p>
              <p className="mb-0 text-muted s-addresslist-9eec06">
                {[order.shippingAddress.city, order.shippingAddress.pinCode].filter(Boolean).join(' — ')}
              </p>
              {order.shippingAddress.phone && (
                <p className="mb-0 text-muted mt-1 s-addresslist-9eec06">📞 {order.shippingAddress.phone}</p>
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
