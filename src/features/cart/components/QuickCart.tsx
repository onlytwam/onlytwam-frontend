import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listCart, deleteCartItem, updateCart } from '@/features/cart/api/cart.api';
import { formatPrice, getImageUrl } from '@/shared/utils/helpers';
import { resolveHex } from '@/shared/utils/colorHelpers';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function QuickCart({ onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const prevPath = location.pathname + location.search;
  const qc       = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = prev; };
  }, []);

  const { data: cartData, isLoading } = useQuery({
    queryKey: ['quick-cart', getUserId()],
    queryFn:  () => listCart({ userProfileId: getUserId() }),
    enabled:  hasValidToken(),
  });

  const [guestItems, setGuestItemsState] = useState<any[]>(() => {
    if (hasValidToken()) return [];
    try { return JSON.parse(localStorage.getItem('guestCart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (hasValidToken()) return;
    const sync = () => {
      try { setGuestItemsState(JSON.parse(localStorage.getItem('guestCart') || '[]')); } catch {}
    };
    window.addEventListener('guestCartUpdated', sync);
    return () => window.removeEventListener('guestCartUpdated', sync);
  }, []);

  const items = hasValidToken() ? (cartData?.list ?? cartData ?? []) : guestItems;
  const total = items.reduce((s: number, i: any) =>
    s + ((i.finalPrice || i.price || 0) * (i.quantity || i.processedQuantity || 1)), 0);

  // ── Remove mutation ────────────────────────────────────────────────────────
  const removeMut = useMutation({
    mutationFn: (cartId: number) => deleteCartItem(cartId),
    onSuccess: () => {
      toast.success('Removed');
      setCartCount(Math.max(0, (cartCount || 1) - 1));
      qc.invalidateQueries({ queryKey: ['quick-cart'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['cart-bootstrap'] });
    },
    onError: () => toast.error('Failed to remove item'),
  });

  // ── Update mutation — FIX: send cartId in body as CartUpdate schema requires it ──
  const updateMut = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateCart(id, { cartId: id, quantity: qty }),   // ← cartId required in body
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-cart'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: () => toast.error('Failed to update quantity'),
  });

  // ── Guest helpers ──────────────────────────────────────────────────────────
  const removeGuest = (pvId: number) => {
    const updated = guestItems.filter((i: any) => i.productVariantId !== pvId);
    localStorage.setItem('guestCart', JSON.stringify(updated));
    window.dispatchEvent(new Event('guestCartUpdated'));
    toast.success('Removed');
  };

  const changeGuestQty = (pvId: number, qty: number) => {
    if (qty < 1) return;
    const updated = guestItems.map((i: any) =>
      i.productVariantId === pvId ? { ...i, quantity: qty, processedQuantity: qty } : i
    );
    localStorage.setItem('guestCart', JSON.stringify(updated));
    window.dispatchEvent(new Event('guestCartUpdated'));
  };

  // ── Increase qty with stock check ─────────────────────────────────────────
  const handleIncrease = (item: any) => {
    const qty      = item.processedQuantity || item.quantity || 1;
    const maxStock = item.stockQuantity ?? null;  // stockQuantity comes from API for logged-in users

    if (maxStock !== null && qty >= maxStock) {
      toast.error(
        maxStock === 0
          ? 'This item is out of stock'
          : `Only ${maxStock} unit${maxStock !== 1 ? 's' : ''} available in stock`,
        { icon: '⚠️' }
      );
      return;
    }

    if (hasValidToken()) {
      updateMut.mutate({ id: item.cartId, qty: qty + 1 });
    } else {
      changeGuestQty(item.productVariantId, qty + 1);
    }
  };

  // ── Decrease qty (removes item when qty reaches 0) ─────────────────────────
  const handleDecrease = (item: any) => {
    const qty = item.processedQuantity || item.quantity || 1;
    if (qty <= 1) {
      if (hasValidToken()) removeMut.mutate(item.cartId);
      else removeGuest(item.productVariantId);
    } else {
      if (hasValidToken()) updateMut.mutate({ id: item.cartId, qty: qty - 1 });
      else changeGuestQty(item.productVariantId, qty - 1);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9998 }} onClick={onClose} />

      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, maxWidth: '100vw',
        background: '#fff', zIndex: 9999, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,.15)', animation: 'slideIn .25s ease' }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--ivory)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="bi bi-cart3" style={{ fontSize: 20, color: 'var(--brand)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>My Cart</h3>
            {items.length > 0 && (
              <span style={{ background: 'var(--brand)', color: '#fff', borderRadius: '50%',
                width: 22, height: 22, fontSize: 11, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700 }}>{items.length}</span>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#555', lineHeight: 1 }}>×</button>
        </div>

        {/* ── Items list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--ivory)',
                borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
              <i className="bi bi-cart-x" style={{ fontSize: 52, display: 'block', marginBottom: 16 }} />
              <h4 style={{ color: '#555', marginBottom: 8 }}>Your cart is empty</h4>
              <p style={{ fontSize: 14 }}>Add items to get started</p>
              <button onClick={() => { navigate(prevPath); onClose(); }}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 6, cursor: 'pointer', marginTop: 16,
                  fontSize: 14, fontFamily: 'inherit' }}>
                Continue Shopping
              </button>
            </div>
          ) : items.map((item: any, idx: number) => {
            const qty      = item.processedQuantity || item.quantity || 1;
            const price    = item.finalPrice || item.price || 0;
            const mrp      = item.mrpPrice || item.oldPrice || 0;
            const rawImg   = item.imageURL || item.image || item.selectedImage || '';
            const img      = getImageUrl(rawImg);
            const name     = item.productName || item.name || '';
            const colorHex   = resolveHex(item.colorHex ?? item.color ?? item.Color);
            const colorLabel = item.colorName ?? item.color ?? item.Color ?? '';
            const bandSize = item.size || item.bandSize || '';
            const cupSize  = item.cupSize || '';
            const maxStock = item.stockQuantity ?? null;
            const atMax    = maxStock !== null && qty >= maxStock;

            return (
              <div key={item.cartId || idx} style={{
                display: 'flex', gap: 12, padding: '14px 0',
                borderBottom: '1px solid #f5f5f5', alignItems: 'flex-start' }}>

                {/* Image */}
                <div style={{ flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => { navigate(`/user-products/product-detail/${item.productVariantId}/product`); onClose(); }}>
                  <img src={img} alt={name}
                    style={{ width: 72, height: 86, objectFit: 'cover', borderRadius: 8,
                      background: 'var(--ivory)', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/category-bg.png'; }} />
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Name */}
                  <h5 style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 600, color: '#111',
                    cursor: 'pointer', lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => { navigate(`/user-products/product-detail/${item.productVariantId}/product`); onClose(); }}>
                    {name}
                    {(item.brandName || item.brand)
                      ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--heirloom)', marginLeft: 5 }}>({item.brandName || item.brand})</span>
                      : null}
                  </h5>

                  {/* Color + Band/Cup size */}
                  {(colorLabel || bandSize || cupSize) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {colorLabel && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555' }}>
                          <span style={{ fontSize: 11, color: '#999' }}>Color:</span>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: colorHex,
                            border: '1px solid rgba(0,0,0,.2)', display: 'inline-block', flexShrink: 0 }} />
                          <span>{colorLabel}</span>
                        </span>
                      )}
                      {bandSize && (
                        <span style={{ fontSize: 12, color: '#555' }}>
                          <span style={{ fontSize: 11, color: '#999' }}>Band Size: </span>
                          <strong>{bandSize}</strong>
                        </span>
                      )}
                      {cupSize && (
                        <span style={{ fontSize: 12, color: '#555' }}>
                          <span style={{ fontSize: 11, color: '#999' }}>Cup Size: </span>
                          <strong>{cupSize}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock warning badge */}
                  {maxStock !== null && maxStock <= 3 && maxStock > 0 && (
                    <div style={{ fontSize: 11, color: '#e65100', fontWeight: 600, marginBottom: 6 }}>
                      ⚠️ Only {maxStock} left in stock
                    </div>
                  )}

                  {/* Price + Qty + Delete row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>

                    {/* Qty controls */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0',
                      borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => handleDecrease(item)}
                        disabled={removeMut.isPending || updateMut.isPending}
                        style={{ width: 28, height: 28, border: 'none', background: 'none',
                          cursor: 'pointer', fontSize: 16, color: 'var(--brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: (removeMut.isPending || updateMut.isPending) ? 0.5 : 1 }}>
                        −
                      </button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111' }}>
                        {qty}
                      </span>
                      <button
                        onClick={() => handleIncrease(item)}
                        disabled={updateMut.isPending || atMax}
                        title={atMax ? `Max stock: ${maxStock}` : 'Increase quantity'}
                        style={{ width: 28, height: 28, border: 'none', background: 'none',
                          cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 16,
                          color: atMax ? '#ccc' : 'var(--brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: updateMut.isPending ? 0.5 : 1 }}>
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                        ₹{(price * qty).toLocaleString('en-IN')}
                      </div>
                      {mrp > price && (
                        <div style={{ fontSize: 11, color: '#aaa', textDecoration: 'line-through' }}>
                          ₹{(mrp * qty).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (hasValidToken()) removeMut.mutate(item.cartId);
                        else removeGuest(item.productVariantId);
                      }}
                      disabled={removeMut.isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: '#e53935', padding: '4px', flexShrink: 0,
                        display: 'flex', alignItems: 'center',
                        opacity: removeMut.isPending ? 0.5 : 1 }}>
                      <i className="bi bi-trash3" style={{ fontSize: 14 }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        {items.length > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#555' }}>
                {items.length} item{items.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                {items.reduce((s: number, i: any) => s + (i.processedQuantity || i.quantity || 1), 0)} qty total
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>
                ₹{total.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { navigate('/user-products/cart', { state: { from: location.pathname + location.search } }); onClose(); }}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', padding: '13px',
                  borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>
                View Cart & Checkout
              </button>
              <button onClick={onClose}
                style={{ background: '#fff', color: 'var(--brand)', border: '1.5px solid var(--brand)',
                  padding: '11px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin    { to   { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}