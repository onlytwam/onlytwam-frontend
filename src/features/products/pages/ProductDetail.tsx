/**
 * ProductDetail.tsx
 */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCartStore } from "@/features/cart/store/cartStore";
import {
  getProductDetail,
  listUserReviews,
  createReview,
  listProducts,
} from "@/features/products/api/products.api";
import { addToCart } from "@/features/cart/api/cart.api";
import { formatPrice, slugify, getImageUrl } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { setBuyNowSession } from "@/shared/utils/checkoutSession";

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useBreadcrumb } from "@/shared/hooks/useBreadcrumb";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";
import MobileProductCard from "@/features/products/components/MobileProductCard";

const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';
const DOUBLE_TAP_MAX_DELAY = 320;
const DOUBLE_TAP_MAX_DISTANCE = 24;

/* ── Alpha-size override (same as QuickShopModal) ────────────────────────── */
const ALPHA_SIZE_KEYWORDS = [
  "t-shirt bra",
  "t shirt bra",
  "tshirt bra",
  "sports bra",
  "sport bra",
];
const isAlphaSizeProduct = (name = "") =>
  ALPHA_SIZE_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));

/* ── Centered page notification (same style as QuickShopModal) ─────────────── */
interface PageNotif {
  message: string;
  type: "warn" | "error" | "info";
}
function PageNotification({
  notif,
  onDone,
}: {
  notif: PageNotif;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [notif, onDone]);
  const bg =
    notif.type === "error"
      ? "var(--blush)"
      : notif.type === "warn"
      ? "var(--heirloom)"
      : "var(--brand)";
  const icon =
    notif.type === "error"
      ? "bi-exclamation-circle-fill"
      : notif.type === "warn"
      ? "bi-exclamation-triangle-fill"
      : "bi-info-circle-fill";
  return (
    <div className="s-productdetai-5ab3e3">
      <div
        className={`s-productdetai-bb046e is-${notif.type}`}
        style={{ background: bg }}
      >
        <i className={`bi ${icon} s-quickshopmod-42031d`} />
        <span>{notif.message}</span>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="pd-notif-close"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ── Stars ───────────────────────────────────────────────────────────────── */
function Stars({
  rating,
  size = 16,
  interactive = false,
  onRate,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <span className="s-productdetai-63bf95">
      {[1, 2, 3, 4, 5].map((i) => {
        const on = interactive
          ? (hover || rating) >= i
          : i <= Math.floor(rating);
        const half =
          !interactive && i === Math.ceil(rating) && !Number.isInteger(rating);
        return (
          <i
            key={i}
            className={`bi ${
              on ? "bi-star-fill" : half ? "bi-star-half" : "bi-star"
            }`}
            style={{
              fontSize: size,
              color: on || half ? "var(--brand)" : "var(--ivory)",
              cursor: interactive ? "pointer" : "default",
            }}
            onMouseEnter={() => interactive && setHover(i)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onRate?.(i)}
          />
        );
      })}
    </span>
  );
}

/* ── Shipping Bar (same as Home) ─────────────────────────────────────────── */
function ShippingBar() {
  return (
    <section className="shipping_section s-productdetai-ff85a0a9">
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
                <h3 className="s-productdetai-b87156">{f.title}</h3>
                <p className="s-productdetai-f51e9c">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ScrollableProductRow — real DOM smooth-scroll ── */
const ROW_GAP = 16;
const ROW_VISIBLE = 4;

function ScrollableProductRow({
  products,
  onQuickShop,
}: {
  products: any[];
  onQuickShop: (id: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  const measure = useCallback(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    if (!wrapRef.current) return;
    const visible = mobile ? 2 : ROW_VISIBLE;
    // mobile: subtract 24px (CSS padding: 0 12px on scroll container)
    const padding = mobile ? 24 : 112;
    const wrapWidth = wrapRef.current.clientWidth - padding;
    const c = Math.floor((wrapWidth - ROW_GAP * (visible - 1)) / visible);
    setCw(c > 0 ? c : 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(measure);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (wrapRef.current && ro) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure]);

  // ── Snap refs defined first so onScroll can reference them ──────────────
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSnapping = useRef(false);

  const snapToNearest = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !isMobile) return;
    isSnapping.current = true;
    // card step = card width (50vw-15px) + gap(10px) = 50vw - 5px
    const cardStep = window.innerWidth / 2 - 5;
    const nearest = Math.round(el.scrollLeft / cardStep) * cardStep;
    el.scrollTo({ left: nearest, behavior: "smooth" });
    setTimeout(() => {
      isSnapping.current = false;
    }, 400);
  }, [isMobile]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    // Debounce snap: fires 200ms after momentum fully stops
    if (isMobile && !isSnapping.current) {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(snapToNearest, 200);
    }
  }, [isMobile, snapToNearest]);

  useEffect(() => {
    onScroll();
  }, [cw, products, onScroll]);

  const scrollByCards = (dir: 1 | -1) => {
    if (!scrollRef.current) return;
    if (isMobile) {
      const amount = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: dir * amount, behavior: "smooth" });
      return;
    }
    if (!cw) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + dir * ROW_VISIBLE * (cw + ROW_GAP),
      behavior: "smooth",
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      el.scrollLeft += e.deltaX;
    }
  };

  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (snapTimer.current) clearTimeout(snapTimer.current);
  };
  const handleTouchEnd = (_e: React.TouchEvent) => {
    // CSS-free: onScroll debounce handles snap after momentum stops
  };

  const arrowStyle = (
    enabled: boolean,
    dir: "left" | "right",
  ): React.CSSProperties => ({
    position: "absolute",
    top: "40%",
    transform: "translateY(-50%)",
    [dir]: isMobile ? 4 : 0,
    width: isMobile ? 28 : 42,
    height: isMobile ? 28 : 42,
    borderRadius: "50%",
    background: enabled ? "var(--brand)" : "rgba(245,240,230,0.9)",
    border: "none",
    cursor: enabled ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: enabled ? "#fff" : "#c0ab99",
    fontSize: isMobile ? 13 : 17,
    boxShadow: enabled ? "0 4px 16px rgba(107,15,42,.30)" : "none",
    zIndex: 10,
    transition: "all .25s",
    opacity: enabled ? 1 : 0.45,
  });

  const visible = isMobile ? 2 : ROW_VISIBLE;
  const safeCw = cw > 0 ? cw : `calc(${100 / visible}% - ${ROW_GAP}px)`;

  return (
    <div
      ref={wrapRef}
      className="s-productdetai-227ead"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        style={arrowStyle(canLeft, "left")}
        onClick={() => scrollByCards(-1)}
        disabled={!canLeft}
      >
        <i className="bi bi-chevron-left" />
      </button>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="s-productdetai-3283d7 s-productdetai-e7ff84"
        style={isMobile ? {} : { gap: ROW_GAP }}
      >
        {products.map((p: any) => (
          <div
            key={p.productVariantId}
            className="s-productdetai-88ed30 s-productdetai-cb6468"
            style={
              isMobile
                ? {}
                : {
                    flex: `0 0 ${safeCw}${
                      typeof safeCw === "number" ? "px" : ""
                    }`,
                    width: typeof safeCw === "number" ? safeCw : undefined,
                    minWidth: typeof safeCw === "number" ? safeCw : undefined,
                  }
            }
          >
            {isMobile ? (
              <MobileProductCard product={p} onQuickShop={onQuickShop} />
            ) : (
              <ProductCard
                product={p}
                onQuickShop={onQuickShop}
                showDiscountTag={false}
              />
            )}
          </div>
        ))}
      </div>

      <button
        style={arrowStyle(canRight, "right")}
        onClick={() => scrollByCards(1)}
        disabled={!canRight}
      >
        <i className="bi bi-chevron-right" />
      </button>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();

  const [activeImg, setActiveImg] = useState(0);
  const [selBandId, setSelBandId] = useState<number | null>(null);
  const [selCupId, setSelCupId] = useState<number | null>(null);
  const [selectedPVDId, setSelectedPVDId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "additional">(
    "description",
  );
  const [showForm, setShowForm] = useState(false);
  const [rForm, setRForm] = useState({
    displayName: "",
    email: "",
    rating: 5,
    comment: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [currentVId, setCurrentVId] = useState(Number(id) || 0);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [pageNotif, setPageNotif] = useState<PageNotif | null>(null);
  const [showStockTip, setShowStockTip] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [showStickyActions, setShowStickyActions] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const activeTabRef = useRef(searchParams.get("tab"));
  const actionRowRef = useRef<HTMLDivElement>(null);
  const lastMainImageTapRef = useRef<{
    time: number;
    x: number;
    y: number;
  } | null>(null);

  /* ── Thumbnail Pagination & Scrolling Logic ── */
  const thumbScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollThumbUp, setCanScrollThumbUp] = useState(false);
  const [canScrollThumbDown, setCanScrollThumbDown] = useState(false);

  const checkThumbScroll = useCallback(() => {
    const el = thumbScrollRef.current;
    if (!el) return;
    setCanScrollThumbUp(el.scrollTop > 2);
    setCanScrollThumbDown(el.scrollTop < el.scrollHeight - el.clientHeight - 2);
  }, []);

  const scrollThumbs = (dir: 1 | -1) => {
    const el = thumbScrollRef.current;
    if (!el) return;
    // 5 images (88px each) + 5 gaps (8px each) = exactly one full view jump
    const amount = (88 + 8) * 5;
    el.scrollBy({ top: dir * amount, behavior: "smooth" });
  };

  /* ── Mobile Horizontal Thumbnail Scroll ── */
  const mobileThumbScrollRef = useRef<HTMLDivElement>(null);
  const [canMobileThumbLeft, setCanMobileThumbLeft] = useState(false);
  const [canMobileThumbRight, setCanMobileThumbRight] = useState(true);

  const checkMobileThumbScroll = useCallback(() => {
    const el = mobileThumbScrollRef.current;
    if (!el) return;
    setCanMobileThumbLeft(el.scrollLeft > 2);
    setCanMobileThumbRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  const scrollMobileThumbs = (dir: 1 | -1) => {
    const el = mobileThumbScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 130, behavior: "smooth" });
  };

  /* Touch swipe for mobile thumbnail strip */
  const mobileThumbTouchX = useRef(0);
  const handleMobileThumbTouchStart = (e: React.TouchEvent) => {
    mobileThumbTouchX.current = e.touches[0].clientX;
  };
  const handleMobileThumbTouchEnd = (e: React.TouchEvent) => {
    const dx = mobileThumbTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 30) scrollMobileThumbs(dx > 0 ? 1 : -1);
  };

  /* Swipe the main image on both desktop and mobile */
  const mainImageSwipeRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });

  const resetMainImageSwipe = useCallback(() => {
    mainImageSwipeRef.current.active = false;
    mainImageSwipeRef.current.pointerId = null;
    mainImageSwipeRef.current.startX = 0;
    mainImageSwipeRef.current.startY = 0;
  }, []);

  const handleMainImagePointerDown = (
    e: React.PointerEvent<HTMLImageElement>,
  ) => {
    // preventDefault stops the browser from initiating a native drag operation,
    // which would steal pointer events and break the swipe gesture on desktop.
    e.preventDefault();
    mainImageSwipeRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  // Prevent the browser from doing anything while the user is dragging (desktop).
  const handleMainImagePointerMove = (
    e: React.PointerEvent<HTMLImageElement>,
  ) => {
    if (mainImageSwipeRef.current.active) e.preventDefault();
  };

  const handleMainImagePointerUp = (
    e: React.PointerEvent<HTMLImageElement>,
  ) => {
    const swipe = mainImageSwipeRef.current;
    if (!swipe.active || swipe.pointerId !== e.pointerId) return;

    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isTap = absX < 10 && absY < 10;

    if (images.length > 1 && absX > 40 && absX > absY * 1.1) {
      if (dx < 0) handleNext();
      else handlePrev();
    } else if (isTap) {
      const now = Date.now();
      const lastTap = lastMainImageTapRef.current;
      const isDoubleTap =
        !!lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MAX_DELAY &&
        Math.hypot(lastTap.x - e.clientX, lastTap.y - e.clientY) <=
          DOUBLE_TAP_MAX_DISTANCE;

      if (isDoubleTap) {
        lastMainImageTapRef.current = null;
        handleWishlist(true);
      } else {
        lastMainImageTapRef.current = {
          time: now,
          x: e.clientX,
          y: e.clientY,
        };
      }
    } else {
      lastMainImageTapRef.current = null;
    }

    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore capture release errors from interrupted gestures.
      }
    }
    resetMainImageSwipe();
  };

  /* ── Auto-scroll ref: holds the setInterval handle ── */
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    inWishlist,
    toggle: toggleWishlist,
    isPending: isWishlistBusy,
  } = useWishlistToggle(currentVId);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth <= 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    activeTabRef.current = searchParams.get("tab");
  }, [searchParams]);

  useEffect(() => {
    const n = Number(id);
    if (n > 0) {
      setCurrentVId(n);
      setSelBandId(null);
      setSelCupId(null);
      setSelectedPVDId(null);
      setActiveImg(0);
      if (activeTabRef.current !== "reviews") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [id]);

  useEffect(() => {
    lastMainImageTapRef.current = null;
    resetMainImageSwipe();
  }, [currentVId, resetMainImageSwipe]);

  // Auto-scroll to reviews section when navigated from testimonials (?tab=reviews)
  useEffect(() => {
    if (searchParams.get("tab") === "reviews") {
      const timer = setTimeout(() => {
        const el = document.getElementById("pd-reviews-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", currentVId],
    queryFn: () => getProductDetail(currentVId),
    enabled: currentVId > 0,
  });

  const { data: reviewData } = useQuery({
    queryKey: ["reviews", currentVId],
    queryFn: () =>
      listUserReviews({ productVariantId: currentVId, pageSize: 50 }),
    enabled: currentVId > 0,
  });

  const { data: similarRaw = [] } = useQuery<any[]>({
    queryKey: ["similar", product?.categoryId],
    queryFn: () =>
      listProducts({
        categoryIds: product?.categoryId,
        pageNumber: 1,
        pageSize: 100,
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    enabled: !!product?.categoryId,
    select: (d: any) =>
      (d?.list ?? []).filter((p: any) => p.productId !== product?.productId),
  });

  const similarProducts = useMemo(() => {
    const groups = new Map<number, any[]>();
    similarRaw.forEach((p: any) => {
      if (!groups.has(p.productId)) groups.set(p.productId, []);
      groups.get(p.productId)!.push(p);
    });
    return Array.from(groups.values())
      .slice(0, 8)
      .map((variants) => ({
        ...variants[0],
        allVariants: variants,
        allColors: variants.map((v: any) => v.color).filter(Boolean),
      }));
  }, [similarRaw]);

  const { data: exploreRaw = [] } = useQuery<any[]>({
    queryKey: ["explore", product?.categoryId],
    queryFn: () =>
      listProducts({
        pageNumber: 1,
        pageSize: 100,
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    enabled: !!product?.categoryId,
    select: (d: any) =>
      (d?.list ?? []).filter((p: any) => p.categoryId !== product?.categoryId),
  });

  const exploreProducts = useMemo(() => {
    const groups = new Map<number, any[]>();
    exploreRaw.forEach((p: any) => {
      if (!groups.has(p.productId)) groups.set(p.productId, []);
      groups.get(p.productId)!.push(p);
    });
    const grouped = Array.from(groups.values()).map((variants) => ({
      ...variants[0],
      allVariants: variants,
      allColors: variants.map((v: any) => v.color).filter(Boolean),
    }));
    return grouped.slice(0, 12);
  }, [exploreRaw]);

  const reviews: any[] = reviewData?.list ?? [];
  const images: string[] = (
    product?.images?.length
      ? product.images
      : product?.image
      ? [product.image]
      : []
  ).map(getImageUrl);
  const colors: any[] = product?.colors ?? [];
  const selectedColorSwatch = colors.find(
    (c: any) => c.productVariantId === currentVId,
  );
  const selectedColor: string =
    selectedColorSwatch?.colorName ?? selectedColorSwatch?.color ?? "";

  useEffect(() => {
    if (!isMobileViewport) {
      setShowStickyActions(false);
      return;
    }

    const el = actionRowRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShowStickyActions(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // The actual Add to Cart / Buy Now row is on screen — hide sticky
          setShowStickyActions(false);
        } else if (entry.boundingClientRect.top > 0) {
          // Buttons are below the viewport — user hasn't reached them — show sticky
          setShowStickyActions(true);
        }
        // If top < 0: buttons are above (user scrolled past them) — keep hidden
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobileViewport, product?.productId]);

  /* Fire checkThumbScroll once images load so we know if we need arrows initially */
  useEffect(() => {
    const t = setTimeout(() => {
      checkThumbScroll();
      checkMobileThumbScroll();
    }, 100);
    return () => clearTimeout(t);
  }, [images, checkThumbScroll, checkMobileThumbScroll]);

  /* ── Auto-scroll: start/restart the 6-second interval ── */
  const startAutoScroll = useCallback((imgCount: number) => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    if (imgCount <= 1) return;
    autoScrollRef.current = setInterval(() => {
      setActiveImg((i) => (i + 1) % imgCount);
    }, 6000);
  }, []);

  /* Start auto-scroll whenever the images list changes (new product loaded) */
  useEffect(() => {
    startAutoScroll(images.length);
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [images.length, startAutoScroll]);

  /* Make sure the active thumbnail is always scrolled into view (desktop vertical) */
  useEffect(() => {
    const el = thumbScrollRef.current;
    if (!el) return;
    const thumbItem = el.children[activeImg] as HTMLElement;
    if (thumbItem) {
      const itemTop = thumbItem.offsetTop;
      const itemBottom = itemTop + thumbItem.clientHeight;
      const viewTop = el.scrollTop;
      const viewBottom = viewTop + el.clientHeight;
      if (itemTop < viewTop || itemBottom > viewBottom) {
        thumbItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeImg]);

  /* Sync mobile horizontal thumb strip to active image */
  useEffect(() => {
    const el = mobileThumbScrollRef.current;
    if (!el) return;
    const thumbItem = el.children[activeImg] as HTMLElement;
    if (thumbItem) {
      const itemLeft = thumbItem.offsetLeft;
      const itemRight = itemLeft + thumbItem.clientWidth;
      const viewLeft = el.scrollLeft;
      const viewRight = viewLeft + el.clientWidth;
      if (itemLeft < viewLeft || itemRight > viewRight) {
        const targetLeft = Math.max(
          0,
          itemLeft - (el.clientWidth - thumbItem.clientWidth) / 2,
        );
        el.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    }
    checkMobileThumbScroll();
  }, [activeImg, checkMobileThumbScroll]);

  /* Manual thumbnail click — show that thumb, then resume countdown */
  const handleThumbClick = (i: number) => {
    setActiveImg(i);
    startAutoScroll(images.length);
  };

  /* Manual prev/next arrow click — change image, then resume countdown */
  const handlePrev = () => {
    setActiveImg((i) => (i - 1 + images.length) % images.length);
    startAutoScroll(images.length);
  };
  const handleNext = () => {
    setActiveImg((i) => (i + 1) % images.length);
    startAutoScroll(images.length);
  };

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0;
  const totalReviews = reviews.length;
  const breakdown = [5, 4, 3, 2, 1].map((n) => ({
    star: n,
    count: reviews.filter((r: any) => r.rating === n).length,
  }));
  const discount =
    (product?.originalPrice || 0) > (product?.price || 0)
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : 0;

  const hasCupSize = !!product?.isCupSize && !isAlphaSizeProduct(product?.name);
  const rawSizes: any[] = product?.sizes ?? [];
  const allCupSizes: any[] = product?.cupSizes ?? [];
  const pvdMatrix: any[] = product?.pvdMatrix ?? [];

  const allSizes: any[] = hasCupSize
    ? rawSizes.filter((s: any) => /^\d+$/.test(s.sizeLabel))
    : rawSizes.filter((s: any) => !/^\d+$/.test(s.sizeLabel));

  const cupAvail = (cupId: number) => {
    if (!selBandId) {
      const cu = allCupSizes.find((x: any) => x.cupSizeId === cupId);
      return {
        inVariant: cu?.inVariant ?? false,
        hasStock: cu?.hasStock ?? false,
        stock: 0,
      };
    }
    const row = pvdMatrix.find(
      (r: any) => r.sizeId === selBandId && r.cupSizeId === cupId,
    );
    if (!row) return { inVariant: false, hasStock: false, stock: 0 };
    return {
      inVariant: true,
      hasStock: row.stock > 0,
      stock: row.stock as number,
    };
  };

  const selPvdRow = pvdMatrix.find(
    (r: any) => r.productVariantDetailId === selectedPVDId,
  );
  const dispPrice = selPvdRow?.finalPrice ?? product?.price ?? 0;
  const dispMrp = selPvdRow?.mrpPrice ?? product?.originalPrice ?? 0;
  const selStock =
    selPvdRow?.stock ??
    (selBandId && !hasCupSize
      ? allSizes.find((s: any) => s.sizeId === selBandId)?.stock ?? null
      : null);
  const isOOS = selStock !== null && selStock <= 0;
  const selLabel = selBandId
    ? allSizes.find((s: any) => s.sizeId === selBandId)?.sizeLabel ?? ""
    : "";
  const cupLabel = selCupId
    ? allCupSizes.find((c: any) => c.cupSizeId === selCupId)?.sizeLabel ?? ""
    : "";

  const onBand = (s: any) => {
    if (!s.inVariant || !s.hasStock) return;
    setSelBandId(s.sizeId);
    setSelCupId(null);
    setQuantity(1);
    if (!hasCupSize) {
      setSelectedPVDId(s.productVariantDetailId ?? null);
    } else {
      const avail = pvdMatrix.filter(
        (r: any) => r.sizeId === s.sizeId && r.stock > 0,
      );
      if (avail.length === 1) {
        setSelCupId(avail[0].cupSizeId);
        setSelectedPVDId(avail[0].productVariantDetailId);
      } else setSelectedPVDId(null);
    }
  };

  const onCup = (cupId: number) => {
    const a = cupAvail(cupId);
    if (!a.inVariant || !a.hasStock) return;
    setSelCupId(cupId);
    const row = pvdMatrix.find(
      (r: any) => r.sizeId === selBandId && r.cupSizeId === cupId,
    );
    if (row) setSelectedPVDId(row.productVariantDetailId);
    setQuantity(1);
  };

  const showWarn = (message: string, type: PageNotif["type"] = "warn") =>
    setPageNotif({ message, type });

  const validate = () => {
    const entirelyOOS =
      allSizes.length > 0 &&
      allSizes.every((s: any) => !s.hasStock) &&
      (!hasCupSize || allCupSizes.every((c: any) => !c.hasStock));
    if (entirelyOOS) {
      toast("Out of stock — we'll restock soon! 🛍️", {
        icon: "⏳",
        style: { background: "var(--brand)", color: "#fff", fontWeight: 600 },
      });
      return false;
    }
    if (hasCupSize) {
      if (!selBandId) {
        showWarn("Please select a band size");
        return false;
      }
      if (!selCupId) {
        showWarn("Please select a cup size");
        return false;
      }
    } else if (allSizes.some((s: any) => s.inVariant) && !selBandId) {
      showWarn("Please select your size");
      return false;
    }
    if (selStock !== null && quantity > selStock) {
      showWarn(
        `Only ${selStock} unit${selStock !== 1 ? "s" : ""} available`,
        "warn",
      );
      setQuantity(selStock);
      return false;
    }
    return true;
  };

  const cartMutation = useMutation({
    mutationFn: (obj: any) => addToCart(obj),
    onSuccess: () => {
      toast.success("Added to cart!");
      setCartCount(cartCount + 1);
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to add to cart"),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: any) => createReview(data),
    onSuccess: () => {
      toast.success("Review submitted!");
      setShowForm(false);
      setRForm({ displayName: "", email: "", rating: 5, comment: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      qc.invalidateQueries({ queryKey: ["reviews", currentVId] });
      qc.invalidateQueries({ queryKey: ["reviews-home"] });
    },
  });

  const persistGuestCart = (showToast = true) => {
    const gc = JSON.parse(localStorage.getItem("guestCart") || "[]");
    const key = `${currentVId}-${selectedPVDId}`;
    const idx = gc.findIndex(
      (x: any) => `${x.productVariantId}-${x.productVariantDetailId}` === key,
    );
    if (idx >= 0) {
      gc[idx].quantity = (gc[idx].quantity || 1) + quantity;
      gc[idx].processedQuantity = gc[idx].quantity;
      if (selStock !== null) gc[idx].stockQuantity = selStock;
    } else {
      gc.push({
        productId: product?.productId,
        productVariantId: currentVId,
        productVariantDetailId: selectedPVDId,
        quantity,
        processedQuantity: quantity,
        finalPrice: dispPrice,
        mrpPrice: dispMrp,
        productName: product?.name,
        image: images[0] || "",
        imageURL: images[0] || "",
        color: selectedColor || "",
        size: selLabel || "",
        cupSize: cupLabel || "",
        isSelected: true,
        stockQuantity: selStock ?? undefined,
      });
    }

    localStorage.setItem("guestCart", JSON.stringify(gc));
    window.dispatchEvent(new Event("guestCartUpdated"));
    if (showToast) toast.success("Added to cart!");
  };

  const handleAddToCart = () => {
    if (!validate()) return;
    if (hasValidToken()) {
      cartMutation.mutate({
        productVariantDetailId: selectedPVDId,
        productId: product?.productId,
        productVariantId: currentVId,
        state: "Created",
        userProfileId: getUserId(),
        quantity,
      });
    } else {
      persistGuestCart();
    }
  };

  const handleBuyNow = () => {
    if (!validate()) return;
    const returnState = { from: location.pathname + location.search };

    // Build a CartModel-shaped item for the Buy Now session.
    // This does NOT touch the real cart — cart items are left untouched.
    const buyNowItem = {
      cartId: 0,
      productId: product?.productId ?? null,
      productVariantId: currentVId,
      productVariantDetailId: selectedPVDId,
      productCode: product?.productCode ?? null,
      productName: product?.name ?? null,
      name: product?.name ?? null,
      productDescription: null,
      brandName: product?.brandName ?? null,
      categoryId: product?.categoryId ?? null,
      brandId: null,
      variantName: null,
      variantDescription: null,
      size: selLabel || null,
      cupSize: cupLabel || null,
      colorName: selectedColor || null,
      colorHex: null,
      color: selectedColor || null,
      stockQuantity: selStock ?? null,
      processedQuantity: quantity,
      returnedQuantity: null,
      discountPercent: discount || null,
      mrpPrice: dispMrp || null,
      finalPrice: dispPrice || null,
      personalId: null,
      userProfileId: getUserId() || null,
      state: "Created",
      image: images[0] || null,
      isSelected: true,
    };

    setBuyNowSession([buyNowItem as any]);
    const store = useCartStore.getState();
    store.removeCoupon?.();
    store.setShipping?.(null);

    navigate("/user-products/cart?buyNow=1", {
      state: returnState,
    });
  };

  const handleWishlist = (forceAdd = false) => {
    if (isWishlistBusy) return;
    if (forceAdd && inWishlist) return;
    toggleWishlist({
      productId: product?.productId,
      productVariantId: currentVId,
      name: product?.name,
      price: dispPrice || product?.price,
      oldPrice: dispMrp || product?.originalPrice,
      image: images[0] || "",
      color: selectedColor,
    });
  };

  const handleShare = () => {
    if (navigator.share)
      navigator.share({ title: product?.name, url: window.location.href });
    else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  const pdCatId = product?.categoryId ?? 0;
  const detailCrumbs = useBreadcrumb({
    catId: pdCatId || undefined,
    currentLabel: product?.name || undefined,
  });

  // Push dynamic crumbs (category tree + product name) into the global breadcrumb
  const { setCrumbs } = useBreadcrumbStore();
  useEffect(() => {
    if (detailCrumbs.length > 0) setCrumbs(detailCrumbs);
  }, [detailCrumbs, setCrumbs]);

  const btnStyle: React.CSSProperties = {
    background: "var(--brand)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: FONTS,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  if (isLoading)
    return (
      <div className="s-blog1-3b196e">
        <div className="s-productdetai-fa17e1" />
      </div>
    );
  if (!product)
    return (
      <div className="s-productdetai-490f26">
        <i className="bi bi-box-seam s-orderslist-94e3bd" />
        <h4 className="s-adminbrands-95b451">Product not found</h4>
        <Link
          to="/user-products/product-list"
          className="s-productdetai-b87156"
        >
          Browse Products
        </Link>
      </div>
    );

  return (
    <>
      {pageNotif && (
        <PageNotification notif={pageNotif} onDone={() => setPageNotif(null)} />
      )}

      <div className="container s-productdetai-312006 s-productdetai-ffe77190">
        {/* ── Two-column layout ── */}
        <div className="s-productdetai-3bf9d0">
          {/* LEFT: sticky image gallery */}
          <div className="pd-left-col s-productdetai-993ff1">
            <div
              className="pd-gallery-row s-adminbrands-bccf37"
              style={{ alignItems: "flex-start" }}
            >
              {/* ── Thumbnail column with Exactly 5 Visible + Arrows ── */}
              {images.length > 1 && (
                <div
                  className="pd-desktop-thumb-col"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "76px",
                    flexShrink: 0,
                  }}
                >
                  {/* Up Arrow (Only visible if scrolled down) */}
                  {canScrollThumbUp ? (
                    <button
                      onClick={() => scrollThumbs(-1)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--brand)",
                        cursor: "pointer",
                        fontSize: "20px",
                        padding: "4px 0",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      <i className="bi bi-chevron-up" />
                    </button>
                  ) : (
                    <div style={{ height: "30px" }} />
                  )}

                  {/* Scrollable Container constrained exactly to 5 images (472px) */}
                  <div
                    ref={thumbScrollRef}
                    onScroll={checkThumbScroll}
                    className="pd-thumb-col s-productdetai-f26fa6"
                    style={{
                      maxHeight: "472px", // 5 images (88px each) + 4 gaps (8px each) = 440 + 32 = 472px
                      overflowY: "auto", // NATIVE SCROLLING RE-ENABLED HERE
                      overflowX: "hidden",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      paddingRight: "0px",
                      flexShrink: 0,
                      scrollBehavior: "smooth",
                    }}
                  >
                    {images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt=""
                        onClick={() => handleThumbClick(i)}
                        className="s-productdetai-81ffd3"
                        style={{
                          border: `2px solid ${
                            activeImg === i ? "var(--brand)" : "var(--ivory)"
                          }`,
                          opacity: activeImg === i ? 1 : 0.65,
                          flexShrink: 0,
                          width: "72px",
                          height: "88px",
                          objectFit: "cover",
                          margin: "0 auto",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>

                  {/* Down Arrow / "More" (Only visible if there's room to scroll down) */}
                  {canScrollThumbDown ? (
                    <button
                      onClick={() => scrollThumbs(1)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--brand)",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "4px 0",
                        height: "40px",
                        width: "100%",
                        textTransform: "uppercase",
                      }}
                    >
                      <span>More</span>
                      <i
                        className="bi bi-chevron-down"
                        style={{ fontSize: "16px", marginTop: "-4px" }}
                      />
                    </button>
                  ) : (
                    <div style={{ height: "40px" }} />
                  )}
                </div>
              )}

              {/* ── Main image ── */}
              <div className="s-productdetai-c12f49">
                {images.length > 0 ? (
                  <img
                    src={images[activeImg]}
                    alt={product.name}
                    className="s-productdetai-20b6f1 pd-main-image"
                    draggable={false}
                    onPointerDown={handleMainImagePointerDown}
                    onPointerMove={handleMainImagePointerMove}
                    onPointerUp={handleMainImagePointerUp}
                    onPointerCancel={resetMainImageSwipe}
                    onDragStart={(e) => e.preventDefault()}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/category-bg.png";
                    }}
                  />
                ) : (
                  <div className="s-productdetai-cc055a">
                    <i className="bi bi-image s-productdetai-f49855" />
                  </div>
                )}

                {/* Prev / Next arrows — now wired to handlePrev / handleNext */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="s-productdetai-40460d"
                    >
                      ‹
                    </button>
                    <button
                      onClick={handleNext}
                      className="s-productdetai-1e0af4"
                    >
                      ›
                    </button>

                    {/* ── Dot indicators showing current image & progress ── */}
                    <div className="s-productdetai-20eb94">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => handleThumbClick(i)}
                          className="s-productdetai-ae8395"
                          style={{
                            width: activeImg === i ? 20 : 8,
                            background:
                              activeImg === i
                                ? "var(--brand)"
                                : "rgba(255,255,255,0.7)",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── Mobile-only: horizontal thumbnail strip with arrows ── */}
              {images.length > 1 && (
                <div className="pd-mobile-thumb-strip">
                  <button
                    className="pd-mobile-thumb-arrow"
                    onClick={() => scrollMobileThumbs(-1)}
                    disabled={!canMobileThumbLeft}
                    style={{ opacity: canMobileThumbLeft ? 1 : 0.3 }}
                  >
                    <i className="bi bi-chevron-left" />
                  </button>
                  <div
                    ref={mobileThumbScrollRef}
                    className="pd-mobile-thumb-scroll"
                    onScroll={checkMobileThumbScroll}
                    onTouchStart={handleMobileThumbTouchStart}
                    onTouchEnd={handleMobileThumbTouchEnd}
                  >
                    {images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt=""
                        onClick={() => handleThumbClick(i)}
                        className="pd-mobile-thumb-img"
                        style={{
                          border: `2px solid ${
                            activeImg === i ? "var(--brand)" : "transparent"
                          }`,
                          opacity: activeImg === i ? 1 : 0.65,
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="pd-mobile-thumb-arrow"
                    onClick={() => scrollMobileThumbs(1)}
                    disabled={!canMobileThumbRight}
                    style={{ opacity: canMobileThumbRight ? 1 : 0.3 }}
                  >
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: scrollable info */}
          <div>
            <div className="s-productdetai-a5163d">
              <div className="s-userdashboar-7aa8c4">
                {product.brandName && (
                  <p className="s-productdetai-a025fe s-productdetai-ff85a0a9">
                    {product.brandName}
                  </p>
                )}
                <h1 className="s-productdetai-2d0f51 s-productdetai-ff85a0a9">
                  {product.name}
                </h1>
              </div>

              <div className="s-productdetai-121533">
                <div className="s-adminproduct-6209be">
                  <button
                    onClick={() => handleWishlist()}
                    title={
                      inWishlist ? "Remove from wishlist" : "Save to wishlist"
                    }
                    className="s-productdetai-2405c9"
                    style={{
                      background: inWishlist
                        ? "linear-gradient(135deg, rgba(107,15,42,0.12) 0%, rgba(168,76,107,0.08) 100%)"
                        : "linear-gradient(135deg, #fff 0%, #f5f0e6 100%)",
                      border: `1.5px solid ${
                        inWishlist ? "var(--brand)" : "rgba(158,96,112,0.3)"
                      }`,
                      color: inWishlist ? "var(--brand)" : "var(--heirloom)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <i
                      className={`bi ${
                        inWishlist ? "bi-heart-fill" : "bi-heart"
                      }`}
                    />
                  </button>
                  <button
                    onClick={handleShare}
                    title="Share"
                    className="s-productdetai-614403"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <i className="bi bi-share" />
                  </button>
                </div>
                <div
                  className="s-productdetai-088cf9"
                  onClick={() => {
                    document
                      .getElementById("pd-reviews-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Stars rating={avgRating} size={13} />
                  {avgRating > 0 && (
                    <span className="s-productdetai-cf3f7f s-productdetai-ffe77190">
                      {avgRating.toFixed(1)}
                    </span>
                  )}
                  <span className="s-productdetai-465cd0" />
                  <span className="s-productdetai-4ed7ad s-productdetai-ffe77190">
                    {totalReviews > 0
                      ? `${totalReviews} Review${totalReviews !== 1 ? "s" : ""}`
                      : "No reviews"}
                  </span>
                </div>
              </div>
            </div>

            {product.productCode && (
              <p className="s-productdetai-264680 s-productdetai-ffe77190">
                SKU: {product.productCode}
              </p>
            )}

            <div className="s-productdetai-404819">
              <span className="s-productdetai-4a68f9 s-productdetai-ff85a0a9">
                {formatPrice(product.price || 0)}
              </span>
              {(product.originalPrice || 0) > (product.price || 0) && (
                <>
                  <span className="s-productdetai-b1cd3b s-productdetai-ffe77190">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="s-productdetai-d3ead5 s-productdetai-ffe77190">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <div
                dangerouslySetInnerHTML={{ __html: product.description }}
                className="s-productdetai-59e718 s-productdetai-ffe77190"
              />
            )}

            <div className="s-productdetai-239f8e" />

            {colors.length > 0 && (
              <div className="s-adminblog-19fd7a">
                <p className="s-productdetai-06262c s-productdetai-ff85a0a9">
                  Color:{" "}
                  <span className="s-productdetai-6ed0de">
                    {colors.find((c: any) => c.productVariantId === currentVId)
                      ?.colorName ??
                      colors.find((c: any) => c.productVariantId === currentVId)
                        ?.color ??
                      ""}
                  </span>
                </p>
                <div className="s-adminproduct-47622e">
                  {colors.map((c: any) => (
                    <button
                      key={c.productVariantId}
                      onClick={() => {
                        if (c.productVariantId !== currentVId) {
                          setCurrentVId(c.productVariantId);
                          navigate(
                            `/user-products/product-detail/${
                              c.productVariantId
                            }/${slugify(product?.name || "product")}`,
                          );
                        }
                      }}
                      title={c.colorName ?? c.color ?? ""}
                      className="s-productdetai-e37fda"
                      style={{
                        border: `2.5px solid ${
                          c.productVariantId === currentVId
                            ? "var(--brand)"
                            : "transparent"
                        }`,
                      }}
                    >
                      <img
                        src={getImageUrl(c.image)}
                        alt={c.colorName ?? c.color ?? "color"}
                        className="s-productdetai-f2b35e"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          const d = document.createElement("div");
                          d.style.cssText = `width:64px;height:78px;border-radius:6px;background:${resolveHex(
                            c.colorHex ?? c.color,
                          )}`;
                          img.parentElement?.appendChild(d);
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allSizes.length > 0 && (
              <div className="s-updateprofil-246fef">
                <div className="s-productdetai-858448">
                  <p className="s-productdetai-8d5dc6 s-productdetai-ff85a0a9">
                    {hasCupSize ? "Band Size" : "Size"}
                    {selLabel && (
                      <span className="s-productdetai-84f726">
                        {selLabel}
                        {cupLabel ? ` / ${cupLabel}` : ""}
                        {selStock !== null && !isOOS && (
                          <span
                            className="s-productdetai-cd29bb"
                            style={{
                              color:
                                selStock <= 3 ? "var(--brand)" : "var(--brand)",
                            }}
                          >
                            {selStock <= 3
                              ? `(${selStock} left)`
                              : "✓ In stock"}
                          </span>
                        )}
                        {isOOS && (
                          <span className="s-paymentaddre-b0868f">
                            Out of stock
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                  <Link
                    to="/size-guide"
                    className="s-productdetai-fea0e7 s-productdetai-ffe77190"
                  >
                    Size Guide
                  </Link>
                </div>
                <div className="s-adminorders-2af484">
                  {allSizes.map((s: any) => {
                    const sel = selBandId === s.sizeId;
                    if (!s.inVariant)
                      return (
                        <span
                          key={s.sizeId}
                          title="Not available"
                          className="s-productdetai-0ae4b7 s-productdetai-ffe77190"
                        >
                          {s.sizeLabel}
                        </span>
                      );
                    if (!s.hasStock)
                      return (
                        <span
                          key={s.sizeId}
                          title="Out of stock"
                          className="s-productdetai-01b966 s-productdetai-ffe77190"
                        >
                          {s.sizeLabel}
                        </span>
                      );
                    return (
                      <button
                        key={s.sizeId}
                        onClick={() => onBand(s)}
                        className="s-productdetai-a9a160"
                        style={{
                          border: `2px solid ${
                            sel ? "var(--brand)" : "var(--heirloom)"
                          }`,
                          background: sel ? "var(--brand)" : "#fff",
                          color: sel ? "#fff" : "#000000",
                          fontFamily: FONT_UI,
                          fontWeight: sel ? 700 : 500,
                        }}
                      >
                        {s.sizeLabel}
                        {s.stock > 0 && s.stock <= 3 && (
                          <span className="s-productdetai-0707db" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasCupSize && allCupSizes.length > 0 && (
              <div className="s-updateprofil-246fef">
                <p className="s-productdetai-06262c s-productdetai-ff85a0a9">
                  Cup Size:{" "}
                  <span className="s-productdetai-6ed0de">{cupLabel}</span>
                </p>
                <div className="s-adminorders-2af484">
                  {allCupSizes.map((cs: any) => {
                    const av = cupAvail(cs.cupSizeId);
                    const sel = selCupId === cs.cupSizeId;
                    if (!av.inVariant)
                      return (
                        <span
                          key={cs.cupSizeId}
                          title="Not available"
                          className="s-productdetai-0faa78 s-productdetai-ffe77190"
                        >
                          {cs.sizeLabel}
                        </span>
                      );
                    if (!av.hasStock)
                      return (
                        <span
                          key={cs.cupSizeId}
                          title="Out of stock"
                          className="s-productdetai-63c23a s-productdetai-ffe77190"
                        >
                          {cs.sizeLabel}
                        </span>
                      );
                    return (
                      <button
                        key={cs.cupSizeId}
                        onClick={() => onCup(cs.cupSizeId)}
                        className="s-productdetai-83f876"
                        style={{
                          border: `2px solid ${
                            sel ? "var(--brand)" : "var(--heirloom)"
                          }`,
                          background: sel ? "var(--brand)" : "#fff",
                          color: sel ? "#fff" : "#000000",
                          fontFamily: FONT_UI,
                          fontWeight: sel ? 700 : 500,
                        }}
                      >
                        {cs.sizeLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Stock */}
            {(() => {
              const entirelyOOS =
                allSizes.length > 0 &&
                allSizes.every((s: any) => !s.hasStock) &&
                (!hasCupSize || allCupSizes.every((c: any) => !c.hasStock));

              if (entirelyOOS)
                return (
                  <div className="s-productdetai-7cf585">
                    <i className="bi bi-slash-circle s-productdetai-db68d0" />
                    <div>
                      <p className="s-productdetai-d617ad s-productdetai-ffe77190">
                        Out of Stock
                      </p>
                      <p className="s-productdetai-d67440">
                        We'll be back soon — check again later!
                      </p>
                    </div>
                  </div>
                );

              const hasSizes = allSizes.some((s: any) => s.inVariant);
              const qtyLocked = hasSizes && selectedPVDId === null;
              return (
                <div className="s-productdetai-c9ee63">
                  <div className="s-updateprofil-1d5e50">
                    <div
                      className="s-productdetai-dbae90"
                      style={{
                        border: `1.5px solid ${
                          qtyLocked ? "var(--ivory)" : "var(--ivory)"
                        }`,
                        background: qtyLocked ? "var(--ivory)" : "#fff",
                      }}
                    >
                      <button
                        disabled={qtyLocked || quantity <= 1}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="s-productdetai-631941"
                        style={{
                          cursor:
                            qtyLocked || quantity <= 1
                              ? "not-allowed"
                              : "pointer",
                          color:
                            qtyLocked || quantity <= 1
                              ? "var(--ivory)"
                              : "#000000",
                        }}
                      >
                        −
                      </button>
                      <span
                        className="s-productdetai-3e73a5"
                        style={{
                          fontFamily: FONTS,
                          color: qtyLocked ? "var(--heirloom)" : "#000000",
                        }}
                      >
                        {quantity}
                      </span>
                      <button
                        disabled={qtyLocked}
                        onClick={() => {
                          if (selStock !== null && quantity >= selStock) {
                            setShowStockTip(true);
                            setTimeout(() => setShowStockTip(false), 2200);
                            return;
                          }
                          setQuantity((q) => q + 1);
                        }}
                        className="s-productdetai-5c049f"
                        style={{
                          cursor:
                            qtyLocked ||
                            (selStock !== null && quantity >= selStock)
                              ? "not-allowed"
                              : "pointer",
                          color:
                            qtyLocked ||
                            (selStock !== null && quantity >= selStock)
                              ? "var(--ivory)"
                              : "var(--brand)",
                        }}
                      >
                        +
                      </button>
                    </div>
                    {isMobileViewport && (
                      <div className="pd-mobile-qty-price" aria-live="polite">
                        <span className="pd-mobile-qty-price__label">
                          Price
                        </span>
                        <span className="pd-mobile-qty-price__value">
                          {formatPrice(
                            (dispPrice || product?.price || 0) * quantity,
                          )}
                        </span>
                      </div>
                    )}
                    {showStockTip && selStock !== null && (
                      <div className="s-productdetai-0f3955">
                        {selStock} available
                      </div>
                    )}
                    {qtyLocked && (
                      <p className="s-productdetai-41432e">
                        ↑ Select a size first
                      </p>
                    )}
                  </div>

                  {!qtyLocked && selStock !== null && (
                    <p
                      className="s-productdetai-eeb06b"
                      style={{
                        fontFamily: FONT_UI,
                        color: isOOS
                          ? "var(--brand)"
                          : selStock <= 3
                          ? "var(--brand)"
                          : "var(--brand)",
                      }}
                    >
                      {isOOS
                        ? "🚫 Out of stock"
                        : selStock <= 3
                        ? `⚠️ Only ${selStock} left!`
                        : "✓ In stock"}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Primary actions */}
            <div className="pd-action-row" ref={actionRowRef}>
              <button
                onClick={handleAddToCart}
                disabled={cartMutation.isPending || isOOS}
                className="pd-action-btn pd-action-btn--cart"
              >
                {cartMutation.isPending ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-cart3" />
                )}
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={cartMutation.isPending || isOOS}
                className="pd-action-btn pd-action-btn--buy"
              >
                <i className="bi bi-bolt-fill" />
                Buy Now
              </button>
            </div>

            {isMobileViewport && (
              <div
                className={`pd-sticky-action-shell${
                  showStickyActions ? " is-visible" : ""
                }`}
                aria-hidden={!showStickyActions}
              >
                <div className="pd-action-row pd-sticky-action-row">
                  <button
                    onClick={handleAddToCart}
                    disabled={cartMutation.isPending || isOOS}
                    className="pd-action-btn pd-action-btn--cart"
                  >
                    {cartMutation.isPending ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-cart3" />
                    )}
                    Add to Cart
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={cartMutation.isPending || isOOS}
                    className="pd-action-btn pd-action-btn--buy"
                  >
                    <i className="bi bi-bolt-fill" />
                    Buy Now
                  </button>
                </div>
              </div>
            )}

            <div className="s-productdetai-684078 pd-hide-mobile">
              <button
                onClick={() => handleWishlist()}
                className="s-productdetai-c98011 s-productdetai-ff85a0a9"
              >
                <i
                  className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
                  style={{
                    color: inWishlist ? "var(--brand)" : "var(--brand)",
                  }}
                />
                {inWishlist ? "Wishlisted" : "Wishlist"}
              </button>
              <button
                onClick={handleShare}
                className="s-productdetai-68c9a4 s-productdetai-ff85a0a9"
              >
                <i className="bi bi-share" /> Share
              </button>
            </div>

            {product.isReturnAvailable && (
              <p className="s-productdetai-ecd15c s-productdetai-ffe77190">
                <i className="bi bi-arrow-return-left me-1" />
                Easy returns available within 15 days
              </p>
            )}
            <div className="s-productdetai-0ad54d" aria-hidden="true" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div id="pd-tabs" className="s-productdetai-478f1c">
          <div className="s-productdetai-3d764b">
            {(["description", "additional"] as const).map((tab, i) => {
              const label = ["Description", "Additional Information"][i];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="s-productdetai-227547"
                  style={{
                    fontWeight: activeTab === tab ? 700 : 400,
                    color: activeTab === tab ? "#000000" : "var(--heirloom)",
                    borderBottom: `3px solid ${
                      activeTab === tab ? "var(--brand)" : "transparent"
                    }`,
                    fontFamily: FONTS,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === "description" && (
            <div className="s-productdetai-ec3045 s-productdetai-ffe77190">
              {product.description ? (
                <div
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p className="s-adminbrands-95b451">
                  No description available.
                </p>
              )}
              {product.tag && (
                <p className="s-productdetai-cdd3f3">
                  <strong>Tags:</strong> {product.tag}
                </p>
              )}
            </div>
          )}

          {activeTab === "additional" && (
            <table className="s-productdetai-17e9ae s-productdetai-ffe77190">
              <tbody>
                {[
                  product.productCode && ["SKU", product.productCode],
                  product.brandName && ["Brand", product.brandName],
                  product.isReturnAvailable !== undefined && [
                    "Returns",
                    product.isReturnAvailable
                      ? "Easy returns within 15 days"
                      : "Non-returnable",
                  ],
                  product.isCupSize !== undefined && [
                    "Cup sizing",
                    product.isCupSize ? "Yes" : "No",
                  ],
                ]
                  .filter(Boolean)
                  .map(([label, value]: any) => (
                    <tr key={label}>
                      <td className="s-productdetai-03ad4f">{label}</td>
                      <td className="s-productdetai-3e4e20">{value}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Standalone Reviews Section (below Additional Information) ── */}
        <div
          id="pd-reviews-section"
          className="s-productdetai-478f1c pd-reviews-standalone"
        >
          <div className="pd-reviews-header">
            <h2
              className="s-productdetai-8ef3c3 s-productdetai-ff85a0a9"
              style={{ fontFamily: FONTS }}
            >
              Reviews{" "}
              {totalReviews > 0 && (
                <span className="pd-reviews-count">({totalReviews})</span>
              )}
            </h2>
          </div>

          {totalReviews > 0 && (
            <div className="s-productdetai-07a510">
              <div className="s-adminnewslet-e2e1e0">
                <div className="s-productdetai-8ba13e s-productdetai-ff85a0a9">
                  {avgRating.toFixed(1)}
                </div>
                <Stars rating={avgRating} size={18} />
                <p className="s-productdetai-485fe5 s-productdetai-ffe77190">
                  {totalReviews} reviews
                </p>
              </div>
              <div className="s-userdashboar-6d7d28">
                {breakdown.map(({ star, count }) => (
                  <div key={star} className="s-productdetai-9fc601">
                    <span className="s-productdetai-dfdd5e s-productdetai-ffe77190">
                      {star}★
                    </span>
                    <div className="s-productdetai-788842">
                      <div
                        className="s-productdetai-1c4975"
                        style={{
                          width: `${
                            totalReviews ? (count / totalReviews) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="s-productdetai-701deb s-productdetai-ffe77190">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasValidToken() ? (
            <button
              onClick={() => {
                if (!showForm) {
                  const u = useAuthStore.getState().user;
                  setRForm((f) => ({
                    ...f,
                    displayName: u?.firstName
                      ? `${u.firstName} ${u.lastName ?? ""}`.trim()
                      : u?.name || "",
                    email: u?.email || "",
                  }));
                }
                setShowForm((v) => !v);
              }}
              style={{
                ...btnStyle,
                padding: "10px 22px",
                fontSize: 13,
                marginBottom: 20,
                width: "auto",
              }}
            >
              <i className="bi bi-pencil" /> Write a Review
            </button>
          ) : (
            <div className="s-productdetai-5e11d3">
              <i className="bi bi-lock s-productdetai-39554d" />
              Please{" "}
              <a href="/auth/login" className="s-productdetai-4ffa2d">
                sign in
              </a>{" "}
              to write a review
            </div>
          )}

          {showForm && (
            <div className="s-productdetai-55950f">
              <div className="row g-3">
                {[
                  ["displayName", "Your Name", "text"],
                  ["email", "Email", "email"],
                ].map(([k, l, t]) => (
                  <div key={k} className="col-md-6">
                    <label className="s-productdetai-149337 s-productdetai-ffe77190">
                      {l}
                    </label>
                    <input
                      className="form-control"
                      type={t}
                      value={(rForm as any)[k]}
                      onChange={(e) =>
                        setRForm((f) => ({ ...f, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="col-12">
                  <label className="s-productdetai-ce3a86 s-productdetai-ffe77190">
                    Rating
                  </label>
                  <Stars
                    rating={rForm.rating}
                    size={28}
                    interactive
                    onRate={(n) => setRForm((f) => ({ ...f, rating: n }))}
                  />
                </div>
                <div className="col-12">
                  <label className="s-productdetai-149337 s-productdetai-ffe77190">
                    Review
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={rForm.comment}
                    onChange={(e) =>
                      setRForm((f) => ({ ...f, comment: e.target.value }))
                    }
                  />
                </div>
                <div className="col-12">
                  <label className="s-productdetai-149337 s-productdetai-ffe77190">
                    Photo{" "}
                    <span className="s-productdetai-0f512b">(optional)</span>
                  </label>
                  <label className="s-productdetai-83019e">
                    <i className="bi bi-camera s-productdetai-f407f6" />
                    <span className="s-quickcart-08341f s-productdetai-ffe77190">
                      {photoFile ? photoFile.name : "Upload a photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="s-addressform-8251cb"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setPhotoFile(f);
                        setPhotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                  </label>
                  {photoPreview && (
                    <div className="s-productdetai-ae794c">
                      <img
                        src={photoPreview}
                        alt="preview"
                        className="s-productdetai-6e1f7a"
                      />
                      <button
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="s-productdetai-60f07a"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-12">
                  <button
                    onClick={() =>
                      reviewMutation.mutate({
                        productVariantId: currentVId,
                        productId: product?.productId,
                        userProfileId: getUserId(),
                        rating: rForm.rating,
                        name: rForm.displayName,
                        email: rForm.email,
                        comment: rForm.comment,
                        state: "Active",
                        photo: photoFile ?? undefined,
                      })
                    }
                    disabled={reviewMutation.isPending}
                    style={{
                      ...btnStyle,
                      padding: "10px 22px",
                      fontSize: 14,
                      width: "auto",
                      opacity: reviewMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {reviewMutation.isPending ? "Submitting…" : "Submit Review"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="s-productdetai-2959a9 s-productdetai-ffe77190">
              No reviews yet. Be the first!
            </p>
          ) : (
            reviews.map((r: any, i: number) => (
              <div key={i} className="s-productdetai-e82d15">
                <div className="s-paymentaddre-9998cf">
                  <div className="s-addresslist-f8b697">
                    {r.photo ? (
                      <img
                        src={
                          r.photo.startsWith("http")
                            ? r.photo
                            : `${(
                                import.meta.env.VITE_API_BASE_URL ||
                                "http://127.0.0.1:8000/api"
                              ).replace(/\/api$/, "")}${r.photo}`
                        }
                        alt="reviewer"
                        className="s-productdetai-55b05c"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <i className="bi bi-person-circle s-productdetai-c0ad13" />
                    )}
                  </div>
                  <div className="pd-review-content">
                    <div className="pd-review-meta">
                      <Stars rating={r.rating || 0} size={13} />
                      <span className="s-productdetai-de8fb2 s-productdetai-ff85a0a9">
                        {r.name || r.displayName || "Anonymous"}
                      </span>
                      <span className="s-adminnewslet-f01220 s-productdetai-ffe77190">
                        {r.createdDate
                          ? new Date(r.createdDate).toLocaleDateString("en-IN")
                          : ""}
                      </span>
                    </div>
                    {(r.title || r.reviewTitle) && (
                      <p className="s-productdetai-c46b5b s-productdetai-ff85a0a9">
                        {r.title || r.reviewTitle}
                      </p>
                    )}
                    <p className="s-admindashboa-f39764 s-productdetai-ffe77190">
                      {r.comment}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {similarProducts.length > 0 && (
          <div className="s-productdetai-478f1c">
            <p className="s-productdetai-f3099c s-productdetai-ffe77190">
              You May Also Like
            </p>
            <h2 className="s-productdetai-8ef3c3 s-productdetai-ff85a0a9">
              Similar Products
            </h2>
            <ScrollableProductRow
              products={similarProducts}
              onQuickShop={(id) => setQuickShopId(id)}
            />
          </div>
        )}

        {exploreProducts.length > 0 && (
          <div className="s-productdetai-478f1c">
            <p className="s-productdetai-f3099c s-productdetai-ffe77190">
              Discover More
            </p>
            <h2 className="s-productdetai-8ef3c3 s-productdetai-ff85a0a9">
              Explore Our Products
            </h2>
            <ScrollableProductRow
              products={exploreProducts}
              onQuickShop={(id) => setQuickShopId(id)}
            />
          </div>
        )}
      </div>

      <ShippingBar />
      {quickShopId && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(null)}
        />
      )}
    </>
  );
}
