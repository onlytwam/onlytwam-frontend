import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import api from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const ROLES: Record<number, string> = { 1: 'Super Admin', 2: 'Customer', 3: 'Inventory Mgr', 4: 'Product Mgr', 5: 'Order Mgr', 6: 'Customer Support' };
const ROLE_COLOR: Record<number, string> = { 1: '#6A012A', 2: '#1565c0', 3: '#e65100', 4: '#6a1b9a', 5: '#2e7d32', 6: '#0277bd' };
const PAGE_SIZE = 20;
const inp: React.CSSProperties = { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };

export default function AdminUsers() {
  const { user } = useAuthStore();
  const roleId: number = (user as any)?.roleId ?? 0;
  // Super Admin only
  if (roleId !== 1) return <Navigate to="/admin/admin-dashboard" replace />;

  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [editUser, setEditUser] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim()) filters.push({ property: 'QuickSearch', comparison: 'contains', value: search.trim() });
      return api.get('/People', { params: { ...(filters.length ? { Filters: JSON.stringify(filters) } : {}), 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'CreatedDate', 'Order.Ascending': false } }).then(r => r.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (form: any) => api.post('/auth/updateUser', { EmailId: form.email, RoleId: Number(form.roleId), IsActive: form.isActive }).then(r => r.data),
    onSuccess: () => { toast.success('User updated!'); qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditUser(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Update failed'),
  });

  const users = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Users</h2><p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} registered users</p></div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email…" style={{ ...inp, width: 260 }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
          <thead><tr style={{ background: '#fafafa' }}>{['Name','Email','Role','Status','Joined','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            : users.length === 0 ? <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>No users found.</td></tr>
            : users.map((u: any) => (
              <tr key={u.userProfileId || u.peopleId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '11px 16px', fontWeight: 600 }}>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}</td>
                <td style={{ padding: '11px 16px', color: '#555' }}>{u.email || u.emailId || '—'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (ROLE_COLOR[u.roleId] || '#555') + '18', color: ROLE_COLOR[u.roleId] || '#555' }}>{ROLES[u.roleId] || `Role ${u.roleId}`}</span>
                </td>
                <td style={{ padding: '11px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.isActive ? '#e8f5e9' : '#ffebee', color: u.isActive ? '#2e7d32' : '#c62828' }}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ padding: '11px 16px', color: '#888' }}>{formatDate(u.createdDate)}</td>
                <td style={{ padding: '11px 16px' }}>
                  <button onClick={() => setEditUser({ ...u, email: u.email || u.emailId })} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid', borderColor: page===i+1?'#6A012A':'#ddd', background: page===i+1?'#6A012A':'#fff', color: page===i+1?'#fff':'#333', cursor: 'pointer', fontSize: 13 }}>{i+1}</button>)}</div>}

      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Edit User</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>{editUser.email}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Role</label>
              <select value={editUser.roleId} onChange={e => setEditUser({ ...editUser, roleId: Number(e.target.value) })} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                {Object.entries(ROLES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={editUser.isActive} onChange={e => setEditUser({ ...editUser, isActive: e.target.checked })} />
                Active account
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => updateMutation.mutate(editUser)} style={{ padding: '9px 18px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{updateMutation.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}