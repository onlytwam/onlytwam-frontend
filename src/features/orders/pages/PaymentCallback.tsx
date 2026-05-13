/**
 * src/features/orders/pages/PaymentCallback.tsx
 *
 * PayG redirects the user's browser here (or to our backend /api/Payment/Callback
 * which then redirects here) after payment completes.
 *
 *   SUCCESS → ?status=success&orderId=...
 *             Shows "Payment Successful" and navigates to OrderConfirm instantly.
 *             This covers the ✕ / Close button on PayG's success screen — those
 *             buttons skip PayG's 5-second countdown and land here immediately.
 *
 *   FAILURE → ?status=failed&orderId=...&code=...&reason=...
 *   ERROR   → ?status=error&message=...
 */

import { useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { getBuyNowSession } from "@/shared/utils/checkoutSession";

// ── Failure helpers ──────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  declined: "Your payment was declined by the bank.",
  failed: "Payment failed. Please try again.",
  cancelled: "You cancelled the payment.",
  timeout: "The payment window expired before your payment was confirmed.",
  error: "An error occurred while processing your payment.",
};

function friendlyReason(code: string | null, reason: string | null): string {
  if (reason && REASON_LABELS[reason.toLowerCase()]) {
    return REASON_LABELS[reason.toLowerCase()];
  }
  if (code === "2") return "Your payment was declined by the bank.";
  return reason || "Payment could not be completed. Please try again.";
}

// ── Success screen ───────────────────────────────────────────────────────────

function PaymentSuccess({ orderId }: { orderId: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Clean up the pending payment marker we set before the redirect
    sessionStorage.removeItem("pendingPaymentOrderId");

    // Navigate to order confirmation immediately (no artificial delay)
    navigate(`/user-products/order-confirm/${orderId}?payment=success`, {
      replace: true,
    });
  }, [orderId, navigate]);

  // Shown for the brief moment before the navigation fires
  return (
    <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
      {/* Success icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "#dcfce7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
        }}
      >
        <i
          className="bi bi-check-lg"
          style={{ fontSize: 38, color: "#16a34a" }}
        />
      </div>

      <h2 className="fw-bold mb-2">Payment Successful!</h2>
      <p className="text-muted mb-4">
        Your order has been placed. Taking you to your order details…
      </p>

      {/* Subtle spinner so the user knows something is happening */}
      <div
        className="spinner-border text-success"
        role="status"
        style={{ width: 24, height: 24, borderWidth: 2 }}
      >
        <span className="visually-hidden">Redirecting…</span>
      </div>
    </div>
  );
}

// ── Failure screen ───────────────────────────────────────────────────────────

function PaymentFailure({
  status,
  code,
  reason,
  message,
  isBuyNowRetry,
}: {
  status: string | null;
  code: string | null;
  reason: string | null;
  message: string | null;
  isBuyNowRetry: boolean;
}) {
  const isTimeout = reason?.toLowerCase() === "timeout";

  const heading =
    status === "error" ? "Something went wrong" : "Payment Not Completed";
  const detail =
    status === "error"
      ? message?.replace(/\+/g, " ") || "We could not process your order."
      : friendlyReason(code, reason);

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 560 }}>
      {/* Failure icon */}
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

      <p className="text-muted small mb-4">
        <i className="bi bi-shield-check me-1 text-success" />
        {isTimeout
          ? "No order was placed and you were not charged. Your cart is still intact."
          : "No order was placed. You were not charged. Your cart is still intact."}
      </p>

      <div className="d-flex gap-3 justify-content-center flex-wrap">
        <Link
          to={"/user-products/payment" + (isBuyNowRetry ? "?buyNow=1" : "")}
          className="btn btn-dark px-4"
        >
          <i className="bi bi-arrow-repeat me-2" />
          Try Again
        </Link>
        <Link to="/" className="btn btn-outline-dark px-4">
          Continue Shopping
        </Link>
      </div>

      <p className="text-muted mt-4 small">
        Need help?{" "}
        <Link to="/contact-us" className="text-dark">
          Contact us
        </Link>
      </p>
    </div>
  );
}

// ── Root component ───────────────────────────────────────────────────────────

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const isBuyNowRetry = !!getBuyNowSession()?.items?.length;

  const status = params.get("status"); // 'success' | 'failed' | 'error'
  const code = params.get("code");
  const reason = params.get("reason");
  const message = params.get("message");

  // orderId can arrive in the URL from PayG's close/✕ button redirect,
  // or fall back to what we stored in sessionStorage before the same-tab redirect.
  const orderId =
    params.get("orderId") ||
    sessionStorage.getItem("pendingPaymentOrderId") ||
    "";

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  // Handles PayG's ✕ / Close button click after a successful payment.
  // Those buttons skip PayG's 5-second countdown and land here immediately.
  if (status === "success" && orderId) {
    return <PaymentSuccess orderId={orderId} />;
  }

  // ── FAILURE / ERROR ────────────────────────────────────────────────────────
  return (
    <PaymentFailure
      status={status}
      code={code}
      reason={reason}
      message={message}
      isBuyNowRetry={isBuyNowRetry}
    />
  );
}
