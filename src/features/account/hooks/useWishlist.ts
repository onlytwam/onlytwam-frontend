import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  createWishlist,
  deleteWishlistVariant,
  listWishlist,
} from "@/features/products/api/products.api";
import {
  addToGuestWishlist,
  saveWishlistDisplayMeta,
  removeFromGuestWishlist,
  isInGuestWishlist,
} from "@/shared/utils/guestWishlist";
import { useWishlistStore } from "@/shared/store/wishlistStore";

// ── Load server wishlist into store — IMPROVED VERSION ─
export function useWishlistLoader() {
  const { isAuthenticated, getUserId, setWishlistCount } = useAuthStore();
  const { setServerItems, reset } = useWishlistStore();
  const userId = getUserId();
  const queryClient = useQueryClient();

  // Reset store on logout
  useEffect(() => {
    if (!isAuthenticated) {
      console.log("🔄 Wishlist: Resetting store (logged out)");
      reset();
    }
  }, [isAuthenticated, reset]);

  const { refetch, isLoading } = useQuery({
    queryKey: ["wishlist-ids", userId],
    queryFn: async () => {
      if (!isAuthenticated || !userId) return [];

      console.log("🔄 Wishlist: Fetching server wishlist...");
      const res = await listWishlist({ userProfileId: userId });
      const items = (res?.list ?? res ?? []).map((i: any) => ({
        productVariantId: i.productVariantId,
        wishlistId: i.wishlistId,
      }));

      setServerItems(items);
      setWishlistCount(items.length);
      console.log(`✅ Wishlist: Loaded ${items.length} items`);

      return items;
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Listen to sync events and refetch
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleSyncComplete = async () => {
      console.log("🔄 Wishlist: Sync complete, refetching...");
      // Invalidate all wishlist queries
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      await queryClient.invalidateQueries({ queryKey: ["wishlist-ids"] });
      // Refetch immediately
      await refetch();
    };

    const handleWishlistUpdate = async () => {
      console.log("🔄 Wishlist: Update event, refetching...");
      await refetch();
    };

    window.addEventListener("syncComplete", handleSyncComplete);
    window.addEventListener("wishlistUpdated", handleWishlistUpdate);

    return () => {
      window.removeEventListener("syncComplete", handleSyncComplete);
      window.removeEventListener("wishlistUpdated", handleWishlistUpdate);
    };
  }, [isAuthenticated, refetch, queryClient]);

  // Force refetch when auth state changes
  useEffect(() => {
    if (isAuthenticated && userId) {
      console.log("🔄 Wishlist: Auth state changed, refetching...");
      refetch();
    }
  }, [isAuthenticated, userId]);

  return { isLoading, refetch };
}

// ── Per-card toggle hook (keep existing implementation) ─
export const useWishlistToggle = (productVariantId: number) => {
  const { isAuthenticated, getUserId } = useAuthStore();
  const { serverIds, addId, removeId } = useWishlistStore();
  const qc = useQueryClient();

  const [inWishlist, setInWishlist] = useState(() =>
    isAuthenticated
      ? serverIds.has(productVariantId)
      : isInGuestWishlist(productVariantId),
  );

  useEffect(() => {
    setInWishlist(
      isAuthenticated
        ? serverIds.has(productVariantId)
        : isInGuestWishlist(productVariantId),
    );
  }, [productVariantId, isAuthenticated, serverIds]);

  useEffect(() => {
    if (isAuthenticated) return;
    const sync = () => setInWishlist(isInGuestWishlist(productVariantId));
    window.addEventListener("wishlistUpdated", sync);
    return () => window.removeEventListener("wishlistUpdated", sync);
  }, [productVariantId, isAuthenticated]);

  const addMut = useMutation({
    mutationFn: async (item: any) => {
      saveWishlistDisplayMeta(item);

      if (!isAuthenticated) {
        addToGuestWishlist({
          productId: item.productId,
          productVariantId: item.productVariantId,
          productVariantDetailId: item.productVariantDetailId,
          productName: item.name || item.productName,
          finalPrice: item.price || item.finalPrice,
          mrpPrice: item.oldPrice || item.mrpPrice,
          imageURL: item.image || item.imageURL,
          hoverImage: item.hoverImage,
          images: item.images,
          color: item.color,
          colorName: item.colorName || item.color,
          colorHex: item.colorHex,
          brandName: item.brandName,
          rating: item.rating,
          reviewCount: item.reviewCount,
        });
        return null;
      }
      const res = await createWishlist({
        productId: item.productId,
        productVariantId: item.productVariantId,
        productVariantDetailId: item.productVariantDetailId,
        userProfileId: getUserId(),
        state: "Active",
      });
      return res;
    },
    onSuccess: (res) => {
      if (isAuthenticated && res?.wishlistId) {
        addId(productVariantId, res.wishlistId);
      }
      setInWishlist(true);
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      window.dispatchEvent(new Event("wishlistUpdated"));
      toast.success("Added to wishlist!");
    },
    onError: () => toast.error("Failed to add to wishlist"),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        removeFromGuestWishlist(productVariantId);
        return;
      }
      await deleteWishlistVariant(productVariantId);
    },
    onSuccess: () => {
      if (isAuthenticated) removeId(productVariantId);
      setInWishlist(false);
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      window.dispatchEvent(new Event("wishlistUpdated"));
      toast("Removed from wishlist", { icon: "💔" });
    },
    onError: () => toast.error("Failed to remove from wishlist"),
  });

  const toggle = (item: any) => {
    if (inWishlist) removeMut.mutate();
    else addMut.mutate(item);
  };

  return {
    inWishlist,
    toggle,
    isPending: addMut.isPending || removeMut.isPending,
  };
};

// ── Legacy hook (keep for compatibility) ─
export const useWishlist = () => {
  const { isAuthenticated, getUserId } = useAuthStore();
  const { addId, removeId } = useWishlistStore();
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async (item: any) => {
      saveWishlistDisplayMeta(item);

      if (!isAuthenticated) {
        addToGuestWishlist({
          productId: item.productId,
          productVariantId: item.productVariantId,
          productVariantDetailId: item.productVariantDetailId,
          productName: item.name || item.productName,
          finalPrice: item.price || item.finalPrice,
          mrpPrice: item.oldPrice || item.mrpPrice,
          imageURL: item.image || item.imageURL,
          hoverImage: item.hoverImage,
          images: item.images,
          color: item.color,
          colorName: item.colorName || item.color,
          colorHex: item.colorHex,
          brandName: item.brandName,
          rating: item.rating,
          reviewCount: item.reviewCount,
        });
        return { success: true, isGuest: true };
      }
      return createWishlist({
        productId: item.productId,
        productVariantId: item.productVariantId,
        productVariantDetailId: item.productVariantDetailId,
        userProfileId: getUserId(),
        state: "Active",
      });
    },
    onSuccess: (res: any) => {
      if (isAuthenticated && res?.wishlistId) {
        addId(res.productVariantId, res.wishlistId);
      }
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      window.dispatchEvent(new Event("wishlistUpdated"));
    },
    onError: (err: any) => {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        toast.error("Please sign in to save wishlist");
      } else {
        toast.error("Failed to add to wishlist");
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (productVariantId: number) => {
      if (!isAuthenticated) removeFromGuestWishlist(productVariantId);
      else await deleteWishlistVariant(productVariantId);
      return productVariantId;
    },
    onSuccess: (variantId: number) => {
      if (isAuthenticated) removeId(variantId);
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      window.dispatchEvent(new Event("wishlistUpdated"));
    },
  });

  return {
    addToWishlist: addMutation.mutate,
    removeFromWishlist: removeMutation.mutate,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
};
