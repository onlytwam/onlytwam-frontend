// src/features/products/pages/ProductList.tsx
// Merged:
//  ✅ Global breadcrumb via useBreadcrumbStore (no direct <Breadcrumb> render)
//  ✅ Modular ProductFilters + ProductToolbar (global filter components)
//  ✅ Smart category filtering: root → subcategories, subcategory → hidden
//  ✅ Category product counts to hide zero-product subcategories
//  ✅ Full URL param sync (brand, size, cupSize, bestseller, sort, search)
//  ✅ CAT_IMAGE_MAP merged from both versions

import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProducts,
  listCategories,
  listBrands,
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
  filterVariantsByColorName,
  shouldDeferCupSizeFiltering,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";

const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const API_ASSET_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"
).replace(/\/api\/?$/, "");

function getBrandImageUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("/assets")) return path;
  if (path.startsWith("/")) return encodeURI(`${API_ASSET_ORIGIN}${path}`);
  return encodeURI(`${API_ASSET_ORIGIN}/${path.replace(/\\/g, "/")}`);
}

// ─── Category images ──────────────────────────────────────────────────────────
// NOTE: Order matters — more specific patterns must come BEFORE general ones.
// e.g. "Bridal Bras" must match /bridal/ before it can fall through to /\bbra/.
const DEFAULT_FILTERS: ProductFilterState = {
  colorFamilies: [],
  sizeIds: [],
  cupSizeIds: [],
  brandIds: [],
  categoryIds: [],
  priceMin: null,
  priceMax: null,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductList() {
  const isMobile = useIsMobile();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCrumbs } = useBreadcrumbStore();
  const queryClient = useQueryClient();

  // When admin hides/shows a category, immediately invalidate stale caches
  // so hidden-category products and nav entries disappear without a page reload.
  useEffect(() => {
    const onCategoriesUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
    };
    window.addEventListener("categoriesUpdated", onCategoriesUpdated);
    return () =>
      window.removeEventListener("categoriesUpdated", onCategoriesUpdated);
  }, [queryClient]);

  const catId = Number(categoryId) || 0;
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";
  const urlBrand = Number(searchParams.get("brandId")) || 0;
  const urlSize = Number(searchParams.get("sizeId")) || 0;
  const urlCupSize = Number(searchParams.get("cupSizeId")) || 0;
  const urlBestSeller = searchParams.get("bestseller") === "true";
  const urlSort = searchParams.get("sort") || "";

  // ── State ──────────────────────────────────────────────────────────────────
  // Lazy initialiser: URL params applied on first render so the very first
  // query already carries the correct filters (no "all-products flash").
  const [filters, setFilters] = useState<ProductFilterState>(() => ({
    ...DEFAULT_FILTERS,
    ...(urlBrand && { brandIds: [urlBrand] }),
    ...(urlSize && { sizeIds: [urlSize] }),
    ...(urlCupSize && { cupSizeIds: [urlCupSize] }),
  }));
  const [sortOption, setSortOption] = useState(urlSort || "default");
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [isBestSeller, setIsBestSeller] = useState(urlBestSeller);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [colorNameSearch, setColorNameSearch] = useState("");

  // Listen for sort button closing the filter
  useEffect(() => {
    const fn = () => setFilterOpen(false);
    window.addEventListener("close-filter", fn);
    return () => window.removeEventListener("close-filter", fn);
  }, []);
  const filterScrollY = useRef(0);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);

  // Safety-net: re-sync when URL params change while component stays mounted
  useEffect(() => {
    setSearchQuery(urlSearch || "");
    setIsBestSeller(urlBestSeller);
    setSortOption(urlSort || "default");
    if (urlBrand) {
      setFilters((current) => ({ ...current, brandIds: [urlBrand] }));
    }
  }, [urlSearch, urlBestSeller, urlSort, urlBrand]);

  // Filter drawer: scroll lock + positioning (mobile only)
  useEffect(() => {
    const btn = document.querySelector(".product-toolbar__filter-button");
    if (btn) btn.classList.toggle("active", filterOpen);

    if (!isMobile) {
      // Desktop: simple body overflow lock
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

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 0,
  });

  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => listBrands({ "Page.Size": 500 }),
    staleTime: 10 * 60 * 1000,
  });

  const buildParams = useCallback(() => {
    const p: any = { pageSize: 500 };
    const deferCupSizeFiltering = shouldDeferCupSizeFiltering(filters);

    const allCatIds = catId
      ? [catId, ...filters.categoryIds.filter((id) => id !== catId)]
      : filters.categoryIds;
    if (allCatIds.length) p.categoryIds = allCatIds.join(",");

    if (filters.brandIds.length) p.brandIds = filters.brandIds.join(",");
    if (filters.sizeIds.length) p.sizeIds = filters.sizeIds.join(",");
    if (filters.cupSizeIds.length && !deferCupSizeFiltering) {
      p.cupSizeIds = filters.cupSizeIds.join(",");
    }
    if (filters.colorFamilies.length) {
      p.colorFamilyIds = filters.colorFamilies.join(",");
    }
    if (searchQuery) p.quickSearch = searchQuery;
    if (isBestSeller) p.isBestSeller = true;

    if (sortOption === "latest") {
      p.orderProperty = "ModifiedDate";
      p.orderAscending = false;
    } else if (sortOption === "az") {
      p.orderProperty = "product.name";
      p.orderAscending = true;
    } else if (sortOption === "za") {
      p.orderProperty = "product.name";
      p.orderAscending = false;
    } else if (sortOption === "low") {
      p.orderProperty = "FinalPrice";
      p.orderAscending = true;
    } else if (sortOption === "high") {
      p.orderProperty = "FinalPrice";
      p.orderAscending = false;
    } else if (sortOption === "rating") {
      p.orderProperty = "Rating";
      p.orderAscending = false;
    } else {
      p.orderProperty = "ModifiedDate";
      p.orderAscending = false;
    }

    return p;
  }, [filters, sortOption, searchQuery, isBestSeller, catId]);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products-list", buildParams()],
    queryFn: () => listProducts(buildParams()),
    staleTime: 5 * 60 * 1000,
  });

  // ── Signal page ready for RouteTransitionOverlay ───────────────────────────
  useEffect(() => {
    if (!productsLoading) {
      window.dispatchEvent(new Event("page-content-ready"));
    }
  }, [productsLoading]);

  // ── Product grouping ───────────────────────────────────────────────────────
  const groupedProducts = useMemo(() => {
    const raw = productsData?.list ?? [];
    const grouped = new Map<number, any>();
    for (const variant of raw) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }

    let list = Array.from(grouped.values());

    // Color filter: hide products with no matching variant; keep ONLY the
    // matching-colour variants in allVariants so the card shows just those
    // swatches (requirement: don't show other non-matching variants on card).
    if (filters.colorFamilies.length > 0) {
      list = list.filter((p) =>
        matchesVariantCollectionColorFilters(p.allVariants, filters),
      );
      list = list.map((p) => {
        // Filter to only the variants that match the selected colour family
        const matchingOnly = p.allVariants.filter((v: any) =>
          matchesVariantCollectionColorFilters([v], filters),
        );
        const variants = matchingOnly.length > 0 ? matchingOnly : p.allVariants;
        return { ...variants[0], allVariants: variants };
      });
    }

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

    // Brand filter — cross-section AND: product must belong to a selected brand.
    // brandIds are also sent to the API, but we re-check here so the
    // client-side grouping step never leaks products from other brands.
    if (filters.brandIds.length > 0) {
      list = list.filter((p: any) => filters.brandIds.includes(p.brandId));
    }

    return list.filter(
      (product) =>
        matchesVariantCollectionSizeAndCupFilters(
          product.allVariants,
          filters,
        ) && matchesVariantCollectionPriceFilters(product.allVariants, filters),
    );
  }, [productsData, filters, colorNameSearch]);

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

  // ── Category data ──────────────────────────────────────────────────────────
  const categories = categoriesData?.list ?? [];
  const brands = brandsData?.list ?? [];
  const currentCategory = categories.find((c: any) => c.categoryId === catId);
  const categoryName = currentCategory?.name || "";
  const categoryImage: string | null = currentCategory?.categoryImage ?? null;
  const selectedBrandId =
    filters.brandIds.length === 1 ? filters.brandIds[0] : urlBrand || 0;
  const selectedBrand = brands.find((b: any) => b.brandId === selectedBrandId);
  const selectedBrandImage = getBrandImageUrl(
    selectedBrand?.brandImage || selectedBrand?.brandLogo,
  );
  const heroImage = categoryImage || selectedBrandImage;
  const heroAlt = categoryImage ? categoryName : selectedBrand?.brandName || "";

  const currentSubcategoryId = currentCategory?.parentCategoryId ? catId : null;

  // ── Global breadcrumb store ────────────────────────────────────────────────
  useEffect(() => {
    const crumbs = categoryName
      ? [
          { label: "Home", path: "/" },
          { label: "All Products", path: "/user-products/product-list" },
          { label: categoryName },
        ]
      : [{ label: "Home", path: "/" }, { label: "All Products" }];
    setCrumbs(crumbs);
  }, [categoryName, setCrumbs]);

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

  // ── Sort handler — syncs state + URL ──────────────────────────────────────
  const handleSortChange = (val: string) => {
    const newSort = val || "default";
    setSortOption(newSort);
    setPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (newSort === "default") newParams.delete("sort");
    else newParams.set("sort", newSort);
    setSearchParams(newParams, { replace: true });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONTS }}>
      {heroImage && (
        <div
          className="category-hero-banner"
          style={{
            width: "100%",
            aspectRatio: "3 / 1",
            overflow: "hidden",
            margin: 0,
            padding: 0,
            lineHeight: 0,
          }}
        >
          <img
            src={heroImage}
            alt={heroAlt}
            loading="lazy"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>
      )}

      {/* Toolbar: Filter button | Quick price | Sort dropdown | Product count */}
      <ProductToolbar
        productCount={groupedProducts.length}
        appliedFilterCount={appliedFilterCount}
        onFilterClick={() => setFilterOpen((o) => !o)}
        sortOption={sortOption}
        onSortChange={handleSortChange}
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

      {/* Filter Drawer (global modular component) */}
      <ProductFilters
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        productCount={groupedProducts.length}
        currentCategoryId={catId || null}
        currentSubcategoryId={currentSubcategoryId}
        colorNameSearch={colorNameSearch}
        onColorNameSearchChange={setColorNameSearch}
      />

      {/* Product grid */}
      <div
        className="container"
        style={{ padding: isMobile ? "0 14px" : "40px 20px" }}
      >
        {productsLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : "repeat(auto-fill, minmax(280px, 1fr))",
              gap: isMobile ? "8px" : "30px",
              marginBottom: isMobile ? "16px" : "40px",
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
        ) : groupedProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "100px 20px" }}>
            <i
              className="bi bi-bag-x"
              style={{ fontSize: "64px", color: "#ccc", marginBottom: "20px" }}
            />
            <p style={{ fontSize: "18px", color: "#666" }}>No products found</p>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              style={{
                marginTop: "20px",
                padding: "12px 30px",
                border: "2px solid var(--brand)",
                borderRadius: "6px",
                background: "#fff",
                color: "var(--brand)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div
              key={page}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(auto-fill, minmax(280px, 1fr))",
                gap: isMobile ? "8px" : "30px",
                marginBottom: isMobile ? "16px" : "40px",
              }}
            >
              {groupedProducts
                .slice((page - 1) * pageSize, page * pageSize)
                .map((product: any) => (
                  <div key={product.productId}>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "20px 0",
                }}
              >
                <button
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                  style={{
                    padding: "10px 16px",
                    border: "2px solid var(--ivory)",
                    borderRadius: "6px",
                    background: page === 1 ? "#f5f5f5" : "#fff",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                  }}
                  aria-label="Previous page"
                >
                  <i className="bi bi-chevron-left" />
                </button>

                {pagesArr.map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} style={{ padding: "0 10px" }}>
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      style={{
                        padding: "10px 16px",
                        border:
                          page === p
                            ? "2px solid var(--brand)"
                            : "2px solid var(--ivory)",
                        borderRadius: "6px",
                        background: page === p ? "var(--ivory)" : "#fff",
                        fontWeight: page === p ? 600 : 500,
                        cursor: "pointer",
                        minWidth: "45px",
                      }}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  disabled={page === totalPages}
                  onClick={() => goToPage(page + 1)}
                  style={{
                    padding: "10px 16px",
                    border: "2px solid var(--ivory)",
                    borderRadius: "6px",
                    background: page === totalPages ? "#f5f5f5" : "#fff",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                  }}
                  aria-label="Next page"
                >
                  <i className="bi bi-chevron-right" />
                </button>

                <span
                  style={{
                    marginLeft: "20px",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
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

      <style>{`
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

      `}</style>
    </div>
  );
}
