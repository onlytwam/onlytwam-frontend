import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/authStore";
import { listCart, addToCart, updateCart } from "@/features/cart/api/cart.api";

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
 * - Processes pendingBuyNowCartAdd (from Buy Now → Back navigation)
 */
export function useCartLoader() {
  const { isAuthenticated, getUserId, setCartCount } = useAuthStore();
  const userId = getUserId();
  const queryClient = useQueryClient();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["cart-bootstrap", userId],
    queryFn: async () => {
      const res = await listCart({ userProfileId: userId });
      return res?.list ?? res ?? [];
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 0, // always refetch fresh
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Update cart count when data changes
  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0);
      return;
    }
    if (Array.isArray(data)) {
      setCartCount(data.length);
    }
  }, [data, isAuthenticated, setCartCount]);

  // Process pending buy-now items saved when user went back from Buy Now cart
  useEffect(() => {
    if (!isAuthenticated || !userId || !Array.isArray(data)) return;

    const raw = localStorage.getItem("pendingBuyNowCartAdd");
    if (!raw) return;

    let pending: any[] = [];
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    if (!pending.length) return;

    // Clear immediately so we don't re-process on the next render
    localStorage.removeItem("pendingBuyNowCartAdd");

    const process = async () => {
      for (const item of pending) {
        if (!item.productVariantDetailId) continue;
        try {
          // Check if same item already exists in cart (avoid duplicates)
          const existing = (data as any[]).find(
            (c: any) =>
              c.productVariantDetailId === item.productVariantDetailId,
          );
          if (existing?.cartId) {
            const newQty =
              (existing.quantity || existing.processedQuantity || 1) +
              (item.quantity || 1);
            await updateCart(existing.cartId, {
              cartId: existing.cartId,
              quantity: newQty,
            });
          } else {
            await addToCart(item);
          }
        } catch {
          // silent — don't disrupt the user
        }
      }
      // Refresh cart after processing
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["quick-cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      await refetch();
    };

    process();
  }, [isAuthenticated, userId, data, queryClient, refetch]);

  // Listen to sync events and refetch
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleSyncComplete = async () => {
      console.log("🔄 Cart: Sync complete, refetching...");
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["quick-cart"] });
      await refetch();
    };

    const handleCartSync = async () => {
      console.log("🔄 Cart: Cart sync event, refetching...");
      await refetch();
    };

    window.addEventListener("syncComplete", handleSyncComplete);
    window.addEventListener("cartSyncComplete", handleCartSync);
    window.addEventListener("wishlistUpdated", handleCartSync);

    return () => {
      window.removeEventListener("syncComplete", handleSyncComplete);
      window.removeEventListener("cartSyncComplete", handleCartSync);
      window.removeEventListener("wishlistUpdated", handleCartSync);
    };
  }, [isAuthenticated, refetch, queryClient]);

  // Force refetch when authentication state changes
  useEffect(() => {
    if (isAuthenticated && userId) {
      console.log("🔄 Cart: Auth state changed, refetching...");
      refetch();
    }
  }, [isAuthenticated, userId]);

  return { isLoading, refetch };
}
