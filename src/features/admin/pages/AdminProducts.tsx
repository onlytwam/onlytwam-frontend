// Fixed:
// - /Product → /Products
// - Pagination: Page.Index / Page.Size
// - Filter format: JSON Filters param

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import toast from 'react-hot-toast';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Approved:  { bg: '#e8f5e9', color: '#2e7d32' },
  Pending:   { bg: '#fff3e0', color: '#e65100' },
  Draft:     { bg: '#f5f5f5', color: '#555' },
  Rejected:  { bg: '#ffebee', color: '#c62828' },
  'Submitted To Inventory Manager': { bg: '#e3f2fd', color: '#1565c0' },
  'Submitted To Product Manager':   { bg: '#f3e5f5', color: '#6a1b9a' },
  Created:   { bg: '#e3f2fd', color: '#1565c0' },
  Modified:  { bg: '#fff3e0', color: '#e65100' },
};

const STATUS_OPTIONS = ['All', 'Approved', 'Pending', 'Draft', 'Created', 'Modified', 'Rejected', 'Submitted To Inventory Manager'];
const PAGE_SIZE = 15;

export default function AdminProducts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatus]   = useState('All');
  const [confirmDelete, setConfirm] = useState<any>(null);

  // FIX: correct filter format + pagination params
  const buildParams = () => {
    const filters: any[] = [];
    if (search.trim())         filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
    if (statusFilter !== 'All') filters.push({ property: 'State', comparison: '==', value: statusFilter });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      'Page.Index':    page,
      'Page.Size':     PAGE_SIZE,
      'Order.Property':  'ModifiedDate',
      'Order.Ascending': false,
    };
  };

  // FIX: /Products not /Product
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', search, page, statusFilter],
    queryFn:  () => api.get('/Products', { params: buildParams() }).then(r => r.data),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/Products/${id}`),
    onSuccess:  () => { toast.success('Product deleted'); qc.invalidateQueries({ queryKey: ['admin-products'] }); setConfirm(null); },
    onError:    () => toast.error('Failed to delete'),
  });

  const updateState = useMutation({
    mutationFn: ({ id, state }: any) => api.put(`/Products/${id}`, { state }),
    onSuccess:  () => { toast.success('Status updated!'); qc.invalidateQueries({ queryKey: ['admin-products'] }); },
    onError:    () => toast.error('Failed to update'),
  });

  const products = data?.list ?? [];
  const total    = data?.count ?? 0;
  const pages    = Math.ceil(total / PAGE_SIZE);

  const badge = (state: string) => {
    const s = STATUS_STYLE[state] || { bg: '#f5f5f5', color: '#555' };
    return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{state || 'Draft'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Products</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} products total</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/products/new')}
            style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products…"
            style={{ padding: '9px 14px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: 200 }} />
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, cursor: 'pointer', outline: 'none', background: '#fff' }}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                {['Image', 'Name', 'Code', 'Brand', 'Category', 'Status', 'Actions'].map(h => (
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
                : products.length === 0
                  ? <tr><td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#aaa' }}>
                    <i className="bi bi-box-seam" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />No products found
                  </td></tr>
                  : products.map((p: any) => (
                    <tr key={p.productId} style={{ borderBottom: '1px solid #f5f5f5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 16px' }}>
                        <img src={p.image || p.selectedImage} alt={p.name}
                          style={{ width: 48, height: 56, objectFit: 'cover', borderRadius: 6, background: '#f5f5f5' }}
                          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div onClick={() => navigate(`/admin/products/${p.productId}`)}
                          style={{ fontWeight: 600, color: '#6A012A', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#555', fontFamily: 'monospace' }}>{p.productCode || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>{p.brandName || p.brand || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>{p.categoryName || '—'}</td>
                      <td style={{ padding: '10px 16px' }}>{badge(p.state)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => navigate(`/admin/products/${p.productId}`)}
                            style={{ background: '#f0f0f0', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          {p.state !== 'Approved' && (
                            <button onClick={() => updateState.mutate({ id: p.productId, state: 'Approved' })}
                              style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✓</button>
                          )}
                          <button onClick={() => setConfirm(p)}
                            style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
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
              style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
            <span style={{ padding: '6px 14px', fontSize: 13 }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', color: '#c62828' }}>Delete Product</h3>
            <p style={{ color: '#555', marginBottom: 20 }}>Delete <strong>"{confirmDelete.name}"</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteProduct.mutate(confirmDelete.productId)}
                disabled={deleteProduct.isPending}
                style={{ flex: 1, background: '#c62828', color: '#fff', border: 'none', padding: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                {deleteProduct.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirm(null)}
                style={{ flex: 1, background: '#f5f5f5', color: '#333', border: 'none', padding: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
