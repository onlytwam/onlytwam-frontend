import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useCartStore } from '@/features/cart/store/cartStore';
import { listDeliveryCharges } from '@/features/cart/api/cart.api';
import type { ShippingOption } from '@/shared/types';

export default function ShippingOption() {
  const navigate = useNavigate();
  const { setShipping, selectedShipping, getSubTotal, getTaxAmount, couponDiscount } = useCartStore();

  // Key selection off deliveryChargeId — the actual PK from backend
  // Pre-select the previously chosen option if navigating back
  const [selectedId, setSelectedId] = useState<number | null>(
    selectedShipping?.deliveryChargeId ?? null
  );

  const { data: shippingOptions = [], isLoading } = useQuery({
    queryKey: ['shipping-options'],
    queryFn: () => listDeliveryCharges(),
    select: (d: any) => d?.list ?? d ?? [],
    staleTime: 10 * 60 * 1000,
  });

  const subTotal     = getSubTotal();
  const taxAmount    = getTaxAmount();
  const selectedOpt  = (shippingOptions as any[]).find(
    (s: any) => s.deliveryChargeId === selectedId
  );
  // shippingCost: 0 if free or not selected yet
  const shippingCost = selectedOpt
    ? (selectedOpt.isFree ? 0 : Number(selectedOpt.deliveryCharges ?? 0))
    : 0;
  // Total = subtotal + tax + shipping - coupon (all as numbers)
  const total = Math.max(0,
    Number(subTotal) + Number(taxAmount) + shippingCost - Number(couponDiscount || 0)
  );

  const handleContinue = () => {
    if (!selectedId) {
      toast.error('Please select a shipping option');
      return;
    }
    const option = selectedOpt;
    if (!option) { toast.error('Invalid selection'); return; }

    // Map backend fields → ShippingOption shape that cartStore expects
    const shippingPayload: ShippingOption = {
      deliveryChargeId: option.deliveryChargeId,
      shippingTypeId:   option.shippingTypeId   ?? null,
      deliveryCharges:  option.isFree ? 0 : (option.deliveryCharges ?? 0),
      isFree:           option.isFree           ?? false,
      days:             option.days             ?? null,
      description:      option.description      ?? null,
      orderValueRange:  option.orderValueRange  ?? null,
      shippingType:     option.shippingType     ?? null,
      // Convenience aliases used in Cart.tsx totals
      cost:             option.isFree ? 0 : (option.deliveryCharges ?? 0),
      name:             option.shippingType?.shippingType ?? option.description ?? 'Standard',
      estimatedDays:    parseInt(option.days ?? '0') || undefined,
    };

    setShipping(shippingPayload);
    navigate('/user-products/payment');
  };

  return (
    <div className="container s-invoice-5c9003">

      {/* Breadcrumb */}
      <div className="s-shippingopti-19d865">
        <span className="s-payment-2ac9d6"
          onClick={() => navigate('/user-products/payment-address')}>Address</span>
        <i className="bi bi-chevron-right" />
        <span className="s-shippingopti-ae6dbd">Shipping</span>
        <i className="bi bi-chevron-right" />
        <span>Payment</span>
      </div>

      <h5 className="s-adminblog-19fd7a">Choose Shipping Method</h5>

      {/* Loading */}
      {isLoading ? (
        <div className="s-shippingopti-9ecba4">
          <div className="spinner-border text-secondary" />
        </div>
      ) : (shippingOptions as any[]).length === 0 ? (
        // Fallback when no delivery charges configured in backend
        <div
          onClick={() => setSelectedId(-1)}
          className="s-shippingopti-b63dfb" style={ {border: `2px solid ${selectedId === -1 ? '#000000' : 'var(--ivory)'}`, background: selectedId === -1 ? 'var(--ivory)' : '#fff'} }
        >
          <div className="s-adminreports-25c771">
            <div className="s-shippingopti-e0801a" style={ {border: `2px solid ${selectedId === -1 ? '#000000' : 'var(--ivory)'}`, background: selectedId === -1 ? '#000000' : '#fff'} }>
              {selectedId === -1 && <div className="s-payment-108f10" />}
            </div>
            <div className="s-app-52dcac">
              <p className="s-shippingopti-b1d3de">Standard Delivery</p>
              <p className="s-userdashboar-bc8be4">5–7 business days</p>
            </div>
            <span className="s-shippingopti-f0f561">FREE</span>
          </div>
        </div>
      ) : (
        (shippingOptions as any[]).map((opt: any) => (
          <div key={opt.deliveryChargeId}
            onClick={() => setSelectedId(opt.deliveryChargeId)}
            className="s-shippingopti-8cc11b" style={ {border: `2px solid ${selectedId === opt.deliveryChargeId ? '#000000' : 'var(--ivory)'}`, background: selectedId === opt.deliveryChargeId ? 'var(--ivory)' : '#fff'} }
          >
            <div className="s-adminreports-25c771">
              <div className="s-shippingopti-e0801a" style={ {border: `2px solid ${selectedId === opt.deliveryChargeId ? '#000000' : 'var(--ivory)'}`, background: selectedId === opt.deliveryChargeId ? '#000000' : '#fff'} }>
                {selectedId === opt.deliveryChargeId && (
                  <div className="s-payment-108f10" />
                )}
              </div>
              <div className="s-app-52dcac">
                <p className="s-shippingopti-b1d3de">
                  {opt.shippingType?.shippingType ?? opt.description ?? 'Standard Delivery'}
                </p>
                {opt.days && (
                  <p className="s-userdashboar-bc8be4">{opt.days} business days</p>
                )}
                {opt.description && opt.shippingType?.shippingType && (
                  <p className="s-admindashboa-75a6ca">{opt.description}</p>
                )}
              </div>
              <span className="s-shippingopti-d90d13" style={ {color: opt.isFree ? 'var(--brand)' : '#000000'} }>
                {opt.isFree ? 'FREE' : `₹${opt.deliveryCharges ?? 0}`}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Order summary */}
      <div className="s-shippingopti-a37762">
        {[
          { label: 'Subtotal',  value: `₹${subTotal.toLocaleString('en-IN')}` },
          { label: 'Tax',       value: `₹${taxAmount.toLocaleString('en-IN')}` },
          { label: 'Shipping',  value: shippingCost === 0 ? 'FREE' : `₹${shippingCost}` },
          ...(couponDiscount > 0
            ? [{ label: 'Discount', value: `−₹${couponDiscount.toLocaleString('en-IN')}` }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} className="s-shippingopti-7d9011">
            <span className="s-adminbrands-95b451">{label}</span>
            <span style={{ color: label === 'Discount' ? 'var(--heirloom)' : '#000' }}>{value}</span>
          </div>
        ))}
        <hr className="s-shippingopti-b1485b" />
        <div className="s-shippingopti-a11a00">
          <span>Total</span>
          <span>₹{Math.max(0, total).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="s-addressform-be0342">
        <button onClick={() => navigate('/user-products/payment-address')}
          className="s-shippingopti-8d61d8">
          <i className="bi bi-arrow-left me-2" />Back
        </button>
        <button onClick={handleContinue}
          className="s-shippingopti-f6db1e">
          Continue to Payment
          <i className="bi bi-arrow-right ms-2" />
        </button>
      </div>
    </div>
  );
}