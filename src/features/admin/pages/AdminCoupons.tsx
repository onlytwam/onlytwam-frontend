import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate, formatPrice } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;
const empty = { code: '', discountType: 'Percentage', discountValue: '', minOrderAmount: '', maxDiscountAmount: '', expiryDate: '', usageLimit: '', isActive: true, description: '' };

export default function AdminCoupons() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coupons', page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim()) filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
      return api.get('/Coupons', { params: { ...(filters.length ? { Filters: JSON.stringify(filters) } : {}), 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'CreatedDate', 'Order.Ascending': false } }).then(r => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => form.couponId ? api.put(`/Coupons/${form.couponId}`, form) : api.post('/Coupons', form),
    onSuccess: () => { toast.success('Saved!'); qc.invalidateQueries({ queryKey: ['admin-coupons'] }); setModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Coupons/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['admin-coupons'] }); setConfirm(null); },
    onError: () => toast.error('Delete failed'),
  });

  const coupons = data?.list ?? [];
  const total   = data?.count ?? 0;
  const pages   = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div><h2 className="s-adminblog-91c675">Coupons</h2><p className="s-adminblog-1c2c10">{total} total</p></div>
        <div className="s-adminbrands-bccf37">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search coupons…" className="inp-field s-admincoupons-2b5f69" />
          <button onClick={() => setModal({ ...empty })} className="s-admincoupons-2798d5">+ New Coupon</button>
        </div>
      </div>

      <div className="s-admincoupons-b0d5b2">
        <table className="s-admincoupons-bbc29c">
          <thead><tr className="s-adminbrands-1ba202">{['Code','Type','Discount','Min Order','Expiry','Status','Actions'].map(h => <th key={h} className="s-adminbrands-84e069">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="s-adminbrands-3e0634">Loading…</td></tr>
            : coupons.length === 0 ? <tr><td colSpan={7} className="s-adminbrands-3e0634">No coupons found.</td></tr>
            : coupons.map((c: any) => (
              <tr key={c.couponId} className="s-adminbrands-59d787">
                <td className="s-admincoupons-9db09c">{c.code || c.couponCode}</td>
                <td className="s-admincategor-ec7211">{c.discountType || 'Percentage'}</td>
                <td className="s-admincategor-46dbfc">{(c.discountType || '') === 'Fixed' ? formatPrice(c.discountValue || c.discount || 0) : `${c.discountValue || c.discount || 0}%`}</td>
                <td className="s-admincategor-ec7211">{c.minOrderAmount ? formatPrice(c.minOrderAmount) : '—'}</td>
                <td className="s-admincategor-ec7211">{c.expiryDate || c.endDate ? formatDate(c.expiryDate || c.endDate) : '—'}</td>
                <td className="s-admincategor-19b711"><span className="s-admincoupons-8cde59" style={ {background: c.isActive ? 'var(--ivory)' : 'var(--ivory)', color: c.isActive ? 'var(--brand)' : 'var(--heirloom)'} }>{c.isActive ? 'Active' : 'Inactive'}</span></td>
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

      {pages > 1 && <div className="s-adminblog-213a15">{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} className="s-admincoupons-174989" style={ {borderColor: page===i+1?'var(--brand)':'var(--ivory)', background: page===i+1?'var(--brand)':'#fff', color: page===i+1?'#fff':'#000000'} }>{i+1}</button>)}</div>}

      {modal && (
        <div className="s-admincoupons-d93fb3">
          <div className="s-admincoupons-5920ba">
            <h3 className="s-adminblog-e6371f">{modal.couponId ? 'Edit' : 'New'} Coupon</h3>
            <div className="s-admincoupons-ad5066">
              <div className="s-admincoupons-019368"><label className="s-addressform-f1fb64">Code *</label><input value={modal.code || modal.couponCode || ''} onChange={e => setModal({ ...modal, code: e.target.value })} className="inp-field s-admincoupons-89c263" placeholder="e.g. SAVE20" /></div>
              <div className="s-admincoupons-019368"><label className="s-addressform-f1fb64">Description</label><input value={modal.description || ''} onChange={e => setModal({ ...modal, description: e.target.value })} className="inp-field" /></div>
              <div><label className="s-addressform-f1fb64">Discount Type</label><select value={modal.discountType || 'Percentage'} onChange={e => setModal({ ...modal, discountType: e.target.value })} className="inp-field s-admincoupons-c1f944"><option>Percentage</option><option>Fixed</option></select></div>
              <div><label className="s-addressform-f1fb64">Discount Value *</label><input type="number" value={modal.discountValue || ''} onChange={e => setModal({ ...modal, discountValue: e.target.value })} className="inp-field" /></div>
              <div><label className="s-addressform-f1fb64">Min Order (₹)</label><input type="number" value={modal.minOrderAmount || ''} onChange={e => setModal({ ...modal, minOrderAmount: e.target.value })} className="inp-field" /></div>
              <div><label className="s-addressform-f1fb64">Max Discount (₹)</label><input type="number" value={modal.maxDiscountAmount || ''} onChange={e => setModal({ ...modal, maxDiscountAmount: e.target.value })} className="inp-field" /></div>
              <div><label className="s-addressform-f1fb64">Expiry Date</label><input type="date" value={(modal.expiryDate || modal.endDate || '').split('T')[0]} onChange={e => setModal({ ...modal, expiryDate: e.target.value, endDate: e.target.value })} className="inp-field" /></div>
              <div><label className="s-addressform-f1fb64">Usage Limit</label><input type="number" value={modal.usageLimit || ''} onChange={e => setModal({ ...modal, usageLimit: e.target.value })} className="inp-field" /></div>
              <div className="s-admincoupons-019368"><label className="s-adminblog-a07339"><input type="checkbox" checked={modal.isActive !== false} onChange={e => setModal({ ...modal, isActive: e.target.checked })} />Active</label></div>
            </div>
            <div className="s-admincoupons-45d476">
              <button onClick={() => setModal(null)} className="s-admincoupons-db4fcf">Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!(modal.code || modal.couponCode) || !modal.discountValue} className="s-admincoupons-2798d5" style={ {opacity: !(modal.code || modal.couponCode) || !modal.discountValue ? 0.5 : 1} }>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="s-admincoupons-f1fb3c">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete coupon "{confirm.code || confirm.couponCode}"?</h3>
            <div className="s-adminblog-679e96">
              <button onClick={() => setConfirm(null)} className="s-admincoupons-99e32e">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.couponId)} className="s-admincoupons-2253c0">{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}