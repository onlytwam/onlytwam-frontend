// src/pages/account/Wishlist.tsx
// Uses same ProductCard as Home page — no separate card component needed

import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
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
  removeFromGuestWishlist,
  clearGuestWishlist,
  type GuestWishlistItem,
} from "@/shared/utils/guestWishlist";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import Breadcrumb from "@/shared/components/Breadcrumb";
import { useBreadcrumb } from "@/shared/hooks/useBreadcrumb";
import ProductCard from "@/features/products/components/ProductCard";
const PRI = "#6B0F2A";
const HEIRLOOM = "#9E6070";
const BLUSH = "#A84C6B";
const IVORY = "#F5F0E6";
const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

// ─── Product Slider (UPDATED) ────────────────────────────────────────────────

/* ── Main Wishlist Page ───────────────────────────────────────────────────── */
export default function Wishlist() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const wishlistCrumbs = useBreadcrumb({
    staticItems: [{ label: "My Wishlist" }],
  });
  const prevPath =
    (location.state as any)?.from ||
    sessionStorage.getItem("lastPage") ||
    "/user-products/product-list";
  const { getUserId, isAuthenticated, setWishlistCount, wishlistCount } =
    useAuthStore();
  const { removeId: removeWishlistId, reset: resetWishlistStore } =
    useWishlistStore();
  const userId = getUserId();
  const isGuest = !isAuthenticated || !userId;

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
    select: (d: any) => d?.list ?? (Array.isArray(d) ? d : []),
  });

  const authItems: any[] = serverData ?? [];
  const rawItems = isGuest ? guestItems : authItems;

  // Normalize fields so ProductCard works (same as Home)
  const displayItems = rawItems.map((item: any) => ({
    productId: item.productId,
    productVariantId: item.productVariantId,
    productVariantDetailId: item.productVariantDetailId,
    name:
      item.productName ||
      item.productname ||
      item.variantName ||
      item.name ||
      "Product",
    image: item.imageURL || item.imageurl || item.image || "",
    price: item.finalPrice || item.finalprice || item.price || 0,
    oldPrice: item.mrpPrice || item.mrpprice || item.oldPrice || 0,
    rating: item.rating || 0,
    color: item.colorName || item.color || "",
    colorName: item.colorName || item.color || "",
    colorHex: item.colorHex || "",
    brandName: item.brandName || "",
  }));

  useEffect(() => {
    setWishlistCount(displayItems.length);
  }, [displayItems.length]);

  const handleSync = async () => {
    if (!isAuthenticated || !userId || !guestItems.length) return;
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
        `${guestItems.length} item${guestItems.length !== 1 ? "s" : ""} synced!`,
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Breadcrumb items={wishlistCrumbs} />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 16px 24px",
          fontFamily: FONT_UI,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                margin: 0,
                color: PRI,
                fontFamily: FONTS,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <i
                className="bi bi-heart-fill"
                style={{ color: BLUSH, fontSize: 22 }}
              />
              My Wishlist
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: HEIRLOOM }}>
              {displayItems.length === 0
                ? "Your wishlist is empty"
                : `${displayItems.length} saved item${displayItems.length !== 1 ? "s" : ""}`}
              {isGuest && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    background: IVORY,
                    color: PRI,
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontWeight: 600,
                    border: `1px solid ${HEIRLOOM}`,
                  }}
                >
                  Guest
                </span>
              )}
            </p>
          </div>
          {displayItems.length > 0 && (
            <button
              onClick={() => navigate(prevPath)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                background: PRI,
                color: "#fff",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONTS,
              }}
            >
              <i className="bi bi-arrow-left" /> Continue Shopping
            </button>
          )}
        </div>

        {/* Sync banner */}
        {!isGuest && guestItems.length > 0 && (
          <div
            style={{
              background: IVORY,
              border: `1.5px solid ${HEIRLOOM}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 13, color: PRI }}>
              <strong>{guestItems.length}</strong> item
              {guestItems.length !== 1 ? "s" : ""} saved before signing in.
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                background: PRI,
                color: "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONTS,
              }}
            >
              {syncing ? "Syncing…" : "Sync to account"}
            </button>
          </div>
        )}

        {/* Sign-in nudge for guests */}
        {isGuest && displayItems.length > 0 && (
          <div
            style={{
              background: IVORY,
              border: `1.5px solid ${HEIRLOOM}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 13, color: PRI }}>
              <strong>Sign in</strong> to save your wishlist across devices.
            </span>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: PRI,
                color: "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONTS,
              }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && !isGuest && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "60px 0",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: `4px solid ${IVORY}`,
                borderTopColor: PRI,
                borderRadius: "50%",
                animation: "wl-spin .8s linear infinite",
              }}
            />
            <style>{`@keyframes wl-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayItems.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "60px 16px",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: IVORY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="bi bi-heart"
                style={{ fontSize: 40, color: HEIRLOOM }}
              />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: PRI,
                fontFamily: FONTS,
              }}
            >
              Your wishlist is empty
            </h3>
            <p
              style={{
                margin: 0,
                color: HEIRLOOM,
                fontSize: 14,
                textAlign: "center",
                maxWidth: 320,
              }}
            >
              Save items you love by clicking the heart icon on any product.
            </p>
            <button
              onClick={() => navigate(prevPath)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 28px",
                background: PRI,
                color: "#fff",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: FONTS,
                marginTop: 8,
              }}
            >
              <i className="bi bi-arrow-left" /> Continue Shopping
            </button>
          </div>
        )}

        {/* Product grid — same card as Home */}
        {!isLoading && displayItems.length > 0 && (
          <>
            <div
              className="wl-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 20,
              }}
            >
              <style>{`
              @media(max-width:991px){.wl-grid{grid-template-columns:repeat(2,1fr)!important;}}
              @media(max-width:575px){.wl-grid{grid-template-columns:repeat(1,1fr)!important;}}
            `}</style>
              {displayItems.map((item: any) => (
                <ProductCard
                  key={item.productVariantId}
                  product={item}
                  onQuickShop={setQuickShopId}
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
                      // Update store so Navbar badge decrements instantly
                      removeWishlistId(item.productVariantId);
                      setWishlistCount(Math.max(0, wishlistCount - 1));
                    }
                    toast("Removed from wishlist", { icon: "💔" });
                  }}
                />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 32 }}>
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
                style={{
                  background: "none",
                  border: `1.5px solid ${HEIRLOOM}`,
                  color: HEIRLOOM,
                  padding: "9px 22px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: FONT_UI,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
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
    </>
  );
}
