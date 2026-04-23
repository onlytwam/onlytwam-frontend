// src/features/orders/pages/OrderConfirm.tsx  (FIXED)
//
// Fixes:
//  ① shippingAddress.state → shippingAddress.city only (backend AddressResponse
//    returns {addressLine, city, pinCode, phone, name} — no .state field from
//    the simple _get_address() helper used in get_order_details)
//  ② Show full address line from shippingAddress.addressLine
//  ③ Removed unused navigate import

import { useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderDetail } from "@/features/orders/api/orders.api";
import { useCartStore } from "@/features/cart/store/cartStore";
import { useAuthStore } from "@/features/auth/store/authStore";
import { formatDate } from "@/shared/utils/helpers";
import {
  clearBuyNowSession,
  getBuyNowSession,
} from "@/shared/utils/checkoutSession";

export default function OrderConfirm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartStore();
  const { setCartCount } = useAuthStore();
  const qc = useQueryClient();
  const isBuyNowOrder = !!getBuyNowSession()?.items?.length;
  const paymentSucceeded = searchParams.get("payment") === "success";

  // Clear cart only after the backend confirms payment success.
  useEffect(() => {
    if (!paymentSucceeded) return;

    clearCart();
    if (isBuyNowOrder) {
      clearBuyNowSession();
    } else {
      setCartCount(0);
      localStorage.removeItem("guestCart");
    }
    localStorage.removeItem("guest_token");
    sessionStorage.removeItem("selectedAddressId");
    sessionStorage.removeItem("guestAddress");
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["cart-bootstrap"] });
    qc.invalidateQueries({ queryKey: ["quick-cart"] });
  }, [
    paymentSucceeded,
    isBuyNowOrder,
    qc,
    clearCart,
    setCartCount,
  ]);

  const { data: order } = useQuery({
    queryKey: ["order-confirm", id],
    queryFn: () => getOrderDetail(Number(id)),
    enabled: !!id && id !== "new",
    retry: false,
  });

  // Backend returns shippingAddress: { addressId, name, addressLine, city, pinCode, phone }
  // Note: stateName is NOT included in the simple _get_address() helper result.
  // We display city + pinCode which are always present.
  const addr = (order as any)?.shippingAddress;
  const addrLine = addr
    ? [addr.addressLine, addr.city, addr.pinCode].filter(Boolean).join(", ")
    : "";

  return (
    <div className="container s-orderconfirm-9e0ea5">
      {/* Success icon */}
      <div className="s-orderconfirm-2aba39">
        <i className="bi bi-check-lg s-orderconfirm-03029b" />
      </div>

      <h2 className="s-orderconfirm-388feb">Order Placed!</h2>
      <p className="s-orderconfirm-e4337f">
        Thank you for shopping with Only TWAM. Your order has been received and
        is being processed.
      </p>

      {/* Order summary card */}
      {order && (
        <div className="s-orderconfirm-d99ec0">
          <div className="s-orderconfirm-dd3540">
            <div>
              <p className="s-admindashboa-75a6ca">Order Number</p>
              <p className="s-orderconfirm-940150">
                #{(order as any).orderNumber || id}
              </p>
            </div>
            <div className="s-quickcart-f66ceb">
              <p className="s-admindashboa-75a6ca">Order Date</p>
              <p className="s-orderconfirm-c6389e">
                {formatDate(
                  (order as any).orderDate || (order as any).createdAt,
                )}
              </p>
            </div>
          </div>

          {/* Amounts */}
          <div className="s-orderconfirm-3a9663">
            <div className="s-orderconfirm-0b9a8f">
              <span className="s-orderconfirm-9e786f">Total Amount</span>
              <span className="s-orderconfirm-5c2925">
                ₹{((order as any).totalAmount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            {(order as any).deliveryCharge !== undefined && (
              <div className="s-orderconfirm-39c60a">
                <span className="s-quickcart-08341f">Shipping</span>
                <span className="s-addresslist-9eec06">
                  {(order as any).deliveryCharge === 0
                    ? "FREE"
                    : `₹${(order as any).deliveryCharge}`}
                </span>
              </div>
            )}
          </div>

          {/* Delivery address — use only fields returned by backend */}
          {addr && (
            <div style={{ marginTop: 16 }}>
              <p className="s-admininvento-b153ec">Delivering to</p>
              <p className="s-orderconfirm-c6389e">
                <strong>{addr.name}</strong>
              </p>
              <p
                className="s-orderconfirm-c6389e"
                style={{ color: "#666", marginTop: 2 }}
              >
                {addrLine}
              </p>
              {addr.phone && (
                <p
                  className="s-orderconfirm-c6389e"
                  style={{ color: "#666", marginTop: 2 }}
                >
                  📞 {addr.phone}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Email notice */}
      <div className="s-orderconfirm-98b39a">
        <p className="s-orderconfirm-ac3361">
          <i className="bi bi-envelope me-2" />A confirmation email will be sent
          to your registered email address.
        </p>
      </div>

      {/* Actions */}
      <div className="s-orderconfirm-2138f5">
        <Link to="/account/orders-list" className="s-orderconfirm-8dd047">
          <i className="bi bi-bag me-2" />
          Track Order
        </Link>
        {id && id !== "new" && (
          <Link
            to={`/user-products/invoice-details/${id}`}
            className="s-orderconfirm-e3c8b5"
          >
            <i className="bi bi-file-earmark-text me-2" />
            View Invoice
          </Link>
        )}
        <Link to="/" className="s-orderconfirm-e3c8b5">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
