/**
 * features/products/hooks/useProducts.ts
 * ────────────────────────────────────────
 * TanStack Query hooks for all product-related data fetching.
 * Previously each component managed its own useEffect + useState.
 * These hooks provide caching, deduplication and consistent states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProducts,
  getProductDetail,
  listCategories,
  listBrands,
  getUserDashboard,
  createWishlist,
  deleteWishlistVariant,
  listWishlist,
} from '../api/products.api';

// ── Query key factory ─────────────────────────────────────────────────────────
export const productKeys = {
  all:        ()            => ['products'] as const,
  lists:      ()            => [...productKeys.all(), 'list'] as const,
  list:       (params: any) => [...productKeys.lists(), params] as const,
  detail:     (id: number)  => [...productKeys.all(), 'detail', id] as const,
  categories: ()            => ['categories'] as const,
  brands:     ()            => ['brands'] as const,
  wishlist:   (uid: string) => ['wishlist', uid] as const,
  dashboard:  (uid: string) => ['dashboard', uid] as const,
};

// ── Product list ──────────────────────────────────────────────────────────────
export function useProductList(params: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey:  productKeys.list(params),
    queryFn:   () => listProducts(params),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev: any) => prev,
  });
}

// ── Product detail ────────────────────────────────────────────────────────────
export function useProductDetail(id: number, enabled = true) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn:  () => getProductDetail(id),
    enabled:  enabled && id > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Categories ────────────────────────────────────────────────────────────────
export function useCategories(params?: any) {
  return useQuery({
    queryKey:  productKeys.categories(),
    queryFn:   () => listCategories(params),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Brands ────────────────────────────────────────────────────────────────────
export function useBrands(params?: any) {
  return useQuery({
    queryKey:  productKeys.brands(),
    queryFn:   () => listBrands(params),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Wishlist query ────────────────────────────────────────────────────────────
export function useWishlistQuery(userProfileId: string, enabled = true) {
  return useQuery({
    queryKey:  productKeys.wishlist(userProfileId),
    queryFn:   () => listWishlist({ userProfileId }),
    enabled:   enabled && !!userProfileId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Add to wishlist ───────────────────────────────────────────────────────────
export function useAddToWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      productId: number;
      productVariantId: number;
      productVariantDetailId?: number;
      userProfileId: string;
      state?: string;
    }) => createWishlist(data),
    onSuccess: (_data: any, variables: { userProfileId: string }) => {
      qc.invalidateQueries({ queryKey: productKeys.wishlist(variables.userProfileId) });
    },
  });
}

// ── Remove from wishlist ──────────────────────────────────────────────────────
export function useRemoveFromWishlist(userProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productVariantId: number) => deleteWishlistVariant(productVariantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.wishlist(userProfileId) });
    },
  });
}

// ── User dashboard counts ─────────────────────────────────────────────────────
export function useUserDashboard(userProfileId: string, enabled = true) {
  return useQuery({
    queryKey:  productKeys.dashboard(userProfileId),
    queryFn:   () => getUserDashboard({ userProfileId }),
    enabled:   enabled && !!userProfileId,
    staleTime: 30 * 1000,
  });
}
