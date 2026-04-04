import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;

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
      <div className="s-adminblog-fe4afb">
        <div><h2 className="s-adminblog-91c675">Categories</h2><p className="s-adminblog-1c2c10">{total} total</p></div>
        <div className="s-adminbrands-bccf37">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="inp-field s-admincategor-7a6c83" />
          <button onClick={() => setModal({ name: '', description: '', parentCategoryId: null })}
            className="s-admincategor-153727">
            + Add Category
          </button>
        </div>
      </div>

      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead><tr className="s-adminbrands-1ba202">{['ID','Name','Description','Parent','Actions'].map(h => <th key={h} className="s-adminbrands-84e069">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="s-adminbrands-3e0634">Loading…</td></tr>
            : cats.length === 0 ? <tr><td colSpan={5} className="s-adminbrands-3e0634">No categories found.</td></tr>
            : cats.map((c: any) => (
              <tr key={c.categoryId} className="s-adminbrands-59d787">
                <td className="s-admincategor-ec7211">{c.categoryId}</td>
                <td className="s-admincategor-46dbfc">{c.name}</td>
                <td className="s-admincategor-ec7211">{c.description || '—'}</td>
                <td className="s-admincategor-ec7211">{c.parentCategoryId ? `#${c.parentCategoryId}` : 'Root'}</td>
                <td className="s-admincategor-19b711">
                  <div className="s-adminbrands-ac734d">
                    <button onClick={() => setModal(c)} className="s-adminbrands-6ea383">Edit</button>
                    <button onClick={() => setConfirm(c)} className="s-adminbrands-6ea383">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div className="s-adminblog-213a15">{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i+1)} className="s-admincategor-431a8a" style={ {borderColor: page===i+1?'var(--brand)':'var(--ivory)', background: page===i+1?'var(--brand)':'#fff', color: page===i+1?'#fff':'#000000'} }>{i+1}</button>)}</div>}

      {modal && (
        <div className="s-admincategor-172a23">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">{modal.categoryId ? 'Edit' : 'New'} Category</h3>
            {[['Name *','name'],['Description','description']].map(([l,k]) => (
              <div key={k} className="s-adminblog-22a617"><label className="s-addressform-f1fb64">{l}</label><input value={modal[k] || ''} onChange={e => setModal({ ...modal, [k]: e.target.value })} className="inp-field" /></div>
            ))}
            <div className="s-adminblog-19fd7a"><label className="s-addressform-f1fb64">Parent Category ID (optional)</label><input type="number" value={modal.parentCategoryId || ''} onChange={e => setModal({ ...modal, parentCategoryId: e.target.value ? Number(e.target.value) : null })} className="inp-field" /></div>
            <div className="s-adminblog-679e96">
              <button onClick={() => setModal(null)} className="s-admincategor-68998a">Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.name} className="s-admincategor-153727" style={ {opacity: !modal.name ? 0.5 : 1} }>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete "{confirm.name}"?</h3>
            <p className="s-adminbrands-93cf07">This cannot be undone.</p>
            <div className="s-adminblog-679e96">
              <button onClick={() => setConfirm(null)} className="s-admincategor-3dc5de">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.categoryId)} className="s-admincategor-5e62fe">{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}