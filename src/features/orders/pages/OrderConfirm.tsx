// Fixed: removed unused `navigate` (ts6133) — navigation done via <Link> instead
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/features/orders/api/orders.api';
import { useCartStore } from '@/features/cart/store/cartStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatDate } from '@/shared/utils/helpers';

export default function OrderConfirm() {
  const { id } = useParams<{ id: string }>();
  const { clearCart } = useCartStore();
  const { setCartCount } = useAuthStore();

  // Clear cart on mount — order has been placed
  useEffect(() => {
    clearCart();
    setCartCount(0);
    localStorage.removeItem('guestCart');
  }, []);

  const { data: order } = useQuery({
    queryKey: ['order-confirm', id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id && id !== 'new',
    retry: false,
  });

  return (
    <div className="container" style={{ padding: '60px 16px', maxWidth: 600, textAlign: 'center' }}>

      {/* Success icon */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
        border: '3px solid #16a34a',
      }}>
        <i className="bi bi-check-lg" style={{ fontSize: 36, color: '#16a34a' }} />
      </div>

      <h2 style={{ marginBottom: 8, fontWeight: 700 }}>Order Placed!</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Thank you for shopping with Only TWAM. Your order has been received and is being processed.
      </p>

      {/* Order summary card */}
      {order && (
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Order Number</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>#{(order as any).orderNumber || id}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Order Date</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                {formatDate((order as any).orderDate || (order as any).createdAt)}
              </p>
            </div>
          </div>

          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: '#666' }}>Total Amount</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                ₹{((order as any).totalAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            {(order as any).deliveryCharge !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 13, color: '#888' }}>Shipping</span>
                <span style={{ fontSize: 13 }}>
                  {(order as any).deliveryCharge === 0 ? 'FREE' : `₹${(order as any).deliveryCharge}`}
                </span>
              </div>
            )}
          </div>

          {(order as any).shippingAddress && (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>Delivering to</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                <strong>{(order as any).shippingAddress.name}</strong>
                {' · '}
                {(order as any).shippingAddress.city}, {(order as any).shippingAddress.state}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Email notice */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          <i className="bi bi-envelope me-2" />
          A confirmation email will be sent to your registered email address.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          to="/account/orders-list"
          style={{ background: '#111', color: '#fff', padding: '12px 24px', borderRadius: 4, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          <i className="bi bi-bag me-2" />Track Order
        </Link>
        {id && id !== 'new' && (
          <Link
            to={`/user-products/invoice-details/${id}`}
            style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '12px 24px', borderRadius: 4, textDecoration: 'none', fontSize: 14 }}>
            <i className="bi bi-file-earmark-text me-2" />View Invoice
          </Link>
        )}
        <Link
          to="/"
          style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '12px 24px', borderRadius: 4, textDecoration: 'none', fontSize: 14 }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}