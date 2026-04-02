import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listBlogs } from '@/features/products/api/products.api';
import { formatDate } from '@/shared/utils/helpers';
import { getImageUrl } from '@/shared/utils/helpers';
import Breadcrumb from '@/shared/components/Breadcrumb';

export default function OurBlog() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['blogs'],
    queryFn: () => listBlogs(),
  });

  const blogs: any[] = data?.list ?? [];

  return (
    <div style={{ background: '#fff' }}>
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Our Blog' }]} />

      {/* ── Hero Banner — matches reference: woman photo + text overlay */}
      <div style={{ position: 'relative', width: '100%', minHeight: 480, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <img
          src="/assets/blog-banner.jpg"
          alt="Blog Banner"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          onError={e => { (e.target as HTMLImageElement).src = '/assets/10683.jpg'; }}
        />
        {/* dark overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.45) 0%, rgba(0,0,0,.1) 60%)' }} />
      </div>

      {/* ── Blog Cards Grid */}
      <div className="container" style={{ padding: '56px 16px' }}>

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 32 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#f5f5f5', height: 260, animation: 'pulse 1.5s infinite' }} />
                <div style={{ padding: 16 }}>
                  <div style={{ background: '#f5f5f5', height: 20, borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ background: '#f5f5f5', height: 14, borderRadius: 4, width: '60%', animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <i className="bi bi-journal-x" style={{ fontSize: 56, color: '#ddd', display: 'block', marginBottom: 16 }} />
            <p style={{ color: '#888', fontSize: 16 }}>No Stories Found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 32 }}>
            {blogs.map((item: any) => (
              <article
                key={item.blogId}
                style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', background: '#fff', cursor: 'pointer' }}
                onClick={() => navigate(`/blog-1/${item.blogId}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(0,0,0,.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {/* Blog image — imageUrl is stored as relative path "uploads/…" in DB */}
                <div style={{ overflow: 'hidden', height: 260 }}>
                  <img
                    src={getImageUrl(item.imageUrl)}
                    alt={item.blogTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .35s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/blog-banner.jpg'; }}
                  />
                </div>

                <div style={{ padding: '20px 20px 24px' }}>
                  {/* Title */}
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 10px', color: '#111', lineHeight: 1.4 }}>
                    {item.blogTitle}
                  </h3>
                  {/* Description */}
                  {item.description && (
                    <p style={{ fontSize: 13, color: '#777', margin: '0 0 16px', lineHeight: 1.6,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description}
                    </p>
                  )}
                  {/* Date + CTA — matches reference exactly */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#aaa' }}>
                      {formatDate(item.createdDate)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/blog-1/${item.blogId}`); }}
                      style={{ background: 'none', border: 'none', color: '#6A012A', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Unfold the Story →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}