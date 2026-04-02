import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listCart } from '@/features/cart/api/cart.api';

/**
 * useCartLoader — IMPROVED VERSION
 * ─────────────────────────────────
 * Fetches the server cart count and keeps authStore.cartCount in sync.
 * Call this once near the app root (App.tsx).
 * 
 * Improvements:
 * - Listens to 'syncComplete' event from authStore after login
 * - Forces refetch after sync to ensure fresh data
 * - Properly invalidates cache
 */
export function useCartLoader() {
  const { isAuthenticated, getUserId, setCartCount } = useAuthStore();
  const userId = getUserId();
  const queryClient = useQueryClient();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['cart-bootstrap', userId],
    queryFn: async () => {
      const res = await listCart({ userProfileId: userId });
      return res?.list ?? res ?? [];
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 0,          // always refetch fresh
    refetchOnMount: true,
    refetchOnWindowFocus: false, // don't refetch on window focus to prevent unnecessary calls
  });

  // Update cart count when data changes
  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0);
      return;
    }
    if (Array.isArray(data)) {
      // Use number of distinct products (not sum of quantities)
      // to stay consistent with guest cart badge which uses guestCart.length
      setCartCount(data.length);
    }
  }, [data, isAuthenticated, setCartCount]);

  // Listen to sync events and refetch
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleSyncComplete = async () => {
      console.log('🔄 Cart: Sync complete, refetching...');
      // Invalidate all cart-related queries
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      await queryClient.invalidateQueries({ queryKey: ['cart-bootstrap'] });
      await queryClient.invalidateQueries({ queryKey: ['quick-cart'] });
      // Refetch immediately
      await refetch();
    };

    const handleCartSync = async () => {
      console.log('🔄 Cart: Cart sync event, refetching...');
      await refetch();
    };

    // Listen to multiple events
    window.addEventListener('syncComplete', handleSyncComplete);
    window.addEventListener('cartSyncComplete', handleCartSync);
    window.addEventListener('wishlistUpdated', handleCartSync); // Sometimes cart changes affect wishlist

    return () => {
      window.removeEventListener('syncComplete', handleSyncComplete);
      window.removeEventListener('cartSyncComplete', handleCartSync);
      window.removeEventListener('wishlistUpdated', handleCartSync);
    };
  }, [isAuthenticated, refetch, queryClient]);

  // Force refetch when authentication state changes
  useEffect(() => {
    if (isAuthenticated && userId) {
      console.log('🔄 Cart: Auth state changed, refetching...');
      refetch();
    }
  }, [isAuthenticated, userId]);

  return { isLoading, refetch };
}