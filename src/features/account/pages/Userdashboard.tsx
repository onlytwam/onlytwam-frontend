/**
 * UserDashboard.tsx – Premium Dashboard with embedded Orders & Wishlist
 * Tabs: Overview | My Orders | My Wishlist
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { listOrders } from "@/features/orders/api/orders.api";
import { listUserCoupons, listAddress } from "@/features/orders/api/orders.api";
import {
  listWishlist,
  deleteWishlistVariant,
} from "@/features/products/api/products.api";
import { useWishlistStore } from "@/shared/store/wishlistStore";
import { getWishlistDisplayMeta } from "@/shared/utils/guestWishlist";
import ProductCard from "@/features/products/components/ProductCard";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import UserAvatar from "@/shared/components/UserAvatar";
import { getImageUrl } from "@/shared/utils/helpers";

const ORDER_FILTERS = [
  "All",
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];
const TRACKING_STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
] as const;
const IN_TRANSIT_STATES = new Set([
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
]);

const getOrderStatus = (order: any) => order.state || order.status || "Pending";
const getOrderItems = (order: any) =>
  order.orderItems || order.orderDetails || order.items || [];
const formatOrderValue = (amount: number) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;
const formatOrderDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
const getTrackingStepIndex = (status: string) => {
  const normalizedStatus = status === "Out for Delivery" ? "Shipped" : status;
  const idx = TRACKING_STEPS.indexOf(
    normalizedStatus as (typeof TRACKING_STEPS)[number],
  );
  return idx >= 0 ? idx : 2;
};

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="s-userdashboar-c13cc7"
      data-clickable={onClick ? "true" : "false"}
      data-hovered={hovered ? "true" : "false"}
    >
      <div className="s-userdashboar-83c582">
        <div
          className="s-userdashboar-adc1c0"
          data-hovered={hovered ? "true" : "false"}
        >
          <i
            className={`bi ${icon} s-userdashboar-e41cf0`}
            data-hovered={hovered ? "true" : "false"}
          />
        </div>
        <div className="s-userdashboar-stat-copy">
          <div className="s-userdashboar-3d403b twam-font-heading">{value}</div>
          <div className="s-userdashboar-d961a8 twam-font-body">{label}</div>
        </div>
      </div>
    </div>
  );
}

function TypingGreeting({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!isDeleting && displayText.length < text.length) {
      timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, 110);
    } else if (!isDeleting && displayText.length === text.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 2200);
    } else if (isDeleting && displayText.length > 0) {
      timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length - 1));
      }, 55);
    } else if (isDeleting && displayText.length === 0) {
      timer = setTimeout(() => {
        setIsDeleting(false);
      }, 160);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [displayText, isDeleting, text]);

  return (
    <span
      className="s-profilelayou-typing s-userdashboar-mobile-greeting-pill"
      aria-live="polite"
    >
      <span className="s-profilelayou-typing-text">{displayText}</span>
      <span className="s-profilelayou-typing-cursor" aria-hidden="true" />
    </span>
  );
}

function MobileDashboardHero({
  userName,
  profileImageUrl,
  mobileGreeting,
}: {
  userName: string;
  profileImageUrl: string;
  mobileGreeting: string;
}) {
  return (
    <section className="fade-in s-userdashboar-mobile-hero">
      <div className="s-userdashboar-mobile-hero__glow" />
      <div className="s-userdashboar-mobile-hero__row">
        <UserAvatar
          name={userName || "User"}
          imageUrl={profileImageUrl}
          size={56}
          fallbackMode="initial"
          className="s-userdashboar-mobile-hero__avatar"
          style={{
            boxShadow: "none",
            background: "var(--ivory)",
            border: "1px solid rgba(107, 15, 42, 0.1)",
            color: "var(--brand)",
          }}
        />
        <div className="s-userdashboar-mobile-hero__copy">
          <p className="s-userdashboar-mobile-hero__eyebrow">Welcome back</p>
          <h2 className="s-userdashboar-mobile-hero__title twam-font-heading twam-brand">
            {userName || "Guest"}
          </h2>
          <div className="s-userdashboar-mobile-hero__tagline">
            <TypingGreeting text={mobileGreeting} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function UserDashboard() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, getUserId, getUserName, setWishlistCount, wishlistCount } =
    useAuthStore();
  const { removeId: removeWishlistId, reset: resetWishlistStore } =
    useWishlistStore();
  const userId = getUserId();
  const userName = getUserName();

  const [activeTab, setActiveTab] = useState<
    "overview" | "orders" | "wishlist"
  >("overview");
  const [orderFilter, setOrderFilter] = useState("All");
  const [orderPage, setOrderPage] = useState(1);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const mobileGreeting = "Hey Beautiful";

  useEffect(() => {
    if (!isMobile) return;
    window.scrollTo(0, 0);
  }, [isMobile]);

  const { data: ordersData } = useQuery({
    queryKey: ["dashboard-orders", userId, orderFilter, orderPage],
    queryFn: () =>
      listOrders({
        userProfileId: userId,
        pageSize: 50,
        ...(orderFilter !== "All" ? { state: orderFilter } : {}),
      }),
    enabled: !!userId,
  });

  const { data: overviewOrdersData } = useQuery({
    queryKey: ["dashboard-overview-orders", userId],
    queryFn: () =>
      listOrders({
        userProfileId: userId,
        pageSize: 50,
      }),
    enabled: !!userId,
  });

  const { data: addressData } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    enabled: !!userId,
  });

  const { data: couponsData } = useQuery({
    queryKey: ["coupons", userId],
    queryFn: () => listUserCoupons({ userProfileId: userId }),
    enabled: !!userId,
  });

  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: () => listWishlist({ userProfileId: userId }),
    enabled: !!userId,
  });

  const orders = ordersData?.list ?? ordersData?.data ?? ordersData ?? [];
  const overviewOrders =
    overviewOrdersData?.list ??
    overviewOrdersData?.data ??
    overviewOrdersData ??
    [];
  const totalOrders =
    ordersData?.totalCount ??
    ordersData?.total ??
    (Array.isArray(orders) ? orders.length : 0);
  const addressesSource = addressData as any;
  const couponsSource = couponsData as any;
  const wishlistSource = wishlistData as any;
  const addresses =
    addressesSource?.list ?? addressesSource?.data ?? addressData ?? [];
  const coupons =
    couponsSource?.list ?? couponsSource?.data ?? couponsData ?? [];
  const wishlist =
    wishlistSource?.list ?? wishlistSource?.data ?? wishlistData ?? [];

  const email = (user as any)?.email || (user as any)?.emailId || "";
  const phone = (user as any)?.phoneNumber || (user as any)?.phone || "";
  const profileImageUrl = (user as any)?.profileImageUrl || "";

  const activeCoupons = Array.isArray(coupons)
    ? coupons.filter((c: any) => c.state !== "Expired" && c.state !== "Used")
    : [];
  const transitOrders = (Array.isArray(overviewOrders) ? overviewOrders : [])
    .filter((order: any) => IN_TRANSIT_STATES.has(getOrderStatus(order)))
    .sort((a: any, b: any) => {
      const aTime = new Date(a.orderDate || a.createdDate || 0).getTime();
      const bTime = new Date(b.orderDate || b.createdDate || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 3);

  // Normalize wishlist items for ProductCard
  const wishlistItems = (Array.isArray(wishlist) ? wishlist : []).map(
    (item: any) => {
      const meta = getWishlistDisplayMeta(item.productVariantId);
      return {
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
          item.colorHex ||
          item.colourHex ||
          item.hexCode ||
          meta?.colorHex ||
          "",
        brandName:
          item.brandName ||
          item.brand ||
          item.brandTitle ||
          item.productBrand ||
          meta?.brandName ||
          "",
      };
    },
  );

  useEffect(() => {
    setWishlistCount(wishlistItems.length);
  }, [wishlistItems.length]);

  const handleRemoveWishlist = async (pvId: number) => {
    try {
      await deleteWishlistVariant(pvId);
      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
      removeWishlistId(pvId);
      setWishlistCount(Math.max(0, wishlistCount - 1));
      toast("Removed from wishlist", { icon: "💔" });
    } catch {
      toast.error("Could not remove");
    }
  };

  const TABS = [
    { key: "overview" as const, label: "Overview", icon: "bi-grid-1x2" },
    { key: "orders" as const, label: "My Orders", icon: "bi-bag-check" },
    {
      key: "wishlist" as const,
      label: `Wishlist (${wishlistItems.length})`,
      icon: "bi-heart",
    },
  ];

  if (isMobile) {
    return (
      <div className="s-userdashboar-e04c1b twam-font-body s-userdashboar-mobile-page s-userdashboar-mobile-dashboard">
        <MobileDashboardHero
          userName={userName}
          profileImageUrl={profileImageUrl}
          mobileGreeting={mobileGreeting}
        />

        <div className="stats-grid fade-in s-userdashboar-87744d">
          <StatCard
            icon="bi-bag-check-fill"
            label="Total Orders"
            value={totalOrders || 0}
            onClick={() => navigate("/account/orders-list")}
          />
          <StatCard
            icon="bi-heart-fill"
            label="Wishlist Items"
            value={wishlistItems.length}
            onClick={() => navigate("/account/wishlist")}
          />
          <StatCard
            icon="bi-ticket-perforated-fill"
            label="Active Coupons"
            value={activeCoupons.length}
            onClick={() => navigate("/account/coupons-list")}
          />
          <StatCard
            icon="bi-geo-alt-fill"
            label="Saved Addresses"
            value={(Array.isArray(addresses) ? addresses : []).length}
            onClick={() => navigate("/account/address-list")}
          />
        </div>

        <div className="fade-in s-userdashboar-a66e26 s-userdashboar-cc0420">
          <div className="s-userdashboar-465608 s-userdashboar-4cf32e">
            <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
              <i className="bi bi-truck s-userdashboar-060ee3" />
              Orders In Transit
            </h3>
            <button
              onClick={() => navigate("/account/orders-list")}
              className="s-userdashboar-d098ef"
            >
              View All <i className="bi bi-arrow-right" />
            </button>
          </div>
          {transitOrders.length === 0 ? (
            <div className="s-userdashboar-9326e9">
              <i className="bi bi-truck s-userdashboar-d4db73" />
              <p className="s-userdashboar-46bc26">No orders in transit</p>
            </div>
          ) : (
            transitOrders.map((order: any) => {
              const status = getOrderStatus(order);
              const items = getOrderItems(order);
              const firstImg = items[0]?.productImage || items[0]?.image;
              const stepIdx = getTrackingStepIndex(status);
              return (
                <div
                  key={order.orderId}
                  className="s-userdashboar-0d6b2e s-userdashboar-4cf32e"
                  onClick={() => navigate(`/order-details/${order.orderId}`)}
                >
                  <div className="s-userdashboar-e71c31 s-userdashboar-cc0420">
                    {firstImg ? (
                      <img
                        src={getImageUrl(firstImg, "")}
                        alt=""
                        className="s-userdashboar-4ebae2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="s-userdashboar-d44f74">
                        <i className="bi bi-box s-userdashboar-dcc11e" />
                      </div>
                    )}
                  </div>
                  <div className="s-userdashboar-7aa8c4">
                    <div className="s-userdashboar-8c79a2">
                      <span className="s-userdashboar-2efcea twam-font-body twam-brand">
                        Order #
                        {order.orderNumber || String(order.orderId).slice(-6)}
                      </span>
                      <span className="s-userdashboar-30766a s-userdashboar-8cb9f1">
                        {status}
                      </span>
                    </div>
                    <div className="s-userdashboar-0df734">
                      {items.length} item{items.length !== 1 ? "s" : ""} ·{" "}
                      {formatOrderValue(
                        order.subTotal || order.totalAmount || 0,
                      )}
                    </div>
                    {(order.orderDate || order.createdDate) && (
                      <div className="s-userdashboar-f42419">
                        {formatOrderDate(order.orderDate || order.createdDate)}
                      </div>
                    )}
                    <div className="d-flex align-items-center position-relative mt-3">
                      <div
                        className="s-orderslist-2a0d32"
                        data-active={stepIdx >= 1 ? "true" : "false"}
                      />
                      {TRACKING_STEPS.map((step, i) => (
                        <div
                          key={`${order.orderId}-${step}`}
                          className="s-userdashboar-track-step"
                        >
                          <div
                            className="s-orderslist-bc2f44"
                            data-complete={i <= stepIdx ? "true" : "false"}
                          >
                            {i < stepIdx ? <i className="bi bi-check" /> : ""}
                          </div>
                          <span
                            className="s-orderslist-e909eb"
                            data-current={i === stepIdx ? "true" : "false"}
                          >
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <i className="bi bi-chevron-right s-userdashboar-dd2c58" />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="s-userdashboar-e04c1b twam-font-body">
      {/* ── Welcome Card ── */}
      <div className="fade-in s-userdashboar-774cd3 s-userdashboar-cc0420">
        <div className="s-userdashboar-8a0c3f" />
        <div className="s-userdashboar-f3adca" />

        <div className="s-userdashboar-05d900">
          <div className="s-userdashboar-4bb945">
            <UserAvatar
              name={userName || "User"}
              imageUrl={profileImageUrl}
              size={78}
              fallbackMode="initial"
              className="s-userdashboar-67f9d7"
            />
          </div>
          <div className="s-userdashboar-6d7d28">
            <p className="s-userdashboar-3d0c32 twam-font-body">
              Welcome back,
            </p>
            <h2 className="s-userdashboar-75e420 twam-font-heading twam-brand">
              {userName || "Guest"}
            </h2>
            {email && <p className="s-userdashboar-bc8be4">{email}</p>}
            {phone && <p className="s-userdashboar-a9730b">{phone}</p>}
          </div>
          <button
            onClick={() => navigate("/account/update-profile")}
            className="s-userdashboar-7b7942 twam-font-body"
          >
            <i className="bi bi-pencil" /> Edit Profile
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid fade-in s-userdashboar-87744d">
        <StatCard
          icon="bi-bag-check-fill"
          label="Total Orders"
          value={totalOrders || 0}
          onClick={() => navigate("/account/orders-list")}
        />
        <StatCard
          icon="bi-heart-fill"
          label="Wishlist Items"
          value={wishlistItems.length}
          onClick={() => navigate("/account/wishlist")}
        />
        <StatCard
          icon="bi-ticket-perforated-fill"
          label="Active Coupons"
          value={activeCoupons.length}
          onClick={() => navigate("/account/coupons-list")}
        />
        <StatCard
          icon="bi-geo-alt-fill"
          label="Saved Addresses"
          value={(Array.isArray(addresses) ? addresses : []).length}
          onClick={() => navigate("/account/address-list")}
        />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="dash-tab-bar s-userdashboar-2001f8 s-userdashboar-cc0420">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="s-userdashboar-ff7df3"
            data-active={activeTab === tab.key ? "true" : "false"}
          >
            <i className={`bi ${tab.icon} s-userdashboar-c14ee8`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         OVERVIEW TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="fade-in">
          {/* Quick Actions */}
          <div className="s-userdashboar-a66e26 s-userdashboar-cc0420">
            <div className="s-userdashboar-465608 s-userdashboar-4cf32e">
              <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                <i className="bi bi-truck s-userdashboar-060ee3" />
                Orders In Transit
              </h3>
              <button
                onClick={() => navigate("/account/orders-list")}
                className="s-userdashboar-d098ef"
              >
                View All <i className="bi bi-arrow-right" />
              </button>
            </div>
            {transitOrders.length === 0 ? (
              <div className="s-userdashboar-9326e9">
                <i className="bi bi-truck s-userdashboar-d4db73" />
                <p className="s-userdashboar-46bc26">No orders in transit</p>
              </div>
            ) : (
              transitOrders.map((order: any) => {
                const status = getOrderStatus(order);
                const items = getOrderItems(order);
                const firstImg = items[0]?.productImage || items[0]?.image;
                const stepIdx = getTrackingStepIndex(status);
                return (
                  <div
                    key={order.orderId}
                    className="s-userdashboar-0d6b2e s-userdashboar-4cf32e"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                  >
                    <div className="s-userdashboar-e71c31 s-userdashboar-cc0420">
                      {firstImg ? (
                        <img
                          src={getImageUrl(firstImg, "")}
                          alt=""
                          className="s-userdashboar-4ebae2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="s-userdashboar-d44f74">
                          <i className="bi bi-box s-userdashboar-dcc11e" />
                        </div>
                      )}
                    </div>
                    <div className="s-userdashboar-7aa8c4">
                      <div className="s-userdashboar-8c79a2">
                        <span className="s-userdashboar-2efcea twam-font-body twam-brand">
                          Order #
                          {order.orderNumber || String(order.orderId).slice(-6)}
                        </span>
                        <span className="s-userdashboar-30766a s-userdashboar-8cb9f1">
                          {status}
                        </span>
                      </div>
                      <div className="s-userdashboar-0df734">
                        {items.length} item{items.length !== 1 ? "s" : ""} ·{" "}
                        {formatOrderValue(
                          order.subTotal || order.totalAmount || 0,
                        )}
                      </div>
                      {(order.orderDate || order.createdDate) && (
                        <div className="s-userdashboar-f42419">
                          {formatOrderDate(
                            order.orderDate || order.createdDate,
                          )}
                        </div>
                      )}
                      <div className="d-flex align-items-center position-relative mt-3">
                        <div
                          className="s-orderslist-2a0d32"
                          data-active={stepIdx >= 1 ? "true" : "false"}
                        />
                        {TRACKING_STEPS.map((step, i) => (
                          <div
                            key={`${order.orderId}-${step}`}
                            className="s-userdashboar-track-step"
                          >
                            <div
                              className="s-orderslist-bc2f44"
                              data-complete={i <= stepIdx ? "true" : "false"}
                            >
                              {i < stepIdx ? <i className="bi bi-check" /> : ""}
                            </div>
                            <span
                              className="s-orderslist-e909eb"
                              data-current={i === stepIdx ? "true" : "false"}
                            >
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <i className="bi bi-chevron-right s-userdashboar-dd2c58" />
                  </div>
                );
              })
            )}
          </div>

          {/* Recent Orders Preview */}
          {false && (Array.isArray(orders) ? orders : []).length > 0 && (
            <div className="s-userdashboar-a66e26 s-userdashboar-cc0420">
              <div className="s-userdashboar-465608 s-userdashboar-4cf32e">
                <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                  <i className="bi bi-bag-check-fill s-userdashboar-060ee3" />
                  Recent Orders
                </h3>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="s-userdashboar-d098ef"
                >
                  View All <i className="bi bi-arrow-right" />
                </button>
              </div>
              {(Array.isArray(orders) ? orders.slice(0, 3) : []).map(
                (order: any) => {
                  const status = order.state || order.status || "Pending";
                  const items = order.orderDetails || order.items || [];
                  const firstImg = items[0]?.productImage || items[0]?.image;
                  return (
                    <div
                      key={order.orderId}
                      className="order-row s-userdashboar-e190af s-userdashboar-4cf32e"
                      onClick={() =>
                        navigate(`/order-details/${order.orderId}`)
                      }
                    >
                      <div className="s-userdashboar-d3398b s-userdashboar-cc0420">
                        {firstImg ? (
                          <img
                            src={getImageUrl(firstImg, "")}
                            alt=""
                            className="s-userdashboar-4ebae2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="s-userdashboar-d44f74">
                            <i className="bi bi-box s-userdashboar-af7acb" />
                          </div>
                        )}
                      </div>
                      <div className="s-userdashboar-7aa8c4">
                        <div className="s-userdashboar-8c79a2">
                          <span className="s-userdashboar-4adb1b twam-brand">
                            Order #{String(order.orderId).slice(-6)}
                          </span>
                          <span className="s-userdashboar-0fae25 s-userdashboar-8cb9f1">
                            {status}
                          </span>
                        </div>
                        <div className="s-userdashboar-44a83f">
                          {items.length} item{items.length !== 1 ? "s" : ""} · ₹
                          {order.subTotal || order.totalAmount || 0}
                        </div>
                      </div>
                      <i className="bi bi-chevron-right s-userdashboar-1b3d64" />
                    </div>
                  );
                },
              )}
            </div>
          )}

          {/* Active Coupons Preview */}
          {false && activeCoupons.length > 0 && (
            <div className="s-userdashboar-7a7de1 s-userdashboar-cc0420">
              <div className="s-userdashboar-465608 s-userdashboar-4cf32e">
                <h3 className="s-userdashboar-87c84b twam-font-heading twam-brand">
                  <i className="bi bi-ticket-perforated-fill s-userdashboar-060ee3" />
                  Active Coupons
                </h3>
                <Link
                  to="/account/coupons-list"
                  className="s-userdashboar-f1b322"
                >
                  View All <i className="bi bi-arrow-right" />
                </Link>
              </div>
              <div className="s-userdashboar-e11d61">
                {activeCoupons.slice(0, 4).map((coupon: any, i: number) => (
                  <div key={i} className="s-userdashboar-2e739f">
                    <div className="s-userdashboar-2a4f1e twam-font-heading">
                      {coupon.couponCode || coupon.code}
                    </div>
                    <div className="s-userdashboar-efb0e1">
                      {coupon.discountType === "Percentage"
                        ? `${coupon.discountValue}% off`
                        : `₹${coupon.discountValue} off`}
                    </div>
                    {coupon.minOrderValue && (
                      <div className="s-userdashboar-712b45">
                        Min order ₹{coupon.minOrderValue}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         ORDERS TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="fade-in">
          {/* Order filter pills */}
          <div className="s-userdashboar-e7c84d">
            {ORDER_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setOrderFilter(f);
                  setOrderPage(1);
                }}
                className="s-userdashboar-695b9d"
                data-active={orderFilter === f ? "true" : "false"}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Orders list */}
          <div className="s-userdashboar-8d23e0 s-userdashboar-cc0420">
            {(Array.isArray(orders) ? orders : []).length === 0 ? (
              <div className="s-userdashboar-9326e9">
                <i className="bi bi-bag s-userdashboar-d4db73" />
                <p className="s-userdashboar-46bc26">
                  {orderFilter === "All"
                    ? "No orders yet"
                    : `No ${orderFilter.toLowerCase()} orders`}
                </p>
                <button
                  onClick={() => navigate("/user-products/product-list")}
                  className="s-userdashboar-28646b twam-font-body"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              (Array.isArray(orders) ? orders : []).map((order: any) => {
                const status = order.state || order.status || "Pending";
                const items = order.orderDetails || order.items || [];
                const firstImg = items[0]?.productImage || items[0]?.image;

                return (
                  <div
                    key={order.orderId}
                    className="order-row s-userdashboar-0d6b2e s-userdashboar-4cf32e"
                    onClick={() => navigate(`/order-details/${order.orderId}`)}
                  >
                    <div className="s-userdashboar-e71c31 s-userdashboar-cc0420">
                      {firstImg ? (
                        <img
                          src={getImageUrl(firstImg, "")}
                          alt=""
                          className="s-userdashboar-4ebae2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="s-userdashboar-d44f74">
                          <i className="bi bi-box s-userdashboar-dcc11e" />
                        </div>
                      )}
                    </div>
                    <div className="s-userdashboar-7aa8c4">
                      <div className="s-userdashboar-8c79a2">
                        <span className="s-userdashboar-2efcea twam-font-body twam-brand">
                          Order #{String(order.orderId).slice(-6)}
                        </span>
                        <span className="s-userdashboar-30766a s-userdashboar-8cb9f1">
                          {status}
                        </span>
                      </div>
                      <div className="s-userdashboar-0df734">
                        {items.length} item{items.length !== 1 ? "s" : ""} · ₹
                        {order.subTotal || order.totalAmount || 0}
                      </div>
                      {order.createdDate && (
                        <div className="s-userdashboar-f42419">
                          {new Date(order.createdDate).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </div>
                      )}
                    </div>
                    <i className="bi bi-chevron-right s-userdashboar-dd2c58" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         WISHLIST TAB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "wishlist" && (
        <div className="fade-in">
          {wishlistItems.length === 0 ? (
            <div className="s-userdashboar-3c9868 s-userdashboar-cc0420">
              <div className="s-userdashboar-e898d6">
                <i className="bi bi-heart s-userdashboar-6fa373" />
              </div>
              <h3 className="s-userdashboar-0f293f twam-font-heading">
                Your wishlist is empty
              </h3>
              <p className="s-userdashboar-c65daf">
                Save items you love by clicking the heart icon on any product.
              </p>
              <button
                onClick={() => navigate("/user-products/product-list")}
                className="s-userdashboar-afde5e twam-font-heading"
              >
                <i className="bi bi-arrow-left" /> Browse Products
              </button>
            </div>
          ) : (
            <>
              <div className="s-userdashboar-aee024">
                <p className="s-userdashboar-6f27cc">
                  {wishlistItems.length} saved item
                  {wishlistItems.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => {
                    Promise.all(
                      (Array.isArray(wishlist) ? wishlist : []).map((i: any) =>
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
                    toast.success("Wishlist cleared");
                  }}
                  className="s-userdashboar-b7a17a twam-font-body"
                >
                  <i className="bi bi-trash3" /> Clear all
                </button>
              </div>
              <div className="wl-dash-grid s-userdashboar-03597c">
                {wishlistItems.map((item: any) =>
                  isMobile ? (
                    <MobileProductCard
                      key={item.productVariantId}
                      product={item}
                      onQuickShop={(id) => setQuickShopId(id)}
                    />
                  ) : (
                    <ProductCard
                      key={item.productVariantId}
                      product={item}
                      onQuickShop={(id) => setQuickShopId(id)}
                      singleColorOnly={true}
                      onRemove={() =>
                        handleRemoveWishlist(item.productVariantId)
                      }
                    />
                  ),
                )}
              </div>
            </>
          )}
        </div>
      )}

      {quickShopId && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(null)}
        />
      )}
    </div>
  );
}
