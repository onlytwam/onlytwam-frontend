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
  variant = "default",
  autoScrollIntervalMs,
  pauseAutoScrollOnHover = false,
}: {
  products: any[];
  onQuickShop: (id: number) => void;
  viewAllPath?: string;
  variant?: "default" | "twam-featured";
  autoScrollIntervalMs?: number;
  pauseAutoScrollOnHover?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isJumping = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragResetTimerRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const sliderScrollTimerRef = useRef<number | null>(null);
  const autoScrollPausedRef = useRef(false);
  const navigate = useNavigate();

  const [cw, setCw] = useState(0);
  const [vis, setVis] = useState(4);
  const [isDragging, setIsDragging] = useState(false);
  const [centerIndex, setCenterIndex] = useState(0);

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
  const featuredSpotlightEnabled = variant === "twam-featured" && vis >= 5;

  const tripled = useMemo(() => {
    return shouldScroll
      ? [...uniqueProducts, ...uniqueProducts, ...uniqueProducts]
      : uniqueProducts;
  }, [uniqueProducts, shouldScroll]);

  const singleW = useMemo(() => {
    if (!cw || numProducts === 0) return 0;
    return numProducts * (cw + GAP);
  }, [cw, numProducts]);

  const updateCenterIndex = useCallback(
    (scrollLeft: number) => {
      if (!numProducts) {
        setCenterIndex(0);
        return;
      }

      const visibleCount = Math.min(vis, numProducts);
      const centerOffset = Math.max(0, Math.floor(visibleCount / 2));

      if (!featuredSpotlightEnabled || !shouldScroll || !cw || singleW === 0) {
        setCenterIndex(Math.min(centerOffset, numProducts - 1));
        return;
      }

      const normalizedScrollLeft = ((scrollLeft % singleW) + singleW) % singleW;
      const startIndex =
        Math.round(normalizedScrollLeft / (cw + GAP)) %
        Math.max(numProducts, 1);

      setCenterIndex((startIndex + centerOffset) % numProducts);
    },
    [cw, featuredSpotlightEnabled, numProducts, shouldScroll, singleW, vis],
  );

  const measure = useCallback(() => {
    const sw = window.innerWidth;
    const v = sw < 640 ? 2 : sw < 1024 ? 3 : 5;
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

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current);
      }
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      if (sliderScrollTimerRef.current !== null) {
        window.clearTimeout(sliderScrollTimerRef.current);
        document.body.classList.remove("home-scrolling");
      }
    };
  }, []);

  useEffect(() => {
    if (!autoScrollIntervalMs || !shouldScroll || !scrollRef.current || !cw) {
      return;
    }

    const id = window.setInterval(() => {
      if (
        autoScrollPausedRef.current ||
        isDraggingRef.current ||
        !scrollRef.current
      ) {
        return;
      }

      const step = variant === "twam-featured" ? 1 : 2;
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollLeft + step * (cw + GAP),
        behavior: "smooth",
      });
    }, autoScrollIntervalMs);

    return () => window.clearInterval(id);
  }, [autoScrollIntervalMs, cw, shouldScroll]);

  useEffect(() => {
    if (!numProducts) {
      setCenterIndex(0);
      return;
    }

    if (!shouldScroll || !scrollRef.current || singleW === 0) {
      updateCenterIndex(0);
      return;
    }

    isJumping.current = true;
    scrollRef.current.scrollLeft = singleW;
    updateCenterIndex(singleW);
    requestAnimationFrame(() => {
      isJumping.current = false;
    });
  }, [numProducts, shouldScroll, singleW, updateCenterIndex]);

  const snapToNearestCard = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!scrollRef.current || !cw || !shouldScroll) return;
      const step = cw + GAP;
      const snappedLeft =
        Math.round(scrollRef.current.scrollLeft / step) * step;
      scrollRef.current.scrollTo({ left: snappedLeft, behavior });
    },
    [cw, shouldScroll],
  );

  const scheduleSnapToNearestCard = useCallback(() => {
    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(() => {
      snapTimeoutRef.current = null;
      snapToNearestCard();
    }, 120);
  }, [snapToNearestCard]);

  const onScrollHandler = useCallback(() => {
    // Freeze hover transitions during slider scroll.
    // Removed 2 seconds after the last scroll event fires,
    // matching the page-scroll handler in Home so both
    // slot into the same CSS "home-scrolling" gate.
    document.body.classList.add("home-scrolling");
    if (sliderScrollTimerRef.current !== null) {
      window.clearTimeout(sliderScrollTimerRef.current);
    }
    sliderScrollTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("home-scrolling");
      sliderScrollTimerRef.current = null;
    }, 2000);

    if (!shouldScroll) return;
    if (isJumping.current || !scrollRef.current || singleW === 0) return;
    const { current } = scrollRef;
    let sl = current.scrollLeft;
    if (sl >= singleW * 2) {
      isJumping.current = true;
      current.scrollLeft = sl - singleW;
      requestAnimationFrame(() => {
        isJumping.current = false;
      });
    } else if (sl < singleW * 0.5) {
      isJumping.current = true;
      current.scrollLeft = sl + singleW;
      requestAnimationFrame(() => {
        isJumping.current = false;
      });
    }
    sl = current.scrollLeft;
    updateCenterIndex(sl);
    if (!isDraggingRef.current) {
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = window.setTimeout(() => {
        snapTimeoutRef.current = null;
        snapToNearestCard();
      }, 120);
    }
  }, [shouldScroll, singleW, updateCenterIndex, snapToNearestCard]);

  // Arrow click: twam-featured scrolls 1 card, all others scroll 2
  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current || !cw) return;
    const step = variant === "twam-featured" ? 1 : 2;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + dir * step * (cw + GAP),
      behavior: "smooth",
    });
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldScroll || !scrollRef.current || e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = scrollRef.current.scrollLeft;
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 6) {
      didDragRef.current = true;
    }
    scrollRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
    }
    dragResetTimerRef.current = window.setTimeout(() => {
      didDragRef.current = false;
      dragResetTimerRef.current = null;
    }, 0);
    scheduleSnapToNearestCard();
  };

  const suppressDraggedClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!didDragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleWrapMouseEnter = () => {
    if (pauseAutoScrollOnHover) {
      autoScrollPausedRef.current = true;
    }
  };

  const handleWrapMouseLeave = () => {
    handleDragEnd();
    if (pauseAutoScrollOnHover) {
      autoScrollPausedRef.current = false;
    }
  };

  const safeCw = cw > 0 ? cw : 280;

  if (!uniqueProducts.length)
    return <p className="s-home-eb8359">No products yet</p>;

  return (
    <div className="s-home-slider-outer">
      {viewAllPath && (
        <div
          className={`s-home-slider-header${
            variant === "twam-featured" ? " s-home-slider-header--tight" : ""
          }`}
          style={{ paddingRight: showArrows ? 48 : 4 }}
        >
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
        onMouseEnter={handleWrapMouseEnter}
        onMouseLeave={handleWrapMouseLeave}
        onMouseUp={handleDragEnd}
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
          onMouseDown={
            variant === "twam-featured" ? undefined : handleDragStart
          }
          onMouseMove={variant === "twam-featured" ? undefined : handleDragMove}
          onMouseUp={variant === "twam-featured" ? undefined : handleDragEnd}
          onMouseLeave={variant === "twam-featured" ? undefined : handleDragEnd}
          onClickCapture={
            variant === "twam-featured" ? undefined : suppressDraggedClick
          }
          onDragStart={(e) => e.preventDefault()}
          className={`s-home-4ec7f1${
            isDragging ? " s-home-4ec7f1--dragging" : ""
          }`}
          style={{
            gap: GAP,
            overflowX:
              shouldScroll && variant !== "twam-featured"
                ? "auto"
                : variant === "twam-featured"
                ? "hidden"
                : "hidden",
            cursor:
              shouldScroll && variant !== "twam-featured"
                ? isDragging
                  ? "grabbing"
                  : "grab"
                : "default",
            paddingTop: 18,
            marginTop: -10,
            ...(showArrows ? { marginLeft: 44, marginRight: 44 } : {}),
          }}
        >
          {tripled.map((p, i) => {
            const productIndex = numProducts > 0 ? i % numProducts : 0;
            const rawDist = Math.abs(productIndex - centerIndex);
            const distFromCenter =
              numProducts > 0
                ? Math.min(rawDist, numProducts - rawDist)
                : rawDist;
            const featuredTierClass = !featuredSpotlightEnabled
              ? ""
              : distFromCenter === 0
              ? " home-featured-card--center"
              : distFromCenter === 1
              ? " home-featured-card--near"
              : " home-featured-card--corner";

            return (
              <div
                key={`${p.productVariantId}-${i}`}
                className={`s-home-685bdd${
                  featuredSpotlightEnabled ? " home-featured-card" : ""
                }${featuredTierClass}`}
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
                  enableHoverImageTransition={
                    !featuredSpotlightEnabled || distFromCenter === 0
                  }
                />
              </div>
            );
          })}
        </div>
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

  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -40) next();
    else if (touchDeltaX.current > 40) prev();
    touchDeltaX.current = 0;
  };

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

        <div
          className="mpsl-track"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            className="mpsl-arrow mpsl-arrow--left"
            onClick={prev}
            aria-label="Previous"
          >
            ‹
          </button>

          <div className="mpsl-cards">
            <div className="mpsl-card mpsl-card--top">
              <MobileProductCard product={card0} onQuickShop={onQuickShop} />
            </div>
            {card1 && (
              <div className="mpsl-card mpsl-card--bottom">
                <MobileProductCard product={card1} onQuickShop={onQuickShop} />
              </div>
            )}
          </div>

          <button
            className="mpsl-arrow mpsl-arrow--right"
            onClick={next}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div className="mpsl-dots">
          {Array.from({ length: Math.ceil(total / 2) }).map((_, i) => (
            <span
              key={i}
              onClick={() => setIndex(i * 2)}
              className={`mpsl-dot${
                Math.floor(index / 2) === i ? " mpsl-dot--active" : ""
              }`}
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
      className="best-sellers home-product-section home-product-section--ivory"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <img
        src="/assets/twam-featured.png"
        alt=""
        aria-hidden="true"
        className="desktop-section-bg desktop-section-bg--twam"
      />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <SectionTitle title="TWAM Featured" highlight />
        <button
          onClick={() => navigate(TWAM_PATH)}
          className="s-home-54af6d"
          style={{ display: "none" }}
        >
          View All →
        </button>
        <ProductSlider
          products={products}
          onQuickShop={onQuickShop}
          viewAllPath={TWAM_PATH}
          variant="twam-featured"
          autoScrollIntervalMs={10000}
          pauseAutoScrollOnHover={true}
        />
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

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (canNav)
            navigate(
              `/user-products/product-detail/${r.productVariantId}/${(
                r.productName || "product"
              )
                .toLowerCase()
                .replace(/\s+/g, "-")}?tab=reviews`,
            );
        }}
        style={{ cursor: canNav ? "pointer" : "default", minHeight: 120 }}
      >
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

        <div
          style={{
            height: 0.5,
            background: "rgba(107,15,42,0.12)",
            marginBottom: 12,
          }}
        />

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
        el.style.transform = `perspective(900px) rotateX(${
          clamped * -6
        }deg) translateY(${clamped * 10}px)`;
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

  // ── Freeze hover transitions while page is scrolling ──────────────────────
  // "home-scrolling" is added on scroll and removed 2s after scroll stops.
  // The same class is also added by the slider's onScrollHandler so both
  // page scroll and slider scroll share the same CSS gate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      document.body.classList.add("home-scrolling");
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.body.classList.remove("home-scrolling");
      }, 2000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      document.body.classList.remove("home-scrolling");
    };
  }, []);

  const dedupeByProductId = (d: any) => {
    const seen = new Set<number>();
    return (d?.list ?? []).filter((p: any) => {
      if (seen.has(p.productId)) return false;
      seen.add(p.productId);
      return true;
    });
  };

  const { data: bestSellersProducts = [], isSuccess: bsReady } = useQuery({
    queryKey: ["home-best-sellers"],
    queryFn: () => listProducts({ isBestSeller: true, pageSize: 40 }),
    select: dedupeByProductId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newArrivalsProducts = [], isSuccess: naReady } = useQuery({
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

  const twamBrandId = useMemo(() => {
    const list: any[] = brandsData?.list ?? [];
    const found = list.find(
      (b) =>
        b.brandName?.toLowerCase().includes("twam") ||
        b.name?.toLowerCase().includes("twam"),
    );
    return found?.brandId ?? found?.id ?? null;
  }, [brandsData]);

  const { data: twamFeaturedProducts = [], isSuccess: tfReady } = useQuery({
    queryKey: ["home-twam-featured", twamBrandId],
    enabled: twamBrandId != null,
    queryFn: () => listProducts({ brandIds: twamBrandId, pageSize: 40 }),
    select: dedupeByProductId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (bsReady && naReady && tfReady) {
      (window as any).__twamHomeReady = true;
      window.dispatchEvent(new Event("twam-home-ready"));
    }
  }, [bsReady, naReady, tfReady]);

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

  const selectedCategoryPath = selectedCategoryId
    ? `/user-products/product-list/${selectedCategoryId}`
    : "/user-products/product-list";

  return (
    <div className="s-home-bcf04f">
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

      <TwamFeaturedSection
        products={twamFeaturedProducts}
        onQuickShop={setQuickShopId}
      />

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
        <section
          className="best-sellers home-product-section home-product-section--white s-home-42eb71"
          style={{ position: "relative", overflow: "hidden" }}
        >
          <img
            src="/assets/best-sellers.png"
            alt=""
            aria-hidden="true"
            className="desktop-section-bg desktop-section-bg--bs"
          />
          <div
            className="container"
            style={{ position: "relative", zIndex: 1 }}
          >
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
        <section
          className="best-sellers home-product-section home-product-section--ivory s-home-51e4ca"
          style={{ position: "relative", overflow: "hidden" }}
        >
          <img
            src="/assets/new-arrivals.png"
            alt=""
            aria-hidden="true"
            className="desktop-section-bg desktop-section-bg--new"
          />
          <div
            className="container"
            style={{ position: "relative", zIndex: 1 }}
          >
            <SectionTitle title="New Arrivals" highlight />
            <ProductSlider
              products={newArrivals}
              onQuickShop={setQuickShopId}
              viewAllPath="/new-arrivals"
              autoScrollIntervalMs={6000}
              pauseAutoScrollOnHover={true}
            />
          </div>
        </section>
      )}
      <div className="section-gap" />

      {isMobile ? (
        <section
          className="mob-promise-card"
          style={{
            background: "#ffffff",
            padding: "34px 22px 30px",
            borderTop: "0.5px solid rgba(0,0,0,0.07)",
            borderBottom: "0.5px solid rgba(0,0,0,0.07)",
          }}
        >
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

          <div
            style={{
              height: 0.5,
              background: "#000",
              opacity: 0.08,
              marginBottom: 22,
            }}
          />

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

          <div
            style={{
              height: 0.5,
              background: "#000",
              opacity: 0.08,
              marginBottom: 22,
            }}
          />

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
        <section className="home-product-section home-product-section--white s-home-7af910">
          <div className="container">
            <SectionTitle title="Shop by Category" highlight />
            <div className="category-buttons s-home-5e0218">
              {menus.map((cat: CategoryMenu) => (
                <button
                  key={cat.categoryId}
                  onClick={() => handleCategorySelect(cat)}
                  className={`${
                    selectedCategoryId === cat.categoryId ? "active" : ""
                  } s-home-2574d7`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div
              className="s-home-slider-header s-home-slider-header--tight"
              style={{ marginTop: -14 }}
            >
              <button
                onClick={() => navigate(selectedCategoryPath)}
                className="s-home-54af6d"
              >
                View All
              </button>
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
                      `/user-products/product-detail/${
                        r.productVariantId
                      }/${slugify(
                        r.productName || r.name || "product",
                      )}?tab=reviews`,
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
