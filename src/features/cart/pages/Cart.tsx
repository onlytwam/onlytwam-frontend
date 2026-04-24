/**
 * Cart.tsx
 */

import { useState, useEffect, useMemo } from "react";
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
import { listUserCoupons } from "@/features/orders/api/orders.api";
import { getImageUrl, slugify } from "@/shared/utils/helpers";
import { resolveHex } from "@/shared/utils/colorHelpers";
import { useWishlistToggle } from "@/features/account/hooks/useWishlist";
import { clearBuyNowSession } from "@/shared/utils/checkoutSession";
import {
  readCheckoutSession,
  saveCheckoutSession,
} from "@/features/cart/utils/checkoutSession";
import type { CouponModel } from "@/shared/types";

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
  const {
    appliedCoupon,
    couponDiscount,
    selectedShipping,
    setCoupon,
    removeCoupon,
  } = useCartStore();

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
  const [isCouponDropdownOpen, setIsCouponDropdownOpen] = useState(false);

  const { data: profileCoupons = [], isLoading: isProfileCouponsLoading } = useQuery({
    queryKey: ["cart-profile-coupons", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await listUserCoupons({ userProfileId: String(userId) });
      return normalizeCouponResponse(res);
    },
    enabled: isAuth && Boolean(userId),
  });

  const { data: generalCoupons = [], isLoading: isGeneralCouponsLoading } = useQuery({
    queryKey: ["cart-general-coupons"],
    queryFn: async () => {
      const res = await listCoupons({
        "Page.Size": 200,
        "Order.Property": "CreatedDate",
        "Order.Ascending": false,
      });
      return normalizeCouponResponse(res).filter(isGeneralCoupon);
    },
  });

  useEffect(() => {
    if (cartData) setAuthItems(cartData);
  }, [cartData]);
  useEffect(() => {
    if (!isAuth)
      setGuestItems(
        GuestCart.get().map((i: any) => ({ ...i, isSelected: true })),
      );
  }, [isAuth]);

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

  const cartItems = isAuth ? authItems : guestItems;
  const selectedItems = cartItems.filter((i) => i.isSelected);
  const allSelected =
    cartItems.length > 0 && selectedItems.length === cartItems.length;

  const subTotal = selectedItems.reduce(
    (s, i) => s + (i.finalPrice || 0) * (i.processedQuantity || 1),
    0,
  );
  const totalPayable = Math.max(0, subTotal - (couponDiscount ?? 0));

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
      if (!existing || (source === "profile" && existing.source !== "profile")) {
        byCode.set(code, normalized);
      }
    };

    generalCoupons.forEach((coupon: any) => pushCoupon(coupon, "general"));
    profileCoupons.forEach((coupon: any) => pushCoupon(coupon, "profile"));

    const all = [...byCode.values()]
      .filter((coupon) => isCouponActive(coupon) && !isCouponExpired(coupon))
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

  const resolveCouponByCode = async (rawCode: string): Promise<DisplayCoupon | null> => {
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

      const match = fetchedCoupons.find((coupon) => getCouponCode(coupon) === code);
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

  const applyCouponByCode = async (rawCode: string, showToast = true) => {
    const code = upper(rawCode);
    if (!code) {
      if (showToast) toast.error("Enter a coupon code");
      return false;
    }

    try {
      const coupon = await resolveCouponByCode(code);
      if (!coupon) {
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
  };

  const handleCheckout = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    if (typedCouponInput && typedCouponInput !== appliedCouponCode) {
      const isCouponValid = await applyCouponByCode(typedCouponInput, true);
      if (!isCouponValid) {
        return;
      }
    }
    clearBuyNowSession();
    const store = useCartStore.getState();
    store.setSelectedItems?.(selectedItems);
    store.setSubTotal?.(subTotal);
    saveCheckoutSession({
      mode: "cart",
      items: selectedItems,
      subTotal,
      shipping: selectedShipping ?? readCheckoutSession()?.shipping ?? null,
    });
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
                                key={`${item.code}-${item.coupon.couponId ?? "profile"}`}
                                type="button"
                                onClick={() => void handleSelectCoupon(item.code)}
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
                                    {item.coupon.couponName ||
                                      "Profile coupon"}
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
                                key={`${item.code}-${item.coupon.couponId ?? "general"}`}
                                type="button"
                                onClick={() => void handleSelectCoupon(item.code)}
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
                <div
                  className="s-cart-e57b74 s-cart-coupon-summary"
                >
                  <div className="s-cart-coupon-summary__info">
                    <span className="s-cart-1c5a85">
                      {appliedCouponCode || "Coupon"} applied
                    </span>
                  </div>
                  <button onClick={handleRemoveCoupon} className="s-cart-3ecda7">
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
              <p className="s-cart-a8f4aa">
                Shipping calculated at checkout
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
                >
                  Checkout Order →
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  className="s-cart-769238"
                >
                  Checkout as Guest →
                </button>
              )}
              <button
                onClick={() => navigate(prevPath)}
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
          Place Order
        </button>
      </div>
    </>
  );
}
