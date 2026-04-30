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
import { useQuery } from "@tanstack/react-query";
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
  shouldDeferCupSizeFiltering,
  type ProductFilterState,
} from "@/features/products/components/ProductFilters";
import ProductToolbar from "@/features/products/components/ProductToolbar";

const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

// ─── Category images ──────────────────────────────────────────────────────────
// NOTE: Order matters — more specific patterns must come BEFORE general ones.
// e.g. "Bridal Bras" must match /bridal/ before it can fall through to /\bbra/.
const CAT_IMAGE_MAP: { pattern: RegExp; file: string }[] = [
  // ── 6 New hero banner images (broad match so any variant of the name works) ─
  { pattern: /swim\s*wear/i, file: "Swimwear.png" },
  { pattern: /activewear|active\s*wear/i, file: "Activewear.png" },
  { pattern: /leak.?proof|leakproof/i, file: "Leakproof.png" },
  { pattern: /essentials?/i, file: "Essentials.png" },
  { pattern: /panties|panty/i, file: "Panties.png" },
  // ── All bra sub-types BEFORE the general bra catch-all ──────────────────────
  { pattern: /balconette/i, file: "Balconette Bras.jpg" },
  { pattern: /bandeau/i, file: "Bandeau Bras.jpg" },
  { pattern: /beginner/i, file: "Beginners Bras.jpg" },
  { pattern: /bridal/i, file: "Bridal Bras.jpg" },
  { pattern: /cotton/i, file: "Cotton Bras.jpg" },
  { pattern: /everyday/i, file: "Everyday Bras.jpg" },
  { pattern: /full.?cover/i, file: "Full Coverage Bras.jpg" },
  { pattern: /lace/i, file: "Lace.jpg" },
  { pattern: /mastectomy/i, file: "Mastectomy Bras.jpg" },
  { pattern: /minimiz/i, file: "Minimizer Bras.jpg" },
  { pattern: /nurs/i, file: "Nursing Bras.jpg" },
  { pattern: /push.?up/i, file: "Push Up Bras.jpg" },
  { pattern: /seamless.?bra/i, file: "Seamless Bras.jpg" },
  { pattern: /sport.*bra|bra.*sport/i, file: "Sports Bras.jpg" },
  { pattern: /strapless/i, file: "Strapless Bras.jpg" },
  { pattern: /t.?shirt.?bra/i, file: "T-Shirt Bras.jpg" },
  { pattern: /teen/i, file: "Teen Bras.jpg" },
  { pattern: /wire.?free|wireless/i, file: "Wireless Bras.jpg" },
  // ── General bra catch-all (matches "Bra", "Bras", "Women's Bras", "All Bras")
  { pattern: /\bbras?\b/i, file: "Bra.png" },
  // ── Everything else ──────────────────────────────────────────────────────────
  { pattern: /bestsell/i, file: "BestSellers.jpg" },
  { pattern: /bikini/i, file: "Bikini.jpg" },
  { pattern: /boy.?short/i, file: "Boy Shorts.jpg" },
  { pattern: /brief/i, file: "Brief.png" },
  { pattern: /cami/i, file: "Camisoles.jpg" },
  { pattern: /high.waist|high.leg/i, file: "High-Waist & High-Leg.jpg" },
  { pattern: /hipster/i, file: "Hipster.jpg" },
  { pattern: /lace/i, file: "Lace.jpg" },
  { pattern: /leak.?proof|leakproof/i, file: "leakproof.jpg" },
  { pattern: /lingerie.?set/i, file: "Lingerie Sets.jpg" },
  { pattern: /new.?arrival/i, file: "New Arrivals.jpg" },
  { pattern: /only.?twam/i, file: "Only TWAM.jpg" },
  { pattern: /plus/i, file: "Plus Size.jpg" },
  {
    pattern: /non.?padded|non.?wired/i,
    file: "Non-Padded and Non-Wired Bra.png",
  },
  { pattern: /push.?up/i, file: "Push up Bras.jpg" },
  { pattern: /seamless.?bra/i, file: "Seamless Bras.jpg" },
  { pattern: /seamless.?pant/i, file: "Seamless Panty.jpg" },
  { pattern: /shape/i, file: "Shapewear.jpg" },
  { pattern: /sleep/i, file: "Sleepwear.jpg" },
  { pattern: /sport/i, file: "Sports bra.jpg" },
  { pattern: /strapless/i, file: "Strapless Bras.jpg" },
  { pattern: /swim/i, file: "Swim Wear.jpg" },
  { pattern: /t.?shirt.?bra/i, file: "T-Shirt Bras.jpg" },
  { pattern: /teen/i, file: "Teen Bras.jpg" },
  { pattern: /thong|g.?string/i, file: "Thongs & V-Strings.jpg" },
];

function getCategoryImage(name: string): string | null {
  if (!name) return null;
  const match = CAT_IMAGE_MAP.find((m) => m.pattern.test(name));
  return match ? `/assets/categories/${match.file}` : null;
}

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
export default function ProductList() {
  const isMobile = useIsMobile();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCrumbs } = useBreadcrumbStore();

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
  }, [urlSearch, urlBestSeller, urlSort]);

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
    if (filters.colors.length) p.colors = filters.colors.join(",");
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
    staleTime: 30 * 1000,
  });

  // ── Product grouping ───────────────────────────────────────────────────────
  const groupedProducts = useMemo(() => {
    const raw = productsData?.list ?? [];
    const grouped = new Map<number, any>();
    for (const variant of raw) {
      const pid = variant.productId;
      if (!grouped.has(pid)) grouped.set(pid, { ...variant, allVariants: [] });
      grouped.get(pid).allVariants.push(variant);
    }
    return Array.from(grouped.values()).filter(
      (product) =>
        matchesVariantCollectionSizeAndCupFilters(
          product.allVariants,
          filters,
        ) && matchesVariantCollectionPriceFilters(product.allVariants, filters),
    );
  }, [productsData, filters]);

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
  const currentCategory = categories.find((c: any) => c.categoryId === catId);
  const categoryName = currentCategory?.name || "";
  const categoryImage = getCategoryImage(categoryName);

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
      {categoryImage && (
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
            src={categoryImage}
            alt={categoryName}
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
      />

      {/* Product grid */}
      <div
        className="container"
        style={{ padding: isMobile ? "0 14px" : "40px 20px" }}
      >
        {productsLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "100px 20px",
            }}
          >
            <div
              style={{
                width: "50px",
                height: "50px",
                border: "4px solid var(--ivory)",
                borderTop: "4px solid var(--brand)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
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
