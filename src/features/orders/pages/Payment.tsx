import { getImageUrl } from '@/shared/utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/cart/store/cartStore';
import { createOrder, listAddress } from '@/features/orders/api/orders.api';

const PAYMENT_METHOD = {
  id: 'online',
  label: 'Online Payment',
  icon: 'bi-credit-card',
  desc: 'UPI, Credit/Debit Card, Net Banking',
};

export default function Payment() {
  const navigate = useNavigate();
  const { getUserId } = useAuthStore();
  const {
    getSelectedItems,
    getSubTotal,
    getTaxAmount,
    selectedShipping,
    couponDiscount,
    appliedCoupon,
  } = useCartStore();
  const userId = getUserId();

  const selectedAddressId = Number(sessionStorage.getItem('selectedAddressId') || 0);

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    select: (d: any) => d?.list ?? d ?? [],
  });

  const selectedItems = getSelectedItems();
  const subTotal = getSubTotal();
  const taxAmount = getTaxAmount();
  const shippingCost = Number((selectedShipping as any)?.cost ?? (selectedShipping as any)?.deliveryCharges ?? 0);
  const totalPayable = Math.max(0, subTotal + taxAmount + shippingCost - (couponDiscount ?? 0));

  const deliveryAddress: any = (addresses as any[]).find((a: any) => a.addressId === selectedAddressId);
  const addrLine = deliveryAddress
    ? [deliveryAddress.addressLine, deliveryAddress.city, deliveryAddress.pinCode].filter(Boolean).join(', ')
    : '';

  const orderMutation = useMutation({
    mutationFn: (payload: any) => createOrder(payload),
    onSuccess: (data: any) => {
      if (data?.paymentProcessUrl) {
        window.location.href = data.paymentProcessUrl;
        return;
      }
      toast.error('Payment integration is not connected yet. The backend did not return a payment URL.');
    },
    onError: (e: any) => toast.error(
      e?.response?.data?.message || e?.response?.data?.detail || 'Failed to start payment. Please try again.'
    ),
  });

  const handlePlaceOrder = () => {
    if (!selectedAddressId) {
      toast.error('Please go back and select a delivery address');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (!selectedShipping?.shippingTypeId) {
      toast.error('Please go back and select a shipping option');
      return;
    }
    if (selectedShipping?.isEligible === false) {
      toast.error('Selected shipping option is not available for this order total');
      return;
    }

    orderMutation.mutate({
      userProfileId: userId,
      subTotal,
      totalAmount: totalPayable,
      taxAmount,
      deliveryCharge: shippingCost,
      shippingTypeId: (selectedShipping as any)?.shippingTypeId ?? null,
      shippingAddressId: selectedAddressId,
      billingAddressId: selectedAddressId,
      couponId: appliedCoupon?.couponId ?? null,
      couponAmount: couponDiscount ?? 0,
      cartId: selectedItems.map((i: any) => i.cartId),
      orderNumber: null,
      paymentMethod: 'Online Payment',
      isWhatsappNotification: false,
      orderItems: selectedItems.map((i: any) => ({
        productId: i.productId,
        productVariantDetailId: i.productVariantDetailId,
        quantity: i.processedQuantity || 1,
        price: i.finalPrice,
      })),
    });
  };

  return (
    <div className="container s-orderdetails-c93f0f checkout-shell checkout-shell--payment">
      <h4 className="checkout-page-title">Payment</h4>

      <div className="row g-4">
        <div className="col-lg-8">
          {deliveryAddress && (
            <div className="checkout-card checkout-card--address border rounded p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Delivering to</h6>
                <button onClick={() => navigate('/user-products/payment-address')} className="btn btn-sm btn-link p-0 text-dark">Change</button>
              </div>
              <p className="mb-0 fw-semibold s-addresslist-92985e">{deliveryAddress.name}</p>
              <p className="mb-0 text-muted s-addresslist-9eec06">{addrLine}</p>
              <p className="mb-0 text-muted s-addresslist-9eec06">{deliveryAddress.phone}</p>
            </div>
          )}

          <h6 className="mb-3">Payment Method</h6>
          <div
            className="s-payment-f22545 checkout-card checkout-card--payment-method"
            style={{ border: '2px solid #000000', background: 'var(--ivory)' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="s-payment-46e910"
                style={{ border: '2px solid #000000', background: '#000000' }}
              >
                <div className="s-payment-108f10" />
              </div>
              <i className={`bi ${PAYMENT_METHOD.icon} s-payment-bbcbc9`} />
              <div>
                <p className="mb-0 fw-semibold s-addresslist-92985e">{PAYMENT_METHOD.label}</p>
                <p className="mb-0 text-muted s-couponslist-030edf">{PAYMENT_METHOD.desc}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="border rounded p-4 position-sticky s-payment-429933 checkout-card checkout-summary-card">
            <div className="checkout-section-head">
              <h6 className="checkout-section-head__title">Order Summary</h6>
              <p className="checkout-section-head__text">Everything you are paying for, at a glance.</p>
            </div>
            <div className="s-payment-726fa8">
              {selectedItems.map((item: any, i: number) => (
                <div key={i} className="d-flex gap-3 mb-3 checkout-summary-item">
                  <img
                    src={getImageUrl(item.image || item.imageURL)}
                    alt={item.productName || item.name || ''}
                    className="s-payment-c643bf"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/category-bg.png';
                    }}
                  />
                  <div className="s-app-52dcac">
                    <p className="mb-0 s-cart-d5c56b">{item.productName || item.name}</p>
                    {(item.color || item.colorName) && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Color: {item.color || item.colorName}
                      </p>
                    )}
                    {(item.size || item.bandSize) && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Band Size: {item.size || item.bandSize}
                      </p>
                    )}
                    {item.cupSize && (
                      <p className="mb-0 text-muted s-addresslist-2c42ad">
                        Cup Size: {item.cupSize}
                      </p>
                    )}
                    <p className="mb-0 s-userdashboar-4adb1b">
                      Rs.{(item.finalPrice * (item.processedQuantity || 1)).toLocaleString('en-IN')} x {item.processedQuantity || 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <hr />
            {[
              { label: 'Subtotal', value: `Rs.${subTotal.toLocaleString('en-IN')}` },
              { label: 'Tax', value: `Rs.${taxAmount.toLocaleString('en-IN')}` },
              { label: 'Shipping', value: shippingCost === 0 ? 'FREE' : `Rs.${shippingCost}` },
              ...(couponDiscount > 0 ? [{ label: 'Coupon', value: `-Rs.${couponDiscount.toLocaleString('en-IN')}`, green: true }] : []),
            ].map(({ label, value, green }: any) => (
              <div key={label} className="d-flex justify-content-between mb-1">
                <span className="text-muted s-addresslist-9eec06">{label}</span>
                <span className="s-payment-05b8b4" style={{ color: green ? 'var(--brand)' : '#000000' }}>{value}</span>
              </div>
            ))}
            <hr />
            <div className="d-flex justify-content-between fw-bold mb-3 s-userdashboar-c14ee8">
              <span>Total Payable</span>
              <span>Rs.{totalPayable.toLocaleString('en-IN')}</span>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={orderMutation.isPending || selectedItems.length === 0}
              className="btn btn-dark w-100 d-flex align-items-center justify-content-center gap-2 s-payment-702916"
              style={{ opacity: orderMutation.isPending ? 0.7 : 1 }}
            >
              {orderMutation.isPending ? (
                <><span className="spinner-border spinner-border-sm" />Starting Payment...</>
              ) : (
                <><i className="bi bi-credit-card" />Proceed to Payment</>
              )}
            </button>
            <p className="text-center text-muted mt-2 mb-0 s-addresslist-2c42ad">
              <i className="bi bi-shield-check me-1" />Secure and encrypted checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
