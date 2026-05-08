import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api").replace("/api", "")
  .replace(/\/$/, "");
const FILTERS = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded', 'Return Initiated', 'Returned', 'Failed'];

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Delivered: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Pending: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Processing: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Shipped: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Cancelled: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Refunded: { bg: 'var(--ivory)', color: 'var(--brand)' },
  'Return Initiated': { bg: 'var(--ivory)', color: 'var(--brand)' },
  Returned: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Confirmed: { bg: 'var(--ivory)', color: 'var(--brand)' },
  Failed: { bg: 'var(--ivory)', color: 'var(--brand)' },
};

const PAGE_SIZE = 15;

export default function AdminOrders() {
  const qc = useQueryClient();

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  // ✅ Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // ✅ Build params correctly
  const buildParams = useCallback(() => {
    const params: Record<string, any> = {
      'Page.Index': page,
      'Page.Size': PAGE_SIZE,
      'Order.Property': 'OrderDate',
      'Order.Ascending': false,
    };

    const filters: any[] = [];

    if (filter !== 'All') {
      filters.push({
        property: 'State',
        comparison: '==',
        value: filter,
      });
    }

    if (debouncedSearch.trim()) {
      filters.push({
        property: 'QuickSearch',
        comparison: 'contains',
        value: debouncedSearch.trim(),
      });
    }

    if (filters.length) {
      params['Filters'] = JSON.stringify(filters); // ✅ IMPORTANT FIX
    }

    return params;
  }, [filter, debouncedSearch, page]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', filter, debouncedSearch, page],
    queryFn: () =>
      api.get('/Orders/AdminList', { params: buildParams() }).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ orderId, state }: { orderId: string; state: string }) => {
      if (state === 'Cancelled') {
        return api.post('/Orders/CancelOrder', {
          orderId,
          isRefund: false,
          reason: 'Admin cancellation',
        });
      }
      return api.put('/Orders/UpdateStatus', { orderId, state });
    },
    onSuccess: (_data, variables) => {
      toast.success('Order status updated!');

      setSelected((prev: any) =>
        prev ? { ...prev, state: variables.state } : prev
      );

      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      refetch();
    },
    onError: () => toast.error('Failed to update status'),
  });

  const orders = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const badge = (state: string) => (
    <span className="s-adminorders-3cbcde s-adminorders-28616f">
      {state || 'Pending'}
    </span>
  );

  return (
    <div>
      {/* Header + search */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Orders</h2>
          <p className="s-adminblog-1c2c10">{total} total orders</p>
        </div>
        <input
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search order #, customer…"
          className="s-adminorders-86fe52"
        />
      </div>

      {/* Status filter tabs */}
      <div className="s-adminorders-6ddedd">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className="s-adminorders-ffb22a"
            style={{
              border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--ivory)'}`,
              background: filter === f ? 'var(--brand)' : '#fff',
              color: filter === f ? '#fff' : 'var(--heirloom)',
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f}
          </button>
        ))}
      </div>
      {/* Table */}
      <div className="s-adminbrands-a637bc">
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {['Order #', 'Customer', 'Items', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="s-admininvento-947fb4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="s-adminorders-652ef8">
                      <div className="s-adminorders-ac15d0" />
                    </td>
                  </tr>
                ))
                : orders.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="s-admininvento-2925c8">
                        <i className="bi bi-bag-x s-adminorders-9fdb4f" /> No orders found
                      </td>
                    </tr>
                  )
                  : orders.map((order: any) => (
                    <tr
                      key={order.orderId}
                      className="s-adminbrands-59d787"
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ivory)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="s-adminorders-0359e2">#{order.orderNumber || order.orderId}</td>

                      <td className="s-adminorders-428224">
                        <div className="s-adminorders-0728c5">{order.address?.name || '—'}</div>
                      </td>
                      <td className="s-adminorders-2d9718">{order.orderItems?.length ?? '—'}</td>
                      <td className="s-adminorders-04b8c3">{formatPrice(order.totalAmount || 0)}</td>
                      <td className="s-adminorders-428224">{badge(order.state)}</td>
                      <td className="s-adminorders-d76599">
                        {order.orderDate
                          ? new Date(order.orderDate).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td className="s-adminorders-428224">
                        <button
                          onClick={() => setSelected(order)}
                          className="s-adminorders-1af559"
                        >
                          <i className="bi bi-eye me-1" /> View Order
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="s-adminorders-0fe0c2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="s-adminorders-c67f5e"
              style={{ background: page === 1 ? 'var(--ivory)' : '#fff' }}
            >
              ← Prev
            </button>
            <span className="s-adminorders-caf6f2">Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
              className="s-adminorders-c67f5e"
              style={{ background: page >= pages ? 'var(--ivory)' : '#fff' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Status update modal */}
      {/* Status update modal */}
      {selected && (
        <div
          className="s-adminorders-d4682b"
          onClick={() => setSelected(null)}
        >
          <div
            className="s-adminorders-dadf17"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="s-adminorders-83a233">
              <h3 className="s-adminorders-18f7bb">
                Order #{selected.orderNumber || selected.orderId}
              </h3>
              <button onClick={() => setSelected(null)} className="s-adminorders-90ae21">×</button>
            </div>

            <p className="s-adminorders-253bda">Current: {badge(selected.state)}</p>

            {/* ── Order Items Table ── */}
            {selected.orderItems?.length > 0 ? (
              <div style={{ marginBottom: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--ivory)' }}>
                      {['Image', 'Product', 'Brand', 'Color', 'Size', 'Cup Size', 'SKU', 'Qty', 'Price'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--heirloom)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.orderItems.map((item: any, i: number) => (
                      <tr key={item.orderItemId || i} style={{ borderBottom: '1px solid var(--ivory)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          {item.productImage ? (
                            <img
                              src={item.productImage?.startsWith("http")
                                ? item.productImage
                                : `${BASE_URL}/${item.productImage?.replace(/^\//, "")}`} alt={item.productName}
                              style={{ width: 44, height: 52, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ivory)' }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 52, background: 'var(--ivory)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="bi bi-image" style={{ color: '#ccc' }} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--heirloom)', maxWidth: 140 }}>
                          {item.productName || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#888' }}>
                          {item.brandName || '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>{item.color || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{item.size || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{item.cupSize || '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
                          {item.sku || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--brand)', whiteSpace: 'nowrap' }}>
                          {formatPrice(item.price || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--ivory)' }}>
                      <td colSpan={8} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                        Total
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--brand)' }}>
                        {formatPrice(selected.totalAmount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>No items found for this order.</p>
            )}

            {/* Status Buttons */}
            <div className="s-adminorders-2af484">
              {['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'].map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus.mutate({ orderId: selected.orderId, state: s })}
                  disabled={updateStatus.isPending || selected.state === s}
                  className="s-adminorders-642033"
                  style={{
                    border: `1px solid ${STATUS_COLOR[s]?.color || 'var(--ivory)'}`,
                    color: STATUS_COLOR[s]?.color || '#000',
                    opacity: selected.state === s ? 0.4 : 1,
                    cursor: selected.state === s ? 'not-allowed' : 'pointer',
                  }}
                >

                  {updateStatus.isPending && updateStatus.variables?.state === s ? '…' : s}
                </button>

              ))}
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

