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
    <div className="container" style={{ padding: '32px 16px', maxWidth: 700 }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: '#888' }}>
        <span style={{ cursor: 'pointer', color: '#555' }}
          onClick={() => navigate('/user-products/payment-address')}>Address</span>
        <i className="bi bi-chevron-right" />
        <span style={{ color: '#111', fontWeight: 600 }}>Shipping</span>
        <i className="bi bi-chevron-right" />
        <span>Payment</span>
      </div>

      <h5 style={{ marginBottom: 20 }}>Choose Shipping Method</h5>

      {/* Loading */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner-border text-secondary" />
        </div>
      ) : (shippingOptions as any[]).length === 0 ? (
        // Fallback when no delivery charges configured in backend
        <div
          onClick={() => setSelectedId(-1)}
          style={{
            border: `2px solid ${selectedId === -1 ? '#111' : '#eee'}`,
            borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer',
            background: selectedId === -1 ? '#f9f9f9' : '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${selectedId === -1 ? '#111' : '#ccc'}`,
              background: selectedId === -1 ? '#111' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {selectedId === -1 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Standard Delivery</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>5–7 business days</p>
            </div>
            <span style={{ fontWeight: 700, color: '#16a34a' }}>FREE</span>
          </div>
        </div>
      ) : (
        (shippingOptions as any[]).map((opt: any) => (
          <div key={opt.deliveryChargeId}
            onClick={() => setSelectedId(opt.deliveryChargeId)}
            style={{
              border: `2px solid ${selectedId === opt.deliveryChargeId ? '#111' : '#eee'}`,
              borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer',
              background: selectedId === opt.deliveryChargeId ? '#f9f9f9' : '#fff',
              transition: 'all .2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${selectedId === opt.deliveryChargeId ? '#111' : '#ccc'}`,
                background: selectedId === opt.deliveryChargeId ? '#111' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {selectedId === opt.deliveryChargeId && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                  {opt.shippingType?.shippingType ?? opt.description ?? 'Standard Delivery'}
                </p>
                {opt.days && (
                  <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{opt.days} business days</p>
                )}
                {opt.description && opt.shippingType?.shippingType && (
                  <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{opt.description}</p>
                )}
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: opt.isFree ? '#16a34a' : '#111' }}>
                {opt.isFree ? 'FREE' : `₹${opt.deliveryCharges ?? 0}`}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Order summary */}
      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginTop: 24, marginBottom: 16 }}>
        {[
          { label: 'Subtotal',  value: `₹${subTotal.toLocaleString('en-IN')}` },
          { label: 'Tax',       value: `₹${taxAmount.toLocaleString('en-IN')}` },
          { label: 'Shipping',  value: shippingCost === 0 ? 'FREE' : `₹${shippingCost}` },
          ...(couponDiscount > 0
            ? [{ label: 'Discount', value: `−₹${couponDiscount.toLocaleString('en-IN')}` }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#666' }}>{label}</span>
            <span style={{ color: label === 'Discount' ? '#16a34a' : '#111' }}>{value}</span>
          </div>
        ))}
        <hr style={{ margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
          <span>Total</span>
          <span>₹{Math.max(0, total).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => navigate('/user-products/payment-address')}
          style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '12px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
          <i className="bi bi-arrow-left me-2" />Back
        </button>
        <button onClick={handleContinue}
          style={{ flex: 1, background: '#111', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
          Continue to Payment
          <i className="bi bi-arrow-right ms-2" />
        </button>
      </div>
    </div>
  );
}