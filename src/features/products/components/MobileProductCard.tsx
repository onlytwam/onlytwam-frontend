/**
 * MobileProductCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 *   ┌────────────────────────┐
 *   │                        │
 *   │      product image     │
 *   │                        │
 *   │ [4.1★ 15]              │  ← rating pill bottom-left on image
 *   ├────────────────────────┤
 *   │ BRAND NAME    [♡] [↗]  │  ← wishlist + share beside brand
 *   │ Product name           │
 *   │ ₹1,399  ₹1,161  5% OFF│
 *   └────────────────────────┘
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { slugify, getImageUrl } from "@/shared/utils/helpers";
import { getDefaultProductVariant } from "@/features/products/utils/productPricing";

interface Props {
  product: any;
  onQuickShop: (id: number) => void;
}

export default function MobileProductCard({ product }: Props) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const displayProduct = useMemo(
    () => getDefaultProductVariant(product),
    [product],
  );

  const rawSrc =
    displayProduct.image ||
    displayProduct.imageUrl ||
    displayProduct.imageURL ||
    displayProduct.productImage ||
    displayProduct.selectedImage ||
    displayProduct.thumbnail ||
    (Array.isArray(displayProduct.images) ? displayProduct.images[0] : "") ||
    "";
  const imgSrc = imgError ? "/assets/category-bg.png" : getImageUrl(rawSrc);

  const displayName =
    displayProduct.name ||
    displayProduct.productName ||
    displayProduct.variantName ||
    "";
  const brandLabel =
    displayProduct.brandName ||
    displayProduct.brand ||
    displayProduct.brandTitle ||
    "";

  const price = Number(displayProduct.price ?? displayProduct.finalPrice ?? 0);
  const oldPrice = Number(displayProduct.oldPrice ?? displayProduct.mrpPrice ?? 0);
  const hasDiscount = oldPrice > 0 && oldPrice > price;
  const discountPct = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  const rating = Number(
    displayProduct.rating ||
      displayProduct.avgRating ||
      displayProduct.averageRating ||
      0,
  );
  const reviewCount =
    displayProduct.reviewCount ||
    displayProduct.totalReviews ||
    displayProduct.ratingCount ||
    displayProduct.reviewsCount ||
    displayProduct.numReviews ||
    0;

  const {
    inWishlist,
    toggle: toggleWishlist,
    isPending,
  } = useWishlistToggle(displayProduct.productVariantId);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: displayProduct.productId,
      productVariantId: displayProduct.productVariantId,
      productVariantDetailId: displayProduct.productVariantDetailId,
      name: displayName,
      price,
      oldPrice,
      image: rawSrc,
      hoverImage: displayProduct.hoverImage || displayProduct.secondaryImage || "",
      images: [],
      color: displayProduct.colorName || displayProduct.color || "",
      colorName: displayProduct.colorName || displayProduct.color || "",
      colorHex: displayProduct.colorHex || "",
      brandName: brandLabel,
      rating,
      reviewCount,
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/user-products/product-detail/${
      displayProduct.productVariantId
    }/${slugify(displayName)}`;
    try {
      if (navigator.share) await navigator.share({ title: displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {}
  };

  const goToDetail = () =>
    navigate(
      `/user-products/product-detail/${
        displayProduct.productVariantId
      }/${slugify(displayName)}`,
    );

  // Rating: ★ 4.1 | 15
  const ratingDisplay =
    rating > 0 ? (
      <span className="mpc-rating-content">
        <span className="mpc-rating-star">★</span>
        <span className="mpc-rating-score">{rating.toFixed(1)}</span>
        {reviewCount > 0 && (
          <>
            <span className="mpc-rating-sep">|</span>
            <span className="mpc-rating-count">
              {reviewCount >= 1000
                ? `${(reviewCount / 1000).toFixed(1)}k`
                : reviewCount}
            </span>
          </>
        )}
      </span>
    ) : null;

  return (
    <div className="mpc-wrap" onClick={goToDetail}>
      {/* ── Image — no icons on it ──────────────────────────────────────── */}
      <div className="mpc-image-wrap">
        <img
          className="mpc-img"
          src={imgSrc}
          alt={displayName}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
        {ratingDisplay && (
          <div className="mpc-rating-pill">{ratingDisplay}</div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="mpc-body">
        {/* Row 1: Brand | wishlist + share */}
        <div className="mpc-brand-row">
          {brandLabel && <span className="mpc-brand">{brandLabel}</span>}
          <div className="mpc-actions">
            <button
              className={`mpc-wishlist-btn${
                inWishlist ? " mpc-wishlist-btn--active" : ""
              }`}
              onClick={handleWishlist}
              disabled={isPending}
              aria-label={
                inWishlist ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              <i
                className={`bi ${inWishlist ? "bi-heart-fill" : "bi-heart"}`}
              />
            </button>
            <button
              className="mpc-share"
              onClick={handleShare}
              aria-label="Share"
            >
              <i className="bi bi-share" />
            </button>
          </div>
        </div>

        {/* Row 2: Product name */}
        <p className="mpc-name">{displayName}</p>

        {/* Row 3: Prices */}
        <div className="mpc-price-row">
          {hasDiscount && (
            <span className="mpc-mrp">
              ₹{Number(oldPrice).toLocaleString("en-IN")}
            </span>
          )}
          <span className="mpc-price">
            ₹
            {Number(hasDiscount ? price : oldPrice || price).toLocaleString(
              "en-IN",
            )}
          </span>
          {hasDiscount && discountPct > 0 && (
            <span className="mpc-discount">{discountPct}% OFF</span>
          )}
        </div>
      </div>
    </div>
  );
}
