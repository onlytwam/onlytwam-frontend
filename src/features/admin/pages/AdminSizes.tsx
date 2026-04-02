import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import toast from 'react-hot-toast';

const inp: React.CSSProperties = { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };

interface SizeTableProps {
  endpoint: string;
  title:    string;
  idKey:    string;
}

function SizeTable({ endpoint, title, idKey }: SizeTableProps) {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () => api.get(`/${endpoint}`, { params: { 'Page.Size': 200, 'Order.Property': 'SortOrder', 'Order.Ascending': true } }).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => form[idKey] ? api.put(`/${endpoint}/${form[idKey]}`, form) : api.post(`/${endpoint}`, form),
    onSuccess: () => { toast.success('Saved!'); qc.invalidateQueries({ queryKey: [endpoint] }); setModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/${endpoint}/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: [endpoint] }); setConfirm(null); },
    onError: () => toast.error('Delete failed'),
  });

  const items = data?.list ?? [];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button onClick={() => setModal({ sizeLabel: '', sortOrder: 0 })}
          style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {isLoading
        ? <p style={{ padding: 20, textAlign: 'center', color: '#aaa', margin: 0 }}>Loading…</p>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
            {items.length === 0
              ? <p style={{ color: '#aaa', margin: 0, fontSize: 13 }}>No {title.toLowerCase()} yet.</p>
              : items.map((item: any) => (
                <div key={item[idKey]} style={{ padding: '8px 14px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{item.sizeLabel || item.label}</span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>#{item[idKey]}</span>
                  {item.sortOrder != null && <span style={{ fontSize: 11, color: '#aaa' }}>({item.sortOrder})</span>}
                  <button onClick={() => setModal({ ...item })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0', fontSize: 12, padding: 0 }}>Edit</button>
                  <button onClick={() => setConfirm(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12, padding: 0 }}>Del</button>
                </div>
              ))
            }
          </div>
        )
      }

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>{modal[idKey] ? 'Edit' : 'Add'} {title.slice(0,-1)}</h3>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Label *</label>
              <input value={modal.sizeLabel || ''} onChange={e => setModal({ ...modal, sizeLabel: e.target.value })} style={inp} placeholder="e.g. S, M, XL, 32B" /></div>
            <div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Sort Order</label>
              <input type="number" value={modal.sortOrder ?? 0} onChange={e => setModal({ ...modal, sortOrder: Number(e.target.value) })} style={inp} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.sizeLabel} style={{ padding: '8px 16px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', opacity: !modal.sizeLabel ? 0.5 : 1 }}>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 320 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Delete "{confirm.sizeLabel}"?</h3>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm[idKey])} style={{ padding: '8px 16px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSizes() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Sizes &amp; Cup Sizes</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Manage clothing sizes and bra cup sizes used across products.</p>
      </div>
      <SizeTable endpoint="Size"    title="Sizes"      idKey="sizeId"    />
      <SizeTable endpoint="CupSize" title="Cup Sizes"  idKey="cupSizeId" />
    </div>
  );
}