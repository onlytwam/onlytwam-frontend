import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate, formatPrice } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;
const inp: React.CSSProperties = { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Coupons</h2><p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} total</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search coupons…" style={{ ...inp, width: 200 }} />
          <button onClick={() => setModal({ ...empty })} style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ New Coupon</button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
          <thead><tr style={{ background: '#fafafa' }}>{['Code','Type','Discount','Min Order','Expiry','Status','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            : coupons.length === 0 ? <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>No coupons found.</td></tr>
            : coupons.map((c: any) => (
              <tr key={c.couponId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '11px 16px', fontWeight: 700, color: '#6A012A', letterSpacing: 1, fontFamily: 'monospace' }}>{c.code || c.couponCode}</td>
                <td style={{ padding: '11px 16px', color: '#555' }}>{c.discountType || 'Percentage'}</td>
                <td style={{ padding: '11px 16px', fontWeight: 600 }}>{(c.discountType || '') === 'Fixed' ? formatPrice(c.discountValue || c.discount || 0) : `${c.discountValue || c.discount || 0}%`}</td>
                <td style={{ padding: '11px 16px', color: '#555' }}>{c.minOrderAmount ? formatPrice(c.minOrderAmount) : '—'}</td>
                <td style={{ padding: '11px 16px', color: '#555' }}>{c.expiryDate || c.endDate ? formatDate(c.expiryDate || c.endDate) : '—'}</td>
                <td style={{ padding: '11px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.isActive ? '#e8f5e9' : '#f5f5f5', color: c.isActive ? '#2e7d32' : '#888' }}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
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

      {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid', borderColor: page===i+1?'#6A012A':'#ddd', background: page===i+1?'#6A012A':'#fff', color: page===i+1?'#fff':'#333', cursor: 'pointer', fontSize: 13 }}>{i+1}</button>)}</div>}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{modal.couponId ? 'Edit' : 'New'} Coupon</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/3' }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Code *</label><input value={modal.code || modal.couponCode || ''} onChange={e => setModal({ ...modal, code: e.target.value })} style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace' }} placeholder="e.g. SAVE20" /></div>
              <div style={{ gridColumn: '1/3' }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Description</label><input value={modal.description || ''} onChange={e => setModal({ ...modal, description: e.target.value })} style={inp} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Discount Type</label><select value={modal.discountType || 'Percentage'} onChange={e => setModal({ ...modal, discountType: e.target.value })} style={{ ...inp, cursor: 'pointer', background: '#fff' }}><option>Percentage</option><option>Fixed</option></select></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Discount Value *</label><input type="number" value={modal.discountValue || ''} onChange={e => setModal({ ...modal, discountValue: e.target.value })} style={inp} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Min Order (₹)</label><input type="number" value={modal.minOrderAmount || ''} onChange={e => setModal({ ...modal, minOrderAmount: e.target.value })} style={inp} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Max Discount (₹)</label><input type="number" value={modal.maxDiscountAmount || ''} onChange={e => setModal({ ...modal, maxDiscountAmount: e.target.value })} style={inp} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Expiry Date</label><input type="date" value={(modal.expiryDate || modal.endDate || '').split('T')[0]} onChange={e => setModal({ ...modal, expiryDate: e.target.value, endDate: e.target.value })} style={inp} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Usage Limit</label><input type="number" value={modal.usageLimit || ''} onChange={e => setModal({ ...modal, usageLimit: e.target.value })} style={inp} /></div>
              <div style={{ gridColumn: '1/3' }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}><input type="checkbox" checked={modal.isActive !== false} onChange={e => setModal({ ...modal, isActive: e.target.checked })} />Active</label></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!(modal.code || modal.couponCode) || !modal.discountValue} style={{ padding: '9px 18px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: !(modal.code || modal.couponCode) || !modal.discountValue ? 0.5 : 1 }}>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Delete coupon "{confirm.code || confirm.couponCode}"?</h3>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.couponId)} style={{ padding: '9px 18px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}