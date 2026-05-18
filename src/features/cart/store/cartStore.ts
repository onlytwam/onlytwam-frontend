import { create } from "zustand";
import type {
  CartModel,
  AppliedCouponModel,
  ShippingOption,
} from "@/shared/types";

interface CartState {
  items: CartModel[];
  totalItems: number;
  totalPrice: number;
  appliedCoupon: AppliedCouponModel | null;
  couponDiscount: number;
  selectedShipping: ShippingOption | null;
  selectAll: boolean;
  _selectedItems: CartModel[];
  _subTotal: number;

  /**
   * When a physical (store-issued) coupon is applied, its code is stored here
   * so the payment page can mark it as used after the order is created.
   * null = digital coupon or no coupon applied.
   */
  physicalCouponCode: string | null;

  setItems: (items: CartModel[]) => void;
  toggleSelectAll: () => void;
  toggleItemSelection: (cartId: number) => void;
  applyCoupon: (coupon: AppliedCouponModel) => void;
  setCoupon: (coupon: any, discountAmount: number) => void;
  setPhysicalCouponCode: (code: string | null) => void;
  removeCoupon: () => void;
  setShipping: (option: ShippingOption | null) => void;
  getSelectedItems: () => CartModel[];
  getSubTotal: () => number;
  getTotalPayable: () => number;
  getTotalDiscount: () => number;
  getSelectedItemsCount: () => number;
  isCouponApplied: () => boolean;
  clearCart: () => void;
  clearCheckoutSelection: () => void;
  setSelectedItems: (items: CartModel[]) => void;
  setSubTotal: (v: number) => void;
}

const recalculate = (items: CartModel[]) => ({
  totalItems: items.reduce((acc, i) => acc + (i.processedQuantity || 0), 0),
  totalPrice: items.reduce(
    (acc, i) => acc + (i.finalPrice || 0) * (i.processedQuantity || 1),
    0,
  ),
});

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  totalItems: 0,
  totalPrice: 0,
  appliedCoupon: null,
  couponDiscount: 0,
  selectedShipping: null,
  selectAll: false,
  _selectedItems: [],
  _subTotal: 0,
  physicalCouponCode: null,

  setItems: (items) => {
    // Preserve explicit selection state from any previous render of the same
    // cart items (e.g. user de-selected something before proceeding to
    // checkout).  Only fall back to isSelected=true for brand-new items that
    // didn't exist before.
    const existingMap = new Map(
      get().items.map((i) => [i.cartId, i.isSelected]),
    );
    const itemsWithSelection = items.map((i) => ({
      ...i,
      isSelected: existingMap.has(i.cartId) ? existingMap.get(i.cartId)! : true,
    }));
    const allSelected =
      itemsWithSelection.length > 0 &&
      itemsWithSelection.every((i) => i.isSelected);
    set({
      items: itemsWithSelection,
      selectAll: allSelected,
      ...recalculate(itemsWithSelection),
    });
  },

  toggleSelectAll: () => {
    const current = get().selectAll;
    const updated = get().items.map((i) => ({ ...i, isSelected: !current }));
    set({ items: updated, selectAll: !current, ...recalculate(updated) });
  },

  toggleItemSelection: (cartId) => {
    const updated = get().items.map((i) =>
      i.cartId === cartId ? { ...i, isSelected: !i.isSelected } : i,
    );
    const allSelected = updated.every((i) => i.isSelected);
    set({ items: updated, selectAll: allSelected });
  },

  applyCoupon: (coupon) =>
    set({ appliedCoupon: coupon, couponDiscount: coupon.discountAmount }),

  setCoupon: (coupon, discountAmount) =>
    set({
      appliedCoupon: coupon as AppliedCouponModel,
      couponDiscount: discountAmount,
    }),

  setPhysicalCouponCode: (code) => set({ physicalCouponCode: code }),

  removeCoupon: () =>
    set({ appliedCoupon: null, couponDiscount: 0, physicalCouponCode: null }),

  setShipping: (option) => set({ selectedShipping: option }),

  getSelectedItems: () => {
    const stored = get()._selectedItems;
    if (stored.length > 0) return stored;
    // FIX: Only fall back to live cart items if we have NO session items at all.
    // Previously this always fell through when _selectedItems was empty, which
    // caused phantom products: after a refetch, items defaulted to isSelected:true
    // so ALL cart items were returned here — even ones the user had unchecked.
    //
    // Now: if _selectedItems is empty we return an empty array. The Payment page
    // already guards against an empty list (redirects to cart). Callers that
    // need the live-cart selection (e.g., Cart.tsx itself) use local state, not
    // this store method.
    return get().items.filter((i) => i.isSelected);
  },

  getSubTotal: () => {
    const stored = get()._subTotal;
    if (stored > 0) return stored;
    return get()
      .getSelectedItems()
      .reduce(
        (acc, i) => acc + (i.finalPrice || 0) * (i.processedQuantity || 1),
        0,
      );
  },

  getTotalPayable: () => {
    const sub = get().getSubTotal();
    const shipping =
      (get().selectedShipping as any)?.cost ??
      (get().selectedShipping as any)?.deliveryCharges ??
      0;
    const coupon = get().couponDiscount;
    return Math.max(0, sub + shipping - coupon);
  },

  getTotalDiscount: () =>
    get()
      .getSelectedItems()
      .reduce(
        (acc, i) =>
          acc +
          ((i.mrpPrice || 0) - (i.finalPrice || 0)) *
            (i.processedQuantity || 1),
        0,
      ),

  getSelectedItemsCount: () => get().getSelectedItems().length,

  isCouponApplied: () => !!get().appliedCoupon,

  clearCart: () =>
    set({
      items: [],
      totalItems: 0,
      totalPrice: 0,
      appliedCoupon: null,
      couponDiscount: 0,
      selectedShipping: null,
      _selectedItems: [],
      physicalCouponCode: null,
    }),

  clearCheckoutSelection: () =>
    set({
      appliedCoupon: null,
      couponDiscount: 0,
      selectedShipping: null,
      _selectedItems: [],
      _subTotal: 0,
      physicalCouponCode: null,
    }),

  setSelectedItems: (items) => set({ _selectedItems: items }),
  setSubTotal: (v) => set({ _subTotal: v }),
}));
