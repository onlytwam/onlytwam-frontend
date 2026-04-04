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
    if (qty === 0) return { label: 'Out of Stock', bg: 'var(--ivory)', color: 'var(--brand)' };
    if (qty < 10)  return { label: 'Low Stock',    bg: 'var(--ivory)', color: 'var(--brand)' };
    return              { label: 'In Stock',       bg: 'var(--ivory)', color: 'var(--brand)' };
  };

  return (
    <div>
      <div className="s-adminblog-19fd7a">
        <h2 className="s-adminblog-91c675">Inventory Analytics</h2>
        <p className="s-adminblog-1c2c10">Track stock levels across all product variants</p>
      </div>

      {/* Summary cards */}
      <div className="s-admininvento-8801e6">
        {[
          { title: 'Total Variants', value: total,                              icon: 'bi-box-seam',             color: 'var(--brand)' },
          { title: 'Low Stock',      value: lowStock,                           icon: 'bi-exclamation-triangle', color: 'var(--brand)' },
          { title: 'Out of Stock',   value: outOfStock,                         icon: 'bi-x-circle',             color: 'var(--brand)' },
          { title: 'In Stock',       value: total - lowStock - outOfStock,      icon: 'bi-check-circle',         color: 'var(--brand)' },
        ].map(card => (
          <div key={card.title} className="s-admininvento-3f01df">
            <div className="s-admininvento-69f9d2">
              <div>
                <p className="s-admininvento-b153ec">{card.title}</p>
                <h3 className="s-admininvento-99662a">{card.value}</h3>
              </div>
              <i className={`bi ${card.icon} s-admindashboa-e17804 s-admininvento-85152d`} />
            </div>
          </div>
        ))}
      </div>

      {/* Inventory table */}
      <div className="s-adminbrands-a637bc">
        <div className="s-admininvento-19cca5">
          <h3 className="s-adminblog-ffb607">Product Variants — Stock Levels</h3>
          <span className="s-adminnewslet-f01220">Showing {items.length} of {total}</span>
        </div>
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {['Product', 'Variant', 'Size', 'MRP', 'Final Price', 'Stock', 'Status'].map(h => (
                  <th key={h} className="s-admininvento-947fb4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <tr><td colSpan={7} className="s-admininvento-06b8df"><div className="spinner-border text-secondary" /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={7} className="s-admininvento-2925c8">No inventory data found.</td></tr>
                  : items.map((item: any, i: number) => {
                    const qty = item.stockQuantity ?? item.availableQuantity ?? 0;
                    const sl  = stockLevel(qty);
                    return (
                      <tr key={i} className="s-adminbrands-59d787"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ivory)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="s-admindashboa-004ec1">{item.productName || item.name || '—'}</td>
                        <td className="s-admindashboa-76859f">{item.variantName || item.color || '—'}</td>
                        <td className="s-admindashboa-76859f">{item.sizeLabel || item.size || '—'}</td>
                        <td className="s-admindashboa-76859f">{item.mrpPrice ? formatPrice(item.mrpPrice) : '—'}</td>
                        <td className="s-admindashboa-004ec1">{item.finalPrice ? formatPrice(item.finalPrice) : '—'}</td>
                        <td className="s-admininvento-192c9d s-admininvento-14b4f2">{qty}</td>
                        <td className="s-admindashboa-f5f90c">
                          <span className="s-admindashboa-dbacab s-admininvento-3e3854">{sl.label}</span>
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
