import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  listProducts,
  listBrands,
  listUserReviews,
  listNewArrivals,
} from "@/features/products/api/products.api";
import { useMenuStore } from "@/shared/store/menuStore";
import { getCategories } from "@/features/auth/api/auth.api";
import api from "@/shared/api/axiosInstance";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import type { CategoryMenu } from "@/shared/types";
import QuickShopModal from "@/features/products/components/QuickShopModal";

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
  const pausedRef = useRef(false);
  const isJumping = useRef(false);
  const navigate = useNavigate();

  const [cw, setCw] = useState(0);
  const [vis, setVis] = useState(4);
  const [activeIndex, setActiveIndex] = useState(0);

  // ── Fix 3: Deduplicate products by productVariantId ──────────────────────
  const uniqueProducts = useMemo(() => {
    const seen = new Set<number>();
    return products.filter((p) => {
      const id = p.productVariantId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [products]);

  const numProducts = uniqueProducts.length;
  const shouldScroll = numProducts > vis;
  const showArrows = shouldScroll;

  const tripled = useMemo(() => {
    return shouldScroll
      ? [...uniqueProducts, ...uniqueProducts, ...uniqueProducts]
      : uniqueProducts;
  }, [uniqueProducts, shouldScroll]);

  const singleW = useMemo(() => {
    if (!cw || numProducts === 0) return 0;
    return numProducts * (cw + GAP);
  }, [cw, numProducts]);

  const measure = useCallback(() => {
    const sw = window.innerWidth;
    // Mobile (<640px): 2 cards visible (standard for fashion apps — Zivame/Myntra)
    // Tablet (<1024px): 3 cards  |  Desktop: 6 cards
    const v = sw < 640 ? 2 : sw < 1024 ? 3 : 6;
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

    // Step scroll: advance by (vis) cards every 5 seconds, then pause.
    // This matches standard e-commerce carousel UX (Zivame, Myntra, Clovia).
    const INTERVAL_MS = 5000;

    const step = () => {
      if (pausedRef.current || !scrollRef.current) return;
      // Scroll forward by exactly `vis` card widths
      const stepPx = vis * (cw + GAP);
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollLeft + stepPx,
        behavior: "smooth",
      });
    };

    const id = setInterval(step, INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldScroll, singleW, vis, cw]);

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

  if (!uniqueProducts.length)
    return <p className="s-home-eb8359">No products yet</p>;

  return (
    // Fix 1: outer column wrapper so View All sits above the slider track
    <div className="s-home-slider-outer">
      {viewAllPath && (
        <div className="s-home-slider-header">
          <button
            onClick={() => navigate(viewAllPath)}
            className="s-home-54af6d"
          >
            View All →
          </button>
        </div>
      )}
      <div
        ref={wrapRef}
        className="s-home-1e81b6"
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {showArrows && (
          <>
            <button onClick={() => scrollBy(-1)} className="s-home-edfe26">
              ‹
            </button>
            <button onClick={() => scrollBy(1)} className="s-home-fe2d0f">
              ›
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          onScroll={onScrollHandler}
          className="s-home-4ec7f1"
          style={{
            gap: GAP,
            overflowX: shouldScroll ? "auto" : "hidden",
            // Give the track enough top breathing room so that the card's
            // hover translateY(-6px) + scale(1.015) are never clipped.
            // NOTE: setting overflow-x:auto implicitly clips overflow-y,
            // so we compensate with extra padding-top instead of overflow-y:visible
            // (browsers disallow that combination).
            paddingTop: 18,
            marginTop: -10,
            ...(showArrows ? { marginLeft: 44, marginRight: 44 } : {}),
          }}
        >
          {tripled.map((p, i) => (
            <div
              key={`${p.productVariantId}-${i}`}
              className="s-home-685bdd"
              style={{
                flex: `0 0 ${safeCw}px`,
                width: safeCw,
                minWidth: safeCw,
              }}
            >
              <ProductCard
                product={p}
                onQuickShop={onQuickShop}
                showDiscountTag={false}
                singleColorOnly={true}
                compact={true}
              />
            </div>
          ))}
        </div>

        {showArrows && uniqueProducts.length > 0 && (
          <div className="s-home-78e566">
            {uniqueProducts.map((_, i) => (
              <span
                key={i}
                onClick={() => scrollToCard(i)}
                className="s-home-9bff23"
                style={{
                  width: activeIndex === i ? 20 : 7,
                  background:
                    activeIndex === i ? "var(--brand)" : "var(--heirloom)",
                }}
              />
            ))}
          </div>
        )}
      </div>
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
    <div className="s-home-1428f7">
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
    <section className="shipping_section s-home-bcf04f">
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
    <section className="s-home-be6933">
      <div className="s-home-b9d256" />
      <div className="container s-home-59ddea">
        <SectionTitle title="Brands" />
        <div
          className="brand-marquee s-home-68cb82"
          style={{
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
                  className="s-home-783e28"
                  style={{ transform: `scale(${getImgScale(img)})` }}
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

// ─── Mobile Product Slider ───────────────────────────────────────────────────
function MobileProductSlider({
  title,
  products,
  onQuickShop,
  viewAllPath,
  variant = "twam",
}: {
  title: string;
  products: any[];
  onQuickShop: (id: number) => void;
  viewAllPath?: string;
  variant?: "twam" | "bestsellers" | "new";
}) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  // Touch swipe state
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -40) next();
    else if (touchDeltaX.current > 40) prev();
    touchDeltaX.current = 0;
  };

  // Typing animation state
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "wait" | "erasing">("typing");

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed.length < title.length) {
        timeout = setTimeout(
          () => setTyped(title.slice(0, typed.length + 1)),
          80,
        );
      } else {
        timeout = setTimeout(() => setPhase("wait"), 4000);
      }
    } else if (phase === "wait") {
      timeout = setTimeout(() => setPhase("erasing"), 100);
    } else {
      if (typed.length > 0) {
        timeout = setTimeout(
          () => setTyped(title.slice(0, typed.length - 1)),
          50,
        );
      } else {
        timeout = setTimeout(() => setPhase("typing"), 300);
      }
    }
    return () => clearTimeout(timeout);
  }, [typed, phase, title]);

  const uniqueProducts = useMemo(() => {
    const seen = new Set<number>();
    return products.filter((p) => {
      if (seen.has(p.productVariantId)) return false;
      seen.add(p.productVariantId);
      return true;
    });
  }, [products]);

  const total = uniqueProducts.length;
  if (!total) return null;

  const prev = () => setIndex((i) => (i - 2 + total) % total);
  const next = () => setIndex((i) => (i + 2) % total);

  const card0 = uniqueProducts[index % total];
  const card1 = uniqueProducts[(index + 1) % total];

  const bgSrc =
    variant === "twam"
      ? "/assets/twam-featured.png"
      : variant === "bestsellers"
        ? "/assets/best-sellers.png"
        : variant === "new"
          ? "/assets/new-arrivals.png"
          : null;

  return (
    <div className={`mpsl-outer mpsl-outer--${variant}`}>
      {bgSrc && (
        <img src={bgSrc} alt="" aria-hidden="true" className="mpsl-bg-img" />
      )}
      <div className={`mpsl-wrap mpsl-wrap--${variant}`}>
        {/* Section header — variant-aware */}
        {variant === "twam" && (
          <div className="mpsl-header mpsl-header--twam">
            <div className="mpsl-title-wrap">
              <div className="mpsl-eyebrow">Our Selection</div>
              <span className="mpsl-title-text">
                {typed}
                <span className="mpsl-cursor">|</span>
              </span>
              <div className="mpsl-title-underline" />
            </div>
            {viewAllPath && (
              <button
                className="mpsl-view-all"
                onClick={() => navigate(viewAllPath)}
              >
                View All →
              </button>
            )}
          </div>
        )}
        {variant === "bestsellers" && (
          <div className="mpsl-header mpsl-header--bs">
            <div className="mpsl-title-wrap">
              <div className="mpsl-ghost-star">★</div>
              <span className="mpsl-title-text mpsl-title-text--bs">
                {typed}
                <span className="mpsl-cursor mpsl-cursor--bs">|</span>
              </span>
              <div className="mpsl-title-underline mpsl-title-underline--bs" />
            </div>
            {viewAllPath && (
              <button
                className="mpsl-view-all mpsl-view-all--bs"
                onClick={() => navigate(viewAllPath)}
              >
                View All →
              </button>
            )}
          </div>
        )}
        {variant === "new" && (
          <div className="mpsl-header mpsl-header--new">
            <div className="mpsl-title-wrap">
              <div className="mpsl-eyebrow mpsl-eyebrow--new">Just Dropped</div>
              <span className="mpsl-title-text mpsl-title-text--new">
                {typed}
                <span className="mpsl-cursor mpsl-cursor--new">|</span>
              </span>
              <div className="mpsl-title-underline mpsl-title-underline--new" />
            </div>
            {viewAllPath && (
              <button
                className="mpsl-view-all mpsl-view-all--new"
                onClick={() => navigate(viewAllPath)}
              >
                View All →
              </button>
            )}
          </div>
        )}

        {/* Cards: staggered, arrows overlaid left/right, swipe to navigate */}
        <div
          className="mpsl-track"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Left arrow — overlaid on left edge */}
          <button
            className="mpsl-arrow mpsl-arrow--left"
            onClick={prev}
            aria-label="Previous"
          >
            ‹
          </button>

          <div className="mpsl-cards">
            {/* Card 0: top */}
            <div className="mpsl-card mpsl-card--top">
              <MobileProductCard product={card0} onQuickShop={onQuickShop} />
            </div>
            {/* Card 1: bottom-right, offset down */}
            {card1 && (
              <div className="mpsl-card mpsl-card--bottom">
                <MobileProductCard product={card1} onQuickShop={onQuickShop} />
              </div>
            )}
          </div>

          {/* Right arrow — overlaid on right edge */}
          <button
            className="mpsl-arrow mpsl-arrow--right"
            onClick={next}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        {/* Dots */}
        <div className="mpsl-dots">
          {Array.from({ length: Math.ceil(total / 2) }).map((_, i) => (
            <span
              key={i}
              className={`mpsl-dot${Math.floor(index / 2) === i ? " mpsl-dot--active" : ""}`}
              onClick={() => setIndex(i * 2)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TWAM Featured Section ───────────────────────────────────────────────────
function TwamFeaturedSection({
  products,
  onQuickShop,
}: {
  products: any[];
  onQuickShop: (id: number) => void;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const TWAM_PATH = "/global-search?q=TWAM";

  if (isMobile) {
    return (
      <MobileProductSlider
        title="TWAM Featured"
        products={products}
        onQuickShop={onQuickShop}
        viewAllPath={TWAM_PATH}
        variant="twam"
      />
    );
  }
  return (
    <section
      className="best-sellers"
      style={{
        background: "var(--ivory)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background image — contained, no crop */}
      <img
        src="/assets/twam-featured.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "right center",
          opacity: 0.08,
          pointerEvents: "none",
          userSelect: "none",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <SectionTitle title="TWAM Featured" />
          <button
            onClick={() => navigate(TWAM_PATH)}
            className="s-home-54af6d"
            style={{ marginBottom: 12 }}
          >
            View All →
          </button>
        </div>
        <ProductSlider products={products} onQuickShop={onQuickShop} />
      </div>
    </section>
  );
}

// ─── Mobile Testimonial ──────────────────────────────────────────────────────
function MobileTestimonial({
  reviews,
  navigate,
}: {
  reviews: any[];
  navigate: (path: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = reviews.length;

  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  // Auto-scroll every 5s
  useEffect(() => {
    if (total < 2) return;
    timerRef.current = setInterval(next, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next, total]);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 5000);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -40) {
      next();
      resetTimer();
    } else if (touchDeltaX.current > 40) {
      prev();
      resetTimer();
    }
    touchDeltaX.current = 0;
  };

  if (!total) return null;
  const r = reviews[idx];
  const canNav = !!r.productVariantId;

  return (
    <section
      className="mob-testimonial-card"
      style={{
        background: "#fff",
        padding: "28px 22px 24px",
        borderTop: "0.5px solid rgba(107,15,42,0.1)",
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#9e6070",
          marginBottom: 16,
          fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
        }}
      >
        What women say
      </div>

      {/* Swipeable quote area */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (canNav)
            navigate(
              `/user-products/product-detail/${r.productVariantId}/${(r.productName || "product").toLowerCase().replace(/\s+/g, "-")}?tab=reviews`,
            );
        }}
        style={{ cursor: canNav ? "pointer" : "default", minHeight: 120 }}
      >
        {/* Stars */}
        <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
          {Array.from({ length: 5 }).map((_, j) => (
            <span
              key={j}
              style={{
                fontSize: 12,
                color: j < (r.rating ?? 5) ? "#6b0f2a" : "#f5f0e6",
              }}
            >
              ★
            </span>
          ))}
        </div>

        {/* Quote */}
        <p
          style={{
            fontFamily: '"Palatino Linotype",Palatino,Georgia,serif',
            fontSize: 16,
            fontWeight: 700,
            color: "#000",
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          &ldquo;{r.comment}&rdquo;
        </p>

        {/* Rule */}
        <div
          style={{
            height: 0.5,
            background: "rgba(107,15,42,0.12)",
            marginBottom: 12,
          }}
        />

        {/* Attribution */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9e6070",
            fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
          }}
        >
          {r.name || r.displayName}
        </div>
        {r.productName && (
          <div
            style={{
              fontSize: 8,
              color: "rgba(107,15,42,0.4)",
              marginTop: 2,
              fontWeight: 600,
              fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
            }}
          >
            {r.productName}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div
          style={{
            display: "flex",
            gap: 5,
            marginTop: 18,
            justifyContent: "center",
          }}
        >
          {reviews.map((_, i) => (
            <span
              key={i}
              onClick={() => {
                setIdx(i);
                resetTimer();
              }}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: i === idx ? 3 : "50%",
                background: i === idx ? "#6b0f2a" : "rgba(107,15,42,0.15)",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "inline-block",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main Home Component ─────────────────────────────────────────────────────
export default function Home() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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

  // ── Best Sellers — same API as ProductList so field names match ProductCard ─
  // Deduplicate by productId (API returns one row per colour variant).
  const dedupeByProductId = (d: any) => {
    const seen = new Set<number>();
    return (d?.list ?? []).filter((p: any) => {
      if (seen.has(p.productId)) return false;
      seen.add(p.productId);
      return true;
    });
  };

  const { data: bestSellersProducts = [] } = useQuery({
    queryKey: ["home-best-sellers"],
    queryFn: () => listProducts({ isBestSeller: true, pageSize: 40 }),
    select: dedupeByProductId,
    staleTime: 5 * 60 * 1000,
  });

  // ── New Arrivals — products added in the last 6 months (server-side date filter) ─
  const { data: newArrivalsProducts = [] } = useQuery({
    queryKey: ["home-new-arrivals"],
    queryFn: () => listNewArrivals({ pageSize: 40 }),
    select: dedupeByProductId,
    staleTime: 5 * 60 * 1000,
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

  // ── Fetch TWAM brand products for the featured slider ────────────────────
  const { data: twamFeaturedProducts = [] } = useQuery({
    queryKey: ["home-twam-featured", twamBrandId],
    enabled: twamBrandId != null,
    queryFn: () => listProducts({ brandIds: twamBrandId, pageSize: 40 }),
    select: dedupeByProductId,
    staleTime: 5 * 60 * 1000,
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

  // products & newArrivals now come directly from the same
  // /ProductVariantDetail/UserProductVariantDetail endpoint that ProductList
  // uses — field names are guaranteed to match what ProductCard reads.
  const products = bestSellersProducts;
  const newArrivals = newArrivalsProducts;
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
      {/* TWAM Banner — mobile uses mobile-banner.png */}
      <section className="product-offers" aria-label="TWAM Banner">
        <img
          src={isMobile ? "/assets/mobile-banner.png" : "106802.png"}
          className="img-fluid"
          alt="TWAM Banner"
          onError={(e) => {
            (e.target as HTMLImageElement).src = isMobile
              ? "/assets/mobile-banner.jpg"
              : "/assets/106802.png";
          }}
        />
      </section>
      <div className="section-gap" />

      {/* TWAM Featured */}
      <TwamFeaturedSection
        products={twamFeaturedProducts}
        onQuickShop={setQuickShopId}
      />

      {/* Testimonials — mobile only: right below TWAM Featured */}
      {isMobile && reviews.length > 0 && (
        <MobileTestimonial reviews={reviews} navigate={navigate} />
      )}

      <div className="section-gap" />

      {isMobile ? (
        <MobileProductSlider
          title="Best Sellers"
          products={products}
          onQuickShop={setQuickShopId}
          viewAllPath="/best-sellers"
          variant="bestsellers"
        />
      ) : (
        <section className="best-sellers best-sellers-bg best-sellers-bg-1 s-home-42eb71">
          <div className="container">
            <SectionTitle title="Best Sellers" highlight />
            <ProductSlider
              products={products}
              onQuickShop={setQuickShopId}
              viewAllPath="/best-sellers"
            />
          </div>
        </section>
      )}
      <div className="section-gap" />

      {isMobile ? (
        <MobileProductSlider
          title="New Arrivals"
          products={newArrivals}
          onQuickShop={setQuickShopId}
          viewAllPath="/new-arrivals"
          variant="new"
        />
      ) : (
        <section className="best-sellers s-home-51e4ca">
          <div className="container">
            <SectionTitle title="New Arrivals" highlight />
            <ProductSlider
              products={newArrivals}
              onQuickShop={setQuickShopId}
              viewAllPath="/new-arrivals"
            />
          </div>
        </section>
      )}
      <div className="section-gap" />

      {isMobile ? (
        /* ── V2 Brand Promise — Pure White, mobile only ── */
        <section
          className="mob-promise-card"
          style={{
            background: "#ffffff",
            padding: "34px 22px 30px",
            borderTop: "0.5px solid rgba(0,0,0,0.07)",
            borderBottom: "0.5px solid rgba(0,0,0,0.07)",
          }}
        >
          {/* Eyebrow */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#9e6070",
                fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
                marginBottom: 5,
              }}
            >
              The TWAM Promise
            </p>
            <div
              style={{
                height: 2,
                width: 52,
                background: "#9e6070",
                borderRadius: 1,
                opacity: 0.5,
              }}
            />
          </div>

          {/* Top rule */}
          <div
            style={{
              height: 0.5,
              background: "#000",
              opacity: 0.08,
              marginBottom: 22,
            }}
          />

          {/* Serif quote */}
          <p
            style={{
              fontFamily: '"Palatino Linotype",Palatino,Georgia,serif',
              fontSize: 20,
              fontWeight: 700,
              color: "#000",
              lineHeight: 1.28,
              marginBottom: 8,
            }}
          >
            &ldquo;You deserve comfort without compromise.&rdquo;
          </p>

          {/* Attribution */}
          <p
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#9e6070",
              marginBottom: 26,
              fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
            }}
          >
            — Designed for every woman
          </p>

          {/* Bottom rule */}
          <div
            style={{
              height: 0.5,
              background: "#000",
              opacity: 0.08,
              marginBottom: 22,
            }}
          />

          {/* Primary CTA — burgundy */}
          <button
            onClick={() => navigate("/user-products/product-list")}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "#6b0f2a",
              border: "none",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
            }}
          >
            Shop Full Collection
          </button>
        </section>
      ) : (
        /* ── Shop by Category — desktop unchanged ── */
        <section className="s-home-7af910">
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
              <div className="s-home-0b4322">
                <div className="s-home-0349cd" />
              </div>
            ) : categoryProducts.length > 0 ? (
              <ProductSlider
                products={categoryProducts}
                onQuickShop={setQuickShopId}
              />
            ) : (
              <p className="s-home-374f3d">No products in this category yet.</p>
            )}
          </div>
        </section>
      )}
      {reviews.length > 0 && !isMobile && (
        <>
          <div className="section-gap" />
          <section className="testimonial-section">
            <div className="container">
              <SectionTitle title="Testimonials" />
              <div className="s-home-2448b9">
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
                      onClick={handleTestimonialClick}
                      style={{ cursor: canNav ? "pointer" : "default" }}
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
                      <div className="s-home-ba3c41">
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
                        <p className="quote s-home-2242ed">"{r.comment}"</p>
                      </div>
                      <div className="s-home-6ebbb3">
                        <div className="s-home-8c7d4e">
                          <i className="bi bi-person-fill s-home-0820cb" />
                        </div>
                        <div>
                          <h4 className="s-home-918042">
                            {r.name || r.displayName}
                          </h4>
                          <div className="stars s-home-5c2fcc">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <i
                                key={j}
                                className={`${
                                  j < r.rating
                                    ? "bi bi-star-fill"
                                    : "bi bi-star"
                                } s-home-b3de66`}
                                style={{
                                  color:
                                    j < r.rating
                                      ? "var(--blush)"
                                      : "var(--ivory)",
                                }}
                              />
                            ))}
                          </div>
                          {canNav && r.productName && (
                            <p className="s-home-398bbc">{r.productName}</p>
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
