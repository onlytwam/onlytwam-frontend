// src/features/products/pages/NewArrivals.tsx
// Merged:
//  ✅ Global breadcrumb via useBreadcrumbStore (no direct <Breadcrumb> render)
//  ✅ Modular ProductFilters + ProductToolbar (global filter components)
//  ✅ Client-side filter + sort logic preserved from v2 (inline version)
//  ✅ type-only import for ProductFilterState

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listNewArrivals } from "@/features/products/api/products.api";
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewArrivals() {
  const isMobile = useIsMobile();
  const filterScrollY = useRef(0);
  const { setCrumbs } = useBreadcrumbStore();

  const [sortOption, setSortOption] = useState("latest");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // Listen for sort button closing the filter
  useEffect(() => {
    const fn = () => setFilterOpen(false);
    window.addEventListener("close-filter", fn);
    return () => window.removeEventListener("close-filter", fn);
  }, []);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);

  // ── Global breadcrumb store ────────────────────────────────────────────────
  useEffect(() => {
    setCrumbs([{ label: "Home", path: "/" }, { label: "New Arrivals" }]);
  }, [setCrumbs]);

  // Disable body scroll when filter drawer is open
  // Filter drawer: scroll lock + positioning (mobile only)
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

  // ── Fetch new arrivals ─────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["new-arrivals-page"],
    queryFn: () => listNewArrivals({ pageSize: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  // ── Client-side filtering ──────────────────────────────────────────────────
  const allProducts = useMemo(() => {
    const raw = rawData?.list ?? [];
    let filtered = [...raw];

    if (filters.colors.length > 0) {
      filtered = filtered.filter((p: any) => {
        const color = (p.color || "").toLowerCase();
        return filters.colors.some((fc) => color.includes(fc.toLowerCase()));
      });
    }
    if (filters.sizeIds.length > 0 || filters.cupSizeIds.length > 0) {
      filtered = filtered.filter((p: any) =>
        matchesVariantSizeAndCupFilters(p, filters),
      );
    }
    if (filters.brandIds.length > 0) {
      filtered = filtered.filter((p: any) =>
        filters.brandIds.includes(p.brandId),
      );
    }
    if (filters.categoryIds.length > 0) {
      filtered = filtered.filter((p: any) =>
        filters.categoryIds.includes(p.categoryId),
      );
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
      filtered = filtered.filter((p: any) =>
        matchesVariantPriceFilters(p, filters),
      );
    }

    return filtered;
  }, [rawData, filters]);

  // ── Client-side sorting ────────────────────────────────────────────────────
  const sortedProducts = useMemo(() => {
    const arr = [...allProducts];
    if (sortOption === "rating")
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sortOption === "az")
      return arr.sort((a, b) =>
        (a.productName ?? a.name ?? "").localeCompare(
          b.productName ?? b.name ?? "",
        ),
      );
    if (sortOption === "low")
      return arr.sort(
        (a, b) =>
          (a.finalPrice ?? a.price ?? 0) - (b.finalPrice ?? b.price ?? 0),
      );
    if (sortOption === "high")
      return arr.sort(
        (a, b) =>
          (b.finalPrice ?? b.price ?? 0) - (a.finalPrice ?? a.price ?? 0),
      );
    // default / "latest" — sort by modifiedDate DESC
    return arr.sort(
      (a, b) =>
        new Date(b.modifiedDate || 0).getTime() -
        new Date(a.modifiedDate || 0).getTime(),
    );
  }, [allProducts, sortOption]);

  // ── Product grouping by productId ──────────────────────────────────────────
  const groupedProducts = useMemo(() => {
    const grouped = new Map<number, any>();
    for (const variant of sortedProducts) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }
    return Array.from(grouped.values());
  }, [sortedProducts]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(groupedProducts.length / pageSize));

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

  // ── Quick price handler (passed to ProductToolbar) ─────────────────────────
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
      {/* Hero banner */}
      <img
        src="/assets/categories/New Arrivals.jpg"
        alt="New Arrivals"
        loading="lazy"
        style={{ width: "100%", height: "auto", display: "block" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Toolbar */}
      <ProductToolbar
        productCount={groupedProducts.length}
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

      {/* Filter Drawer */}
      <ProductFilters
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        productCount={groupedProducts.length}
      />

      {/* Product grid */}
      <div className="container s-productlist-22e220">
        {isLoading ? (
          <div className="s-productlist-18a79d">
            <div className="s-productlist-feb323" />
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="s-productlist-3fa2c3">
            <i className="bi bi-bag-x s-productlist-28e718" />
            <p className="s-productlist-3964c5 s-productlist-ff586331">
              {(rawData?.list ?? []).length === 0
                ? "No new arrivals in the last 6 months"
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
              {groupedProducts
                .slice((page - 1) * pageSize, page * pageSize)
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
                    groupedProducts.slice(
                      (page - 1) * pageSize,
                      page * pageSize,
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
    </div>
  );
}
