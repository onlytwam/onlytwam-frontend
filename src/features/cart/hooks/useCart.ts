import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/authStore";
import { listCart, addToCart, updateCart } from "@/features/cart/api/cart.api";

/**
 * useCartLoader
 * Keeps authStore.cartCount in sync with the server cart and handles
 * post-login cart sync plus pending Buy Now cart additions.
 */
export function useCartLoader() {
  const { isAuthenticated, getUserId, setCartCount } = useAuthStore();
  const userId = getUserId();
  const queryClient = useQueryClient();
  const processingPendingRef = useRef(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["cart-bootstrap", userId],
    queryFn: async () => {
      const res = await listCart({ userProfileId: userId });
      return res?.list ?? res ?? [];
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0);
      return;
    }
    if (Array.isArray(data)) {
      // Count unique products, not raw DB rows — duplicate rows for the same
      // productVariantDetailId are merged into one card in the UI, so the
      // badge must reflect that merged count, not the raw row count.
      const uniqueCount = new Set(
        (data as any[]).map((item) =>
          item.productVariantDetailId != null
            ? String(item.productVariantDetailId)
            : `cart-${item.cartId}`,
        ),
      ).size;
      setCartCount(uniqueCount);
    }
  }, [data, isAuthenticated, setCartCount]);

  const processPendingBuyNowCartAdd = useCallback(async () => {
    if (!isAuthenticated || !userId || !Array.isArray(data)) return;
    if (processingPendingRef.current) return;
    const raw = localStorage.getItem("pendingBuyNowCartAdd");
    const pendingKey = localStorage.getItem("pendingBuyNowCartAddKey");
    const processedKey = localStorage.getItem("processedBuyNowCartAddKey");
    if (pendingKey && pendingKey === processedKey) return;
    if (!raw) return;

    let pending: any[] = [];
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    if (!pending.length) return;

    processingPendingRef.current = true;

    try {
      localStorage.removeItem("pendingBuyNowCartAdd");

      for (const item of pending) {
        if (!item.productVariantDetailId) continue;
        try {
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
          // Silent on purpose so cart recovery never blocks the user.
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["quick-cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      await refetch();

      if (pendingKey) {
        localStorage.setItem("processedBuyNowCartAddKey", pendingKey);
      }
      localStorage.removeItem("pendingBuyNowCartAddKey");
    } finally {
      processingPendingRef.current = false;
    }
  }, [data, isAuthenticated, queryClient, refetch, userId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleSyncComplete = async () => {
      console.log("Cart: sync complete, refetching...");
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["quick-cart"] });
      await refetch();
    };

    const handleCartSync = async () => {
      console.log("Cart: cart sync event, refetching...");
      await refetch();
    };

    const handleBuyNowReturned = async () => {
      console.log("Cart: buy-now return detected, merging items...");
      await processPendingBuyNowCartAdd();
    };

    window.addEventListener("syncComplete", handleSyncComplete);
    window.addEventListener("cartSyncComplete", handleCartSync);
    window.addEventListener("buyNowCartReturned", handleBuyNowReturned);
    window.addEventListener("wishlistUpdated", handleCartSync);

    return () => {
      window.removeEventListener("syncComplete", handleSyncComplete);
      window.removeEventListener("cartSyncComplete", handleCartSync);
      window.removeEventListener("buyNowCartReturned", handleBuyNowReturned);
      window.removeEventListener("wishlistUpdated", handleCartSync);
    };
  }, [isAuthenticated, processPendingBuyNowCartAdd, refetch, queryClient]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      console.log("Cart: auth state changed, refetching...");
      refetch();
    }
  }, [isAuthenticated, userId, refetch]);

  return { isLoading, refetch };
}
