// src/features/orders/pages/OrderConfirm.tsx
//
// Fixes:
//  ① shippingAddress.state → shippingAddress.city only (backend AddressResponse
//    returns {addressLine, city, pinCode, phone, name} — no .state field from
//    the simple _get_address() helper used in get_order_details)
//  ② Show full address line from shippingAddress.addressLine
//  ③ Removed unused navigate import
//  ④ Handle ?payment=pending — polls /Payment/Status until resolved

import { useEffect, useRef, useState } from "react";
import {
  useParams,
  Link,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrderDetail,
  getPaymentStatus,
} from "@/features/orders/api/orders.api";
import { useCartStore } from "@/features/cart/store/cartStore";
import { clearCheckoutSession } from "@/features/cart/utils/checkoutSession";
import { useAuthStore } from "@/features/auth/store/authStore";
import { formatDate } from "@/shared/utils/helpers";
import {
  clearBuyNowSession,
  getBuyNowSession,
} from "@/shared/utils/checkoutSession";

export default function OrderConfirm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const { setCartCount } = useAuthStore();
  const qc = useQueryClient();
  const isBuyNowOrder = !!getBuyNowSession()?.items?.length;
  const paymentSucceeded = searchParams.get("payment") === "success";
  const paymentPending = searchParams.get("payment") === "pending";

  // ── Pending payment polling ────────────────────────────────────────────
  // When PayG's Detail API fails at callback time (race condition), the backend
  // sends the user here with ?payment=pending instead of the error page.
  // We poll /Payment/Status every 3 seconds (up to 2 minutes) until the
  // payment resolves to Confirmed or Failed, then update the URL accordingly.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const MAX_POLLS = 40; // 40 × 3s = 2 minutes
  const [pollMsg, setPollMsg] = useState("Verifying your payment…");

  useEffect(() => {
    if (!paymentPending || !id) return;

    const orderId = Number(id);
    if (!Number.isFinite(orderId)) return;

    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      try {
        const status = await getPaymentStatus(orderId);
        const state = (status?.state ?? "").toLowerCase();
        if (state === "confirmed") {
          clearInterval(pollRef.current!);
          setSearchParams({ payment: "success" }, { replace: true });
          return;
        }
        if (
          state === "payment failed" ||
          state === "failed" ||
          state === "cancelled"
        ) {
          clearInterval(pollRef.current!);
          navigate(
            `/user-products/payment-callback?status=failed&orderId=${orderId}&code=2&reason=declined`,
            { replace: true },
          );
          return;
        }
      } catch {
        // Network hiccup — keep polling
      }

      if (pollCount.current >= MAX_POLLS) {
        clearInterval(pollRef.current!);
        setPollMsg(
          "Taking longer than usual. Check your email or visit My Orders.",
        );
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paymentPending, id, navigate, setSearchParams]);

  // Clear cart only after the backend confirms payment success.
  useEffect(() => {
    if (!paymentSucceeded) return;

    clearCart();
    clearCheckoutSession();
    localStorage.removeItem("pendingBuyNowCartAdd");
    localStorage.removeItem("pendingBuyNowCartAddKey");
    localStorage.removeItem("processedBuyNowCartAddKey");
    if (isBuyNowOrder) {
      clearBuyNowSession();
    } else {
      setCartCount(0);
      localStorage.removeItem("guestCart");
    }
    localStorage.removeItem("guest_token");
    sessionStorage.removeItem("selectedAddressId");
    sessionStorage.removeItem("guestAddress");
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    qc.invalidateQueries({ queryKey: ["quick-cart"] });
  }, [paymentSucceeded, isBuyNowOrder, qc, clearCart, setCartCount]);

  const { data: order } = useQuery({
    queryKey: ["order-confirm", id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id && id !== "new",
    retry: false,
  });

  // Backend returns shippingAddress: { addressId, name, addressLine, city, pinCode, phone }
  // Note: stateName is NOT included in the simple _get_address() helper result.
  // We display city + pinCode which are always present.
  const addr = (order as any)?.shippingAddress;
  const addrLine = addr
    ? [addr.addressLine, addr.city, addr.pinCode].filter(Boolean).join(", ")
    : "";

  // ── Payment pending overlay ─────────────────────────────────────────────
  // Shown when PayG's Detail API couldn't resolve the status at callback time.
  // The polling useEffect above will flip ?payment=pending → success/failure.
  if (paymentPending) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#fef9c3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <i
            className="bi bi-clock-history"
            style={{ fontSize: 36, color: "#ca8a04" }}
          />
        </div>
        <h2 className="fw-bold mb-2">Verifying Payment</h2>
        <p className="text-muted mb-4">{pollMsg}</p>
        <div
          className="spinner-border text-warning"
          role="status"
          style={{ width: 28, height: 28, borderWidth: 3 }}
        >
          <span className="visually-hidden">Checking…</span>
        </div>
        <p className="text-muted mt-4 small">
          This usually takes a few seconds. Please don't close this tab.
        </p>
        <Link to="/user-products/orders" className="btn btn-outline-dark mt-3">
          Check My Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="container s-orderconfirm-9e0ea5">
      {/* Success icon */}
      <div className="s-orderconfirm-2aba39">
        <i className="bi bi-check-lg s-orderconfirm-03029b" />
      </div>

      <h2 className="s-orderconfirm-388feb">Order Placed!</h2>
      <p className="s-orderconfirm-e4337f">
        Thank you for shopping with Only TWAM. Your order has been received and
        is being processed.
      </p>

      {/* Order summary card */}
      {order && (
        <div className="s-orderconfirm-d99ec0">
          <div className="s-orderconfirm-dd3540">
            <div>
              <p className="s-admindashboa-75a6ca">Order Number</p>
              <p className="s-orderconfirm-940150">
                #{(order as any).orderNumber || id}
              </p>
            </div>
            <div className="s-quickcart-f66ceb">
              <p className="s-admindashboa-75a6ca">Order Date</p>
              <p className="s-orderconfirm-c6389e">
                {formatDate(
                  (order as any).orderDate || (order as any).createdAt,
                )}
              </p>
            </div>
          </div>

          {/* Amounts */}
          <div className="s-orderconfirm-3a9663">
            <div className="s-orderconfirm-0b9a8f">
              <span className="s-orderconfirm-9e786f">Total Amount</span>
              <span className="s-orderconfirm-5c2925">
                ₹{((order as any).totalAmount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            {(order as any).deliveryCharge !== undefined && (
              <div className="s-orderconfirm-39c60a">
                <span className="s-quickcart-08341f">Shipping</span>
                <span className="s-addresslist-9eec06">
                  {(order as any).deliveryCharge === 0
                    ? "FREE"
                    : `₹${(order as any).deliveryCharge}`}
                </span>
              </div>
            )}
          </div>

          {/* Delivery address — use only fields returned by backend */}
          {addr && (
            <div style={{ marginTop: 16 }}>
              <p className="s-admininvento-b153ec">Delivering to</p>
              <p className="s-orderconfirm-c6389e">
                <strong>{addr.name}</strong>
              </p>
              <p
                className="s-orderconfirm-c6389e"
                style={{ color: "#666", marginTop: 2 }}
              >
                {addrLine}
              </p>
              {addr.phone && (
                <p
                  className="s-orderconfirm-c6389e"
                  style={{ color: "#666", marginTop: 2 }}
                >
                  📞 {addr.phone}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Email notice */}
      <div className="s-orderconfirm-98b39a">
        <p className="s-orderconfirm-ac3361">
          <i className="bi bi-envelope me-2" />A confirmation email will be sent
          to your registered email address.
        </p>
      </div>

      {/* Actions */}
      <div className="s-orderconfirm-2138f5">
        <Link to="/account/orders-list" className="s-orderconfirm-8dd047">
          <i className="bi bi-bag me-2" />
          Track Order
        </Link>
        {id && id !== "new" && (
          <Link
            to={`/user-products/invoice-details/${id}`}
            className="s-orderconfirm-e3c8b5"
          >
            <i className="bi bi-file-earmark-text me-2" />
            View Invoice
          </Link>
        )}
        <Link to="/" className="s-orderconfirm-e3c8b5">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
