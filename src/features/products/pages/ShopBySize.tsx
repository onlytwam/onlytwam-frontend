import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listSizes, listCupSizes } from '@/features/products/api/products.api';
import toast from 'react-hot-toast';

export default function ShopBySize() {
  const navigate = useNavigate();
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [cupSizeId, setCupSizeId] = useState<number | null>(null);

  const { data: sizesData } = useQuery({
    queryKey: ['sizes'],
    // FIX: 'page.pageSize' not a valid key; 0 rejected by backend (ge:1). Use Page.Size with large value.
    queryFn: () => listSizes({ 'Page.Size': 500, 'Order.Property': 'SizeLabel', 'Order.Ascending': true }),
  });

  const { data: cupSizesData } = useQuery({
    queryKey: ['cup-sizes'],
    queryFn: () => listCupSizes({ 'Page.Size': 500, 'Order.Property': 'SizeLabel', 'Order.Ascending': true }),
  });

  const sizes = sizesData?.list ?? [];
  const cupSizes = cupSizesData?.list ?? [];

  const handleSizeClick = (id: number) => setSizeId(prev => prev === id ? null : id);
  const handleCupClick = (id: number) => setCupSizeId(prev => prev === id ? null : id);

  const goToShop = () => {
    if (!sizeId) { toast('Please select a size'); return; }
    navigate(`/user-products/product-list?sizeId=${sizeId}${cupSizeId ? `&cupSizeId=${cupSizeId}` : ''}`);
  };

  const sizeBtn = (label: string, selected: boolean, onClick: () => void) => (
    <a key={label} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 60, padding: '10px 16px', border: `2px solid ${selected ? '#6A012A' : '#ddd'}`, borderRadius: 6, background: selected ? '#6A012A' : '#fff', color: selected ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: selected ? 700 : 500, transition: 'all .15s', userSelect: 'none' }}>
      {label}
    </a>
  );

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '50px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 10px' }}>Shop By Bra Size</h1>
        <p style={{ opacity: .85, fontSize: 15, margin: 0 }}>Prefer to browse by size? Shop directly from your preferred band and cup size combinations.</p>
      </div>

      <div className="container" style={{ padding: '40px 16px', maxWidth: 800 }}>
        {/* Band sizes */}
        <div style={{ marginBottom: 32 }}>
          <h6 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-rulers" style={{ color: '#6A012A' }} />
            Select your band size:
          </h6>
          {sizes.length === 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['30','32','34','36','38','40','42','44'].map(s => sizeBtn(s, false, () => {}))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {sizes.map((size: any) => sizeBtn(size.sizeLabel, sizeId === size.sizeId, () => handleSizeClick(size.sizeId)))}
            </div>
          )}
        </div>

        {/* Cup sizes */}
        <div style={{ marginBottom: 32 }}>
          <h6 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-grid" style={{ color: '#6A012A' }} />
            Select your cup size: <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>(optional)</span>
          </h6>
          {cupSizes.length === 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['A','B','C','D','DD','E','F'].map(s => sizeBtn(s, false, () => {}))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {cupSizes.map((cs: any) => sizeBtn(cs.sizeLabel, cupSizeId === cs.cupSizeId, () => handleCupClick(cs.cupSizeId)))}
            </div>
          )}
        </div>

        {/* Selection summary */}
        {(sizeId || cupSizeId) && (
          <div style={{ background: '#fff5f5', border: '1px solid #f0c0c0', borderRadius: 8, padding: '14px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="bi bi-check-circle-fill" style={{ color: '#6A012A', fontSize: 18 }} />
            <span style={{ fontSize: 14, color: '#333' }}>
              Selected: {sizeId && sizes.find((s: any) => s.sizeId === sizeId)?.sizeLabel}
              {cupSizeId && ` / Cup ${cupSizes.find((s: any) => s.cupSizeId === cupSizeId)?.sizeLabel}`}
            </span>
          </div>
        )}

        <button onClick={goToShop} disabled={!sizeId}
          style={{ background: sizeId ? '#111' : '#ccc', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 6, cursor: sizeId ? 'pointer' : 'not-allowed', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="bi bi-bag" /> SHOP MY SIZE
        </button>

        {!sizeId && <p style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>Please select a band size to continue</p>}

        {/* Info */}
        <div style={{ marginTop: 40, background: '#f9f9f9', borderRadius: 10, padding: 20 }}>
          <h5 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111' }}>How to measure your bra size</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { step: '1', title: 'Measure your band', desc: 'Measure snugly around your ribcage, just below your bust.' },
              { step: '2', title: 'Measure your bust', desc: 'Measure around the fullest part of your chest.' },
              { step: '3', title: 'Calculate cup', desc: 'Subtract band from bust. Each inch = one cup size.' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6A012A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{item.step}</div>
                <div>
                  <h6 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>{item.title}</h6>
                  <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}