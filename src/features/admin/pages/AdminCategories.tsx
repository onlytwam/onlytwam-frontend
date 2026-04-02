import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;
const inp: React.CSSProperties = { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };

export default function AdminCategories() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories', page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim()) filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
      return api.get('/Category', { params: { ...(filters.length ? { Filters: JSON.stringify(filters) } : {}), 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'Name', 'Order.Ascending': true } }).then(r => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => form.categoryId ? api.put(`/Category/${form.categoryId}`, form) : api.post('/Category', form),
    onSuccess: () => { toast.success('Saved!'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); setModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Category/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); setConfirm(null); },
    onError: () => toast.error('Delete failed'),
  });

  const cats  = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Categories</h2><p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} total</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" style={{ ...inp, width: 220 }} />
          <button onClick={() => setModal({ name: '', description: '', parentCategoryId: null })}
            style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            + Add Category
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#fafafa' }}>{['ID','Name','Description','Parent','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            : cats.length === 0 ? <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>No categories found.</td></tr>
            : cats.map((c: any) => (
              <tr key={c.categoryId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '11px 16px', color: '#888' }}>{c.categoryId}</td>
                <td style={{ padding: '11px 16px', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '11px 16px', color: '#666' }}>{c.description || '—'}</td>
                <td style={{ padding: '11px 16px', color: '#888' }}>{c.parentCategoryId ? `#${c.parentCategoryId}` : 'Root'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setModal(c)} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                    <button onClick={() => setConfirm(c)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i+1)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid', borderColor: page===i+1?'#6A012A':'#ddd', background: page===i+1?'#6A012A':'#fff', color: page===i+1?'#fff':'#333', cursor: 'pointer', fontSize: 13 }}>{i+1}</button>)}</div>}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{modal.categoryId ? 'Edit' : 'New'} Category</h3>
            {[['Name *','name'],['Description','description']].map(([l,k]) => (
              <div key={k} style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>{l}</label><input value={modal[k] || ''} onChange={e => setModal({ ...modal, [k]: e.target.value })} style={inp} /></div>
            ))}
            <div style={{ marginBottom: 20 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Parent Category ID (optional)</label><input type="number" value={modal.parentCategoryId || ''} onChange={e => setModal({ ...modal, parentCategoryId: e.target.value ? Number(e.target.value) : null })} style={inp} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.name} style={{ padding: '9px 18px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: !modal.name ? 0.5 : 1 }}>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Delete "{confirm.name}"?</h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.categoryId)} style={{ padding: '9px 18px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}