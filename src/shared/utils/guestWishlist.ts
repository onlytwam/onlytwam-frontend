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
}

export interface WishlistDisplayMeta {
  productVariantId: number;
  imageURL?: string;
  hoverImage?: string;
  images?: string[];
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

  const meta = getDisplayMetaMap();
  meta[String(variantId)] = {
    productVariantId: variantId,
    imageURL: primaryImage || undefined,
    hoverImage: hoverImage || undefined,
    images: dedupedImages.length ? dedupedImages : undefined,
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
