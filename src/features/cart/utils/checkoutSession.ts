import type { CartModel, ShippingOption } from "@/shared/types";
import {
  buildSurpriseGiftSignature,
  type SurpriseGiftSelection,
} from "@/shared/utils/surpriseGift";

export type CheckoutMode = "cart" | "buyNow";
const SURPRISE_GIFT_FLOW_VERSION = 2;

export interface CheckoutSessionState {
  mode: CheckoutMode;
  items: CartModel[];
  subTotal: number;
  shipping?: ShippingOption | null;
  surpriseGift?: SurpriseGiftSelection | null;
  cartSignature?: string;
  giftFlowVersion?: number;
  giftCheckoutKey?: string | null;
  createdAt: string;
}

const STORAGE_KEY = "checkoutSession";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeItem = (item: CartModel): CartModel => ({
  ...item,
  cartId: Number(item.cartId ?? 0),
  processedQuantity: Number(item.processedQuantity ?? 1),
  isSelected: item.isSelected ?? true,
});

const computeSubTotal = (items: CartModel[]) =>
  items.reduce(
    (sum, item) =>
      sum +
      toNumber(item.finalPrice) * toNumber(item.processedQuantity ?? 1, 1),
    0,
  );

const normalizeSurpriseGift = (
  gift: Partial<SurpriseGiftSelection> | null | undefined,
): SurpriseGiftSelection | null => {
  const resolved = gift?.internalGiftId
    ? {
        threshold: toNumber(gift.threshold, 0),
        internalGiftId: String(gift.internalGiftId),
        label: String(gift.label || "Surprise Gift"),
        displayPrice: toNumber(gift.displayPrice, 0),
      }
    : null;

  return resolved;
};


export const readCheckoutSession = (): CheckoutSessionState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutSessionState> | null;
    if (!parsed || !Array.isArray(parsed.items)) return null;

    const items = parsed.items.map(normalizeItem);
    const subTotal = toNumber(parsed.subTotal, computeSubTotal(items));
    const cartSignature =
      typeof parsed.cartSignature === "string"
        ? parsed.cartSignature
        : buildSurpriseGiftSignature(items as any);
    const giftFlowVersion = toNumber(parsed.giftFlowVersion, 0);
    const surpriseGift =
      giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION
        ? normalizeSurpriseGift(parsed.surpriseGift)
        : null;

    return {
      mode: parsed.mode === "buyNow" ? "buyNow" : "cart",
      items,
      subTotal,
      shipping: parsed.shipping ?? null,
      surpriseGift,
      cartSignature,
      giftFlowVersion,
      giftCheckoutKey:
        typeof parsed.giftCheckoutKey === "string"
          ? parsed.giftCheckoutKey
          : null,
      createdAt:
        typeof parsed.createdAt === "string"
          ? parsed.createdAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const readCheckoutItems = () => readCheckoutSession()?.items ?? [];

export const saveCheckoutSession = (session: {
  mode?: CheckoutMode;
  items: CartModel[];
  subTotal?: number;
  shipping?: ShippingOption | null;
  surpriseGift?: SurpriseGiftSelection | null;
  cartSignature?: string;
  giftCheckoutKey?: string | null;
}) => {
  if (typeof window === "undefined") return;

  const items = (session.items ?? []).map(normalizeItem);
  const subTotal = session.subTotal ?? computeSubTotal(items);
  const cartSignature =
    session.cartSignature ?? buildSurpriseGiftSignature(items as any);
  const current = readCheckoutSession();
  const hasGiftOverride = Object.prototype.hasOwnProperty.call(
    session,
    "surpriseGift",
  );
  const surpriseGift = hasGiftOverride
    ? normalizeSurpriseGift(session.surpriseGift)
    : current?.giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION &&
        current.cartSignature === cartSignature
      ? normalizeSurpriseGift(current.surpriseGift)
      : null;
  const giftCheckoutKey = surpriseGift
    ? hasGiftOverride
      ? session.giftCheckoutKey ?? null
      : current?.giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION &&
          current.cartSignature === cartSignature
        ? current.giftCheckoutKey ?? null
        : null
    : null;

  const payload: CheckoutSessionState = {
    mode: session.mode === "buyNow" ? "buyNow" : "cart",
    items,
    subTotal,
    shipping: session.shipping ?? null,
    surpriseGift,
    cartSignature,
    giftFlowVersion: SURPRISE_GIFT_FLOW_VERSION,
    giftCheckoutKey,
    createdAt: new Date().toISOString(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const updateCheckoutSessionItems = (
  updater: (items: CartModel[]) => CartModel[],
  extras?: Partial<Omit<CheckoutSessionState, "items" | "createdAt">>,
) => {
  const current = readCheckoutSession();
  if (!current) return null;

  const nextItems = updater(current.items);
  const subTotal = extras?.subTotal ?? computeSubTotal(nextItems);
  const cartSignature =
    extras?.cartSignature ?? buildSurpriseGiftSignature(nextItems as any);
  const hasGiftOverride = Object.prototype.hasOwnProperty.call(
    extras ?? {},
    "surpriseGift",
  );
  const surpriseGift = hasGiftOverride
    ? normalizeSurpriseGift(extras?.surpriseGift)
    : current?.giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION &&
        current.cartSignature === cartSignature
      ? normalizeSurpriseGift(current.surpriseGift)
      : null;
  const giftCheckoutKey = surpriseGift
    ? hasGiftOverride
      ? extras?.giftCheckoutKey ?? null
      : current?.giftFlowVersion === SURPRISE_GIFT_FLOW_VERSION &&
          current.cartSignature === cartSignature
        ? current.giftCheckoutKey ?? null
        : null
    : null;

  const next: CheckoutSessionState = {
    mode: extras?.mode ?? current.mode,
    items: nextItems.map(normalizeItem),
    subTotal,
    shipping: extras?.shipping ?? current.shipping ?? null,
    surpriseGift,
    cartSignature,
    giftFlowVersion: SURPRISE_GIFT_FLOW_VERSION,
    giftCheckoutKey,
    createdAt: new Date().toISOString(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const updateCheckoutSessionShipping = (
  shipping: ShippingOption | null,
) => {
  const current = readCheckoutSession();
  if (!current) return null;

  const next: CheckoutSessionState = {
    ...current,
    shipping,
    createdAt: new Date().toISOString(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const clearCheckoutSession = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
};

export const isBuyNowCheckout = () => readCheckoutSession()?.mode === "buyNow";
