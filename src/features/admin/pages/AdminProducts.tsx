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
  Approved:  { bg: 'var(--ivory)', color: 'var(--brand)' },
  Pending:   { bg: 'var(--ivory)', color: 'var(--brand)' },
  Draft:     { bg: 'var(--ivory)', color: 'var(--heirloom)' },
  Rejected:  { bg: 'var(--ivory)', color: 'var(--brand)' },
  'Submitted To Inventory Manager': { bg: 'var(--ivory)', color: 'var(--brand)' },
  'Submitted To Product Manager':   { bg: 'var(--ivory)', color: 'var(--brand)' },
  Created:   { bg: 'var(--ivory)', color: 'var(--brand)' },
  Modified:  { bg: 'var(--ivory)', color: 'var(--brand)' },
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
    const s = STATUS_STYLE[state] || { bg: 'var(--ivory)', color: 'var(--heirloom)' };
    return <span className="s-adminorders-3cbcde s-adminproduct-69e3b0">{state || 'Draft'}</span>;
  };

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Products</h2>
          <p className="s-adminblog-1c2c10">{total} products total</p>
        </div>
        <div className="s-adminproduct-0f6417">
          <button onClick={() => navigate('/admin/products/new')}
            className="s-adminproduct-1f0204">
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products…"
            className="s-adminproduct-def428" />
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="s-adminproduct-3cdc6b">
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="s-adminbrands-a637bc">
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {['Image', 'Name', 'Code', 'Brand', 'Category', 'Status', 'Actions'].map(h => (
                  <th key={h} className="s-admininvento-947fb4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="s-adminorders-652ef8">
                    <div className="s-adminorders-ac15d0" />
                  </td></tr>
                ))
                : products.length === 0
                  ? <tr><td colSpan={7} className="s-admininvento-2925c8">
                    <i className="bi bi-box-seam s-adminorders-9fdb4f" />No products found
                  </td></tr>
                  : products.map((p: any) => (
                    <tr key={p.productId} className="s-adminbrands-59d787"
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ivory)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="s-adminbrands-7dcd2c">
                        <img src={p.image || p.selectedImage} alt={p.name}
                          className="s-adminproduct-b1c1e9"
                          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                      </td>
                      <td className="s-adminbrands-7dcd2c">
                        <div onClick={() => navigate(`/admin/products/${p.productId}`)}
                          className="s-adminproduct-48c60a">
                          {p.name}
                        </div>
                        <div className="s-adminproduct-ee9064">{p.description}</div>
                      </td>
                      <td className="s-adminproduct-4d12db">{p.productCode || '—'}</td>
                      <td className="s-adminproduct-d86977">{p.brandName || p.brand || '—'}</td>
                      <td className="s-adminproduct-d86977">{p.categoryName || '—'}</td>
                      <td className="s-adminbrands-7dcd2c">{badge(p.state)}</td>
                      <td className="s-adminbrands-7dcd2c">
                        <div className="s-adminproduct-6209be">
                          <button onClick={() => navigate(`/admin/products/${p.productId}`)}
                            className="s-adminproduct-bec64d">
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          {p.state !== 'Approved' && (
                            <button onClick={() => updateState.mutate({ id: p.productId, state: 'Approved' })}
                              className="s-adminproduct-d37b04">✓</button>
                          )}
                          <button onClick={() => setConfirm(p)}
                            className="s-adminproduct-d37b04">
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
          <div className="s-adminorders-0fe0c2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="s-adminproduct-26d310">← Prev</button>
            <span className="s-adminorders-caf6f2">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              className="s-adminproduct-26d310">Next →</button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="s-adminproduct-d9e7c0"
          onClick={() => setConfirm(null)}>
          <div className="s-adminblog-69ab70" onClick={e => e.stopPropagation()}>
            <h3 className="s-adminproduct-23729b">Delete Product</h3>
            <p className="s-adminproduct-655c7d">Delete <strong>"{confirmDelete.name}"</strong>? This cannot be undone.</p>
            <div className="s-adminbrands-bccf37">
              <button onClick={() => deleteProduct.mutate(confirmDelete.productId)}
                disabled={deleteProduct.isPending}
                className="s-adminproduct-885bd5">
                {deleteProduct.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirm(null)}
                className="s-adminproduct-c641e3">Cancel</button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
