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
    <div className="s-ourblog-635938">
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Our Blog' }]} />

      {/* ── Hero Banner — matches reference: woman photo + text overlay */}
      <div className="s-ourblog-a75c7f">
        <img
          src="/assets/blog-banner.jpg"
          alt="Blog Banner"
          className="s-ourblog-13e3c6"
          onError={e => { (e.target as HTMLImageElement).src = '/assets/10683.jpg'; }}
        />
        {/* dark overlay for readability */}
        <div className="s-ourblog-572607" />
      </div>

      {/* ── Blog Cards Grid */}
      <div className="container s-ourblog-08cd8c">

        {isLoading ? (
          <div className="s-ourblog-70d756">
            {[1, 2, 3].map(i => (
              <div key={i} className="s-ourblog-a35d4d">
                <div className="s-ourblog-3a8cc6" />
                <div className="s-adminorders-652ef8">
                  <div className="s-ourblog-759520" />
                  <div className="s-ourblog-5dc6bb" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="s-ourblog-f6d3dd">
            <i className="bi bi-journal-x s-ourblog-e93988" />
            <p className="s-ourblog-59da72">No Stories Found</p>
          </div>
        ) : (
          <div className="s-ourblog-70d756">
            {blogs.map((item: any) => (
              <article
                key={item.blogId}
                className="s-ourblog-135acd"
                onClick={() => navigate(`/blog-1/${item.blogId}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(0,0,0,.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {/* Blog image — imageUrl is stored as relative path "uploads/…" in DB */}
                <div className="s-ourblog-2e37ef">
                  <img
                    src={getImageUrl(item.imageUrl)}
                    alt={item.blogTitle}
                    className="s-ourblog-2fa2db"
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/blog-banner.jpg'; }}
                  />
                </div>

                <div className="s-ourblog-dfa408">
                  {/* Title */}
                  <h3 className="s-ourblog-f3ba6d">
                    {item.blogTitle}
                  </h3>
                  {/* Description */}
                  {item.description && (
                    <p className="s-ourblog-2845fe">
                      {item.description}
                    </p>
                  )}
                  {/* Date + CTA — matches reference exactly */}
                  <div className="s-ourblog-533ca8">
                    <span className="s-quickcart-08341f">
                      {formatDate(item.createdDate)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/blog-1/${item.blogId}`); }}
                      className="s-ourblog-b470e0">
                      Unfold the Story →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      </div>
  );
}