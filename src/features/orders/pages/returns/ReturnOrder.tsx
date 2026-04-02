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
  const [selectedItem, setSelectedItem] = useState<any>(null);

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
    <div className="container" style={{ padding: '32px 16px', maxWidth: 640 }}>
      <button onClick={() => navigate('/account/orders-list')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="bi bi-arrow-left" /> Back to Orders
      </button>
      <h4 style={{ marginBottom: 6 }}>Return / Exchange</h4>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Select the order you want to return.</p>

      {isLoading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner-border text-secondary" /></div>
        : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            <i className="bi bi-bag-x" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            <p>No delivered orders eligible for return.</p>
          </div>
        ) : orders.map((order: any) => (
          <div key={order.orderId}
            onClick={() => setSelectedOrder(order)}
            style={{ border: `2px solid ${selectedOrder?.orderId === order.orderId ? '#111' : '#eee'}`, borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Order #{order.orderNumber || order.orderId}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{formatDate(order.orderDate || order.createdAt)}</span>
            </div>
            {(order.orderItems || order.items || []).slice(0, 2).map((item: any, i: number) => (
              <p key={i} style={{ margin: 0, fontSize: 13, color: '#555' }}>{item.productName || item.name} × {item.quantity}</p>
            ))}
          </div>
        ))}

      <button onClick={handleNext} disabled={!selectedOrder}
        style={{ marginTop: 16, width: '100%', background: '#111', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: selectedOrder ? 'pointer' : 'not-allowed', opacity: selectedOrder ? 1 : 0.5, fontWeight: 600 }}>
        Continue <i className="bi bi-arrow-right ms-1" />
      </button>
    </div>
  );
}
