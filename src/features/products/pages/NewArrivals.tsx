// src/features/products/pages/NewArrivals.tsx

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
  matchesVariantCollectionSizeAndCupFilters,
  matchesVariantCollectionPriceFilters,
  matchesVariantCollectionColorFilters,
  filterVariantsByColorName,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";
import { usePageImage, IMAGE_KEYS } from "@/features/images";

const DEFAULT_FILTERS: ProductFilterState = {
  colorFamilies: [],
  sizeIds: [],
  cupSizeIds: [],
  brandIds: [],
  categoryIds: [],
  priceMin: null,
  priceMax: null,
};

const PAGE_SIZE = 20;

export default function NewArrivals() {
  const isMobile = useIsMobile();
  const filterScrollY = useRef(0);
  const { setCrumbs } = useBreadcrumbStore();

  const [sortOption, setSortOption] = useState("latest");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [colorNameSearch, setColorNameSearch] = useState("");
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    setCrumbs([{ label: "Home", path: "/" }, { label: "New Arrivals" }]);
  }, [setCrumbs]);

  useEffect(() => {
    const fn = () => setFilterOpen(false);
    window.addEventListener("close-filter", fn);
    return () => window.removeEventListener("close-filter", fn);
  }, []);

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

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["new-arrivals-page"],
    queryFn: () => listNewArrivals({ pageSize: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  // ── Hero banner image — same as the home page New Arrivals section ──────────
  // Returns "" when no image has been uploaded, so the hero is hidden entirely.
  const heroBannerImage = usePageImage(IMAGE_KEYS.HOME_SECTION_NEWARRIVALS);

  useEffect(() => {
    if (!isLoading) window.dispatchEvent(new Event("page-content-ready"));
  }, [isLoading]);

  // ── Group by productId first, then filter across all variants ──────────────
  const groupedProducts = useMemo(() => {
    const raw = rawData?.list ?? [];

    const grouped = new Map<number, any>();
    for (const variant of raw) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }

    let list = Array.from(grouped.values());

    // ── Step 1: Colour (within-section OR; trims allVariants to matching only)
    if (filters.colorFamilies.length > 0) {
      list = list.filter((p) =>
        matchesVariantCollectionColorFilters(p.allVariants, filters),
      );
      list = list.map((p) => {
        const matchingOnly = p.allVariants.filter((v: any) =>
          matchesVariantCollectionColorFilters([v], filters),
        );
        const variants = matchingOnly.length > 0 ? matchingOnly : p.allVariants;
        return { ...variants[0], allVariants: variants };
      });
    }

    // ── Step 2: Brand / Category (AND)
    if (filters.brandIds.length > 0)
      list = list.filter((p) => filters.brandIds.includes(p.brandId));
    if (filters.categoryIds.length > 0)
      list = list.filter((p) => filters.categoryIds.includes(p.categoryId));

    // ── Step 3: Size / Price (AND)
    list = list.filter(
      (p) =>
        matchesVariantCollectionSizeAndCupFilters(p.allVariants, filters) &&
        matchesVariantCollectionPriceFilters(p.allVariants, filters),
    );

    // Color-name fuzzy search: trim allVariants further + filter products
    if (colorNameSearch.trim()) {
      list = list
        .map((p) => {
          const matched = filterVariantsByColorName(
            p.allVariants,
            colorNameSearch,
          );
          if (matched.length === 0) return null;
          return { ...matched[0], allVariants: matched };
        })
        .filter(Boolean) as any[];
    }

    return list;
  }, [rawData, filters, colorNameSearch]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sortedProducts = useMemo(() => {
    const arr = [...groupedProducts];
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
    // default: "latest" — sort by modifiedDate DESC
    return arr.sort(
      (a, b) =>
        new Date(b.modifiedDate || 0).getTime() -
        new Date(a.modifiedDate || 0).getTime(),
    );
  }, [groupedProducts, sortOption]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));

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
    return priceMin !== null || priceMax !== null
      ? { min: priceMin, max: priceMax }
      : null;
  }, [filters.priceMin, filters.priceMax]);

  const appliedFilterCount = useMemo(
    () => getAppliedFilterCount(filters),
    [filters],
  );

  const hasActiveFilters =
    filters.brandIds.length > 0 ||
    filters.sizeIds.length > 0 ||
    filters.cupSizeIds.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="s-productlist-3ab64d s-productlist-ff586331">
      {/* Hero banner — uses the same home_section_newarrivals image as the home page section.
           When no image has been uploaded, heroBannerImage is "" so the banner is hidden entirely. */}
      {heroBannerImage && (
        <div
          className="category-hero-banner"
          style={{
            width: "100%",
            aspectRatio: "21 / 7",
            overflow: "hidden",
            lineHeight: 0,
            margin: 0,
            padding: 0,
            display: "block",
          }}
        >
          <img
            src={heroBannerImage}
            alt="New Arrivals"
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Toolbar */}
      <ProductToolbar
        productCount={sortedProducts.length}
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
        productCount={sortedProducts.length}
        colorNameSearch={colorNameSearch}
        onColorNameSearchChange={setColorNameSearch}
      />

      {/* Product grid */}
      <div className="container s-productlist-22e220">
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : "repeat(auto-fill, minmax(240px, 1fr))",
              gap: isMobile ? "8px" : "24px",
              paddingTop: 16,
            }}
          >
            {Array.from({ length: isMobile ? 6 : 10 }).map((_, i) => (
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
        ) : sortedProducts.length === 0 ? (
          <div className="s-productlist-3fa2c3">
            <i className="bi bi-bag-x s-productlist-28e718" />
            <p className="s-productlist-3964c5 s-productlist-ff586331">
              {(rawData?.list ?? []).length === 0
                ? "No new arrivals in the last 6 months"
                : "No products match your filters"}
            </p>
            {hasActiveFilters && (
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
              {sortedProducts
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
                    sortedProducts.slice(
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
    </div>
  );
}
