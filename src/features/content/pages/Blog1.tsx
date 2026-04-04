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
    <div className="s-blog1-3b196e">
      <div className="s-blog1-da8e4b" />
      </div>
  );

  return (
    <div className="s-blog1-0599f3">
      <div className="container">
        <div className="s-blog1-b06919">

          {/* Main blog content */}
          <div className="s-blog1-0662fd">
            {/* Header */}
            <div className="s-adminnewslet-70cb1d">
              <p className="s-blog1-898b62">Featured Blog</p>
              <h1 className="s-blog1-e60920">{blog?.blogTitle}</h1>
              <p className="s-quickcart-08341f">{formatDate(blog?.createdDate)}</p>
            </div>

            {/* Banner image */}
            {blog?.uploadFileModel?.[0]?.fileData && (
              <img src={blog.uploadFileModel[0].fileData} alt={blog.blogTitle}
                className="s-blog1-010055" />
            )}

            {/* Blog HTML content (same as Angular's [innerHTML]) */}
            {blog?.blogContent && (
              <div
                dangerouslySetInnerHTML={{ __html: blog.blogContent }}
                className="s-blog1-e72588"
              />
            )}

            {!blog && !isLoading && (
              <p className="s-blog1-abeb07">Blog not found.</p>
            )}
          </div>

          {/* Sidebar — Recent Blogs */}
          <div className="s-blog1-9c9546">
            <h3 className="s-blog1-b03ae9">Recent Blog Posts</h3>
            <div className="s-blog1-31b022">
              {recentBlogs.slice(0, 3).map((item: any) => (
                <article key={item.blogId}
                  onClick={() => navigate(`/blog-1/${item.blogId}`)}
                  className="s-blog1-499fe6">
                  <img src={item.imageUrl || '/assets/images/10683.jpg'} alt={item.blogTitle}
                    className="s-blog1-f7413d"
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/images/10683.jpg'; }} />
                  <div className="s-app-52dcac">
                    <h4 className="s-blog1-3b7681">
                      {item.blogTitle}
                    </h4>
                    <p className="s-blog1-defdec">{formatDate(item.createdDate)}</p>
                    <span className="s-blog1-953181">Read more →</span>
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