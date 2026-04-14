import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type WheelEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCartStore } from "@/features/cart/store/cartStore";
import { getProductDetail } from "@/features/products/api/products.api";
import { addToCart } from "@/features/cart/api/cart.api";
import { formatPrice, getImageUrl, slugify } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { setBuyNowSession } from "@/shared/utils/checkoutSession";

interface Props {
  productVariantId: number;
  onClose: () => void;
}

const ALPHA_SIZE_KEYWORDS = [
  "t-shirt bra",
  "t shirt bra",
  "tshirt bra",
  "sports bra",
  "sport bra",
];
const isAlphaSizeProduct = (name = "") =>
  ALPHA_SIZE_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));

function SizeBtn({
  label,
  selected,
  inVariant,
  hasStock,
  stock,
  onClick,
}: {
  label: string;
  selected: boolean;
  inVariant: boolean;
  hasStock: boolean;
  stock: number;
  onClick: () => void;
}) {
  if (!inVariant)
    return (
      <span title="Not available" className="qsm-size-btn is-unavailable">
        {label}
      </span>
    );
  if (!hasStock)
    return (
      <span title="Out of stock" className="qsm-size-btn is-oos">
        {label}
      </span>
    );
  return (
    <button
      onClick={onClick}
      className={`qsm-size-btn${selected ? " is-selected" : ""}`}
    >
      {label}
      {stock === 1 && <span className="qsm-size-btn__badge">1</span>}
    </button>
  );
}

interface ModalNotif {
  message: string;
  type: "warn" | "error" | "info";
}

function ModalNotification({
  notif,
  onDone,
}: {
  notif: ModalNotif;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [notif]);

  const icon =
    notif.type === "error"
      ? "bi-exclamation-circle-fill"
      : notif.type === "warn"
        ? "bi-exclamation-triangle-fill"
        : "bi-info-circle-fill";

  return (
    <div className="qsm-notif-overlay">
      <div className={`qsm-notif-card is-${notif.type}`}>
        <i className={`bi ${icon} qsm-notif-icon`} />
        <span className="qsm-notif-text">{notif.message}</span>
        <button onClick={onDone} aria-label="Close" className="qsm-notif-close">
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function QuickShopModal({ productVariantId, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();

  const [variantId, setVariantId] = useState(productVariantId);
  const [selBandId, setSelBandId] = useState<number | null>(null);
  const [selCupId, setSelCupId] = useState<number | null>(null);
  const [selPVDId, setSelPVDId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showStockTip, setShowStockTip] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [modalNotif, setModalNotif] = useState<ModalNotif | null>(null);
  const [visibleThumbs, setVisibleThumbs] = useState(4);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const imgPaused = useRef(false);
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  // ── useWishlistToggle handles both guest and auth correctly ──
  const { inWishlist, toggle: toggleWishlist } = useWishlistToggle(variantId);

  const { data: product, isLoading } = useQuery({
    queryKey: ["qs-product", variantId],
    queryFn: () => getProductDetail(variantId),
    enabled: variantId > 0,
  });

  useEffect(() => {
    setSelBandId(null);
    setSelCupId(null);
    setSelPVDId(null);
    setQty(1);
    setImgIdx(0);
  }, [variantId]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.qsPaused = "1";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = prev;
      delete document.body.dataset.qsPaused;
    };
  }, []);

  const images: string[] = (
    product?.images?.length
      ? product.images
      : product?.image
        ? [product.image]
        : []
  ).map(getImageUrl);
  const displayedThumbs = Math.min(images.length, visibleThumbs);

  useEffect(() => {
    const updateVisibleThumbs = () => {
      const width = window.innerWidth;
      if (width < 480) setVisibleThumbs(2);
      else if (width < 768) setVisibleThumbs(3);
      else setVisibleThumbs(4);
    };
    updateVisibleThumbs();
    window.addEventListener("resize", updateVisibleThumbs);
    return () => window.removeEventListener("resize", updateVisibleThumbs);
  }, []);

  const syncThumbArrows = () => {
    const rail = thumbsRef.current;
    if (!rail) return;
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(maxScrollLeft - rail.scrollLeft > 4);
  };

  useEffect(() => {
    syncThumbArrows();
  }, [images.length, visibleThumbs]);

  useEffect(() => {
    const rail = thumbsRef.current;
    if (!rail) return;
    const activeThumb = rail.querySelector(
      `[data-thumb-index="${imgIdx}"]`,
    ) as HTMLElement | null;
    activeThumb?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
    const id = window.setTimeout(syncThumbArrows, 180);
    return () => window.clearTimeout(id);
  }, [imgIdx]);

  const scrollThumbs = (direction: "left" | "right") => {
    const rail = thumbsRef.current;
    if (!rail) return;
    const step = rail.clientWidth;
    rail.scrollBy({
      left: direction === "right" ? step : -step,
      behavior: "smooth",
    });
    window.setTimeout(syncThumbArrows, 220);
  };

  const onThumbWheel = (e: WheelEvent<HTMLDivElement>) => {
    const rail = thumbsRef.current;
    if (!rail) return;
    const delta =
      Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    e.preventDefault();
    rail.scrollLeft += delta;
    syncThumbArrows();
  };

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => {
      if (!imgPaused.current) setImgIdx((i) => (i + 1) % images.length);
    }, 2500);
    return () => clearInterval(id);
  }, [images.length]);

  const hasCupSize = !!product?.isCupSize && !isAlphaSizeProduct(product?.name);

  const rawSizes: any[] = product?.sizes ?? [];
  const allCupSizes: any[] = product?.cupSizes ?? [];
  const pvdMatrix: any[] = product?.pvdMatrix ?? [];
  const colors: any[] = product?.colors ?? [];
  const selectedColorSwatch = colors.find(
    (c: any) => c.productVariantId === variantId,
  );
  const selectedColor: string =
    selectedColorSwatch?.colorName ?? selectedColorSwatch?.color ?? "";

  const allSizes: any[] = hasCupSize
    ? rawSizes.filter((s: any) => /^\d+$/.test(s.sizeLabel))
    : rawSizes.filter((s: any) => !/^\d+$/.test(s.sizeLabel));

  const cupAvail = (cupId: number) => {
    if (!selBandId) {
      const c = allCupSizes.find((x: any) => x.cupSizeId === cupId);
      return {
        inVariant: c?.inVariant ?? false,
        hasStock: c?.hasStock ?? false,
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
    (r: any) => r.productVariantDetailId === selPVDId,
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
    if (!hasCupSize) {
      setSelPVDId(s.productVariantDetailId ?? null);
    } else {
      const avail = pvdMatrix.filter(
        (r: any) => r.sizeId === s.sizeId && r.stock > 0,
      );
      if (avail.length === 1) {
        setSelCupId(avail[0].cupSizeId);
        setSelPVDId(avail[0].productVariantDetailId);
      } else setSelPVDId(null);
    }
  };

  const onCup = (cupId: number) => {
    const a = cupAvail(cupId);
    if (!a.inVariant || !a.hasStock) return;
    setSelCupId(cupId);
    const row = pvdMatrix.find(
      (r: any) => r.sizeId === selBandId && r.cupSizeId === cupId,
    );
    if (row) setSelPVDId(row.productVariantDetailId);
    setQty(1);
  };

  const showWarn = (message: string, type: ModalNotif["type"] = "warn") =>
    setModalNotif({ message, type });

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
    if (selStock !== null && qty > selStock) {
      showWarn(
        `Only ${selStock} unit${selStock !== 1 ? "s" : ""} available — quantity adjusted`,
        "warn",
      );
      setQty(selStock);
      return false;
    }
    return true;
  };

  // ── Wishlist: single handler via useWishlistToggle (works for both guest + auth) ──
  const handleWishlist = () => {
    toggleWishlist({
      productId: product?.productId,
      productVariantId: variantId,
      name: product?.name,
      price: dispPrice,
      oldPrice: dispMrp,
      image: images[0] || "",
      hoverImage: images[1] || "",
      images,
      color: selectedColor,
      colorName: selectedColor,
      colorHex:
        selectedColorSwatch?.colorHex ??
        selectedColorSwatch?.colourHex ??
        selectedColorSwatch?.color ??
        "",
      brandName:
        product?.brandName ||
        product?.brand ||
        product?.brandTitle ||
        product?.productBrand ||
        "",
      rating:
        product?.rating ||
        product?.avgRating ||
        product?.averageRating ||
        product?.ratingAverage ||
        0,
      reviewCount:
        product?.reviewCount ||
        product?.totalReviews ||
        product?.ratingCount ||
        product?.reviewsCount ||
        product?.noOfReviews ||
        product?.numReviews ||
        0,
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/user-products/product-detail/${variantId}/${slugify(product?.name || "")}`;
    try {
      if (navigator.share) await navigator.share({ title: product?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {}
  };

  const buildItem = () => ({
    productVariantDetailId: selPVDId,
    productId: product?.productId,
    productVariantId: variantId,
    state: "Created",
    userProfileId: getUserId() || "",
    quantity: qty,
  });

  const buildBuyNowItem = () => ({
    cartId: 0,
    productId: product?.productId ?? null,
    productVariantId: variantId,
    productVariantDetailId: selPVDId,
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
    processedQuantity: qty,
    returnedQuantity: null,
    discountPercent: null,
    mrpPrice: dispMrp || null,
    finalPrice: dispPrice || null,
    personalId: null,
    userProfileId: getUserId() || null,
    state: "Created",
    image: images[0] || null,
    isSelected: true,
  });

  // ── Cart mutation — invalidates all cart keys so Navbar + QuickCart + Cart page all refresh ──
  const addMut = useMutation({
    mutationFn: (obj: any) => addToCart(obj),
    onSuccess: () => {
      toast.success("Added to cart!");
      setCartCount(cartCount + 1);
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to add"),
  });

  const guestAdd = (thenNavigate?: string) => {
    const gc = JSON.parse(localStorage.getItem("guestCart") || "[]");
    const key = `${variantId}-${selPVDId}`;
    const idx = gc.findIndex(
      (x: any) => `${x.productVariantId}-${x.productVariantDetailId}` === key,
    );
    if (idx >= 0) {
      gc[idx].quantity = (gc[idx].quantity || 1) + qty;
      gc[idx].processedQuantity = gc[idx].quantity;
      // keep stockQuantity in sync in case it changed
      if (selStock !== null) gc[idx].stockQuantity = selStock;
    } else
      gc.push({
        productId: product?.productId,
        productVariantId: variantId,
        productVariantDetailId: selPVDId,
        quantity: qty,
        processedQuantity: qty,
        finalPrice: dispPrice,
        mrpPrice: dispMrp,
        productName: product?.name,
        image: images[0] || "",
        imageURL: images[0] || "",
        isSelected: true,
        color: selectedColor || "",
        size: selLabel || "",
        cupSize: cupLabel || "",
        stockQuantity: selStock ?? undefined, // ← enables stock check in QuickCart
      });
    localStorage.setItem("guestCart", JSON.stringify(gc));
    window.dispatchEvent(new Event("guestCartUpdated"));
    if (thenNavigate) {
      onClose();
      navigate(thenNavigate);
    } else {
      toast.success("Added to cart!");
      onClose();
    }
  };

  const handleAddToCart = () => {
    if (!validate()) return;
    if (hasValidToken()) addMut.mutate(buildItem());
    else guestAdd();
  };
  const handleBuyNow = () => {
    if (!validate()) return;
    const buyNowItem = buildBuyNowItem();
    setBuyNowSession([buyNowItem as any]);
    const store = useCartStore.getState();
    store.removeCoupon?.();
    store.setShipping?.(null);

    if (hasValidToken()) {
      store.setSelectedItems?.([buyNowItem as any]);
      store.setSubTotal?.(Number(dispPrice || 0) * qty);
      store.setTaxAmount?.(Math.round(Number(dispPrice || 0) * qty * 0.05));
    }

    onClose();
    navigate("/user-products/payment-address?buyNow=1", {
      state: { from: location.pathname + location.search },
    });
  };
  const goToDetail = () => {
    navigate(
      `/user-products/product-detail/${variantId}/${slugify(product?.name || "")}`,
    );
    onClose();
  };

  return (
    <div className="qsm-backdrop" onClick={onClose}>
      <div className="qsm-modal" onClick={(e) => e.stopPropagation()}>
        {modalNotif && (
          <ModalNotification
            notif={modalNotif}
            onDone={() => setModalNotif(null)}
          />
        )}

        {isLoading && (
          <div className="qsm-loading">
            <div className="qsm-spinner" />
          </div>
        )}

        {!isLoading && !product && (
          <div className="qsm-notfound">Product not found.</div>
        )}

        {!isLoading && product && (
          <div className="qsm-body">
            {/* ── Left: image gallery ── */}
            <div
              className="qsm-gallery"
              onMouseEnter={() => {
                imgPaused.current = true;
              }}
              onMouseLeave={() => {
                imgPaused.current = false;
              }}
            >
              <div className="qsm-main-image" onClick={goToDetail}>
                <img
                  src={images[imgIdx] || "/assets/category-bg.png"}
                  alt={product.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/assets/category-bg.png";
                  }}
                />
                {images.length > 1 && (
                  <>
                    <button
                      className="qsm-nav-btn is-prev"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIdx(
                          (i) => (i - 1 + images.length) % images.length,
                        );
                      }}
                    >
                      ‹
                    </button>
                    <button
                      className="qsm-nav-btn is-next"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIdx((i) => (i + 1) % images.length);
                      }}
                    >
                      ›
                    </button>
                    <div className="qsm-dots">
                      {images.slice(0, 6).map((_, i) => (
                        <span
                          key={i}
                          className={`qsm-dot${imgIdx === i ? " is-active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImgIdx(i);
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div
                  className="qsm-thumbs-wrap"
                  style={
                    {
                      "--qsm-visible-thumbs": visibleThumbs,
                      "--qsm-displayed-thumbs": displayedThumbs,
                    } as CSSProperties
                  }
                >
                  {images.length > displayedThumbs && canScrollLeft && (
                    <button
                      type="button"
                      className="qsm-thumbs-arrow"
                      aria-label="Scroll thumbnails left"
                      onClick={() => scrollThumbs("left")}
                    >
                      <i className="bi bi-chevron-left" />
                    </button>
                  )}
                  <div
                    ref={thumbsRef}
                    className="qsm-thumbs"
                    onWheel={onThumbWheel}
                    onScroll={syncThumbArrows}
                  >
                    {images.map((img, i) => (
                      <img
                        key={i}
                        data-thumb-index={i}
                        src={img}
                        alt=""
                        onClick={() => setImgIdx(i)}
                        className={`qsm-thumb${imgIdx === i ? " is-active" : ""}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                  {images.length > displayedThumbs && canScrollRight && (
                    <button
                      type="button"
                      className="qsm-thumbs-arrow"
                      aria-label="Scroll thumbnails right"
                      onClick={() => scrollThumbs("right")}
                    >
                      <i className="bi bi-chevron-right" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Right: product info ── */}
            <div className="qsm-info">
              {/* Brand + action icons */}
              <div className="qsm-brand-row">
                <span className="qsm-brand">{product.brandName || "TWAM"}</span>
                <div className="qsm-icon-btns">
                  <button
                    onClick={handleWishlist}
                    title={
                      inWishlist ? "Remove from wishlist" : "Save to wishlist"
                    }
                    className={`qsm-icon-btn is-wishlist${inWishlist ? " is-active" : ""}`}
                  >
                    <i
                      className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
                    />
                  </button>
                  <button
                    onClick={handleShare}
                    title="Share"
                    className="qsm-icon-btn"
                  >
                    <i className="bi bi-share" />
                  </button>
                  <button
                    onClick={onClose}
                    title="Close"
                    className="qsm-icon-btn is-close"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>

              {/* Name + Rating */}
              <div className="qsm-title-row">
                <h3 onClick={goToDetail} className="qsm-title">
                  {product.name}
                </h3>
                <div className="qsm-rating">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const filled =
                      i < Math.floor(product.rating) || i < product.rating;
                    return (
                      <i
                        key={i}
                        className={`bi ${i < Math.floor(product.rating) ? "bi-star-fill" : i < product.rating ? "bi-star-half" : "bi-star"} qsm-star${filled && product.rating > 0 ? " is-filled" : ""}`}
                      />
                    );
                  })}
                  <span className="qsm-rating-value">
                    {Number(product.rating).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Price row */}
              <div className="qsm-price-row">
                <span className="qsm-price">{formatPrice(dispPrice)}</span>
                {dispMrp > dispPrice && (
                  <>
                    <span className="qsm-mrp">{formatPrice(dispMrp)}</span>
                    <span className="qsm-discount">
                      {Math.round(((dispMrp - dispPrice) / dispMrp) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Color */}
              {colors.length > 1 && (
                <div>
                  <p className="qsm-color-label">Color</p>
                  <div className="qsm-swatches">
                    {colors.map((col: any) => (
                      <button
                        key={col.productVariantId}
                        onClick={() => setVariantId(col.productVariantId)}
                        title={col.colorName ?? col.color}
                        className={`qsm-swatch${col.productVariantId === variantId ? " is-selected" : ""}`}
                        style={{
                          background: resolveHex(col.colorHex ?? col.color),
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              <div>
                <div className="qsm-size-head">
                  <p className="qsm-size-title">
                    Size
                    {selLabel && (
                      <span className="qsm-selected-size">
                        {selLabel}
                        {cupLabel ? ` / ${cupLabel}` : ""}
                        {selStock !== null && !isOOS && (
                          <span
                            className={`qsm-stock-hint ${selStock <= 3 ? "is-low" : "is-ok"}`}
                          >
                            {selStock <= 3
                              ? `(${selStock} left)`
                              : "✓ In stock"}
                          </span>
                        )}
                        {isOOS && (
                          <span className="qsm-stock-hint is-oos">
                            Out of stock
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                  <Link
                    to="/size-guide"
                    onClick={onClose}
                    className="qsm-size-chart"
                  >
                    Size Chart
                  </Link>
                </div>

                <p className="qsm-size-hint">
                  {hasCupSize ? "Select your band size:" : "Select your size:"}
                </p>
                <div className={`qsm-size-list${hasCupSize ? " has-cup" : ""}`}>
                  {allSizes.map((s: any) => (
                    <SizeBtn
                      key={s.sizeId}
                      label={s.sizeLabel}
                      selected={selBandId === s.sizeId}
                      inVariant={s.inVariant}
                      hasStock={s.hasStock}
                      stock={s.stock}
                      onClick={() => onBand(s)}
                    />
                  ))}
                </div>

                {hasCupSize && allCupSizes.length > 0 && (
                  <>
                    <p className="qsm-size-hint">Select your cup size:</p>
                    <div className="qsm-size-list">
                      {allCupSizes.map((c: any) => {
                        const av = cupAvail(c.cupSizeId);
                        return (
                          <SizeBtn
                            key={c.cupSizeId}
                            label={c.sizeLabel}
                            selected={selCupId === c.cupSizeId}
                            inVariant={av.inVariant}
                            hasStock={av.hasStock}
                            stock={selBandId ? av.stock : 0}
                            onClick={() => onCup(c.cupSizeId)}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Qty — replaced by OOS banner when all sizes unavailable */}
              {(() => {
                const entirelyOOS =
                  allSizes.length > 0 &&
                  allSizes.every((s: any) => !s.hasStock) &&
                  (!hasCupSize || allCupSizes.every((c: any) => !c.hasStock));

                if (entirelyOOS)
                  return (
                    <div className="qsm-oos-banner">
                      <i className="bi bi-slash-circle qsm-oos-banner-icon" />
                      <div>
                        <p className="qsm-oos-banner-title">Out of Stock</p>
                        <p className="qsm-oos-banner-text">
                          We'll be back soon — check again later!
                        </p>
                      </div>
                    </div>
                  );

                const hasSizes = allSizes.some((s: any) => s.inVariant);
                const qtyLocked = hasSizes && selPVDId === null;
                return (
                  <div className="qsm-qty-row">
                    <div className="qsm-qty-wrap">
                      <p
                        className={`qsm-qty-label${qtyLocked ? " is-locked" : ""}`}
                      >
                        Qty
                      </p>
                      <div
                        className={`qsm-qty-box${qtyLocked ? " is-locked" : ""}`}
                      >
                        <button
                          disabled={qtyLocked || qty <= 1}
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="qsm-qty-btn"
                        >
                          −
                        </button>
                        <span className="qsm-qty-value">{qty}</span>
                        <button
                          disabled={qtyLocked}
                          onClick={() => {
                            if (selStock !== null && qty >= selStock) {
                              setShowStockTip(true);
                              setTimeout(() => setShowStockTip(false), 2200);
                              return;
                            }
                            setQty((q) => q + 1);
                          }}
                          className="qsm-qty-btn"
                        >
                          +
                        </button>
                      </div>
                      {showStockTip && selStock !== null && (
                        <div className="qsm-stock-tip">
                          {selStock} available
                        </div>
                      )}
                      {qtyLocked && (
                        <p className="qsm-qty-lock-msg">
                          ↑ Select a size first
                        </p>
                      )}
                    </div>

                    {/* Stock status */}
                    {!qtyLocked && selStock !== null && (
                      <div
                        className={`qsm-stock-status ${isOOS ? "is-oos" : selStock <= 3 ? "is-low" : "is-ok"}`}
                      >
                        <p>
                          {isOOS
                            ? "🚫 Out of stock"
                            : selStock <= 3
                              ? `⚠️ Only ${selStock} left!`
                              : "✓ In stock"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CTA buttons */}
              <div className="qsm-cta-row">
                <button
                  onClick={handleAddToCart}
                  disabled={addMut.isPending || isOOS}
                  className="qsm-btn-add"
                >
                  {addMut.isPending ? (
                    <div className="qsm-btn-spinner" />
                  ) : (
                    <i className="bi bi-cart-plus" />
                  )}
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={isOOS}
                  className="qsm-btn-buy"
                >
                  <i className="bi bi-lightning-fill" />
                  Buy Now
                </button>
              </div>

              {/* Delivery / return info */}
              <div className="qsm-delivery">
                <span className="qsm-delivery-item">
                  <i className="bi bi-truck qsm-delivery-icon" />
                  Free delivery on orders above <strong>₹5000</strong>
                </span>
                {product.isReturnAvailable && (
                  <span className="qsm-delivery-item">
                    <i className="bi bi-arrow-return-left qsm-delivery-icon" />
                    Easy returns within 15 days
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
