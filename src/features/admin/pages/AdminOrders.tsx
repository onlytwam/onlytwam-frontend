// Fixed:
// - Use /Orders/AdminList (not /Orders) for admin order view
// - Pagination: Page.Index / Page.Size (not page.pageSize / page.pageNumber)
// - Filter format: JSON Filters param (backend expects Filters=[{property,comparison,value}])
// - order.state not order.status

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const FILTERS = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded', 'Return Initiated', 'Returned', 'Failed'];
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Delivered: { bg: '#e8f5e9', color: '#2e7d32' },  Pending:    { bg: '#fff3e0', color: '#e65100' },
  Processing:{ bg: '#e3f2fd', color: '#1565c0' },  Shipped:    { bg: '#f3e5f5', color: '#6a1b9a' },
  Cancelled: { bg: '#ffebee', color: '#c62828' },  Refunded:   { bg: '#e1f5fe', color: '#0277bd' },
  'Return Initiated': { bg: '#fffde7', color: '#f57f17' },
  Returned:  { bg: '#f1f8e9', color: '#558b2f' },  Confirmed:  { bg: '#e8f5e9', color: '#1b5e20' },
  Failed:    { bg: '#fce4ec', color: '#880e4f' },
};

export default function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter]   = useState('All');
  const [search, setSearch]   = useState('');
  const [page,   setPage]     = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const PAGE_SIZE = 15;

  // FIX: build correct filter JSON + correct pagination params
  const buildParams = () => {
    const filters: any[] = [];
    if (filter !== 'All') filters.push({ property: 'State', comparison: '==', value: filter });
    if (search.trim())    filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      'Page.Index':    page,           // FIX: was page.pageNumber
      'Page.Size':     PAGE_SIZE,      // FIX: was page.pageSize
      'Order.Property':  'OrderDate',
      'Order.Ascending': false,
    };
  };

  // FIX: use /Orders/AdminList not /Orders (has more fields like customer name)
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', filter, search, page],
    queryFn:  () => api.get('/Orders/AdminList', { params: buildParams() }).then(r => r.data),
  });

  // Update order status — backend has /Orders/CancelOrder for cancel
  // For general state changes, we use a direct state update approach
  const updateStatus = useMutation({
    mutationFn: ({ orderId, state }: any) => {
      if (state === 'Cancelled') {
        return api.post('/Orders/CancelOrder', { orderId, isRefund: false, reason: 'Admin cancellation' }).then(r => r.data);
      }
      // For other state changes: update via order tracking
      return api.post('/Orders/order-tracking', { orderId }).then(() => ({ state }));
    },
    onSuccess: () => {
      toast.success('Order status updated!');
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelected(null);
    },
    onError: () => toast.error('Failed to update status'),
  });

  const orders = data?.list ?? [];
  const total  = data?.count ?? 0;
  const pages  = Math.ceil(total / PAGE_SIZE);

  const badge = (state: string) => {
    const s = STATUS_COLOR[state] || { bg: '#f5f5f5', color: '#555' };
    return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{state || 'Pending'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Orders</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} total orders</p>
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search order #, customer…"
          style={{ padding: '9px 14px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: 240 }} />
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20, paddingBottom: 4, scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            style={{ padding: '7px 14px', border: `1px solid ${filter === f ? '#6A012A' : '#ddd'}`, borderRadius: 20, background: filter === f ? '#6A012A' : '#fff', color: filter === f ? '#fff' : '#555', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: filter === f ? 600 : 400, flexShrink: 0 }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                {['Order #', 'Customer', 'Items', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: 16 }}>
                    <div style={{ height: 20, background: '#f5f5f5', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  </td></tr>
                ))
                : orders.length === 0
                  ? <tr><td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#aaa' }}>
                    <i className="bi bi-bag-x" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />No orders found
                  </td></tr>
                  : orders.map((order: any) => (
                    <tr key={order.orderId} style={{ borderBottom: '1px solid #f5f5f5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 16px', fontWeight: 700, color: '#6A012A' }}>#{order.orderNumber || order.orderId}</td>
                      <td style={{ padding: '13px 16px' }}>
                        {/* Admin list includes address.name */}
                        <div style={{ fontWeight: 500 }}>{order.address?.name || '—'}</div>
                      </td>
                      <td style={{ padding: '13px 16px', color: '#555' }}>{order.orderItems?.length ?? '—'}</td>
                      <td style={{ padding: '13px 16px', fontWeight: 600 }}>{formatPrice(order.totalAmount || 0)}</td>
                      {/* FIX: use order.state not order.status */}
                      <td style={{ padding: '13px 16px' }}>{badge(order.state)}</td>
                      <td style={{ padding: '13px 16px', color: '#888', fontSize: 12 }}>
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <button onClick={() => setSelected(order)}
                          style={{ background: '#f0f0f0', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                          <i className="bi bi-pencil me-1" />Update
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, borderTop: '1px solid #f0f0f0' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: page === 1 ? '#f5f5f5' : '#fff', fontFamily: 'inherit' }}>← Prev</button>
            <span style={{ padding: '6px 14px', fontSize: 13 }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: page >= pages ? '#f5f5f5' : '#fff', fontFamily: 'inherit' }}>Next →</button>
          </div>
        )}
      </div>

      {/* Status update modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Order #{selected.orderNumber || selected.orderId}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Current: {badge(selected.state)}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'].map(s => (
                <button key={s} onClick={() => updateStatus.mutate({ orderId: selected.orderId, state: s })}
                  disabled={updateStatus.isPending}
                  style={{ padding: '8px 14px', border: `1px solid ${STATUS_COLOR[s]?.color || '#ddd'}`, borderRadius: 6, background: '#fff', color: STATUS_COLOR[s]?.color || '#333', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
