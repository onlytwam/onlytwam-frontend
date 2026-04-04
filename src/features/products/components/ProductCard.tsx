import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
interface Props {
  product: any;
  onQuickShop: (id: number) => void;
  onRemove?: () => void;
  showColors?: boolean;
  showDiscountTag?: boolean;
}

export default function ProductCard({
  product,
  onQuickShop,
  onRemove,
  showColors = true,
  showDiscountTag = true,
}: Props) {
  const navigate = useNavigate();
  const [selectedVariant, setSelectedVariant] = useState(product);

  // Track whether the hover image loaded successfully — gates the crossfade CSS class
  const [hoverLoaded, setHoverLoaded] = useState(false);

  useEffect(() => {
    setSelectedVariant(product);
  }, [product.productId]);

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

  /*
   * ── Image resolution ─────────────────────────────────────────────────────
   *
   * Priority order:
   *   1. selectedVariant.images[]  — populated by backend ARRAY_AGG (full URLs)
   *   2. [selectedVariant.image]   — single-image fallback
   *   3. product.images[] / product.image — in case selectedVariant is a stub
   *
   * images[0] → primary (always shown)
   * images[1] → hover   (crossfade target — only if it loads successfully)
   */
  const rawImages: string[] = selectedVariant?.images?.length
    ? selectedVariant.images
    : selectedVariant?.image
      ? [selectedVariant.image]
      : product?.images?.length
        ? product.images
        : product?.image
          ? [product.image]
          : [];

  // Already-absolute URLs come back from the backend as-is; relative paths get prefixed
  const resolvedImages = rawImages.map((src) => getImageUrl(src));

  const imgSrc = resolvedImages[0] || "";
  const hoverImgSrc = resolvedImages[1] || ""; // "" when only one image exists

  // Reset hover-loaded state whenever the variant (and therefore the image set) changes
  useEffect(() => {
    setHoverLoaded(false);
  }, [imgSrc, hoverImgSrc]);

  /*
   * `pc-image-wrap--has-hover` GATES the crossfade.
   *   - Without it the primary image would fade to white on single-image products.
   *   - We only add it AFTER the hover image confirms it loaded (`hoverLoaded`).
   *   - This also silently handles missing/broken second images.
   */
  const imageWrapClass = `pc-image-wrap${hoverLoaded ? " pc-image-wrap--has-hover" : ""}`;

  const hasDiscount = Boolean(oldPrice && oldPrice > price);
  const discountPct = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;
  const reviewCount = product.reviewCount || product.totalReviews || 0;
  const rating = Number(product.rating || 0);

  const colorVariants: { id: number; colorName: string; colorHex: string }[] =
    product.allVariants?.length > 1
      ? product.allVariants.map((v: any) => ({
          id: v.productVariantId,
          colorName: v.colorName ?? v.color ?? "",
          colorHex: resolveHex(v.colorHex ?? v.color),
        }))
      : product.colorName || product.color
        ? [
            {
              id: product.productVariantId,
              colorName: product.colorName ?? product.color,
              colorHex: resolveHex(product.colorHex ?? product.color),
            },
          ]
        : [];

  return (
    <div className="pc-wrap">
      <div className="pc-card" onClick={goToDetail}>
        {/* ── LAYER 1: BACK RING ── */}
        {showDiscountTag && discountPct > 0 && <div className="dt-ring-back" />}

        {/* ── LAYER 2: SOLID CARD BACKGROUND ── */}
        <div className="pc-card-solid-bg" />

        {/* ── LAYER 3: PRODUCT CONTENT ── */}
        <div className="pc-content-wrapper">
          <div className={imageWrapClass}>
            {/* Primary — images[0] — always visible; zooms on hover */}
            <img
              className="pc-img-primary"
              src={imgSrc}
              alt={selectedVariant.name || product.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/category-bg.png";
              }}
            />

            {/*
             * Hover — images[1] — rendered only when a 2nd URL exists.
             * onLoad  → marks hover image ready; adds --has-hover class → enables crossfade
             * onError → keeps hoverLoaded=false; crossfade never fires for broken images
             */}
            {hoverImgSrc && (
              <img
                className="pc-img-hover"
                src={hoverImgSrc}
                alt=""
                aria-hidden="true"
                onLoad={() => setHoverLoaded(true)}
                onError={() => setHoverLoaded(false)}
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

          <div className="pc-body">
            {/* Row 1: colour swatches (left) | brand name (right) */}
            <div className="pc-row1">
              {showColors && colorVariants.length > 0 ? (
                <div
                  className="pc-swatches"
                  onClick={(e) => e.stopPropagation()}
                >
                  {colorVariants.slice(0, 6).map((v) => (
                    <span
                      key={v.id}
                      className={`pc-swatch-dot${selectedVariant.productVariantId === v.id ? " selected" : ""}`}
                      style={{ background: v.colorHex || "#ccc" }}
                      title={v.colorName}
                      onClick={() => handleColorChange(v.id)}
                    />
                  ))}
                  {colorVariants.length > 6 && (
                    <span className="pc-swatch-more">
                      +{colorVariants.length - 6}
                    </span>
                  )}
                </div>
              ) : (
                <div />
              )}
              {product.brandName && (
                <span className="pc-brand">{product.brandName}</span>
              )}
            </div>

            {/* Row 2: product name (left) | original price above + selling price below (right) */}
            <div className="pc-row-name">
              <div className="pc-name-block">
                <h4
                  className="pc-name"
                  title={selectedVariant.name || product.name}
                >
                  {selectedVariant.name || product.name}
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
                >
                  ₹
                  {Number(
                    hasDiscount ? price : oldPrice || price,
                  ).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="pc-row-bottom">
              <div className="pc-rating">
                <span className="pc-rating-star">★</span>
                <span className="pc-rating-score">{rating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="pc-rating-count">
                    (
                    {reviewCount >= 1000
                      ? `${(reviewCount / 1000).toFixed(1)}k`
                      : reviewCount}
                    )
                  </span>
                )}
              </div>

              <div className="pc-btn-group">
                <button
                  className="pc-quick-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickShop(selectedVariant.productVariantId);
                  }}
                >
                  <i className="bi bi-cart3 pc-cart-icon" />
                  QUICK ADD
                </button>
                {onRemove && (
                  <button
                    className="pc-remove-btn"
                    title="Remove from wishlist"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── LAYER 4: FRONT KEYCHAIN SYSTEM ── */}
        {showDiscountTag && discountPct > 0 && (
          <div className="dt-front-container">
            <div className="dt-eyelet" />
            <div className="dt-ring-front" />
            <div className="dt-tag-wrapper">
              <div className="dt-conn-back" />
              <div className="dt-tag">
                <div className="dt-tag-hole" />
                <div className="dt-text">
                  <span className="dt-pct">{discountPct}%</span>
                  <span className="dt-off">OFF</span>
                </div>
              </div>
              <div className="dt-conn-front" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
