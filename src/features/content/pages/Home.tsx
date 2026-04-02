import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getUserDashboard,
  listBrands,
  listUserReviews,
} from "@/features/products/api/products.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMenuStore } from "@/shared/store/menuStore";
import { getCategories } from "@/features/auth/api/auth.api";
import api from "@/shared/api/axiosInstance";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import type { CategoryMenu } from "@/shared/types";
import toast from "react-hot-toast";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";

import ProductCard from "@/features/products/components/ProductCard";

const PRI = "#6B0F2A"; // Burgundy
const HEIRLOOM = "#9E6070"; // Heirloom Rose
const BLUSH = "#A84C6B"; // Blush Pink
const IVORY = "#F5F0E6"; // Warm Ivory
const GAP = 12;

// ─── Public brand images (moved outside component to avoid stale closure) ────
const publicBrandImages = [
  "/assets/brands/amante.webp",
  "/assets/brands/blossom.png",
  "/assets/brands/enamore.png",
  "/assets/brands/logo-slide-1.png",
  "/assets/brands/logo-slide-2.png",
  "/assets/brands/logo-slide-3.png",
  "/assets/brands/logo-slide-4.png",
  "/assets/brands/logo-slide-5.png",
  "/assets/brands/logo-slide-6.png",
  "/assets/brands/soie.webp",
  "/assets/brands/Triumph.png",
];

// ─── Product Slider ───────────────────────────────────────────────────────────
function ProductSlider({
  products,
  onQuickShop,
  viewAllPath,
}: {
  products: any[];
  onQuickShop: (id: number) => void;
  viewAllPath?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const isJumping = useRef(false);
  const navigate = useNavigate();

  const [cw, setCw] = useState(0);
  const [vis, setVis] = useState(4);
  const [activeIndex, setActiveIndex] = useState(0);

  const numProducts = products.length;
  const shouldScroll = numProducts > vis;
  const showArrows = shouldScroll;

  const tripled = useMemo(() => {
    return shouldScroll ? [...products, ...products, ...products] : products;
  }, [products, shouldScroll]);

  const singleW = useMemo(() => {
    if (!cw || numProducts === 0) return 0;
    return numProducts * (cw + GAP);
  }, [cw, numProducts]);

  const measure = useCallback(() => {
    const sw = window.innerWidth;
    const v = sw < 640 ? 1 : sw < 1024 ? 2 : 6;
    const wrapWidth = wrapRef.current?.clientWidth ?? sw;
    const trackWidth = showArrows ? wrapWidth - 88 : wrapWidth;
    const c = Math.floor((trackWidth - GAP * (v - 1)) / v);
    setVis(v);
    setCw(c);
  }, [showArrows]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!shouldScroll || !scrollRef.current || singleW === 0) return;
    isJumping.current = true;
    scrollRef.current.scrollLeft = singleW;
    requestAnimationFrame(() => {
      isJumping.current = false;
    });
  }, [singleW, shouldScroll]);

  const onScrollHandler = useCallback(() => {
    if (!shouldScroll) return;
    if (isJumping.current || !scrollRef.current || singleW === 0) return;
    const sl = scrollRef.current.scrollLeft;
    if (sl >= singleW * 2) {
      isJumping.current = true;
      scrollRef.current.scrollLeft = sl - singleW;
      requestAnimationFrame(() => {
        isJumping.current = false;
      });
    } else if (sl < singleW * 0.5) {
      isJumping.current = true;
      scrollRef.current.scrollLeft = sl + singleW;
      requestAnimationFrame(() => {
        isJumping.current = false;
      });
    }
    const idx =
      Math.round((sl % singleW) / (cw + GAP)) % Math.max(numProducts, 1);
    setActiveIndex(idx);
  }, [singleW, cw, numProducts, shouldScroll]);

  useEffect(() => {
    if (!shouldScroll || singleW === 0) return;
    let lastTime = 0;
    const PX_PER_MS = 0.04;
    const tick = (now: number) => {
      if (
        !pausedRef.current &&
        !document.body.dataset.qsPaused &&
        scrollRef.current
      ) {
        const delta = now - lastTime;
        scrollRef.current.scrollLeft += PX_PER_MS * delta;
      }
      lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame((now) => {
      lastTime = now;
      tick(now);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldScroll, singleW]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current || !cw) return;
    // Move 2 products at a time
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + dir * 2 * (cw + GAP),
      behavior: "smooth",
    });
  };

  const scrollToCard = (index: number) => {
    if (!scrollRef.current || !cw) return;
    const target = shouldScroll
      ? singleW + index * (cw + GAP)
      : index * (cw + GAP);
    scrollRef.current.scrollTo({ left: target, behavior: "smooth" });
  };

  const safeCw = cw > 0 ? cw : 280;

  if (!products.length)
    return (
      <p
        style={{
          textAlign: "center",
          color: PRI,
          padding: "20px 0",
          fontFamily: '"Palatino Linotype", "Trebuchet MS", serif',
        }}
      >
        No products yet
      </p>
    );

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {viewAllPath && (
        <button
          onClick={() => navigate(viewAllPath)}
          style={{
            position: "absolute",
            top: -30,
            right: showArrows ? 52 : 0,
            zIndex: 30,
            background: "rgba(245,240,230,0.88)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: `1.5px solid ${PRI}`,
            color: PRI,
            padding: "4px 18px",
            borderRadius: 40,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: '"Palatino Linotype", "Trebuchet MS", serif',
            boxShadow: "0 2px 16px rgba(107,15,42,0.10)",
          }}
        >
          View All →
        </button>
      )}

      {showArrows && (
        <>
          <button
            onClick={() => scrollBy(-1)}
            style={{
              position: "absolute",
              left: 0,
              top: "42%",
              transform: "translateY(-50%)",
              zIndex: 10,
              background: "#fff",
              border: `1.5px solid ${HEIRLOOM}`,
              borderRadius: "50%",
              width: 40,
              height: 40,
              fontSize: 24,
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(107,15,42,.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: PRI,
            }}
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            style={{
              position: "absolute",
              right: 0,
              top: "42%",
              transform: "translateY(-50%)",
              zIndex: 10,
              background: "#fff",
              border: `1.5px solid ${HEIRLOOM}`,
              borderRadius: "50%",
              width: 40,
              height: 40,
              fontSize: 24,
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(107,15,42,.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: PRI,
            }}
          >
            ›
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        onScroll={onScrollHandler}
        style={{
          display: "flex",
          gap: GAP,
          overflowX: shouldScroll ? "auto" : "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "8px 0 20px",
          ...(showArrows ? { marginLeft: 44, marginRight: 44 } : {}),
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {tripled.map((p, i) => (
          <div
            key={`${p.productVariantId}-${i}`}
            style={{ flex: `0 0 ${safeCw}px`, width: safeCw, minWidth: safeCw }}
          >
            <ProductCard
              product={p}
              onQuickShop={onQuickShop}
              showColors={false}
              showDiscountTag={false}
            />
          </div>
        ))}
      </div>

      {showArrows && products.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          {products.map((_, i) => (
            <span
              key={i}
              onClick={() => scrollToCard(i)}
              style={{
                width: activeIndex === i ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: activeIndex === i ? PRI : HEIRLOOM,
                transition: "width .3s, background .3s",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
function SectionTitle({
  title,
  highlight,
}: {
  title: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 0 10px",
        fontFamily: '"Palatino Linotype", "Trebuchet MS", serif',
      }}
    >
      <h2
        className="section-title"
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 600,
          color: PRI,
          letterSpacing: "-0.5px",
          ...(highlight
            ? {
                background: "rgba(245,240,230,0.88)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                padding: "8px 28px",
                borderRadius: 40,
                boxShadow: "0 2px 16px rgba(107,15,42,0.10)",
              }
            : {}),
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function ShippingBar() {
  return (
    <section
      className="shipping_section"
      style={{ fontFamily: '"Palatino Linotype", "Trebuchet MS", serif' }}
    >
      <div className="container">
        <div className="shipping_inner">
          {[
            {
              icon: "bi bi-cursor",
              title: "Free Shipping",
              sub: "Orders over ₹5000",
            },
            {
              icon: "bi bi-arrow-repeat",
              title: "Free Returns",
              sub: "Within 15 days",
            },
            {
              icon: "bi bi-lock",
              title: "100% Payment Secure",
              sub: "Payment Online",
            },
            { icon: "bi bi-tag", title: "Affordable Price", sub: "Guaranteed" },
          ].map((f) => (
            <div key={f.title} className="single_shipping">
              <div className="shipping_icon">
                <i className={`${f.icon} icons`} />
              </div>
              <div className="shipping_text">
                <h3 style={{ color: PRI }}>{f.title}</h3>
                <p style={{ color: HEIRLOOM }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Brands Marquee ───────────────────────────────────────────────────────────
function BrandsSection({ logos: _logos }: { logos: any[] }) {
  const baseBrands = publicBrandImages; // using module-level constant — no useMemo needed

  const itemWidth = 250;
  const itemHeight = 140;
  const gap = 40;
  const durationSeconds = 34;
  const setWidth = Math.max(
    0,
    baseBrands.length * itemWidth + Math.max(0, baseBrands.length - 1) * gap,
  );

  const logoSlideScale = 1.22;
  const getImgScale = (src: string) =>
    src.includes("/assets/brands/logo-slide-") ? logoSlideScale : 1;

  return (
    <section
      style={{
        margin: 0,
        background: `linear-gradient(135deg, ${IVORY} 0%, rgba(245,240,230,0.5) 100%)`,
        padding: "30px 0",
        overflow: "hidden",
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(circle at 20% 50%, rgba(107,15,42,0.05) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />
      <div className="container" style={{ position: "relative", zIndex: 2 }}>
        <SectionTitle title="Brands" />
        <div
          className="brand-marquee"
          style={{
            padding: "18px 0 32px",
            ["--brand-gap" as any]: `${gap}px`,
            ["--brand-duration" as any]: `${durationSeconds}s`,
            ["--brand-set-width" as any]: `${setWidth}px`,
          }}
        >
          <div className="brand-marquee-track">
            {[...baseBrands, ...baseBrands].map((img, i) => (
              <div
                key={`${img}-${i}`}
                className="brand-marquee-item"
                style={{
                  width: itemWidth,
                  minWidth: itemWidth,
                  height: itemHeight,
                  marginRight:
                    i % baseBrands.length === baseBrands.length - 1 ? 0 : gap,
                }}
              >
                <img
                  src={img}
                  alt={`Brand ${i}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    transform: `scale(${getImgScale(img)})`,
                    transformOrigin: "center",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Home Component ─────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate(); // ✅ FIX: was missing, caused crash in testimonials
  const { getUserId } = useAuthStore();
  const { menus, setMenus } = useMenuStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [categoryProducts, setCategoryProducts] = useState<any[] | null>(null);
  const [quickShopId, setQuickShopId] = useState(0);

  useEffect(() => {
    const cached = sessionStorage.getItem("menus");
    if (cached) {
      try {
        const p = JSON.parse(cached);
        if (p.length) setMenus(p);
      } catch {}
    }
    getCategories({ roleId: 2 })
      .then((cats) => {
        if (cats?.length) {
          setMenus(cats);
          sessionStorage.setItem("menus", JSON.stringify(cats));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (menus.length && !selectedCategoryId) {
      setSelectedCategoryId(menus[0]?.categoryId);
      loadCategoryProducts(menus[0]?.categoryId);
    }
  }, [menus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (prefersReducedMotion) return;

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const els = Array.from(
        document.querySelectorAll<HTMLElement>('[data-home-3d="1"]'),
      );
      const vh = window.innerHeight || 1;
      els.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const offset = (center - vh / 2) / (vh / 2);
        const clamped = Math.max(-1, Math.min(1, offset));
        el.style.transform = `perspective(900px) rotateX(${clamped * -6}deg) translateY(${clamped * 10}px)`;
        el.style.opacity = String(1 - Math.abs(clamped) * 0.18);
      });
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document
        .querySelectorAll<HTMLElement>('[data-home-3d="1"]')
        .forEach((el) => {
          el.style.transform = "";
          el.style.opacity = "";
        });
    };
  }, []);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", getUserId()],
    queryFn: () => getUserDashboard({ userProfileId: getUserId() }),
  });
  const { data: brandsData } = useQuery({
    queryKey: ["brands-home"],
    queryFn: () =>
      listBrands({
        "Page.Size": 500,
        "Order.Property": "ModifiedDate",
        "Order.Ascending": false,
      }),
  });
  const { data: reviewsRaw } = useQuery({
    queryKey: ["reviews-home"],
    queryFn: () =>
      listUserReviews({
        Filters: JSON.stringify([
          { property: "rating", comparison: "gte", value: 4 },
        ]),
        "Order.Property": "createdDate",
        "Order.Ascending": false,
        "Page.Size": 12, // fetch more so we can filter down to 4 valid ones
      }),
    select: (d: any) =>
      (d?.list ?? []).filter((r: any) => !!r.productVariantId),
    staleTime: 0,
    refetchOnMount: true,
  });

  // Validate that each review's product still exists — filter out deleted products
  const { data: reviewsData } = useQuery({
    queryKey: [
      "reviews-home-validated",
      (reviewsRaw ?? []).map((r: any) => r.productVariantId).join(","),
    ],
    enabled: !!reviewsRaw && reviewsRaw.length > 0,
    queryFn: async () => {
      if (!reviewsRaw || reviewsRaw.length === 0) return [];
      const ids = reviewsRaw.map((r: any) => r.productVariantId).join(",");
      try {
        const res = await api.get(
          "/ProductVariantDetail/UserProductVariantDetail",
          {
            params: {
              "filters[0].property": "productVariantId",
              "filters[0].comparison": "in",
              "filters[0].value": ids,
              "page.size": reviewsRaw.length,
            },
          },
        );
        const existingIds = new Set(
          (res.data?.list ?? []).map((p: any) => p.productVariantId),
        );
        return (reviewsRaw as any[])
          .filter((r) => existingIds.has(r.productVariantId))
          .slice(0, 4);
      } catch {
        return (reviewsRaw as any[]).slice(0, 4);
      }
    },
    staleTime: 0,
  });

  const products = dashboard?.bestSellers ?? [];
  const newArrivals = dashboard?.newArrivals ?? [];
  const logos = brandsData?.list ?? [];
  const reviews = reviewsData ?? [];

  const loadCategoryProducts = async (catId: number) => {
    if (!catId) return;
    setCategoryProducts(null);
    try {
      const res = await api.get(
        "/ProductVariantDetail/UserProductVariantDetail",
        {
          params: {
            "filters[0].property": "Product.CategoryId",
            "filters[0].comparison": "in",
            "filters[0].value": String(catId),
            "order.property": "ModifiedDate",
            "order.ascending": false,
            "page.size": 12,
          },
        },
      );
      setCategoryProducts(res.data?.list ?? []);
    } catch {
      setCategoryProducts([]);
    }
  };

  const handleCategorySelect = (cat: CategoryMenu) => {
    setSelectedCategoryId(cat.categoryId);
    loadCategoryProducts(cat.categoryId);
  };

  return (
    <div style={{ fontFamily: '"Palatino Linotype", "Trebuchet MS", serif' }}>
      <div className="home-bannner">
        <img
          src="/assets/twam-banner.png"
          className="img-fluid"
          alt="TWAM Banner"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/assets/about-banner-2.jpg";
          }}
        />
      </div>
      <div className="section-gap" />

      <section
        className="best-sellers best-sellers-bg best-sellers-bg-1"
        style={{
          backgroundImage: "url(/assets/home/best-sellers1.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="container">
          <SectionTitle title="Best Sellers" highlight />
          <ProductSlider
            products={products}
            onQuickShop={setQuickShopId}
            viewAllPath="/user-products/product-list?isBestSeller=true"
          />
        </div>
      </section>
      <div className="section-gap" />

      <div className="product-offers">
        <img
          src="/assets/40-offer.png"
          className="img-fluid"
          alt="Special Offer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/assets/40-offer.jpg";
          }}
        />
      </div>
      <div className="section-gap" />

      <section
        className="best-sellers"
        style={{
          backgroundImage: "url(/assets/home/new-arrival.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="container">
          <SectionTitle title="New Arrivals" highlight />
          <ProductSlider
            products={newArrivals}
            onQuickShop={setQuickShopId}
            viewAllPath="/user-products/product-list?title=New+Arrivals"
          />
        </div>
      </section>
      <div className="section-gap" />

      <section
        style={{
          padding: "0 0 30px",
          backgroundImage: "url(/assets/home/category-model1.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="container">
          <SectionTitle title="Shop by Category" highlight />
          <div className="category-buttons" style={{ marginBottom: 18 }}>
            {menus.map((cat: CategoryMenu) => (
              <button
                key={cat.categoryId}
                onClick={() => handleCategorySelect(cat)}
                className={
                  selectedCategoryId === cat.categoryId ? "active" : ""
                }
                style={{ color: PRI }}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {categoryProducts === null ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "40px 0",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: `3px solid ${IVORY}`,
                  borderTopColor: PRI,
                  borderRadius: "50%",
                  animation: "spin .8s linear infinite",
                }}
              />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : categoryProducts.length > 0 ? (
            <ProductSlider
              products={categoryProducts}
              onQuickShop={setQuickShopId}
            />
          ) : (
            <p
              style={{
                textAlign: "center",
                color: HEIRLOOM,
                padding: "32px 0",
                fontSize: 15,
              }}
            >
              No products in this category yet.
            </p>
          )}
        </div>
      </section>

      {/* Testimonials moved here - below Shop by Category */}
      {reviews.length > 0 && (
        <>
          <div className="section-gap" />
          <section className="testimonial-section">
            <div className="container">
              <SectionTitle title="Testimonials" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 20,
                  paddingBottom: 16,
                  maxWidth: "100%",
                }}
              >
                {reviews.map((r: any, i: number) => {
                  const canNav = !!r.productVariantId;
                  const handleTestimonialClick = () => {
                    if (!canNav) return;
                    // Navigate to product detail and auto-open reviews tab
                    navigate(
                      `/user-products/product-detail/${r.productVariantId}/${slugify(r.productName || r.name || "product")}?tab=reviews`,
                    );
                  };
                  // Only show photo if the user explicitly uploaded one (r.photo only, not product image)
                  const hasUserPhoto = !!r.photo;
                  const photoSrc = hasUserPhoto
                    ? getImageUrl(r.photo, "")
                    : null;
                  return (
                    <div
                      key={i}
                      className="testimonial-card"
                      onClick={handleTestimonialClick}
                      style={{
                        cursor: canNav ? "pointer" : "default",
                        transition: "transform .2s, box-shadow .2s",
                      }}
                      onMouseEnter={(e) => {
                        if (canNav) {
                          (e.currentTarget as HTMLDivElement).style.transform =
                            "translateY(-3px)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow =
                            "0 8px 24px rgba(107,15,42,.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform =
                          "";
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                          "";
                      }}
                    >
                      {/* ── Top row: review image (left) + quote (right) ── */}
                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          alignItems: "flex-start",
                          marginBottom: 16,
                        }}
                      >
                        {/* Left: show photo only if user uploaded one */}
                        {hasUserPhoto && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={photoSrc!}
                              alt={r.name || "reviewer"}
                              style={{
                                width: 80,
                                height: 80,
                                borderRadius: 10,
                                objectFit: "cover",
                                border: "2px solid var(--border-color)",
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        )}
                        {/* Right: quote */}
                        <p
                          className="quote"
                          style={{ color: PRI, margin: 0, flex: 1 }}
                        >
                          "{r.comment}"
                        </p>
                      </div>

                      {/* ── Bottom row: profile icon (circle) + name + stars ── */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          borderTop: "1px solid var(--border-color)",
                          paddingTop: 12,
                        }}
                      >
                        {/* Circle avatar — always a person icon, never the product image */}
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "var(--ivory)",
                            border: "2px solid var(--border-color)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-person-fill"
                            style={{ color: "#6B0F2A", fontSize: 20 }}
                          />
                        </div>
                        <div>
                          <h4 style={{ color: PRI, margin: "0 0 3px" }}>
                            {r.name || r.displayName}
                          </h4>
                          <div
                            className="stars"
                            style={{ display: "flex", gap: 2 }}
                          >
                            {Array.from({ length: 5 }).map((_, j) => (
                              <i
                                key={j}
                                className={
                                  j < r.rating
                                    ? "bi bi-star-fill"
                                    : "bi bi-star"
                                }
                                style={{
                                  color: j < r.rating ? BLUSH : "#ddd",
                                  fontSize: 12,
                                }}
                              />
                            ))}
                          </div>
                          {canNav && r.productName && (
                            <p
                              style={{
                                margin: "3px 0 0",
                                fontSize: 11,
                                color: "#9E6070",
                                fontStyle: "italic",
                              }}
                            >
                              {r.productName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Brands moved here - above ShippingBar */}
      <div className="section-gap" />
      <BrandsSection logos={logos} />

      <div className="section-gap" />
      <ShippingBar />

      {quickShopId > 0 && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(0)}
        />
      )}
    </div>
  );
}
