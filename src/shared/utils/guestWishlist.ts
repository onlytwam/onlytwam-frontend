// src/utils/guestWishlist.ts
// Stores full product data so the Wishlist page can render without extra API calls.
// Dispatches 'wishlistUpdated' after every change so Navbar + Wishlist page
// can react immediately — no page refresh needed.

const KEY = 'guestWishlist';

export interface GuestWishlistItem {
  productId:              number;
  productVariantId:       number;
  productVariantDetailId?: number;
  state?:                 string;
  // display data stored at add-time so the page renders without extra fetches
  productName?:           string;
  variantName?:           string;
  imageURL?:              string;
  finalPrice?:            number;
  mrpPrice?:              number;
  sizeLabel?:             string;
  color?:                 string;
}

const dispatch = () => window.dispatchEvent(new Event('wishlistUpdated'));

export const getGuestWishlist = (): GuestWishlistItem[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

export function addToGuestWishlist(item: any) {
  const wishlist = getGuestWishlist();

  if (wishlist.some((x) => x.productVariantId === item.productVariantId)) return;

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