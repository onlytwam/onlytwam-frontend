import { create } from 'zustand';
import type { CartModel, AppliedCouponModel, ShippingOption } from '@/shared/types';

interface CartState {
  items: CartModel[];
  totalItems: number;
  totalPrice: number;
  appliedCoupon: AppliedCouponModel | null;
  couponDiscount: number;
  selectedShipping: ShippingOption | null;
  selectAll: boolean;
  // persisted selected items for checkout flow
  _selectedItems: CartModel[];
  _subTotal: number;

  setItems: (items: CartModel[]) => void;
  toggleSelectAll: () => void;
  toggleItemSelection: (cartId: number) => void;
  /** Legacy: set coupon with pre-computed discount amount */
  applyCoupon: (coupon: AppliedCouponModel) => void;
  /** New: set coupon with separately calculated discount (used in Cart.tsx) */
  setCoupon: (coupon: any, discountAmount: number) => void;
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
  /** Store selected items for Payment / PaymentAddress pages */
  setSelectedItems: (items: CartModel[]) => void;
  setSubTotal: (v: number) => void;
}

const recalculate = (items: CartModel[]) => ({
  totalItems: items.reduce((acc, i) => acc + (i.processedQuantity || 0), 0),
  totalPrice: items.reduce(
    (acc, i) => acc + (i.finalPrice || 0) * (i.processedQuantity || 1),
    0
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

  setItems: (items) => {
    const itemsWithSelection = items.map((i) => ({ ...i, isSelected: true }));
    set({ items: itemsWithSelection, selectAll: true, ...recalculate(itemsWithSelection) });
  },

  toggleSelectAll: () => {
    const current = get().selectAll;
    const updated = get().items.map((i) => ({ ...i, isSelected: !current }));
    set({ items: updated, selectAll: !current, ...recalculate(updated) });
  },

  toggleItemSelection: (cartId) => {
    const updated = get().items.map((i) =>
      i.cartId === cartId ? { ...i, isSelected: !i.isSelected } : i
    );
    const allSelected = updated.every((i) => i.isSelected);
    set({ items: updated, selectAll: allSelected });
  },

  applyCoupon: (coupon) =>
    set({ appliedCoupon: coupon, couponDiscount: coupon.discountAmount }),

  setCoupon: (coupon, discountAmount) =>
    set({ appliedCoupon: coupon as AppliedCouponModel, couponDiscount: discountAmount }),

  removeCoupon: () => set({ appliedCoupon: null, couponDiscount: 0 }),

  setShipping: (option) => set({ selectedShipping: option }),

  getSelectedItems: () => {
    // prefer _selectedItems if set (from Cart.tsx checkout flow)
    const stored = get()._selectedItems;
    if (stored.length > 0) return stored;
    return get().items.filter((i) => i.isSelected);
  },

  getSubTotal: () => {
    const stored = get()._subTotal;
    if (stored > 0) return stored;
    return get()
      .getSelectedItems()
      .reduce((acc, i) => acc + (i.finalPrice || 0) * (i.processedQuantity || 1), 0);
  },

  getTotalPayable: () => {
    const sub      = get().getSubTotal();
    const shipping = (get().selectedShipping as any)?.cost ?? (get().selectedShipping as any)?.deliveryCharges ?? 0;
    const coupon   = get().couponDiscount;
    return Math.max(0, sub + shipping - coupon);
  },

  getTotalDiscount: () => {
    return get()
      .getSelectedItems()
      .reduce(
        (acc, i) =>
          acc + ((i.mrpPrice || 0) - (i.finalPrice || 0)) * (i.processedQuantity || 1),
        0
      );
  },

  getSelectedItemsCount: () => get().getSelectedItems().length,

  isCouponApplied: () => !!get().appliedCoupon,

  clearCart: () =>
    set({
      items: [], totalItems: 0, totalPrice: 0,
      appliedCoupon: null, couponDiscount: 0, selectedShipping: null,
      _selectedItems: [], 
    }),

  clearCheckoutSelection: () =>
    set({
      appliedCoupon: null,
      couponDiscount: 0,
      selectedShipping: null,
      _selectedItems: [],
      _subTotal: 0,
     
    }),

  setSelectedItems: (items) => set({ _selectedItems: items }),
  setSubTotal:      (v)     => set({ _subTotal: v }),
}));
