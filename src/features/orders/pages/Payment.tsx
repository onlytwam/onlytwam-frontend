// src/features/orders/pages/Payment.tsx
//
// FIXES APPLIED (payment redirect):
//   - Detects Capacitor native platform vs browser
//   - On native: opens PayG in @capacitor/browser in-app browser
//   - On web: opens PayG in a separate popup so the checkout page stays alive
//   - Polls /api/Payment/Status/{orderId} every 2 s until Confirmed/Failed
//   - On close/cancel: keeps polling briefly so a successful payment still lands
//     on the order confirmation page instead of bouncing straight back to checkout
//   - productVariantId fix from previous session is preserved

import { useCallback, useEffect, useRef, useState } from "react";
import { getImageUrl } from "@/shared/utils/helpers";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCartStore } from "@/features/cart/store/cartStore";
import { readCheckoutSession } from "@/features/cart/utils/checkoutSession";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import {
  createOrder,
  getPaymentStatus,
  listAddress,
} from "@/features/orders/api/orders.api";
import { getBuyNowSession } from "@/shared/utils/checkoutSession";
import api from "@/shared/api/axiosInstance";
import { getRememberedAddressState } from "@/shared/utils/addressLocation";

// ── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_METHOD = {
  id: "online",
  label: "Online Payment",
  icon: "bi-credit-card",
  desc: "UPI, Credit/Debit Card, Net Banking",
};

const splitAddressParts = (value: unknown): string[] =>
  String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, part) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.toLowerCase() === part.toLowerCase()) return acc;
      acc.push(part);
      return acc;
    }, []);

const getStateLabelById = (states: any[], stateId: unknown): string => {
  const numericId = Number(stateId);
  if (!Number.isFinite(numericId)) return "";

  const match = states.find(
    (state: any) => Number(state?.stateId ?? state?.id) === numericId,
  );
  return String(match?.stateName ?? match?.name ?? match?.state ?? "").trim();
};

const getSelectedAddressStateLabel = (addr: any, states: any[]): string => {
  const remembered = getRememberedAddressState(addr?.addressId, addr?.pinCode);
  const direct = String(
    addr?.stateName ?? addr?.state ?? remembered?.state ?? "",
  ).trim();
  if (direct) return direct;
  if (remembered?.stateId != null) {
    return getStateLabelById(states, remembered.stateId);
  }
  return getStateLabelById(states, addr?.stateId);
};

const formatSelectedAddress = (addr: any, stateLabel: string): string => {
  const parts = splitAddressParts(addr?.addressLine);
  const locality = String(addr?.locality ?? "").trim();
  const city = String(addr?.city ?? "").trim();
  const pinCode = String(addr?.pinCode ?? "").trim();

  const combined = [...parts];
  const pushPart = (value: string) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return;
    if (combined.some((part) => part.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    combined.push(trimmed);
  };

  pushPart(locality);
  pushPart(city);
  pushPart(stateLabel);
  pushPart(pinCode);

  return combined.join(", ");
};

/** How often to poll the backend for payment status (ms) */
const POLL_INTERVAL_MS = 2000;
/** Stop polling after this many ms even if still Pending */
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
/** Extra grace window after the PayG window closes */
const CLOSE_FALLBACK_MS = 15000;

type WhatsAppConsentToastProps = {
  isMobile?: boolean;
  onYes: () => void;
  onIgnore: () => void;
  onBackdrop?: () => void;
};

function WhatsAppConsentToast({
  isMobile = false,
  onYes,
  onIgnore,
  onBackdrop,
}: WhatsAppConsentToastProps) {
  const content = (
    <>
      <div className="payment-wa-toast__header">
        <div className="payment-wa-toast__icon" aria-hidden="true">
          <i className="bi bi-whatsapp" />
        </div>

        <div className="payment-wa-toast__copy-wrap">
          <div className="payment-wa-toast__eyebrow">WhatsApp updates</div>
          <h3 className="payment-wa-toast__title" id="payment-wa-toast-title">
            Want WhatsApp updates?
          </h3>
          <p className="payment-wa-toast__copy" id="payment-wa-toast-copy">
            We can send your order status and delivery updates on WhatsApp.
          </p>
        </div>
      </div>

      <div className="payment-wa-toast__actions">
        <button
          type="button"
          className="payment-wa-toast__button payment-wa-toast__button--primary"
          onClick={onYes}
        >
          Yes
        </button>
        <button
          type="button"
          className="payment-wa-toast__button payment-wa-toast__button--secondary"
          onClick={onIgnore}
        >
          Ignore
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="payment-wa-modal" role="presentation">
        <button
          type="button"
          className="payment-wa-modal__backdrop"
          aria-label="Dismiss WhatsApp prompt"
          onClick={onBackdrop ?? onIgnore}
        />
        <div className="payment-wa-modal__panel">
          <div
            className="payment-wa-toast payment-wa-toast--mobile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-wa-toast-title"
            aria-describedby="payment-wa-toast-copy"
          >
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="payment-wa-toast"
      role="dialog"
      aria-labelledby="payment-wa-toast-title"
      aria-describedby="payment-wa-toast-copy"
    >
      {content}
    </div>
  );
}

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
  const checkoutSession = isBuyNow ? buyNowSession : readCheckoutSession();
  const checkoutPaymentPath = `/user-products/payment${isBuyNow ? "?buyNow=1" : ""}`;

  // Ref to hold the polling interval so we can clear it from anywhere
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentWindowRef = useRef<Window | null>(null);
  const paymentResolvedRef = useRef(false);
  const whatsappPromptRef = useRef<string | undefined>(undefined);
  const [isWhatsappPromptOpen, setIsWhatsappPromptOpen] = useState(false);
  const [states, setStates] = useState<any[]>([]);

  const clearHostedPaymentTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current);
    pollRef.current = null;
    pollTimeoutRef.current = null;
    closeFallbackRef.current = null;
  }, []);

  const closeDesktopPaymentWindow = useCallback(() => {
    const popup = paymentWindowRef.current;
    paymentWindowRef.current = null;

    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch {
        // Some browsers throw if the popup is already gone.
      }
    }
  }, []);

  const openDesktopPaymentWindow = useCallback(() => {
    if (typeof window === "undefined") return null;

    const existing = paymentWindowRef.current;
    if (existing && !existing.closed) {
      return existing;
    }

    const popup = window.open("", "_blank");
    if (!popup) return null;

    try {
      popup.document.write(`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Preparing payment</title>
            <style>
              html, body {
                margin: 0;
                min-height: 100%;
                background: #ffffff;
                color: #111111;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              }
              body {
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .wrap {
                text-align: center;
                padding: 24px;
              }
              .spinner {
                width: 28px;
                height: 28px;
                margin: 0 auto 14px;
                border: 3px solid rgba(0, 0, 0, 0.12);
                border-top-color: #000000;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
              }
              .title {
                margin: 0 0 8px;
                font-size: 16px;
                font-weight: 600;
              }
              .copy {
                margin: 0;
                font-size: 13px;
                color: rgba(17, 17, 17, 0.68);
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="wrap">
              <div class="spinner" aria-hidden="true"></div>
              <p class="title">Preparing your payment...</p>
              <p class="copy">Please keep this window open while we load the gateway.</p>
            </div>
          </body>
        </html>`);
      popup.document.close();
    } catch {
      // If writing the shell fails, we still keep the popup reference.
    }

    paymentWindowRef.current = popup;
    return popup;
  }, []);

  const dismissDesktopWhatsappPrompt = useCallback(() => {
    if (whatsappPromptRef.current !== undefined) {
      toast.dismiss(whatsappPromptRef.current);
      whatsappPromptRef.current = undefined;
    }
  }, []);

  const closeWhatsappPrompt = useCallback(() => {
    setIsWhatsappPromptOpen(false);
    dismissDesktopWhatsappPrompt();
  }, [dismissDesktopWhatsappPrompt]);

  const armCloseFallback = useCallback(
    (onExpire: () => void | Promise<void>, message = "Payment window closed. Waiting for confirmation...") => {
      if (paymentResolvedRef.current || closeFallbackRef.current) return;

      toast(message, { duration: 4000 });
      closeFallbackRef.current = setTimeout(() => {
        closeFallbackRef.current = null;
        if (paymentResolvedRef.current) return;
        void onExpire();
      }, CLOSE_FALLBACK_MS);
    },
    [],
  );

  useEffect(() => {
    if (!isMobile || !isWhatsappPromptOpen) return;

    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
    };
  }, [isMobile, isWhatsappPromptOpen]);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      clearHostedPaymentTimers();
      closeDesktopPaymentWindow();
      dismissDesktopWhatsappPrompt();
      if (Capacitor.isNativePlatform()) {
        void Browser.removeAllListeners().catch(() => {});
      }
    };
  }, [
    clearHostedPaymentTimers,
    closeDesktopPaymentWindow,
    dismissDesktopWhatsappPrompt,
  ]);

  useEffect(() => {
    const session = isBuyNow ? getBuyNowSession() : readCheckoutSession();
    if (!session?.items?.length) return;
    const store = useCartStore.getState();
    store.setSelectedItems?.(session.items as any);
    store.setSubTotal?.(session.subTotal);
    if (!isBuyNow && session.shipping) {
      store.setShipping?.(session.shipping as any);
    }
  }, [isBuyNow]);

  useEffect(() => {
    api
      .get("/MDM/state", { params: { "Page.Size": 100 } })
      .then((r) => setStates(r.data?.list ?? r.data ?? []))
      .catch(() => {
        // State labels are optional; addressId/pinCode still keep the flow working.
      });
  }, []);

  const selectedAddressId = Number(
    sessionStorage.getItem("selectedAddressId") || 0,
  );

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    select: (d: any) => d?.list ?? d ?? [],
  });

  const cartSelectedItems = getSelectedItems();
  const sessionSelectedItems = checkoutSession?.items?.length
    ? checkoutSession.items
    : [];
  const selectedItems = buyNowItems.length
    ? buyNowItems
    : cartSelectedItems.length
      ? cartSelectedItems
      : sessionSelectedItems;
  const subTotal = checkoutSession?.subTotal ?? getSubTotal();
  const shippingCost = Number(
    (selectedShipping as any)?.cost ?? 
      checkoutSession?.shipping?.cost ??
      (selectedShipping as any)?.deliveryCharges ?? 
      checkoutSession?.shipping?.deliveryCharges ??
      0,
  );
  const totalPayable = Math.max(
    0,
    subTotal + shippingCost - (couponDiscount ?? 0),
  );

  const deliveryAddress: any = (addresses as any[]).find(
    (a: any) => a.addressId === selectedAddressId,
  );
  const deliveryAddressState = deliveryAddress
    ? getSelectedAddressStateLabel(deliveryAddress, states)
    : "";
  const addrLine = deliveryAddress
    ? formatSelectedAddress(deliveryAddress, deliveryAddressState)
    : "";
  const selectedAddressSnapshot = deliveryAddress
    ? {
        ...deliveryAddress,
        state: deliveryAddressState,
        stateName: deliveryAddressState,
        stateId:
          getRememberedAddressState(
            deliveryAddress.addressId,
            deliveryAddress.pinCode,
          )?.stateId ?? deliveryAddress.stateId ?? null,
      }
    : null;

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
    clearHostedPaymentTimers();
    paymentResolvedRef.current = false;

    try {
      await Browser.removeAllListeners();
    } catch {
      // Ignore stale listeners from a previous payment attempt.
    }

    /** Navigate to order confirm and tear down all listeners */
    const finish = async (success: boolean) => {
      if (paymentResolvedRef.current) return;
      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();

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

    const fallbackToCheckout = async () => {
      if (paymentResolvedRef.current) return;
      const done = await checkStatus();
      if (done || paymentResolvedRef.current) return;

      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();

      try {
        await Browser.removeAllListeners();
        await Browser.close();
      } catch {
        // Browser may already be closed — safe to ignore
      }

      toast.error(
        "Payment window closed before confirmation. Returning you to checkout.",
        { duration: 6000 },
      );

      navigate(checkoutPaymentPath, {
        replace: true,
      });
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
    // keep polling briefly so a just-completed payment still lands on order confirm.
    await Browser.addListener("browserFinished", async () => {
      armCloseFallback(fallbackToCheckout);
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
      if (paymentResolvedRef.current) return;
      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();
      void Browser.removeAllListeners().catch(() => {});
      toast.error(
        "Payment verification timed out. Check your orders page for status.",
        { duration: 8000 },
      );
      navigate(checkoutPaymentPath, {
        replace: true,
      });
    }, POLL_TIMEOUT_MS);
  };

  // ── Order mutation ───────────────────────────────────────────────────────

  const handleWebPayment = async (
    paymentProcessUrl: string,
    orderId: number,
  ) => {
    clearHostedPaymentTimers();
    paymentResolvedRef.current = false;

    const finish = async (success: boolean) => {
      if (paymentResolvedRef.current) return;
      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();
      closeDesktopPaymentWindow();

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

    const fallbackToCheckout = async () => {
      if (paymentResolvedRef.current) return;
      const done = await checkStatus();
      if (done || paymentResolvedRef.current) return;

      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();
      closeDesktopPaymentWindow();

      toast.error(
        "Payment window closed before confirmation. Returning you to checkout.",
        { duration: 6000 },
      );

      navigate(checkoutPaymentPath, {
        replace: true,
      });
    };

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
        // Network hiccup - keep polling
      }
      return false;
    };

    const popup = paymentWindowRef.current;
    if (!popup || popup.closed) {
      toast.error("Payment window was closed. Please try again.");
      navigate(checkoutPaymentPath, {
        replace: true,
      });
      return;
    }

    try {
      popup.location.href = paymentProcessUrl;
    } catch {
      closeDesktopPaymentWindow();
      toast.error("Unable to open the payment portal. Please try again.");
      navigate(checkoutPaymentPath, {
        replace: true,
      });
      return;
    }

    pollRef.current = setInterval(async () => {
      const done = await checkStatus();
      if (done || paymentResolvedRef.current) return;

      const currentPopup = paymentWindowRef.current;
      if (currentPopup?.closed) {
        closeDesktopPaymentWindow();
        armCloseFallback(fallbackToCheckout);
      }
    }, POLL_INTERVAL_MS);

    pollTimeoutRef.current = setTimeout(() => {
      if (paymentResolvedRef.current) return;
      paymentResolvedRef.current = true;
      clearHostedPaymentTimers();
      closeDesktopPaymentWindow();

      toast.error(
        "Payment verification timed out. Check your orders page for status.",
        { duration: 8000 },
      );

      navigate(checkoutPaymentPath, {
        replace: true,
      });
    }, POLL_TIMEOUT_MS);
  };

  const orderMutation = useMutation({
    mutationFn: (payload: any) => createOrder(payload),
    onSuccess: async (data: any) => {
      if (data?.paymentProcessUrl) {
        if (Capacitor.isNativePlatform()) {
          // APK: open in-app browser and poll for status
          await handleNativePayment(data.paymentProcessUrl, data.orderId);
        } else {
          // Web: existing behaviour — full-page redirect to PayG
          await handleWebPayment(data.paymentProcessUrl, data.orderId);
        }
        return;
      }
      closeDesktopPaymentWindow();
      toast.error(
        "Payment integration is not connected yet. The backend did not return a payment URL.",
      );
    },
    onError: (e: any) => {
      closeDesktopPaymentWindow();
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.detail ||
          "Failed to start payment. Please try again.",
      );
    },
  });

  // ── Submit helpers ───────────────────────────────────────────────────────

  const submitPayment = (whatsappUpdates: boolean) => {
    setWhatsappOptIn(whatsappUpdates);

    if (!Capacitor.isNativePlatform()) {
      const popup = openDesktopPaymentWindow();
      if (!popup) {
        toast.error("Please allow pop-ups to continue payment.");
        return;
      }
    }

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
      shippingState: deliveryAddressState,
      billingState: deliveryAddressState,
      shippingAddress: selectedAddressSnapshot,
      billingAddress: selectedAddressSnapshot,
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
    if (isMobile) {
      if (isWhatsappPromptOpen) return;
      dismissDesktopWhatsappPrompt();
      setIsWhatsappPromptOpen(true);
      return;
    }

    if (whatsappPromptRef.current !== undefined) return;

    const toastId = toast.custom(
      () => (
        <WhatsAppConsentToast
          isMobile={false}
          onYes={() => {
            setWhatsappOptIn(true);
            closeWhatsappPrompt();
            submitPayment(true);
          }}
          onIgnore={() => {
            closeWhatsappPrompt();
            submitPayment(false);
          }}
        />
      ),
      {
        duration: Infinity,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
          border: "none",
        },
      },
    );

    whatsappPromptRef.current = toastId;
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

      {isMobile && isWhatsappPromptOpen && (
        <WhatsAppConsentToast
          isMobile
          onYes={() => {
            closeWhatsappPrompt();
            setWhatsappOptIn(true);
            submitPayment(true);
          }}
          onIgnore={() => {
            closeWhatsappPrompt();
            submitPayment(false);
          }}
          onBackdrop={closeWhatsappPrompt}
        />
      )}
    </div>
  );
}
