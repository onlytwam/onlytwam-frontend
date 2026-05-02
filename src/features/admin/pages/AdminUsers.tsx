import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import api from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const ROLES: Record<number, string> = { 1: 'Super Admin', 2: 'Customer', 3: 'Inventory Mgr', 4: 'Product Mgr', 5: 'Order Mgr', 6: 'Customer Support' };
const ROLE_COLOR: Record<number, string> = { 1: 'var(--brand)', 2: 'var(--brand)', 3: 'var(--brand)', 4: 'var(--brand)', 5: 'var(--brand)', 6: 'var(--brand)' };
const PAGE_SIZE = 20;

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
      <div className="s-adminblog-fe4afb">
        <div><h2 className="s-adminblog-91c675">Users</h2><p className="s-adminblog-1c2c10">{total} registered users</p></div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="inp-field s-adminusers-73fe07" />
      </div>

      <div className="s-admincoupons-b0d5b2">
        <table className="s-admincoupons-bbc29c">
          <thead><tr className="s-adminbrands-1ba202">{['Name','Email','Role','Status','Joined','Actions'].map(h => <th key={h} className="s-adminbrands-84e069">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="s-adminbrands-3e0634">Loading…</td></tr>
            : users.length === 0 ? <tr><td colSpan={6} className="s-adminbrands-3e0634">No users found.</td></tr>
            : users.map((u: any) => (
              <tr key={u.userProfileId || u.peopleId} className="s-adminbrands-59d787">
                <td className="s-admincategor-46dbfc">{`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}</td>
                <td className="s-admincategor-ec7211">{u.email || u.emailId || '—'}</td>
                <td className="s-admincategor-19b711">
                  <span className="s-adminusers-176eae" style={{ background: (ROLE_COLOR[u.roleId] || 'var(--heirloom)') + '18', color: ROLE_COLOR[u.roleId] || 'var(--heirloom)' }}>{ROLES[u.roleId] || `Role ${u.roleId}`}</span>
                </td>
                <td className="s-admincategor-19b711"><span className="s-adminusers-93890c" style={ {background: u.isActive ? 'var(--ivory)' : 'var(--ivory)', color: u.isActive ? 'var(--brand)' : 'var(--brand)'} }>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="s-admincategor-ec7211">{formatDate(u.createdDate)}</td>
                <td className="s-admincategor-19b711">
                  <button onClick={() => setEditUser({ ...u, email: u.email || u.emailId })} className="s-adminbrands-6ea383">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && <div className="s-adminblog-213a15">{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} className="s-adminusers-2353b6" style={ {borderColor: page===i+1?'var(--brand)':'var(--ivory)', background: page===i+1?'var(--brand)':'#fff', color: page===i+1?'#fff':'#000000'} }>{i+1}</button>)}</div>}

      {editUser && (
        <div className="s-adminusers-f320eb">
          <div className="s-adminusers-ff7137">
            <h3 className="s-adminusers-7a6889">Edit User</h3>
            <p className="s-adminusers-317074">{editUser.email}</p>
            <div className="s-adminblog-22a617">
              <label className="s-addressform-f1fb64">Role</label>
              <select value={editUser.roleId} onChange={e => setEditUser({ ...editUser, roleId: Number(e.target.value) })} className="inp-field s-adminusers-c33556">
                {Object.entries(ROLES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div className="s-adminblog-19fd7a">
              <label className="s-addressform-dd104a">Status</label>
              <label className="s-adminproduct-66250b">
                <input type="checkbox" checked={editUser.isActive} onChange={e => setEditUser({ ...editUser, isActive: e.target.checked })} />
                Active account
              </label>
            </div>
            <div className="s-adminblog-679e96">
              <button onClick={() => setEditUser(null)} className="s-adminusers-d4f37f">Cancel</button>
              <button onClick={() => updateMutation.mutate(editUser)} className="s-adminusers-367c9d">{updateMutation.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}