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

const GAP = 12;

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
        className="s-home-eb8359"
      >
        No products yet
      </p>
    );

  return (
    <div
      ref={wrapRef}
      className="s-home-1e81b6"
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {viewAllPath && (
        <button
          onClick={() => navigate(viewAllPath)}
          className="s-home-54af6d" style={ {right: showArrows ? 52 : 0} }
        >
          View All →
        </button>
      )}

      {showArrows && (
        <>
          <button
            onClick={() => scrollBy(-1)}
            className="s-home-edfe26"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="s-home-fe2d0f"
          >
            ›
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        onScroll={onScrollHandler}
        className="s-home-4ec7f1" style={ {gap: GAP, overflowX: shouldScroll ? "auto" : "hidden", ...(showArrows ? { marginLeft: 44, marginRight: 44 } : {})} }
      >
        {tripled.map((p, i) => (
          <div
            key={`${p.productVariantId}-${i}`}
            className="s-home-685bdd" style={{ flex: `0 0 ${safeCw}px`, width: safeCw, minWidth: safeCw }}
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
          className="s-home-78e566"
        >
          {products.map((_, i) => (
            <span
              key={i}
              onClick={() => scrollToCard(i)}
              className="s-home-9bff23" style={ {width: activeIndex === i ? 20 : 7, background: activeIndex === i ? 'var(--brand)' : 'var(--heirloom)'} }
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
      className="s-home-1428f7"
    >
      <h2
        className="section-title s-home-58ca8b"
        style={{
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
      className="shipping_section s-home-bcf04f"
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
                <h3 className="s-home-2574d7">{f.title}</h3>
                <p className="s-home-3ab850">{f.sub}</p>
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
  const baseBrands = publicBrandImages;
  const itemWidth = 250,
    itemHeight = 140,
    gap = 40,
    durationSeconds = 34;
  const setWidth = Math.max(
    0,
    baseBrands.length * itemWidth + Math.max(0, baseBrands.length - 1) * gap,
  );
  const logoSlideScale = 1.22;
  const getImgScale = (src: string) =>
    src.includes("/assets/brands/logo-slide-") ? logoSlideScale : 1;

  return (
    <section
      className="s-home-be6933"
    >
      <div
        className="s-home-b9d256"
      />
      <div className="container s-home-59ddea">
        <SectionTitle title="Brands" />
        <div
          className="brand-marquee s-home-68cb82" style={ {["--brand-gap" as any]: `${gap}px`, ["--brand-duration" as any]: `${durationSeconds}s`, ["--brand-set-width" as any]: `${setWidth}px`} }
        >
          <div className="brand-marquee-track">
            {[...baseBrands, ...baseBrands].map((img, i) => (
              <div
                key={`${img}-${i}`}
                className="brand-marquee-item"
                style={ {
                  width: itemWidth,
                  minWidth: itemWidth,
                  height: itemHeight,
                  marginRight:
                    i % baseBrands.length === baseBrands.length - 1 ? 0 : gap,
                } }
              >
                <img
                  src={img}
                  alt={`Brand ${i}`}
                  className="s-home-783e28" style={ {transform: `scale(${getImgScale(img)})`} }
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

// ─── Hero Banner with 360° Orbit ─────────────────────────────────────────────
function HeroBanner({ orbitProducts }: { orbitProducts: any[] }) {
  const navigate = useNavigate();
  const ORBIT_R = 300;
  const ORBIT_DUR = 22;
  const orbitItems = orbitProducts.slice(0, 8);
  const count = Math.max(orbitItems.length, 1);

  const stars = useMemo(
    () =>
      Array.from({ length: 65 }, (_, k) => ({
        id: k,
        size: Math.random() * 2.5 + 0.5,
        left: Math.random() * 100,
        top: Math.random() * 100,
        dur: 2 + Math.random() * 4,
        delay: Math.random() * 5,
      })),
    [],
  );

  return (
    <div
      className="s-home-7a0874"
    >
      {/* Deep space background */}
      <div
        className="s-home-122982"
      />

      {/* Grain texture */}
      <div
        className="s-home-489f94"
      />

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="s-home-98dae8 s-home-62280e" style={{ width: s.size, height: s.size, left: `${s.left}%`, top: `${s.top}%`, animation: `star-blink ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s`, pointerEvents: "none" }}
        />
      ))}

      {/* Decorative spinning rings */}
      {[
        { d: 640, dur: 60, rev: false, dash: "8 18" },
        { d: 490, dur: 45, rev: true, dash: "4 12" },
        { d: 340, dur: 30, rev: false, dash: "2 8" },
      ].map(({ d, dur, rev, dash }, k) => (
        <div
          key={d}
          className="s-home-1925fd" style={ { width: d, height: d } }
        >
          <svg
            width={d}
            height={d}
            className="s-home-8a6320" style={ {animation: `${rev ? "ring-spin-rev" : "ring-spin"} ${dur}s linear infinite`} }
          >
            <circle
              cx={d / 2}
              cy={d / 2}
              r={d / 2 - 1}
              fill="none"
              stroke={`rgba(158,96,112,${0.3 - k * 0.07})`}
              strokeWidth="1"
              strokeDasharray={dash}
            />
          </svg>
        </div>
      ))}

      {/* TWAM FEATURED headline */}
      <div
        className="s-home-f8908f"
      >
        <div
          className="s-home-ff1b89"
        >
          ✦&thinsp; TWAM FEATURED &thinsp;✦
        </div>
        <p
          className="s-home-98096a"
        >
          Comfort &nbsp;·&nbsp; Elegance &nbsp;·&nbsp; Style
        </p>
      </div>

      {/* Ambient glow */}
      <div
        className="s-home-7f0e6f"
      />

      {/* Model image — elevated & floating */}
      <img
        src="/assets/.png"
        alt="TWAM Featured"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
        className="s-home-c76b11"
      />

      {/* Orbiting product cards */}
      {orbitItems.length > 0 && (
        <div
          className="s-home-6baa2b"
        >
          {orbitItems.map((p, i) => {
            const delayS = -((i / count) * ORBIT_DUR);
            const imgSrc = getImageUrl(
              p.imageUrl ??
                p.image ??
                p.productImage ??
                p.thumbnail ??
                p.variantImage ??
                "",
              "",
            );
            return (
              <div
                key={`ob-${p.productVariantId ?? i}-${i}`}
                className="s-home-db0758 s-home-d35c85" style={{ animation: `orbit-go ${ORBIT_DUR}s linear infinite`, animationDelay: `${delayS}s` }}
              >
                <div
                  className="s-home-517646 s-home-c6ae21" style={{ animation: `face-go ${ORBIT_DUR}s linear infinite`, animationDelay: `${delayS}s` }}
                  onClick={() =>
                    navigate(
                      `/user-products/product-detail/${p.productVariantId}/${slugify(p.productName ?? "product")}`,
                    )
                  }
                >
                  <div
                    className="twam-orbit-card s-home-b20fd0"
                  >
                    <div
                      className="s-home-fbcd5b"
                    >
                      <img
                        src={imgSrc}
                        alt={p.productName ?? "Product"}
                        className="s-home-5a5ce8"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div
                      className="s-home-3c1e54"
                    >
                      <p
                        className="s-home-720656"
                      >
                        {p.productName ?? "Product"}
                      </p>
                      {(p.sellingPrice ?? p.price) != null && (
                        <p
                          className="s-home-e27872"
                        >
                          ₹{p.sellingPrice ?? p.price}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Home Component ─────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
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

  // ── Find TWAM brand ID from the brands list ──────────────────────────────
  const twamBrandId = useMemo(() => {
    const list: any[] = brandsData?.list ?? [];
    const found = list.find(
      (b) =>
        b.brandName?.toLowerCase().includes("twam") ||
        b.name?.toLowerCase().includes("twam"),
    );
    return found?.brandId ?? found?.id ?? null;
  }, [brandsData]);

  // ── Fetch TWAM brand products for the orbit ──────────────────────────────
  const { data: twamProductsData } = useQuery({
    queryKey: ["twam-orbit-products", twamBrandId],
    enabled: twamBrandId != null,
    queryFn: () =>
      api
        .get("/ProductVariantDetail/UserProductVariantDetail", {
          params: {
            "filters[0].property": "Product.BrandId",
            "filters[0].comparison": "eq",
            "filters[0].value": String(twamBrandId),
            "order.property": "ModifiedDate",
            "order.ascending": false,
            "page.size": 8,
          },
        })
        .then((r) => r.data?.list ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // Fallback: if brand not found or returns empty, use bestSellers
  const orbitProducts: any[] = useMemo(() => {
    if (twamProductsData && twamProductsData.length > 0)
      return twamProductsData;
    return dashboard?.bestSellers?.slice(0, 8) ?? [];
  }, [twamProductsData, dashboard]);

  const { data: reviewsRaw } = useQuery({
    queryKey: ["reviews-home"],
    queryFn: () =>
      listUserReviews({
        Filters: JSON.stringify([
          { property: "rating", comparison: "gte", value: 4 },
        ]),
        "Order.Property": "createdDate",
        "Order.Ascending": false,
        "Page.Size": 12,
      }),
    select: (d: any) =>
      (d?.list ?? []).filter((r: any) => !!r.productVariantId),
    staleTime: 0,
    refetchOnMount: true,
  });

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
    <div className="s-home-bcf04f">
      {/* ── Hero Banner — replaces old static image ── */}
      <HeroBanner orbitProducts={orbitProducts} />
      <div className="section-gap" />

      <section
        className="best-sellers best-sellers-bg best-sellers-bg-1 s-home-42eb71"
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
        className="best-sellers s-home-51e4ca"
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
        className="s-home-7af910"
      >
        <div className="container">
          <SectionTitle title="Shop by Category" highlight />
          <div className="category-buttons s-home-5e0218">
            {menus.map((cat: CategoryMenu) => (
              <button
                key={cat.categoryId}
                onClick={() => handleCategorySelect(cat)}
                className={`${selectedCategoryId === cat.categoryId ? "active" : ""} s-home-2574d7`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {categoryProducts === null ? (
            <div
              className="s-home-0b4322"
            >
              <div
                className="s-home-0349cd"
              />
              </div>
          ) : categoryProducts.length > 0 ? (
            <ProductSlider
              products={categoryProducts}
              onQuickShop={setQuickShopId}
            />
          ) : (
            <p
              className="s-home-374f3d"
            >
              No products in this category yet.
            </p>
          )}
        </div>
      </section>

      {reviews.length > 0 && (
        <>
          <div className="section-gap" />
          <section className="testimonial-section">
            <div className="container">
              <SectionTitle title="Testimonials" />
              <div
                className="s-home-2448b9"
              >
                {reviews.map((r: any, i: number) => {
                  const canNav = !!r.productVariantId;
                  const handleTestimonialClick = () => {
                    if (!canNav) return;
                    navigate(
                      `/user-products/product-detail/${r.productVariantId}/${slugify(r.productName || r.name || "product")}?tab=reviews`,
                    );
                  };
                  const hasUserPhoto = !!r.photo;
                  const photoSrc = hasUserPhoto
                    ? getImageUrl(r.photo, "")
                    : null;
                  return (
                    <div
                      key={i}
                      className="testimonial-card s-home-dce984"
                      onClick={handleTestimonialClick} style={ {cursor: canNav ? "pointer" : "default"} }
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
                      <div
                        className="s-home-ba3c41"
                      >
                        {hasUserPhoto && (
                          <div className="s-addresslist-f8b697">
                            <img
                              src={photoSrc!}
                              alt={r.name || "reviewer"}
                              className="s-home-f49f79"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        )}
                        <p
                          className="quote s-home-2242ed"
                        >
                          "{r.comment}"
                        </p>
                      </div>
                      <div
                        className="s-home-6ebbb3"
                      >
                        <div
                          className="s-home-8c7d4e"
                        >
                          <i
                            className="bi bi-person-fill s-home-0820cb"
                          />
                        </div>
                        <div>
                          <h4 className="s-home-918042">
                            {r.name || r.displayName}
                          </h4>
                          <div
                            className="stars s-home-5c2fcc"
                          >
                            {Array.from({ length: 5 }).map((_, j) => (
                              <i
                                key={j}
                                className={`${j < r.rating
                                    ? "bi bi-star-fill"
                                    : "bi bi-star"} s-home-b3de66`} style={ {color: j < r.rating ? 'var(--blush)' : "var(--ivory)"} }
                              />
                            ))}
                          </div>
                          {canNav && r.productName && (
                            <p
                              className="s-home-398bbc"
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
