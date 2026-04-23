import type { CartModel, ShippingOption } from "@/shared/types";

export type CheckoutMode = "cart" | "buyNow";

export interface CheckoutSessionState {
  mode: CheckoutMode;
  items: CartModel[];
  subTotal: number;
  shipping?: ShippingOption | null;
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


export const readCheckoutSession = (): CheckoutSessionState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutSessionState> | null;
    if (!parsed || !Array.isArray(parsed.items)) return null;

    const items = parsed.items.map(normalizeItem);
    const subTotal = toNumber(parsed.subTotal, computeSubTotal(items));

    return {
      mode: parsed.mode === "buyNow" ? "buyNow" : "cart",
      items,
      subTotal,
      shipping: parsed.shipping ?? null,
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
}) => {
  if (typeof window === "undefined") return;

  const items = (session.items ?? []).map(normalizeItem);
  const subTotal = session.subTotal ?? computeSubTotal(items);

  const payload: CheckoutSessionState = {
    mode: session.mode === "buyNow" ? "buyNow" : "cart",
    items,
    subTotal,
    shipping: session.shipping ?? null,
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

  const next: CheckoutSessionState = {
    mode: extras?.mode ?? current.mode,
    items: nextItems.map(normalizeItem),
    subTotal,
    shipping: extras?.shipping ?? current.shipping ?? null,
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
