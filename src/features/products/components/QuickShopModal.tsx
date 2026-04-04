import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getProductDetail } from '@/features/products/api/products.api';
import { addToCart } from '@/features/cart/api/cart.api';
import { formatPrice, getImageUrl, slugify } from '@/shared/utils/helpers';
import { resolveHex } from '@/shared/utils/colorHelpers';
import { useWishlistToggle } from '@/features/account/hooks/useWishlist';

interface Props { productVariantId: number; onClose: () => void; }

const ALPHA_SIZE_KEYWORDS = [
  't-shirt bra', 't shirt bra', 'tshirt bra',
  'sports bra',  'sport bra',
];
const isAlphaSizeProduct = (name = '') =>
  ALPHA_SIZE_KEYWORDS.some(kw => name.toLowerCase().includes(kw));

function SizeBtn({ label, selected, inVariant, hasStock, stock, onClick }: {
  label: string; selected: boolean; inVariant: boolean;
  hasStock: boolean; stock: number; onClick: () => void;
}) {
  const base: React.CSSProperties = {
    minWidth: 38, height: 38, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 600, flexShrink: 0,
    position: 'relative', fontFamily: 'var(--font-body)', transition: 'all .15s',
  };
  if (!inVariant) return (
    <span title="Not available" style={{ ...base, border: '1.5px dashed #f5f0e6', color: 'var(--ivory)', userSelect: 'none', cursor: 'not-allowed', position: 'relative' }}>
      {label}
    </span>
  );
  if (!hasStock) return (
    <span title="Out of stock"
      style={{ ...base, border: '1.5px solid #6B0F2A', color: 'var(--brand)', opacity: 0.45,
        textDecoration: 'line-through', userSelect: 'none', cursor: 'not-allowed' }}>
      {label}
    </span>
  );
  return (
    <button onClick={onClick} style={{
      ...base,
      border: `2px solid ${selected ? 'var(--brand)' : 'var(--heirloom)'}`,
      background: selected ? 'var(--brand)' : '#fff',
      color: selected ? '#fff' : '#000000',
      cursor: 'pointer',
    }}>
      {label}
      {stock === 1 && (
        <span className="s-quickshopmod-dd356c">1</span>
      )}
    </button>
  );
}

interface ModalNotif { message: string; type: 'warn' | 'error' | 'info'; }

function ModalNotification({ notif, onDone }: { notif: ModalNotif; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [notif]);

  const bg   = notif.type === 'error' ? 'var(--blush)' : notif.type === 'warn' ? 'var(--heirloom)' : 'var(--brand)';
  const textColor = 'var(--ivory)';
  const icon = notif.type === 'error' ? 'bi-exclamation-circle-fill' : notif.type === 'warn' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

  return (
    <div className="s-quickshopmod-00c3dc">
      <div className="s-quickshopmod-f79ffc" style={ {background: bg, color: textColor} }>
        <i className={`bi ${icon} s-quickshopmod-42031d`} />
        <span className="s-app-52dcac">{notif.message}</span>
        <button
          onClick={onDone}
          aria-label="Close"
          className="s-quickshopmod-0f4f3a" style={ {color: bg} }
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.12)';
            e.currentTarget.style.boxShadow = '0 5px 12px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.15)';
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function QuickShopModal({ productVariantId, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const qc       = useQueryClient();
  const { hasValidToken, getUserId, setCartCount, cartCount } = useAuthStore();

  const [variantId,  setVariantId]  = useState(productVariantId);
  const [selBandId,  setSelBandId]  = useState<number | null>(null);
  const [selCupId,   setSelCupId]   = useState<number | null>(null);
  const [selPVDId,   setSelPVDId]   = useState<number | null>(null);
  const [qty,        setQty]        = useState(1);
  const [showStockTip, setShowStockTip] = useState(false);
  const [imgIdx,     setImgIdx]     = useState(0);
  const [modalNotif, setModalNotif] = useState<ModalNotif | null>(null);
  const imgPaused = useRef(false);

  // ── useWishlistToggle handles both guest and auth correctly ──
  const { inWishlist, toggle: toggleWishlist } = useWishlistToggle(variantId);

  const { data: product, isLoading } = useQuery({
    queryKey: ['qs-product', variantId],
    queryFn:  () => getProductDetail(variantId),
    enabled:  variantId > 0,
  });

  useEffect(() => {
    setSelBandId(null); setSelCupId(null); setSelPVDId(null);
    setQty(1); setImgIdx(0);
  }, [variantId]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.qsPaused = '1';
    return () => {
      document.removeEventListener('keydown', fn);
      document.body.style.overflow = prev;
      delete document.body.dataset.qsPaused;
    };
  }, []);

  const images: string[] = (
    product?.images?.length ? product.images : product?.image ? [product.image] : []
  ).map(getImageUrl);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => {
      if (!imgPaused.current) setImgIdx(i => (i + 1) % images.length);
    }, 2500);
    return () => clearInterval(id);
  }, [images.length]);

  const hasCupSize = !!product?.isCupSize && !isAlphaSizeProduct(product?.name);

  const rawSizes:    any[] = product?.sizes    ?? [];
  const allCupSizes: any[] = product?.cupSizes ?? [];
  const pvdMatrix:   any[] = product?.pvdMatrix ?? [];
  const colors:      any[] = product?.colors   ?? [];
  const selectedColorSwatch = colors.find((c: any) => c.productVariantId === variantId);
  const selectedColor: string = selectedColorSwatch?.colorName ?? selectedColorSwatch?.color ?? '';

  const allSizes: any[] = hasCupSize
    ? rawSizes.filter((s: any) =>  /^\d+$/.test(s.sizeLabel))
    : rawSizes.filter((s: any) => !/^\d+$/.test(s.sizeLabel));

  const cupAvail = (cupId: number) => {
    if (!selBandId) {
      const c = allCupSizes.find((x: any) => x.cupSizeId === cupId);
      return { inVariant: c?.inVariant ?? false, hasStock: c?.hasStock ?? false, stock: 0 };
    }
    const row = pvdMatrix.find((r: any) => r.sizeId === selBandId && r.cupSizeId === cupId);
    if (!row) return { inVariant: false, hasStock: false, stock: 0 };
    return { inVariant: true, hasStock: row.stock > 0, stock: row.stock as number };
  };

  const selPvdRow = pvdMatrix.find((r: any) => r.productVariantDetailId === selPVDId);
  const dispPrice = selPvdRow?.finalPrice  ?? product?.price         ?? 0;
  const dispMrp   = selPvdRow?.mrpPrice    ?? product?.originalPrice  ?? 0;
  const selStock  = selPvdRow?.stock ??
    (selBandId && !hasCupSize ? allSizes.find((s: any) => s.sizeId === selBandId)?.stock ?? null : null);
  const isOOS     = selStock !== null && selStock <= 0;
  const selLabel  = selBandId ? (allSizes.find((s: any) => s.sizeId === selBandId)?.sizeLabel ?? '') : '';
  const cupLabel  = selCupId  ? (allCupSizes.find((c: any) => c.cupSizeId === selCupId)?.sizeLabel ?? '') : '';

  const onBand = (s: any) => {
    if (!s.inVariant || !s.hasStock) return;
    setSelBandId(s.sizeId); setSelCupId(null);
    if (!hasCupSize) {
      setSelPVDId(s.productVariantDetailId ?? null);
    } else {
      const avail = pvdMatrix.filter((r: any) => r.sizeId === s.sizeId && r.stock > 0);
      if (avail.length === 1) { setSelCupId(avail[0].cupSizeId); setSelPVDId(avail[0].productVariantDetailId); }
      else setSelPVDId(null);
    }
  };

  const onCup = (cupId: number) => {
    const a = cupAvail(cupId);
    if (!a.inVariant || !a.hasStock) return;
    setSelCupId(cupId);
    const row = pvdMatrix.find((r: any) => r.sizeId === selBandId && r.cupSizeId === cupId);
    if (row) setSelPVDId(row.productVariantDetailId);
    setQty(1);
  };

  const showWarn = (message: string, type: ModalNotif['type'] = 'warn') =>
    setModalNotif({ message, type });

  const validate = () => {
    const entirelyOOS =
      allSizes.length > 0 && allSizes.every((s: any) => !s.hasStock) &&
      (!hasCupSize || allCupSizes.every((c: any) => !c.hasStock));
    if (entirelyOOS) {
      toast('Out of stock — we\'ll restock soon! 🛍️', {
        icon: '⏳',
        style: { background: 'var(--brand)', color: '#fff', fontWeight: 600 },
      });
      return false;
    }
    if (hasCupSize) {
      if (!selBandId) { showWarn('Please select a band size'); return false; }
      if (!selCupId)  { showWarn('Please select a cup size');  return false; }
    } else if (allSizes.some((s: any) => s.inVariant) && !selBandId) {
      showWarn('Please select your size'); return false;
    }
    if (selStock !== null && qty > selStock) {
      showWarn(`Only ${selStock} unit${selStock !== 1 ? 's' : ''} available — quantity adjusted`, 'warn');
      setQty(selStock); return false;
    }
    return true;
  };

  // ── Wishlist: single handler via useWishlistToggle (works for both guest + auth) ──
  const handleWishlist = () => {
    toggleWishlist({
      productId:        product?.productId,
      productVariantId: variantId,
      name:             product?.name,
      price:            dispPrice,
      oldPrice:         dispMrp,
      image:            images[0] || '',
      color:            selectedColor,
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/user-products/product-detail/${variantId}/${slugify(product?.name || '')}`;
    try {
      if (navigator.share) await navigator.share({ title: product?.name, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied!'); }
    } catch {}
  };

  const buildItem = () => ({
    productVariantDetailId: selPVDId,
    productId:              product?.productId,
    productVariantId:       variantId,
    state:                  'Created',
    userProfileId:          getUserId() || '',
    quantity:               qty,
  });

  // ── Cart mutation — invalidates all cart keys so Navbar + QuickCart + Cart page all refresh ──
  const addMut = useMutation({
    mutationFn: (obj: any) => addToCart(obj),
    onSuccess: () => {
      toast.success('Added to cart!');
      setCartCount(cartCount + 1);
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['quick-cart'] });
      qc.invalidateQueries({ queryKey: ['cart-bootstrap'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to add'),
  });

  const guestAdd = (thenNavigate?: string) => {
    const gc  = JSON.parse(localStorage.getItem('guestCart') || '[]');
    const key = `${variantId}-${selPVDId}`;
    const idx = gc.findIndex((x: any) => `${x.productVariantId}-${x.productVariantDetailId}` === key);
    if (idx >= 0) {
      gc[idx].quantity          = (gc[idx].quantity || 1) + qty;
      gc[idx].processedQuantity = gc[idx].quantity;
      // keep stockQuantity in sync in case it changed
      if (selStock !== null) gc[idx].stockQuantity = selStock;
    } else gc.push({
      productId:              product?.productId,
      productVariantId:       variantId,
      productVariantDetailId: selPVDId,
      quantity:               qty,
      processedQuantity:      qty,
      finalPrice:             dispPrice,
      mrpPrice:               dispMrp,
      productName:            product?.name,
      image:                  images[0] || '',
      imageURL:               images[0] || '',
      isSelected:             true,
      color:                  selectedColor    || '',
      size:                   selLabel         || '',
      cupSize:                cupLabel         || '',
      stockQuantity:          selStock ?? undefined,   // ← enables stock check in QuickCart
    });
    localStorage.setItem('guestCart', JSON.stringify(gc));
    window.dispatchEvent(new Event('guestCartUpdated'));
    if (thenNavigate) { onClose(); navigate(thenNavigate); }
    else { toast.success('Added to cart!'); onClose(); }
  };

  const handleAddToCart = () => { if (!validate()) return; if (hasValidToken()) addMut.mutate(buildItem()); else guestAdd(); };
  const handleBuyNow    = () => { if (!validate()) return; if (hasValidToken()) addMut.mutate(buildItem(), { onSuccess: () => { onClose(); navigate('/user-products/cart', { state: { from: location.pathname + location.search } }); } }); else guestAdd('/user-products/cart'); };
  const goToDetail      = () => { navigate(`/user-products/product-detail/${variantId}/${slugify(product?.name || '')}`); onClose(); };

  return (
    <>
      {/* Backdrop */}
      <div className="s-quickshopmod-f19de9"
        onClick={onClose}>

        {/* Modal */}
        <div className="s-quickshopmod-03f3dc"
          onClick={e => e.stopPropagation()}>

          {modalNotif && (
            <ModalNotification notif={modalNotif} onDone={() => setModalNotif(null)} />
          )}

          {isLoading && (
            <div className="s-quickshopmod-ac7f6f">
              <div className="s-quickshopmod-f338a2" />
            </div>
          )}

          {!isLoading && !product && (
            <div className="s-quickshopmod-9cdddc">Product not found.</div>
          )}

          {!isLoading && product && (
            <div className="s-quickshopmod-c18edd">

              {/* ── Left: image gallery ── */}
              <div className="s-quickshopmod-df96a3"
                onMouseEnter={() => { imgPaused.current = true; }}
                onMouseLeave={() => { imgPaused.current = false; }}>
                <div className="s-quickshopmod-7fa857"
                  onClick={goToDetail}>
                  <img src={images[imgIdx] || '/assets/category-bg.png'} alt={product.name}
                    className="s-home-5a5ce8"
                    onError={e => { (e.target as HTMLImageElement).src='/assets/category-bg.png'; }} />
                  {images.length > 1 && (<>
                    <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i-1+images.length)%images.length); }}
                      className="s-quickshopmod-5f0de3">‹</button>
                    <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i+1)%images.length); }}
                      className="s-quickshopmod-b53d1b">›</button>
                    <div className="s-quickshopmod-d50f91">
                      {images.slice(0,6).map((_,i) => (
                        <span key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                          className="s-quickshopmod-3625b6" style={ {background: imgIdx===i?'var(--brand)':'rgba(255,255,255,.7)'} } />
                      ))}
                    </div>
                  </>)}
                </div>
                {images.length > 1 && (
                  <div className="s-quickshopmod-c5c666">
                    {images.slice(0,5).map((img,i) => (
                      <img key={i} src={img} alt="" onClick={() => setImgIdx(i)}
                        className="s-quickshopmod-da4129" style={ {border: `2px solid ${imgIdx===i?'var(--brand)':'transparent'}`, opacity: imgIdx===i?1:.55} }
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Right: product info ── */}
              <div className="s-quickshopmod-4d5c2f">

                {/* Brand + action icons */}
                <div className="s-admininvento-69f9d2">
                  <span className="s-quickshopmod-ea9de1 s-quickshopmod-e88d07">
                    {product.brandName || 'TWAM'}
                  </span>
                  <div className="s-adminproduct-6209be">
                    <button onClick={handleWishlist} title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
                      className="s-quickshopmod-d3da6f" style={ {background: inWishlist ? 'rgba(107,15,42,0.08)' : 'none', border: `1px solid ${inWishlist ? 'var(--brand)' : 'var(--ivory)'}`, color: inWishlist ? 'var(--brand)' : 'var(--heirloom)'} }>
                      <i className={`bi ${inWishlist?'bi-heart-fill':'bi-heart'} s-addresslist-9eec06`} />
                    </button>
                    <button onClick={handleShare} title="Share"
                      className="s-quickshopmod-25000d">
                      <i className="bi bi-share s-couponslist-030edf" />
                    </button>
                    <button onClick={onClose} title="Close"
                      className="s-quickshopmod-a75fdf"
                      onMouseEnter={e => { e.currentTarget.style.background='var(--brand)'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='var(--brand)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--heirloom)'; e.currentTarget.style.borderColor='var(--ivory)'; }}>
                      <i className="bi bi-x-lg s-couponslist-030edf" />
                    </button>
                  </div>
                </div>

                {/* Name + Rating (always shown even when rating = 0) */}
                <div className="s-quickshopmod-5f2dac">
                  <h3
                    onClick={goToDetail}
                    className="s-quickshopmod-d6ba9e">
                    {product.name}
                  </h3>

                  <div className="s-quickshopmod-135441">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i key={i}
                        className={`bi ${i < Math.floor(product.rating) ? 'bi-star-fill' : i < product.rating ? 'bi-star-half' : 'bi-star'} s-quickshopmod-07332b`} style={ {color: product.rating > 0 ? 'var(--brand)' : 'var(--ivory)'} }
                      />
                    ))}
                    <span className="s-quickshopmod-82b278">
                      {Number(product.rating).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Price row */}
                <div className="s-quickshopmod-392677">
                  <span className="s-quickshopmod-4241b5">{formatPrice(dispPrice)}</span>
                  {dispMrp > dispPrice && (<>
                    <span className="s-quickshopmod-056d49">{formatPrice(dispMrp)}</span>
                    <span className="s-quickshopmod-360f44">
                      {Math.round(((dispMrp-dispPrice)/dispMrp)*100)}% OFF
                    </span>
                  </>)}
                </div>

                {/* Color */}
                {colors.length > 1 && (
                  <div>
                    <p className="s-quickshopmod-56bf79 s-quickshopmod-d170d8">Color</p>
                    <div className="s-quickshopmod-70d45f">
                      {colors.map((col: any) => (
                        <button key={col.productVariantId} onClick={() => setVariantId(col.productVariantId)}
                          title={col.colorName ?? col.color}
                          className="s-quickshopmod-150a6b" style={{ background: resolveHex(col.colorHex ?? col.color), border: `3px solid ${col.productVariantId===variantId?'var(--brand)':'transparent'}`, boxShadow: col.productVariantId===variantId?'0 0 0 2px #6b0f2a':'0 1px 4px rgba(0,0,0,.2)', transform: col.productVariantId===variantId?'scale(1.15)':'scale(1)' }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                <div>
                  <div className="s-quickcart-4b986c">
                    <p className="s-quickshopmod-faa5e3">
                      Size
                      {selLabel && (
                        <span className="s-quickshopmod-f04ef2">
                          {selLabel}{cupLabel ? ` / ${cupLabel}` : ''}
                          {selStock !== null && !isOOS && (
                            <span className="s-quickshopmod-b6b997" style={ {color: selStock<=3?'var(--brand)':'var(--brand)'} }>
                              {selStock<=3 ? `(${selStock} left)` : '✓ In stock'}
                            </span>
                          )}
                          {isOOS && <span className="s-quickshopmod-afbaa7">Out of stock</span>}
                        </span>
                      )}
                    </p>
                    <Link to="/size-guide" onClick={onClose}
                      className="s-quickshopmod-130dd3">Size Chart</Link>
                  </div>

                  <p className="s-quickshopmod-53be2b">
                    {hasCupSize ? 'Select your band size:' : 'Select your size:'}
                  </p>
                  <div className="s-quickshopmod-9348d3" style={ {marginBottom: hasCupSize ? 12 : 0} }>
                    {allSizes.map((s: any) => (
                      <SizeBtn key={s.sizeId}
                        label={s.sizeLabel} selected={selBandId===s.sizeId}
                        inVariant={s.inVariant} hasStock={s.hasStock} stock={s.stock}
                        onClick={() => onBand(s)} />
                    ))}
                  </div>

                  {hasCupSize && allCupSizes.length > 0 && (
                    <>
                      <p className="s-quickshopmod-53be2b">Select your cup size:</p>
                      <div className="s-quickshopmod-07988e">
                        {allCupSizes.map((c: any) => {
                          const av = cupAvail(c.cupSizeId);
                          return (
                            <SizeBtn key={c.cupSizeId}
                              label={c.sizeLabel} selected={selCupId===c.cupSizeId}
                              inVariant={av.inVariant} hasStock={av.hasStock}
                              stock={selBandId ? av.stock : 0}
                              onClick={() => onCup(c.cupSizeId)} />
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Qty — replaced by OOS banner when all sizes unavailable */}
                {(() => {
                  const entirelyOOS =
                    allSizes.length > 0 &&
                    allSizes.every((s: any) => !s.hasStock) &&
                    (!hasCupSize || allCupSizes.every((c: any) => !c.hasStock));

                  if (entirelyOOS) return (
                    <div className="s-quickshopmod-f0f929">
                      <i className="bi bi-slash-circle s-quickshopmod-6a912d" />
                      <div>
                        <p className="s-quickshopmod-74fc36">Out of Stock</p>
                        <p className="s-quickshopmod-295a54">We'll be back soon — check again later!</p>
                      </div>
                    </div>
                  );

                  const hasSizes  = allSizes.some((s: any) => s.inVariant);
                  const qtyLocked = hasSizes && selPVDId === null;
                  return (
                    <div className="s-quickshopmod-930e9e">
                      <div className="s-updateprofil-1d5e50">
                        <p className="s-quickshopmod-2b6e29" style={ {color: qtyLocked ? 'var(--heirloom)' : 'var(--heirloom)'} }>Qty</p>
                        <div className="s-quickshopmod-7b2934" style={ {border: `1.5px solid ${qtyLocked ? 'var(--ivory)' : 'var(--ivory)'}`, background: qtyLocked ? 'var(--ivory)' : '#fff'} }>
                          <button
                            disabled={qtyLocked || qty <= 1}
                            onClick={() => setQty(q => Math.max(1, q - 1))}
                            className="s-quickshopmod-4b7499" style={{ cursor: (qtyLocked || qty <= 1) ? 'not-allowed' : 'pointer', color: (qtyLocked || qty <= 1) ? 'var(--ivory)' : '#000' }}>−</button>
                          <span className="s-quickshopmod-c5b4f1" style={ {color: qtyLocked ? 'var(--heirloom)' : '#000000'} }>{qty}</span>
                          <button
                            disabled={qtyLocked}
                            onClick={() => {
                              if (selStock !== null && qty >= selStock) {
                                setShowStockTip(true);
                                setTimeout(() => setShowStockTip(false), 2200);
                                return;
                              }
                              setQty(q => q + 1);
                            }}
                            className="s-quickshopmod-9562cb" style={{ cursor: (qtyLocked || (selStock !== null && qty >= selStock)) ? 'not-allowed' : 'pointer', color: (qtyLocked || (selStock !== null && qty >= selStock)) ? 'var(--ivory)' : '#000' }}>+</button>
                        </div>
                        {showStockTip && selStock !== null && (
                          <div className="s-quickshopmod-7d337a">
                            {selStock} available
                          </div>
                        )}
                        {qtyLocked && (
                          <p className="s-quickshopmod-c3f009">
                            ↑ Select a size first
                          </p>
                        )}
                      </div>

                      {/* Stock status */}
                      {!qtyLocked && selStock !== null && (
                        <div className="s-quickshopmod-fa18f9">
                          <p className="s-quickshopmod-41f0a1" style={ {color: isOOS ? 'var(--brand)' : selStock <= 3 ? 'var(--brand)' : 'var(--brand)'} }>
                            {isOOS
                              ? '🚫 Out of stock'
                              : selStock <= 3
                                ? `⚠️ Only ${selStock} left!`
                                : '✓ In stock'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* CTA buttons */}
                <div className="s-quickshopmod-8c2d93">
                  <button onClick={handleAddToCart}
                    disabled={addMut.isPending || isOOS}
                    className="s-quickshopmod-6cb3ac" style={ {background: isOOS?'var(--ivory)':'var(--brand)', cursor: isOOS?'not-allowed':'pointer'} }>
                    {addMut.isPending
                      ? <div className="s-quickshopmod-25cf85" />
                      : <i className="bi bi-cart-plus" />}
                    Add to Cart
                  </button>
                  <button onClick={handleBuyNow}
                    disabled={isOOS}
                    className="s-quickshopmod-2a0451" style={ {background: isOOS?'var(--ivory)':'#fff', color: isOOS?'var(--heirloom)':'var(--brand)', border: `2px solid ${isOOS?'var(--ivory)':'var(--brand)'}`, cursor: isOOS?'not-allowed':'pointer'} }>
                    <i className="bi bi-lightning-fill" />Buy Now
                  </button>
                </div>

                {/* Delivery / return info */}
                <div className="s-quickshopmod-ac060f">
                  <span className="s-quickshopmod-21de92">
                    <i className="bi bi-truck s-resetpasswor-ddc1b2" />
                    Free delivery on orders above <strong>₹5000</strong>
                  </span>
                  {product.isReturnAvailable && (
                    <span className="s-quickshopmod-21de92">
                      <i className="bi bi-arrow-return-left s-resetpasswor-ddc1b2" />
                      Easy returns within 15 days
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}