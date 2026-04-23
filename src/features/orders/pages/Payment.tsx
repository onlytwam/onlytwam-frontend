// src/features/orders/pages/Payment.tsx
//
// FIXES APPLIED (APK payment redirect):
//   - Detects Capacitor native platform vs browser
//   - On APK: opens PayG in @capacitor/browser in-app browser
//   - Polls /api/Payment/Status/{orderId} every 2 s until Confirmed/Failed
//   - On browser redirect matching frontend domain: closes browser + navigates
//   - On web: unchanged (window.location.href = paymentProcessUrl)
//   - productVariantId fix from previous session is preserved

import { useEffect, useRef, useState } from "react";
import { getImageUrl } from "@/shared/utils/helpers";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCartStore } from "@/features/cart/store/cartStore";
import {
  createOrder,
  getPaymentStatus,
  listAddress,
} from "@/features/orders/api/orders.api";
import { getBuyNowSession } from "@/shared/utils/checkoutSession";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

// ── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_METHOD = {
  id: "online",
  label: "Online Payment",
  icon: "bi-credit-card",
  desc: "UPI, Credit/Debit Card, Net Banking",
};

/** How often to poll the backend for payment status (ms) */
const POLL_INTERVAL_MS = 2000;
/** Stop polling after this many ms even if still Pending */
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── Component ──────────────────────────────────────────────────────────────

export default function Payment() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const isBuyNow = searchParams.get("buyNow") === "1";

  const { getUserId } = useAuthStore();
  const {
    getSelectedItems,
    getSubTotal,
    selectedShipping,
    couponDiscount,
    appliedCoupon,
  } = useCartStore();

  const userId = getUserId();
  const buyNowSession = isBuyNow ? getBuyNowSession() : null;
  const buyNowItems = buyNowSession?.items?.length ? buyNowSession.items : [];

  // Ref to hold the polling interval so we can clear it from anywhere
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isBuyNow) return;
    const session = getBuyNowSession();
    if (!session?.items?.length) return;
    const store = useCartStore.getState();
    store.setSelectedItems?.(session.items as any);
    store.setSubTotal?.(session.subTotal);
  }, [isBuyNow]);

  const selectedAddressId = Number(
    sessionStorage.getItem("selectedAddressId") || 0,
  );

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    select: (d: any) => d?.list ?? d ?? [],
  });

  const cartSelectedItems = getSelectedItems();
  const selectedItems = buyNowItems.length ? buyNowItems : cartSelectedItems;
  const subTotal = buyNowSession?.subTotal ?? getSubTotal();
  const shippingCost = Number(
    (selectedShipping as any)?.cost ??
      (selectedShipping as any)?.deliveryCharges ??
      0,
  );
  const totalPayable = Math.max(
    0,
    subTotal + shippingCost - (couponDiscount ?? 0),
  );

  const deliveryAddress: any = (addresses as any[]).find(
    (a: any) => a.addressId === selectedAddressId,
  );
  const addrLine = deliveryAddress
    ? [
        deliveryAddress.addressLine,
        deliveryAddress.city,
        deliveryAddress.pinCode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  // ── Native in-app browser payment handler ────────────────────────────────

  /**
   * Opens the PayG URL inside @capacitor/browser (an in-app overlay browser).
   * The React WebView stays alive underneath — we can poll the backend and
   * navigate back into the app as soon as payment completes.
   *
   * @param paymentProcessUrl  URL returned by /Orders (PayG checkout page)
   * @param orderId            Our DB order ID — used to poll /Payment/Status
   */
  const handleNativePayment = async (
    paymentProcessUrl: string,
    orderId: number,
  ) => {
    // Clear any stale polls
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    /** Navigate to order confirm and tear down all listeners */
    const finish = async (success: boolean) => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollRef.current = null;
      pollTimeoutRef.current = null;

      try {
        await Browser.removeAllListeners();
        await Browser.close();
      } catch {
        // Browser may already be closed — safe to ignore
      }

      if (success) {
        navigate(`/user-products/order-confirm/${orderId}?payment=success`, {
          replace: true,
        });
      } else {
        navigate(`/user-products/payment-callback?status=failed`, {
          replace: true,
        });
      }
    };

    /** Check the backend for payment status and resolve if done */
    const checkStatus = async (): Promise<boolean> => {
      try {
        const status = await getPaymentStatus(orderId);
        const state: string = (status?.state ?? "").toLowerCase();
        if (state === "confirmed") {
          await finish(true);
          return true;
        }
        if (state === "failed" || state === "cancelled") {
          await finish(false);
          return true;
        }
      } catch {
        // Network hiccup — keep polling
      }
      return false;
    };

    // Listen for URL changes inside the in-app browser.
    // When PayG redirects back to our Azure frontend, we catch it here
    // and immediately check the backend — no need to wait for the poll tick.
    await Browser.addListener("browserPageLoaded", async () => {
      await checkStatus();
    });

    // When the user manually closes the browser (back button / swipe)
    // do a final status check so we don't leave them stranded.
    await Browser.addListener("browserFinished", async () => {
      const done = await checkStatus();
      if (!done) {
        // Payment still pending — let them know and stop polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        toast.error(
          "Payment not completed. Please try again if you were charged.",
          {
            duration: 6000,
          },
        );
      }
    });

    // Open the payment page in the in-app browser overlay
    await Browser.open({ url: paymentProcessUrl, windowName: "_blank" });

    // Start polling every POLL_INTERVAL_MS as a safety net
    // (browserPageLoaded alone is not always reliable on all Android versions)
    pollRef.current = setInterval(async () => {
      await checkStatus();
    }, POLL_INTERVAL_MS);

    // Hard timeout — stop polling after POLL_TIMEOUT_MS
    pollTimeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      toast.error(
        "Payment verification timed out. Check your orders page for status.",
        { duration: 8000 },
      );
    }, POLL_TIMEOUT_MS);
  };

  // ── Order mutation ───────────────────────────────────────────────────────

  const orderMutation = useMutation({
    mutationFn: (payload: any) => createOrder(payload),
    onSuccess: async (data: any) => {
      if (data?.paymentProcessUrl) {
        if (Capacitor.isNativePlatform()) {
          // APK: open in-app browser and poll for status
          await handleNativePayment(data.paymentProcessUrl, data.orderId);
        } else {
          // Web: existing behaviour — full-page redirect to PayG
          window.location.href = data.paymentProcessUrl;
        }
        return;
      }
      toast.error(
        "Payment integration is not connected yet. The backend did not return a payment URL.",
      );
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.detail ||
          "Failed to start payment. Please try again.",
      ),
  });

  // ── Submit helpers ───────────────────────────────────────────────────────

  const submitPayment = (whatsappUpdates: boolean) => {
    setWhatsappOptIn(whatsappUpdates);

    const cartIds = selectedItems
      .map((i: any) => Number(i.cartId))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    orderMutation.mutate({
      userProfileId: userId,
      subTotal,
      totalAmount: totalPayable,
      deliveryCharge: shippingCost,
      shippingTypeId: (selectedShipping as any)?.shippingTypeId ?? null,
      shippingAddressId: selectedAddressId,
      billingAddressId: selectedAddressId,
      couponId: appliedCoupon?.couponId ?? null,
      couponAmount: couponDiscount ?? 0,
      cartId: cartIds,
      orderNumber: null,
      paymentMethod: "Online Payment",
      isWhatsappNotification: whatsappUpdates,
      orderItems: selectedItems.map((i: any) => ({
        productId: i.productId,
        // FIX: include productVariantId so OrderItems.ProductVariantId is stored in DB.
        productVariantId: i.productVariantId ?? null,
        productVariantDetailId: i.productVariantDetailId,
        quantity: i.processedQuantity || 1,
        price: i.finalPrice,
      })),
    });
  };

  const showWhatsappPrompt = () => {
    toast.custom(
      (t) => (
        <div
          role="dialog"
          aria-label="WhatsApp updates prompt"
          style={{
            width: "min(92vw, 390px)",
            background: "linear-gradient(180deg, #fffdf8 0%, #ffffff 100%)",
            border: "1px solid rgba(107, 15, 42, 0.12)",
            borderRadius: 20,
            boxShadow: "0 24px 60px rgba(107, 15, 42, 0.16)",
            padding: 16,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Dismiss"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "1px solid rgba(107, 15, 42, 0.12)",
              background: "#fff",
              color: "var(--heirloom)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <i className="bi bi-x-lg" />
          </button>

          <div style={{ display: "flex", gap: 12, paddingRight: 36 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(37, 211, 102, 0.14), rgba(37, 211, 102, 0.24))",
                color: "#25d366",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "inset 0 0 0 1px rgba(37, 211, 102, 0.14)",
              }}
            >
              <i className="bi bi-whatsapp" style={{ fontSize: 24 }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--ivory)",
                  color: "var(--brand)",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  marginBottom: 8,
                }}
              >
                <i className="bi bi-chat-dots" />
                WhatsApp updates
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--brand)",
                  lineHeight: 1.35,
                }}
              >
                Do you need WhatsApp updates?
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#6f5e64",
                }}
              >
                We can send your order status and delivery updates there.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                submitPayment(true);
              }}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--brand), #8b143c)",
                color: "#fff",
                padding: "11px 14px",
                fontSize: 14,
                fontWeight: 800,
                fontFamily: "var(--font-body)",
                boxShadow: "0 10px 18px rgba(107, 15, 42, 0.16)",
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                submitPayment(false);
              }}
              style={{
                flex: 1,
                border: "1px solid rgba(107, 15, 42, 0.16)",
                borderRadius: 14,
                background: "#fff",
                color: "var(--brand)",
                padding: "11px 14px",
                fontSize: 14,
                fontWeight: 800,
                fontFamily: "var(--font-body)",
              }}
            >
              No
            </button>
          </div>
        </div>
      ),
      { duration: 30000, position: "top-center" },
    );
  };

  const handleProceedToPayment = () => {
    if (!selectedAddressId) {
      toast.error("Please go back and select a delivery address");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!selectedShipping?.shippingTypeId) {
      toast.error("Please go back and select a shipping option");
      return;
    }
    if (selectedShipping?.isEligible === false) {
      toast.error(
        "Selected shipping option is not available for this order total",
      );
      return;
    }

    if (!whatsappOptIn) {
      if (isMobile) {
        submitPayment(false);
        return;
      }
      showWhatsappPrompt();
      return;
    }

    submitPayment(true);
  };

  const mobileFooterDisabled =
    orderMutation.isPending || selectedItems.length === 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container s-orderdetails-c93f0f checkout-shell checkout-shell--payment">
      <div className="row g-4">
        <div className="col-lg-8">
          {deliveryAddress && (
            <div className="checkout-card checkout-card--address border rounded p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Delivering to</h6>
                <button
                  onClick={() =>
                    navigate(
                      "/user-products/payment-address" +
                        (isBuyNow ? "?buyNow=1" : ""),
                    )
                  }
                  className="btn btn-sm btn-link p-0 text-dark"
                >
                  Change
                </button>
              </div>
              <p className="mb-0 fw-semibold s-addresslist-92985e">
                {deliveryAddress.name}
              </p>
              <p className="mb-0 text-muted s-addresslist-9eec06">{addrLine}</p>
              <p className="mb-0 text-muted s-addresslist-9eec06">
                {deliveryAddress.phone}
              </p>
            </div>
          )}

          <h6 className="mb-3">Payment Method</h6>
          <div
            className="s-payment-f22545 checkout-card checkout-card--payment-method"
            style={{ border: "2px solid #000000", background: "var(--ivory)" }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="s-payment-46e910"
                style={{ border: "2px solid #000000", background: "#000000" }}
              >
                <div className="s-payment-108f10" />
              </div>
              <i className={`bi ${PAYMENT_METHOD.icon} s-payment-bbcbc9`} />
              <div>
                <p className="mb-0 fw-semibold s-addresslist-92985e">
                  {PAYMENT_METHOD.label}
                </p>
                <p className="mb-0 text-muted s-couponslist-030edf">
                  {PAYMENT_METHOD.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="border rounded p-4 position-sticky s-payment-429933 checkout-card checkout-summary-card">
            <div className="checkout-section-head">
              <h6 className="checkout-section-head__title">Order Summary</h6>
              <p className="checkout-section-head__text">
                Everything you are paying for, at a glance.
              </p>
            </div>
            <div className="s-payment-726fa8">
              {selectedItems.map((item: any, i: number) => (
                <div
                  key={i}
                  className="d-flex gap-3 mb-3 checkout-summary-item"
                >
                  <img
                    src={getImageUrl(item.image || item.imageURL)}
                    alt={item.productName || item.name || ""}
                    className="s-payment-c643bf"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/category-bg.png";
                    }}
                  />
                  <div className="checkout-summary-item__body">
                    <p className="mb-0 s-cart-d5c56b">
                      {item.productName || item.name}
                    </p>
                    {(item.color || item.colorName) && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Color: {item.color || item.colorName}
                      </p>
                    )}
                    {(item.size || item.bandSize) && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Band Size: {item.size || item.bandSize}
                      </p>
                    )}
                    {item.cupSize && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Cup Size: {item.cupSize}
                      </p>
                    )}
                    <p className="mb-0 s-userdashboar-4adb1b">
                      Rs.
                      {(
                        item.finalPrice * (item.processedQuantity || 1)
                      ).toLocaleString("en-IN")}{" "}
                      x {item.processedQuantity || 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <hr />
            {[
              {
                label: "Subtotal",
                value: `Rs.${subTotal.toLocaleString("en-IN")}`,
              },
              {
                label: "Shipping",
                value: shippingCost === 0 ? "FREE" : `Rs.${shippingCost}`,
              },
              ...(couponDiscount > 0
                ? [
                    {
                      label: "Coupon",
                      value: `-Rs.${couponDiscount.toLocaleString("en-IN")}`,
                      green: true,
                    },
                  ]
                : []),
            ].map(({ label, value, green }: any) => (
              <div key={label} className="d-flex justify-content-between mb-1">
                <span className="text-muted s-addresslist-9eec06">{label}</span>
                <span
                  className="s-payment-05b8b4"
                  style={{ color: green ? "var(--brand)" : "#000000" }}
                >
                  {value}
                </span>
              </div>
            ))}
            <hr />
            <div className="checkout-summary-total">
              <span>Total Payable</span>
              <span>Rs.{totalPayable.toLocaleString("en-IN")}</span>
            </div>
            {/* WhatsApp opt-in checkbox */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: whatsappOptIn ? "#f0fdf4" : "var(--ivory)",
                border: `1.5px solid ${
                  whatsappOptIn ? "#22c55e" : "var(--ivory)"
                }`,
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                style={{
                  marginTop: 2,
                  accentColor: "#22c55e",
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>
                <i
                  className="bi bi-whatsapp me-1"
                  style={{ color: "#22c55e" }}
                />
                <strong>Keep me updated on my order via WhatsApp</strong>
                <br />
                <span style={{ color: "#666", fontSize: 12 }}>
                  Get real-time shipping &amp; delivery updates on WhatsApp
                  instead of SMS
                </span>
              </span>
            </label>

            <button
              onClick={handleProceedToPayment}
              disabled={orderMutation.isPending || selectedItems.length === 0}
              className="btn btn-dark w-100 d-flex align-items-center justify-content-center gap-2 s-payment-702916"
              style={{ opacity: orderMutation.isPending ? 0.7 : 1 }}
            >
              {orderMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  Starting Payment...
                </>
              ) : (
                <>
                  <i className="bi bi-credit-card" />
                  Proceed to Payment
                </>
              )}
            </button>
            <p className="text-center text-muted mt-2 mb-0 s-addresslist-2c42ad">
              <i className="bi bi-shield-check me-1" />
              Secure and encrypted checkout
            </p>
          </div>
        </div>
      </div>

      <div
        className="checkout-mobile-action-bar checkout-mobile-action-bar--payment"
        style={{ display: "none" }}
      >
        <div className="checkout-mobile-action-bar__meta">
          <span className="checkout-mobile-action-bar__badge">
            Total payable
          </span>
          <span className="checkout-mobile-action-bar__meta-dot">|</span>
          <span className="checkout-mobile-action-bar__total">
            Rs.{totalPayable.toLocaleString("en-IN")}
          </span>
        </div>
        <button
          onClick={handleProceedToPayment}
          disabled={mobileFooterDisabled}
          className="checkout-mobile-action-bar__primary"
        >
          {orderMutation.isPending ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Starting Payment...
            </>
          ) : (
            <>
              <i className="bi bi-credit-card me-2" />
              Proceed to Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
