import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCartStore } from "@/features/cart/store/cartStore";
import {
  readCheckoutSession,
  saveCheckoutSession,
} from "@/features/cart/utils/checkoutSession";
import { listDeliveryCharges } from "@/features/cart/api/cart.api";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import type { ShippingOption } from "@/shared/types";
import { getBuyNowSession } from "@/shared/utils/checkoutSession";

const FALLBACK_OPTION: ShippingOption = {
  deliveryChargeId: -1,
  shippingTypeId: 1,
  deliveryCharges: 99,
  isFree: false,
  days: "5-7 business days",
  description: "Delivered within 5-7 business days",
  orderValueRange: null,
  minOrderValue: null,
  isEligible: true,
  unlockAmount: 0,
  shippingType: { shippingTypeId: 1, shippingType: "Standard Delivery" },
  cost: 99,
  name: "Standard Delivery",
  estimatedDays: 5,
};

// Mobile-only free shipping unlock threshold.
const MOBILE_FREE_SHIPPING_THRESHOLD = 5000;

const parseEstimatedDays = (days: string | null | undefined) => {
  const match = String(days || "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
};

export default function ShippingOption() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBuyNow = searchParams.get("buyNow") === "1";
  const isMobile = useIsMobile();
  const {
    setShipping,
    selectedShipping,
    getSelectedItems,
    getSubTotal,
    couponDiscount,
  } = useCartStore();
  const buyNowSession = isBuyNow ? getBuyNowSession() : null;
  const checkoutSession = isBuyNow ? buyNowSession : readCheckoutSession();

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

  const [selectedId, setSelectedId] = useState<number | null>(
    selectedShipping?.deliveryChargeId ??
      checkoutSession?.shipping?.deliveryChargeId ??
      null,
  );

  const { data: shippingOptions = [], isLoading } = useQuery({
    queryKey: ["shipping-options"],
    queryFn: () => listDeliveryCharges(),
    select: (d: any) => d?.list ?? d ?? [],
    staleTime: 10 * 60 * 1000,
  });

  const subTotal = checkoutSession?.subTotal ?? getSubTotal();
  const cartValue = Number(subTotal || 0);
  const checkoutItems = checkoutSession?.items?.length
    ? checkoutSession.items
    : getSelectedItems();
  const normalizedOptions: ShippingOption[] = (
    (shippingOptions as any[]) || []
  ).map((opt: any) => {
    const minOrderValue = Number(opt.minOrderValue ?? 0) || null;
    const baseUnlockAmount = minOrderValue
      ? Math.max(0, minOrderValue - cartValue)
      : 0;
    const mobileFreeShippingLocked =
      isMobile &&
      Boolean(opt.isFree) &&
      cartValue < MOBILE_FREE_SHIPPING_THRESHOLD;
    const mobileFreeShippingUnlockAmount = mobileFreeShippingLocked
      ? Math.max(0, MOBILE_FREE_SHIPPING_THRESHOLD - cartValue)
      : 0;
    const unlockAmount = Math.max(
      baseUnlockAmount,
      mobileFreeShippingUnlockAmount,
    );
    const isEligible =
      (minOrderValue ? cartValue >= minOrderValue : true) &&
      !mobileFreeShippingLocked;
    const deliveryCharges = Number(opt.deliveryCharges ?? 0);

    return {
      deliveryChargeId: opt.deliveryChargeId,
      shippingTypeId: opt.shippingTypeId ?? null,
      deliveryCharges,
      isFree: opt.isFree ?? false,
      days: opt.days ?? null,
      description: opt.description ?? null,
      orderValueRange: opt.orderValueRange ?? null,
      minOrderValue,
      isEligible,
      unlockAmount,
      shippingType: opt.shippingType ?? null,
      cost: opt.isFree ? 0 : deliveryCharges,
      name: opt.shippingType?.shippingType ?? opt.description ?? "Shipping",
      estimatedDays: parseEstimatedDays(opt.days),
    };
  });

  // ── Show only Standard and Free shipping options ─────────────────────────
  // All other types (express, same-day, etc.) are hidden from the checkout UI.
  const visibleOptions = normalizedOptions.filter((opt) => {
    if (opt.isFree) return true;
    const label = (
      opt.shippingType?.shippingType ??
      opt.description ??
      opt.name ??
      ""
    ).toLowerCase();
    return label.includes("standard");
  });

  const selectedOpt =
    visibleOptions.find((opt) => opt.deliveryChargeId === selectedId) ??
    (selectedId === FALLBACK_OPTION.deliveryChargeId ? FALLBACK_OPTION : null);
  const activeSelectedOpt =
    selectedOpt?.isEligible === false ? null : selectedOpt;
  const shippingCost = activeSelectedOpt
    ? activeSelectedOpt.isFree
      ? 0
      : Number(activeSelectedOpt.deliveryCharges ?? 0)
    : 0;
  const total = Math.max(
    0,
    cartValue + shippingCost - Number(couponDiscount || 0),
  );
  const surpriseGift = checkoutSession?.surpriseGift ?? null;
  const canChooseOption = (option: ShippingOption) =>
    option.isEligible !== false;
  const selectedLabel =
    activeSelectedOpt?.shippingType?.shippingType ??
    activeSelectedOpt?.description ??
    "Select shipping";

  const handleContinue = () => {
    if (!activeSelectedOpt) {
      toast.error("Please select a shipping option");
      return;
    }
    const option = activeSelectedOpt;

    setShipping({
      deliveryChargeId: option.deliveryChargeId,
      shippingTypeId: option.shippingTypeId ?? null,
      deliveryCharges: option.isFree ? 0 : option.deliveryCharges ?? 0,
      isFree: option.isFree ?? false,
      days: option.days ?? null,
      description: option.description ?? null,
      orderValueRange: option.orderValueRange ?? null,
      minOrderValue: option.minOrderValue ?? null,
      isEligible: option.isEligible ?? true,
      unlockAmount: option.unlockAmount ?? 0,
      shippingType: option.shippingType ?? null,
      cost: option.isFree ? 0 : option.deliveryCharges ?? 0,
      name:
        option.shippingType?.shippingType ??
        option.description ??
        "Standard Delivery",
      estimatedDays: parseEstimatedDays(option.days),
    });

    saveCheckoutSession({
      mode: isBuyNow ? "buyNow" : "cart",
      items: checkoutItems,
      subTotal,
      shipping: option,
    });

    navigate("/user-products/payment" + (isBuyNow ? "?buyNow=1" : ""));
  };

  const isFallbackSelected = selectedId === FALLBACK_OPTION.deliveryChargeId;

  return (
    <div className="container s-invoice-5c9003 checkout-shell checkout-shell--shipping">
      <div className="row g-4 align-items-start">
        <div className="col-lg-7">
          {isLoading ? (
            <div className="s-shippingopti-9ecba4 checkout-card">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  width: "100%",
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: "16px 18px",
                      borderRadius: 12,
                      border: "1.5px solid var(--ivory)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          className="twam-skel"
                          style={{
                            height: 14,
                            width: "50%",
                            borderRadius: 5,
                            marginBottom: 8,
                          }}
                        />
                        <div
                          className="twam-skel"
                          style={{ height: 12, width: "70%", borderRadius: 5 }}
                        />
                      </div>
                      <div
                        className="twam-skel"
                        style={{ height: 16, width: "20%", borderRadius: 5 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : visibleOptions.length === 0 ? (
            <div
              onClick={() => setSelectedId(FALLBACK_OPTION.deliveryChargeId)}
              className="s-shippingopti-b63dfb checkout-card checkout-card--option"
              style={{
                border: `2px solid ${
                  isFallbackSelected ? "#000000" : "var(--brand)"
                }`,
                background: isFallbackSelected ? "var(--ivory)" : "#fff",
              }}
            >
              <div className="s-adminreports-25c771">
                <div
                  className="s-shippingopti-e0801a"
                  style={{
                    border: `2px solid ${
                      isFallbackSelected ? "#000000" : "var(--brand)"
                    }`,
                    background: isFallbackSelected ? "#000000" : "#fff",
                  }}
                >
                  {isFallbackSelected && <div className="s-payment-108f10" />}
                </div>
                <div className="s-shippingopti-content">
                  <p className="s-shippingopti-b1d3de">Standard Delivery</p>
                  <p className="s-userdashboar-bc8be4">5-7 business days</p>
                </div>
                <span className="s-shippingopti-f0f561 s-shippingopti-price">
                  Rs.99
                </span>
              </div>
            </div>
          ) : (
            visibleOptions.map((opt) => {
              const isSelected =
                selectedId === opt.deliveryChargeId && opt.isEligible !== false;

              return (
                <div
                  key={opt.deliveryChargeId}
                  onClick={() => {
                    if (!canChooseOption(opt)) return;
                    setSelectedId(opt.deliveryChargeId);
                  }}
                  className="s-shippingopti-8cc11b checkout-card checkout-card--option"
                  style={{
                    border: `2px solid ${
                      isSelected ? "#000000" : "var(--brand)"
                    }`,
                    background: isSelected ? "var(--ivory)" : "#fff",
                    opacity: opt.isEligible === false ? 0.72 : 1,
                    cursor: canChooseOption(opt) ? "pointer" : "not-allowed",
                  }}
                >
                  <div className="s-adminreports-25c771">
                    <div
                      className="s-shippingopti-e0801a"
                      style={{
                        border: `2px solid ${
                          isSelected ? "#000000" : "var(--brand)"
                        }`,
                        background: isSelected ? "#000000" : "#fff",
                      }}
                    >
                      {isSelected && <div className="s-payment-108f10" />}
                    </div>
                    <div className="s-shippingopti-content">
                      <p className="s-shippingopti-b1d3de">
                        {opt.shippingType?.shippingType ??
                          opt.description ??
                          "Standard Delivery"}
                      </p>
                      {opt.days && (
                        <p className="s-userdashboar-bc8be4">{opt.days}</p>
                      )}
                      {opt.description && opt.shippingType?.shippingType && (
                        <p className="s-admindashboa-75a6ca">
                          {opt.description}
                        </p>
                      )}
                      {opt.isEligible === false && (
                        <p className="s-admindashboa-75a6ca">
                          Add Rs.
                          {Number(opt.unlockAmount ?? 0).toLocaleString(
                            "en-IN",
                          )}{" "}
                          more to unlock
                        </p>
                      )}
                    </div>
                    <span
                      className="s-shippingopti-d90d13 s-shippingopti-price"
                      style={{ color: opt.isFree ? "var(--brand)" : "#000000" }}
                    >
                      {opt.isFree ? "FREE" : `Rs.${opt.deliveryCharges ?? 0}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="col-lg-5">
          <div className="s-shippingopti-a37762 checkout-card checkout-summary-card">
            <div className="checkout-section-head">
              <h6 className="checkout-section-head__title">Order Summary</h6>
              <p className="checkout-section-head__text">
                A clear breakdown before payment.
              </p>
            </div>
            {[
              {
                label: "Subtotal",
                value: `Rs.${subTotal.toLocaleString("en-IN")}`,
              },
              ...(surpriseGift
                ? [
                    {
                      label: "Surprise Gift",
                      value: "Rs.0",
                      green: true,
                    },
                  ]
                : []),
              {
                label: "Shipping",
                value: activeSelectedOpt
                  ? shippingCost === 0
                    ? "FREE"
                    : `Rs.${shippingCost}`
                  : "Select shipping",
              },
              ...(couponDiscount > 0
                ? [
                    {
                      label: "Discount",
                      value: `-Rs.${couponDiscount.toLocaleString("en-IN")}`,
                    },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="s-shippingopti-7d9011">
                <span className="s-adminbrands-95b451">{label}</span>
                <span
                  style={{
                    color: label === "Discount" ? "var(--heirloom)" : "#000000",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
            <hr className="s-shippingopti-b1485b" />
            <div className="s-shippingopti-a11a00 checkout-summary-total">
              <span>Total</span>
              <span>Rs.{Math.max(0, total).toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="s-addressform-be0342 checkout-actions">
            <button
              onClick={() =>
                navigate(
                  "/user-products/payment-address" +
                    (isBuyNow ? "?buyNow=1" : ""),
                )
              }
              className="s-shippingopti-8d61d8"
            >
              <i className="bi bi-arrow-left me-2" />
              Back
            </button>
            <button onClick={handleContinue} className="s-shippingopti-f6db1e">
              Continue to Payment
              <i className="bi bi-arrow-right ms-2" />
            </button>
          </div>
        </div>
      </div>

      <div
        className="checkout-mobile-action-bar checkout-mobile-action-bar--shipping"
        style={{ display: "none" }}
      >
        <div className="checkout-mobile-action-bar__meta">
          <span className="checkout-mobile-action-bar__badge">
            {activeSelectedOpt ? selectedLabel : "Select shipping"}
          </span>
          <span className="checkout-mobile-action-bar__meta-dot">•</span>
          <span className="checkout-mobile-action-bar__total">
            Rs.{Math.max(0, total).toLocaleString("en-IN")}
          </span>
        </div>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!activeSelectedOpt}
          className="checkout-mobile-action-bar__primary"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}
