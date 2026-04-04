import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { getImageUrl } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;

export default function AdminBrands() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-brands', page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim()) filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
      return api.get('/Brand', { params: { ...(filters.length ? { Filters: JSON.stringify(filters) } : {}), 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'Name', 'Order.Ascending': true } }).then(r => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => form.brandId ? api.put(`/Brand/${form.brandId}`, form) : api.post('/Brand', form),
    onSuccess: () => { toast.success('Saved!'); qc.invalidateQueries({ queryKey: ['admin-brands'] }); setModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Brand/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['admin-brands'] }); setConfirm(null); },
    onError: () => toast.error('Delete failed — brand may be linked to products'),
  });

  const brands = data?.list ?? [];
  const total  = data?.count ?? 0;
  const pages  = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div><h2 className="s-adminblog-91c675">Brands</h2><p className="s-adminblog-1c2c10">{total} total</p></div>
        <div className="s-adminbrands-bccf37">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search brands…" className="inp-field s-adminbrands-b9d1c5" />
          <button onClick={() => setModal({ name: '', description: '', websiteUrl: '', logo: '' })}
            className="s-adminbrands-d3409f">
            + Add Brand
          </button>
        </div>
      </div>

      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead><tr className="s-adminbrands-1ba202">{['Logo','Name','Description','Website','Actions'].map(h => <th key={h} className="s-adminbrands-84e069">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="s-adminbrands-3e0634">Loading…</td></tr>
            : brands.length === 0 ? <tr><td colSpan={5} className="s-adminbrands-3e0634">No brands found.</td></tr>
            : brands.map((b: any) => (
              <tr key={b.brandId} className="s-adminbrands-59d787">
                <td className="s-adminbrands-7dcd2c">
                  {b.logo || b.brandImage
                    ? <img src={getImageUrl(b.logo || b.brandImage)} alt={b.name} className="s-adminbrands-0c5599" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <div className="s-adminbrands-6167ec"><i className="bi bi-image s-adminbrands-95b451" /></div>}
                </td>
                <td className="s-adminbrands-c25a6e">{b.brandName || b.name}</td>
                <td className="s-adminbrands-6d0b42">{b.description || '—'}</td>
                <td className="s-adminbrands-7dcd2c">{b.websiteUrl ? <a href={b.websiteUrl} target="_blank" rel="noreferrer" className="s-adminbrands-6d27f5">Visit</a> : '—'}</td>
                <td className="s-adminbrands-7dcd2c">
                  <div className="s-adminbrands-ac734d">
                    <button onClick={() => setModal(b)} className="s-adminbrands-6ea383">Edit</button>
                    <button onClick={() => setConfirm(b)} className="s-adminbrands-6ea383">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div className="s-adminblog-213a15">{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} className="s-adminbrands-93c0a2" style={ {borderColor: page===i+1?'var(--brand)':'var(--ivory)', background: page===i+1?'var(--brand)':'#fff', color: page===i+1?'#fff':'#000000'} }>{i+1}</button>)}</div>}

      {modal && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">{modal.brandId ? 'Edit' : 'New'} Brand</h3>
            {[['Brand Name *','name'],['Description','description'],['Website URL','websiteUrl']].map(([l,k]) => (
              <div key={k} className="s-adminblog-22a617"><label className="s-addressform-f1fb64">{l}</label><input value={modal[k] || ''} onChange={e => setModal({ ...modal, [k]: e.target.value })} className="inp-field" /></div>
            ))}
            <div className="s-adminbrands-fcea5e">
              <button onClick={() => setModal(null)} className="s-adminbrands-5a7ba1">Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.name} className="s-adminbrands-d3409f" style={ {opacity: !modal.name ? 0.5 : 1} }>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete "{confirm.brandName || confirm.name}"?</h3>
            <p className="s-adminbrands-93cf07">Products using this brand may be affected.</p>
            <div className="s-adminblog-679e96">
              <button onClick={() => setConfirm(null)} className="s-adminbrands-c554f0">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.brandId)} className="s-adminbrands-ad5bf3">{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}