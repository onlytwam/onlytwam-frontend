import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Open':        { bg: '#fff3e0', color: '#e65100' },
  'In Progress': { bg: '#e3f2fd', color: '#1565c0' },
  'Resolved':    { bg: '#e8f5e9', color: '#2e7d32' },
  'Closed':      { bg: '#f5f5f5', color: '#555' },
};

export default function AdminSupportRequests() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatus] = useState('All');
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-requests', page, statusFilter],
    queryFn: () => {
      const filters: any[] = [];
      if (statusFilter !== 'All') filters.push({ property: 'Status', comparison: 'eq', value: statusFilter });
      return api.get('/SupportRequest', { params: { ...(filters.length ? { Filters: JSON.stringify(filters) } : {}), 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'CreatedDate', 'Order.Ascending': false } }).then(r => r.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, reply }: any) => api.put(`/SupportRequest/${id}`, { status, reply }).then(r => r.data),
    onSuccess: () => { toast.success('Updated!'); qc.invalidateQueries({ queryKey: ['support-requests'] }); setSelected(null); setReplyText(''); },
    onError: () => toast.error('Update failed'),
  });

  const requests = data?.list ?? [];
  const total    = data?.count ?? 0;
  const pages    = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Support Requests</h2><p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} total</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All','Open','In Progress','Resolved','Closed'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{ padding: '6px 14px', border: '1px solid', borderColor: statusFilter===s?'#6A012A':'#ddd', background: statusFilter===s?'#6A012A':'#fff', color: statusFilter===s?'#fff':'#555', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#fafafa' }}>{['#','Subject','User','Status','Date','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            : requests.length === 0 ? <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>No requests found.</td></tr>
            : requests.map((r: any) => {
              const sc = STATUS_COLOR[r.status] || { bg: '#f5f5f5', color: '#555' };
              return (
                <tr key={r.supportRequestId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '11px 16px', color: '#888' }}>#{r.supportRequestId}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject || 'No subject'}</td>
                  <td style={{ padding: '11px 16px', color: '#555' }}>{r.email || '—'}</td>
                  <td style={{ padding: '11px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{r.status || 'Open'}</span></td>
                  <td style={{ padding: '11px 16px', color: '#888' }}>{formatDate(r.createdDate)}</td>
                  <td style={{ padding: '11px 16px' }}><button onClick={() => { setSelected(r); setReplyText(r.reply || ''); }} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid', borderColor: page===i+1?'#6A012A':'#ddd', background: page===i+1?'#6A012A':'#fff', color: page===i+1?'#fff':'#333', cursor: 'pointer', fontSize: 13 }}>{i+1}</button>)}</div>}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Request #{selected.supportRequestId}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f9f9f9', borderRadius: 8 }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>From: {selected.email} · {formatDate(selected.createdDate)}</p>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>{selected.subject}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6 }}>{selected.message}</p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Update Status</label>
              <select value={selected.status || 'Open'} onChange={e => setSelected({ ...selected, status: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
                {['Open','In Progress','Resolved','Closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Reply to customer</label>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} placeholder="Write your reply here…" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelected(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Close</button>
              <button onClick={() => updateMutation.mutate({ id: selected.supportRequestId, status: selected.status, reply: replyText })} style={{ padding: '9px 18px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{updateMutation.isPending ? 'Saving…' : 'Save & Reply'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}