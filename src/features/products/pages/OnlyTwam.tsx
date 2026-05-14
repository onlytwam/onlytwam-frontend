// src/features/products/pages/OnlyTwam.tsx
// Shows all products belonging to the TWAM brand.
// Uses the same global ProductCard, ProductFilters, ProductToolbar pattern
// as BestSellers / NewArrivals — colour grouping, discounts and shipping bar included.

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, listBrands } from "@/features/products/api/products.api";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";
import MobileProductCard from "@/features/products/components/MobileProductCard";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import ProductFilters, {
  ProductActiveFilters,
  getAppliedFilterCount,
  matchesVariantCollectionSizeAndCupFilters,
  matchesVariantCollectionPriceFilters,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";
import { usePageImage, IMAGE_KEYS } from "@/features/images";

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

const PAGE_SIZE = 20;

export default function OnlyTwam() {
  const isMobile = useIsMobile();
  const filterScrollY = useRef(0);
  const twamHeroImage = usePageImage(IMAGE_KEYS.HOME_SECTION_TWAM);
  const { setCrumbs } = useBreadcrumbStore();

  const [sortOption, setSortOption] = useState("latest");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    setCrumbs([{ label: "Home", path: "/" }, { label: "TWAM" }]);
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

  // ── Resolve TWAM brand ID ──────────────────────────────────────────────────
  const { data: brandsData } = useQuery({
    queryKey: ["brands-all"],
    queryFn: () => listBrands({ "Page.Size": 500 }),
    staleTime: 10 * 60 * 1000,
  });

  const twamBrandId = useMemo(() => {
    const list: any[] = brandsData?.list ?? [];
    const found = list.find(
      (b) =>
        b.brandName?.toLowerCase().includes("twam") ||
        b.name?.toLowerCase().includes("twam"),
    );
    return found?.brandId ?? found?.id ?? null;
  }, [brandsData]);

  // ── Fetch TWAM products ────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["twam-products-page", twamBrandId],
    enabled: twamBrandId != null,
    queryFn: () =>
      listProducts({
        brandIds: twamBrandId,
        pageSize: 500,
        orderProperty: "ModifiedDate",
        orderAscending: false,
      }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading) window.dispatchEvent(new Event("page-content-ready"));
  }, [isLoading]);

  // ── Group by productId, then apply collection-level filters ───────────────
  const groupedProducts = useMemo(() => {
    const raw = rawData?.list ?? [];

    const grouped = new Map<number, any>();
    for (const variant of raw) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }

    let list = Array.from(grouped.values());

    if (filters.colors.length > 0) {
      list = list.filter((p) =>
        p.allVariants.some((v: any) =>
          filters.colors.some((fc: string) =>
            (v.color || "").toLowerCase().includes(fc.toLowerCase()),
          ),
        ),
      );
    }

    if (filters.brandIds.length > 0)
      list = list.filter((p) => filters.brandIds.includes(p.brandId));
    if (filters.categoryIds.length > 0)
      list = list.filter((p) => filters.categoryIds.includes(p.categoryId));

    list = list.filter(
      (p) =>
        matchesVariantCollectionSizeAndCupFilters(p.allVariants, filters) &&
        matchesVariantCollectionPriceFilters(p.allVariants, filters),
    );

    return list;
  }, [rawData, filters]);

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
    filters.colors.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="s-productlist-3ab64d s-productlist-ff586331">
      {/* Hero banner — uses the same home_section_twam image as the home page section */}
      {twamHeroImage && (
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
            src={twamHeroImage}
            alt="TWAM"
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
      />

      {/* Product Grid */}
      <div className="container s-productlist-22e220">
        {isLoading || twamBrandId == null ? (
          <div className="s-productlist-18a79d"></div>
        ) : sortedProducts.length === 0 ? (
          <div className="s-productlist-3fa2c3">
            <i className="bi bi-bag-x s-productlist-28e718" />
            <p className="s-productlist-3964c5 s-productlist-ff586331">
              {(rawData?.list ?? []).length === 0
                ? "No TWAM products found — check back soon!"
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
