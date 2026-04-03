/**
 * ProductDetail.tsx
 * Layout: Left = sticky image gallery (thumbnails left scrollable, main image right)
 *         Right = scrollable info panel
 * Below: Tabs → Similar Products (same category, ProductList card + grouping) →
 *        Shipping Bar → Footer (common)
 *
 * Changes:
 *  - Thumbnail column is now independently scrollable (hidden scrollbar)
 *  - Main image auto-advances every 6 s
 *  - Manual thumb click / arrow click resets the 6 s countdown
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  getProductDetail,
  listUserReviews,
  createReview,
  listProducts,
} from "@/features/products/api/products.api";
import { addToCart } from "@/features/cart/api/cart.api";
import { formatPrice, slugify, getImageUrl } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";

import Breadcrumb from "@/shared/components/Breadcrumb";
import { useBreadcrumb } from "@/shared/hooks/useBreadcrumb";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";

const PRI = "#6B0F2A";
const HEIRLOOM = "#9E6070";
const BLUSH = "#A84C6B";
const IVORY = "#F5F0E6";
const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

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
  }, [notif]);
  const bg =
    notif.type === "error"
      ? "#A84C6B"
      : notif.type === "warn"
        ? "#9E6070"
        : "#6B0F2A";
  const icon =
    notif.type === "error"
      ? "bi-exclamation-circle-fill"
      : notif.type === "warn"
        ? "bi-exclamation-triangle-fill"
        : "bi-info-circle-fill";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,.35)",
        animation: "pd-notif-bg .15s ease",
      }}
    >
      <div
        style={{
          background: bg,
          color: "#fff",
          padding: "18px 28px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 12px 36px rgba(0,0,0,.35)",
          maxWidth: 300,
          textAlign: "center",
          animation: "pd-notif-in .18s ease",
          lineHeight: 1.4,
        }}
      >
        <i className={`bi ${icon}`} style={{ fontSize: 20, flexShrink: 0 }} />
        <span>{notif.message}</span>
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
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = interactive
          ? (hover || rating) >= i
          : i <= Math.floor(rating);
        const half =
          !interactive && i === Math.ceil(rating) && !Number.isInteger(rating);
        return (
          <i
            key={i}
            className={`bi ${on ? "bi-star-fill" : half ? "bi-star-half" : "bi-star"}`}
            style={{
              fontSize: size,
              color: on || half ? "#6B0F2A" : "#ddd",
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
    <section className="shipping_section" style={{ fontFamily: FONTS }}>
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

/* ── ScrollableProductRow — real DOM smooth-scroll, matches Home ProductSlider ── */
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

  const measure = useCallback(() => {
    if (!wrapRef.current) return;
    const wrapWidth = wrapRef.current.clientWidth - 112;
    const c = Math.floor(
      (wrapWidth - ROW_GAP * (ROW_VISIBLE - 1)) / ROW_VISIBLE,
    );
    setCw(c > 0 ? c : 0);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    onScroll();
  }, [cw, products, onScroll]);

  const scrollByCards = (dir: 1 | -1) => {
    if (!scrollRef.current || !cw) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + dir * 2 * (cw + ROW_GAP),
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
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) scrollByCards(dx > 0 ? 1 : -1);
  };

  const arrowBtn = (
    enabled: boolean,
    dir: "left" | "right",
  ): React.CSSProperties => ({
    position: "absolute",
    top: "45%",
    transform: "translateY(-50%)",
    [dir]: 0,
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: enabled ? PRI : "#ede6da",
    border: "none",
    cursor: enabled ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: enabled ? "#fff" : "#c0ab99",
    fontSize: 17,
    boxShadow: enabled ? "0 4px 16px rgba(107,15,42,.30)" : "none",
    zIndex: 10,
    transition: "all .25s",
    opacity: enabled ? 1 : 0.45,
  });

  const safeCw = cw > 0 ? cw : `calc(${100 / ROW_VISIBLE}% - ${ROW_GAP}px)`;

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", padding: "0 56px" }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        style={arrowBtn(canLeft, "left") as React.CSSProperties}
        onClick={() => scrollByCards(-1)}
        disabled={!canLeft}
      >
        <i className="bi bi-chevron-left" />
      </button>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          display: "flex",
          gap: ROW_GAP,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch" as any,
          scrollBehavior: "auto",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          padding: "8px 0 20px",
        }}
      >
        {products.map((p: any) => (
          <div
            key={p.productVariantId}
            style={{
              flex: `0 0 ${safeCw}${typeof safeCw === "number" ? "px" : ""}`,
              width: typeof safeCw === "number" ? safeCw : undefined,
              minWidth: typeof safeCw === "number" ? safeCw : undefined,
            }}
          >
            <ProductCard
              product={p}
              onQuickShop={onQuickShop}
              showDiscountTag={false}
            />
          </div>
        ))}
      </div>

      <button
        style={arrowBtn(canRight, "right") as React.CSSProperties}
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
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();

  const [activeImg, setActiveImg] = useState(0);
  const [selBandId, setSelBandId] = useState<number | null>(null);
  const [selCupId, setSelCupId] = useState<number | null>(null);
  const [selectedPVDId, setSelectedPVDId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "description" | "additional" | "reviews"
  >("description");
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

  /* ── Auto-scroll ref: holds the setInterval handle ── */
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { inWishlist, toggle: toggleWishlist } = useWishlistToggle(currentVId);

  useEffect(() => {
    const n = Number(id);
    if (n > 0) {
      setCurrentVId(n);
      setSelBandId(null);
      setSelCupId(null);
      setSelectedPVDId(null);
      setActiveImg(0);
      if (searchParams.get("tab") !== "reviews") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [id]);

  // Auto-open reviews tab when navigated from testimonials (?tab=reviews)
  useEffect(() => {
    if (searchParams.get("tab") === "reviews") {
      setActiveTab("reviews");
      const timer = setTimeout(() => {
        const el = document.getElementById("pd-tabs");
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
    return grouped.sort(() => Math.random() - 0.5).slice(0, 12);
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
      ? (allSizes.find((s: any) => s.sizeId === selBandId)?.stock ?? null)
      : null);
  const isOOS = selStock !== null && selStock <= 0;
  const selLabel = selBandId
    ? (allSizes.find((s: any) => s.sizeId === selBandId)?.sizeLabel ?? "")
    : "";
  const cupLabel = selCupId
    ? (allCupSizes.find((c: any) => c.cupSizeId === selCupId)?.sizeLabel ?? "")
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
        style: { background: "#6B0F2A", color: "#fff", fontWeight: 600 },
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
      const gc = JSON.parse(localStorage.getItem("guestCart") || "[]");
      const key = `${currentVId}-${selectedPVDId}`;
      const idx = gc.findIndex(
        (x: any) => `${x.productVariantId}-${x.productVariantDetailId}` === key,
      );
      if (idx >= 0) {
        gc[idx].quantity = (gc[idx].quantity || 1) + quantity;
        gc[idx].processedQuantity = gc[idx].quantity;
        if (selStock !== null) gc[idx].stockQuantity = selStock;
      } else
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
      localStorage.setItem("guestCart", JSON.stringify(gc));
      window.dispatchEvent(new Event("guestCartUpdated"));
      toast.success("Added to cart!");
    }
  };

  const handleWishlist = () => {
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

  const btnStyle: React.CSSProperties = {
    background: PRI,
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
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: `4px solid ${IVORY}`,
            borderTopColor: PRI,
            borderRadius: "50%",
            animation: "spin .8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  if (!product)
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <i
          className="bi bi-box-seam"
          style={{
            fontSize: 48,
            color: "#ddd",
            display: "block",
            marginBottom: 12,
          }}
        />
        <h4 style={{ color: "#555" }}>Product not found</h4>
        <Link to="/user-products/product-list" style={{ color: PRI }}>
          Browse Products
        </Link>
      </div>
    );

  return (
    <>
      <style>{`
        @keyframes pd-notif-in  { from{ opacity:0; transform:scale(.85) translateY(10px) } to{ opacity:1; transform:scale(1) translateY(0) } }
        @keyframes pd-notif-bg  { from{ opacity:0 } to{ opacity:1 } }

        /* Hide scrollbar on thumbnail column — all browsers */
        .pd-thumb-col::-webkit-scrollbar { display: none; }
        .pd-thumb-col { -ms-overflow-style: none; scrollbar-width: none; }

        .pd-right-col::-webkit-scrollbar { display: none; }
        .pd-right-col { -ms-overflow-style: none; scrollbar-width: none; }

        /* Thumbnail column: scroll only thumbnails, not the rest */
        .pd-thumb-col {
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
        }

        @media(max-width:767px){
          .pd-left-col { position: relative !important; top: 0 !important; }
          .pd-right-col { max-height: none !important; overflow-y: visible !important; }
          .pd-thumb-col { max-height: 300px !important; flex-direction: row !important; overflow-x: auto !important; overflow-y: hidden !important; }
          .pd-thumb-col img { width: 60px !important; height: 72px !important; }
          .pd-gallery-row { flex-direction: column !important; }
        }
      `}</style>

      {pageNotif && (
        <PageNotification notif={pageNotif} onDone={() => setPageNotif(null)} />
      )}
      <Breadcrumb items={detailCrumbs} />

      <div
        className="container"
        style={{ paddingTop: 52, paddingBottom: 0, fontFamily: FONT_UI }}
      >
        {/* ── Two-column layout ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44% 56%",
            gap: 32,
            marginBottom: 48,
          }}
        >
          {/* LEFT: sticky image gallery */}
          <div
            className="pd-left-col"
            style={{ position: "sticky", top: 100, alignSelf: "start" }}
          >
            <div className="pd-gallery-row" style={{ display: "flex", gap: 10 }}>
              {/* ── Thumbnail column — independently scrollable, height matches main image ── */}
              {images.length > 1 && (
                <div
                  className="pd-thumb-col"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flexShrink: 0,
                    /* Match main image height: main image has aspect-ratio 3/4.
                       Use the same aspect-ratio constraint so thumbs scroll only within that space */
                    maxHeight: "min(70vh, 600px)",
                    overflowY: "auto",
                    overflowX: "hidden",
                    paddingRight: 4,
                  }}
                >
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      onClick={() => handleThumbClick(i)}
                      style={{
                        width: 72,
                        height: 88,
                        objectFit: "cover",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: `2px solid ${activeImg === i ? PRI : "#eee"}`,
                        opacity: activeImg === i ? 1 : 0.65,
                        transition: "all .2s",
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ))}
                </div>
              )}

              {/* ── Main image ── */}
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  background: "#f7f7f7",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {images.length > 0 ? (
                  <img
                    src={images[activeImg]}
                    alt={product.name}
                    style={{
                      width: "100%",
                      aspectRatio: "3/4",
                      objectFit: "cover",
                      display: "block",
                      transition: "opacity .35s ease",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/category-bg.png";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "3/4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ccc",
                    }}
                  >
                    <i className="bi bi-image" style={{ fontSize: 80 }} />
                  </div>
                )}

                {/* Prev / Next arrows — now wired to handlePrev / handleNext */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(255,255,255,.9)",
                        border: "1px solid #eee",
                        borderRadius: "50%",
                        width: 36,
                        height: 36,
                        cursor: "pointer",
                        fontSize: 18,
                        color: PRI,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={handleNext}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(255,255,255,.9)",
                        border: "1px solid #eee",
                        borderRadius: "50%",
                        width: 36,
                        height: 36,
                        cursor: "pointer",
                        fontSize: 18,
                        color: PRI,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ›
                    </button>

                    {/* ── Dot indicators showing current image & progress ── */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => handleThumbClick(i)}
                          style={{
                            width: activeImg === i ? 20 : 8,
                            height: 8,
                            borderRadius: 4,
                            background:
                              activeImg === i ? PRI : "rgba(255,255,255,0.7)",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            transition: "width .3s ease, background .3s ease",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: scrollable info */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {product.brandName && (
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: 12,
                      color: PRI,
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      fontFamily: FONTS,
                    }}
                  >
                    {product.brandName}
                  </p>
                )}
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    color: "#111",
                    lineHeight: 1.3,
                    fontFamily: FONTS,
                  }}
                >
                  {product.name}
                </h1>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={handleWishlist}
                    title={
                      inWishlist ? "Remove from wishlist" : "Save to wishlist"
                    }
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: inWishlist
                        ? "linear-gradient(135deg, rgba(107,15,42,0.12) 0%, rgba(168,76,107,0.08) 100%)"
                        : "linear-gradient(135deg, #fff 0%, #f8f4f5 100%)",
                      border: `1.5px solid ${inWishlist ? PRI : "rgba(158,96,112,0.3)"}`,
                      color: inWishlist ? PRI : HEIRLOOM,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow:
                        "0 4px 12px rgba(107,15,42,0.10), 0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
                      transition: "all .2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <i
                      className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
                    />
                  </button>
                  <button
                    onClick={handleShare}
                    title="Share"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background:
                        "linear-gradient(135deg, #fff 0%, #f8f4f5 100%)",
                      border: "1.5px solid rgba(158,96,112,0.3)",
                      color: HEIRLOOM,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow:
                        "0 4px 12px rgba(107,15,42,0.10), 0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
                      transition: "all .2s ease",
                    }}
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
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background:
                      "linear-gradient(135deg, #fff 0%, var(--ivory) 100%)",
                    border: "1px solid rgba(107,15,42,0.12)",
                    borderRadius: 20,
                    padding: "4px 10px",
                    cursor: "pointer",
                    boxShadow:
                      "0 2px 8px rgba(107,15,42,0.10), 0 1px 2px rgba(107,15,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onClick={() => {
                    setActiveTab("reviews");
                    document
                      .getElementById("pd-tabs")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Stars rating={avgRating} size={13} />
                  {avgRating > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: PRI,
                        fontFamily: FONT_UI,
                      }}
                    >
                      {avgRating.toFixed(1)}
                    </span>
                  )}
                  <span
                    style={{
                      width: 1,
                      height: 10,
                      background: "rgba(107,15,42,0.15)",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: HEIRLOOM,
                      fontFamily: FONT_UI,
                      fontWeight: 600,
                    }}
                  >
                    {totalReviews > 0
                      ? `${totalReviews} Review${totalReviews !== 1 ? "s" : ""}`
                      : "No reviews"}
                  </span>
                </div>
              </div>
            </div>

            {product.productCode && (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  color: "#888",
                  letterSpacing: 0.5,
                  fontFamily: FONT_UI,
                }}
              >
                SKU: {product.productCode}
              </p>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#111",
                  fontFamily: FONTS,
                }}
              >
                {formatPrice(product.price || 0)}
              </span>
              {(product.originalPrice || 0) > (product.price || 0) && (
                <>
                  <span
                    style={{
                      fontSize: 15,
                      textDecoration: "line-through",
                      color: "#bbb",
                      fontFamily: FONT_UI,
                    }}
                  >
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span
                    style={{
                      background: "rgba(107,15,42,0.1)",
                      color: "#6B0F2A",
                      border: "1px solid #9E6070",
                      padding: "3px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: FONT_UI,
                    }}
                  >
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <div
                dangerouslySetInnerHTML={{ __html: product.description }}
                style={{
                  fontSize: 13,
                  color: "#555",
                  lineHeight: 1.8,
                  marginBottom: 16,
                  fontFamily: FONT_UI,
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              />
            )}

            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 16px" }}
            />

            {colors.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#333",
                    fontFamily: FONTS,
                  }}
                >
                  Color:{" "}
                  <span style={{ fontWeight: 400, color: "#666" }}>
                    {colors.find((c: any) => c.productVariantId === currentVId)
                      ?.colorName ??
                      colors.find((c: any) => c.productVariantId === currentVId)
                        ?.color ??
                      ""}
                  </span>
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {colors.map((c: any) => (
                    <button
                      key={c.productVariantId}
                      onClick={() => {
                        if (c.productVariantId !== currentVId) {
                          setCurrentVId(c.productVariantId);
                          navigate(
                            `/user-products/product-detail/${c.productVariantId}/${slugify(product?.name || "product")}`,
                          );
                        }
                      }}
                      title={c.colorName ?? c.color ?? ""}
                      style={{
                        padding: 2,
                        border: `2.5px solid ${c.productVariantId === currentVId ? PRI : "transparent"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        background: "none",
                        outline: "none",
                        transition: "border-color .2s",
                      }}
                    >
                      <img
                        src={getImageUrl(c.image)}
                        alt={c.colorName ?? c.color ?? "color"}
                        style={{
                          width: 64,
                          height: 78,
                          objectFit: "cover",
                          borderRadius: 6,
                          display: "block",
                        }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          const d = document.createElement("div");
                          d.style.cssText = `width:64px;height:78px;border-radius:6px;background:${resolveHex(c.colorHex ?? c.color)}`;
                          img.parentElement?.appendChild(d);
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allSizes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#333",
                      fontFamily: FONTS,
                    }}
                  >
                    {hasCupSize ? "Band Size" : "Size"}
                    {selLabel && (
                      <span
                        style={{ fontWeight: 400, color: PRI, marginLeft: 8 }}
                      >
                        {selLabel}
                        {cupLabel ? ` / ${cupLabel}` : ""}
                        {selStock !== null && !isOOS && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: selStock <= 3 ? "#e65100" : "#2e7d32",
                              fontWeight: 600,
                            }}
                          >
                            {selStock <= 3
                              ? `(${selStock} left)`
                              : "✓ In stock"}
                          </span>
                        )}
                        {isOOS && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: "#c62828",
                              fontWeight: 600,
                            }}
                          >
                            Out of stock
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                  <Link
                    to="/size-guide"
                    style={{
                      fontSize: 12,
                      color: PRI,
                      textDecoration: "underline",
                      fontFamily: FONT_UI,
                    }}
                  >
                    Size Guide
                  </Link>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allSizes.map((s: any) => {
                    const sel = selBandId === s.sizeId;
                    if (!s.inVariant)
                      return (
                        <span
                          key={s.sizeId}
                          title="Not available"
                          style={{
                            minWidth: 48,
                            height: 44,
                            padding: "0 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1.5px dashed #d0d0d0",
                            color: "#ccc",
                            fontSize: 13,
                            fontFamily: FONT_UI,
                            userSelect: "none",
                            cursor: "not-allowed",
                          }}
                        >
                          {s.sizeLabel}
                        </span>
                      );
                    if (!s.hasStock)
                      return (
                        <span
                          key={s.sizeId}
                          title="Out of stock"
                          style={{
                            minWidth: 48,
                            height: 44,
                            padding: "0 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `1.5px solid ${PRI}`,
                            color: PRI,
                            opacity: 0.4,
                            fontSize: 13,
                            fontFamily: FONT_UI,
                            textDecoration: "line-through",
                            userSelect: "none",
                            cursor: "not-allowed",
                          }}
                        >
                          {s.sizeLabel}
                        </span>
                      );
                    return (
                      <button
                        key={s.sizeId}
                        onClick={() => onBand(s)}
                        style={{
                          minWidth: 48,
                          height: 44,
                          padding: "0 10px",
                          borderRadius: 8,
                          border: `2px solid ${sel ? PRI : "#444"}`,
                          background: sel ? PRI : "#fff",
                          color: sel ? "#fff" : "#111",
                          cursor: "pointer",
                          fontSize: 13,
                          fontFamily: FONT_UI,
                          fontWeight: sel ? 700 : 500,
                          transition: "all .15s",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {s.sizeLabel}
                        {s.stock > 0 && s.stock <= 3 && (
                          <span
                            style={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#e53935",
                              border: "1px solid #fff",
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasCupSize && allCupSizes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#333",
                    fontFamily: FONTS,
                  }}
                >
                  Cup Size:{" "}
                  <span style={{ fontWeight: 400, color: "#666" }}>
                    {cupLabel}
                  </span>
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allCupSizes.map((cs: any) => {
                    const av = cupAvail(cs.cupSizeId);
                    const sel = selCupId === cs.cupSizeId;
                    if (!av.inVariant)
                      return (
                        <span
                          key={cs.cupSizeId}
                          title="Not available"
                          style={{
                            minWidth: 44,
                            height: 44,
                            padding: "0 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1.5px dashed #d0d0d0",
                            color: "#ccc",
                            fontSize: 13,
                            fontFamily: FONT_UI,
                            userSelect: "none",
                            cursor: "not-allowed",
                          }}
                        >
                          {cs.sizeLabel}
                        </span>
                      );
                    if (!av.hasStock)
                      return (
                        <span
                          key={cs.cupSizeId}
                          title="Out of stock"
                          style={{
                            minWidth: 44,
                            height: 44,
                            padding: "0 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `1.5px solid ${PRI}`,
                            color: PRI,
                            opacity: 0.4,
                            fontSize: 13,
                            fontFamily: FONT_UI,
                            textDecoration: "line-through",
                            userSelect: "none",
                            cursor: "not-allowed",
                          }}
                        >
                          {cs.sizeLabel}
                        </span>
                      );
                    return (
                      <button
                        key={cs.cupSizeId}
                        onClick={() => onCup(cs.cupSizeId)}
                        style={{
                          minWidth: 44,
                          height: 44,
                          padding: "0 10px",
                          borderRadius: 8,
                          border: `2px solid ${sel ? PRI : "#444"}`,
                          background: sel ? PRI : "#fff",
                          color: sel ? "#fff" : "#111",
                          cursor: "pointer",
                          fontSize: 13,
                          fontFamily: FONT_UI,
                          transition: "all .15s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 16,
                      background: "#fff5f5",
                      border: "1.5px solid #f5c6cb",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    <i
                      className="bi bi-slash-circle"
                      style={{ fontSize: 22, color: "#c62828", flexShrink: 0 }}
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#c62828",
                          fontFamily: FONT_UI,
                        }}
                      >
                        Out of Stock
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12,
                          color: "#e57373",
                        }}
                      >
                        We'll be back soon — check again later!
                      </p>
                    </div>
                  </div>
                );

              const hasSizes = allSizes.some((s: any) => s.inVariant);
              const qtyLocked = hasSizes && selectedPVDId === null;
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 20,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        border: `1.5px solid ${qtyLocked ? "#eee" : "#ddd"}`,
                        borderRadius: 8,
                        background: qtyLocked ? "#fafafa" : "#fff",
                      }}
                    >
                      <button
                        disabled={qtyLocked || quantity <= 1}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        style={{
                          width: 40,
                          height: 44,
                          border: "none",
                          background: "transparent",
                          cursor:
                            qtyLocked || quantity <= 1
                              ? "not-allowed"
                              : "pointer",
                          fontSize: 20,
                          color: qtyLocked || quantity <= 1 ? "#ccc" : "#333",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          width: 44,
                          textAlign: "center",
                          fontSize: 15,
                          fontWeight: 600,
                          fontFamily: FONTS,
                          color: qtyLocked ? "#bbb" : "#111",
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
                        style={{
                          width: 40,
                          height: 44,
                          border: "none",
                          background: "transparent",
                          cursor:
                            qtyLocked ||
                            (selStock !== null && quantity >= selStock)
                              ? "not-allowed"
                              : "pointer",
                          fontSize: 20,
                          color:
                            qtyLocked ||
                            (selStock !== null && quantity >= selStock)
                              ? "#ccc"
                              : "#333",
                        }}
                      >
                        +
                      </button>
                    </div>
                    {showStockTip && selStock !== null && (
                      <div
                        style={{
                          position: "absolute",
                          top: "110%",
                          left: 0,
                          zIndex: 50,
                          background: "#fff",
                          border: `1.5px solid ${PRI}`,
                          borderRadius: 8,
                          padding: "7px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: PRI,
                          boxShadow: "0 4px 16px rgba(107,15,42,.18)",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          animation: "pd-notif-in .18s ease",
                        }}
                      >
                        {selStock} available
                      </div>
                    )}
                    {qtyLocked && (
                      <p
                        style={{
                          margin: "5px 0 0",
                          fontSize: 11,
                          color: "#e65100",
                          fontWeight: 600,
                        }}
                      >
                        ↑ Select a size first
                      </p>
                    )}
                  </div>

                  {!qtyLocked && selStock !== null && (
                    <p
                      style={{
                        margin: 0,
                        paddingTop: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: FONT_UI,
                        color: isOOS
                          ? "#c62828"
                          : selStock <= 3
                            ? "#e65100"
                            : "#2e7d32",
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

            <button
              onClick={handleAddToCart}
              disabled={cartMutation.isPending || isOOS}
              style={{
                ...btnStyle,
                width: "100%",
                padding: "14px",
                fontSize: 15,
                marginBottom: 8,
                opacity: cartMutation.isPending || isOOS ? 0.6 : 1,
                justifyContent: "space-between",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {cartMutation.isPending ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-cart3" style={{ fontSize: 17 }} />
                )}
                Add to Cart
              </span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {formatPrice(dispPrice || product?.price || 0)}
              </span>
            </button>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                onClick={handleWishlist}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "#fff",
                  color: PRI,
                  border: `1.5px solid ${PRI}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: FONTS,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <i
                  className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
                  style={{ color: inWishlist ? "#e53935" : PRI }}
                />
                {inWishlist ? "Wishlisted" : "Wishlist"}
              </button>
              <button
                onClick={handleShare}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "#fff",
                  color: "#555",
                  border: "1.5px solid #ddd",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: FONTS,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <i className="bi bi-share" /> Share
              </button>
            </div>

            {product.isReturnAvailable && (
              <p
                style={{
                  fontSize: 12,
                  color: "#22c55e",
                  marginTop: 4,
                  fontFamily: FONT_UI,
                }}
              >
                <i className="bi bi-arrow-return-left me-1" />
                Easy returns available within 15 days
              </p>
            )}
            <div style={{ height: 140, flexShrink: 0 }} aria-hidden="true" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div id="pd-tabs" style={{ marginBottom: 56 }}>
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #eee",
              marginBottom: 28,
            }}
          >
            {(["description", "additional", "reviews"] as const).map(
              (tab, i) => {
                const label = [
                  "Description",
                  "Additional Information",
                  `Reviews (${totalReviews})`,
                ][i];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "13px 22px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: activeTab === tab ? 700 : 400,
                      color: activeTab === tab ? "#111" : "#888",
                      borderBottom: `3px solid ${activeTab === tab ? PRI : "transparent"}`,
                      marginBottom: -2,
                      fontFamily: FONTS,
                      whiteSpace: "nowrap",
                      transition: "all .2s",
                    }}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>

          {activeTab === "description" && (
            <div
              style={{
                maxWidth: 760,
                color: "#555",
                lineHeight: 1.9,
                fontSize: 15,
                fontFamily: FONT_UI,
              }}
            >
              {product.description ? (
                <div
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p style={{ color: "#aaa" }}>No description available.</p>
              )}
              {product.tag && (
                <p style={{ marginTop: 16, fontSize: 13, color: "#888" }}>
                  <strong>Tags:</strong> {product.tag}
                </p>
              )}
            </div>
          )}

          {activeTab === "additional" && (
            <table
              style={{
                fontSize: 14,
                color: "#555",
                borderCollapse: "collapse",
                fontFamily: FONT_UI,
              }}
            >
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
                      <td
                        style={{
                          padding: "8px 24px 8px 0",
                          color: "#999",
                          width: 160,
                        }}
                      >
                        {label}
                      </td>
                      <td style={{ padding: 8 }}>{value}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "reviews" && (
            <div id="reviews">
              {totalReviews > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 32,
                    alignItems: "center",
                    marginBottom: 28,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 52,
                        fontWeight: 800,
                        lineHeight: 1,
                        fontFamily: FONTS,
                      }}
                    >
                      {avgRating.toFixed(1)}
                    </div>
                    <Stars rating={avgRating} size={18} />
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#888",
                        fontFamily: FONT_UI,
                      }}
                    >
                      {totalReviews} reviews
                    </p>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {breakdown.map(({ star, count }) => (
                      <div
                        key={star}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 5,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "#888",
                            width: 24,
                            textAlign: "right",
                            fontFamily: FONT_UI,
                          }}
                        >
                          {star}★
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            background: "#f0f0f0",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              background: "#6B0F2A",
                              width: `${totalReviews ? (count / totalReviews) * 100 : 0}%`,
                              transition: "width .4s",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#888",
                            width: 20,
                            fontFamily: FONT_UI,
                          }}
                        >
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
                <div
                  style={{
                    marginBottom: 20,
                    padding: "10px 16px",
                    background: "#faf8f9",
                    border: "1px solid var(--heirloom)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--heirloom)",
                  }}
                >
                  <i className="bi bi-lock" style={{ marginRight: 6 }} />
                  Please{" "}
                  <a
                    href="/auth/login"
                    style={{ color: "var(--brand)", fontWeight: 600 }}
                  >
                    sign in
                  </a>{" "}
                  to write a review
                </div>
              )}

              {showForm && (
                <div
                  style={{
                    background: "#f9f9f9",
                    padding: 24,
                    borderRadius: 12,
                    marginBottom: 24,
                    border: `1px solid ${IVORY}`,
                  }}
                >
                  <div className="row g-3">
                    {[
                      ["displayName", "Your Name", "text"],
                      ["email", "Email", "email"],
                    ].map(([k, l, t]) => (
                      <div key={k} className="col-md-6">
                        <label
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 4,
                            fontFamily: FONT_UI,
                          }}
                        >
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
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 6,
                          fontFamily: FONT_UI,
                        }}
                      >
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
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 4,
                          fontFamily: FONT_UI,
                        }}
                      >
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
                      <label
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 4,
                          fontFamily: FONT_UI,
                        }}
                      >
                        Photo{" "}
                        <span style={{ color: "#aaa", fontWeight: 400 }}>
                          (optional)
                        </span>
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          border: "1px dashed #ccc",
                          borderRadius: 8,
                          padding: "10px 14px",
                          background: "#fafafa",
                          width: "fit-content",
                        }}
                      >
                        <i
                          className="bi bi-camera"
                          style={{ fontSize: 18, color: "#6B0F2A" }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: "#555",
                            fontFamily: FONT_UI,
                          }}
                        >
                          {photoFile ? photoFile.name : "Upload a photo"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setPhotoFile(f);
                            setPhotoPreview(f ? URL.createObjectURL(f) : null);
                          }}
                        />
                      </label>
                      {photoPreview && (
                        <div
                          style={{
                            marginTop: 10,
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <img
                            src={photoPreview}
                            alt="preview"
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #eee",
                            }}
                          />
                          <button
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview(null);
                            }}
                            style={{
                              position: "absolute",
                              top: -6,
                              right: -6,
                              background: "#6B0F2A",
                              border: "none",
                              borderRadius: "50%",
                              width: 20,
                              height: 20,
                              color: "#fff",
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
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
                        {reviewMutation.isPending
                          ? "Submitting…"
                          : "Submit Review"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {reviews.length === 0 ? (
                <p style={{ color: "#888", fontSize: 14, fontFamily: FONT_UI }}>
                  No reviews yet. Be the first!
                </p>
              ) : (
                reviews.map((r: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      paddingBottom: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        {r.photo ? (
                          <img
                            src={
                              r.photo.startsWith("http")
                                ? r.photo
                                : `${(import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api").replace(/\/api$/, "")}${r.photo}`
                            }
                            alt="reviewer"
                            style={{
                              width: 52,
                              height: 52,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #eee",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <i
                            className="bi bi-person-circle"
                            style={{ fontSize: 44, color: "#ccc" }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 4,
                          }}
                        >
                          <Stars rating={r.rating || 0} size={13} />
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              fontFamily: FONTS,
                            }}
                          >
                            {r.name || r.displayName || "Anonymous"}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#aaa",
                              fontFamily: FONT_UI,
                            }}
                          >
                            {r.createdDate
                              ? new Date(r.createdDate).toLocaleDateString(
                                  "en-IN",
                                )
                              : ""}
                          </span>
                        </div>
                        {(r.title || r.reviewTitle) && (
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontWeight: 600,
                              fontSize: 13,
                              fontFamily: FONTS,
                            }}
                          >
                            {r.title || r.reviewTitle}
                          </p>
                        )}
                        <p
                          style={{
                            margin: 0,
                            color: "#555",
                            fontSize: 14,
                            fontFamily: FONT_UI,
                          }}
                        >
                          {r.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {similarProducts.length > 0 && (
          <div style={{ marginBottom: 56 }}>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                textAlign: "center",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 4,
                fontFamily: FONT_UI,
              }}
            >
              You May Also Like
            </p>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                textAlign: "center",
                marginBottom: 28,
                fontFamily: FONTS,
                color: PRI,
              }}
            >
              Similar Products
            </h2>
            <ScrollableProductRow
              products={similarProducts}
              onQuickShop={(id) => setQuickShopId(id)}
            />
          </div>
        )}

        {exploreProducts.length > 0 && (
          <div style={{ marginBottom: 56 }}>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                textAlign: "center",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 4,
                fontFamily: FONT_UI,
              }}
            >
              Discover More
            </p>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                textAlign: "center",
                marginBottom: 28,
                fontFamily: FONTS,
                color: PRI,
              }}
            >
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
