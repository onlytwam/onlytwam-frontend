import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBlogDetail, listBlogs } from '@/features/products/api/products.api';
import { formatDate } from '@/shared/utils/helpers';

export default function Blog1() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: blog, isLoading } = useQuery({
    queryKey: ['blog', id],
    queryFn: () => getBlogDetail(Number(id)),
    enabled: !!id,
  });

  const { data: blogsData } = useQuery({
    queryKey: ['blogs-sidebar'],
    queryFn: () => listBlogs({
      // FIX: blog endpoint ignores filters/pagination but use correct notation anyway
      'Page.Size': 4,
      'Order.Property': 'ModifiedDate',
      'Order.Ascending': false,
    }),
  });

  const recentBlogs = (blogsData?.list ?? []).filter((b: any) => b.blogId !== Number(id));

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #eee', borderTopColor: '#111', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: '#fff', padding: '32px 0' }}>
      <div className="container">
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Main blog content */}
          <div style={{ flex: '1 1 500px', minWidth: 0 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: '#6A012A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Featured Blog</p>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 8 }}>{blog?.blogTitle}</h1>
              <p style={{ fontSize: 13, color: '#888' }}>{formatDate(blog?.createdDate)}</p>
            </div>

            {/* Banner image */}
            {blog?.uploadFileModel?.[0]?.fileData && (
              <img src={blog.uploadFileModel[0].fileData} alt={blog.blogTitle}
                style={{ width: '100%', borderRadius: 10, marginBottom: 24, maxHeight: 420, objectFit: 'cover', display: 'block' }} />
            )}

            {/* Blog HTML content (same as Angular's [innerHTML]) */}
            {blog?.blogContent && (
              <div
                dangerouslySetInnerHTML={{ __html: blog.blogContent }}
                style={{ fontSize: 15, color: '#444', lineHeight: 1.9 }}
              />
            )}

            {!blog && !isLoading && (
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Blog not found.</p>
            )}
          </div>

          {/* Sidebar — Recent Blogs */}
          <div style={{ flex: '0 0 280px', minWidth: 240 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#111' }}>Recent Blog Posts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recentBlogs.slice(0, 3).map((item: any) => (
                <article key={item.blogId}
                  onClick={() => navigate(`/blog-1/${item.blogId}`)}
                  style={{ display: 'flex', gap: 12, cursor: 'pointer', paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                  <img src={item.imageUrl || '/assets/images/10683.jpg'} alt={item.blogTitle}
                    style={{ width: 72, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/images/10683.jpg'; }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#111', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.blogTitle}
                    </h4>
                    <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>{formatDate(item.createdDate)}</p>
                    <span style={{ fontSize: 12, color: '#6A012A', fontWeight: 600 }}>Read more →</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}