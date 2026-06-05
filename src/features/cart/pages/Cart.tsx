/**
 * Cart.tsx
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCartStore } from "@/features/cart/store/cartStore";
import {
  listCart,
  updateCart,
  deleteCartItem,
  checkOutOfStock,
  listCoupons,
} from "@/features/cart/api/cart.api";
import {
  listUserCoupons,
  validatePhysicalCoupon,
  markDigitalCouponUsed,
  markPhysicalCouponUsed,
} from "@/features/orders/api/orders.api";
import { getImageUrl, slugify } from "@/shared/utils/helpers";
import {
  colorFamilyHexOf,
  FALLBACK_COLOR_FAMILY_HEX,
} from "@/shared/utils/colorHelpers";

import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { createWishlist } from "@/features/products/api/products.api";
import {
  clearBuyNowSession,
  getBuyNowSession,
  setBuyNowSession,
} from "@/shared/utils/checkoutSession";
import {
  clearCheckoutSession,
  readCheckoutSession,
  saveCheckoutSession,
  SURPRISE_GIFT_FLOW_VERSION,
} from "@/features/cart/utils/checkoutSession";
import {
  buildSurpriseGiftSignature,
  getSurpriseGiftSelectionSync,
  prefetchSurpriseGiftTiers,
  type SurpriseGiftSelection,
} from "@/shared/utils/surpriseGift";
import type { CouponModel } from "@/shared/types";

/** Merge duplicate cart rows that share the same productVariantDetailId */
function mergeCartDuplicates(rawItems: any[]): any[] {
  const seen = new Map<string, any>();
  const order: string[] = [];
  for (const item of rawItems) {
    const key =
      item.productVariantDetailId != null
        ? String(item.productVariantDetailId)
        : `cart-${item.cartId}`;
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      const addedQty =
        Number(item.processedQuantity) || Number(item.quantity) || 1;
      existing.processedQuantity = (existing.processedQuantity || 1) + addedQty;
      existing.quantity = existing.processedQuantity;
      existing._extraCartIds = [...(existing._extraCartIds ?? []), item.cartId];
    } else {
      seen.set(key, {
        ...item,
        processedQuantity:
          Number(item.processedQuantity) || Number(item.quantity) || 1,
      });
      order.push(key);
    }
  }
  return order.map((k) => seen.get(k)!);
}

const GuestCart = {
  get: (): any[] => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]");
    } catch {
      return [];
    }
  },
  set: (items: any[]) => {
    localStorage.setItem("guestCart", JSON.stringify(items));
    window.dispatchEvent(new Event("guestCartUpdated"));
  },
  remove: (pvdId: number) =>
    GuestCart.set(
      GuestCart.get().filter((i: any) => i.productVariantDetailId !== pvdId),
    ),
  updateQty: (pvdId: number, qty: number) =>
    GuestCart.set(
      GuestCart.get().map((i: any) =>
        i.productVariantDetailId === pvdId
          ? { ...i, processedQuantity: qty, quantity: qty }
          : i,
      ),
    ),
};

const normalizeBuyNowItems = (items: any[] = []) =>
  items.map((item: any) => {
    const processedQuantity =
      Number(item.processedQuantity ?? item.quantity ?? 1) || 1;

    return {
      ...item,
      isSelected: item.isSelected ?? true,
      processedQuantity,
      quantity: processedQuantity,
      finalPrice: Number(item.finalPrice || item.price) || 0,
    };
  });

function SurpriseGiftToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 300,
        padding: "28px 20px 22px",
        borderRadius: 22,
        background: "linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)",
        border: "1px solid rgba(107,15,42,0.14)",
        boxShadow: "0 20px 48px rgba(107,15,42,0.18)",
        textAlign: "center",
      }}
    >
      {/* ── Close × ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          border: "none",
          background: "transparent",
          color: "var(--heirloom, #9e6070)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
          zIndex: 2,
        }}
      >
        <i className="bi bi-x-lg" />
      </button>

      {/* ── Gift image ── */}
      <img
        src="/assets/Gift.png"
        alt="Surprise gift"
        style={{
          width: 120,
          height: 120,
          objectFit: "contain",
          marginBottom: 14,
          filter: "drop-shadow(0 8px 20px rgba(107,15,42,0.18))",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* ── Text ── */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--brand, #6b0f2a)",
          lineHeight: 1.35,
        }}
      >
        You won a surprise gift!
      </div>
    </div>
  );
}

function SurpriseGiftReminderToast({
  remainingAmount,
  threshold,
  onDismiss,
}: {
  remainingAmount: number;
  threshold: number;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        minWidth: 0,
        maxWidth: 380,
        padding: "14px 16px",
        borderRadius: 18,
        background: "linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)",
        border: "1px solid rgba(107,15,42,0.14)",
        boxShadow: "0 18px 36px rgba(107,15,42,0.16)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(145deg, #9e6070, #6b0f2a)",
          color: "#fff",
          boxShadow: "0 10px 22px rgba(107,15,42,0.18)",
          flexShrink: 0,
        }}
      >
        <i className="bi bi-gift-fill" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--heirloom)",
            marginBottom: 2,
          }}
        >
          Gift reminder
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.45,
            color: "var(--brand)",
            marginBottom: 4,
          }}
        >
          Shop more for Rs.{remainingAmount.toLocaleString("en-IN")} to win an
          exciting gift
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--heirloom)",
            opacity: 0.9,
          }}
        >
          The surprise unlocks at Rs.{threshold.toLocaleString("en-IN")} and
          above.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss reminder"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--heirloom)",
          cursor: "pointer",
          fontSize: 15,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        <i className="bi bi-x-lg" />
      </button>
    </div>
  );
}

function SurpriseGiftCard() {
  return <FancySurpriseGiftCard />;
  return (
    <div
      className="s-cart-100fbc"
      style={{
        marginTop: 16,
        borderStyle: "dashed",
        background:
          "linear-gradient(135deg, rgba(245,240,230,0.96), rgba(255,255,255,0.98))",
        boxShadow: "0 12px 30px rgba(107,15,42,0.08)",
        overflow: "hidden",
        alignItems: "stretch",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            width: 96,
            height: 96,
            flexShrink: 0,
            borderRadius: 18,
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(245,240,230,0.92) 55%, rgba(231,214,219,0.9) 100%)",
            border: "1px solid rgba(107,15,42,0.14)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: 16,
              background: "linear-gradient(145deg, #6b0f2a 0%, #9e6070 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 12,
              bottom: 12,
              width: 16,
              transform: "translateX(-50%)",
              borderRadius: 8,
              background: "linear-gradient(180deg, #f5f0e6, #fff)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: "50%",
              height: 16,
              transform: "translateY(-50%)",
              borderRadius: 8,
              background: "linear-gradient(180deg, #f5f0e6, #fff)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.2)",
            }}
          />
          <i
            className="bi bi-gift-fill"
            style={{
              position: "relative",
              zIndex: 1,
              color: "#fff",
              fontSize: 34,
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.2))",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ✨
          </div>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h6 className="s-cart-04af82" style={{ marginBottom: 0 }}>
            Surprise Gift
          </h6>
        </div>
      </div>

      <div
        className="s-cart-4c5975"
        style={{ alignItems: "flex-end", justifyContent: "center" }}
      >
        <span className="s-cart-abec22">FREE</span>
        <span className="s-cart-c7ed91" style={{ opacity: 0.55 }}>
          🎁
        </span>
      </div>
    </div>
  );
}

type StockIssue = {
  id: string;
  name: string;
  requested: number;
  available: number;
  item: any;
};

function StockValidationToast({
  issues,
  onReduce,
  onDismiss,
}: {
  issues: StockIssue[];
  onReduce: (issue: StockIssue) => void;
  onDismiss: () => void;
}) {
  const [localIssues, setLocalIssues] = useState(issues);

  useEffect(() => {
    setLocalIssues(issues);
  }, [issues]);

  useEffect(() => {
    if (localIssues.length > 0) return;
    const t = setTimeout(onDismiss, 200);
    return () => clearTimeout(t);
  }, [localIssues.length, onDismiss]);

  const reduceQty = (issue: StockIssue) => {
    onReduce(issue);
    const nextRequested = Math.max(1, issue.requested - 1);
    if (nextRequested <= issue.available) {
      setLocalIssues((prev) => prev.filter((i) => i.id !== issue.id));
      return;
    }

    setLocalIssues((prev) =>
      prev.map((i) =>
        i.id === issue.id ? { ...i, requested: nextRequested } : i,
      ),
    );
  };

  return (
    <div
      style={{
        width: "min(460px, calc(100vw - 32px))",
        padding: 18,
        borderRadius: 20,
        border: "1px solid rgba(107, 15, 42, 0.16)",
        background: "linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)",
        boxShadow: "0 20px 48px rgba(107,15,42,0.18)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(145deg, #9e6070, #6b0f2a)",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--brand)",
              marginBottom: 8,
            }}
          >
            Some items need a quantity update
          </div>
          <div
            style={{ fontSize: 13, color: "var(--heirloom)", marginBottom: 12 }}
          >
            The following products have less stock than the quantity in your
            cart.
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            {localIssues.map((issue) => (
              <div
                key={issue.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "#fff",
                  border: "1px solid rgba(107,15,42,0.10)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <img
                    src={getImageUrl(issue.item.image || issue.item.imageURL)}
                    alt={issue.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    style={{
                      width: 56,
                      height: 68,
                      objectFit: "cover",
                      borderRadius: 12,
                      flexShrink: 0,
                      background: "#f5f0e6",
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#2c1c22",
                        marginBottom: 4,
                      }}
                    >
                      {issue.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--heirloom)" }}>
                      Requested {issue.requested}, only {issue.available}{" "}
                      available
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => reduceQty(issue)}
                    disabled={issue.requested <= 1}
                    aria-label={`Reduce ${issue.name} quantity`}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: "none",
                      background: "var(--brand)",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: issue.requested <= 1 ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      opacity: issue.requested <= 1 ? 0.5 : 1,
                    }}
                  >
                    −
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            style={{
              border: "none",
              borderRadius: 10,
              background: "var(--brand)",
              color: "#fff",
              padding: "10px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function FancySurpriseGiftCard() {
  return (
    <div
      style={{
        position: "relative",
        marginTop: 16,
        marginBottom: 12,
        padding: "14px 16px",
        borderRadius: 20,
        border: "1px solid rgba(107, 15, 42, 0.14)",
        background:
          "linear-gradient(135deg, rgba(255, 250, 244, 0.98) 0%, rgba(247, 236, 229, 0.96) 58%, rgba(255, 255, 255, 0.98) 100%)",
        boxShadow: "0 16px 32px rgba(107, 15, 42, 0.1)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        cursor: "default",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -18,
            width: 84,
            height: 84,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(182, 109, 127, 0.14), transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -22,
            bottom: -28,
            width: 104,
            height: 104,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(107, 15, 42, 0.08), transparent 72%)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          minWidth: 0,
          flex: "1 1 240px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            width: "clamp(74px, 18vw, 92px)",
            height: "clamp(74px, 18vw, 92px)",
            flexShrink: 0,
            borderRadius: 24,
            background:
              "linear-gradient(145deg, rgba(255, 251, 247, 0.98), rgba(242, 228, 214, 0.95))",
            border: "1px solid rgba(107, 15, 42, 0.12)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.88), 0 10px 20px rgba(107, 15, 42, 0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 11,
              borderRadius: 18,
              background:
                "linear-gradient(180deg, #9e6070 0%, #7f1d37 55%, #5f0d27 100%)",
              boxShadow: "inset 0 -8px 14px rgba(0,0,0,0.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 11,
              bottom: 11,
              width: 15,
              transform: "translateX(-50%)",
              borderRadius: 999,
              background: "linear-gradient(180deg, #fff7ee, #f0dcc2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 11,
              right: 11,
              top: "50%",
              height: 15,
              transform: "translateY(-50%)",
              borderRadius: 999,
              background: "linear-gradient(180deg, #fff7ee, #f0dcc2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 7,
              left: "50%",
              width: 26,
              height: 16,
              transform: "translateX(-50%)",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, rgba(255, 248, 238, 0.98), rgba(240, 220, 190, 0.98))",
              boxShadow: "0 3px 8px rgba(107, 15, 42, 0.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              width: 14,
              height: 14,
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background:
                "linear-gradient(180deg, rgba(255, 254, 250, 0.98), rgba(237, 216, 189, 0.98))",
              boxShadow: "0 1px 0 rgba(107, 15, 42, 0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 13,
              width: 18,
              height: 12,
              borderRadius: "12px 14px 12px 10px",
              background:
                "linear-gradient(180deg, rgba(255, 248, 238, 0.98), rgba(236, 214, 184, 0.98))",
              transform: "rotate(-24deg)",
              boxShadow: "0 1px 0 rgba(107, 15, 42, 0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 13,
              width: 18,
              height: 12,
              borderRadius: "14px 12px 10px 12px",
              background:
                "linear-gradient(180deg, rgba(255, 248, 238, 0.98), rgba(236, 214, 184, 0.98))",
              transform: "rotate(24deg)",
              boxShadow: "0 1px 0 rgba(107, 15, 42, 0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "rgba(214, 166, 179, 0.95)",
              boxShadow:
                "-10px 8px 0 0 rgba(255, 255, 255, 0.92), -18px -4px 0 0 rgba(214, 166, 179, 0.55)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 11,
              left: 11,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "rgba(214, 166, 179, 0.8)",
              boxShadow:
                "10px -6px 0 0 rgba(255, 255, 255, 0.88), 17px 4px 0 0 rgba(214, 166, 179, 0.45)",
            }}
          />
          <i
            className="bi bi-gift-fill"
            style={{
              position: "relative",
              zIndex: 1,
              color: "rgba(255,255,255,0.96)",
              fontSize: "clamp(26px, 5vw, 34px)",
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.2))",
            }}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h6
            className="s-cart-04af82"
            style={{
              marginBottom: 0,
              fontSize: "clamp(15px, 1.45vw, 18px)",
              lineHeight: 1.2,
            }}
          >
            Surprise Gift
          </h6>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 6,
          flexShrink: 0,
          minWidth: 72,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          className="s-cart-abec22"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.68)",
            border: "1px solid rgba(107, 15, 42, 0.1)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          FREE
        </span>
        <span
          style={{
            fontSize: 14,
            color: "var(--heirloom)",
            opacity: 0.7,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          <i className="bi bi-gift-fill" />
        </span>
      </div>
    </div>
  );
}

const text = (value: unknown) => String(value ?? "").trim();
const upper = (value: unknown) => text(value).toUpperCase();

const getCouponCode = (coupon: any) =>
  upper(coupon?.couponCode ?? coupon?.code ?? coupon?.coupon_code);

const getCouponDiscountType = (coupon: any) =>
  text(coupon?.discountType ?? coupon?.discount_type ?? coupon?.type);

const getCouponDiscountValue = (coupon: any) => {
  const raw =
    coupon?.discountValue ??
    coupon?.discount ??
    coupon?.discountAmount ??
    coupon?.value ??
    coupon?.amount;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCouponMinOrderValue = (coupon: any) => {
  const raw =
    coupon?.minOrderValue ??
    coupon?.minOrderAmount ??
    coupon?.minOrder ??
    coupon?.minimumOrderValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getCouponMaxDiscountAmount = (coupon: any) => {
  const raw =
    coupon?.maxDiscountAmount ?? coupon?.maxDiscount ?? coupon?.discountCap;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const isCouponExpired = (coupon: any) => {
  if (coupon?.isExpire === true) return true;
  const state = text(coupon?.state).toLowerCase();
  if (["expired", "used", "inactive", "rejected"].includes(state)) return true;

  const now = Date.now();
  const start = coupon?.startDate ? new Date(coupon.startDate).getTime() : NaN;
  const end = coupon?.endDate ? new Date(coupon.endDate).getTime() : NaN;

  if (Number.isFinite(start) && start > now) return true;
  if (Number.isFinite(end) && end < now) return true;
  return false;
};

const isCouponActive = (coupon: any) => coupon?.isActive !== false;

const getCouponDisplayDiscount = (coupon: any) => {
  const type = getCouponDiscountType(coupon).toLowerCase();
  const value = getCouponDiscountValue(coupon);
  if (value <= 0) return "Special offer";
  if (type === "percentage" || (!type && value <= 100)) {
    return `${value}% off`;
  }
  return `₹${value.toLocaleString("en-IN")} off`;
};

const calculateCouponDiscountAmount = (coupon: any, subTotal: number) => {
  const rawValue = getCouponDiscountValue(coupon);
  if (!Number.isFinite(rawValue) || rawValue <= 0 || subTotal <= 0) return 0;

  const type = getCouponDiscountType(coupon).toLowerCase();
  let discountAmount =
    type === "percentage" || (!type && rawValue <= 100)
      ? Math.round((subTotal * rawValue) / 100)
      : rawValue;

  const maxDiscount = getCouponMaxDiscountAmount(coupon);
  if (maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  return Math.max(0, Math.min(discountAmount, subTotal));
};

const getCouponUnlockAmount = (coupon: any, subTotal: number) => {
  const minOrderValue = getCouponMinOrderValue(coupon);
  if (!minOrderValue || subTotal >= minOrderValue) return 0;
  return minOrderValue - subTotal;
};

const normalizeCouponResponse = (payload: any): CouponModel[] => {
  const list = Array.isArray(payload)
    ? payload
    : payload?.list ?? payload?.data ?? payload?.items ?? [];
  return Array.isArray(list) ? list : [];
};

type CouponSource = "profile" | "general";

type DisplayCoupon = CouponModel & {
  source: CouponSource;
};

type CouponOption = {
  coupon: DisplayCoupon;
  code: string;
  displayDiscount: string;
  unlockAmount: number;
  canApplyNow: boolean;
};

const isGeneralCoupon = (coupon: any) =>
  coupon?.isCommon === true || !text(coupon?.toUserProfileId);

function getCartItemQuantity(item: any) {
  return Number(item?.processedQuantity ?? item?.quantity ?? 1) || 1;
}

function getCartItemMatchKey(item: any) {
  return item?.productVariantDetailId ?? item?.productVariantId ?? item?.cartId;
}

function getItemStockQuantity(item: any) {
  const stock = Number(item?.stockQuantity);
  return Number.isFinite(stock) && stock >= 0 ? stock : null;
}

function getOutOfStockProducts(payload: any): any[] {
  const list =
    payload?.outOfStockProducts ??
    payload?.data?.outOfStockProducts ??
    payload?.detail?.outOfStockProducts ??
    [];
  return Array.isArray(list) ? list : [];
}

function getBackendStockIssues(products: any[], items: any[]): StockIssue[] {
  return products.map((product) => {
    const productVariantDetailId = product?.productVariantDetailId;
    const item =
      items.find(
        (current) =>
          String(current?.productVariantDetailId) ===
          String(productVariantDetailId),
      ) ?? {};
    const available = Number(product?.stockQuantity);

    return {
      id: String(
        productVariantDetailId ??
          item.cartId ??
          item.productVariantDetailId ??
          item.productVariantId,
      ),
      name:
        product?.productName ||
        item.productName ||
        item.name ||
        "Unnamed product",
      requested: getCartItemQuantity(item),
      available: Number.isFinite(available) && available >= 0 ? available : 0,
      item,
    } satisfies StockIssue;
  });
}

function isAuthFailure(error: any) {
  const status = Number(error?.response?.status);
  return status === 401 || status === 403;
}

function updateMergedCartItems(
  items: any[],
  item: any,
  desiredTotalQty: number,
) {
  const matchKey = getCartItemMatchKey(item);
  if (matchKey == null) {
    // No usable key at all — try cartId, then give up gracefully.
    return {
      nextItems: items.map((current) =>
        item.cartId != null && current.cartId === item.cartId
          ? {
              ...current,
              processedQuantity: desiredTotalQty,
              quantity: desiredTotalQty,
            }
          : current,
      ),
      targetCartId: item.cartId as number | null,
      targetQty: desiredTotalQty,
    };
  }

  const matches = items.filter((current) => {
    const currentKey = getCartItemMatchKey(current);
    return currentKey != null && currentKey === matchKey;
  });

  if (matches.length <= 1) {
    const targetCartId = matches[0]?.cartId ?? item.cartId ?? null;
    // For guest items there is no cartId — fall back to matching by matchKey
    // (productVariantDetailId) so the quantity update actually lands.
    return {
      nextItems: items.map((current) => {
        const isTarget =
          targetCartId != null
            ? current.cartId === targetCartId
            : getCartItemMatchKey(current) === matchKey;
        return isTarget
          ? {
              ...current,
              processedQuantity: desiredTotalQty,
              quantity: desiredTotalQty,
            }
          : current;
      }),
      targetCartId,
      targetQty: desiredTotalQty,
    };
  }

  const targetRow =
    matches.reduce((best, current) =>
      getCartItemQuantity(current) >= getCartItemQuantity(best)
        ? current
        : best,
    ) ?? matches[0];

  const otherTotal =
    matches.reduce((sum, current) => sum + getCartItemQuantity(current), 0) -
    getCartItemQuantity(targetRow);
  const targetQty = desiredTotalQty - otherTotal;

  if (targetQty < 1) {
    return {
      nextItems: items.filter((current) => current.cartId !== targetRow.cartId),
      targetCartId: targetRow.cartId as number | null,
      targetQty: 0,
    };
  }

  return {
    nextItems: items.map((current) =>
      current.cartId === targetRow.cartId
        ? {
            ...current,
            processedQuantity: targetQty,
            quantity: targetQty,
          }
        : current,
    ),
    targetCartId: targetRow.cartId as number | null,
    targetQty,
  };
}

function getStockIssues(items: any[]): StockIssue[] {
  return items
    .map((item) => {
      const available = getItemStockQuantity(item);
      const requested = Number(item?.processedQuantity || item?.quantity || 1);
      if (available === null || requested <= available) return null;

      return {
        id: String(
          item.cartId ?? item.productVariantDetailId ?? item.productVariantId,
        ),
        name: item.productName || item.name || "Unnamed product",
        requested,
        available,
        item,
      } satisfies StockIssue;
    })
    .filter(Boolean) as StockIssue[];
}

function showStockIssuesPopup(
  issues: StockIssue[],
  onReduce: (issue: StockIssue) => void,
) {
  toast.custom(
    (t) => (
      <StockValidationToast
        issues={issues}
        onReduce={onReduce}
        onDismiss={() => toast.dismiss(t.id)}
      />
    ),
    {
      duration: 7000,
      style: {
        background: "transparent",
        boxShadow: "none",
        padding: 0,
        border: "none",
      },
    },
  );
}

function SaveForLater({
  item,
  onRemoveFromCart,
}: {
  item: any;
  onRemoveFromCart: () => void;
}) {
  const { inWishlist, toggle } = useWishlistToggle(item.productVariantId);

  const handleSaveForLater = () => {
    if (!inWishlist) {
      toggle({
        productId: item.productId,
        productVariantId: item.productVariantId,
        productVariantDetailId: item.productVariantDetailId,
        name: item.productName || item.name,
        price: item.finalPrice,
        oldPrice: item.mrpPrice,
        image: item.image || item.imageURL,
        color: item.color,
      });
    }
    onRemoveFromCart();
  };

  return (
    <button
      onClick={handleSaveForLater}
      title="Save for later"
      className="s-cart-be1587"
    >
      <i className="bi bi-bookmark-fill s-addresslist-9eec06" />
      Save for later
    </button>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prevPath =
    (location.state as any)?.from ||
    sessionStorage.getItem("lastPage") ||
    "/user-products/product-list";
  const isBuyNowView = searchParams.get("buyNow") === "1";
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();
  const {
    appliedCoupon,
    couponDiscount,
    selectedShipping,
    setCoupon,
    removeCoupon,
    setPhysicalCouponCode,
    physicalCouponCode,
  } = useCartStore();

  const userId = getUserId();
  const isAuth = hasValidToken() && Boolean(userId);
  const [buyNowItems, setBuyNowItems] = useState<any[]>(() =>
    isBuyNowView ? normalizeBuyNowItems(getBuyNowSession()?.items ?? []) : [],
  );

  // ── Inactive-category checkout gate ──────────────────────────────────────
  // When user clicks checkout and some selected items belong to an inactive
  // category, we show a popup asking them to remove or save-for-later first.
  const [inactiveCategoryItems, setInactiveCategoryItems] = useState<any[]>([]);
  const [showInactiveCategoryModal, setShowInactiveCategoryModal] =
    useState(false);

  const { data: cartData, isLoading } = useQuery({
    queryKey: ["cart", userId],
    queryFn: () => listCart({ userProfileId: userId }),
    enabled: isAuth && !isBuyNowView,
    staleTime: 60_000,
    // Override the global refetchOnMount:false — the cart MUST re-fetch when
    // the page mounts after an item was added from another page, because
    // invalidateQueries only schedules a background refetch for mounted queries;
    // unmounted queries just get marked stale and need refetchOnMount:true to
    // actually fetch when this page opens.
    refetchOnMount: true,
    select: (data: any) =>
      (data?.list ?? data ?? []).map((item: any) => ({
        ...item,
        // NOTE: isSelected is intentionally NOT set here.
        // Selection state is merged in the useEffect below using authItemsRef,
        // which preserves deselections the user made across refetches.
        // Hardcoding isSelected:true here overrides user choices on every
        // refetch and is the root cause of unordered items appearing in invoices.
        finalPrice: Number(item.finalPrice || item.price) || 0,
        processedQuantity: Number(item.quantity) || 1,
      })),
  });

  const [authItems, setAuthItems] = useState<any[]>([]);
  // Ref that always holds the latest authItems so the cartData sync
  // useEffect can read current selection state without needing authItems
  // in its dependency array (which would cause infinite loops).
  const authItemsRef = useRef<any[]>([]);
  useEffect(() => {
    authItemsRef.current = authItems;
  }, [authItems]);

  // FIX: Explicit set of cartIds the user has manually deselected.
  // This survives React re-renders and cartData refetches.
  // When cartData arrives (or re-arrives), we use this set to ensure
  // previously-deselected items are never silently re-selected.
  const manuallyDeselectedCartIds = useRef<Set<number>>(new Set());
  const [guestItems, setGuestItems] = useState<any[]>([]);
  const [cartItemsHydrated, setCartItemsHydrated] = useState(false);
  // Dynamically loaded from SurpriseGiftRule table — no hardcoded values
  const [minGiftThreshold, setMinGiftThreshold] = useState<number | null>(null);

  // Prefetch gift tiers once on mount so sync lookup works immediately
  useEffect(() => {
    prefetchSurpriseGiftTiers().then((tiers) => {
      if (tiers.length > 0) {
        // Lowest threshold a gift can appear at
        const min = Math.min(...tiers.map((t) => t.threshold));
        setMinGiftThreshold(min);
      } else {
        // No active rules in SurpriseGiftRule table → feature is entirely off.
        // Wipe any stale gift that may have been saved in the checkout session
        // from a previous visit (e.g., rules were deleted after user loaded cart).
        setMinGiftThreshold(Infinity);
        setGiftUnlocked(false);

        // Scrub the persisted gift without destroying the rest of the session.
        try {
          const sess = isBuyNowView
            ? getBuyNowSession()
            : readCheckoutSession();
          if (sess?.surpriseGift) {
            if (isBuyNowView) {
              setBuyNowSession(sess.items as any, {
                shipping: sess.shipping,
                surpriseGift: null,
                giftCheckoutKey: null,
                cgstTotal: (sess as any).cgstTotal ?? 0,
                sgstTotal: (sess as any).sgstTotal ?? 0,
              });
            } else {
              saveCheckoutSession({
                ...sess,
                surpriseGift: null,
                giftCheckoutKey: null,
              });
            }
          }
        } catch {
          // Non-fatal: session cleanup is best-effort
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [couponInput, setCouponInput] = useState("");
  const [isCouponDropdownOpen, setIsCouponDropdownOpen] = useState(false);
  const [stockTipItemId, setStockTipItemId] = useState<string | null>(null);
  // physicalCouponCode & setPhysicalCouponCode come from cartStore destructure above

  const { data: profileCoupons = [], isLoading: isProfileCouponsLoading } =
    useQuery({
      queryKey: ["cart-profile-coupons", userId],
      queryFn: async () => {
        if (!userId) return [];
        const res = await listUserCoupons({ userProfileId: String(userId) });
        return normalizeCouponResponse(res);
      },
      enabled: isAuth && Boolean(userId),
      staleTime: 5 * 60 * 1000,
    });

  const { data: generalCoupons = [], isLoading: isGeneralCouponsLoading } =
    useQuery({
      queryKey: ["cart-general-coupons"],
      queryFn: async () => {
        const res = await listCoupons({
          "Page.Size": 200,
          "Order.Property": "CreatedDate",
          "Order.Ascending": false,
        });
        return normalizeCouponResponse(res).filter(isGeneralCoupon);
      },
      staleTime: 5 * 60 * 1000,
    });

  useEffect(() => {
    setCartItemsHydrated(false);

    if (isBuyNowView) {
      setAuthItems([]);
      setGuestItems([]);
      setBuyNowItems(normalizeBuyNowItems(getBuyNowSession()?.items ?? []));
      setCartItemsHydrated(true);
      return;
    }

    if (isAuth) {
      if (cartData !== undefined) {
        // ── FIX: preserve user's deselections across refetches ───────────────
        // We use TWO sources for deselection state (most reliable wins):
        //  1. manuallyDeselectedCartIds ref — explicit user clicks, immune to
        //     React re-render timing and cartData refetch race conditions.
        //  2. authItemsRef — current in-memory state, fallback for items
        //     not yet in the explicit deselection set.
        const prevSelectionMap = new Map(
          authItemsRef.current.map((i: any) => [i.cartId, i.isSelected]),
        );
        const merged = cartData.map((item: any) => {
          const cartIdNum = Number(item.cartId);
          // If user explicitly deselected this item, always keep it deselected.
          if (manuallyDeselectedCartIds.current.has(cartIdNum)) {
            return { ...item, isSelected: false };
          }
          // Otherwise preserve existing state; default new items to selected.
          return {
            ...item,
            isSelected: prevSelectionMap.has(item.cartId)
              ? prevSelectionMap.get(item.cartId)
              : true,
          };
        });
        setAuthItems(merged);
        setCartItemsHydrated(true);
      }
      return;
    }

    setAuthItems([]);
    setGuestItems(
      GuestCart.get().map((i: any) => ({ ...i, isSelected: true })),
    );
    setCartItemsHydrated(true);
  }, [cartData, isAuth, isBuyNowView]);
  useEffect(() => {
    if (!isBuyNowView) {
      setBuyNowItems([]);
      return;
    }

    setBuyNowItems(normalizeBuyNowItems(getBuyNowSession()?.items ?? []));
  }, [isBuyNowView]);

  // Re-sync guestItems whenever localStorage is updated by an external source
  // (e.g. QuickCart changes qty, another tab, or buy-now return merge).
  // This is a no-op for logged-in users and buy-now view.
  useEffect(() => {
    if (isAuth || isBuyNowView) return;
    const syncGuest = () => {
      setGuestItems(
        GuestCart.get().map((i: any) => ({
          ...i,
          isSelected: i.isSelected ?? true,
        })),
      );
    };
    window.addEventListener("guestCartUpdated", syncGuest);
    return () => window.removeEventListener("guestCartUpdated", syncGuest);
  }, [isAuth, isBuyNowView]);

  // Fix 1: When user navigates BACK from Buy Now cart without paying,
  // add the buyNow item(s) into their real cart.
  useEffect(() => {
    if (!isBuyNowView) return;
    return () => {
      if (didProceedToCheckoutRef.current) return; // user intentionally checked out
      const session = getBuyNowSession();
      if (!session?.items?.length) return;

      const returnKey = `buy-now-return:${session.createdAt ?? Date.now()}:${
        session.cartSignature ?? "no-signature"
      }`;
      const processedKey = localStorage.getItem("processedBuyNowCartAddKey");
      if (processedKey === returnKey) return;

      if (isAuth && userId) {
        // Logged-in: queue items in localStorage for useCartLoader to process
        const pending = session.items.map((item: any) => ({
          productVariantDetailId: item.productVariantDetailId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          state: "Created",
          userProfileId: userId,
          quantity: item.processedQuantity || 1,
        }));
        localStorage.setItem("pendingBuyNowCartAdd", JSON.stringify(pending));
        localStorage.setItem("pendingBuyNowCartAddKey", returnKey);
        window.dispatchEvent(new Event("buyNowCartReturned"));
      } else {
        // Guest: merge buyNow item(s) into guestCart synchronously
        const gc: any[] = (() => {
          try {
            return JSON.parse(localStorage.getItem("guestCart") || "[]");
          } catch {
            return [];
          }
        })();
        session.items.forEach((item: any) => {
          const key = `${item.productVariantId}-${item.productVariantDetailId}`;
          const idx = gc.findIndex(
            (x: any) =>
              `${x.productVariantId}-${x.productVariantDetailId}` === key,
          );
          if (idx >= 0) {
            gc[idx].quantity =
              (gc[idx].quantity || 1) + (item.processedQuantity || 1);
            gc[idx].processedQuantity = gc[idx].quantity;
          } else {
            gc.push({
              ...item,
              quantity: item.processedQuantity || 1,
              isSelected: true,
            });
          }
        });
        localStorage.setItem("guestCart", JSON.stringify(gc));
        window.dispatchEvent(new Event("guestCartUpdated"));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuyNowView, isAuth, userId]);

  const appliedCouponCode = getCouponCode(appliedCoupon);
  const typedCouponInput = upper(couponInput);
  const isApplyCouponDisabled = Boolean(
    !typedCouponInput ||
      (appliedCouponCode && typedCouponInput === appliedCouponCode),
  );

  useEffect(() => {
    if (appliedCouponCode) {
      setCouponInput(appliedCouponCode);
      return;
    }

    if (!appliedCoupon) {
      setCouponInput("");
    }
  }, [appliedCoupon, appliedCouponCode]);

  const cartItems = useMemo(() => {
    const raw = isBuyNowView ? buyNowItems : isAuth ? authItems : guestItems;
    // Merge any duplicate rows (same productVariantDetailId) that may already exist in DB
    return mergeCartDuplicates(raw);
  }, [isBuyNowView, buyNowItems, isAuth, authItems, guestItems]);
  const selectedItems = cartItems.filter((i) => i.isSelected);
  const allSelected =
    cartItems.length > 0 && selectedItems.length === cartItems.length;

  const subTotal = selectedItems.reduce(
    (s, i) => s + (i.finalPrice || 0) * (i.processedQuantity || 1),
    0,
  );

  // Tax totals — read directly from stored PVD fields, never recalculated.
  // • cgst/sgst on each item = the % rate stored in ProductVariantDetail at create time.
  // • Same product, qty > 1 → multiply by qty.
  // • Multiple products → sum across all items.
  // • If cgst/sgst rates are 0 but taxAmount exists → split taxAmount 50/50 per unit.
  const computedCgstTotal = selectedItems.reduce((s: number, i: any) => {
    const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
    if (Number(i.cgst) > 0)
      return s + ((Number(i.finalPrice || 0) * Number(i.cgst)) / 100) * qty;
    return s + (Number(i.taxAmount || 0) / 2) * qty;
  }, 0);
  const computedSgstTotal = selectedItems.reduce((s: number, i: any) => {
    const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
    if (Number(i.sgst) > 0)
      return s + ((Number(i.finalPrice || 0) * Number(i.sgst)) / 100) * qty;
    return s + (Number(i.taxAmount || 0) / 2) * qty;
  }, 0);
  const totalPayable = Math.max(0, subTotal - (couponDiscount ?? 0));
  const currentCartSignature = useMemo(
    () => buildSurpriseGiftSignature(selectedItems as any),
    [selectedItems],
  );
  const currentCheckoutSession = isBuyNowView
    ? getBuyNowSession()
    : readCheckoutSession();
  const giftUnlockPendingRef = useRef(false);
  const giftFlowSignatureRef = useRef<string | null>(null);
  const giftRedirectTimerRef = useRef<number | null>(null);
  const checkoutTransitionInProgressRef = useRef(false);
  // Track if user proceeded to payment so we know NOT to add to cart on back
  const didProceedToCheckoutRef = useRef(false);
  const [giftUnlocked, setGiftUnlocked] = useState<boolean>(() =>
    Boolean(
      currentCheckoutSession?.giftCheckoutKey === location.key &&
        currentCheckoutSession?.surpriseGift &&
        currentCheckoutSession.cartSignature === currentCartSignature,
    ),
  );
  const activeSurpriseGift = giftUnlocked
    ? currentCheckoutSession?.surpriseGift ?? null
    : null;
  // Uses sync lookup (tiers already prefetched above); returns null if no tiers loaded yet
  const eligibleSurpriseGift = getSurpriseGiftSelectionSync(subTotal);

  const clearGiftRedirectTimer = () => {
    if (giftRedirectTimerRef.current !== null) {
      window.clearTimeout(giftRedirectTimerRef.current);
      giftRedirectTimerRef.current = null;
    }
  };

  const resetGiftCheckoutFlow = () => {
    clearGiftRedirectTimer();
    giftUnlockPendingRef.current = false;
    giftFlowSignatureRef.current = null;
    checkoutTransitionInProgressRef.current = false;
  };

  const getCartReturnPath = () =>
    "/user-products/cart" + (isBuyNowView ? "?buyNow=1" : "");

  const redirectGuestToLogin = () => {
    const cartReturnPath = getCartReturnPath();
    checkoutTransitionInProgressRef.current = true;
    didProceedToCheckoutRef.current = true;
    clearGiftRedirectTimer();
    giftUnlockPendingRef.current = false;
    giftFlowSignatureRef.current = null;

    navigate(`/login?redirect=${encodeURIComponent(cartReturnPath)}`, {
      state: {
        from: cartReturnPath,
        surpriseGiftFlow: currentCartSignature,
      },
    });
  };

  const validateCartStock = async () => {
    if (!isAuth) {
      redirectGuestToLogin();
      return false;
    }

    try {
      const stockResponse = await checkOutOfStock({
        orderItems: selectedItems
          .filter((i) => i.productVariantDetailId)
          .map((i) => ({ productVariantDetailId: i.productVariantDetailId })),
      });

      const backendIssues = getBackendStockIssues(
        getOutOfStockProducts(stockResponse),
        selectedItems,
      );
      if (backendIssues.length > 0) {
        showStockIssuesPopup(backendIssues, (issue) => {
          handleQtyChange(issue.item, Math.max(1, issue.requested - 1));
        });
        return false;
      }

      const localIssues = getStockIssues(selectedItems);
      if (localIssues.length > 0) {
        showStockIssuesPopup(localIssues, (issue) => {
          handleQtyChange(issue.item, Math.max(1, issue.requested - 1));
        });
        return false;
      }

      return true;
    } catch (e: any) {
      if (isAuthFailure(e)) {
        redirectGuestToLogin();
        return false;
      }

      const backendIssues = getBackendStockIssues(
        getOutOfStockProducts(e?.response?.data),
        selectedItems,
      );
      if (backendIssues.length > 0) {
        showStockIssuesPopup(backendIssues, (issue) => {
          handleQtyChange(issue.item, Math.max(1, issue.requested - 1));
        });
        return false;
      }

      toast.error(
        e?.response?.data?.message ||
          "Could not validate stock. Please try checkout again.",
      );
      return false;
    }
  };

  const proceedToCheckoutAddress = async () => {
    if (checkoutTransitionInProgressRef.current) return;
    try {
      if (!isAuth) {
        redirectGuestToLogin();
        return;
      }

      // Gate: block checkout if any selected item has an inactive category
      const inactiveSelected = selectedItems.filter(
        (i: any) => i.categoryIsActive === false,
      );
      if (inactiveSelected.length > 0) {
        setInactiveCategoryItems(inactiveSelected);
        setShowInactiveCategoryModal(true);
        return;
      }

      const isStockOk = await validateCartStock();
      if (!isStockOk) return;

      checkoutTransitionInProgressRef.current = true;
      didProceedToCheckoutRef.current = true; // mark that user intentionally proceeded
      clearGiftRedirectTimer();
      giftUnlockPendingRef.current = false;
      giftFlowSignatureRef.current = null;
      const store = useCartStore.getState();
      const checkoutSession = isBuyNowView
        ? getBuyNowSession()
        : readCheckoutSession();
      const surpriseGift =
        checkoutSession?.surpriseGift ?? activeSurpriseGift ?? null;

      persistCheckoutSession(
        surpriseGift,
        surpriseGift
          ? checkoutSession?.giftCheckoutKey ??
              currentCheckoutSession?.giftCheckoutKey ??
              location.key
          : null,
      );

      if (isBuyNowView) {
        // Buy Now flow keeps the temporary session in sync, but cart store stays unchanged.
      } else {
        store.setSelectedItems?.(selectedItems);
        store.setSubTotal?.(subTotal);
      }

      const checkoutPath =
        "/user-products/payment-address" + (isBuyNowView ? "?buyNow=1" : "");

      navigate(checkoutPath, {
        state: {
          from: location.pathname + location.search,
          surpriseGiftFlow: currentCartSignature,
        },
      });
    } catch (e: any) {
      checkoutTransitionInProgressRef.current = false;
      if (isAuthFailure(e)) {
        redirectGuestToLogin();
        return;
      }

      toast.error(
        e?.response?.data?.message ||
          "Could not continue checkout. Please try again.",
      );
    }
  };

  useEffect(() => {
    if (!cartItemsHydrated) return;

    const session = isBuyNowView ? getBuyNowSession() : readCheckoutSession();
    const sessionMatches =
      Boolean(session?.surpriseGift) &&
      session?.cartSignature === currentCartSignature &&
      session?.giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION &&
      session?.giftCheckoutKey === location.key;

    if (sessionMatches) {
      setGiftUnlocked(true);
      return;
    }

    if (giftUnlockPendingRef.current) return;

    if (session?.surpriseGift) {
      if (isBuyNowView) clearBuyNowSession();
      else clearCheckoutSession();
    }

    setGiftUnlocked(false);
  }, [cartItemsHydrated, currentCartSignature, isBuyNowView, location.key]);

  useEffect(() => {
    return () => {
      clearGiftRedirectTimer();
    };
  }, []);

  useEffect(() => {
    if (!giftUnlockPendingRef.current) return;
    if (!giftFlowSignatureRef.current) return;
    if (giftFlowSignatureRef.current === currentCartSignature) return;

    resetGiftCheckoutFlow();
    if (isBuyNowView) clearBuyNowSession();
    else clearCheckoutSession();
    setGiftUnlocked(false);
  }, [currentCartSignature, isBuyNowView]);

  const couponOptions = useMemo(() => {
    const byCode = new Map<string, DisplayCoupon>();

    const pushCoupon = (coupon: any, source: CouponSource) => {
      const code = getCouponCode(coupon);
      if (!code) return;

      const normalized: DisplayCoupon = {
        ...coupon,
        couponCode: code,
        source,
      };

      const existing = byCode.get(code);
      if (
        !existing ||
        (source === "profile" && existing.source !== "profile")
      ) {
        byCode.set(code, normalized);
      }
    };

    generalCoupons.forEach((coupon: any) => pushCoupon(coupon, "general"));
    profileCoupons.forEach((coupon: any) => pushCoupon(coupon, "profile"));

    // Collect product IDs currently in the cart for product-specific coupon filtering
    const cartProductIds = new Set(
      (isBuyNowView ? buyNowItems : isAuth ? authItems : guestItems)
        .map((item: any) => item.productId)
        .filter(Boolean),
    );

    const all = [...byCode.values()]
      .filter((coupon) => {
        if (!isCouponActive(coupon) || isCouponExpired(coupon)) return false;
        // Product-specific coupons: only show if the product is in the cart
        if ((coupon as any).couponType === "product_specific") {
          return (
            (coupon as any).productId &&
            cartProductIds.has((coupon as any).productId)
          );
        }
        return true;
      })
      .map((coupon) => {
        const code = getCouponCode(coupon);
        const unlockAmount = getCouponUnlockAmount(coupon, subTotal);
        const discountAmount = calculateCouponDiscountAmount(coupon, subTotal);

        return {
          coupon,
          code,
          displayDiscount: getCouponDisplayDiscount(coupon),
          unlockAmount,
          canApplyNow: unlockAmount <= 0 && discountAmount > 0,
        } satisfies CouponOption;
      })
      .sort((a, b) => {
        const sourceDiff =
          a.coupon.source === b.coupon.source
            ? 0
            : a.coupon.source === "profile"
            ? -1
            : 1;
        return sourceDiff || a.code.localeCompare(b.code);
      });

    return {
      all,
      profile: all.filter((item) => item.coupon.source === "profile"),
      general: all.filter((item) => item.coupon.source === "general"),
    };
  }, [generalCoupons, profileCoupons, subTotal]);

  const resolveCouponByCode = async (
    rawCode: string,
  ): Promise<DisplayCoupon | null> => {
    const code = upper(rawCode);
    if (!code) return null;

    const localMatch = couponOptions.all.find((item) => item.code === code);
    if (localMatch) return localMatch.coupon;

    try {
      const [userRes, generalRes] = await Promise.all([
        isAuth && userId
          ? listUserCoupons({ userProfileId: String(userId) })
          : Promise.resolve(null),
        listCoupons({
          Filters: [
            {
              property: "CouponCode",
              comparison: "eq",
              value: code,
            },
          ],
        }),
      ]);

      const fetchedCoupons = [
        ...(normalizeCouponResponse(userRes) as CouponModel[]),
        ...(normalizeCouponResponse(generalRes) as CouponModel[]),
      ];

      const match = fetchedCoupons.find(
        (coupon) => getCouponCode(coupon) === code,
      );
      if (!match) return null;

      return {
        ...match,
        couponCode: getCouponCode(match),
        source: isGeneralCoupon(match) ? "general" : "profile",
      };
    } catch (error) {
      console.error("Coupon lookup error:", error);
      return null;
    }
  };

  /**
   * Try to validate a physical (store-issued) coupon code.
   * Returns discount % if valid, null otherwise.
   * Sets physicalCouponCode state so MarkUsed can be called after order.
   */
  const resolvePhysicalCoupon = async (
    rawCode: string,
  ): Promise<number | null> => {
    const code = upper(rawCode);
    if (!code) return null;
    try {
      const result = await validatePhysicalCoupon({
        couponCode: code,
        userProfileId: userId ? String(userId) : undefined,
      });
      if (result.valid && result.discount) {
        setPhysicalCouponCode(code);
        return result.discount;
      }
      return null;
    } catch (err: any) {
      // 409 = already used globally
      if (err?.response?.status === 409) {
        toast.error("This physical coupon has already been used");
      }
      return null;
    }
  };

  const applyCouponByCode = async (rawCode: string, showToast = true) => {
    const code = upper(rawCode);
    if (!code) {
      if (showToast) toast.error("Enter a coupon code");
      return false;
    }

    try {
      const coupon = await resolveCouponByCode(code);
      if (!coupon) {
        // Try as a physical coupon
        const physDiscount = await resolvePhysicalCoupon(code);
        if (physDiscount !== null) {
          // Build a synthetic coupon object for cart state
          const synthCoupon: any = {
            couponCode: code,
            couponName: "Physical Coupon",
            discount: physDiscount,
            discountType: "percentage",
            isActive: true,
            isCommon: false,
            couponType: "physical",
            source: "profile",
          };
          const discountAmt = calculateCouponDiscountAmount(
            synthCoupon,
            subTotal,
          );
          if (discountAmt <= 0) {
            if (showToast) toast.error("Coupon not applicable on this order");
            return false;
          }
          setCoupon(synthCoupon, discountAmt);
          if (showToast) {
            toast.success(
              `Physical coupon applied! ${physDiscount}% off — you save ₹${discountAmt.toLocaleString(
                "en-IN",
              )}`,
            );
          }
          return true;
        }
        if (showToast) toast.error("Invalid coupon");
        return false;
      }

      if (!isCouponActive(coupon) || isCouponExpired(coupon)) {
        if (showToast) toast.error("Invalid coupon");
        return false;
      }

      const unlockAmount = getCouponUnlockAmount(coupon, subTotal);
      if (unlockAmount > 0) {
        if (showToast) {
          toast.error(
            `Add Rs.${unlockAmount.toLocaleString(
              "en-IN",
            )} more to use this coupon`,
          );
        }
        return false;
      }

      const discountAmt = calculateCouponDiscountAmount(coupon, subTotal);
      if (discountAmt <= 0) {
        if (showToast) toast.error("Coupon not applicable on this order");
        return false;
      }

      setCoupon(coupon, discountAmt);

      if (showToast) {
        toast.success(
          `Coupon applied! ${getCouponDisplayDiscount(
            coupon,
          )} — you save Rs.${discountAmt.toLocaleString("en-IN")}`,
        );
      }

      return true;
    } catch (error) {
      console.error("Coupon error:", error);
      if (showToast) toast.error("Could not verify coupon. Please try again.");
      return false;
    }
  };

  useEffect(() => {
    const appliedCode = getCouponCode(appliedCoupon);
    if (!appliedCode) return;

    const current = couponOptions.all.find((item) => item.code === appliedCode);
    if (!current) return;

    const discountAmt = calculateCouponDiscountAmount(current.coupon, subTotal);
    if (discountAmt > 0 && discountAmt !== couponDiscount) {
      setCoupon(current.coupon, discountAmt);
    }
  }, [appliedCoupon, couponDiscount, couponOptions.all, setCoupon, subTotal]);

  const updateMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateCart(id, { cartId: id, quantity: qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCartItem(id),
    onSuccess: () => {
      toast.success("Item removed");
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
      setCartCount(Math.max(0, (cartCount || 1) - 1));
    },
  });

  const removeMergedCartItem = async (item: any) => {
    if (!isAuth) {
      GuestCart.remove(item.productVariantDetailId);
      setGuestItems((prev) => {
        const updated = prev.filter(
          (i: any) => i.productVariantDetailId !== item.productVariantDetailId,
        );
        window.dispatchEvent(new Event("guestCartUpdated"));
        return updated;
      });
      toast.success("Item removed");
      return;
    }

    const ids = Array.from(
      new Set(
        [item.cartId, ...(item._extraCartIds ?? [])].filter(
          (id): id is number => typeof id === "number" && Number.isFinite(id),
        ),
      ),
    );

    if (ids.length <= 1) {
      deleteMutation.mutate(item.cartId);
      return;
    }

    try {
      await Promise.all(ids.map((id) => deleteCartItem(id)));
      toast.success("Item removed");
      setCartCount(Math.max(0, (cartCount || 1) - 1));
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const syncBuyNowItems = (
    updater: (items: any[]) => any[],
    toastMessage?: string,
  ) => {
    setBuyNowItems((prev) => {
      const next = normalizeBuyNowItems(updater(prev));
      if (next.length > 0) {
        // Recompute tax totals from PVD stored rates whenever items/qty change
        const cgstTotal = next.reduce((s: number, i: any) => {
          const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
          const price = Number(i.finalPrice || 0);
          if (i.cgst > 0) return s + ((price * Number(i.cgst)) / 100) * qty;
          return s + (Number(i.taxAmount || 0) * qty) / 2;
        }, 0);
        const sgstTotal = next.reduce((s: number, i: any) => {
          const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
          const price = Number(i.finalPrice || 0);
          if (i.sgst > 0) return s + ((price * Number(i.sgst)) / 100) * qty;
          return s + (Number(i.taxAmount || 0) * qty) / 2;
        }, 0);
        setBuyNowSession(next as any, { cgstTotal, sgstTotal });
      } else {
        clearBuyNowSession();
      }
      return next;
    });

    if (toastMessage) toast.success(toastMessage);
  };

  const handleQtyChange = (item: any, qty: number) => {
    if (qty < 1) return;
    // Stock cap: never allow going above available stock
    const stock: number | null =
      item.stockQuantity != null ? Number(item.stockQuantity) : null;
    const currentQty = Number(item.processedQuantity || 1);
    if (stock !== null && qty > stock && qty > currentQty) {
      const itemKey = String(
        item.cartId ?? item.productVariantDetailId ?? item.productVariantId,
      );
      setStockTipItemId(itemKey);
      setTimeout(() => setStockTipItemId(null), 2200);
      return;
    }
    if (isBuyNowView) {
      syncBuyNowItems((prev) =>
        prev.map((i) =>
          i.productVariantDetailId === item.productVariantDetailId
            ? { ...i, processedQuantity: qty, quantity: qty }
            : i,
        ),
      );
      return;
    }
    if (isAuth) {
      const { nextItems, targetCartId, targetQty } = updateMergedCartItems(
        authItems,
        item,
        qty,
      );
      setAuthItems(nextItems);
      if (targetCartId == null) return;
      if (targetQty < 1) {
        deleteMutation.mutate(targetCartId);
        return;
      }
      updateMutation.mutate({ id: targetCartId, qty: targetQty });
    } else {
      const { nextItems } = updateMergedCartItems(guestItems, item, qty);
      setGuestItems(nextItems);
      GuestCart.set(nextItems);
    }
  };

  const handleRemove = (item: any) => {
    if (isBuyNowView) {
      syncBuyNowItems(
        (prev) =>
          prev.filter(
            (i: any) =>
              i.productVariantDetailId !== item.productVariantDetailId,
          ),
        "Item removed",
      );
      return;
    }
    void removeMergedCartItem(item);
  };

  const toggleSelect = (item: any) => {
    if (isBuyNowView) {
      syncBuyNowItems((prev) =>
        prev.map((i) =>
          i.productVariantDetailId === item.productVariantDetailId
            ? { ...i, isSelected: !i.isSelected }
            : i,
        ),
      );
      return;
    }
    // FIX: Track explicit deselections in a persistent ref so they survive
    // cartData refetches. Without this, a background refetch would reset
    // deselected items back to isSelected:true before the user checks out.
    if (isAuth && item.cartId != null) {
      const currentlySelected =
        authItemsRef.current.find((i: any) => i.cartId === item.cartId)
          ?.isSelected ?? true;
      if (currentlySelected) {
        // User is deselecting — record it
        manuallyDeselectedCartIds.current.add(Number(item.cartId));
      } else {
        // User is re-selecting — remove from deselected set
        manuallyDeselectedCartIds.current.delete(Number(item.cartId));
      }
    }
    const fn = (arr: any[]) =>
      arr.map((i) => {
        const match = isAuth
          ? i.cartId === item.cartId
          : i.productVariantDetailId === item.productVariantDetailId;
        return match ? { ...i, isSelected: !i.isSelected } : i;
      });
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const toggleAll = () => {
    const val = !allSelected;
    if (isBuyNowView) {
      syncBuyNowItems((prev) => prev.map((i) => ({ ...i, isSelected: val })));
      return;
    }
    const fn = (arr: any[]) => arr.map((i) => ({ ...i, isSelected: val }));
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const handleClearCart = () => {
    if (isBuyNowView) {
      clearBuyNowSession();
      setBuyNowItems([]);
      toast.success("Buy Now item cleared");
      return;
    }
    if (isAuth) setAuthItems([]);
    else {
      GuestCart.set([]);
      setGuestItems([]);
    }
    toast.success("Cart cleared");
  };

  const handleApplyCoupon = async () => {
    if (!typedCouponInput) {
      toast.error("Enter a coupon code");
      return;
    }

    if (isApplyCouponDisabled) return;

    const applied = await applyCouponByCode(typedCouponInput, true);
    if (applied) setIsCouponDropdownOpen(false);
    return;

    if (!couponInput.trim()) {
      toast.error("Enter a coupon code");
      return;
    }
    try {
      const res = await listCoupons({
        Filters: [
          {
            property: "CouponCode",
            comparison: "eq",
            value: couponInput.trim(),
          },
        ],
      });
      const coupon = res?.list?.[0];
      if (!coupon) {
        toast.error("Invalid coupon code");
        return;
      }
      if (coupon.isActive === false || coupon.isActive === null) {
        toast.error("This coupon is not active");
        return;
      }
      // discount = integer percent (e.g. 10 = 10% off)
      const pct = Number(coupon.discount) || 0;
      if (pct <= 0) {
        toast.error("This coupon has no discount value");
        return;
      }
      const discountAmt = Math.round((subTotal * pct) / 100);
      if (discountAmt <= 0) {
        toast.error("Coupon not applicable on this order");
        return;
      }
      setCoupon(coupon, discountAmt);
      toast.success(`Coupon applied! ${pct}% off — you save ₹${discountAmt}`);
    } catch (e) {
      console.error("Coupon error:", e);
      toast.error("Could not verify coupon. Please try again.");
    }
  };

  const handleSelectCoupon = async (code: string) => {
    const normalized = upper(code);
    if (!normalized) return;

    setCouponInput(normalized);
    if (normalized === appliedCouponCode) return;

    const applied = await applyCouponByCode(normalized, true);
    if (applied) setIsCouponDropdownOpen(false);
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponInput("");
    setIsCouponDropdownOpen(false);
    setPhysicalCouponCode(null);
  };

  /**
   * Call this after a successful order is placed to permanently mark the coupon as used.
   * Pass the created orderId so it is recorded for audit purposes.
   */
  const markAppliedCouponUsed = async (orderId?: number) => {
    if (!userId) return;
    try {
      if (physicalCouponCode) {
        await markPhysicalCouponUsed({
          couponCode: physicalCouponCode,
          userProfileId: String(userId),
          orderId,
        });
        setPhysicalCouponCode(null);
      } else if (appliedCoupon && (appliedCoupon as any).couponId) {
        await markDigitalCouponUsed({
          couponId: (appliedCoupon as any).couponId,
          userProfileId: String(userId),
          orderId,
        });
      }
    } catch (err) {
      // Non-fatal: log but do not interrupt the order success flow
      console.error("Failed to mark coupon used:", err);
    }
  };

  const persistCheckoutSession = (
    surpriseGift: SurpriseGiftSelection | null,
    giftCheckoutKey?: string | null,
  ) => {
    if (isBuyNowView) {
      setBuyNowSession(selectedItems as any, {
        shipping: currentCheckoutSession?.shipping ?? null,
        surpriseGift,
        cartSignature: currentCartSignature,
        giftCheckoutKey,
        cgstTotal: computedCgstTotal,
        sgstTotal: computedSgstTotal,
      });
      return;
    }

    clearBuyNowSession();
    saveCheckoutSession({
      mode: "cart",
      items: selectedItems,
      subTotal,
      cgstTotal: computedCgstTotal,
      sgstTotal: computedSgstTotal,
      shipping: selectedShipping ?? currentCheckoutSession?.shipping ?? null,
      surpriseGift,
      cartSignature: currentCartSignature,
      giftCheckoutKey,
    });
  };

  const handleCheckout = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    if (!isAuth) {
      redirectGuestToLogin();
      return;
    }

    const isStockOk = await validateCartStock();
    if (!isStockOk) return;

    if (typedCouponInput && typedCouponInput !== appliedCouponCode) {
      const isCouponValid = await applyCouponByCode(typedCouponInput, true);
      if (!isCouponValid) {
        return;
      }
    }

    const unlockedGift = activeSurpriseGift ?? null;

    if (giftRedirectTimerRef.current !== null) {
      await proceedToCheckoutAddress();
      return;
    }

    if (
      !unlockedGift &&
      !eligibleSurpriseGift &&
      subTotal > 0 &&
      minGiftThreshold !== null &&
      minGiftThreshold !== Infinity &&
      subTotal < minGiftThreshold
    ) {
      const remainingAmount = Math.max(0, minGiftThreshold - subTotal);

      toast.custom(
        (t) => (
          <div
            style={{
              background: "transparent",
              boxShadow: "none",
              padding: 0,
              border: "none",
            }}
          >
            <SurpriseGiftReminderToast
              remainingAmount={remainingAmount}
              threshold={minGiftThreshold}
              onDismiss={() => toast.dismiss(t.id)}
            />
          </div>
        ),
        {
          id: `surprise-gift-reminder-${currentCartSignature}`,
          duration: 7000,
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            border: "none",
          },
        },
      );
    }

    if (eligibleSurpriseGift && !unlockedGift) {
      giftUnlockPendingRef.current = true;
      giftFlowSignatureRef.current = currentCartSignature;
      persistCheckoutSession(eligibleSurpriseGift, location.key);
      setGiftUnlocked(true);
      toast.custom(
        (t) => <SurpriseGiftToast onDismiss={() => toast.dismiss(t.id)} />,
        {
          duration: 5000,
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            border: "none",
          },
        },
      );
      clearGiftRedirectTimer();
      giftRedirectTimerRef.current = window.setTimeout(() => {
        void proceedToCheckoutAddress();
      }, 5000);
      return;
    }

    await proceedToCheckoutAddress();
  };

  if (isLoading)
    return (
      <div className="container s-cart-2eb199">
        <style>{`@keyframes twam-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
        <div className="row g-4">
          <div className="col-lg-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "16px 0",
                  borderBottom: "1px solid rgba(0,0,0,.06)",
                  animation: "twam-pulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.12}s`,
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 120,
                    borderRadius: 10,
                    background: "#ece6da",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 14,
                      width: "65%",
                      background: "#ece6da",
                      borderRadius: 4,
                      marginBottom: 10,
                    }}
                  />
                  <div
                    style={{
                      height: 12,
                      width: "40%",
                      background: "#ece6da",
                      borderRadius: 4,
                      marginBottom: 18,
                    }}
                  />
                  <div
                    style={{
                      height: 12,
                      width: "25%",
                      background: "#ece6da",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="col-lg-4">
            <div
              style={{
                padding: 24,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,.07)",
                animation: "twam-pulse 1.4s ease-in-out infinite",
              }}
            >
              {[80, 60, 50, 70, 100].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 13,
                    width: `${w}%`,
                    background: "#ece6da",
                    borderRadius: 4,
                    marginBottom: 14,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );

  // ── Render: inactive-category modal helper ──────────────────────────────
  const renderInactiveCategoryModal = () => {
    if (!showInactiveCategoryModal) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowInactiveCategoryModal(false);
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "28px 28px 24px",
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>🚫</span>
            <div>
              <h5
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: 17,
                  color: "#1a1a1a",
                }}
              >
                Some items are no longer available
              </h5>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 14,
                  color: "#555",
                  lineHeight: 1.5,
                }}
              >
                The following item
                {inactiveCategoryItems.length > 1 ? "s are" : " is"} from a
                category that's currently unavailable. Please remove or save for
                later before proceeding to checkout.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 22,
            }}
          >
            {inactiveCategoryItems.map((item: any) => (
              <div
                key={item.cartId ?? item.productVariantId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fafafa",
                  borderRadius: 8,
                  padding: "10px 12px",
                  border: "1px solid #eee",
                }}
              >
                {(item.image || item.imageURL) && (
                  <img
                    src={getImageUrl(item.image || item.imageURL)}
                    alt={item.productName || item.name || ""}
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: "cover",
                      borderRadius: 6,
                      opacity: 0.5,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#1a1a1a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.productName || item.name}
                  </div>
                  {(item.color || item.size) && (
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {item.color && <span>{item.color}</span>}
                      {item.color && item.size && <span> · </span>}
                      {item.size && <span>{item.size}</span>}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => {
                      // Save for later: add to wishlist then remove from cart
                      // Save to wishlist via API then remove from cart
                      if (isAuth && userId) {
                        createWishlist({
                          productId: item.productId,
                          productVariantId: item.productVariantId,
                          productVariantDetailId: item.productVariantDetailId,
                          userProfileId: userId,
                          state: "Active",
                        }).catch(() => {});
                      }
                      const ids = [
                        item.cartId,
                        ...(item._extraCartIds ?? []),
                      ].filter(Boolean);
                      ids.forEach((id: number) => deleteCartItem(id));
                      // Optimistic update: remove item from cart state immediately
                      // so the cart list reflects the change without waiting for refetch
                      const removedCartIds = new Set(ids);
                      setAuthItems((prev: any[]) =>
                        prev.filter((i: any) => !removedCartIds.has(i.cartId)),
                      );
                      // Decrement the badge counter immediately and resync bootstrap
                      setCartCount(Math.max(0, (cartCount || 1) - 1));
                      qc.invalidateQueries({ queryKey: ["cart", userId] });
                      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
                      qc.invalidateQueries({ queryKey: ["quick-cart"] });
                      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
                      toast.success("Saved to wishlist");
                      setInactiveCategoryItems((prev) =>
                        prev.filter((i: any) => i.cartId !== item.cartId),
                      );
                    }}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1.5px solid #e0a800",
                      background: "#fff8e1",
                      color: "#856404",
                      cursor: "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <i className="bi bi-bookmark me-1" />
                    Save for Later
                  </button>
                  <button
                    onClick={() => {
                      const ids = [
                        item.cartId,
                        ...(item._extraCartIds ?? []),
                      ].filter(Boolean);
                      ids.forEach((id: number) => deleteCartItem(id));
                      // Optimistic update: remove from cart state immediately
                      const removedIds = new Set(ids);
                      setAuthItems((prev: any[]) =>
                        prev.filter((i: any) => !removedIds.has(i.cartId)),
                      );
                      // Decrement the badge counter immediately and resync bootstrap
                      setCartCount(Math.max(0, (cartCount || 1) - 1));
                      qc.invalidateQueries({ queryKey: ["cart", userId] });
                      qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
                      qc.invalidateQueries({ queryKey: ["quick-cart"] });
                      toast("Removed from cart", { icon: "🗑️" });
                      setInactiveCategoryItems((prev) =>
                        prev.filter((i: any) => i.cartId !== item.cartId),
                      );
                    }}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1.5px solid #dc3545",
                      background: "#fff5f5",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <i className="bi bi-trash3 me-1" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inactiveCategoryItems.length === 0 ? (
            <button
              onClick={() => {
                setShowInactiveCategoryModal(false);
                // Re-trigger checkout now that all unavailable items are cleared
                setTimeout(() => proceedToCheckoutAddress(), 200);
              }}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                background: "var(--brand, #333)",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Continue to Checkout
            </button>
          ) : (
            <button
              onClick={() => setShowInactiveCategoryModal(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                background: "#f5f5f5",
                color: "#444",
                border: "1px solid #ddd",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  };

  if (cartItems.length === 0)
    return (
      <div className="container py-5">
        <div className="d-flex flex-column align-items-center s-cart-cd9eb3">
          <i className="bi bi-cart-x s-cart-b5dbda" />
          <h5 className="mt-4 text-muted">
            {isBuyNowView ? "Buy Now item unavailable" : "Your cart is empty"}
          </h5>
          <p className="text-muted">
            {isBuyNowView
              ? "This temporary item is no longer available. Please open the product and tap Buy Now again."
              : "Looks like you haven't added anything yet."}
          </p>
          <button
            onClick={() => navigate("/all-products")}
            className="s-cart-289753"
          >
            ← Continue Shopping
          </button>
        </div>
      </div>
    );

  return (
    <>
      {renderInactiveCategoryModal()}
      <div className="container s-cart-2eb199">
        {isBuyNowView && (
          <div
            className="s-cart-buy-now-banner"
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(107, 15, 42, 0.18)",
              background:
                "linear-gradient(135deg, rgba(107, 15, 42, 0.08), rgba(245, 240, 230, 0.96))",
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div className="d-flex align-items-start gap-3 flex-wrap">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#000000",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-bag-check-fill" />
                Buy Now
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="mb-1 fw-semibold s-cart-04af82">
                  Single-item checkout mode
                </p>
                <p className="mb-0 s-adminnewslet-f01220">
                  Only the product you chose for Buy Now appears here. Your main
                  cart stays separate and unchanged.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Select All row ── */}
        <div className="s-cart-1fdbde">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="s-cart-f71922"
          />
          <span className="s-quickcart-08341f">
            Select All ({selectedItems.length}/{cartItems.length})
          </span>
        </div>

        <div className="row g-4">
          {/* ── Left: Cart Items ── */}
          <div className="col-lg-8">
            {activeSurpriseGift && <SurpriseGiftCard />}

            {cartItems.map((item: any) => (
              <div
                key={item.cartId ?? item.productVariantId}
                className="s-cart-100fbc"
              >
                <input
                  type="checkbox"
                  checked={!!item.isSelected}
                  onChange={() => toggleSelect(item)}
                  className="s-cart-d8c8fe"
                />

                {/* Clickable image */}
                <img
                  src={getImageUrl(item.image || item.imageURL)}
                  alt={item.productName || item.name || ""}
                  onClick={() =>
                    navigate(
                      `/user-products/product-detail/${
                        item.productVariantId
                      }/${slugify(item.productName || item.name || "")}`,
                      { state: { fromCart: true } },
                    )
                  }
                  className="s-cart-c9a7a1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/assets/category-bg.png";
                  }}
                />

                <div className="s-userdashboar-7aa8c4">
                  {/* Name + Brand */}
                  <h6 className="s-cart-04af82">
                    {item.productName || item.name}
                    {item.brandName && (
                      <span className="s-cart-9a8498">({item.brandName})</span>
                    )}
                  </h6>

                  {/* Color + Size — hidden when category is inactive */}
                  {item.categoryIsActive === false ? (
                    <div style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(220,53,69,0.10)",
                          color: "#b91c1c",
                          border: "1.5px solid rgba(185,28,28,0.30)",
                          borderRadius: 6,
                          padding: "5px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 0.8,
                          textTransform: "uppercase",
                        }}
                      >
                        <i
                          className="bi bi-exclamation-circle-fill"
                          style={{ fontSize: 13 }}
                        />
                        Unavailable
                      </span>
                    </div>
                  ) : (
                    <div className="s-cart-0e031f">
                      {(item.colorName || item.color) && (
                        <span className="s-cart-c8ff6d">
                          <span
                            className="s-cart-552e26"
                            style={{
                              background:
                                item.colorHex ||
                                item.colorFamilyHex ||
                                colorFamilyHexOf(item) ||
                                FALLBACK_COLOR_FAMILY_HEX,
                            }}
                          />
                          {item.colorName ?? item.color}
                        </span>
                      )}
                      {(item.size || item.bandSize) && (
                        <span className="s-adminnewslet-f01220">
                          Band Size:{" "}
                          <strong>{item.size || item.bandSize}</strong>
                        </span>
                      )}
                      {item.cupSize && (
                        <span className="s-adminnewslet-f01220">
                          Cup Size: <strong>{item.cupSize}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline stock disclaimer — only shown when qty exceeds stock OR stock <= 3 */}
                  {item.categoryIsActive !== false &&
                    (() => {
                      const availStock =
                        item.stockQuantity != null
                          ? Number(item.stockQuantity)
                          : null;
                      const reqQty = item.processedQuantity || 1;
                      if (availStock === null) return null;
                      const isOver = reqQty > availStock;
                      // Only show when stock is low (<=3) or quantity exceeds stock
                      if (!isOver && availStock > 3) return null;
                      return (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 5,
                            padding: "3px 8px",
                            marginBottom: 4,
                            background: isOver
                              ? "rgba(185,28,28,0.08)"
                              : "rgba(107,15,42,0.06)",
                            color: isOver ? "#b91c1c" : "var(--brand)",
                            border: isOver
                              ? "1px solid rgba(185,28,28,0.25)"
                              : "1px solid rgba(107,15,42,0.2)",
                          }}
                        >
                          <i
                            className={`bi ${
                              isOver
                                ? "bi-exclamation-circle-fill"
                                : "bi-exclamation-triangle-fill"
                            }`}
                            style={{ fontSize: 11 }}
                          />
                          {isOver
                            ? `Only ${availStock} available — please reduce quantity`
                            : `Only ${availStock} left in stock`}
                        </div>
                      );
                    })()}

                  {/* Quantity — hidden when category is inactive */}
                  {item.categoryIsActive !== false && (
                    <div className="s-adminbar-877368">
                      <span className="s-adminnewslet-f01220">Quantity:</span>
                      <div
                        className="s-cart-13c6e0"
                        style={{ position: "relative" }}
                      >
                        <button
                          onClick={() =>
                            handleQtyChange(
                              item,
                              (item.processedQuantity || 1) - 1,
                            )
                          }
                          className="s-cart-bbdb9d"
                          disabled={(item.processedQuantity || 1) <= 1}
                          style={{
                            cursor:
                              (item.processedQuantity || 1) <= 1
                                ? "not-allowed"
                                : "pointer",
                            color:
                              (item.processedQuantity || 1) <= 1
                                ? "var(--ivory)"
                                : undefined,
                          }}
                        >
                          −
                        </button>
                        <span className="s-cart-686e55">
                          {item.processedQuantity || 1}
                        </span>
                        {(() => {
                          const stock: number | null =
                            item.stockQuantity != null
                              ? Number(item.stockQuantity)
                              : null;
                          const atMax =
                            stock !== null &&
                            (item.processedQuantity || 1) >= stock;
                          const itemKey = String(
                            item.cartId ??
                              item.productVariantDetailId ??
                              item.productVariantId,
                          );
                          return (
                            <>
                              <button
                                onClick={() =>
                                  handleQtyChange(
                                    item,
                                    (item.processedQuantity || 1) + 1,
                                  )
                                }
                                className="s-cart-bbdb9d"
                                disabled={atMax}
                                style={{
                                  cursor: atMax ? "not-allowed" : "pointer",
                                  color: atMax ? "var(--ivory)" : undefined,
                                }}
                              >
                                +
                              </button>
                              {stockTipItemId === itemKey && stock !== null && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "-28px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    whiteSpace: "nowrap",
                                    background: "rgba(0,0,0,0.75)",
                                    color: "#fff",
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    pointerEvents: "none",
                                  }}
                                >
                                  Only {stock} available
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <div className="s-cart-4c5975">
                  {item.categoryIsActive !== false && (
                    <>
                      <span className="s-cart-abec22">
                        ₹
                        {(
                          (item.finalPrice || 0) * (item.processedQuantity || 1)
                        ).toLocaleString("en-IN")}
                      </span>
                      {item.mrpPrice && item.mrpPrice > item.finalPrice && (
                        <span className="s-cart-c7ed91">
                          ₹
                          {(
                            item.mrpPrice * (item.processedQuantity || 1)
                          ).toLocaleString("en-IN")}
                        </span>
                      )}
                    </>
                  )}
                  <div className="s-adminbar-877368">
                    <SaveForLater
                      item={item}
                      onRemoveFromCart={() => handleRemove(item)}
                    />
                    <button
                      onClick={() => handleRemove(item)}
                      title="Remove"
                      className="s-cart-f7fc7f"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Clear Cart — centered below items */}
            <div className="s-cart-7a55d6">
              <button onClick={handleClearCart} className="s-cart-eda0e1">
                {isBuyNowView ? "Clear Buy Now Item" : "Clear Shopping Cart"}
              </button>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="col-lg-4">
            <div className="s-cart-a4c113">
              {/* Coupon */}
              <h6 className="s-cart-d1f5ec">Apply Coupon Code</h6>
              <div className="s-cart-e57b74 s-cart-coupon-entry">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  placeholder="Coupon code"
                  className="s-cart-d635cd"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="s-cart-6ee566 s-cart-coupon-apply"
                  disabled={isApplyCouponDisabled}
                >
                  Apply
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsCouponDropdownOpen((open) => !open)}
                className="s-cart-coupon-toggle"
              >
                <span>
                  {isCouponDropdownOpen
                    ? "Hide available coupons"
                    : "Available coupons"}
                </span>
                <i
                  className={`bi ${
                    isCouponDropdownOpen ? "bi-chevron-up" : "bi-chevron-down"
                  }`}
                />
              </button>

              {isCouponDropdownOpen && (
                <div className="s-cart-coupon-panel">
                  {isProfileCouponsLoading || isGeneralCouponsLoading ? (
                    <p className="s-cart-coupon-state">
                      Loading available coupons...
                    </p>
                  ) : couponOptions.all.length === 0 ? (
                    <p className="s-cart-coupon-state">
                      No active coupons available right now.
                    </p>
                  ) : (
                    <>
                      <p className="s-cart-coupon-note">
                        Tap a coupon to apply it
                      </p>

                      {couponOptions.profile.length > 0 && (
                        <div
                          className={`s-cart-coupon-group ${
                            couponOptions.general.length > 0
                              ? "s-cart-coupon-group--spaced"
                              : ""
                          }`}
                        >
                          <div className="s-cart-coupon-group__title">
                            Your coupons
                          </div>
                          <div className="s-cart-coupon-grid">
                            {couponOptions.profile.map((item) => (
                              <button
                                key={`${item.code}-${
                                  item.coupon.couponId ?? "profile"
                                }`}
                                type="button"
                                onClick={() =>
                                  void handleSelectCoupon(item.code)
                                }
                                disabled={item.code === appliedCouponCode}
                                className={`s-cart-coupon-card ${
                                  item.code === appliedCouponCode
                                    ? "s-cart-coupon-card--applied"
                                    : item.canApplyNow
                                    ? "s-cart-coupon-card--active"
                                    : "s-cart-coupon-card--locked"
                                }`}
                              >
                                <div className="s-cart-coupon-card__info">
                                  <span className="s-cart-coupon-card__code">
                                    {item.code}
                                  </span>
                                  <span className="s-cart-coupon-card__name">
                                    {item.coupon.couponName || "Profile coupon"}
                                  </span>
                                </div>
                                <div className="s-cart-coupon-card__meta">
                                  <div className="s-cart-coupon-card__discount">
                                    {item.displayDiscount}
                                  </div>
                                  <div className="s-cart-coupon-card__status">
                                    {item.code === appliedCouponCode
                                      ? "Applied"
                                      : item.canApplyNow
                                      ? "Tap to use"
                                      : `Need Rs.${item.unlockAmount.toLocaleString(
                                          "en-IN",
                                        )} more`}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {couponOptions.general.length > 0 && (
                        <div className="s-cart-coupon-group">
                          <div className="s-cart-coupon-group__title">
                            General coupons
                          </div>
                          <div className="s-cart-coupon-grid">
                            {couponOptions.general.map((item) => (
                              <button
                                key={`${item.code}-${
                                  item.coupon.couponId ?? "general"
                                }`}
                                type="button"
                                onClick={() =>
                                  void handleSelectCoupon(item.code)
                                }
                                disabled={item.code === appliedCouponCode}
                                className={`s-cart-coupon-card ${
                                  item.code === appliedCouponCode
                                    ? "s-cart-coupon-card--applied"
                                    : item.canApplyNow
                                    ? "s-cart-coupon-card--active"
                                    : "s-cart-coupon-card--locked"
                                }`}
                              >
                                <div className="s-cart-coupon-card__info">
                                  <span className="s-cart-coupon-card__code">
                                    {item.code}
                                  </span>
                                  <span className="s-cart-coupon-card__name">
                                    {item.coupon.couponName || "General coupon"}
                                  </span>
                                </div>
                                <div className="s-cart-coupon-card__meta">
                                  <div className="s-cart-coupon-card__discount">
                                    {item.displayDiscount}
                                  </div>
                                  <div className="s-cart-coupon-card__status">
                                    {item.code === appliedCouponCode
                                      ? "Applied"
                                      : item.canApplyNow
                                      ? "Tap to use"
                                      : `Need Rs.${item.unlockAmount.toLocaleString(
                                          "en-IN",
                                        )} more`}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {false && appliedCoupon ? (
                <div className="s-cart-1914b7">
                  <span className="s-cart-1c5a85">
                    {(appliedCoupon as any).couponCode} applied
                  </span>
                  <button onClick={removeCoupon} className="s-cart-3ecda7">
                    ✕
                  </button>
                </div>
              ) : null}

              {appliedCoupon && (
                <div className="s-cart-e57b74 s-cart-coupon-summary">
                  <div className="s-cart-coupon-summary__info">
                    <span className="s-cart-1c5a85">
                      {appliedCouponCode || "Coupon"} applied
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="s-cart-3ecda7"
                  >
                    x
                  </button>
                </div>
              )}

              {couponDiscount > 0 && (
                <p className="s-cart-coupon-savings">
                  You have saved ₹{couponDiscount.toLocaleString("en-IN")}
                </p>
              )}

              <hr className="s-cart-0ff409" />
              <h6 className="s-cart-d1f5ec">Order Summary</h6>

              <div className="s-cart-1e2460">
                <span className="s-quickcart-08341f">
                  Subtotal ({selectedItems.length} item
                  {selectedItems.length !== 1 ? "s" : ""} ·{" "}
                  {selectedItems.reduce(
                    (s, i) => s + (i.processedQuantity || 1),
                    0,
                  )}{" "}
                  qty)
                </span>
                <span className="s-cart-d5c56b">
                  ₹{subTotal.toLocaleString("en-IN")}.00
                </span>
              </div>
              {activeSurpriseGift && (
                <div className="s-userdashboar-474527">
                  <span className="s-cart-83be37">Surprise Gift</span>
                  <span className="s-cart-1c5a85">₹0</span>
                </div>
              )}

              {/* Tax breakdown — included in MRP, shown for transparency */}
              {(computedCgstTotal > 0 || computedSgstTotal > 0) && (
                <div
                  style={{
                    borderTop: "1px dashed #e5e7eb",
                    marginTop: 8,
                    paddingTop: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      margin: "0 0 4px",
                      fontStyle: "italic",
                    }}
                  >
                    Taxes included in MRP
                  </p>
                  {computedCgstTotal > 0 && (
                    <div
                      className="s-userdashboar-474527"
                      style={{ opacity: 0.75 }}
                    >
                      <span
                        className="s-cart-83be37"
                        style={{ fontSize: 12, color: "#6b7280" }}
                      >
                        CGST (incl. in MRP)
                      </span>
                      <span
                        className="s-cart-1c5a85"
                        style={{ fontSize: 12, color: "#6b7280" }}
                      >
                        ₹{computedCgstTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {computedSgstTotal > 0 && (
                    <div
                      className="s-userdashboar-474527"
                      style={{ opacity: 0.75 }}
                    >
                      <span
                        className="s-cart-83be37"
                        style={{ fontSize: 12, color: "#6b7280" }}
                      >
                        SGST (incl. in MRP)
                      </span>
                      <span
                        className="s-cart-1c5a85"
                        style={{ fontSize: 12, color: "#6b7280" }}
                      >
                        ₹{computedSgstTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="s-userdashboar-474527">
                  <span className="s-cart-83be37">Coupon Discount</span>
                  <span className="s-cart-1c5a85">
                    − ₹{couponDiscount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="s-cart-5258c8 checkout-summary-total">
                <span className="s-cart-4d546e">Total</span>
                <span className="s-cart-7977ea">
                  ₹{totalPayable.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Checkout buttons — wrapped in fragment to avoid JSX sibling error */}
              <>
                {isAuth ? (
                  <button onClick={handleCheckout} className="s-cart-769238">
                    {isBuyNowView ? "Checkout Buy Now →" : "Checkout Order →"}
                  </button>
                ) : (
                  <button onClick={handleCheckout} className="s-cart-769238">
                    {isBuyNowView
                      ? "Checkout Buy Now →"
                      : "Sign in to Checkout →"}
                  </button>
                )}
                <button
                  onClick={() => navigate("/all-products")}
                  className="s-cart-d3b151"
                >
                  ← Continue Shopping
                </button>
              </>

              <div className="s-cart-2a4b1d">
                {["🔒 Secure", "↩️ Easy Returns", "✅ Trusted"].map((t) => (
                  <span key={t} className="s-adminsizes-b54cfc">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cart-mobile-place-order">
        <div className="cart-mobile-place-order__meta">
          <span className="cart-mobile-place-order__count">
            {selectedItems.length} item
            {selectedItems.length !== 1 ? "s" : ""} selected
          </span>
          <span className="cart-mobile-place-order__meta-dot">•</span>
          <span className="cart-mobile-place-order__count">
            {selectedItems.reduce((s, i) => s + (i.processedQuantity || 1), 0)}{" "}
            qty
          </span>
          <span className="cart-mobile-place-order__meta-dot">•</span>
          <span className="cart-mobile-place-order__total">
            ₹{totalPayable.toLocaleString("en-IN")}
          </span>
        </div>
        <button
          onClick={handleCheckout}
          disabled={selectedItems.length === 0}
          className="cart-mobile-place-order__btn"
        >
          {isAuth
            ? isBuyNowView
              ? "Buy Now Checkout"
              : "Place Order"
            : "Sign in to Checkout"}
        </button>
      </div>
    </>
  );
}
