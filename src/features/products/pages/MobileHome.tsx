// Mobile-specific home page matching the reference design

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  listProducts,
  listCategories,
} from "@/features/products/api/products.api";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import QuickShopModal from "@/features/products/components/QuickShopModal";

const CATEGORIES = [
  { id: null, name: "All", slug: "" },
  { id: 1, name: "Bras", slug: "bras" },
  { id: 2, name: "Panties", slug: "panties" },
  { id: 3, name: "Active wear", slug: "active-wear" },
];

export default function MobileHome() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["mobile-products", activeCategory],
    queryFn: () =>
      listProducts({
        pageSize: 20,
        ...(activeCategory && { categoryIds: String(activeCategory) }),
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    staleTime: 30 * 1000,
  });

  const products = Array.from(
    (productsData?.list ?? [])
      .reduce((map, variant) => {
        if (!map.has(variant.productId)) {
          map.set(variant.productId, { ...variant, allVariants: [variant] });
        }
        return map;
      }, new Map())
      .values(),
  ).slice(0, 10);

  useEffect(() => {
    if (!carouselRef.current || products.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % products.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [products.length]);

  useEffect(() => {
    if (carouselRef.current && products.length > 0) {
      const cardWidth = 300;
      const gap = 16;
      carouselRef.current.scrollTo({
        left: currentSlide * (cardWidth + gap),
        behavior: "smooth",
      });
    }
  }, [currentSlide, products.length]);

  const handleCategoryClick = (categoryId: number | null) => {
    setActiveCategory(categoryId);
    setCurrentSlide(0);
  };

  const getCategoryIdBySlug = (slug: string) => {
    if (!categoriesData?.list) return null;
    const category = categoriesData.list.find((cat) =>
      cat.name.toLowerCase().includes(slug.toLowerCase()),
    );
    return category?.categoryId || null;
  };

  return (
    <div className="mobile-home">
      <div className="mobile-category-tabs">
        {CATEGORIES.map((category) => (
          <button
            key={category.id || "all"}
            className={`mobile-category-tab ${
              activeCategory === category.id ? "active" : ""
            }`}
            onClick={() =>
              handleCategoryClick(
                category.slug ? getCategoryIdBySlug(category.slug) : null,
              )
            }
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="mobile-hero">
        <img
          src="/assets/hero/mobile-hero-1.jpg"
          alt="Hero Banner"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement!.style.background =
              "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)";
          }}
        />
        <div className="mobile-hero-overlay">
          <div className="mobile-hero-featured-tag">TWAM Featured</div>
        </div>
      </div>

      <div className="mobile-products-section">
        {isLoading ? (
          <div className="mobile-loading">
            <div className="mobile-spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="mobile-empty">
            <p>No products found</p>
          </div>
        ) : (
          <>
            <div className="mobile-carousel" ref={carouselRef}>
              {products.map((product) => (
                <MobileProductCard
                  key={product.productVariantId}
                  product={product}
                  onQuickAdd={setQuickShopId}
                />
              ))}
            </div>

            <div className="mobile-carousel-dots">
              {products.map((_, index) => (
                <button
                  key={index}
                  className={`mobile-dot ${currentSlide === index ? "active" : ""}`}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <button className="mobile-fab" onClick={() => navigate("/help")}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {quickShopId && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(null)}
        />
      )}

      <style>{`
        .mobile-home {
          background: #fafafa;
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .mobile-category-tabs {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: white;
          border-bottom: 1px solid #f0f0f0;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .mobile-category-tabs::-webkit-scrollbar {
          display: none;
        }
        .mobile-category-tab {
          padding: 8px 20px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mobile-category-tab.active {
          background: #333;
          color: white;
          border-color: #333;
        }
        .mobile-category-tab:active {
          transform: scale(0.95);
        }
        .mobile-hero {
          position: relative;
          width: 100%;
          height: 280px;
          overflow: hidden;
          background: #f5f5f5;
        }
        .mobile-hero img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .mobile-hero-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.1) 0%,
            rgba(0, 0, 0, 0.3) 100%
          );
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 20px;
        }
        .mobile-hero-featured-tag {
          background: rgba(255, 255, 255, 0.95);
          color: #333;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .mobile-products-section {
          padding: 24px 0;
        }
        .mobile-loading {
          display: flex;
          justify-content: center;
          padding: 60px 20px;
        }
        .mobile-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f0f0f0;
          border-top: 3px solid #333;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .mobile-empty {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }
        .mobile-carousel {
          display: flex;
          gap: 16px;
          padding: 0 16px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .mobile-carousel::-webkit-scrollbar {
          display: none;
        }
        .mobile-carousel > * {
          scroll-snap-align: start;
          flex-shrink: 0;
        }
        .mobile-carousel-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 20px 16px;
        }
        .mobile-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d0d0d0;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: all 0.3s;
        }
        .mobile-dot.active {
          background: #333;
          width: 24px;
          border-radius: 4px;
        }
        .mobile-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          z-index: 999;
        }
        .mobile-fab:active {
          transform: scale(0.9);
        }
        .mobile-fab svg {
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
        }
      `}</style>
    </div>
  );
}
