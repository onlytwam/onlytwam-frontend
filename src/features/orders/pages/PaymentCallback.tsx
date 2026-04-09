/**
 * src/features/orders/pages/PaymentCallback.tsx
 *
 * PayG redirects the user's browser to our backend /api/Payment/Callback,
 * which processes the result and then redirects to either:
 *
 *   SUCCESS → /user-products/order-confirm/:id?payment=success
 *             (handled by the existing OrderConfirm page — no change needed there)
 *
 *   FAILURE → /user-products/payment-callback?status=failed&orderId=...&code=...&reason=...
 *             (handled by this page)
 *
 *   ERROR   → /user-products/payment-callback?status=error&message=...
 *             (order not found or signature invalid)
 *
 * This component only renders for failure / error cases.
 * On success the backend redirects straight to OrderConfirm, bypassing this page.
 */

import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useCartStore } from "@/features/cart/store/cartStore";
import { useAuthStore } from "@/features/auth/store/authStore";

const REASON_LABELS: Record<string, string> = {
  declined: "Your payment was declined by the bank.",
  failed: "Payment failed. Please try again.",
  cancelled: "You cancelled the payment.",
  timeout: "The payment session timed out.",
  error: "An error occurred while processing your payment.",
};

function friendlyReason(code: string | null, reason: string | null): string {
  if (reason && REASON_LABELS[reason.toLowerCase()]) {
    return REASON_LABELS[reason.toLowerCase()];
  }
  if (code === "2") return "Your payment was declined by the bank.";
  return reason || "Payment could not be completed. Please try again.";
}

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const { clearCart } = useCartStore();
  const { setCartCount } = useAuthStore();

  const status = params.get("status"); // 'failed' | 'error'
  const orderId = params.get("orderId");
  const code = params.get("code");
  const reason = params.get("reason");
  const message = params.get("message");

  // On failure we still clear any stale cart/session data
  useEffect(() => {
    clearCart();
    setCartCount(0);
    localStorage.removeItem("guestCart");
    sessionStorage.removeItem("selectedAddressId");
    sessionStorage.removeItem("guestAddress");
  }, []);

  const heading =
    status === "error" ? "Something went wrong" : "Payment Failed";
  const detail =
    status === "error"
      ? message?.replace(/\+/g, " ") || "We could not process your order."
      : friendlyReason(code, reason);

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 560 }}>
      {/* Icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#fee2e2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
        }}
      >
        <i className="bi bi-x-lg" style={{ fontSize: 32, color: "#dc2626" }} />
      </div>

      <h2 className="fw-bold mb-2">{heading}</h2>
      <p className="text-muted mb-1">{detail}</p>

      {orderId && (
        <p className="text-muted small mb-4">
          Order <strong>#{orderId}</strong> has been saved. You can retry
          payment from your orders page.
        </p>
      )}

      {!orderId && (
        <p className="text-muted small mb-4">
          No order was charged. Your cart is still intact.
        </p>
      )}

      <div className="d-flex gap-3 justify-content-center flex-wrap">
        {orderId ? (
          <>
            <Link to="/user-products/payment" className="btn btn-dark px-4">
              <i className="bi bi-arrow-repeat me-2" />
              Retry Payment
            </Link>
            <Link
              to="/account/orders-list"
              className="btn btn-outline-dark px-4"
            >
              My Orders
            </Link>
          </>
        ) : (
          <>
            <Link to="/user-products/payment" className="btn btn-dark px-4">
              Back to Checkout
            </Link>
            <Link to="/" className="btn btn-outline-dark px-4">
              Continue Shopping
            </Link>
          </>
        )}
      </div>

      <p className="text-muted mt-4 small">
        <i className="bi bi-shield-check me-1" />
        You were not charged. Need help?{" "}
        <Link to="/contact-us" className="text-dark">
          Contact us
        </Link>
      </p>
    </div>
  );
}
