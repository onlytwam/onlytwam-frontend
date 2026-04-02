import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 15;
const inp: React.CSSProperties = { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };
const emptyPost = { title: '', content: '', author: '', tags: '', isPublished: false, image: '' };

export default function AdminBlog() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', page],
    queryFn: () => api.get('/Blog', { params: { 'Page.Index': page, 'Page.Size': PAGE_SIZE, 'Order.Property': 'CreatedDate', 'Order.Ascending': false } }).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => form.blogId ? api.put(`/Blog/${form.blogId}`, form) : api.post('/Blog', form),
    onSuccess: () => { toast.success('Saved!'); qc.invalidateQueries({ queryKey: ['admin-blog'] }); setModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Blog/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['admin-blog'] }); setConfirm(null); },
    onError: () => toast.error('Delete failed'),
  });

  const posts = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Blog Posts</h2><p style={{ margin: 0, color: '#888', fontSize: 13 }}>{total} posts</p></div>
        <button onClick={() => setModal({ ...emptyPost })} style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ New Post</button>
      </div>

      {isLoading
        ? <p style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>Loading…</p>
        : posts.length === 0
          ? <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: '48px 24px', textAlign: 'center', color: '#aaa' }}>No blog posts yet.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {posts.map((post: any) => (
                <div key={post.blogId} style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{post.title}</h3>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: post.isPublished ? '#e8f5e9' : '#f5f5f5', color: post.isPublished ? '#2e7d32' : '#888' }}>{post.isPublished ? 'Published' : 'Draft'}</span>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: '#666', lineHeight: 1.5, maxHeight: 40, overflow: 'hidden' }}>{post.content}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>By {post.author || 'TWAM'} · {formatDate(post.createdDate)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setModal(post)} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                    <button onClick={() => setConfirm(post)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid', borderColor: page===i+1?'#6A012A':'#ddd', background: page===i+1?'#6A012A':'#fff', color: page===i+1?'#fff':'#333', cursor: 'pointer', fontSize: 13 }}>{i+1}</button>)}</div>}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 600, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{modal.blogId ? 'Edit' : 'New'} Post</h3>
            {[['Title *','title'],['Author','author'],['Tags (comma-separated)','tags'],['Image URL','image']].map(([l,k]) => (
              <div key={k} style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>{l}</label><input value={modal[k] || ''} onChange={e => setModal({ ...modal, [k]: e.target.value })} style={inp} /></div>
            ))}
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>Content *</label><textarea value={modal.content || ''} onChange={e => setModal({ ...modal, content: e.target.value })} rows={8} style={{ ...inp, resize: 'vertical' }} /></div>
            <div style={{ marginBottom: 20 }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}><input type="checkbox" checked={modal.isPublished || false} onChange={e => setModal({ ...modal, isPublished: e.target.checked })} />Published</label></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.title || !modal.content} style={{ padding: '9px 18px', background: '#6A012A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: !modal.title || !modal.content ? 0.5 : 1 }}>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Delete "{confirm.title}"?</h3>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.blogId)} style={{ padding: '9px 18px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}