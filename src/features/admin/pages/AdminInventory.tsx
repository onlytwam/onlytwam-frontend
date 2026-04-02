// AdminInventory.tsx — Fixed: Page.Size, Page.Index, Filters JSON format
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatPrice } from '@/shared/utils/helpers';

export default function AdminInventory() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => api.get('/ProductVariantDetail/UserProductVariantDetail', {
      params: {
        // FIX: was 'page.pageSize', backend expects 'page.size'
        'page.size':       30,
        'order.property':  'ModifiedDate',
        'order.ascending': false,
        // FIX: use indexed filter format
        'filters[0].property':   'State',
        'filters[0].comparison': 'in',
        'filters[0].value':      'Approved',
      }
    }).then(r => r.data),
  });

  const items      = data?.list ?? [];
  const total      = data?.count ?? 0;
  const lowStock   = items.filter((i: any) => (i.stockQuantity ?? i.availableQuantity ?? 0) < 10 && (i.stockQuantity ?? i.availableQuantity ?? 0) > 0).length;
  const outOfStock = items.filter((i: any) => (i.stockQuantity ?? i.availableQuantity ?? 0) === 0).length;

  const stockLevel = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', bg: '#ffebee', color: '#c62828' };
    if (qty < 10)  return { label: 'Low Stock',    bg: '#fff3e0', color: '#e65100' };
    return              { label: 'In Stock',       bg: '#e8f5e9', color: '#2e7d32' };
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Inventory Analytics</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Track stock levels across all product variants</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { title: 'Total Variants', value: total,                              icon: 'bi-box-seam',             color: '#1565c0' },
          { title: 'Low Stock',      value: lowStock,                           icon: 'bi-exclamation-triangle', color: '#e65100' },
          { title: 'Out of Stock',   value: outOfStock,                         icon: 'bi-x-circle',             color: '#c62828' },
          { title: 'In Stock',       value: total - lowStock - outOfStock,      icon: 'bi-check-circle',         color: '#2e7d32' },
        ].map(card => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>{card.title}</p>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 28, color: '#111' }}>{card.value}</h3>
              </div>
              <i className={`bi ${card.icon}`} style={{ fontSize: 24, color: card.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Inventory table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Product Variants — Stock Levels</h3>
          <span style={{ fontSize: 12, color: '#888' }}>Showing {items.length} of {total}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                {['Product', 'Variant', 'Size', 'MRP', 'Final Price', 'Stock', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center' }}><div className="spinner-border text-secondary" /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#aaa' }}>No inventory data found.</td></tr>
                  : items.map((item: any, i: number) => {
                    const qty = item.stockQuantity ?? item.availableQuantity ?? 0;
                    const sl  = stockLevel(qty);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.productName || item.name || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#555' }}>{item.variantName || item.color || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#555' }}>{item.sizeLabel || item.size || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{item.mrpPrice ? formatPrice(item.mrpPrice) : '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.finalPrice ? formatPrice(item.finalPrice) : '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: sl.color }}>{qty}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sl.bg, color: sl.color }}>{sl.label}</span>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
