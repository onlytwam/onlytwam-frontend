import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { usePageImage, IMAGE_KEYS } from "@/features/images";
import { getPageImage } from "@/features/images/api/images.api";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  listProducts,
  listBrands,
  listUserReviews,
  listNewArrivals,
  listCategories,
} from "@/features/products/api/products.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMenuStore } from "@/shared/store/menuStore";
import api from "@/shared/api/axiosInstance";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import type { CategoryMenu } from "@/shared/types";
import QuickShopModal from "@/features/products/components/QuickShopModal";

import ProductCard from "@/features/products/components/ProductCard";

const GAP = 12;

type HomeBrandLogo = {
  brandId?: number | string;
  id?: number | string;
  brandImage?: string | null;
  brandName?: string | null;
  name?: string | null;
};

// No static brand images — all brand logos come from the /Brand/ API

const HOME_PASSWORD_UPDATE_TOAST_ID = "home-password-update-reminder";
const HOME_PASSWORD_UPDATE_SEEN_KEY = "twam_home_password_update_seen";

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
                  singleColorOnly={false}
                  compact={false}
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

// ─── Brands Marquee ───────────────────────────────────────────────────────────
function BrandsSection({ logos }: { logos: HomeBrandLogo[] }) {
  // Only show brands that have a dedicated brandImage uploaded via the admin
  // image-upload feature. brandLogo is excluded here — logos are small
  // transparent PNGs; brandImage is the banner uploaded for this marquee.
  const brandImages = useMemo(() => {
    const seen = new Set<string>();

    return logos.reduce(
      (
        items: { src: string; name: string; brandId: number | string | null }[],
        b,
      ) => {
        const src = b.brandImage ?? "";
        if (!src) return items;

        const key = String(b.brandId ?? b.id ?? src);
        if (seen.has(key)) return items;

        seen.add(key);
        items.push({
          src,
          name: b.brandName ?? b.name ?? "",
          brandId: b.brandId ?? b.id ?? null,
        });
        return items;
      },
      [],
    );
  }, [logos]);
  const navigate = useNavigate();

  // Nothing to show — hide section entirely
  if (!brandImages.length) return null;

  const itemWidth = 300,
    itemHeight = itemWidth / 3,
    gap = 0,
    durationSeconds = 34;
  const setWidth = brandImages.length * itemWidth;
  const marqueeStyle: CSSProperties & {
    "--brand-gap": string;
    "--brand-duration": string;
    "--brand-set-width": string;
  } = {
    "--brand-gap": `${gap}px`,
    "--brand-duration": `${durationSeconds}s`,
    "--brand-set-width": `${setWidth}px`,
  };

  return (
    <section className="s-home-be6933">
      <div className="s-home-b9d256" />
      <div className="container s-home-59ddea">
        <SectionTitle title="Brands" />
        <div
          className="brand-marquee s-home-68cb82"
          style={marqueeStyle}
        >
          <div className="brand-marquee-track">
            {[...brandImages, ...brandImages].map((brand, i) => {
              const isClone = i >= brandImages.length;
              const goToBrand = () => {
                if (!brand.brandId) return;
                navigate(`/user-products/product-list?brandId=${brand.brandId}`);
              };

              return (
                <div
                  key={`${brand.src}-${brand.name || i}-${
                    isClone ? "clone" : "original"
                  }`}
                  className="brand-marquee-item"
                  aria-hidden={isClone}
                  style={{
                    flex: `0 0 ${itemWidth}px`,
                    width: itemWidth,
                    minWidth: itemWidth,
                    height: itemHeight,
                    aspectRatio: "3 / 1",
                    marginRight: gap,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={goToBrand}
                    disabled={!brand.brandId}
                    tabIndex={isClone ? -1 : 0}
                    aria-label={
                      isClone ? undefined : `View ${brand.name} products`
                    }
                    style={{
                      width: "100%",
                      height: "100%",
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      cursor: brand.brandId ? "pointer" : "default",
                      display: "block",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={brand.src}
                      alt={isClone ? "" : brand.name}
                      className="s-home-783e28"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </button>
                </div>
              );
            })}
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

  const bgSrc: string | null = null; // background set via CSS / parent bgImage prop

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
// ─── Shop By Category Section ────────────────────────────────────────────────
// No static category fallbacks — categories are only shown when they have an uploaded image

function ShopByCategorySection() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Use the same category list (and order) that the navbar already resolved.
  // The navbar fetches getCategories({ roleId: 2 }) which filters hidden
  // categories server-side, caches the result in useMenuStore, and keeps it
  // fresh via BroadcastChannel + visibilitychange. Reusing that here means
  // Shop-by-Category automatically mirrors navbar visibility and order with
  // zero extra fetches.
  const { menus } = useMenuStore();

  // Section-level visibility toggle -- admin can hide/show the whole
  // 'Shop by Category' section from AdminBranding without touching categories.
  const { data: sectionDto } = useQuery({
    queryKey: ["page-image", IMAGE_KEYS.HOME_SHOP_BY_CATEGORY],
    queryFn: () => getPageImage(IMAGE_KEYS.HOME_SHOP_BY_CATEGORY),
    staleTime: 0,
  });
  // isActive defaults to true when the row hasn't been explicitly hidden
  const sectionActive = sectionDto ? sectionDto.isActive !== false : true;

  // "All Products" banner image -- uploaded via the admin Images module
  const allProductsImage = usePageImage(IMAGE_KEYS.HOME_SHOP_ALL_PRODUCTS);

  // Fetch live categories from the backend (includes categoryImage)
  const { data: catData } = useQuery({
    queryKey: ["shop-categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 0,
  });

  // Re-fetch when admin hides/shows a category (same tab, cross-tab, or
  // cross-browser via visibilitychange) so the section appears/disappears
  // without requiring a page reload.
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["shop-categories"] });
      queryClient.invalidateQueries({
        queryKey: ["page-image", IMAGE_KEYS.HOME_SHOP_BY_CATEGORY],
      });
    };
    window.addEventListener("categoriesUpdated", refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("categoriesUpdated", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  // Build the slide list:
  //  - "All Products" first -- only included when an admin image has been uploaded
  //    AND there is at least one visible (active) category with an image.
  //    If every category is hidden, the entire section hides -- including the
  //    All Products tile -- because showing only "All Products" with no
  //    categories to browse would be misleading.
  //  - Then the exact categories shown in the navbar, in navbar order,
  //    but only those that have an uploaded categoryImage.
  const slides = useMemo(() => {
    const list: any[] = catData?.list ?? [];

    // Build a fast categoryId → categoryImage lookup from the full category
    // list (which carries the image URLs). We still need this fetch to get
    // the images; we just no longer use it to decide *which* categories to
    // show or in *what order* — the navbar already made those decisions.
    const imageMap = new Map<number, string>();
    list.forEach((c: any) => {
      if (c.categoryImage) imageMap.set(c.categoryId, c.categoryImage);
    });

    // Walk the navbar menus in their display order. Include a slide only when
    // an image has been uploaded for that category. Categories hidden in the
    // navbar (already absent from `menus`) are automatically excluded.
    const activeCategorySlides = menus
      .map((cat) => ({
        categoryId: cat.categoryId as number | null,
        name: cat.name as string,
        image: imageMap.get(cat.categoryId) ?? "",
        url: `/user-products/product-list/${cat.categoryId}`,
      }))
      .filter((s) => s.image); // skip categories with no uploaded image

    // If every category is hidden (or none have images), suppress the whole
    // section -- including the All Products tile -- so we never show a
    // "Shop by Category" heading with only a generic All Products banner.
    if (activeCategorySlides.length === 0) return [];

    const result: Array<{
      categoryId: number | null;
      name: string;
      image: string;
      url: string;
    }> = [];

    // "All Products" tile -- only prepend when there are real categories to show
    if (allProductsImage) {
      result.push({
        categoryId: null,
        name: "All Products",
        image: allProductsImage,
        url: "/all-products",
      });
    }

    return [...result, ...activeCategorySlides];
  }, [catData, allProductsImage, menus]);

  const SHOP_CAT_TOTAL = slides.length;
  // Keep a ref so the advance callback always reads the live slide count
  // (useCallback deps don't include SHOP_CAT_TOTAL, so a plain const would
  //  be stale after categories load — the ref is always in sync).
  const shopCatTotalRef = useRef(SHOP_CAT_TOTAL);
  shopCatTotalRef.current = SHOP_CAT_TOTAL;

  // Use a ref alongside state so callbacks never capture stale currentIdx
  const [currentIdx, _setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  const setCurrentIdx = useCallback((idx: number) => {
    currentIdxRef.current = idx;
    _setCurrentIdx(idx);
  }, []);

  // Slide animation state
  const [nextIdx, setNextIdx] = useState<number | null>(null); // incoming slide index
  const [slideDir, setSlideDir] = useState<1 | -1>(1); // 1 = next, -1 = prev
  const [transiting, setTransiting] = useState(false); // CSS transition active
  const slidingRef = useRef(false); // guard against re-entry

  // Wheel / trackpad debounce
  const wheelCooldownRef = useRef(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Navigation path is already embedded in each slide from the API
  const resolvePath = useCallback(
    (cat: (typeof slides)[0]) => cat.url,
    [slides],
  );

  // ── Slide advance ──────────────────────────────────────────────────────────
  // Flow:
  //   1. Set nextIdx + slideDir  → incoming slide renders off-screen (no transition yet)
  //   2. Double-rAF              → setTransiting(true) → CSS slide kicks in for both slides
  //   3. After 480 ms            → commit currentIdx, clear nextIdx / transiting
  const advance = useCallback(
    (dir: 1 | -1 = 1) => {
      if (slidingRef.current) return;
      const total = shopCatTotalRef.current;
      if (total === 0) return;
      slidingRef.current = true;
      setSlideDir(dir);
      const newIdx = (currentIdxRef.current + dir + total) % total;
      setNextIdx(newIdx);

      // Allow the incoming slide to render at its off-screen start position
      // before enabling the CSS transition (double-rAF ensures paint happens first)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransiting(true);
        });
      });

      setTimeout(() => {
        setCurrentIdx(newIdx);
        setNextIdx(null);
        setTransiting(false);
        slidingRef.current = false;
      }, 480);
    },
    [setCurrentIdx],
  );

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => advance(1), 5000);
  }, [advance]);

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restartTimer]);

  const goNext = () => {
    if (!slidingRef.current) {
      advance(1);
      restartTimer();
    }
  };
  const goPrev = () => {
    if (!slidingRef.current) {
      advance(-1);
      restartTimer();
    }
  };

  // ── Mouse-pad / wheel scroll ───────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    if (wheelCooldownRef.current || slidingRef.current) return;
    // Prefer horizontal delta (trackpad swipe) but fall back to vertical
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 20) return; // ignore tiny micro-scrolls
    wheelCooldownRef.current = true;
    setTimeout(() => {
      wheelCooldownRef.current = false;
    }, 700);
    advance(delta > 0 ? 1 : -1);
    restartTimer();
  };

  if (isMobile) return null;

  // Admin has explicitly hidden the entire 'Shop by Category' section
  if (!sectionActive) return null;

  // Hide the entire section if there are no slides with images
  if (slides.length === 0) return null;

  const current = slides[currentIdx] ?? slides[0];
  const incoming = nextIdx !== null ? slides[nextIdx] : null;

  // ── Shared styles ──────────────────────────────────────────────────────────
  const arrowBtn: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "none",
    borderRadius: "50%",
    width: 48,
    height: 48,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.08)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  };

  const SLIDE_TRANSITION = "transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)";

  // ── Slide renderer ─────────────────────────────────────────────────────────
  // Each slide is absolutely-positioned inside the overflow:hidden container.
  // slideStyle controls the translateX and transition so slides can enter/exit.
  const renderSlide = (
    cat: (typeof slides)[0],
    slideStyle: React.CSSProperties,
    onSlideClick: () => void,
  ) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        cursor: "pointer",
        ...slideStyle,
      }}
      onClick={onSlideClick}
    >
      {/* Banner image */}
      <img
        src={cat.image}
        alt={cat.name}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      {/* ── Shop Now button — bottom-right, 3 cm from each edge ────────────── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(resolvePath(cat));
        }}
        style={{
          position: "absolute",
          bottom: "3cm",
          right: "3cm",
          background: "rgba(255,255,255,0.97)",
          border: "none",
          borderRadius: 2,
          padding: "14px 36px",
          fontSize: 13,
          fontWeight: 800,
          color: "#6b0f2a",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: '"Trebuchet MS","Gill Sans",Arial,sans-serif',
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.28), 0 2px 10px rgba(107,15,42,0.22)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 3,
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        Shop Now
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M2 7h10M8 3l4 4-4 4"
            stroke="#6b0f2a"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );

  return (
    <section
      style={{
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        paddingTop: 20,
        paddingBottom: 12,
      }}
    >
      {/* Title */}
      <h2
        style={{
          textAlign: "center",
          color: "#6b0f2a",
          fontFamily:
            '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
          fontSize: "2rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          margin: "0 0 14px",
          flexShrink: 0,
        }}
      >
        Shop by Category
      </h2>

      {/* ── Carousel viewport — locked to 21:8 aspect ratio ────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "21 / 7",
          overflow: "hidden",
          lineHeight: 0,
        }}
        onWheel={onWheel}
      >
        {/* Left arrow */}
        <button
          onClick={goPrev}
          aria-label="Previous category"
          style={{ ...arrowBtn, left: 20, zIndex: 10 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 4.5L7 10l5.5 5.5"
              stroke="#6b0f2a"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Outgoing slide (current) — slides out in the advance direction */}
        {renderSlide(
          current,
          {
            transform: transiting
              ? `translateX(${slideDir === 1 ? "-100%" : "100%"})`
              : "translateX(0)",
            transition: transiting ? SLIDE_TRANSITION : "none",
            zIndex: 1,
          },
          () => navigate(resolvePath(current)),
        )}

        {/* Incoming slide (next) — slides in from the opposite side */}
        {incoming &&
          renderSlide(
            incoming,
            {
              transform: transiting
                ? "translateX(0)"
                : `translateX(${slideDir === 1 ? "100%" : "-100%"})`,
              transition: transiting ? SLIDE_TRANSITION : "none",
              zIndex: 2,
            },
            () => navigate(resolvePath(incoming)),
          )}

        {/* Right arrow */}
        <button
          onClick={goNext}
          aria-label="Next category"
          style={{ ...arrowBtn, right: 20, zIndex: 10 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.5 4.5L13 10l-5.5 5.5"
              stroke="#6b0f2a"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: "14px 0 0",
          flexShrink: 0,
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (slidingRef.current) return;
              setCurrentIdx(i);
              restartTimer();
            }}
            aria-label={`Go to ${slides[i].name}`}
            style={{
              width: i === currentIdx ? 24 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: i === currentIdx ? "#6b0f2a" : "#d4a0ad",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Desktop Featured Section (Best Sellers / New Arrivals) ──────────────────
// Full-viewport section with a fixed background image and a single navigable
// product card on the left (Best Sellers) or right (New Arrivals).
// Supports auto-advance, mouse-wheel / trackpad scrolling, and arrow navigation —
// exactly like ShopByCategorySection.
function DesktopFeaturedSection({
  title,
  products,
  onQuickShop,
  bgImage,
  cardSide,
  viewAllPath,
}: {
  title: string;
  products: any[];
  onQuickShop: (id: number) => void;
  bgImage: string;
  cardSide: "left" | "right" | "center";
  viewAllPath?: string;
}) {
  const navigate = useNavigate();
  const total = products.length;

  const [currentIdx, _setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  const setCurrentIdx = useCallback((idx: number) => {
    currentIdxRef.current = idx;
    _setCurrentIdx(idx);
  }, []);

  const [nextIdx, setNextIdx] = useState<number | null>(null);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [transiting, setTransiting] = useState(false);
  const slidingRef = useRef(false);
  const wheelCooldownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(
    (dir: 1 | -1 = 1) => {
      if (slidingRef.current || total === 0) return;
      slidingRef.current = true;
      setSlideDir(dir);
      const newIdx = (currentIdxRef.current + dir + total) % total;
      setNextIdx(newIdx);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransiting(true);
        });
      });
      setTimeout(() => {
        setCurrentIdx(newIdx);
        setNextIdx(null);
        setTransiting(false);
        slidingRef.current = false;
      }, 450);
    },
    [total, setCurrentIdx],
  );

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => advance(1), 4500);
  }, [advance]);

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restartTimer]);

  const onWheel = (e: React.WheelEvent) => {
    if (wheelCooldownRef.current || slidingRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 20) return;
    wheelCooldownRef.current = true;
    setTimeout(() => {
      wheelCooldownRef.current = false;
    }, 700);
    advance(delta > 0 ? 1 : -1);
    restartTimer();
  };

  const NATURAL_CARD_W = 260;
  const NATURAL_CARD_H = 475;
  const BANNER_PAD_PX = 19;

  const bannerContainerRef = useRef<HTMLDivElement>(null);

  const [bannerH, setBannerH] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth * (7 / 21);
    }
    return 500;
  });

  useLayoutEffect(() => {
    const el = bannerContainerRef.current;
    if (!el) return;
    setBannerH(el.getBoundingClientRect().height);
    const obs = new ResizeObserver(([entry]) => {
      setBannerH(entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const cardScale = Math.min(1, (bannerH - BANNER_PAD_PX * 2) / NATURAL_CARD_H);
  const CARD_W = Math.round(NATURAL_CARD_W * cardScale);
  const CARD_H = Math.round(NATURAL_CARD_H * cardScale);

  // Hide section when there is no bgImage OR when there are no products to show.
  // This ensures sections are never visible with an empty product carousel —
  // even if a background image is uploaded and isActive=true in the admin.
  if (!bgImage || total === 0) return null;

  const currentProduct = products[currentIdx];
  const nextProduct = nextIdx !== null ? products[nextIdx] : null;
  const SLIDE_T = "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)";

  const arrowBtnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "none",
    borderRadius: "50%",
    width: 48,
    height: 48,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.08)",
    flexShrink: 0,
    zIndex: 5,
  };

  const ChevronLeft = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.5 4.5L7 10l5.5 5.5"
        stroke="#6b0f2a"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ChevronRight = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="#6b0f2a"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Card panel — only rendered when products are available
  const cardPanel =
    total > 0 ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          transform: cardSide === "center" ? "translateX(250px)" : undefined,
        }}
        onWheel={onWheel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev arrow */}
        <button
          onClick={() => {
            advance(-1);
            restartTimer();
          }}
          aria-label="Previous product"
          style={arrowBtnStyle}
        >
          <ChevronLeft />
        </button>

        {/* Card viewport */}
        <div
          style={{
            position: "relative",
            width: CARD_W,
            height: CARD_H,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Outgoing card */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: transiting
                ? `translateX(${slideDir === 1 ? "-100%" : "100%"})`
                : "translateX(0)",
              transition: transiting ? SLIDE_T : "none",
            }}
          >
            <div
              style={{
                transform: `scale(${cardScale})`,
                transformOrigin: "top left",
                width: NATURAL_CARD_W,
                height: NATURAL_CARD_H,
              }}
            >
              <ProductCard
                product={currentProduct}
                onQuickShop={onQuickShop}
                showDiscountTag={false}
                singleColorOnly={false}
                compact={false}
                enableHoverImageTransition={true}
              />
            </div>
          </div>

          {/* Incoming card */}
          {nextProduct && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: transiting
                  ? "translateX(0)"
                  : `translateX(${slideDir === 1 ? "100%" : "-100%"})`,
                transition: transiting ? SLIDE_T : "none",
              }}
            >
              <div
                style={{
                  transform: `scale(${cardScale})`,
                  transformOrigin: "top left",
                  width: NATURAL_CARD_W,
                  height: NATURAL_CARD_H,
                }}
              >
                <ProductCard
                  product={nextProduct}
                  onQuickShop={onQuickShop}
                  showDiscountTag={false}
                  singleColorOnly={false}
                  compact={false}
                  enableHoverImageTransition={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={() => {
            advance(1);
            restartTimer();
          }}
          aria-label="Next product"
          style={arrowBtnStyle}
        >
          <ChevronRight />
        </button>
      </div>
    ) : null;

  return (
    <section
      style={{
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        paddingTop: 20,
        paddingBottom: 12,
      }}
    >
      {/* Title */}
      <h2
        onClick={viewAllPath ? () => navigate(viewAllPath) : undefined}
        style={{
          textAlign: "center",
          color: "#6b0f2a",
          fontFamily:
            '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
          fontSize: "2rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          margin: "0 0 14px",
          flexShrink: 0,
          cursor: viewAllPath ? "pointer" : undefined,
          transition: "opacity 0.18s",
        }}
        onMouseEnter={
          viewAllPath
            ? (e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.72";
                (e.currentTarget as HTMLElement).style.textDecoration =
                  "underline";
              }
            : undefined
        }
        onMouseLeave={
          viewAllPath
            ? (e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
                (e.currentTarget as HTMLElement).style.textDecoration = "none";
              }
            : undefined
        }
      >
        {title}
      </h2>

      {/* Image viewport — locked to 21:7 aspect ratio */}
      <div
        ref={bannerContainerRef}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "21 / 7",
          overflow: "hidden",
          cursor: viewAllPath ? "pointer" : undefined,
        }}
        onWheel={onWheel}
        onClick={viewAllPath ? () => navigate(viewAllPath) : undefined}
      >
        {/* Background image */}
        <img
          src={bgImage}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: 0,
          }}
        />

        {/* Card panel */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent:
              cardSide === "center"
                ? "center"
                : cardSide === "left"
                ? "flex-start"
                : "flex-end",
            padding: cardSide === "center" ? "0" : "0 60px",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>{cardPanel}</div>
        </div>
      </div>

      {/* Dot indicators */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: "14px 0 0",
          flexShrink: 0,
        }}
      >
        {products.slice(0, Math.min(total, 14)).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (slidingRef.current) return;
              setCurrentIdx(i);
              restartTimer();
            }}
            aria-label={`Go to product ${i + 1}`}
            style={{
              width: i === currentIdx ? 24 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: i === currentIdx ? "#6b0f2a" : "#d4a0ad",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TwamFeaturedSection({
  products,
  onQuickShop,
  bgImage,
}: {
  products: any[];
  onQuickShop: (id: number) => void;
  bgImage?: string;
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
      {bgImage && (
        <img
          src={bgImage}
          alt=""
          aria-hidden="true"
          className="desktop-section-bg desktop-section-bg--twam"
        />
      )}
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
                color: j < (r.rating ?? 5) ? "#6b0f2a" : "#e0e0e0",
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
  const passwordUpdateRequired = useAuthStore(
    (state) => state.passwordUpdateRequired,
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSyncing = useAuthStore((state) => state.isSyncing);
  const { menus } = useMenuStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [categoryProducts, setCategoryProducts] = useState<any[] | null>(null);
  const [quickShopId, setQuickShopId] = useState(0);
  // Track hero banner media readiness — required before firing twam-home-ready
  const [bannerLoaded, setBannerLoaded] = useState(false);

  // ── Dynamic page images (served from /api/images) ───────────────────────
  const heroMobileSrc = usePageImage(IMAGE_KEYS.HOME_HERO_MOBILE);
  const heroDesktopSrc = usePageImage(IMAGE_KEYS.HOME_HERO_DESKTOP);
  // Auto-detect: treat as video when the URL ends with a video extension
  const heroDesktopIsVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(
    heroDesktopSrc,
  );
  const twamSectionBg = usePageImage(IMAGE_KEYS.HOME_SECTION_TWAM);
  const bestsellersSectionBg = usePageImage(
    IMAGE_KEYS.HOME_SECTION_BESTSELLERS,
  );
  const newArrivalsSectionBg = usePageImage(
    IMAGE_KEYS.HOME_SECTION_NEWARRIVALS,
  );

  useEffect(() => {
    if (!isMobile) {
      setBannerLoaded(true);
    }
  }, [isMobile]);

  // NOTE: menus are loaded and kept fresh by Navbar.tsx (always re-fetches on mount
  // + listens for "categoriesUpdated"). No stale sessionStorage read here.

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
    const map = new Map<number, any>();
    for (const p of d?.list ?? []) {
      if (!map.has(p.productId)) {
        map.set(p.productId, { ...p, allVariants: [] });
      }
      map.get(p.productId).allVariants.push(p);
    }
    return Array.from(map.values());
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
  const homeDataReady = bsReady && naReady && tfReady;
  const homeVisualReady = bannerLoaded;

  useEffect(() => {
    if (homeVisualReady) {
      (window as any).__twamHomeReady = true;
      window.dispatchEvent(new Event("twam-home-ready"));
    }
  }, [homeVisualReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !homeDataReady ||
      !isAuthenticated ||
      !passwordUpdateRequired ||
      isSyncing
    ) {
      return;
    }

    if (sessionStorage.getItem(HOME_PASSWORD_UPDATE_SEEN_KEY) === "1") {
      return;
    }

    sessionStorage.setItem(HOME_PASSWORD_UPDATE_SEEN_KEY, "1");
    const dismissToast = () => toast.dismiss(HOME_PASSWORD_UPDATE_TOAST_ID);

    toast.custom(
      (t) => (
        <div
          style={{
            display: "grid",
            gap: 14,
            width: "min(92vw, 360px)",
            padding: "2px 0",
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? "translateY(0)" : "translateY(-8px)",
            transition: "all 180ms ease",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong
              style={{
                fontSize: 15,
                color: "var(--brand)",
                lineHeight: 1.35,
              }}
            >
              Please update your password
            </strong>
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--heirloom)",
              }}
            >
              You signed in with a temporary password. Update it now to keep
              your account secure.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                dismissToast();
                navigate("/account/change-password", { replace: true });
              }}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "10px 16px",
                background: "var(--brand)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 10px 22px rgba(107,15,42,.18)",
              }}
            >
              Update
            </button>
            <button
              type="button"
              onClick={dismissToast}
              style={{
                border: "1px solid rgba(107,15,42,.15)",
                borderRadius: 999,
                padding: "10px 16px",
                background: "#fff",
                color: "var(--brand)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Ignore
            </button>
          </div>
        </div>
      ),
      {
        id: HOME_PASSWORD_UPDATE_TOAST_ID,
        duration: Infinity,
      },
    );

    return () => {
      toast.dismiss(HOME_PASSWORD_UPDATE_TOAST_ID);
    };
  }, [
    homeDataReady,
    isAuthenticated,
    isSyncing,
    navigate,
    passwordUpdateRequired,
  ]);

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
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
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
    staleTime: 5 * 60 * 1000,
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
      <section className="twam-hero" aria-label="TWAM Hero">
        {isMobile ? (
          /* Mobile: hero image — only rendered once a URL has been uploaded */
          heroMobileSrc ? (
            <img
              src={heroMobileSrc}
              className="twam-hero__img"
              alt="TWAM Banner"
              onLoad={() => setBannerLoaded(true)}
              onError={() => {
                setBannerLoaded(true);
              }}
            />
          ) : null
        ) : /* Desktop: fullscreen hero — video or image, auto-detected */
        heroDesktopSrc ? (
          heroDesktopIsVideo ? (
            <video
              className="twam-hero__video"
              src={heroDesktopSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={() => setBannerLoaded(true)}
              onCanPlay={() => setBannerLoaded(true)}
              onError={() => setBannerLoaded(true)}
            />
          ) : (
            <img
              src={heroDesktopSrc}
              className="twam-hero__img"
              alt="TWAM Banner"
              onLoad={() => setBannerLoaded(true)}
              onError={() => setBannerLoaded(true)}
            />
          )
        ) : null}
      </section>
      <div className="section-gap" />

      {/* Desktop: Shop by Category banner carousel */}
      {!isMobile && <ShopByCategorySection />}

      {/* Mobile: keep TWAM Featured slider */}
      {isMobile && (
        <TwamFeaturedSection
          products={twamFeaturedProducts}
          onQuickShop={setQuickShopId}
          bgImage={twamSectionBg}
        />
      )}

      {isMobile && reviews.length > 0 && (
        <MobileTestimonial reviews={reviews} navigate={navigate} />
      )}

      <div className="section-gap" />

      {/* —— TWAM Brand Section — desktop only when bgImage is uploaded —— */}
      {isMobile ? (
        <MobileProductSlider
          title="TWAM"
          products={twamFeaturedProducts}
          onQuickShop={setQuickShopId}
          variant="twam"
        />
      ) : twamSectionBg ? (
        <>
          <DesktopFeaturedSection
            title="twam"
            products={twamFeaturedProducts}
            onQuickShop={setQuickShopId}
            bgImage={twamSectionBg}
            cardSide="center"
            viewAllPath="/only-twam"
          />
          <div className="section-gap" />
        </>
      ) : null}

      {isMobile && <div className="section-gap" />}

      {/* —— Best Sellers — desktop only when bgImage is uploaded —— */}
      {isMobile ? (
        <MobileProductSlider
          title="Best Sellers"
          products={products}
          onQuickShop={setQuickShopId}
          viewAllPath="/best-sellers"
          variant="bestsellers"
        />
      ) : bestsellersSectionBg ? (
        <>
          <DesktopFeaturedSection
            title="Best Sellers"
            products={products}
            onQuickShop={setQuickShopId}
            bgImage={bestsellersSectionBg}
            cardSide="left"
            viewAllPath="/best-sellers"
          />
          <div className="section-gap" />
        </>
      ) : null}

      {isMobile && <div className="section-gap" />}

      {/* —— New Arrivals — desktop only when bgImage is uploaded —— */}
      {isMobile ? (
        <MobileProductSlider
          title="New Arrivals"
          products={newArrivals}
          onQuickShop={setQuickShopId}
          viewAllPath="/new-arrivals"
          variant="new"
        />
      ) : newArrivalsSectionBg ? (
        <>
          <DesktopFeaturedSection
            title="New Arrivals"
            products={newArrivals}
            onQuickShop={setQuickShopId}
            bgImage={newArrivalsSectionBg}
            cardSide="right"
            viewAllPath="/new-arrivals"
          />
          <div className="section-gap" />
        </>
      ) : null}

      {isMobile && <div className="section-gap" />}

      {isMobile && (
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
                                    j < r.rating ? "var(--blush)" : "#e0e0e0",
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

      {quickShopId > 0 && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(0)}
        />
      )}
    </div>
  );
}
