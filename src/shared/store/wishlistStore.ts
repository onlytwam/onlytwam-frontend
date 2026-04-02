/**
 * useWishlistStore
 * ─────────────────
 * Single source of truth for "is this product wishlisted?" across all cards.
 *
 * - Guest  → reads from localStorage guestWishlist
 * - Auth   → fetches from server once, caches the set of productVariantIds
 * - Cards  → call isWishlisted(variantId) — instant, no per-card fetch
 */

import { create } from 'zustand';
import { getGuestWishlist, isInGuestWishlist } from '@/shared/utils/guestWishlist';

interface WishlistStoreState {
  /** Set of productVariantIds the logged-in user has wishlisted */
  serverIds: Set<number>;
  /** Map from productVariantId → wishlistId (for delete) */
  serverIdMap: Map<number, number>;
  loaded: boolean;
  loading: boolean;

  setServerItems: (items: Array<{ productVariantId: number; wishlistId: number }>) => void;
  addId:    (variantId: number, wishlistId: number) => void;
  removeId: (variantId: number) => void;
  reset:    () => void;
}

export const useWishlistStore = create<WishlistStoreState>((set, get) => ({
  serverIds:   new Set(),
  serverIdMap: new Map(),
  loaded:      false,
  loading:     false,

  setServerItems: (items) => {
    const ids    = new Set(items.map(i => i.productVariantId));
    const idMap  = new Map(items.map(i => [i.productVariantId, i.wishlistId]));
    set({ serverIds: ids, serverIdMap: idMap, loaded: true, loading: false });
  },

  addId: (variantId, wishlistId) => {
    const ids    = new Set(get().serverIds);
    const idMap  = new Map(get().serverIdMap);
    ids.add(variantId);
    idMap.set(variantId, wishlistId);
    set({ serverIds: ids, serverIdMap: idMap });
  },

  removeId: (variantId) => {
    const ids    = new Set(get().serverIds);
    const idMap  = new Map(get().serverIdMap);
    ids.delete(variantId);
    idMap.delete(variantId);
    set({ serverIds: ids, serverIdMap: idMap });
  },

  reset: () => set({ serverIds: new Set(), serverIdMap: new Map(), loaded: false, loading: false }),
}));

/** Check if a variant is wishlisted — works for both guest and auth */
export function isWishlisted(variantId: number, isAuth: boolean): boolean {
  if (!isAuth) return isInGuestWishlist(variantId);
  return useWishlistStore.getState().serverIds.has(variantId);
}