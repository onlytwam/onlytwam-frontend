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
      className="s-shopbysize-526794" style={ {border: `2px solid ${selected ? 'var(--brand)' : 'var(--ivory)'}`, background: selected ? 'var(--brand)' : '#fff', color: selected ? '#fff' : '#000000', fontWeight: selected ? 700 : 500} }>
      {label}
    </a>
  );

  return (
    <div>
      <div className="s-shopbysize-fe79b0">
        <h1 className="s-shopbysize-b64756">Shop By Bra Size</h1>
        <p className="s-shopbysize-a3f803 s-shopbysize-214505">Prefer to browse by size? Shop directly from your preferred band and cup size combinations.</p>
      </div>

      <div className="container s-shopbysize-1165ad">
        {/* Band sizes */}
        <div className="s-shopbysize-67bbc3">
          <h6 className="s-shopbysize-e84816">
            <i className="bi bi-rulers s-resetpasswor-ddc1b2" />
            Select your band size:
          </h6>
          {sizes.length === 0 ? (
            <div className="s-adminorders-2af484">
              {['30','32','34','36','38','40','42','44'].map(s => sizeBtn(s, false, () => {}))}
            </div>
          ) : (
            <div className="s-shopbysize-45bb02">
              {sizes.map((size: any) => sizeBtn(size.sizeLabel, sizeId === size.sizeId, () => handleSizeClick(size.sizeId)))}
            </div>
          )}
        </div>

        {/* Cup sizes */}
        <div className="s-shopbysize-67bbc3">
          <h6 className="s-shopbysize-e84816">
            <i className="bi bi-grid s-resetpasswor-ddc1b2" />
            Select your cup size: <span className="s-shopbysize-215adb">(optional)</span>
          </h6>
          {cupSizes.length === 0 ? (
            <div className="s-adminorders-2af484">
              {['A','B','C','D','DD','E','F'].map(s => sizeBtn(s, false, () => {}))}
            </div>
          ) : (
            <div className="s-shopbysize-45bb02">
              {cupSizes.map((cs: any) => sizeBtn(cs.sizeLabel, cupSizeId === cs.cupSizeId, () => handleCupClick(cs.cupSizeId)))}
            </div>
          )}
        </div>

        {/* Selection summary */}
        {(sizeId || cupSizeId) && (
          <div className="s-shopbysize-ec229e">
            <i className="bi bi-check-circle-fill s-shopbysize-e72347" />
            <span className="s-shopbysize-825c0b">
              Selected: {sizeId && sizes.find((s: any) => s.sizeId === sizeId)?.sizeLabel}
              {cupSizeId && ` / Cup ${cupSizes.find((s: any) => s.cupSizeId === cupSizeId)?.sizeLabel}`}
            </span>
          </div>
        )}

        <button onClick={goToShop} disabled={!sizeId}
          className="s-shopbysize-881cc8" style={ {background: sizeId ? '#000000' : 'var(--ivory)', cursor: sizeId ? 'pointer' : 'not-allowed'} }>
          <i className="bi bi-bag" /> SHOP MY SIZE
        </button>

        {!sizeId && <p className="s-shopbysize-aa86b1">Please select a band size to continue</p>}

        {/* Info */}
        <div className="s-shopbysize-0e109c">
          <h5 className="s-shopbysize-bc5705">How to measure your bra size</h5>
          <div className="s-shopbysize-a9baf6">
            {[
              { step: '1', title: 'Measure your band', desc: 'Measure snugly around your ribcage, just below your bust.' },
              { step: '2', title: 'Measure your bust', desc: 'Measure around the fullest part of your chest.' },
              { step: '3', title: 'Calculate cup', desc: 'Subtract band from bust. Each inch = one cup size.' },
            ].map(item => (
              <div key={item.step} className="s-shopbysize-8263b1">
                <div className="s-shopbysize-a309ea">{item.step}</div>
                <div>
                  <h6 className="s-shopbysize-c1e62c">{item.title}</h6>
                  <p className="s-userdashboar-bc8be4">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}