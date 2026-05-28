import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  slugify,
  getImageUrl,
  getCanvasSafeImageUrl,
} from "@/shared/utils/helpers";
import {
  getDefaultProductVariant,
  normalizeVariantPriceFields,
} from "@/features/products/utils/productPricing";

const TEAR_LINE_SAMPLE_POINTS = [
  { x: 48.5, y: 0.8 },
  { x: 44, y: 3.4 },
  { x: 44.8, y: 4.8 },
  { x: 38.2, y: 9.6 },
  { x: 39, y: 10.8 },
  { x: 28.6, y: 18.8 },
  { x: 29.4, y: 20 },
  { x: 16.4, y: 29.8 },
  { x: 17, y: 31 },
  { x: 1.4, y: 42.2 },
  { x: 0.4, y: 43 },
];
const DISCOUNT_REVEAL_DELAY_MS = 3000;
const DISCOUNT_VISIBLE_START_DELAY_MS = 4400;
const DISCOUNT_VISIBLE_HOLD_MS = 10000;
const DISCOUNT_CLOSE_DURATION_MS = 1800;

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
  /** Reveal the discount by tearing away the paper flap after 3 seconds. */
  delayedDiscountReveal?: boolean;
  /** Disable hover image swap/zoom for contexts that want a static card image. */
  enableHoverImageTransition?: boolean;
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
  enableHoverImageTransition = true,
}: Props) {
  const navigate = useNavigate();
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const defaultVariant = useMemo(
    () => getDefaultProductVariant(product),
    [product],
  );
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const isRemovableCard = typeof onRemove === "function";
  // When a product's category is inactive, it should only be accessible from
  // wishlist/cart (where it was saved before the category was hidden).
  const isCategoryInactive = product.categoryIsActive === false;
  const showUnavailableOverlay = isCategoryInactive && isRemovableCard;
  // Track which variant's hover image has fully loaded.
  // Derived synchronously → no stale-state flash when the user switches colour.
  const [hoverLoadedVariantId, setHoverLoadedVariantId] = useState(-1);
  const [discountAnimationPhase, setDiscountAnimationPhase] = useState<
    "idle" | "opening" | "open" | "closing"
  >("idle");
  const [tearVisualStyle, setTearVisualStyle] = useState<React.CSSProperties>(
    {},
  );

  const primaryImageRef = useRef<HTMLImageElement>(null);
  const swatchesRef = useRef<HTMLDivElement>(null);
  const tearSamplerCleanupRef = useRef<(() => void) | null>(null);
  const tearFrameOneRef = useRef<number | null>(null);
  const tearFrameTwoRef = useRef<number | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const showDiscountTagEnabled = showDiscountTag && !isRemovableCard;
  const delayedDiscountRevealEnabled =
    delayedDiscountReveal && !isRemovableCard && !prefersReducedMotion;

  useEffect(() => {
    setSelectedVariant(defaultVariant);
  }, [
    defaultVariant.productId,
    defaultVariant.productVariantId,
    defaultVariant.productVariantDetailId,
    defaultVariant.price,
    defaultVariant.oldPrice,
  ]);

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
    setSelectedVariant(normalizeVariantPriceFields(variant));
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
      color: selectedColorFields.colorName,
      colorName: selectedColorFields.colorName,
      colorHex: selectedColorFields.colorHex,
      brandName: brandLabel,
      rating,
      reviewCount,
    });
  };

  const shareProduct = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/user-products/product-detail/${
      selectedVariant.productVariantId
    }/${slugify(selectedVariant.name || "")}`;
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
      `/user-products/product-detail/${
        selectedVariant.productVariantId
      }/${slugify(selectedVariant.name || selectedVariant.productName || "")}`,
      // When used in the wishlist context (isRemovableCard), tell ProductDetail
      // it came from wishlist so viewOnly logic works for inactive categories.
      isRemovableCard ? { state: { fromWishlist: true } } : undefined,
    );

  const price = selectedVariant.price ?? selectedVariant.finalPrice ?? 0;
  const oldPrice = selectedVariant.oldPrice ?? selectedVariant.mrpPrice ?? 0;

  // ── Image resolution — covers all known API shapes ─────────────────────────
  // const resolveImageList = (obj: any): string[] => {
  //   if (!obj) return [];
  //   if (Array.isArray(obj.images) && obj.images.length) {
  //     return Array.from(
  //       new Set(
  //         obj.images
  //           .filter(Boolean)
  //           .map((src: string) => String(src).trim())
  //           .filter(Boolean),
  //       ),
  //     );
  //   }
  //   const candidates = [
  //     obj.image,
  //     obj.imageUrl,
  //     obj.imageURL,
  //     obj.productImage,
  //     obj.variantImage,
  //     obj.thumbnail,
  //     obj.selectedImage,
  //     obj.hoverImage,
  //     obj.backImage,
  //     obj.image1,
  //     obj.image2,
  //     obj.primaryImage,
  //     obj.secondaryImage,
  //   ]
  //   .filter(Boolean)
  //     .map((src) => String(src).trim())
  //     .filter(Boolean) as string[];
  //   return Array.from(new Set(candidates));
  // };

  // ── Image resolution — covers all known API shapes ─────────────────────────
  // const resolveImageList = (obj: any): string[] => {
  //   if (!obj) return [];

  //   if (Array.isArray(obj.images) && obj.images.length) {
  //     return Array.from(
  //       new Set(
  //         obj.images
  //           .filter(Boolean)
  //           .map((src: string) => String(src).trim())
  //           .filter(Boolean),
  //       ),
  //     );
  //   }

  //   const candidates = [
  //     obj.image,
  //     obj.imageUrl,
  //     obj.imageURL,
  //     obj.productImage,
  //     obj.variantImage,
  //     obj.thumbnail,
  //     obj.selectedImage,
  //     obj.hoverImage,
  //     obj.backImage,
  //     obj.image1,
  //     obj.image2,
  //     obj.primaryImage,
  //     obj.secondaryImage,
  //   ]
  //     .filter(Boolean)
  //     .map((src) => String(src).trim())
  //     .filter(Boolean) as string[];

  //   return Array.from(new Set(candidates));
  // };

  const resolveImageList = (obj: any): string[] => {
    if (!obj) return [];

    // If API gives array → use directly
    if (Array.isArray(obj.images) && obj.images.length) {
      return obj.images.filter(Boolean);
    }

    // 🔥 PRIORITY ORDER (fix here)
    const candidates = [
      obj.primaryImage,
      obj.image,
      obj.imageUrl,
      obj.imageURL,
      obj.productImage,
      obj.variantImage,
      obj.thumbnail,

      // hover / secondary AFTER
      obj.hoverImage,
      obj.secondaryImage,
      obj.image2,
      obj.backImage,
    ]
      .filter(Boolean)
      .map((src) => String(src).trim());

    return Array.from(new Set(candidates));
  };
  // const rawImages: string[] = resolveImageList(selectedVariant).length
  //   ? resolveImageList(selectedVariant)
  //   : resolveImageList(product);

  const variantImages = resolveImageList(selectedVariant);
  const productImages = resolveImageList(product);

  const rawImages: string[] =
    variantImages.length > 0
      ? variantImages
      : productImages.length > 0
      ? productImages
      : [];

  const resolvedImages = rawImages.map((src) => getImageUrl(src));
  const FALLBACK_IMAGE = "/assets/category-bg.png";

  const imgSrc = resolvedImages[0] || FALLBACK_IMAGE;
  const hoverImgSrc = resolvedImages[1] || "";
  // console.log("RAW IMAGES:", rawImages);
  // console.log("FINAL IMG:", imgSrc);
  // if (rawImages.length === 0) {
  //   console.warn("⚠️ No images for product:", selectedVariant);
  // }

  const hexToRgb = (hex: string) => {
    const clean = hex.replace("#", "").trim();
    if (clean.length === 3) {
      return {
        r: Number.parseInt(clean[0] + clean[0], 16),
        g: Number.parseInt(clean[1] + clean[1], 16),
        b: Number.parseInt(clean[2] + clean[2], 16),
      };
    }
    if (clean.length === 6) {
      return {
        r: Number.parseInt(clean.slice(0, 2), 16),
        g: Number.parseInt(clean.slice(2, 4), 16),
        b: Number.parseInt(clean.slice(4, 6), 16),
      };
    }
    return null;
  };

  const clearScheduledTearVisualStyleUpdate = () => {
    if (tearFrameOneRef.current !== null) {
      window.cancelAnimationFrame(tearFrameOneRef.current);
      tearFrameOneRef.current = null;
    }
    if (tearFrameTwoRef.current !== null) {
      window.cancelAnimationFrame(tearFrameTwoRef.current);
      tearFrameTwoRef.current = null;
    }
  };

  const clearTearVisualSyncWork = () => {
    clearScheduledTearVisualStyleUpdate();
    tearSamplerCleanupRef.current?.();
    tearSamplerCleanupRef.current = null;
  };

  const scheduleTearVisualStyleUpdate = (
    imageEl: HTMLImageElement | null,
    sampleImageEl: HTMLImageElement | null = imageEl,
  ) => {
    if (!imageEl) return;

    clearScheduledTearVisualStyleUpdate();

    tearFrameOneRef.current = window.requestAnimationFrame(() => {
      tearFrameTwoRef.current = window.requestAnimationFrame(() => {
        tearFrameOneRef.current = null;
        tearFrameTwoRef.current = null;
        updateTearVisualStyle(imageEl, sampleImageEl);
      });
    });
  };

  const updateTearVisualStyle = (
    imageEl: HTMLImageElement | null,
    sampleImageEl: HTMLImageElement | null = imageEl,
  ) => {
    if (!imageEl) return;

    const imageUrl = imageEl.currentSrc || imageEl.src || imgSrc;
    const naturalWidth =
      sampleImageEl?.naturalWidth || imageEl.naturalWidth || 0;
    const naturalHeight =
      sampleImageEl?.naturalHeight || imageEl.naturalHeight || 0;
    const containerWidth = imageEl.clientWidth || 0;
    const containerHeight = imageEl.clientHeight || 0;

    const fallbackHex =
      selectedColorFields.colorHex ||
      selectedColorFields.colorName ||
      productColorFields.colorHex ||
      productColorFields.colorName ||
      "#767676";
    const fallbackBase = hexToRgb(fallbackHex) || { r: 118, g: 118, b: 118 };
    let base = fallbackBase;
    let renderWidth = containerWidth;
    let renderHeight = containerHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (
      naturalWidth > 0 &&
      naturalHeight > 0 &&
      containerWidth > 0 &&
      containerHeight > 0
    ) {
      try {
        const coverScale = Math.max(
          containerWidth / naturalWidth,
          containerHeight / naturalHeight,
        );
        renderWidth = naturalWidth * coverScale;
        renderHeight = naturalHeight * coverScale;
        offsetX = (containerWidth - renderWidth) / 2;
        offsetY = 0;

        const canvas = document.createElement("canvas");
        canvas.width = 50;
        canvas.height = 50;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.clearRect(0, 0, 50, 50);
          context.drawImage(
            sampleImageEl || imageEl,
            offsetX,
            offsetY,
            renderWidth,
            renderHeight,
          );

          const sampleOffsets = [
            { dx: 0, dy: 0, weight: 1.2 },
            { dx: -0.8, dy: -0.9, weight: 0.7 },
            { dx: -1.4, dy: -1.6, weight: 0.38 },
          ];

          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let totalWeight = 0;

          for (const point of TEAR_LINE_SAMPLE_POINTS) {
            for (const sample of sampleOffsets) {
              const sampleX = Math.max(
                0,
                Math.min(49, Math.round(point.x + sample.dx)),
              );
              const sampleY = Math.max(
                0,
                Math.min(49, Math.round(point.y + sample.dy)),
              );
              const pixel = context.getImageData(sampleX, sampleY, 1, 1).data;
              const alpha = pixel[3] / 255;
              if (alpha < 0.12) continue;

              const weight = sample.weight * alpha;
              totalR += pixel[0] * weight;
              totalG += pixel[1] * weight;
              totalB += pixel[2] * weight;
              totalWeight += weight;
            }
          }

          if (totalWeight > 0) {
            base = {
              r: Math.round(totalR / totalWeight),
              g: Math.round(totalG / totalWeight),
              b: Math.round(totalB / totalWeight),
            };
          }
        }
      } catch {
        base = fallbackBase;
      }
    }

    const clampChannel = (value: number) => Math.max(0, Math.min(255, value));
    const mixChannel = (channel: number, target: number, amount: number) =>
      clampChannel(Math.round(channel + (target - channel) * amount));
    const toHex = (value: { r: number; g: number; b: number }) =>
      `#${[value.r, value.g, value.b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
    const edgeStrong = {
      r: mixChannel(base.r, 0, 0.28),
      g: mixChannel(base.g, 0, 0.28),
      b: mixChannel(base.b, 0, 0.28),
    };
    const edgeLine = {
      r: mixChannel(base.r, 0, 0.22),
      g: mixChannel(base.g, 0, 0.22),
      b: mixChannel(base.b, 0, 0.22),
    };
    const edgeSoft = {
      r: mixChannel(base.r, 0, 0.14),
      g: mixChannel(base.g, 0, 0.14),
      b: mixChannel(base.b, 0, 0.14),
    };
    const edgeHighlight = {
      r: mixChannel(base.r, 245, 0.24),
      g: mixChannel(base.g, 240, 0.24),
      b: mixChannel(base.b, 230, 0.24),
    };
    const sampledLineHex = toHex(edgeLine);

    setTearVisualStyle({
      ["--pc-tear-image" as string]: imageUrl
        ? `url(${JSON.stringify(imageUrl)})`
        : "none",
      ["--pc-tear-image-size" as string]:
        renderWidth > 0 && renderHeight > 0
          ? `${renderWidth}px ${renderHeight}px`
          : "100% 100%",
      ["--pc-tear-image-position" as string]: `${offsetX}px ${offsetY}px`,
      ["--pc-tear-line-color" as string]: sampledLineHex,
      ["--pc-tear-line-soft" as string]: `rgba(${edgeSoft.r}, ${edgeSoft.g}, ${edgeSoft.b}, 0.42)`,
      ["--pc-tear-line-strong" as string]: `rgba(${edgeStrong.r}, ${edgeStrong.g}, ${edgeStrong.b}, 0.58)`,
      ["--pc-tear-line-highlight" as string]: `rgba(${edgeHighlight.r}, ${edgeHighlight.g}, ${edgeHighlight.b}, 0.54)`,
    });
  };

  const refreshTearVisualStyle = (imageEl: HTMLImageElement | null) => {
    clearTearVisualSyncWork();
    if (!imageEl) return;

    const displaySrc = imageEl.currentSrc || imageEl.src || imgSrc;
    const sampleSrc = getCanvasSafeImageUrl(displaySrc, "");

    if (!sampleSrc) {
      scheduleTearVisualStyleUpdate(imageEl);
      return;
    }

    const toAbsoluteUrl = (value: string) => {
      try {
        return new URL(value, window.location.origin).toString();
      } catch {
        return value;
      }
    };

    if (toAbsoluteUrl(sampleSrc) === toAbsoluteUrl(displaySrc)) {
      scheduleTearVisualStyleUpdate(imageEl);
      return;
    }

    let cancelled = false;
    const sampler = new window.Image();
    sampler.decoding = "async";
    sampler.onload = () => {
      if (!cancelled) {
        scheduleTearVisualStyleUpdate(imageEl, sampler);
      }
    };
    sampler.onerror = () => {
      if (!cancelled) {
        scheduleTearVisualStyleUpdate(imageEl);
      }
    };
    sampler.src = sampleSrc;

    if (sampler.complete && sampler.naturalWidth > 0) {
      scheduleTearVisualStyleUpdate(imageEl, sampler);
    }

    tearSamplerCleanupRef.current = () => {
      cancelled = true;
      sampler.onload = null;
      sampler.onerror = null;
    };
  };

  useEffect(() => {
    const imageEl = primaryImageRef.current;
    if (imageEl?.complete && imageEl.naturalWidth > 0) {
      refreshTearVisualStyle(imageEl);
    }

    return () => {
      clearTearVisualSyncWork();
    };
  }, [imgSrc, selectedVariant.productVariantId]);

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
  const imageWrapClass = `pc-image-wrap${
    enableHoverImageTransition && hoverLoaded ? " pc-image-wrap--has-hover" : ""
  }`;

  const hasDiscount = Boolean(oldPrice && oldPrice > price);
  const discountPct = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  useEffect(() => {
    setDiscountAnimationPhase("idle");
  }, [
    delayedDiscountRevealEnabled,
    hasDiscount,
    selectedVariant.productVariantId,
    oldPrice,
    price,
  ]);

  useEffect(() => {
    if (!delayedDiscountRevealEnabled || !hasDiscount) return;

    let timer: number | null = null;

    if (discountAnimationPhase === "idle") {
      timer = window.setTimeout(() => {
        setDiscountAnimationPhase("opening");
      }, DISCOUNT_REVEAL_DELAY_MS);
    } else if (discountAnimationPhase === "opening") {
      timer = window.setTimeout(() => {
        setDiscountAnimationPhase("open");
      }, DISCOUNT_VISIBLE_START_DELAY_MS);
    } else if (discountAnimationPhase === "open") {
      timer = window.setTimeout(() => {
        setDiscountAnimationPhase("closing");
      }, DISCOUNT_VISIBLE_HOLD_MS);
    } else if (discountAnimationPhase === "closing") {
      timer = window.setTimeout(() => {
        setDiscountAnimationPhase("idle");
      }, DISCOUNT_CLOSE_DURATION_MS);
    }

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [
    discountAnimationPhase,
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
  const selectedColorFields = resolveColorFields(selectedVariant);

  const colorVariants: { id: number; colorName: string; colorHex: string }[] =
    singleColorOnly
      ? productColorFields.colorName || productColorFields.colorHex
        ? [
            {
              id: product.productVariantId,
              colorName: productColorFields.colorName,
              colorHex: productColorFields.colorHex || "",
            },
          ]
        : []
      : product.allVariants?.length > 1
      ? defaultVariant.allVariants.map((v: any) => {
          const f = resolveColorFields(v);
          return {
            id: v.productVariantId,
            colorName: f.colorName,
            colorHex: f.colorHex || "",
          };
        })
      : productColorFields.colorName || productColorFields.colorHex
      ? [
          {
            id: product.productVariantId,
            colorName: productColorFields.colorName,
            colorHex: productColorFields.colorHex || "",
          },
        ]
      : [];
  const hasScrollableColors = colorVariants.length > 5;

  return (
    <div className={`pc-wrap${isRemovableCard ? " pc-wrap--wishlist" : ""}`}>
      <div
        className={`pc-card${isRemovableCard ? " pc-card--wishlist" : ""}${
          !enableHoverImageTransition ? " pc-card--hover-image-disabled" : ""
        }`}
        onClick={goToDetail}
      >
        <div className="pc-card-solid-bg" />

        <div className="pc-content-wrapper">
          {showDiscountTagEnabled && discountPct > 0 && (
            <div
              className={`pc-discount-corner${
                delayedDiscountRevealEnabled
                  ? " pc-discount-corner--delayed"
                  : ""
              }${
                delayedDiscountRevealEnabled
                  ? ` pc-discount-corner--${discountAnimationPhase}`
                  : ""
              }`}
              style={tearVisualStyle}
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
              ref={primaryImageRef}
              className="pc-img-primary"
              src={imgSrc}
              alt={selectedVariant.name || product.name}
              loading="lazy"
              decoding="async"
              style={
                showUnavailableOverlay
                  ? {
                      filter: "blur(6px) brightness(0.65) grayscale(30%)",
                      transform: "scale(1.04)",
                    }
                  : undefined
              }
              onLoad={(e) => {
                refreshTearVisualStyle(e.currentTarget);
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/category-bg.png";
              }}
            />
            {enableHoverImageTransition &&
              hoverImgSrc &&
              !showUnavailableOverlay && (
                <img
                  className="pc-img-hover"
                  src={hoverImgSrc}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
              )}

            {showUnavailableOverlay && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  pointerEvents: "none",
                  borderRadius: "inherit",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    background: "rgba(0,0,0,0.62)",
                    color: "#fff",
                    padding: "8px 20px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                    backdropFilter: "blur(2px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  Not Available
                </span>
              </div>
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
                  className={`pc-swatches-outer${
                    hasScrollableColors ? " pc-swatches-outer--scrollable" : ""
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pc-swatches" ref={swatchesRef}>
                    {colorVariants.map((v) => (
                      <span
                        key={v.id}
                        className={`pc-swatch-dot${
                          selectedVariant.productVariantId === v.id
                            ? " selected"
                            : ""
                        }`}
                        style={{ background: v.colorHex || "#ccc" }}
                        title={v.colorName}
                        onClick={() =>
                          !singleColorOnly && handleColorChange(v.id)
                        }
                      />
                    ))}

                    {colorVariants.length > 1 &&
                      !hasScrollableColors &&
                      !isOverflowing && (
                        <span
                          className="pc-color-count"
                          title={`${colorVariants.length} colors`}
                        >
                          ({colorVariants.length})
                        </span>
                      )}
                  </div>

                  {(hasScrollableColors || isOverflowing) && (
                    <button
                      className="pc-swatch-arrow"
                      onClick={handleScrollSwatches}
                      title="Scroll colors"
                    >
                      <i className="bi bi-chevron-right" />
                    </button>
                  )}

                  {colorVariants.length > 1 &&
                    (hasScrollableColors || isOverflowing) && (
                      <span
                        className="pc-color-count pc-color-count--after-arrow"
                        title={`${colorVariants.length} colors`}
                      >
                        ({colorVariants.length})
                      </span>
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
                {showUnavailableOverlay ? (
                  /* Category hidden — show badge instead of price */
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "rgba(220,53,69,0.10)",
                      color: "#b91c1c",
                      border: "1.5px solid rgba(185,28,28,0.28)",
                      borderRadius: 5,
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.7,
                      textTransform: "uppercase",
                    }}
                  >
                    <i
                      className="bi bi-exclamation-circle-fill"
                      style={{ fontSize: 10 }}
                    />
                    Unavailable
                  </span>
                ) : (
                  <>
                    {hasDiscount && (
                      <span className="pc-mrp">
                        ₹{Number(oldPrice).toLocaleString("en-IN")}
                      </span>
                    )}
                    <span
                      className={`pc-price${
                        !hasDiscount ? " pc-price--full" : ""
                      }`}
                      style={compact ? { fontSize: "13px" } : undefined}
                    >
                      ₹
                      {Number(
                        hasDiscount ? price : oldPrice || price,
                      ).toLocaleString("en-IN")}
                    </span>
                  </>
                )}
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
                {!showUnavailableOverlay && (
                  <button
                    className="pc-quick-btn"
                    style={
                      compact
                        ? {
                            padding: "5px 8px",
                            fontSize: "10px",
                            maxWidth: 110,
                          }
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
                )}
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
