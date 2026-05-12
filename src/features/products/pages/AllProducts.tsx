// src/features/products/pages/AllProducts.tsx

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listProducts,
  listCategories,
} from "@/features/products/api/products.api";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import ProductFilters, {
  ProductActiveFilters,
  getAppliedFilterCount,
  matchesVariantPriceFilters,
  matchesVariantSizeAndCupFilters,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";

const DEFAULT_FILTERS: ProductFilterState = {
  colors: [],
  colorFamilies: [],
  sizeIds: [],
  cupSizeIds: [],
  brandIds: [],
  categoryIds: [],
  priceMin: null,
  priceMax: null,
};

// ─── 6 hero categories config ─────────────────────────────────────────────────
const HERO_CATEGORIES = [
  { pattern: /\bbras?\b/i, file: "Bra.png", label: "BRAS" },
  { pattern: /panties|panty/i, file: "Panties.png", label: "PANTIES" },
  {
    pattern: /leak.?proof|leakproof/i,
    file: "Leakproof.png",
    label: "LEAKPROOF",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AllProducts() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const filterScrollY = useRef(0);
  const { setCrumbs } = useBreadcrumbStore();

  const [sortOption, setSortOption] = useState("latest");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const fn = () => setFilterOpen(false);
    window.addEventListener("close-filter", fn);
    return () => window.removeEventListener("close-filter", fn);
  }, []);

  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    setCrumbs([{ label: "Home", path: "/" }, { label: "All Products" }]);
  }, [setCrumbs]);

  // Filter drawer scroll lock
  useEffect(() => {
    const btn = document.querySelector(".product-toolbar__filter-button");
    if (btn) btn.classList.toggle("active", filterOpen);

    if (!isMobile) {
      document.body.style.overflow = filterOpen ? "hidden" : "";
      return () => {
        document.body.style.overflow = "";
      };
    }

    if (filterOpen) {
      const toolbar = document.querySelector(
        ".product-toolbar",
      ) as HTMLElement | null;
      const catbar = document.querySelector(
        ".mcb-wrapper",
      ) as HTMLElement | null;
      const catWasHidden =
        catbar?.classList.contains("mcb-wrapper--hidden") ?? false;
      const toolbarTop = toolbar?.style.top || "108px";
      const toolbarBottom = toolbar
        ? Math.round(toolbar.getBoundingClientRect().bottom)
        : 152;
      filterScrollY.current = window.scrollY;
      (window as any).__drawerOpen = true;
      window.dispatchEvent(new Event("filter-opened"));
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
      if (catWasHidden && catbar) catbar.classList.add("mcb-wrapper--hidden");
      else if (!catWasHidden && catbar)
        catbar.classList.remove("mcb-wrapper--hidden");
      if (toolbar) {
        toolbar.style.top = toolbarTop;
        toolbar.style.zIndex = "1210";
      }
      const offset = `${toolbarBottom}px`;
      const drawer = document.querySelector(".gs-drawer") as HTMLElement | null;
      const backdrop = document.querySelector(
        ".gs-backdrop",
      ) as HTMLElement | null;
      if (drawer) {
        drawer.style.top = offset;
        drawer.style.height = `calc(100% - ${offset})`;
      }
      if (backdrop) backdrop.style.top = offset;
    } else {
      (window as any).__drawerOpen = false;
      const toolbar = document.querySelector(
        ".product-toolbar",
      ) as HTMLElement | null;
      if (toolbar) toolbar.style.zIndex = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [filterOpen, isMobile]);

  // ── Fetch categories to resolve real categoryIds ───────────────────────────
  const { data: categoriesData } = useQuery({
    queryKey: ["all-categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 10 * 60 * 1000,
  });

  const heroTiles = useMemo(() => {
    const cats: any[] = categoriesData?.list ?? [];
    return HERO_CATEGORIES.map((hero) => {
      const matched = cats.find((c: any) =>
        hero.pattern.test(c.name ?? c.categoryName ?? ""),
      );
      return { ...hero, categoryId: matched?.categoryId ?? null };
    });
  }, [categoriesData]);

  // ── Fetch all products ─────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["all-products-page"],
    queryFn: () =>
      listProducts({
        pageSize: 500,
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    staleTime: 5 * 60 * 1000,
  });

  // ── Client-side filtering ──────────────────────────────────────────────────
  const allProducts = useMemo(() => {
    const raw = rawData?.list ?? [];
    let filtered = [...raw];
    if (filters.colors.length > 0)
      filtered = filtered.filter((p: any) =>
        filters.colors.some((fc) =>
          (p.color || "").toLowerCase().includes(fc.toLowerCase()),
        ),
      );
    if (filters.sizeIds.length > 0 || filters.cupSizeIds.length > 0)
      filtered = filtered.filter((p: any) =>
        matchesVariantSizeAndCupFilters(p, filters),
      );
    if (filters.brandIds.length > 0)
      filtered = filtered.filter((p: any) =>
        filters.brandIds.includes(p.brandId),
      );
    if (filters.categoryIds.length > 0)
      filtered = filtered.filter((p: any) =>
        filters.categoryIds.includes(p.categoryId),
      );
    if (filters.priceMin !== null || filters.priceMax !== null)
      filtered = filtered.filter((p: any) =>
        matchesVariantPriceFilters(p, filters),
      );
    return filtered;
  }, [rawData, filters]);

  // ── Client-side sorting ────────────────────────────────────────────────────
  const sortedProducts = useMemo(() => {
    const arr = [...allProducts];
    if (sortOption === "latest")
      return arr.sort(
        (a, b) => (b.productVariantId ?? 0) - (a.productVariantId ?? 0),
      );
    if (sortOption === "az")
      return arr.sort((a, b) =>
        (a.productName ?? a.name ?? "").localeCompare(
          b.productName ?? b.name ?? "",
        ),
      );
    if (sortOption === "za")
      return arr.sort((a, b) =>
        (b.productName ?? b.name ?? "").localeCompare(
          a.productName ?? a.name ?? "",
        ),
      );
    if (sortOption === "low")
      return arr.sort(
        (a, b) =>
          (a.price ?? a.finalPrice ?? 0) - (b.price ?? b.finalPrice ?? 0),
      );
    if (sortOption === "high")
      return arr.sort(
        (a, b) =>
          (b.price ?? b.finalPrice ?? 0) - (a.price ?? a.finalPrice ?? 0),
      );
    if (sortOption === "rating")
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return arr;
  }, [allProducts, sortOption]);

  // ── Product grouping ───────────────────────────────────────────────────────
  const displayProducts = useMemo(() => {
    const grouped = new Map<number, any>();
    for (const variant of sortedProducts) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }
    return Array.from(grouped.values());
  }, [sortedProducts]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(displayProducts.length / PAGE_SIZE));

  const pagesArr = useMemo(() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, "...", totalPages];
    if (page >= totalPages - 2)
      return [
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }, [page, totalPages]);

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleQuickPrice = (min: number | null, max: number | null) => {
    setFilters((f) => ({ ...f, priceMin: min, priceMax: max }));
    setPage(1);
  };

  const activeQuickPrice = useMemo(() => {
    const { priceMin, priceMax } = filters;
    if (priceMin !== null || priceMax !== null)
      return { min: priceMin, max: priceMax };
    return null;
  }, [filters.priceMin, filters.priceMax]);

  const appliedFilterCount = useMemo(
    () => getAppliedFilterCount(filters),
    [filters],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="s-productlist-3ab64d s-productlist-ff586331">
      {/* ── Desktop hero: title + 3×2 category grid ── */}
      {!isMobile && (
        <div className="ap-hero-section">
          {/* Burgundy centered heading */}
          <div className="ap-hero-title-bar">
            <h1 className="ap-hero-title">All Products</h1>
          </div>

          {/* 3-row x 2-col category grid — clean images, no text overlays */}
          <div className="ap-category-grid">
            {heroTiles.map((tile) => (
              <button
                key={tile.label}
                className="ap-category-tile"
                onClick={() =>
                  tile.categoryId &&
                  navigate(`/user-products/product-list/${tile.categoryId}`)
                }
                aria-label={`Shop ${tile.label}`}
              >
                <img
                  src={`/assets/categories/${tile.file}`}
                  alt={tile.label}
                  className="ap-category-img"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0";
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile: original hero ── */}
      {isMobile && (
        <div
          className="category-hero-banner"
          style={{
            width: "100%",
            maxWidth: "100vw",
            height: "calc(100dvh - 64px)",
            overflow: "hidden",
            margin: 0,
            padding: 0,
            lineHeight: 0,
          }}
        >
          <img
            src="/assets/categories/All.png"
            alt="All Products"
            loading="lazy"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Toolbar */}
      <ProductToolbar
        productCount={displayProducts.length}
        appliedFilterCount={appliedFilterCount}
        onFilterClick={() => setFilterOpen((o) => !o)}
        sortOption={sortOption}
        onSortChange={(val) => {
          setSortOption(val);
          setPage(1);
        }}
        onQuickPrice={handleQuickPrice}
        activeQuickPrice={activeQuickPrice}
      />

      <ProductActiveFilters
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
      />

      <ProductFilters
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        productCount={displayProducts.length}
      />

      {/* Product Grid */}
      <div className="container s-productlist-22e220">
        {isLoading ? (
          <div className="s-productlist-18a79d">
            <div className="s-productlist-feb323" />
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="s-productlist-3fa2c3">
            <i className="bi bi-bag-x s-productlist-28e718" />
            <p className="s-productlist-3964c5 s-productlist-ff586331">
              {(rawData?.list ?? []).length === 0
                ? "No products found — check back soon!"
                : "No products match your filters"}
            </p>
            {(filters.brandIds.length > 0 ||
              filters.sizeIds.length > 0 ||
              filters.cupSizeIds.length > 0 ||
              filters.colors.length > 0 ||
              filters.priceMin !== null ||
              filters.priceMax !== null) && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="s-productlist-972b82 s-productlist-ff0afd28"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div key={page} className="pl-grid-wrap pl-grid">
              {displayProducts
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((product: any) => (
                  <div key={product.productVariantId} className="pl-card-anim">
                    {isMobile ? (
                      <MobileProductCard
                        product={product}
                        onQuickShop={setQuickShopId}
                      />
                    ) : (
                      <ProductCard
                        product={product}
                        onQuickShop={setQuickShopId}
                        showColors={true}
                        singleColorOnly={true}
                        delayedDiscountReveal={true}
                      />
                    )}
                  </div>
                ))}
            </div>

            {totalPages > 1 && (
              <div className="s-productlist-a86882">
                <button
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                  className="pl-page-arrow"
                  aria-label="Previous page"
                >
                  <i className="bi bi-chevron-left" />
                </button>
                {pagesArr.map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="s-productlist-2ab2e0">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`pl-page-btn${page === p ? " active" : ""}`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  disabled={page === totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="pl-page-arrow"
                  aria-label="Next page"
                >
                  <i className="bi bi-chevron-right" />
                </button>
                <span className="s-productlist-f6dfaf s-productlist-ff0afd28">
                  {
                    displayProducts.slice(
                      (page - 1) * PAGE_SIZE,
                      page * PAGE_SIZE,
                    ).length
                  }{" "}
                  shown · Page {page}/{totalPages}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {quickShopId && (
        <QuickShopModal
          productVariantId={quickShopId}
          onClose={() => setQuickShopId(null)}
        />
      )}

      {/* ── Scoped styles ── */}
      <style>{`
        /* Hero wrapper fills viewport below navbar */
        .ap-hero-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 64px);
          overflow: hidden;
        }

        /* "All Products" — burgundy, centered */
        .ap-hero-title-bar {
          flex-shrink: 0;
          padding: 16px 0 14px;
          background: #fff;
          text-align: center;
          border-bottom: 1px solid #f0ece8;
        }

        .ap-hero-title {
          font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
          font-size: clamp(20px, 2vw, 28px);
          font-weight: 600;
          letter-spacing: 0.06em;
          color: #6b0f2a;
          margin: 0;
          text-transform: uppercase;
        }

        /* 3 rows x 2 cols grid — no text overlays */
        .ap-category-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(3, 1fr);
          gap: 0;
          overflow: hidden;
          min-height: 0;
        }

        .ap-category-tile {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          border: none;
          padding: 0;
          background: #c8b8a8;
          display: block;
          width: 100%;
          height: 100%;
        }

        .ap-category-tile:nth-child(odd)  { border-right: 1.5px solid rgba(255,255,255,0.25); }
        .ap-category-tile:nth-child(1),
        .ap-category-tile:nth-child(2)    { border-bottom: 1.5px solid rgba(255,255,255,0.25); }
        .ap-category-tile:nth-child(3),
        .ap-category-tile:nth-child(4)    { border-bottom: 1.5px solid rgba(255,255,255,0.25); }

        .ap-category-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          transition: transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .ap-category-tile:hover .ap-category-img {
          transform: scale(1.06);
        }
      `}</style>
    </div>
  );
}
