// Fixed:
// - order.state not order.status
// - order.address (list) not order.shippingAddress
// - item.productImage not item.image
// - order.subTotal / deliveryCharge / couponAmount (not subtotalAmount / shippingAmount / discountAmount)
// - orderId is a number, not sliceable — use String()
// - Invoice route: /user-products/invoice-details/:id
// - Return route: store orderId in sessionStorage then navigate to return-order
// - Cancel mutation now calls the actual CancelOrder API

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { listOrders } from "@/features/orders/api/orders.api";
import { formatPrice, getImageUrl, slugify } from "@/shared/utils/helpers";
import api from "@/shared/api/axiosInstance";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

const ORDER_PAGE_SIZE = 10;

const ORDER_SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "amount_desc", label: "Amount: High to Low" },
  { value: "amount_asc", label: "Amount: Low to High" },
];

// Maps every backend state → the simplified label shown to the customer
function getDisplayStatus(
  state: string,
): "Order Placed" | "Payment Failed" | "Delivered" | "Cancelled" | "Returned" {
  switch (state) {
    case "Failed":
      return "Payment Failed";
    case "Delivered":
      return "Delivered";
    case "Cancelled":
      return "Cancelled";
    case "Returned":
    case "Return Initiated":
    case "Refunded":
      return "Returned";
    // Pending / Confirmed / Processing / Shipped / AwaitingPayment → Order Placed
    default:
      return "Order Placed";
  }
}

const ORDER_STATUS_TONES: Record<
  string,
  { background: string; color: string; borderColor: string }
> = {
  "Order Placed": {
    background: "var(--blush)",
    color: "var(--white)",
    borderColor: "var(--blush)",
  },
  "Payment Failed": {
    background: "#c0392b",
    color: "var(--white)",
    borderColor: "#c0392b",
  },
  Delivered: {
    background: "var(--ivory)",
    color: "var(--brand)",
    borderColor: "var(--brand)",
  },
  Cancelled: {
    background: "var(--brand)",
    color: "var(--white)",
    borderColor: "var(--brand)",
  },
  Returned: {
    background: "var(--ivory)",
    color: "var(--heirloom)",
    borderColor: "var(--heirloom)",
  },
};

function getOrderItemsList(order: any): any[] {
  return order?.orderItems || order?.orderDetails || order?.items || [];
}

function getOrderDateValue(order: any): string | Date | undefined {
  return order?.orderDate || order?.createdDate || order?.createdAt;
}

function formatOrderDateTime(value: string | Date | undefined): string {
  if (!value) return "No date available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

function getOrderStatusTone(state: string) {
  const display = getDisplayStatus(state);
  return ORDER_STATUS_TONES[display] || ORDER_STATUS_TONES["Order Placed"];
}

function getBuyAgainHref(item: any): string {
  const variantId = item?.productVariantId || item?.productVariantDetailId;
  const name = item?.productName || item?.name || "product";

  if (variantId) {
    return `/user-products/product-detail/${variantId}/${slugify(name)}`;
  }

  return "/user-products/product-list";
}

function OrderSummaryCard({ order }: { order: any }) {
  const items = getOrderItemsList(order);
  const firstItem = items[0] || {};
  const state = order?.state || "Pending";
  const orderNumber =
    order?.orderNumber || String(order?.orderId || "").slice(-8);
  const placedOn = formatOrderDateTime(getOrderDateValue(order));
  const productName = firstItem.productName || firstItem.name || "Order item";
  const productImage =
    firstItem.productImage || firstItem.image || firstItem.imageURL || "";
  const imageSrc = getImageUrl(productImage, "/assets/category-bg.png");
  const qty = Number(firstItem.quantity || 1);
  const unitPrice = Number(firstItem.price || 0);
  const meta = [
    firstItem.color ? `Color ${firstItem.color}` : "",
    firstItem.size ? `Size ${firstItem.size}` : "",
    firstItem.cupSize ? `Cup ${firstItem.cupSize}` : "",
  ].filter(Boolean);
  const moreItems =
    items.length > 1
      ? `+${items.length - 1} more item${items.length - 1 === 1 ? "" : "s"}`
      : "";
  const statusTone = getOrderStatusTone(state);
  const displayLabel = getDisplayStatus(state);

  return (
    <article className="orders-card">
      <div className="orders-card__top">
        <div className="orders-card__top-left">
          <span
            className="orders-status-pill"
            style={{
              background: statusTone.background,
              color: statusTone.color,
              borderColor: statusTone.borderColor,
            }}
          >
            {displayLabel}
          </span>
          <span className="orders-card__placed">Placed on {placedOn}</span>
        </div>

        <div className="orders-card__number">Order No: {orderNumber}</div>
      </div>

      <div className="orders-card__body">
        <div className="orders-card__thumb">
          {productImage ? (
            <img
              src={imageSrc}
              alt={productName}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith("/assets/category-bg.png")) {
                  target.src = "/assets/category-bg.png";
                }
              }}
            />
          ) : (
            <i className="bi bi-bag orders-card__thumb-placeholder" />
          )}
        </div>

        <div className="orders-card__info">
          <h3 className="orders-card__title">{productName}</h3>

          <div className="orders-card__meta">
            {meta.map((value) => (
              <span key={value}>{value}</span>
            ))}
            <span>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            {moreItems && <span>{moreItems}</span>}
          </div>

          <div className="orders-card__price">
            <span>{formatPrice(unitPrice)}</span>
            <span className="orders-card__price-qty">Qty {qty}</span>
          </div>
        </div>

        <div className="orders-card__actions">
          <Link
            to={getBuyAgainHref(firstItem)}
            className="orders-card__button orders-card__button--primary"
          >
            Buy it again
          </Link>
          <Link
            to={`/order-details/${order.orderId}`}
            className="orders-card__button orders-card__button--secondary"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function OrdersList() {
  const isMobile = useIsMobile();
  const { getUserId } = useAuthStore();
  const userId = getUserId();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<
    "latest" | "oldest" | "amount_desc" | "amount_asc"
  >("latest");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", userId, page],
    queryFn: () =>
      listOrders({
        userProfileId: userId,
        pageNumber: page,
        pageSize: ORDER_PAGE_SIZE,
      }),
    enabled: !!userId,
  });

  const orders = (Array.isArray(data?.list) ? data.list : []).filter(
    (o: any) => o.state !== "AwaitingPayment",
  );
  const totalCount = data?.count ?? orders.length;

  const sortedOrders = [...orders].sort((a: any, b: any) => {
    const aTime = new Date(getOrderDateValue(a) || 0).getTime();
    const bTime = new Date(getOrderDateValue(b) || 0).getTime();
    const aAmount = Number(a?.totalAmount || a?.subTotal || 0);
    const bAmount = Number(b?.totalAmount || b?.subTotal || 0);

    switch (sortBy) {
      case "oldest":
        return aTime - bTime;
      case "amount_desc":
        return bAmount - aAmount;
      case "amount_asc":
        return aAmount - bAmount;
      case "latest":
      default:
        return bTime - aTime;
    }
  });

  if (isLoading) {
    return (
      <div className="orders-page">
        <style>{`@keyframes twam-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: "20px 16px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,.07)",
              marginBottom: 14,
              animation: "twam-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  background: "#ece6da",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 13,
                    width: "55%",
                    background: "#ece6da",
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    height: 11,
                    width: "35%",
                    background: "#ece6da",
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    height: 11,
                    width: "20%",
                    background: "#ece6da",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div
                style={{
                  width: 72,
                  height: 26,
                  borderRadius: 999,
                  background: "#ece6da",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / ORDER_PAGE_SIZE));

  return (
    <div className="orders-page">
      <div
        className={`orders-page__header${
          isMobile ? " orders-page__header--mobile" : ""
        }`}
      >
        {!isMobile && <h2 className="orders-page__title">My Orders</h2>}

        <div className="orders-page__sort">
          <label htmlFor="orders-sort" className="orders-page__sort-label">
            Sort by
          </label>
          <select
            id="orders-sort"
            className="orders-page__select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setPage(1);
            }}
          >
            {ORDER_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedOrders.length === 0 ? (
        <div className="orders-empty">
          <div className="orders-empty__icon">
            <i className="bi bi-bag-x" />
          </div>
          <h3 className="orders-empty__title">No orders found</h3>
          <p className="orders-empty__text">
            Your order history will appear here.
          </p>
          <Link
            to="/user-products/product-list"
            className="orders-card__button orders-card__button--primary"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="orders-page__list">
          {sortedOrders.map((order: any) => (
            <OrderSummaryCard key={order.orderId} order={order} />
          ))}
        </div>
      )}

      {totalCount > ORDER_PAGE_SIZE && (
        <div className="orders-pagination">
          <button
            type="button"
            className="orders-pagination__button"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <i className="bi bi-chevron-left" />
          </button>
          <button
            type="button"
            className="orders-pagination__button orders-pagination__button--active"
          >
            {page}
          </button>
          <button
            type="button"
            className="orders-pagination__button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}

const ORDER_FILTERS = [
  "All",
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Refunded",
  "Return Initiated",
  "Returned",
  "Failed",
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "var(--brand)",
  Confirmed: "var(--brand)",
  Processing: "var(--brand)",
  Shipped: "#06b6d4",
  Delivered: "var(--brand)",
  Cancelled: "var(--brand)",
  Refunded: "var(--heirloom)",
  Failed: "var(--brand)",
  "Return Initiated": "var(--brand)",
  Returned: "var(--heirloom)",
};

const TRACKING_STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="badge s-orderslist-6d2b17"
      style={{ background: STATUS_COLORS[status] || "var(--heirloom)" }}
    >
      {status || "Pending"}
    </span>
  );
}

function TrackingStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="d-flex flex-column align-items-center s-app-52dcac">
      <div
        className="s-orderslist-bc2f44"
        style={{
          background: done || active ? "var(--brand)" : "var(--ivory)",
          color: done || active ? "#fff" : "var(--heirloom)",
        }}
      >
        {done ? <i className="bi bi-check" /> : ""}
      </div>
      <span
        className="s-orderslist-e909eb"
        style={{
          color: active ? "#000000" : "var(--heirloom)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function LegacyOrdersListExpanded() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { getUserId } = useAuthStore();
  const userId = getUserId();

  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", userId, activeFilter, page],
    queryFn: () =>
      listOrders({
        userProfileId: userId,
        status: activeFilter !== "All" ? activeFilter : undefined,
        pageNumber: page,
        pageSize,
      }),
    enabled: !!userId,
  });

  // FIX: cancel order calls the actual API
  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason: string }) =>
      api
        .post("/Orders/CancelOrder", { orderId, isRefund: false, reason })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      qc.invalidateQueries({ queryKey: ["orders"] });
      setCancelModal(null);
      setCancelReason("");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to cancel order"),
  });

  const orders = (Array.isArray(data?.list) ? data.list : []).filter(
    (o: any) => o.state !== "AwaitingPayment",
  );
  const totalCount = data?.count ?? orders.length;

  const fmt = (d: string) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";
  const price = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  if (isLoading)
    return (
      <div>
        <style>{`@keyframes twam-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: "18px 16px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,.07)",
              marginBottom: 12,
              animation: "twam-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <div style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 10,
                  background: "#ece6da",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 13,
                    width: "50%",
                    background: "#ece6da",
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    height: 11,
                    width: "30%",
                    background: "#ece6da",
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    height: 11,
                    width: "18%",
                    background: "#ece6da",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div
                style={{
                  width: 70,
                  height: 24,
                  borderRadius: 999,
                  background: "#ece6da",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );

  const sortedOrders = [...orders].sort((a: any, b: any) => {
    const aTime = new Date(
      a.orderDate || a.createdDate || a.createdAt || 0,
    ).getTime();
    const bTime = new Date(
      b.orderDate || b.createdDate || b.createdAt || 0,
    ).getTime();
    return bTime - aTime;
  });

  return (
    <>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">My Orders</h5>
          <span className="text-muted s-addresslist-9eec06">
            {totalCount} orders
          </span>
        </div>

        {/* Filter chips */}
        <div className="d-flex gap-2 overflow-auto pb-2 mb-4 s-orderslist-62a809">
          {ORDER_FILTERS.map((f) => (
            <button
              key={f}
              className={`btn btn-sm text-nowrap ${
                activeFilter === f ? "btn-dark" : "btn-outline-secondary"
              } s-orderslist-7f63b9`}
              onClick={() => {
                setActiveFilter(f);
                setPage(1);
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {sortedOrders.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-bag-x s-orderslist-94e3bd" />
            <p className="text-muted">No orders found.</p>
            <Link
              to="/user-products/product-list"
              className="btn btn-dark btn-sm"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          sortedOrders.map((order: any) => {
            const isExpanded = expandedId === order.orderId;
            // FIX: use order.state not order.status
            const state = order.state || "Pending";
            const stepIdx = TRACKING_STEPS.indexOf(state);

            return (
              <div key={order.orderId} className="card border mb-3 shadow-sm">
                {/* Header */}
                <div
                  className="card-header d-flex align-items-center justify-content-between s-orderslist-f7c942"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : order.orderId)
                  }
                >
                  <div>
                    {/* FIX: orderId is a number — use String() before slice */}
                    <span className="fw-semibold s-addresslist-92985e">
                      Order #
                      {order.orderNumber || String(order.orderId).slice(-8)}
                    </span>
                    <span className="text-muted ms-3 s-couponslist-030edf">
                      {fmt(
                        order.orderDate || order.createdDate || order.createdAt,
                      )}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <StatusBadge status={state} />
                    <span className="fw-bold">{price(order.totalAmount)}</span>
                    <i
                      className={`bi ${
                        isExpanded ? "bi-chevron-up" : "bi-chevron-down"
                      }`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="card-body p-3">
                    {/* Tracking timeline */}
                    {!["Cancelled", "Failed", "Refunded"].includes(state) && (
                      <div className="mb-4">
                        <div className="d-flex align-items-center position-relative">
                          <div
                            className="s-orderslist-2a0d32"
                            style={{
                              background:
                                stepIdx >= 1 ? "var(--brand)" : "var(--ivory)",
                            }}
                          />
                          {TRACKING_STEPS.map((step, i) => (
                            <TrackingStep
                              key={step}
                              label={step}
                              done={i < stepIdx}
                              active={i === stepIdx}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Order items */}
                    {(order.orderItems || []).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="d-flex gap-3 mb-3 pb-3 border-bottom"
                      >
                        {/* FIX: item.productImage not item.image */}
                        <img
                          src={item.productImage || item.image}
                          alt={item.productName}
                          className="s-orderslist-777a95"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/assets/images/placeholder.jpg";
                          }}
                        />
                        <div className="flex-fill">
                          <p className="mb-1 fw-semibold s-addresslist-92985e">
                            {item.productName}
                          </p>
                          <div className="d-flex gap-1 flex-wrap mb-1">
                            {item.size && (
                              <span className="badge bg-light text-dark s-addresslist-2c42ad">
                                Size: {item.size}
                              </span>
                            )}
                            {item.cupSize && (
                              <span className="badge bg-light text-dark s-addresslist-2c42ad">
                                Cup: {item.cupSize}
                              </span>
                            )}
                            {item.color && (
                              <span className="badge bg-light text-dark s-orderslist-77c86b">
                                <span
                                  className="s-orderslist-f987b1"
                                  style={{
                                    background: resolveHex(
                                      item.colorHex ?? item.color,
                                    ),
                                  }}
                                />
                                {item.colorName ?? item.color}
                              </span>
                            )}
                          </div>
                          <p className="mb-0 text-muted s-addresslist-9eec06">
                            {price(item.price)} × {item.quantity}={" "}
                            <strong>
                              {price((item.price || 0) * (item.quantity || 1))}
                            </strong>
                          </p>
                        </div>
                        {state === "Delivered" && item.isReturnAvailable && (
                          <button
                            className="btn btn-sm btn-outline-secondary align-self-start s-couponslist-030edf"
                            onClick={() => {
                              sessionStorage.setItem(
                                "returnOrderId",
                                String(order.orderId),
                              );
                              navigate("/user-products/return-order");
                            }}
                          >
                            Return
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Totals + address */}
                    <div className="border-top pt-3 mt-1">
                      <div className="row">
                        <div className="col-md-6">
                          {/* FIX: list view uses order.address not order.shippingAddress */}
                          {order.address && (
                            <div>
                              <p className="mb-1 fw-semibold s-addresslist-9eec06">
                                Delivery Address
                              </p>
                              <p className="text-muted mb-0 s-couponslist-030edf">
                                {order.address.name}
                                <br />
                                {order.address.addressLine},{" "}
                                {order.address.city}
                                <br />
                                {order.address.pinCode}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="col-md-6 text-md-end mt-3 mt-md-0">
                          <table className="ms-auto s-addresslist-9eec06">
                            <tbody>
                              {/* FIX: use subTotal / deliveryCharge / couponAmount — not subtotalAmount / shippingAmount / discountAmount */}
                              <tr>
                                <td className="text-muted pe-4">Subtotal</td>
                                <td>{price(order.subTotal)}</td>
                              </tr>
                              {order.deliveryCharge >= 0 && (
                                <tr>
                                  <td className="text-muted pe-4">Shipping</td>
                                  <td>
                                    {order.deliveryCharge === 0
                                      ? "FREE"
                                      : price(order.deliveryCharge)}
                                  </td>
                                </tr>
                              )}
                              {order.couponAmount > 0 && (
                                <tr>
                                  <td className="text-success pe-4">
                                    Discount
                                  </td>
                                  <td className="text-success">
                                    −{price(order.couponAmount)}
                                  </td>
                                </tr>
                              )}
                              <tr>
                                <td className="fw-bold pe-4">Total</td>
                                <td className="fw-bold">
                                  {price(order.totalAmount)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="d-flex gap-2 flex-wrap mt-3 pt-2 border-top">
                      {/* FIX: invoice route is /user-products/invoice-details/:id */}
                      <Link
                        to={`/user-products/invoice-details/${order.orderId}`}
                        className="btn btn-sm btn-outline-dark"
                      >
                        <i className="bi bi-file-earmark-text me-1" />
                        Invoice
                      </Link>

                      {["Pending", "Confirmed"].includes(state) && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setCancelModal(order)}
                        >
                          <i className="bi bi-x-circle me-1" />
                          Cancel Order
                        </button>
                      )}

                      {state === "Delivered" && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            sessionStorage.setItem(
                              "returnOrderId",
                              String(order.orderId),
                            );
                            navigate("/user-products/return-order");
                          }}
                        >
                          <i className="bi bi-arrow-return-left me-1" />
                          Return / Exchange
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <span className="btn btn-sm btn-dark">{page}</span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page * pageSize >= totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        )}

        {/* Cancel modal */}
        {cancelModal && (
          <div className="modal fade show s-orderslist-854786">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Cancel Order #
                    {cancelModal.orderNumber || cancelModal.orderId}
                  </h5>
                  <button
                    className="btn-close"
                    onClick={() => setCancelModal(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="text-muted mb-3">
                    Please tell us why you're cancelling:
                  </p>
                  <select
                    className="form-select"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  >
                    <option value="">Select a reason</option>
                    {[
                      "Changed my mind",
                      "Found a better price",
                      "Ordered by mistake",
                      "Delivery taking too long",
                      "Other",
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setCancelModal(null)}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={!cancelReason || cancelMutation.isPending}
                    onClick={() =>
                      cancelMutation.mutate({
                        orderId: cancelModal.orderId,
                        reason: cancelReason,
                      })
                    }
                  >
                    {cancelMutation.isPending
                      ? "Cancelling…"
                      : "Confirm Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
