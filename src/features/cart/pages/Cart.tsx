/**
 * Cart.tsx
 */

import { useState, useEffect } from 'react';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { useBreadcrumb } from '@/shared/hooks/useBreadcrumb';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/cart/store/cartStore';
import { listCart, updateCart, deleteCartItem, checkOutOfStock, listCoupons } from '@/features/cart/api/cart.api';
import { getImageUrl, slugify } from '@/shared/utils/helpers';
import { resolveHex } from '@/shared/utils/colorHelpers';
import { useWishlistToggle } from '@/features/account/hooks/useWishlist';

const TAX_RATE = 0.05;

const GuestCart = {
  get: (): any[] => { try { return JSON.parse(localStorage.getItem('guestCart') || '[]'); } catch { return []; } },
  set: (items: any[]) => { localStorage.setItem('guestCart', JSON.stringify(items)); window.dispatchEvent(new Event('guestCartUpdated')); },
  remove: (pvId: number) => GuestCart.set(GuestCart.get().filter((i: any) => i.productVariantId !== pvId)),
  updateQty: (pvId: number, qty: number) =>
    GuestCart.set(GuestCart.get().map((i: any) => i.productVariantId === pvId ? { ...i, processedQuantity: qty, quantity: qty } : i)),
};

function SaveForLater({ item, onRemoveFromCart }: { item: any; onRemoveFromCart: () => void }) {
  const { inWishlist, toggle } = useWishlistToggle(item.productVariantId);

  const handleSaveForLater = () => {
    if (!inWishlist) {
      toggle({
        productId:              item.productId,
        productVariantId:       item.productVariantId,
        productVariantDetailId: item.productVariantDetailId,
        name:                   item.productName || item.name,
        price:                  item.finalPrice,
        oldPrice:               item.mrpPrice,
        image:                  item.image || item.imageURL,
        color:                  item.color,
      });
    }
    onRemoveFromCart();
  };

  return (
    <button
      onClick={handleSaveForLater}
      title="Save for later"
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--heirloom)', fontSize: 12, padding: 0,
        display: 'flex', alignItems: 'center', gap: 3,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        textDecoration: 'underline', textUnderlineOffset: 2 }}>
      <i className="bi bi-bookmark" style={{ fontSize: 13 }} />
      Save for later
    </button>
  );
}

export default function Cart() {
  const navigate    = useNavigate();
  const cartCrumbs  = useBreadcrumb({ staticItems: [{ label: 'Cart' }] });
  const location    = useLocation();
  const prevPath    = (location.state as any)?.from || sessionStorage.getItem('lastPage') || '/user-products/product-list';
  const qc          = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();
  const { appliedCoupon, couponDiscount, selectedShipping, setCoupon, removeCoupon } = useCartStore();

  const isAuth = hasValidToken();
  const userId = getUserId();

  const { data: cartData, isLoading } = useQuery({
    queryKey: ['cart', userId],
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

  const [authItems,   setAuthItems]   = useState<any[]>([]);
  const [guestItems,  setGuestItems]  = useState<any[]>([]);
  const [couponInput, setCouponInput] = useState('');

  useEffect(() => { if (cartData) setAuthItems(cartData); }, [cartData]);
  useEffect(() => {
    if (!isAuth) setGuestItems(GuestCart.get().map((i: any) => ({ ...i, isSelected: true })));
  }, [isAuth]);

  const cartItems     = isAuth ? authItems : guestItems;
  const selectedItems = cartItems.filter(i => i.isSelected);
  const allSelected   = cartItems.length > 0 && selectedItems.length === cartItems.length;

  const subTotal       = selectedItems.reduce((s, i) => s + ((i.finalPrice || 0) * (i.processedQuantity || 1)), 0);
  const taxAmount      = Math.round(subTotal * TAX_RATE);
  const totalPayable   = Math.max(0, subTotal - (couponDiscount ?? 0));

  const updateMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) => updateCart(id, { quantity: qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['quick-cart'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCartItem(id),
    onSuccess: () => {
      toast.success('Item removed');
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['quick-cart'] });
      qc.invalidateQueries({ queryKey: ['cart-bootstrap'] });
      setCartCount(Math.max(0, (cartCount || 1) - 1));
    },
  });

  const handleQtyChange = (item: any, qty: number) => {
    if (qty < 1) return;
    if (isAuth) {
      updateMutation.mutate({ id: item.cartId, qty });
      setAuthItems(prev => prev.map(i => i.cartId === item.cartId ? { ...i, processedQuantity: qty } : i));
    } else {
      GuestCart.updateQty(item.productVariantId, qty);
      setGuestItems(prev => prev.map(i => i.productVariantId === item.productVariantId ? { ...i, processedQuantity: qty, quantity: qty } : i));
    }
  };

  const handleRemove = (item: any) => {
    if (isAuth) deleteMutation.mutate(item.cartId);
    else {
      GuestCart.remove(item.productVariantId);
      setGuestItems(prev => {
        const updated = prev.filter((i: any) => i.productVariantId !== item.productVariantId);
        window.dispatchEvent(new Event('guestCartUpdated'));
        return updated;
      });
      toast.success('Item removed');
    }
  };

  const toggleSelect = (item: any) => {
    const fn = (arr: any[]) => arr.map(i => {
      const match = isAuth ? i.cartId === item.cartId : i.productVariantId === item.productVariantId;
      return match ? { ...i, isSelected: !i.isSelected } : i;
    });
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const toggleAll = () => {
    const val = !allSelected;
    const fn  = (arr: any[]) => arr.map(i => ({ ...i, isSelected: val }));
    isAuth ? setAuthItems(fn) : setGuestItems(fn);
  };

  const handleClearCart = () => {
    if (isAuth) setAuthItems([]);
    else { GuestCart.set([]); setGuestItems([]); }
    toast.success('Cart cleared');
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) { toast.error('Enter a coupon code'); return; }
    try {
      const res = await listCoupons({
        Filters: JSON.stringify([{ property: 'CouponCode', comparison: 'eq', value: couponInput.trim().toLowerCase() }]),
      });
      const coupon = res?.list?.[0];
      if (!coupon) { toast.error('Invalid coupon code'); return; }
      if (coupon.isActive === false || coupon.isActive === null) {
        toast.error('This coupon is not active'); return;
      }
      // discount = integer percent (e.g. 10 = 10% off)
      const pct = Number(coupon.discount) || 0;
      if (pct <= 0) { toast.error('This coupon has no discount value'); return; }
      const discountAmt = Math.round((subTotal * pct) / 100);
      if (discountAmt <= 0) { toast.error('Coupon not applicable on this order'); return; }
      setCoupon(coupon, discountAmt);
      toast.success(`Coupon applied! ${pct}% off — you save ₹${discountAmt}`);
    } catch (e) {
      console.error('Coupon error:', e);
      toast.error('Could not verify coupon. Please try again.');
    }
  };

  const handleCheckout = async () => {
    if (selectedItems.length === 0) { toast.error('Please select at least one item'); return; }
    if (!isAuth) { navigate('/user-products/payment-address'); return; }
    try {
      await checkOutOfStock({
        orderItems: selectedItems
          .filter(i => i.productVariantDetailId)
          .map(i => ({ productVariantDetailId: i.productVariantDetailId })),
      });
      const store = useCartStore.getState();
      store.setSelectedItems?.(selectedItems);
      store.setSubTotal?.(subTotal);
      store.setTaxAmount?.(taxAmount);
      navigate('/user-products/payment-address');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Some items are out of stock');
    }
  };

  if (isLoading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
      <div className="spinner-border" style={{ color: 'var(--brand)' }} />
    </div>
  );

  if (cartItems.length === 0) return (
    <div className="container py-5">
      <div className="d-flex flex-column align-items-center" style={{ minHeight: 300 }}>
        <i className="bi bi-cart-x" style={{ fontSize: 64, color: '#ddd' }} />
        <h5 className="mt-4 text-muted">Your cart is empty</h5>
        <p className="text-muted">Looks like you haven't added anything yet.</p>
        <button onClick={() => navigate(prevPath)}
          style={{ background: 'var(--brand)', color: '#fff', padding: '10px 28px', borderRadius: 4,
            border: 'none', cursor: 'pointer', marginTop: 12, fontWeight: 600, fontFamily: 'inherit' }}>
          ← Continue Shopping
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Breadcrumb items={cartCrumbs} />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>

        {/* ── Select All row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            style={{ width: 16, height: 16, accentColor: 'var(--brand)', cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#555' }}>
            Select All ({selectedItems.length}/{cartItems.length})
          </span>
        </div>

        <div className="row g-4">
          {/* ── Left: Cart Items ── */}
          <div className="col-lg-8">
            {cartItems.map((item: any) => (
              <div key={item.cartId ?? item.productVariantId}
                style={{ border: '1px solid #eee', borderRadius: 8, padding: '14px 16px', marginBottom: 12,
                  background: item.isSelected ? 'rgba(107,15,42,0.03)' : '#fff',
                  display: 'flex', gap: 12, alignItems: 'flex-start' }}>

                <input type="checkbox" checked={!!item.isSelected} onChange={() => toggleSelect(item)}
                  style={{ width: 16, height: 16, marginTop: 6, accentColor: 'var(--brand)', flexShrink: 0, cursor: 'pointer' }} />

                {/* Clickable image */}
                <img
                  src={getImageUrl(item.image || item.imageURL)}
                  alt={item.productName || item.name || ''}
                  onClick={() => navigate(`/user-products/product-detail/${item.productVariantId}/${slugify(item.productName || item.name || '')}`)}
                  style={{ width: 80, height: 96, objectFit: 'cover', borderRadius: 6, flexShrink: 0, cursor: 'pointer' }}
                  onError={e => { (e.target as HTMLImageElement).src = '/assets/category-bg.png'; }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + Brand */}
                  <h6 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
                    {item.productName || item.name}
                    {item.brandName && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--heirloom)', marginLeft: 6 }}>
                        ({item.brandName})
                      </span>
                    )}
                  </h6>

                  {/* Color + Size */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginBottom: 8 }}>
                    {(item.colorName || item.color) && (
                      <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 13, height: 13, borderRadius: '50%',
                          background: resolveHex(item.colorHex ?? item.color),
                          border: '1px solid rgba(0,0,0,.15)', display: 'inline-block', flexShrink: 0 }} />
                        {item.colorName ?? item.color}
                      </span>
                    )}
                    {(item.size || item.bandSize) && (
                      <span style={{ fontSize: 12, color: '#666' }}>Band Size: <strong>{item.size || item.bandSize}</strong></span>
                    )}
                    {item.cupSize && (
                      <span style={{ fontSize: 12, color: '#666' }}>Cup Size: <strong>{item.cupSize}</strong></span>
                    )}
                  </div>

                  {/* Quantity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Quantity:</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: 4 }}>
                      <button onClick={() => handleQtyChange(item, (item.processedQuantity || 1) - 1)}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: 13 }}>{item.processedQuantity || 1}</span>
                      <button onClick={() => handleQtyChange(item, (item.processedQuantity || 1) + 1)}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                </div>

                {/* Right: price + save + delete */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand)' }}>
                    ₹{((item.finalPrice || 0) * (item.processedQuantity || 1)).toLocaleString('en-IN')}
                  </span>
                  {item.mrpPrice && item.mrpPrice > item.finalPrice && (
                    <span style={{ fontSize: 12, color: '#aaa', textDecoration: 'line-through' }}>
                      ₹{(item.mrpPrice * (item.processedQuantity || 1)).toLocaleString('en-IN')}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SaveForLater item={item} onRemoveFromCart={() => handleRemove(item)} />
                    <button onClick={() => handleRemove(item)} title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--blush)', fontSize: 18, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Clear Cart — centered below items */}
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button onClick={handleClearCart}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--heirloom)', fontSize: 13, fontFamily: 'inherit',
                  textDecoration: 'underline', padding: 0 }}>
                Clear Shopping Cart
              </button>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="col-lg-4">
            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, position: 'sticky', top: 170 }}>

              {/* Coupon */}
              <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Apply Coupon Code</h6>
              {appliedCoupon ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
                  padding: '8px 12px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    {(appliedCoupon as any).couponCode} applied
                  </span>
                  <button onClick={removeCoupon}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blush)', fontSize: 18, padding: 0 }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    placeholder="Coupon code"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4,
                      fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button onClick={handleApplyCoupon}
                    style={{ background: 'var(--brand)', color: '#fff', border: 'none', padding: '8px 16px',
                      borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700 }}>
                    Apply
                  </button>
                </div>
              )}

              <hr style={{ margin: '0 0 14px' }} />
              <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Order Summary</h6>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#555' }}>
                  Subtotal ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} · {selectedItems.reduce((s,i) => s + (i.processedQuantity || 1), 0)} qty)
                </span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>₹{subTotal.toLocaleString('en-IN')}.00</span>
              </div>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 8px', fontStyle: 'italic' }}>
                GST and shipping calculated at checkout
              </p>

              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#15803d' }}>Coupon Discount</span>
                  <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>− ₹{couponDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 16px',
                borderTop: '1px solid #eee', paddingTop: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>
                  ₹{totalPayable.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Checkout buttons — wrapped in fragment to avoid JSX sibling error */}
              <>
                {isAuth ? (
                  <button onClick={handleCheckout}
                    style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none',
                      padding: '13px', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                      fontWeight: 700, fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A84C6B')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#6A012A')}>
                    Checkout Order →
                  </button>
                ) : (
                  <button onClick={handleCheckout}
                    style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none',
                      padding: '13px', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                      fontWeight: 700, fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A84C6B')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#6A012A')}>
                    Checkout as Guest →
                  </button>
                )}
                <button onClick={() => navigate(prevPath)}
                  style={{ width: '100%', background: 'transparent', color: 'var(--brand)',
                    border: '1.5px solid var(--brand)', padding: '11px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    marginTop: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(107,15,42,.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  ← Continue Shopping
                </button>
              </>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                {['🔒 Secure', '↩️ Easy Returns', '✅ Trusted'].map(t => (
                  <span key={t} style={{ fontSize: 11, color: '#888' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}