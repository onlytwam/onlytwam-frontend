// src/utils/guestWishlist.ts
// Stores full product data so the Wishlist page can render without extra API calls.
// Dispatches 'wishlistUpdated' after every change so Navbar + Wishlist page
// can react immediately — no page refresh needed.

const KEY = 'guestWishlist';
const META_KEY = 'wishlistDisplayMeta';

export interface GuestWishlistItem {
  productId:              number;
  productVariantId:       number;
  productVariantDetailId?: number;
  state?:                 string;
  // display data stored at add-time so the page renders without extra fetches
  productName?:           string;
  variantName?:           string;
  imageURL?:              string;
  hoverImage?:            string;
  images?:                string[];
  finalPrice?:            number;
  mrpPrice?:              number;
  sizeLabel?:             string;
  color?:                 string;
  colorName?:             string;
  colorHex?:              string;
  brandName?:             string;
  rating?:                number;
  reviewCount?:           number;
}

export interface WishlistDisplayMeta {
  productVariantId: number;
  productName?: string;
  imageURL?: string;
  hoverImage?: string;
  images?: string[];
  brandName?: string;
  rating?: number;
  reviewCount?: number;
  colorName?: string;
  colorHex?: string;
}

const dispatch = () => window.dispatchEvent(new Event('wishlistUpdated'));

const getDisplayMetaMap = (): Record<string, WishlistDisplayMeta> => {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
};

const setDisplayMetaMap = (data: Record<string, WishlistDisplayMeta>) => {
  localStorage.setItem(META_KEY, JSON.stringify(data));
};

export const saveWishlistDisplayMeta = (item: any): void => {
  const variantId = Number(item?.productVariantId);
  if (!variantId) return;

  const images = Array.isArray(item?.images)
    ? item.images.filter(Boolean).map((src: any) => String(src).trim()).filter(Boolean)
    : [];

  const primaryImage =
    item?.imageURL ||
    item?.imageUrl ||
    item?.image ||
    item?.selectedImage ||
    images[0] ||
    '';

  const hoverImage =
    item?.hoverImage ||
    item?.secondaryImage ||
    item?.image2 ||
    item?.backImage ||
    images[1] ||
    '';

  const dedupedImages = Array.from(
    new Set(
      [primaryImage, hoverImage, ...images]
        .filter(Boolean)
        .map((src: any) => String(src).trim())
        .filter(Boolean),
    ),
  );

  const productName =
    item?.productName ||
    item?.productname ||
    item?.variantName ||
    item?.name ||
    "";

  const brandName =
    item?.brandName ||
    item?.brand ||
    item?.brandTitle ||
    item?.productBrand ||
    "";

  const rating = Number(
    item?.rating ||
      item?.avgRating ||
      item?.averageRating ||
      item?.ratingAverage ||
      item?.productRating ||
      0,
  );

  const reviewCount = Number(
    item?.reviewCount ||
      item?.totalReviews ||
      item?.ratingCount ||
      item?.reviewsCount ||
      item?.numReviews ||
      item?.noOfReviews ||
      0,
  );

  const colorName =
    item?.colorName ||
    item?.colourName ||
    item?.color ||
    item?.colour ||
    "";

  const colorHex =
    item?.colorHex ||
    item?.colourHex ||
    item?.hexCode ||
    item?.colorHexCode ||
    item?.hex ||
    "";

  const meta = getDisplayMetaMap();
  const existing = meta[String(variantId)];
  meta[String(variantId)] = {
    productVariantId: variantId,
    productName: productName || existing?.productName,
    imageURL: primaryImage || existing?.imageURL,
    hoverImage: hoverImage || existing?.hoverImage,
    images:
      dedupedImages.length
        ? dedupedImages
        : existing?.images,
    brandName: brandName || existing?.brandName,
    rating:
      Number.isFinite(rating) && rating > 0
        ? rating
        : (existing?.rating ?? 0),
    reviewCount:
      Number.isFinite(reviewCount) && reviewCount > 0
        ? reviewCount
        : (existing?.reviewCount ?? 0),
    colorName: colorName || existing?.colorName,
    colorHex: colorHex || existing?.colorHex,
  };
  setDisplayMetaMap(meta);
};

export const getWishlistDisplayMeta = (productVariantId: number | string): WishlistDisplayMeta | null => {
  const meta = getDisplayMetaMap();
  return meta[String(Number(productVariantId))] || null;
};

export const getGuestWishlist = (): GuestWishlistItem[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

export function addToGuestWishlist(item: any) {
  const wishlist = getGuestWishlist();

  if (wishlist.some((x) => x.productVariantId === item.productVariantId)) return;

  saveWishlistDisplayMeta(item);

  const newItem = {
    productId: item.productId,
    productVariantId: item.productVariantId,
    productVariantDetailId: item.productVariantDetailId,

    // FULL PRODUCT DETAILS (REQUIRED BY WishlistCard)
    productName: item.productName,
    variantName: item.variantName,
    finalPrice: item.finalPrice,
    mrpPrice: item.mrpPrice,
    imageURL: item.imageURL,
    hoverImage: item.hoverImage,
    images: item.images,
    sizeLabel: item.sizeLabel,
    color: item.color,
    colorName: item.colorName || item.color,
    colorHex: item.colorHex,
    brandName: item.brandName,
    rating: item.rating,
    reviewCount: item.reviewCount,
  };

  localStorage.setItem("guestWishlist", JSON.stringify([...wishlist, newItem]));
  window.dispatchEvent(new Event("wishlistUpdated"));
}
export const removeFromGuestWishlist = (productVariantId: number): void => {
  localStorage.setItem(KEY, JSON.stringify(getGuestWishlist().filter(i => i.productVariantId !== productVariantId)));
  dispatch();
};

export const isInGuestWishlist = (productVariantId: number | string): boolean =>
  getGuestWishlist().some(i => i.productVariantId === Number(productVariantId));

export const getGuestWishlistCount = (): number => getGuestWishlist().length;

export const clearGuestWishlist = (): void => {
  localStorage.removeItem(KEY);
  dispatch();
};
