// src/pages/account/Wishlist.tsx
// Uses same ProductCard as Home page — no separate card component needed

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  listWishlist,
  deleteWishlistVariant,
  bulkCreateWishlist,
} from "@/features/products/api/products.api";
import {
  getGuestWishlist,
  getWishlistDisplayMeta,
  removeFromGuestWishlist,
  clearGuestWishlist,
  type GuestWishlistItem,
} from "@/shared/utils/guestWishlist";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import ProductCard from "@/features/products/components/ProductCard";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

// ─── Product Slider (UPDATED) ────────────────────────────────────────────────

/* ── Main Wishlist Page ───────────────────────────────────────────────────── */
export default function Wishlist() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const prevPath =
    (location.state as any)?.from || sessionStorage.getItem("lastPage") || "/";
  const { getUserId, hasValidToken, setWishlistCount, wishlistCount } =
    useAuthStore();
  const { removeId: removeWishlistId, reset: resetWishlistStore } =
    useWishlistStore();
  const userId = getUserId();
  const isGuest = !hasValidToken() || !userId;

  const [guestItems, setGuestItems] =
    useState<GuestWishlistItem[]>(getGuestWishlist);
  const [quickShopId, setQuickShopId] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => setGuestItems(getGuestWishlist());
    window.addEventListener("wishlistUpdated", refresh);
    return () => window.removeEventListener("wishlistUpdated", refresh);
  }, []);

  const { data: serverData, isLoading } = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: () => listWishlist({ userProfileId: userId! }),
    enabled: !isGuest,
    staleTime: 5 * 60 * 1000,
    select: (d: any) => d?.list ?? (Array.isArray(d) ? d : []),
  });

  const authItems: any[] = serverData ?? [];
  const rawItems = isGuest ? guestItems : authItems;

  // Spread the full API item first so ALL fields reach ProductCard
  // (reviewCount, totalReviews, rating, brandName, colorHex, etc.)
  // then override only the fields that need normalisation across API shapes.
  const displayItems = rawItems.map((item: any) => {
    const meta = getWishlistDisplayMeta(item.productVariantId);
    return {
      ...item,
      productId: item.productId,
      productVariantId: item.productVariantId,
      productVariantDetailId: item.productVariantDetailId,
      name:
        item.productName ||
        item.productname ||
        item.variantName ||
        meta?.productName ||
        item.name ||
        "Product",
      image:
        item.imageURL || item.imageurl || item.image || meta?.imageURL || "",
      hoverImage:
        item.hoverImage ||
        item.image2 ||
        item.secondaryImage ||
        item.backImage ||
        meta?.hoverImage ||
        "",
      images:
        Array.isArray(item.images) && item.images.length
          ? item.images
          : meta?.images || [],
      price: item.finalPrice || item.finalprice || item.price || 0,
      oldPrice: item.mrpPrice || item.mrpprice || item.oldPrice || 0,
      rating:
        item.rating ||
        item.avgRating ||
        item.averageRating ||
        meta?.rating ||
        0,
      reviewCount:
        item.reviewCount ||
        item.totalReviews ||
        item.ratingCount ||
        item.noOfReviews ||
        item.numReviews ||
        meta?.reviewCount ||
        0,
      color:
        item.colorName ||
        item.colourName ||
        item.color ||
        meta?.colorName ||
        "",
      colorName:
        item.colorName ||
        item.colourName ||
        item.color ||
        meta?.colorName ||
        "",
      colorHex:
        item.colorHex || item.colourHex || item.hexCode || meta?.colorHex || "",
      brandName:
        item.brandName ||
        item.brand ||
        item.brandTitle ||
        item.productBrand ||
        meta?.brandName ||
        "",
    };
  });

  useEffect(() => {
    setWishlistCount(displayItems.length);
  }, [displayItems.length]);

  const handleSync = async () => {
    if (!hasValidToken() || !userId || !guestItems.length) return;
    setSyncing(true);
    try {
      await bulkCreateWishlist({
        createWishlistCommands: guestItems.map((i) => ({
          productId: i.productId,
          productVariantId: i.productVariantId,
          productVariantDetailId: i.productVariantDetailId,
          state: "Active",
        })),
        userProfileId: userId,
      });
      clearGuestWishlist();
      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
      toast.success(
        `${guestItems.length} item${
          guestItems.length !== 1 ? "s" : ""
        } synced!`,
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="s-wishlist-387046 s-wishlist-ff77776b">
      {/* Header */}
      {!isMobile && (
        <div className="s-wishlist-9e2513">
          <div>
            <h1 className="s-wishlist-b993f0 s-wishlist-ffaa1fea">
              <i className="bi bi-heart-fill s-wishlist-9d41a6" />
              My Wishlist
            </h1>
            <p className="s-wishlist-4735d5">
              {displayItems.length === 0
                ? "Your wishlist is empty"
                : `${displayItems.length} saved item${
                    displayItems.length !== 1 ? "s" : ""
                  }`}
              {isGuest && <span className="s-wishlist-a22f7a">Guest</span>}
            </p>
          </div>
          {displayItems.length > 0 && (
            <button
              onClick={() => navigate(prevPath)}
              className="s-wishlist-693b7a s-wishlist-ffaa1fea"
            >
              <i className="bi bi-arrow-left" /> Continue Shopping
            </button>
          )}
        </div>
      )}

      {/* Sync banner */}
      {!isGuest && guestItems.length > 0 && (
        <div className="s-wishlist-73d46c">
          <span className="s-wishlist-19ae95">
            <strong>{guestItems.length}</strong> item
            {guestItems.length !== 1 ? "s" : ""} saved before signing in.
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="s-wishlist-7c0503 s-wishlist-ffaa1fea"
          >
            {syncing ? "Syncing…" : "Sync to account"}
          </button>
        </div>
      )}

      {/* Sign-in nudge for guests */}
      {isGuest && displayItems.length > 0 && (
        <div className="s-wishlist-73d46c">
          <span className="s-wishlist-19ae95">
            <strong>Sign in</strong> to save your wishlist across devices.
          </span>
          <button
            onClick={() => navigate("/login")}
            className="s-wishlist-7c0503 s-wishlist-ffaa1fea"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !isGuest && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            paddingTop: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div
                className="twam-skel"
                style={{ aspectRatio: "3/4", borderRadius: 12 }}
              />
              <div
                className="twam-skel"
                style={{ height: 14, width: "70%", borderRadius: 6 }}
              />
              <div
                className="twam-skel"
                style={{ height: 12, width: "45%", borderRadius: 6 }}
              />
              <div
                className="twam-skel"
                style={{ height: 14, width: "35%", borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayItems.length === 0 && (
        <div className="s-wishlist-9466fd">
          <div className="s-wishlist-1540d2">
            <i className="bi bi-heart s-wishlist-cc38d3" />
          </div>
          <h3 className="s-wishlist-25a118 s-wishlist-ffaa1fea">
            Your wishlist is empty
          </h3>
          <p className="s-wishlist-6c13a8">
            Save items you love by clicking the heart icon on any product.
          </p>
          <button
            onClick={() => navigate(prevPath)}
            className="s-wishlist-dbc514 s-wishlist-ffaa1fea"
          >
            <i className="bi bi-arrow-left" /> Continue Shopping
          </button>
        </div>
      )}

      {/* Product grid — same card as Home */}
      {!isLoading && displayItems.length > 0 && (
        <>
          <div className="wl-grid s-wishlist-7d2408">
            {displayItems.map((item: any) =>
              isMobile ? (
                <MobileProductCard
                  key={item.productVariantId}
                  product={item}
                  onQuickShop={setQuickShopId}
                />
              ) : (
                <ProductCard
                  key={item.productVariantId}
                  product={item}
                  onQuickShop={setQuickShopId}
                  singleColorOnly={true}
                  onRemove={() => {
                    if (isGuest) {
                      removeFromGuestWishlist(item.productVariantId);
                    } else {
                      deleteWishlistVariant(item.productVariantId)
                        .then(() =>
                          qc.invalidateQueries({
                            queryKey: ["wishlist", userId],
                          }),
                        )
                        .catch(() => toast.error("Could not remove"));
                      removeWishlistId(item.productVariantId);
                      setWishlistCount(Math.max(0, wishlistCount - 1));
                    }
                    toast("Removed from wishlist", { icon: "💔" });
                  }}
                />
              ),
            )}
          </div>
          <div className="s-wishlist-4b3d6a">
            <button
              onClick={() => {
                if (isGuest) clearGuestWishlist();
                else {
                  Promise.all(
                    authItems.map((i: any) =>
                      deleteWishlistVariant(i.productVariantId),
                    ),
                  )
                    .then(() => {
                      qc.invalidateQueries({
                        queryKey: ["wishlist", userId],
                      });
                      resetWishlistStore();
                      setWishlistCount(0);
                    })
                    .catch(() => toast.error("Could not clear wishlist"));
                }
                toast.success("Wishlist cleared");
              }}
              className="s-wishlist-e1731e s-wishlist-ff77776b"
            >
              <i className="bi bi-trash3" /> Clear wishlist
            </button>
          </div>
        </>
      )}

      {quickShopId > 0 && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(0)}
        />
      )}
    </div>
  );
}
