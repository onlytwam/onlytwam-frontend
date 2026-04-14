import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 15;
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
      <div className="s-adminblog-fe4afb">
        <div><h2 className="s-adminblog-91c675">Blog Posts</h2><p className="s-adminblog-1c2c10">{total} posts</p></div>
        <button onClick={() => setModal({ ...emptyPost })} className="s-adminblog-c47ae7">+ New Post</button>
      </div>

      {isLoading
        ? <p className="s-adminblog-e88902">Loading…</p>
        : posts.length === 0
          ? <div className="s-adminblog-b331d5">No blog posts yet.</div>
          : (
            <div className="s-adminblog-b43398">
              {posts.map((post: any) => (
                <div key={post.blogId} className="s-adminblog-d566ef">
                  <div className="s-app-52dcac">
                    <div className="s-adminblog-95277f">
                      <h3 className="s-adminblog-ffb607">{post.title}</h3>
                      <span className="s-adminblog-c06b52" style={ {background: post.isPublished ? 'var(--ivory)' : 'var(--ivory)', color: post.isPublished ? 'var(--brand)' : 'var(--heirloom)'} }>{post.isPublished ? 'Published' : 'Draft'}</span>
                    </div>
                    <p className="s-adminblog-f625dc">{post.content}</p>
                    <p className="s-adminblog-033b4e">By {post.author || 'TWAM'} · {formatDate(post.createdDate)}</p>
                  </div>
                  <div className="s-adminblog-f27ef1">
                    <button onClick={() => setModal(post)} className="s-adminblog-f0d4e1">Edit</button>
                    <button onClick={() => setConfirm(post)} className="s-adminblog-f0d4e1">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {pages > 1 && <div className="s-adminblog-213a15">{Array.from({ length: Math.min(pages,10) }, (_, i) => <button key={i} onClick={() => setPage(i+1)} className="s-adminblog-5b8395" style={ {borderColor: page===i+1?'var(--brand)':'var(--ivory)', background: page===i+1?'var(--brand)':'#fff', color: page===i+1?'#fff':'#000000'} }>{i+1}</button>)}</div>}

      {modal && (
        <div className="s-adminblog-6d52e4">
          <div className="s-adminblog-eb6085">
            <h3 className="s-adminblog-e6371f">{modal.blogId ? 'Edit' : 'New'} Post</h3>
            {[['Title *','title'],['Author','author'],['Tags (comma-separated)','tags'],['Image URL','image']].map(([l,k]) => (
              <div key={k} className="s-adminblog-22a617"><label className="s-addressform-f1fb64">{l}</label><input value={modal[k] || ''} onChange={e => setModal({ ...modal, [k]: e.target.value })} className="inp-field" /></div>
            ))}
            <div className="s-adminblog-22a617"><label className="s-addressform-f1fb64">Content *</label><textarea value={modal.content || ''} onChange={e => setModal({ ...modal, content: e.target.value })} rows={8} style={{ resize: 'vertical' }} /></div>
            <div className="s-adminblog-19fd7a"><label className="s-adminblog-a07339"><input type="checkbox" checked={modal.isPublished || false} onChange={e => setModal({ ...modal, isPublished: e.target.checked })} />Published</label></div>
            <div className="s-adminblog-679e96">
              <button onClick={() => setModal(null)} className="s-adminblog-78f775">Cancel</button>
              <button onClick={() => saveMutation.mutate(modal)} disabled={!modal.title || !modal.content} className="s-adminblog-c47ae7" style={ {opacity: !modal.title || !modal.content ? 0.5 : 1} }>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="s-adminblog-0bb39a">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete "{confirm.title}"?</h3>
            <div className="s-adminblog-679e96">
              <button onClick={() => setConfirm(null)} className="s-adminblog-ed2456">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirm.blogId)} className="s-adminblog-1e5083">{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
