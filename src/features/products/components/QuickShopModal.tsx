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
    position: 'relative', fontFamily: 'inherit', transition: 'all .15s',
  };
  if (!inVariant) return (
    <span title="Not available" style={{ ...base, border: '1.5px dashed #d0d0d0', color: '#ccc', userSelect: 'none', cursor: 'not-allowed', position: 'relative' }}>
      {label}
    </span>
  );
  if (!hasStock) return (
    <span title="Out of stock"
      style={{ ...base, border: '1.5px solid #6B0F2A', color: '#6B0F2A', opacity: 0.45,
        textDecoration: 'line-through', userSelect: 'none', cursor: 'not-allowed' }}>
      {label}
    </span>
  );
  return (
    <button onClick={onClick} style={{
      ...base,
      border: `2px solid ${selected ? '#6A012A' : '#444'}`,
      background: selected ? '#6A012A' : '#fff',
      color: selected ? '#fff' : '#111',
      cursor: 'pointer',
    }}>
      {label}
      {stock === 1 && (
        <span style={{
          position: 'absolute', top: -5, right: -5,
          background: '#e65100', color: '#fff', fontSize: 8,
          borderRadius: '50%', width: 14, height: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
        }}>1</span>
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

  const bg   = notif.type === 'error' ? '#A84C6B' : notif.type === 'warn' ? '#9E6070' : '#6B0F2A';
  const textColor = '#F5F0E6';
  const icon = notif.type === 'error' ? 'bi-exclamation-circle-fill' : notif.type === 'warn' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.35)',
      borderRadius: 14,
      animation: 'qs-notif-bg .15s ease',
    }}>
      <div style={{
        background: bg,
        color: textColor,
        padding: '16px 20px 16px 20px',
        borderRadius: 12,
        fontSize: 14, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 12px 36px rgba(0,0,0,.35)',
        maxWidth: 300, textAlign: 'center',
        animation: 'qs-notif-in .18s ease',
        lineHeight: 1.4,
        position: 'relative',
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 20, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{notif.message}</span>
        <button
          onClick={onDone}
          aria-label="Close"
          style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffffff, #F5F0E6 55%, #ddd4c8)',
            border: '1.5px solid rgba(255,255,255,0.6)',
            boxShadow: '0 3px 8px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 800,
            color: bg,
            transition: 'transform .1s, box-shadow .1s',
            padding: 0,
          }}
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
        style: { background: '#6B0F2A', color: '#fff', fontWeight: 600 },
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
      <style>{`
        @keyframes qs-spin   { to  { transform: rotate(360deg) } }
        @keyframes qs-in     { from{ opacity:0; transform:scale(.96) } to{ opacity:1; transform:scale(1) } }
        @keyframes qs-notif-in    { from{ opacity:0; transform:scale(.85) translateY(10px) } to{ opacity:1; transform:scale(1) translateY(0) } }
        @keyframes qs-notif-bg    { from{ opacity:0 } to{ opacity:1 } }
      `}</style>

      {/* Backdrop */}
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}
        onClick={onClose}>

        {/* Modal */}
        <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:740,
          maxHeight:'92vh', overflowY:'auto', position:'relative',
          animation:'qs-in .18s ease', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}
          onClick={e => e.stopPropagation()}>

          {modalNotif && (
            <ModalNotification notif={modalNotif} onDone={() => setModalNotif(null)} />
          )}

          {isLoading && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:70 }}>
              <div style={{ width:36, height:36, border:'3px solid #f0f0f0', borderTopColor:'#6A012A',
                borderRadius:'50%', animation:'qs-spin .8s linear infinite' }} />
            </div>
          )}

          {!isLoading && !product && (
            <div style={{ padding:50, textAlign:'center', color:'#888' }}>Product not found.</div>
          )}

          {!isLoading && product && (
            <div style={{ display:'flex', flexWrap:'wrap' }}>

              {/* ── Left: image gallery ── */}
              <div style={{ flex:'0 0 280px', padding:'16px 12px 16px 16px' }}
                onMouseEnter={() => { imgPaused.current = true; }}
                onMouseLeave={() => { imgPaused.current = false; }}>
                <div style={{ position:'relative', borderRadius:10, overflow:'hidden',
                  background:'#f8f8f8', cursor:'pointer', aspectRatio:'3/4' }}
                  onClick={goToDetail}>
                  <img src={images[imgIdx] || '/assets/category-bg.png'} alt={product.name}
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                    onError={e => { (e.target as HTMLImageElement).src='/assets/category-bg.png'; }} />
                  {images.length > 1 && (<>
                    <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i-1+images.length)%images.length); }}
                      style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
                        background:'rgba(255,255,255,.9)', border:'none', borderRadius:'50%',
                        width:28, height:28, cursor:'pointer', fontSize:15, display:'flex',
                        alignItems:'center', justifyContent:'center' }}>‹</button>
                    <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i+1)%images.length); }}
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                        background:'rgba(255,255,255,.9)', border:'none', borderRadius:'50%',
                        width:28, height:28, cursor:'pointer', fontSize:15, display:'flex',
                        alignItems:'center', justifyContent:'center' }}>›</button>
                    <div style={{ position:'absolute', bottom:8, left:0, right:0,
                      display:'flex', justifyContent:'center', gap:5 }}>
                      {images.slice(0,6).map((_,i) => (
                        <span key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                          style={{ width:6, height:6, borderRadius:'50%', cursor:'pointer',
                            background:imgIdx===i?'#6A012A':'rgba(255,255,255,.7)' }} />
                      ))}
                    </div>
                  </>)}
                </div>
                {images.length > 1 && (
                  <div style={{ display:'flex', gap:5, marginTop:7, flexWrap:'wrap' }}>
                    {images.slice(0,5).map((img,i) => (
                      <img key={i} src={img} alt="" onClick={() => setImgIdx(i)}
                        style={{ width:44, height:54, objectFit:'cover', borderRadius:5, cursor:'pointer',
                          border:`2px solid ${imgIdx===i?'#6A012A':'transparent'}`, opacity:imgIdx===i?1:.55 }}
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Right: product info ── */}
              <div style={{ flex:1, padding:'14px 16px 20px 4px', minWidth:240,
                display:'flex', flexDirection:'column', gap:10 }}>

                {/* Brand + action icons */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:.7, fontWeight:600 }}>
                    {product.brandName || 'TWAM'}
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={handleWishlist} title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
                      style={{ background: inWishlist ? 'rgba(107,15,42,0.08)' : 'none',
                        border: `1px solid ${inWishlist ? '#6B0F2A' : '#eee'}`, borderRadius:'50%', width:30, height:30,
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow: '0 2px 6px rgba(107,15,42,0.10)', transition: 'all .15s',
                        color: inWishlist ? '#6B0F2A' : '#888' }}>
                      <i className={`bi ${inWishlist?'bi-heart-fill':'bi-heart'}`} style={{ fontSize:13 }} />
                    </button>
                    <button onClick={handleShare} title="Share"
                      style={{ background:'none', border:'1px solid #eee', borderRadius:'50%', width:30, height:30,
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888',
                        boxShadow: '0 2px 6px rgba(107,15,42,0.08)' }}>
                      <i className="bi bi-share" style={{ fontSize:12 }} />
                    </button>
                    <button onClick={onClose} title="Close"
                      style={{ background:'none', border:'1px solid #eee', borderRadius:'50%', width:30, height:30,
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888',
                        boxShadow: '0 2px 6px rgba(107,15,42,0.08)', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#6B0F2A'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6B0F2A'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#888'; e.currentTarget.style.borderColor='#eee'; }}>
                      <i className="bi bi-x-lg" style={{ fontSize:12 }} />
                    </button>
                  </div>
                </div>

                {/* Name + Rating (always shown even when rating = 0) */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <h3
                    onClick={goToDetail}
                    style={{ margin:0, fontSize:17, fontWeight:700, lineHeight:1.3, cursor:'pointer', flex:1 }}>
                    {product.name}
                  </h3>

                  <div style={{
                    display:'flex', alignItems:'center', gap:3, flexShrink:0,
                    background:'#fff8e1', border:'1px solid #ffe082',
                    borderRadius:20, padding:'4px 10px', marginTop:2,
                  }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i key={i}
                        className={`bi ${i < Math.floor(product.rating) ? 'bi-star-fill' : i < product.rating ? 'bi-star-half' : 'bi-star'}`}
                        style={{
                          fontSize: 10,
                          color: product.rating > 0 ? '#f4a623' : '#ccc'
                        }}
                      />
                    ))}
                    <span style={{ fontSize:12, fontWeight:700, color:'#795548', marginLeft:2 }}>
                      {Number(product.rating).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Price row */}
                <div style={{ display:'flex', alignItems:'center', gap:8,
                  background:'#fdf5f7', border:'1px solid #f0d8df', borderRadius:8,
                  padding:'7px 12px', alignSelf:'flex-start' }}>
                  <span style={{ fontSize:19, fontWeight:800, color:'#6A012A' }}>{formatPrice(dispPrice)}</span>
                  {dispMrp > dispPrice && (<>
                    <span style={{ fontSize:12, textDecoration:'line-through', color:'#aaa' }}>{formatPrice(dispMrp)}</span>
                    <span style={{ fontSize:11, background:'#fff3e0', color:'#e65100',
                      padding:'2px 6px', borderRadius:4, fontWeight:700 }}>
                      {Math.round(((dispMrp-dispPrice)/dispMrp)*100)}% OFF
                    </span>
                  </>)}
                </div>

                {/* Color */}
                {colors.length > 1 && (
                  <div>
                    <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:'#333', textTransform:'uppercase', letterSpacing:.5 }}>Color</p>
                    <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                      {colors.map((col: any) => (
                        <button key={col.productVariantId} onClick={() => setVariantId(col.productVariantId)}
                          title={col.colorName ?? col.color}
                          style={{ width:28, height:28, borderRadius:'50%', background:resolveHex(col.colorHex ?? col.color), cursor:'pointer',
                            border:`3px solid ${col.productVariantId===variantId?'#6A012A':'transparent'}`,
                            boxShadow:col.productVariantId===variantId?'0 0 0 2px #6A012A':'0 1px 4px rgba(0,0,0,.2)', padding:0,
                            transition:'transform .15s', transform:col.productVariantId===variantId?'scale(1.15)':'scale(1)' }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#111' }}>
                      Size
                      {selLabel && (
                        <span style={{ fontWeight:400, color:'#6A012A', marginLeft:6 }}>
                          {selLabel}{cupLabel ? ` / ${cupLabel}` : ''}
                          {selStock !== null && !isOOS && (
                            <span style={{ marginLeft:6, fontSize:11,
                              color:selStock<=3?'#e65100':'#2e7d32', fontWeight:600 }}>
                              {selStock<=3 ? `(${selStock} left)` : '✓ In stock'}
                            </span>
                          )}
                          {isOOS && <span style={{ marginLeft:6, fontSize:11, color:'#c62828', fontWeight:600 }}>Out of stock</span>}
                        </span>
                      )}
                    </p>
                    <Link to="/size-guide" onClick={onClose}
                      style={{ fontSize:11, color:'#6A012A', textDecoration:'underline' }}>Size Chart</Link>
                  </div>

                  <p style={{ margin:'0 0 6px', fontSize:11, color:'#777' }}>
                    {hasCupSize ? 'Select your band size:' : 'Select your size:'}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: hasCupSize ? 12 : 0 }}>
                    {allSizes.map((s: any) => (
                      <SizeBtn key={s.sizeId}
                        label={s.sizeLabel} selected={selBandId===s.sizeId}
                        inVariant={s.inVariant} hasStock={s.hasStock} stock={s.stock}
                        onClick={() => onBand(s)} />
                    ))}
                  </div>

                  {hasCupSize && allCupSizes.length > 0 && (
                    <>
                      <p style={{ margin:'0 0 6px', fontSize:11, color:'#777' }}>Select your cup size:</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
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
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#fff5f5', border: '1.5px solid #f5c6cb',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <i className="bi bi-slash-circle" style={{ fontSize: 20, color: '#c62828', flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#c62828' }}>Out of Stock</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#e57373' }}>We'll be back soon — check again later!</p>
                      </div>
                    </div>
                  );

                  const hasSizes  = allSizes.some((s: any) => s.inVariant);
                  const qtyLocked = hasSizes && selPVDId === null;
                  return (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                      <div style={{ position: 'relative' }}>
                        <p style={{ margin:'0 0 5px', fontSize:10, fontWeight:700,
                          color: qtyLocked ? '#bbb' : '#666',
                          textTransform:'uppercase', letterSpacing:.4 }}>Qty</p>
                        <div style={{
                          display:'flex', alignItems:'center',
                          border:`1.5px solid ${qtyLocked ? '#eee' : '#ddd'}`,
                          borderRadius:7, overflow:'hidden', width:96,
                          background: qtyLocked ? '#fafafa' : '#fff',
                        }}>
                          <button
                            disabled={qtyLocked || qty <= 1}
                            onClick={() => setQty(q => Math.max(1, q - 1))}
                            style={{ flex:1, padding:'6px', border:'none', background:'transparent',
                              cursor: (qtyLocked || qty <= 1) ? 'not-allowed' : 'pointer',
                              fontSize:16, color: (qtyLocked || qty <= 1) ? '#ccc' : '#333' }}>−</button>
                          <span style={{ flex:1, textAlign:'center', fontSize:14,
                            fontWeight:600, color: qtyLocked ? '#bbb' : '#111' }}>{qty}</span>
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
                            style={{ flex:1, padding:'6px', border:'none', background:'transparent',
                              cursor: (qtyLocked || (selStock !== null && qty >= selStock)) ? 'not-allowed' : 'pointer',
                              fontSize:16, color: (qtyLocked || (selStock !== null && qty >= selStock)) ? '#ccc' : '#333' }}>+</button>
                        </div>
                        {showStockTip && selStock !== null && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 50,
                            background: '#fff', border: '1.5px solid #6B0F2A',
                            borderRadius: 8, padding: '6px 13px', marginTop: 4,
                            fontSize: 12, fontWeight: 600, color: '#6B0F2A',
                            boxShadow: '0 4px 14px rgba(107,15,42,.18)',
                            whiteSpace: 'nowrap', pointerEvents: 'none',
                          }}>
                            {selStock} available
                          </div>
                        )}
                        {qtyLocked && (
                          <p style={{ margin:'4px 0 0', fontSize:10, color:'#e65100', fontWeight:600 }}>
                            ↑ Select a size first
                          </p>
                        )}
                      </div>

                      {/* Stock status */}
                      {!qtyLocked && selStock !== null && (
                        <div style={{ paddingTop: 22 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700,
                            color: isOOS ? '#c62828' : selStock <= 3 ? '#e65100' : '#2e7d32' }}>
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
                <div style={{ display:'flex', gap:8, marginTop:'auto', paddingTop:4 }}>
                  <button onClick={handleAddToCart}
                    disabled={addMut.isPending || isOOS}
                    style={{ flex:1, background:isOOS?'#ccc':'#6A012A', color:'#fff', border:'none',
                      padding:'11px 10px', borderRadius:8, cursor:isOOS?'not-allowed':'pointer',
                      fontSize:13, fontWeight:700, display:'flex', alignItems:'center',
                      justifyContent:'center', gap:6, fontFamily:'inherit' }}>
                    {addMut.isPending
                      ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'qs-spin .8s linear infinite' }} />
                      : <i className="bi bi-cart-plus" />}
                    Add to Cart
                  </button>
                  <button onClick={handleBuyNow}
                    disabled={isOOS}
                    style={{ flex:1, background:isOOS?'#f5f5f5':'#fff',
                      color:isOOS?'#aaa':'#6A012A',
                      border:`2px solid ${isOOS?'#eee':'#6A012A'}`,
                      padding:'11px 10px', borderRadius:8, cursor:isOOS?'not-allowed':'pointer',
                      fontSize:13, fontWeight:700, display:'flex', alignItems:'center',
                      justifyContent:'center', gap:6, fontFamily:'inherit' }}>
                    <i className="bi bi-lightning-fill" />Buy Now
                  </button>
                </div>

                {/* Delivery / return info */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <span style={{ fontSize:11, color:'#555', display:'flex', alignItems:'center', gap:6 }}>
                    <i className="bi bi-truck" style={{ color:'#2e7d32' }} />
                    Free delivery on orders above <strong>₹5000</strong>
                  </span>
                  {product.isReturnAvailable && (
                    <span style={{ fontSize:11, color:'#555', display:'flex', alignItems:'center', gap:6 }}>
                      <i className="bi bi-arrow-return-left" style={{ color:'#2e7d32' }} />
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