import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listBrands } from '@/features/products/api/products.api';


export function getImageUrl(path?: string) {
  if (!path) return '/assets/fallback.png';
  if (path.startsWith('http')) return path;
  return encodeURI(`http://127.0.0.1:8000${path}`);
}
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
      <div className="container s-onlytwam-d2cece">
        <div className="s-twambrands-0d7752">
          <h2 className="section-title">Brands on TWAM</h2>
          <p className="s-twambrands-3eabc9">Discover premium brands curated for your perfect fit</p>
        </div>

        {isLoading ? (
          <div className="s-twambrands-e2516f">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="s-twambrands-79a62b" />
            ))}
          </div>
        ) : logos.length === 0 ? (
          <p className="s-twambrands-1c5031">No brands found.</p>
        ) : (
          <div className="s-twambrands-e2516f">
            {logos.map((brand: any) => (
              <div key={brand.brandId} onClick={() => goToProducts(brand.brandId)}
                className="s-twambrands-cd99a8"
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--ivory)'; }}>
                <img src={getImageUrl(brand.brandLogo || brand.brandImage)}
                  alt={brand.brandName}
                  className="s-twambrands-62d26f"
                  onError={e => {
                    console.log("Image failed:", brand);
                    (e.target as HTMLImageElement).src = '/assets/fallback.png';
                  }} />
                {brand.brandName && (
                  <p className="s-twambrands-f87e81">{brand.brandName}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
