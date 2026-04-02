import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listBrands } from '@/features/products/api/products.api';

export default function TwamBrands() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['brands-page'],
    // FIX: 'page.pageSize' not a valid key; 0 rejected by backend (ge:1)
    queryFn: () => listBrands({ 'Page.Size': 500, 'Order.Property': 'ModifiedDate', 'Order.Ascending': false }),
  });

  const logos = data?.list ?? [];

  const goToProducts = (brandId: number) => {
    navigate(`/user-products/product-list?brandId=${brandId}`);
  };

  return (
    <div>
      {/* Banner */}
      <img src="public/assets/brands-banner.jpg" className="img-fluid"
        style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).src = '/assets/images/10683.jpg'; }}
        alt="Brands Banner" />

      <div className="container" style={{ padding: '48px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 className="section-title">Brands on TWAM</h2>
          <p style={{ color: '#888', fontSize: 15, marginTop: 8 }}>Discover premium brands curated for your perfect fit</p>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ background: '#f5f5f5', borderRadius: 10, height: 160, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : logos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No brands found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
            {logos.map((brand: any) => (
              <div key={brand.brandId} onClick={() => goToProducts(brand.brandId)}
                style={{ border: '1px solid #eee', borderRadius: 12, padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, transition: 'all .2s', background: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = '#6A012A'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#eee'; }}>
                <img src={brand.brandImage} alt={brand.brandName}
                  style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {brand.brandName && (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'center' }}>{brand.brandName}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}