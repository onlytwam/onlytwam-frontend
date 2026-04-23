import type { CartModel, ShippingOption } from "@/shared/types";

const BUY_NOW_SESSION_KEY = "buyNowCheckout";

export interface BuyNowSession {
  items: CartModel[];
  subTotal: number;
<<<<<<< Updated upstream
=======
  taxAmount: number;
  shipping?: ShippingOption | null;
>>>>>>> Stashed changes
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
    return parsed;
  } catch {
    return null;
  }
};

export const setBuyNowSession = (items: CartModel[]) => {
  const safeItems = Array.isArray(items) ? items : [];
  const subTotal = safeItems.reduce(
    (sum, item) =>
      sum +
      Number(item.finalPrice || 0) * Number(item.processedQuantity || 1),
    0,
  );
  const payload: BuyNowSession = {
    items: safeItems,
    subTotal,
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

