import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";

interface Props {
  product: any;
  onQuickShop: (id: number) => void;
  onRemove?: () => void;
  showColors?: boolean;
  showDiscountTag?: boolean;
  /** Home-page mode: show the card's own single colour swatch only,
   *  no allVariants grouping and no variant-switching on click. */
  singleColorOnly?: boolean;
  /** Home-page mode: tighter body so the image is the focal point. */
  compact?: boolean;
  /** Reveal the discount by tearing away the paper flap after 5 seconds. */
  delayedDiscountReveal?: boolean;
}

export default function ProductCard({
  product,
  onQuickShop,
  onRemove,
  showColors = true,
  showDiscountTag = true,
  singleColorOnly = false,
  compact = false,
  delayedDiscountReveal = false,
}: Props) {
  const navigate = useNavigate();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [selectedVariant, setSelectedVariant] = useState(product);
  const isRemovableCard = typeof onRemove === "function";
  // Track which variant's hover image has fully loaded.
  // Derived synchronously → no stale-state flash when the user switches colour.
  const [hoverLoadedVariantId, setHoverLoadedVariantId] = useState(-1);
  const [discountAnimationStarted, setDiscountAnimationStarted] =
    useState(false);

  const swatchesRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const delayedDiscountRevealEnabled =
    delayedDiscountReveal && !isRemovableCard && !prefersReducedMotion;

  useEffect(() => {
    setSelectedVariant(product);
  }, [product.productId]);

  useEffect(() => {
    const checkOverflow = () => {
      if (swatchesRef.current) {
        setIsOverflowing(
          swatchesRef.current.scrollWidth > swatchesRef.current.clientWidth + 2,
        );
      }
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [product.allVariants]);

  const {
    inWishlist,
    toggle: toggleWishlist,
    isPending,
  } = useWishlistToggle(selectedVariant.productVariantId);

  const handleColorChange = (variantId: number) => {
    const variant = product.allVariants?.find(
      (v: any) => v.productVariantId === variantId,
    );
    if (!variant) return;
    setSelectedVariant({
      ...variant,
      price: variant.price ?? variant.finalPrice,
      oldPrice: variant.oldPrice ?? variant.mrpPrice,
    });
  };

  const handleScrollSwatches = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (swatchesRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = swatchesRef.current;
      if (scrollLeft + clientWidth >= scrollWidth - 5) {
        swatchesRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        swatchesRef.current.scrollBy({ left: 45, behavior: "smooth" });
      }
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: selectedVariant.productId || product.productId,
      productVariantId: selectedVariant.productVariantId,
      productVariantDetailId:
        selectedVariant.productVariantDetailId ||
        product.productVariantDetailId,
      name: selectedVariant.name || selectedVariant.productName || product.name,
      price: selectedVariant.price || selectedVariant.finalPrice,
      oldPrice: selectedVariant.oldPrice || selectedVariant.mrpPrice,
      image:
        selectedVariant.image ||
        selectedVariant.imageURL ||
        selectedVariant.imageUrl ||
        selectedVariant.selectedImage ||
        "",
      hoverImage:
        selectedVariant.hoverImage ||
        selectedVariant.secondaryImage ||
        selectedVariant.image2 ||
        selectedVariant.backImage ||
        product.hoverImage ||
        product.secondaryImage ||
        product.image2 ||
        product.backImage ||
        "",
      images: rawImages,
      color: selectedVariant.colorName || selectedVariant.color || "",
    });
  };

  const shareProduct = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/user-products/product-detail/${selectedVariant.productVariantId}/${slugify(selectedVariant.name || "")}`;
    try {
      if (navigator.share)
        await navigator.share({ title: selectedVariant.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {}
  };

  const goToDetail = () =>
    navigate(
      `/user-products/product-detail/${selectedVariant.productVariantId}/${slugify(
        selectedVariant.name || selectedVariant.productName || "",
      )}`,
    );

  const price = selectedVariant.price ?? selectedVariant.finalPrice ?? 0;
  const oldPrice = selectedVariant.oldPrice ?? selectedVariant.mrpPrice ?? 0;

  // ── Image resolution — covers all known API shapes ─────────────────────────
  const resolveImageList = (obj: any): string[] => {
    if (!obj) return [];
    if (Array.isArray(obj.images) && obj.images.length) {
      return Array.from(
        new Set(
          obj.images
            .filter(Boolean)
            .map((src: string) => String(src).trim())
            .filter(Boolean),
        ),
      );
    }
    const candidates = [
      obj.image,
      obj.imageUrl,
      obj.imageURL,
      obj.productImage,
      obj.variantImage,
      obj.thumbnail,
      obj.selectedImage,
      obj.hoverImage,
      obj.backImage,
      obj.image1,
      obj.image2,
      obj.primaryImage,
      obj.secondaryImage,
    ]
      .filter(Boolean)
      .map((src) => String(src).trim())
      .filter(Boolean) as string[];
    return Array.from(new Set(candidates));
  };

  const rawImages: string[] = resolveImageList(selectedVariant).length
    ? resolveImageList(selectedVariant)
    : resolveImageList(product);

  const resolvedImages = rawImages.map((src) => getImageUrl(src));
  const imgSrc = resolvedImages[0] || "";
  const hoverImgSrc = resolvedImages[1] || "";

  useEffect(() => {
    setHoverLoadedVariantId(-1);
    if (!hoverImgSrc) return;

    let cancelled = false;
    const hoverImage = new window.Image();
    const variantId = selectedVariant.productVariantId;
    const markReady = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) setHoverLoadedVariantId(variantId);
        }),
      );
    };

    hoverImage.onload = markReady;
    hoverImage.onerror = () => {
      if (!cancelled) setHoverLoadedVariantId(-1);
    };
    hoverImage.src = hoverImgSrc;

    if (hoverImage.complete) markReady();

    return () => {
      cancelled = true;
      hoverImage.onload = null;
      hoverImage.onerror = null;
    };
  }, [hoverImgSrc, selectedVariant.productVariantId]);

  // hoverLoaded is TRUE only when the hover image loaded for the CURRENT
  // variant. Derived synchronously — no stale frame, no colour-switch jump.
  const hoverLoaded =
    hoverLoadedVariantId === selectedVariant.productVariantId && !!hoverImgSrc;

  // pc-image-wrap--has-hover enables the fade transition; without it we still
  // get the zoom-in animation via CSS (pc-img-primary on hover).
  const imageWrapClass = `pc-image-wrap${hoverLoaded ? " pc-image-wrap--has-hover" : ""}`;

  const hasDiscount = Boolean(oldPrice && oldPrice > price);
  const discountPct = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  useEffect(() => {
    setDiscountAnimationStarted(false);
    if (!delayedDiscountRevealEnabled || !hasDiscount) return;

    const timer = window.setTimeout(() => {
      setDiscountAnimationStarted(true);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [
    delayedDiscountRevealEnabled,
    hasDiscount,
    selectedVariant.productVariantId,
    oldPrice,
    price,
  ]);

  // ── Review count — covers all known API field names ────────────────────────
  const reviewCount =
    product.reviewCount ||
    product.totalReviews ||
    product.ratingCount ||
    product.reviewsCount ||
    product.totalRating ||
    product.numReviews ||
    product.reviewTotal ||
    product.ratingTotal ||
    product.numRatings ||
    product.noOfReviews ||
    product.totalReviewCount ||
    selectedVariant.reviewCount ||
    selectedVariant.totalReviews ||
    selectedVariant.ratingCount ||
    0;

  const rating = Number(
    product.rating ||
      product.avgRating ||
      product.averageRating ||
      product.ratingAverage ||
      product.productRating ||
      selectedVariant.rating ||
      selectedVariant.avgRating ||
      0,
  );

  // ── Brand — covers all known API field names ───────────────────────────────
  const brandLabel =
    product.brandName ||
    product.brand ||
    product.brandTitle ||
    product.productBrand ||
    product.variantBrand ||
    selectedVariant?.brandName ||
    selectedVariant?.brand ||
    selectedVariant?.brandTitle ||
    "";

  const displayName =
    selectedVariant.name ||
    selectedVariant.productName ||
    product.name ||
    product.productName ||
    "";

  // ── Color fields — covers all known API naming variants ────────────────────
  // Dashboard API may use colourName (UK), colorCode, colorValue, hex, etc.
  const resolveColorFields = (obj: any) => {
    if (!obj) return { colorName: "", colorHex: "" };
    const name =
      obj.colorName ||
      obj.color ||
      obj.colourName ||
      obj.colour ||
      obj.colorCode ||
      obj.colorLabel ||
      obj.variantColor ||
      obj.productColor ||
      obj.productColour ||
      "";
    const hex =
      obj.colorHex ||
      obj.colourHex ||
      obj.hexCode ||
      obj.colorHexCode ||
      obj.hex ||
      // fall back to name-based resolution so named colours still render
      obj.colorCode ||
      obj.color ||
      obj.colourName ||
      obj.colorName ||
      "";
    return { colorName: name, colorHex: hex };
  };

  const productColorFields = resolveColorFields(product);

  const colorVariants: { id: number; colorName: string; colorHex: string }[] =
    singleColorOnly
      ? productColorFields.colorName || productColorFields.colorHex
        ? [
            {
              id: product.productVariantId,
              colorName: productColorFields.colorName,
              colorHex: resolveHex(productColorFields.colorHex),
            },
          ]
        : []
      : product.allVariants?.length > 1
        ? product.allVariants.map((v: any) => {
            const f = resolveColorFields(v);
            return {
              id: v.productVariantId,
              colorName: f.colorName,
              colorHex: resolveHex(f.colorHex),
            };
          })
        : productColorFields.colorName || productColorFields.colorHex
          ? [
              {
                id: product.productVariantId,
                colorName: productColorFields.colorName,
                colorHex: resolveHex(productColorFields.colorHex),
              },
            ]
          : [];

  return (
    <div className={`pc-wrap${isRemovableCard ? " pc-wrap--wishlist" : ""}`}>
      <div
        className={`pc-card${isRemovableCard ? " pc-card--wishlist" : ""}`}
        onClick={goToDetail}
      >
        <div className="pc-card-solid-bg" />

        <div className="pc-content-wrapper">
          {showDiscountTag && discountPct > 0 && (
            <div
              className={`pc-discount-corner${delayedDiscountRevealEnabled ? " pc-discount-corner--delayed" : ""}${discountAnimationStarted ? " pc-discount-corner--animated" : ""}`}
              aria-hidden="true"
            >
              <div className="pc-discount-mask">
                {delayedDiscountRevealEnabled && (
                  <svg
                    className="pc-discount-cut-line"
                    viewBox="0 0 50 50"
                    aria-hidden="true"
                  >
                    <path
                      d="M48.5 0.8 L44 3.4 L44.8 4.8 L38.2 9.6 L39 10.8 L28.6 18.8 L29.4 20 L16.4 29.8 L17 31 L1.4 42.2 L0.4 43"
                      pathLength="100"
                    />
                  </svg>
                )}
                <div className="pc-discount-cutout">
                  <span className="pc-discount-cutout-pct">{discountPct}%</span>
                  <span className="pc-discount-cutout-off">OFF</span>
                </div>
              </div>
              {delayedDiscountRevealEnabled && (
                <div className="pc-discount-flap" />
              )}
            </div>
          )}

          <div className={imageWrapClass}>
            <img
              className="pc-img-primary"
              src={imgSrc}
              alt={selectedVariant.name || product.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/category-bg.png";
              }}
            />
            {hoverImgSrc && (
              <img
                className="pc-img-hover"
                src={hoverImgSrc}
                alt=""
                aria-hidden="true"
              />
            )}

            <div className="pc-actions">
              <button
                className={`pc-action-btn${inWishlist ? " active" : ""}`}
                onClick={handleWishlist}
                disabled={isPending}
                title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
              >
                <i
                  className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
                />
              </button>
              <button
                className="pc-action-btn"
                onClick={shareProduct}
                title="Share"
              >
                <i className="bi bi-share" />
              </button>
            </div>
          </div>

          <div
            className="pc-body"
            style={
              compact ? { padding: "6px 10px 8px", gap: "4px" } : undefined
            }
          >
            {/* Row 1: swatch left | brand right */}
            <div className="pc-row1">
              {showColors && colorVariants.length > 0 ? (
                <div
                  className="pc-swatches-outer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pc-swatches" ref={swatchesRef}>
                    {colorVariants.map((v) => (
                      <span
                        key={v.id}
                        className={`pc-swatch-dot${selectedVariant.productVariantId === v.id ? " selected" : ""}`}
                        style={{ background: v.colorHex || "#ccc" }}
                        title={v.colorName}
                        onClick={() =>
                          !singleColorOnly && handleColorChange(v.id)
                        }
                      />
                    ))}
                  </div>

                  {isOverflowing && (
                    <button
                      className="pc-swatch-arrow"
                      onClick={handleScrollSwatches}
                      title="Scroll colors"
                    >
                      <i className="bi bi-chevron-right" />
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1 }} />
              )}
              {brandLabel && (
                <span
                  className="pc-brand"
                  style={compact ? { fontSize: "11px" } : undefined}
                >
                  {brandLabel}
                </span>
              )}
            </div>

            {/* Row 2: name left | prices right */}
            <div className="pc-row-name">
              <div className="pc-name-block">
                <h4
                  className="pc-name"
                  title={displayName}
                  style={
                    compact
                      ? { fontSize: "13px", WebkitLineClamp: 1 }
                      : undefined
                  }
                >
                  <span className="pc-name-text">{displayName}</span>
                </h4>
              </div>
              <div className="pc-price-block">
                {hasDiscount && (
                  <span className="pc-mrp">
                    ₹{Number(oldPrice).toLocaleString("en-IN")}
                  </span>
                )}
                <span
                  className={`pc-price${!hasDiscount ? " pc-price--full" : ""}`}
                  style={compact ? { fontSize: "13px" } : undefined}
                >
                  ₹
                  {Number(
                    hasDiscount ? price : oldPrice || price,
                  ).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Row 3: rating left | Quick Add right */}
            <div className="pc-row-bottom">
              <div
                className="pc-rating"
                style={
                  compact ? { padding: "3px 8px", fontSize: "11px" } : undefined
                }
              >
                <span className="pc-rating-star">★</span>
                <span className="pc-rating-score">{rating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span
                    className="pc-rating-count"
                    style={compact ? { fontSize: "10px" } : undefined}
                  >
                    {compact ? "· " : "("}
                    {reviewCount >= 1000
                      ? `${(reviewCount / 1000).toFixed(1)}k`
                      : reviewCount}
                    {!compact && ")"}
                  </span>
                )}
              </div>

              <div className="pc-btn-group">
                <button
                  className="pc-quick-btn"
                  style={
                    compact
                      ? { padding: "5px 8px", fontSize: "10px", maxWidth: 110 }
                      : undefined
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickShop(selectedVariant.productVariantId);
                  }}
                >
                  <i className="bi bi-cart3 pc-cart-icon" />
                  QUICK ADD
                </button>
                {isRemovableCard && (
                  <button
                    className="pc-remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove?.();
                    }}
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                  >
                    <i className="bi bi-trash3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
