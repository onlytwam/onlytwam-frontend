import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { formatDate } from '@/shared/utils/helpers';
import toast from 'react-hot-toast';

const BASE_URL = "http://localhost:8000";
const PAGE_SIZE = 15;

const emptyPost = {
  title: '',
  content: '',
  description: '',
  image: null,
  isPublished: false,
};

export default function AdminBlog() {
  const qc = useQueryClient();
  const [page, setPage]             = useState(1);
  const [modal, setModal]           = useState<any>(null);
  const [confirm, setConfirm]       = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', page],
    queryFn: () =>
      api.get('/Blog', {
        params: {
          'Page.Index': page,
          'Page.Size': PAGE_SIZE,
          'Order.Property': 'CreatedDate',
          'Order.Ascending': false,
        },
      }).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => {
      const fd = new FormData();
      fd.append('blogTitle',   form.title);
      fd.append('blogContent', form.content);
      fd.append('description', form.description ?? '');
      fd.append('isPublished', String(form.isPublished ?? false));
      if (form.image) fd.append('image', form.image);
      return form.blogId
        ? api.put(`/Blog/${form.blogId}`, fd)
        : api.post('/Blog/', fd);
    },
    onSuccess: () => { toast.success('Saved!'); setModal(null); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-blog'] }),
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
  });

  const handleSave = (form: any) => {
    if (!form.title)                 return toast.error('Title is required');
    if (!form.content)               return toast.error('Content is required');
    if (!form.blogId && !form.image) return toast.error('Image is required');
    saveMutation.mutate(form);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Blog/${id}`),
    onSuccess: () => { toast.success('Deleted'); setConfirm(null); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-blog'] }),
    onError: () => toast.error('Delete failed'),
  });

  const rawPosts = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
  const total    = data?.count ?? rawPosts.length;
  const pages    = Math.ceil(total / PAGE_SIZE);

  const posts = rawPosts.filter((p: any) =>
    (p.blogTitle ?? p.title ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <>
  
      <div className="ab-wrap">

        {/* Header */}
        <div className="ab-header">
          <div>
            <h2 className="ab-heading">Blog Posts</h2>
            <p className="ab-subtext">{total} post{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="ab-controls">
            <input
              className="ab-search"
              type="text"
              placeholder="Search blogs…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="ab-btn-new" onClick={() => setModal({ ...emptyPost })}>
              + New Post
            </button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="ab-empty">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="ab-empty">
            {searchTerm ? 'No matching posts found.' : 'No blog posts yet.'}
          </div>
        ) : (
          <div className="ab-list">
            {posts.map((post: any) => {
              const title     = post.blogTitle   ?? post.title   ?? '';
              const content   = post.blogContent ?? post.content ?? '';
              const published = post.isPublished ?? false;
              const imageUrl  = post.imageUrl
                ? `${BASE_URL}${post.imageUrl}`
                : post.image ?? '';

              return (
                <div key={post.blogId} className="ab-card">
                  {imageUrl
                    ? <img src={imageUrl} alt={title} className="ab-thumb" />
                    : <div className="ab-thumb-placeholder">📝</div>
                  }

                  <div className="ab-body">
                    <div className="ab-title-row">
                      <h3 className="ab-title">{title}</h3>
                      <span className={`ab-badge ${published ? 'ab-badge-published' : 'ab-badge-draft'}`}>
                        {published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {post.description && (
                      <p className="ab-desc">{post.description}</p>
                    )}
                    {content && (
                      <p className="ab-preview">{content}</p>
                    )}
                    <p className="ab-meta">
                      By {post.author || 'TWAM'} · {formatDate(post.createdDate)}
                    </p>
                  </div>

                  <div className="ab-actions">
                    <button
                      className="ab-btn-edit"
                      onClick={() => setModal({
                        blogId: post.blogId, title, content,
                        description: post.description ?? '',
                        image: null, isPublished: published,
                      })}
                    >
                      Edit
                    </button>
                    <button
                      className="ab-btn-del"
                      onClick={() => setConfirm({ ...post, title })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="ab-pages">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
              <button
                key={i}
                className={`ab-page-btn ${page === i + 1 ? 'active' : ''}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Create / Edit Modal */}
        {modal && (
          <div className="ab-overlay" onClick={() => setModal(null)}>
            <div className="ab-modal" onClick={e => e.stopPropagation()}>
              <h3 className="ab-modal-title">{modal.blogId ? 'Edit Post' : 'New Post'}</h3>

              <div className="ab-field">
                <label className="ab-label">Title *</label>
                <input className="ab-input" value={modal.title || ''} placeholder="Blog title"
                  onChange={e => setModal({ ...modal, title: e.target.value })} />
              </div>
              <div className="ab-field">
                <label className="ab-label">Description</label>
                <input className="ab-input" value={modal.description || ''} placeholder="Short description"
                  onChange={e => setModal({ ...modal, description: e.target.value })} />
              </div>
              <div className="ab-field">
                <label className="ab-label">Content *</label>
                <textarea className="ab-textarea" value={modal.content || ''} placeholder="Full blog content…"
                  onChange={e => setModal({ ...modal, content: e.target.value })} />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  Image {!modal.blogId && <span style={{color:'#c0392b'}}>*</span>}
                  {!modal.blogId && !modal.image && (
                    <span style={{color:'#c0392b', fontWeight:400, marginLeft:8, fontSize:'0.78rem'}}>Required</span>
                  )}
                </label>
                <input
                  className="ab-input"
                  type="file"
                  accept="image/*"
                  style={{borderColor: !modal.blogId && !modal.image ? '#c0392b' : ''}}
                  onChange={(e: any) => setModal({ ...modal, image: e.target.files?.[0] || null })}
                />
              </div>
              <div className="ab-field">
                <label className="ab-check-row">
                  <input type="checkbox" checked={modal.isPublished || false}
                    onChange={e => setModal({ ...modal, isPublished: e.target.checked })} />
                  Mark as Published
                </label>
              </div>

              <div className="ab-modal-footer">
                <button className="ab-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button
                  className="ab-btn-save"
                  onClick={() => handleSave(modal)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : modal.blogId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {confirm && (
          <div className="ab-overlay" onClick={() => setConfirm(null)}>
            <div className="ab-confirm-modal" onClick={e => e.stopPropagation()}>
              <div className="ab-confirm-icon">🗑️</div>
              <h3 className="ab-confirm-title">Delete this post?</h3>
              <p className="ab-confirm-sub">"{confirm.title}" will be permanently removed.</p>
              <div className="ab-modal-footer" style={{ justifyContent: 'center' }}>
                <button className="ab-btn-cancel" onClick={() => setConfirm(null)}>Cancel</button>
                <button
                  className="ab-btn-danger"
                  onClick={() => deleteMutation.mutate(confirm.blogId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}