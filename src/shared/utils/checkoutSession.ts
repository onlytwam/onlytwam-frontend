import type { CartModel, ShippingOption } from "@/shared/types";
import {
  buildSurpriseGiftSignature,
  type SurpriseGiftSelection,
} from "@/shared/utils/surpriseGift";

const BUY_NOW_SESSION_KEY = "buyNowCheckout";
// Bump this whenever the session shape changes — old sessions are discarded
export const SURPRISE_GIFT_FLOW_VERSION = 2;

export interface BuyNowSession {
  items: CartModel[];
  subTotal: number;
  cgstTotal?: number;
  sgstTotal?: number;
  shipping?: ShippingOption | null;
  surpriseGift?: SurpriseGiftSelection | null;
  cartSignature?: string;
  giftFlowVersion?: number;
  giftCheckoutKey?: string | null;
  createdAt: number;
}

const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const readRawSession = (): BuyNowSession | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(BUY_NOW_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuyNowSession;
    if (!parsed?.items?.length) return null;
    const cartSignature =
      typeof parsed.cartSignature === "string"
        ? parsed.cartSignature
        : buildSurpriseGiftSignature(parsed.items as any);
    return {
      ...parsed,
      cartSignature,
      giftFlowVersion: Number(parsed.giftFlowVersion ?? 0),
      giftCheckoutKey:
        typeof parsed.giftCheckoutKey === "string"
          ? parsed.giftCheckoutKey
          : null,
      surpriseGift:
        Number(parsed.giftFlowVersion ?? 0) === SURPRISE_GIFT_FLOW_VERSION
          ? parsed.surpriseGift ?? null
          : null,
    };
  } catch {
    return null;
  }
};

/** Compute CGST total from items using stored PVD rates. qty × (finalPrice × cgst%) */
const computeItemsCgst = (items: CartModel[]): number =>
  items.reduce((sum, i: any) => {
    const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
    const price = Number(i.finalPrice || 0);
    if (i.cgst > 0) return sum + ((price * Number(i.cgst)) / 100) * qty;
    // fallback: split stored taxAmount evenly
    return sum + (Number(i.taxAmount || 0) * qty) / 2;
  }, 0);

const computeItemsSgst = (items: CartModel[]): number =>
  items.reduce((sum, i: any) => {
    const qty = Number(i.processedQuantity ?? i.quantity ?? 1) || 1;
    const price = Number(i.finalPrice || 0);
    if (i.sgst > 0) return sum + ((price * Number(i.sgst)) / 100) * qty;
    return sum + (Number(i.taxAmount || 0) * qty) / 2;
  }, 0);

export const setBuyNowSession = (
  items: CartModel[],
  options?: {
    shipping?: ShippingOption | null;
    surpriseGift?: SurpriseGiftSelection | null;
    cartSignature?: string;
    giftCheckoutKey?: string | null;
    cgstTotal?: number;
    sgstTotal?: number;
  },
) => {
  const safeItems = Array.isArray(items) ? items : [];
  const subTotal = safeItems.reduce(
    (sum, item) =>
      sum + Number(item.finalPrice || 0) * Number(item.processedQuantity || 1),
    0,
  );
  // Use caller-supplied totals when provided; otherwise derive from PVD stored rates
  const cgstTotal = options?.cgstTotal ?? computeItemsCgst(safeItems);
  const sgstTotal = options?.sgstTotal ?? computeItemsSgst(safeItems);
  const cartSignature =
    options?.cartSignature ?? buildSurpriseGiftSignature(safeItems as any);
  const payload: BuyNowSession = {
    items: safeItems,
    subTotal,
    cgstTotal,
    sgstTotal,
    shipping: options?.shipping ?? null,
    surpriseGift: options?.surpriseGift ?? null,
    cartSignature,
    giftFlowVersion: SURPRISE_GIFT_FLOW_VERSION,
    giftCheckoutKey: options?.surpriseGift
      ? options?.giftCheckoutKey ?? null
      : null,
    createdAt: Date.now(),
  };

  if (canUseSessionStorage()) {
    sessionStorage.setItem(BUY_NOW_SESSION_KEY, JSON.stringify(payload));
  }

  return payload;
};

export const getBuyNowSession = () => readRawSession();

export const clearBuyNowSession = () => {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(BUY_NOW_SESSION_KEY);
};
