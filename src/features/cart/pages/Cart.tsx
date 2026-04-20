/**
 * Cart.tsx
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { getImageUrl, slugify } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { clearBuyNowSession } from "@/shared/utils/checkoutSession";

const TAX_RATE = 0.05;

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
  remove: (pvId: number) =>
    GuestCart.set(
      GuestCart.get().filter((i: any) => i.productVariantId !== pvId),
    ),
  updateQty: (pvId: number, qty: number) =>
    GuestCart.set(
      GuestCart.get().map((i: any) =>
        i.productVariantId === pvId
          ? { ...i, processedQuantity: qty, quantity: qty }
          : i,
      ),
    ),
};

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
  const prevPath =
    (location.state as any)?.from ||
    sessionStorage.getItem("lastPage") ||
    "/user-products/product-list";
  const qc = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();
  const { appliedCoupon, couponDiscount, setCoupon, removeCoupon } =
    useCartStore();

  const isAuth = hasValidToken();
  const userId = getUserId();

  const { data: cartData, isLoading } = useQuery({
    queryKey: ["cart", userId],
    queryFn: () => listCart({ userProfileId: userId }),
    enabled: isAuth,
    select: (data: any) =>
      (data?.list ?? data ?? []).map((item: any) => ({
        ...item,
        isSelected: true,
        finalPrice: Number(item.finalPrice || item.price) || 0,
        processedQuantity: Number(item.quantity) || 1,
      })),
  });

  const [authItems, setAuthItems] = useState<any[]>([]);
  const [guestItems, setGuestItems] = useState<any[]>([]);
  const [couponInput, setCouponInput] = useState("");

  useEffect(() => {
    if (cartData) setAuthItems(cartData);
  }, [cartData]);
  useEffect(() => {
    if (!isAuth)
      setGuestItems(
        GuestCart.get().map((i: any) => ({ ...i, isSelected: true })),
      );
  }, [isAuth]);

  const cartItems = isAuth ? authItems : guestItems;
  const selectedItems = cartItems.filter((i) => i.isSelected);
  const allSelected =
    cartItems.length > 0 && selectedItems.length === cartItems.length;

  const subTotal = selectedItems.reduce(
    (s, i) => s + (i.finalPrice || 0) * (i.processedQuantity || 1),
    0,
  );
  const taxAmount = Math.round(subTotal * TAX_RATE);
  const totalPayable = Math.max(0, subTotal - (couponDiscount ?? 0));

  const updateMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateCart(id, { quantity: qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["quick-cart"] });
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

  const handleQtyChange = (item: any, qty: number) => {
    if (qty < 1) return;
    if (isAuth) {
      updateMutation.mutate({ id: item.cartId, qty });
      setAuthItems((prev) =>
        prev.map((i) =>
          i.cartId === item.cartId ? { ...i, processedQuantity: qty } : i,
        ),
      );
    } else {
      GuestCart.updateQty(item.productVariantId, qty);
      setGuestItems((prev) =>
        prev.map((i) =>
          i.productVariantId === item.productVariantId
            ? { ...i, processedQuantity: qty, quantity: qty }
            : i,
        ),
      );
    }
  };

  const handleRemove = (item: any) => {
    if (isAuth) deleteMutation.mutate(item.cartId);
    else {
      GuestCart.remove(item.productVariantId);
      setGuestItems((prev) => {
        const updated = prev.filter(
          (i: any) => i.productVariantId !== item.productVariantId,
        );
        window.dispatchEvent(new Event("guestCartUpdated"));
        return updated;
      });
      toast.success("Item removed");
    }
  };

  const toggleSelect = (item: any) => {
    const fn = (arr: any[]) =>
      arr.map((i) => {
        const match = isAuth
          ? i.cartId === item.cartId
          : i.productVariantId === item.productVariantId;
        return match ? { ...i, isSelected: !i.isSelected } : i;
      });
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const toggleAll = () => {
    const val = !allSelected;
    const fn = (arr: any[]) => arr.map((i) => ({ ...i, isSelected: val }));
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const handleClearCart = () => {
    if (isAuth) setAuthItems([]);
    else {
      GuestCart.set([]);
      setGuestItems([]);
    }
    toast.success("Cart cleared");
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      toast.error("Enter a coupon code");
      return;
    }
    try {
      const res = await listCoupons({
        Filters: JSON.stringify([
          {
            property: "CouponCode",
            comparison: "eq",
            value: couponInput.trim().toLowerCase(),
          },
        ]),
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

  const handleCheckout = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }
    clearBuyNowSession();
    const store = useCartStore.getState();
    store.setSelectedItems?.(selectedItems);
    store.setSubTotal?.(subTotal);
    store.setTaxAmount?.(taxAmount);
    if (!isAuth) {
      navigate("/user-products/payment-address");
      return;
    }
    try {
      await checkOutOfStock({
        orderItems: selectedItems
          .filter((i) => i.productVariantDetailId)
          .map((i) => ({ productVariantDetailId: i.productVariantDetailId })),
      });
      navigate("/user-products/payment-address");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Some items are out of stock");
    }
  };

  if (isLoading)
    return (
      <div className="d-flex justify-content-center align-items-center s-cart-cd9eb3">
        <div className="spinner-border s-cart-8398cc" />
      </div>
    );

  if (cartItems.length === 0)
    return (
      <div className="container py-5">
        <div className="d-flex flex-column align-items-center s-cart-cd9eb3">
          <i className="bi bi-cart-x s-cart-b5dbda" />
          <h5 className="mt-4 text-muted">Your cart is empty</h5>
          <p className="text-muted">
            Looks like you haven't added anything yet.
          </p>
          <button onClick={() => navigate(prevPath)} className="s-cart-289753">
            ← Continue Shopping
          </button>
        </div>
      </div>
    );

  return (
    <>
      <div className="checkout-mobile-header" style={{ display: "none" }}>
        <button
          className="checkout-mobile-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <i className="bi bi-chevron-left" />
        </button>
        <h1 className="cart-page-mobile-title">Cart</h1>
      </div>

      <div className="container s-cart-2eb199">
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
            {cartItems.map((item: any) => (
              <div
                key={item.cartId ?? item.productVariantId}
                className="s-cart-100fbc"
                style={{
                  background: item.isSelected ? "rgba(107,15,42,0.03)" : "#fff",
                }}
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

                  {/* Color + Size */}
                  <div className="s-cart-0e031f">
                    {(item.colorName || item.color) && (
                      <span className="s-cart-c8ff6d">
                        <span
                          className="s-cart-552e26"
                          style={{
                            background: resolveHex(item.colorHex ?? item.color),
                          }}
                        />
                        {item.colorName ?? item.color}
                      </span>
                    )}
                    {(item.size || item.bandSize) && (
                      <span className="s-adminnewslet-f01220">
                        Band Size: <strong>{item.size || item.bandSize}</strong>
                      </span>
                    )}
                    {item.cupSize && (
                      <span className="s-adminnewslet-f01220">
                        Cup Size: <strong>{item.cupSize}</strong>
                      </span>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="s-adminbar-877368">
                    <span className="s-adminnewslet-f01220">Quantity:</span>
                    <div className="s-cart-13c6e0">
                      <button
                        onClick={() =>
                          handleQtyChange(
                            item,
                            (item.processedQuantity || 1) - 1,
                          )
                        }
                        className="s-cart-bbdb9d"
                      >
                        −
                      </button>
                      <span className="s-cart-686e55">
                        {item.processedQuantity || 1}
                      </span>
                      <button
                        onClick={() =>
                          handleQtyChange(
                            item,
                            (item.processedQuantity || 1) + 1,
                          )
                        }
                        className="s-cart-bbdb9d"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: price + save + delete */}
                <div className="s-cart-4c5975">
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
                Clear Shopping Cart
              </button>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="col-lg-4">
            <div className="s-cart-a4c113">
              {/* Coupon */}
              <h6 className="s-cart-d1f5ec">Apply Coupon Code</h6>
              {appliedCoupon ? (
                <div className="s-cart-1914b7">
                  <span className="s-cart-1c5a85">
                    {(appliedCoupon as any).couponCode} applied
                  </span>
                  <button onClick={removeCoupon} className="s-cart-3ecda7">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="s-cart-e57b74">
                  <input
                    value={couponInput}
                    onChange={(e) =>
                      setCouponInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                    placeholder="Coupon code"
                    className="s-cart-d635cd"
                  />
                  <button onClick={handleApplyCoupon} className="s-cart-6ee566">
                    Apply
                  </button>
                </div>
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
              <p className="s-cart-a8f4aa">
                GST and shipping calculated at checkout
              </p>

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
                  <button
                    onClick={handleCheckout}
                    className="s-cart-769238"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--blush)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--brand)")
                    }
                  >
                    Checkout Order →
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    className="s-cart-769238"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--blush)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--brand)")
                    }
                  >
                    Checkout as Guest →
                  </button>
                )}
                <button
                  onClick={() => navigate(prevPath)}
                  className="s-cart-d3b151"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(107,15,42,.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
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

      <div className="cart-mobile-place-order" style={{ display: "none" }}>
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
          Place Order
        </button>
      </div>
    </>
  );
}
