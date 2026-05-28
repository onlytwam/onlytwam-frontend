// src/features/products/pages/AllProducts.tsx

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  matchesVariantCollectionPriceFilters,
  matchesVariantCollectionSizeAndCupFilters,
  matchesVariantCollectionColorFilters,
  reorderVariantsForColorFilter,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";
import { useMenuStore } from "@/shared/store/menuStore";

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
// ─── Main Component ───────────────────────────────────────────────────────────
export default function AllProducts() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const filterScrollY = useRef(0);
  const { setCrumbs } = useBreadcrumbStore();
  const queryClient = useQueryClient();
  const { menus } = useMenuStore();

  // When admin hides/shows a category, immediately invalidate stale caches
  // so hidden-category products and nav entries disappear without a page reload.
  useEffect(() => {
    const onCategoriesUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["all-categories"] });
      queryClient.invalidateQueries({ queryKey: ["all-products-page"] });
    };
    window.addEventListener("categoriesUpdated", onCategoriesUpdated);
    return () =>
      window.removeEventListener("categoriesUpdated", onCategoriesUpdated);
  }, [queryClient]);

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
    staleTime: 0,
  });

  const categoryTiles = useMemo(() => {
    const cats: any[] = categoriesData?.list ?? [];
    const imageByCategoryId = new Map<number, string>();

    cats.forEach((cat: any) => {
      if (cat.categoryImage) {
        imageByCategoryId.set(cat.categoryId, cat.categoryImage);
      }
    });

    return menus.map((menu) => ({
      categoryId: menu.categoryId,
      label: menu.name,
      image: imageByCategoryId.get(menu.categoryId) ?? "",
    }));
  }, [categoriesData, menus]);

  // ── Fetch all products ─────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["all-products-page"],
    queryFn: () =>
      listProducts({
        pageSize: 500,
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    staleTime: 0,
  });

  useEffect(() => {
    if (!isLoading) window.dispatchEvent(new Event("page-content-ready"));
  }, [isLoading]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const allProducts = useMemo(() => {
    const raw = rawData?.list ?? [];

    // Group by productId so allVariants is available for color reordering
    const grouped = new Map<number, any>();
    for (const variant of raw) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }

    let list = Array.from(grouped.values());

    // Color filter: hide products with no matching variant; reorder matching first
    if (filters.colorFamilies.length > 0 || filters.colors.length > 0) {
      list = list.filter((p) =>
        matchesVariantCollectionColorFilters(p.allVariants, filters),
      );
      list = list.map((p) => {
        const reordered = reorderVariantsForColorFilter(p.allVariants, filters);
        return { ...reordered[0], allVariants: reordered };
      });
    }

    if (filters.brandIds.length > 0)
      list = list.filter((p: any) => filters.brandIds.includes(p.brandId));
    if (filters.categoryIds.length > 0)
      list = list.filter((p: any) =>
        filters.categoryIds.includes(p.categoryId),
      );

    return list.filter(
      (p) =>
        matchesVariantCollectionSizeAndCupFilters(p.allVariants, filters) &&
        matchesVariantCollectionPriceFilters(p.allVariants, filters),
    );
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

  // ── Products to display ────────────────────────────────────────────────────
  const displayProducts = sortedProducts;

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
      <section className="ap-hero-section" aria-label="Shop by category">
          {/* Burgundy centered heading */}
        <div className="ap-hero-title-bar">
          <h1 className="ap-hero-title">All Products</h1>
        </div>

          {/* 3-row x 2-col category grid — images from API, no static assets */}
        <div className="ap-category-grid">
          {categoryTiles.map((tile) => (
            <button
              key={tile.categoryId}
              className="ap-category-tile"
              onClick={() =>
                navigate(`/user-products/product-list/${tile.categoryId}`)
              }
              aria-label={`Shop ${tile.label}`}
            >
              {tile.image ? (
                <img
                  src={tile.image}
                  alt={tile.label}
                  className="ap-category-img"
                  loading="lazy"
                />
              ) : (
                <span className="ap-category-label">{tile.label}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Mobile: hero banner from API — only shown when image is uploaded ── */}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "24px",
              paddingTop: 16,
            }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div
                  className="twam-skel"
                  style={{ aspectRatio: "3/4", borderRadius: 12 }}
                />
                <div
                  className="twam-skel"
                  style={{ height: 14, width: "70%", borderRadius: 6 }}
                />
                <div
                  className="twam-skel"
                  style={{ height: 12, width: "45%", borderRadius: 6 }}
                />
                <div
                  className="twam-skel"
                  style={{ height: 14, width: "35%", borderRadius: 6 }}
                />
              </div>
            ))}
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
                  <div key={product.productId} className="pl-card-anim">
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
          padding: clamp(12px, 2vw, 24px);
          background: #fff;
        }

        /* "All Products" — burgundy, centered */
        .ap-hero-title-bar {
          padding: 8px 0 18px;
          text-align: center;
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
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
          gap: clamp(10px, 1.4vw, 18px);
          max-width: 1280px;
          margin: 0 auto;
        }

        .ap-category-tile {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(107, 15, 42, 0.08);
          border-radius: 8px;
          padding: 0;
          background: #f5f0eb;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          aspect-ratio: 3 / 1;
        }

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

        .ap-category-label {
          color: var(--brand);
          font-size: clamp(13px, 1.5vw, 18px);
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @media (max-width: 700px) {
          .ap-hero-section {
            padding: 10px;
          }

          .ap-hero-title-bar {
            padding: 6px 0 12px;
          }
        }
      `}</style>
    </div>
  );
}
