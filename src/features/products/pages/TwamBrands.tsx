import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/features/products/api/products.api";
import { getImageUrl } from "@/shared/utils/helpers";

export default function TwamBrands() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["brands-page"],
    // FIX: 'page.pageSize' not a valid key; 0 rejected by backend (ge:1)
    queryFn: () =>
      listBrands({
        "Page.Size": 500,
        "Order.Property": "ModifiedDate",
        "Order.Ascending": false,
        withProducts: true,
      }),
  });

  // Only show brands that have an image uploaded — a card with no image is useless.
  const logos = (data?.list ?? []).filter(
    (b: any) => b.brandImage || b.brandLogo,
  );

  const isTwamBrand = (brand: any) =>
    typeof brand.brandName === "string" &&
    brand.brandName.trim().toLowerCase() === "twam";

  const twamBrand = logos.find(isTwamBrand);
  const otherBrands = logos.filter(
    (brand: any) => brand.brandId !== twamBrand?.brandId,
  );

  const goToProducts = (brandId: number) => {
    navigate(`/user-products/product-list?brandId=${brandId}`);
  };

  return (
    <div>
      <div className="container s-onlytwam-d2cece">
        <div className="s-twambrands-0d7752">
          <h2 className="section-title">Brands on TWAM</h2>
          <p className="s-twambrands-3eabc9">
            Discover premium brands curated for your perfect fit
          </p>
        </div>

        {isLoading ? (
          <div className="s-twambrands-e2516f">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="s-twambrands-79a62b" />
            ))}
          </div>
        ) : logos.length === 0 ? (
          <p className="s-twambrands-1c5031">No brands found.</p>
        ) : (
          <>
            {twamBrand ? (
              <section className="s-twambrands-featured">
                <div className="s-twambrands-featured-row">
                  <button
                    type="button"
                    className="s-twambrands-featured-image-card"
                    onClick={() => goToProducts(twamBrand.brandId)}
                  >
                    <span className="s-twambrands-image-frame">
                      <img
                        src={getImageUrl(
                          twamBrand.brandImage || twamBrand.brandLogo,
                          "/assets/fallback.png",
                        )}
                        alt={twamBrand.brandName}
                        className="s-twambrands-62d26f"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/assets/fallback.png";
                        }}
                      />
                    </span>
                    {twamBrand.brandName && (
                      <p className="s-twambrands-featured-name">
                        {twamBrand.brandName}
                      </p>
                    )}
                  </button>

                  <div className="s-twambrands-featured-copy">
                    <h2 className="s-twambrands-featured-title">
                      Our signature brand
                    </h2>
                    <p className="s-twambrands-featured-tagline">
                      Designed to stand out with premium comfort, effortless
                      style, and a bold sense of self.
                    </p>
                    <button
                      type="button"
                      className="s-twambrands-featured-cta"
                      onClick={() => goToProducts(twamBrand.brandId)}
                    >
                      Shop TWAM
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="s-twambrands-0d7752">
              <h2 className="section-title">
                {twamBrand ? "Other brands" : "Brands on TWAM"}
              </h2>
              {twamBrand ? (
                <p className="s-twambrands-3eabc9">
                  Explore more premium labels available on TWAM.
                </p>
              ) : (
                <p className="s-twambrands-3eabc9">
                  Discover premium brands curated for your perfect fit
                </p>
              )}
            </div>

            {otherBrands.length === 0 ? (
              <p className="s-twambrands-1c5031">No other brands found.</p>
            ) : (
              <div className="s-twambrands-e2516f">
                {otherBrands.map((brand: any) => (
                  <button
                    key={brand.brandId}
                    type="button"
                    onClick={() => goToProducts(brand.brandId)}
                    className="s-twambrands-cd99a8"
                    aria-label={`Shop ${brand.brandName}`}
                  >
                    <span className="s-twambrands-image-frame">
                      <img
                        src={getImageUrl(
                          brand.brandImage || brand.brandLogo,
                          "/assets/fallback.png",
                        )}
                        alt={brand.brandName}
                        className="s-twambrands-62d26f"
                        onError={(e) => {
                          console.log("Image failed:", brand);
                          (e.target as HTMLImageElement).src =
                            "/assets/fallback.png";
                        }}
                      />
                    </span>
                    {brand.brandName && (
                      <p className="s-twambrands-f87e81">{brand.brandName}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
