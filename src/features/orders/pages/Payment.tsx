// Fixed: backend AddressResponse fields are addressLine, pinCode, phone (no .state, .address, .mobileNumber)
import { useState } from 'react';
import { getImageUrl } from '@/shared/utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/cart/store/cartStore';
import { createOrder, listAddress } from '@/features/orders/api/orders.api';

const PAYMENT_METHODS = [
  { id: 'cod',    label: 'Cash on Delivery',  icon: 'bi-cash-coin',  desc: 'Pay when your order arrives' },
  { id: 'online', label: 'Online Payment',     icon: 'bi-credit-card', desc: 'UPI, Credit/Debit Card, Net Banking' },
  { id: 'upi',    label: 'UPI',               icon: 'bi-phone',      desc: 'Pay via GPay, PhonePe, Paytm' },
];

export default function Payment() {
  const navigate = useNavigate();
  const { getUserId } = useAuthStore();
  const {
    getSelectedItems, getSubTotal, getTaxAmount,
    selectedShipping, couponDiscount, appliedCoupon, clearCart,
  } = useCartStore();
  const userId = getUserId();

  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [isWhatsapp,    setIsWhatsapp]    = useState(false);

  const selectedAddressId = Number(sessionStorage.getItem('selectedAddressId') || 0);

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    select: (d: any) => d?.list ?? d ?? [],
  });

  const selectedItems  = getSelectedItems();
  const subTotal       = getSubTotal();
  const taxAmount      = getTaxAmount();
  const shippingCost   = (selectedShipping as any)?.cost ?? 0;
  const totalPayable   = Math.max(0, subTotal + taxAmount + shippingCost - (couponDiscount ?? 0));

  // FIX: backend AddressResponse has addressLine, pinCode, phone — no .state or .address fields
  const deliveryAddress: any = (addresses as any[]).find((a: any) => a.addressId === selectedAddressId);
  const addrLine = deliveryAddress
    ? [deliveryAddress.addressLine, deliveryAddress.city, deliveryAddress.pinCode].filter(Boolean).join(', ')
    : '';

  const orderMutation = useMutation({
    mutationFn: (payload: any) => createOrder(payload),
    onSuccess: (data: any) => {
      clearCart();
      sessionStorage.removeItem('selectedAddressId');
      toast.success('Order placed successfully! 🎉');
      navigate(`/user-products/order-confirm/${data?.orderId ?? 'new'}`);
    },
    onError: (e: any) => toast.error(
      e?.response?.data?.message || e?.response?.data?.detail || 'Failed to place order. Please try again.'
    ),
  });

  const handlePlaceOrder = () => {
    if (!selectedAddressId) { toast.error('Please go back and select a delivery address'); return; }
    if (selectedItems.length === 0) { toast.error('Your cart is empty'); return; }

    orderMutation.mutate({
      userProfileId:       userId,
      subTotal,
      totalAmount:         totalPayable,
      taxAmount,
      deliveryCharge:      shippingCost,
      shippingTypeId:      (selectedShipping as any)?.shippingTypeId ?? null,
      shippingAddressId:   selectedAddressId,
      billingAddressId:    selectedAddressId,
      couponId:            appliedCoupon?.couponId ?? null,
      couponAmount:        couponDiscount ?? 0,
      cartId:              selectedItems.map((i: any) => i.cartId),
      orderNumber:         null,
      isWhatsappNotification: isWhatsapp,
      orderItems:          selectedItems.map((i: any) => ({
        productId:              i.productId,
        productVariantDetailId: i.productVariantDetailId,
        quantity:               i.processedQuantity || 1,
        price:                  i.finalPrice,
      })),
    });
  };

  return (
    <div className="container" style={{ padding: '32px 16px' }}>
      {/* Breadcrumb */}
      <div className="d-flex align-items-center gap-2 mb-4" style={{ fontSize: 13, color: '#888' }}>
        <span style={{ cursor: 'pointer', color: '#555' }} onClick={() => navigate('/user-products/payment-address')}>Address</span>
        <i className="bi bi-chevron-right" />
        <span style={{ cursor: 'pointer', color: '#555' }} onClick={() => navigate('/user-products/shipping-option')}>Shipping</span>
        <i className="bi bi-chevron-right" />
        <span className="fw-bold text-dark">Payment</span>
      </div>

      <div className="row g-4">
        {/* Left */}
        <div className="col-lg-8">
          {/* Delivery address summary */}
          {deliveryAddress && (
            <div className="border rounded p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Delivering to</h6>
                <button onClick={() => navigate('/user-products/payment-address')}
                  className="btn btn-sm btn-link p-0 text-dark">Change</button>
              </div>
              <p className="mb-0 fw-semibold" style={{ fontSize: 14 }}>{deliveryAddress.name}</p>
              {/* FIX: use correct backend fields — no .state, no .mobileNumber */}
              <p className="mb-0 text-muted" style={{ fontSize: 13 }}>{addrLine}</p>
              <p className="mb-0 text-muted" style={{ fontSize: 13 }}>{deliveryAddress.phone}</p>
            </div>
          )}

          {/* Payment method */}
          <h6 className="mb-3">Payment Method</h6>
          {PAYMENT_METHODS.map(m => (
            <div key={m.id} onClick={() => setPaymentMethod(m.id)}
              style={{
                border: `2px solid ${paymentMethod === m.id ? '#111' : '#eee'}`,
                borderRadius: 8, padding: 14, marginBottom: 10, cursor: 'pointer',
                background: paymentMethod === m.id ? '#f9f9f9' : '#fff', transition: 'all .2s',
              }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${paymentMethod === m.id ? '#111' : '#ccc'}`,
                  background: paymentMethod === m.id ? '#111' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {paymentMethod === m.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <i className={`bi ${m.icon}`} style={{ fontSize: 20, color: '#555' }} />
                <div>
                  <p className="mb-0 fw-semibold" style={{ fontSize: 14 }}>{m.label}</p>
                  <p className="mb-0 text-muted" style={{ fontSize: 12 }}>{m.desc}</p>
                </div>
              </div>
            </div>
          ))}

          {/* WhatsApp toggle */}
          <div className="d-flex align-items-center gap-2 pt-3 mt-2 border-top">
            <input type="checkbox" id="whatsapp" checked={isWhatsapp}
              onChange={e => setIsWhatsapp(e.target.checked)} style={{ width: 16, height: 16 }} />
            <label htmlFor="whatsapp" style={{ fontSize: 13, cursor: 'pointer', color: '#555' }}>
              <i className="bi bi-whatsapp" style={{ color: '#25D366', marginRight: 6 }} />
              Send order updates via WhatsApp
            </label>
          </div>
        </div>

        {/* Right — summary */}
        <div className="col-lg-4">
          <div className="border rounded p-4 position-sticky" style={{ top: 80 }}>
            <h6 className="mb-3 fw-bold">Order Summary</h6>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {selectedItems.map((item: any, i: number) => (
                <div key={i} className="d-flex gap-2 mb-2">
                  <img src={getImageUrl(item.image)} alt={item.productName}
                    style={{ width: 46, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div>
                    <p className="mb-0" style={{ fontSize: 13, fontWeight: 500 }}>{item.productName || item.name}</p>
                    {item.size && <p className="mb-0 text-muted" style={{ fontSize: 11 }}>Size: {item.size}</p>}
                    <p className="mb-0" style={{ fontSize: 13, fontWeight: 600 }}>
                      ₹{(item.finalPrice * (item.processedQuantity || 1)).toLocaleString('en-IN')} × {item.processedQuantity || 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <hr />
            {[
              { label: 'Subtotal',  value: `₹${subTotal.toLocaleString('en-IN')}` },
              { label: 'Tax',       value: `₹${taxAmount.toLocaleString('en-IN')}` },
              { label: 'Shipping',  value: shippingCost === 0 ? 'FREE' : `₹${shippingCost}` },
              ...(couponDiscount > 0 ? [{ label: 'Coupon', value: `−₹${couponDiscount.toLocaleString('en-IN')}`, green: true }] : []),
            ].map(({ label, value, green }: any) => (
              <div key={label} className="d-flex justify-content-between mb-1">
                <span className="text-muted" style={{ fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 13, color: green ? '#16a34a' : '#111' }}>{value}</span>
              </div>
            ))}
            <hr />
            <div className="d-flex justify-content-between fw-bold mb-3" style={{ fontSize: 16 }}>
              <span>Total Payable</span>
              <span>₹{totalPayable.toLocaleString('en-IN')}</span>
            </div>
            <button onClick={handlePlaceOrder}
              disabled={orderMutation.isPending || selectedItems.length === 0}
              className="btn btn-dark w-100 d-flex align-items-center justify-content-center gap-2"
              style={{ padding: 14, fontSize: 15, fontWeight: 700, opacity: orderMutation.isPending ? 0.7 : 1 }}>
              {orderMutation.isPending
                ? <><span className="spinner-border spinner-border-sm" />Placing Order…</>
                : <><i className="bi bi-bag-check" />Place Order</>}
            </button>
            <p className="text-center text-muted mt-2 mb-0" style={{ fontSize: 11 }}>
              <i className="bi bi-shield-check me-1" />Secure & encrypted checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
