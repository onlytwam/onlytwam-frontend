// src/pages/returns/ReturnOrder.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listOrders } from '@/features/orders/api/orders.api';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatDate } from '@/shared/utils/helpers';

export default function ReturnOrder() {
  const navigate = useNavigate();
  const { getUserId } = useAuthStore();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItem] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['returnable-orders'],
    queryFn: () => listOrders({ userProfileId: getUserId(), status: 'Delivered' }),
    select: (d: any) => d?.list ?? d ?? [],
  });

  const orders = data ?? [];

  const handleNext = () => {
    if (!selectedOrder) return;
    sessionStorage.setItem('returnOrder', JSON.stringify({ orderId: selectedOrder.orderId, orderNumber: selectedOrder.orderNumber, selectedItem }));
    navigate('/user-products/return-reason');
  };

  return (
    <div className="container s-returnorder-027ed1">
      <button onClick={() => navigate('/account/orders-list')}
        className="s-deliveryopti-01d82d">
        <i className="bi bi-arrow-left" /> Back to Orders
      </button>
      <h4 className="s-deliveryopti-186182">Return / Exchange</h4>
      <p className="s-deliveryopti-78aac5">Select the order you want to return.</p>

      {isLoading ? <div className="s-shippingopti-9ecba4"><div className="spinner-border text-secondary" /></div>
        : orders.length === 0 ? (
          <div className="s-returnorder-9d3d82">
            <i className="bi bi-bag-x s-adminproduct-8eb3fc" />
            <p>No delivered orders eligible for return.</p>
          </div>
        ) : orders.map((order: any) => (
          <div key={order.orderId}
            onClick={() => setSelectedOrder(order)}
            className="s-returnorder-2d54f4" style={ {border: `2px solid ${selectedOrder?.orderId === order.orderId ? '#000000' : 'var(--ivory)'}`} }>
            <div className="s-userdashboar-474527">
              <span className="s-returnorder-e0cfe6">Order #{order.orderNumber || order.orderId}</span>
              <span className="s-adminnewslet-f01220">{formatDate(order.orderDate || order.createdAt)}</span>
            </div>
            {(order.orderItems || order.items || []).slice(0, 2).map((item: any, i: number) => (
              <p key={i} className="s-userdashboar-bc8be4">{item.productName || item.name} × {item.quantity}</p>
            ))}
          </div>
        ))}

      <button onClick={handleNext} disabled={!selectedOrder}
        className="s-returnorder-35f367" style={ {cursor: selectedOrder ? 'pointer' : 'not-allowed', opacity: selectedOrder ? 1 : 0.5} }>
        Continue <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
