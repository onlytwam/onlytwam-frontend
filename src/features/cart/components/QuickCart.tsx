import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { listCart, deleteCartItem, updateCart } from '@/features/cart/api/cart.api';
import { getImageUrl } from '@/shared/utils/helpers';
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
      <div className="s-quickcart-75c969" onClick={onClose} />

      <div className="s-quickcart-f483a8">

        {/* ── Header ── */}
        <div className="s-quickcart-f272f0">
          <div className="s-adminbar-877368">
            <i className="bi bi-cart3 s-quickcart-efcb48" />
            <h3 className="s-quickcart-fdb448">My Cart</h3>
            {items.length > 0 && (
              <span className="s-quickcart-ea3ac8">{items.length}</span>
            )}
          </div>
          <button onClick={onClose}
            className="s-adminsupport-40536d">×</button>
        </div>

        {/* ── Items list ── */}
        <div className="s-quickcart-1b9d23">
          {isLoading ? (
            <div className="s-quickcart-9164c7">
              <div className="s-quickcart-bc6b8b" />
            </div>
          ) : items.length === 0 ? (
            <div className="s-quickcart-1a1604">
              <i className="bi bi-cart-x s-quickcart-78b615" />
              <h4 className="s-quickcart-14d4fb">Your cart is empty</h4>
              <p className="s-addresslist-92985e">Add items to get started</p>
              <button onClick={() => { navigate(prevPath); onClose(); }}
                className="s-quickcart-552d28">
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
              <div key={item.cartId || idx} className="s-quickcart-49bd81">

                {/* Image */}
                <div className="s-quickcart-2c6bd4"
                  onClick={() => { navigate(`/user-products/product-detail/${item.productVariantId}/product`); onClose(); }}>
                  <img src={img} alt={name}
                    className="s-quickcart-2b92d4"
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/category-bg.png'; }} />
                </div>

                {/* Details */}
                <div className="s-userdashboar-7aa8c4">

                  {/* Name */}
                  <h5 className="s-quickcart-e5f653"
                    onClick={() => { navigate(`/user-products/product-detail/${item.productVariantId}/product`); onClose(); }}>
                    {name}
                    {(item.brandName || item.brand)
                      ? <span className="s-quickcart-a94e44">({item.brandName || item.brand})</span>
                      : null}
                  </h5>

                  {/* Color + Band/Cup size */}
                  {(colorLabel || bandSize || cupSize) && (
                    <div className="s-quickcart-0419ed">
                      {colorLabel && (
                        <span className="s-quickcart-b02946">
                          <span className="s-adminsizes-b54cfc">Color:</span>
                          <span className="s-quickcart-b68aaf" style={ {background: colorHex} } />
                          <span>{colorLabel}</span>
                        </span>
                      )}
                      {bandSize && (
                        <span className="s-adminnewslet-f01220">
                          <span className="s-adminsizes-b54cfc">Band Size: </span>
                          <strong>{bandSize}</strong>
                        </span>
                      )}
                      {cupSize && (
                        <span className="s-adminnewslet-f01220">
                          <span className="s-adminsizes-b54cfc">Cup Size: </span>
                          <strong>{cupSize}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock warning badge */}
                  {maxStock !== null && maxStock <= 3 && maxStock > 0 && (
                    <div className="s-quickcart-382f33">
                      ⚠️ Only {maxStock} left in stock
                    </div>
                  )}

                  {/* Price + Qty + Delete row */}
                  <div className="s-quickcart-addeec">

                    {/* Qty controls */}
                    <div className="s-quickcart-f7ab1b">
                      <button
                        onClick={() => handleDecrease(item)}
                        disabled={removeMut.isPending || updateMut.isPending}
                        className="s-quickcart-456b82" style={{ opacity: (removeMut.isPending || updateMut.isPending) ? 0.5 : 1 }}>
                        −
                      </button>
                      <span className="s-quickcart-b8376f">
                        {qty}
                      </span>
                      <button
                        onClick={() => handleIncrease(item)}
                        disabled={updateMut.isPending || atMax}
                        title={atMax ? `Max stock: ${maxStock}` : 'Increase quantity'}
                        className="s-quickcart-65fdad" style={ {cursor: atMax ? 'not-allowed' : 'pointer', color: atMax ? 'var(--ivory)' : 'var(--brand)', opacity: updateMut.isPending ? 0.5 : 1} }>
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <div className="s-quickcart-f66ceb">
                      <div className="s-quickcart-c3a94f">
                        ₹{(price * qty).toLocaleString('en-IN')}
                      </div>
                      {mrp > price && (
                        <div className="s-quickcart-b469ce">
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
                      className="s-quickcart-424294" style={ {opacity: removeMut.isPending ? 0.5 : 1} }>
                      <i className="bi bi-trash3 s-addresslist-92985e" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        {items.length > 0 && (
          <div className="s-quickcart-6b5f6f">
            <div className="s-quickcart-4b986c">
              <span className="s-quickcart-08341f">
                {items.length} item{items.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                {items.reduce((s: number, i: any) => s + (i.processedQuantity || i.quantity || 1), 0)} qty total
              </span>
              <span className="s-quickcart-65e3d5">
                ₹{total.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="s-adminblog-b43398">
              <button
                onClick={() => { navigate('/user-products/cart', { state: { from: location.pathname + location.search } }); onClose(); }}
                className="s-quickcart-febadd">
                View Cart & Checkout
              </button>
              <button onClick={onClose}
                className="s-quickcart-ec24cf">
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>

      </>
  );
}
