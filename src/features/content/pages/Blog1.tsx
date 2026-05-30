import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBlogDetail, listBlogs } from "@/features/products/api/products.api";
import { formatDate } from "@/shared/utils/helpers";
import api from "@/shared/api/axiosInstance";

const BASE_URL = "http://localhost:8000"; // same as AdminBlog

export default function Blog1() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: blog, isLoading } = useQuery({
    queryKey: ["blog", id],
    queryFn: () => getBlogDetail(Number(id)),
    enabled: !!id,
    staleTime: 15 * 60 * 1000,
  });

  const { data: blogsData, error: blogError } = useQuery({
    queryKey: ["blogs-sidebar"],
    queryFn: () =>
      api.get("/Blog").then((r) => {
        console.log("raw blog response:", r.data);
        return r.data;
      }),
  });

  console.log("blogError:", blogError);
  console.log("blogsData:", blogsData);

  const recentBlogs = (blogsData?.list ?? []).filter(
    (b: any) => String(b.blogId) !== String(id),
  );
  console.log("blogsData:", blogsData);
  console.log("recentBlogs:", recentBlogs);

  if (isLoading)
    return (
      <div
        className="container"
        style={{ padding: "32px 20px", maxWidth: 860 }}
      >
        <div
          className="twam-skel"
          style={{ height: 320, borderRadius: 14, marginBottom: 28 }}
        />
        <div
          className="twam-skel"
          style={{
            height: 14,
            width: "30%",
            borderRadius: 5,
            marginBottom: 14,
          }}
        />
        <div
          className="twam-skel"
          style={{
            height: 28,
            width: "70%",
            borderRadius: 6,
            marginBottom: 20,
          }}
        />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="twam-skel"
            style={{
              height: 13,
              width: i % 2 === 0 ? "90%" : "100%",
              borderRadius: 5,
              marginBottom: 10,
            }}
          />
        ))}
      </div>
    );

  // ✅ build banner image the same way admin does
  const bannerImage = blog?.imageUrl
    ? `${BASE_URL}${blog.imageUrl}`
    : blog?.uploadFileModel?.[0]?.fileData ?? null;

  return (
    <div className="s-blog1-0599f3">
      <div className="container">
        <div className="s-blog1-b06919">
          {/* Main blog content */}
          <div className="s-blog1-0662fd">
            <div className="s-adminnewslet-70cb1d">
              <p className="s-blog1-898b62">Featured Blog</p>
              <h1 className="s-blog1-e60920">{blog?.blogTitle}</h1>
              <p className="s-quickcart-08341f">
                {formatDate(blog?.createdDate)}
              </p>
            </div>

            {/* ✅ Banner image */}
            {bannerImage && (
              <img
                src={bannerImage}
                alt={blog?.blogTitle}
                className="s-blog1-010055"
              />
            )}

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
              {recentBlogs.slice(0, 3).map((item: any) => {
                // ✅ same pattern as AdminBlog
                const thumbUrl = item.imageUrl
                  ? `${BASE_URL}${item.imageUrl}`
                  : "/assets/images/10683.jpg";

                return (
                  <article
                    key={item.blogId}
                    onClick={() => navigate(`/blog-1/${item.blogId}`)}
                    className="s-blog1-499fe6"
                  >
                    <img
                      src={thumbUrl}
                      alt={item.blogTitle}
                      className="s-blog1-f7413d"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/images/10683.jpg";
                      }}
                    />
                    <div className="s-app-52dcac">
                      <h4 className="s-blog1-3b7681">{item.blogTitle}</h4>
                      <p className="s-blog1-defdec">
                        {formatDate(item.createdDate)}
                      </p>
                      <span className="s-blog1-953181">Read more →</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
