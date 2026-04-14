/**
 * GlobalSearch.tsx — Updated
 *
 * Filter drawer replaced by shared <ProductFilters /> component.
 * Toolbar layout unchanged (filter LEFT · sort-pills CENTER · count RIGHT).
 * sortOption kept as separate state (not inside ProductFilterState).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/features/products/api/products.api";
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
import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import QuickShopModal from "@/features/products/components/QuickShopModal";

const COLOR_HEX: Record<string, string> = {
  black: "#000000",
  cloud: "var(--heirloom)",
  grey: "var(--heirloom)",
  lavender: "#E6E6FA",
  maroon: "var(--brand)",
  navy: "#000080",
  nude: "#E3BC9A",
  orange: "var(--brand)",
  pink: "#FFC0CB",
  red: "var(--brand)",
  rose: "#FF007F",
  skin: "#FFCBA4",
  teal: "#008080",
  white: "#FFFFFF",
  wine: "var(--brand)",
  gray: "var(--heirloom)",
  silver: "var(--heirloom)",
  charcoal: "#36454F",
  ash: "#B2BEB5",
  ivory: "#ffffff",
  cream: "var(--ivory)",
  beige: "var(--ivory)",
  brown: "#964B00",
  tan: "#D2B48C",
  caramel: "#C68642",
  crimson: "var(--brand)",
  scarlet: "#FF2400",
  burgundy: "var(--brand)",
  hot_pink: "#FF69B4",
  blush: "#DE5D83",
  salmon: "#FA8072",
  magenta: "#FF00FF",
  coral: "var(--brand)",
  rust: "#B7410E",
  amber: "var(--blush)",
  gold: "var(--blush)",
  mustard: "var(--blush)",
  yellow: "#FFFF00",
  green: "var(--brand)",
  olive: "#808000",
  mint: "#98FF98",
  sage: "#8F9779",
  forest: "#228B22",
  emerald: "#50C878",
  turquoise: "#40E0D0",
  aqua: "#00FFFF",
  blue: "#0000FF",
  cobalt: "var(--brand)",
  sky: "#87CEEB",
  denim: "var(--brand)",
  royal: "#4169E1",
  purple: "var(--brand)",
  violet: "#8B00FF",
  lilac: "#C8A2C8",
  plum: "#DDA0DD",
  indigo: "var(--brand)",
  orchid: "#DA70D6",
};

function resolveHex(q: string): string | null {
  const key = q
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  const plain = q.toLowerCase().trim();
  if (COLOR_HEX[plain]) return COLOR_HEX[plain];
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    if (
      plain.includes(name.replace(/_/g, " ")) ||
      name.replace(/_/g, " ").includes(plain)
    ) {
      return hex;
    }
  }
  return null;
}

function isColorQuery(q: string) {
  return q.trim().length >= 3 && resolveHex(q) !== null;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[-_\s]+/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[m][n];
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = normalize(query);
  const t = normalize(target);
  if (t.includes(q) || q.includes(t)) return true;

  for (const a of q.split(/\s+/)) {
    if (a.length < 3) continue;
    for (const b of t.split(/\s+/)) {
      if (b.startsWith(a)) return true;
      if (
        b.length >= 3 &&
        levenshtein(a, b) / Math.max(a.length, b.length) <= 0.35
      ) {
        return true;
      }
    }
  }

  return false;
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

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function GlobalSearch() {
  const isMobile = useIsMobile();
  const filterScrollY = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";

  const { setCrumbs } = useBreadcrumbStore();
  useEffect(() => {
    setCrumbs([
      { label: "Home", path: "/" },
      { label: q ? `Results for "${q}"` : "Search" },
    ]);
  }, [q]);

  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // Listen for sort button closing the filter
  useEffect(() => {
    const fn = () => setFilterOpen(false);
    window.addEventListener("close-filter", fn);
    return () => window.removeEventListener("close-filter", fn);
  }, []);
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);
  const [sortOption, setSortOption] = useState("");

  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(1);
  }, [q]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);
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

  const colorQuery = q.trim().split(/\s+/).length === 1 && isColorQuery(q);
  const anchorHex = colorQuery ? resolveHex(q) : null;

  // Brands query — for chip label display in toolbar

  /* ── Build API params ──────────────────────────────────────────────────── */
  const buildParams = useCallback(() => {
    const params: Record<string, any> = {
      pageNumber: 1,
      pageSize: 500,
      orderProperty: "ModifiedDate",
      orderAscending: false,
    };
    const deferCupSizeFiltering = shouldDeferCupSizeFiltering(filters);
    if (colorQuery) params.colors = q;
    else if (q) params.quickSearch = q;

    if (filters.categoryIds.length)
      params.categoryIds = filters.categoryIds.join(",");
    if (filters.brandIds.length) params.brandIds = filters.brandIds.join(",");
    if (filters.sizeIds.length) params.sizeIds = filters.sizeIds.join(",");
    if (filters.cupSizeIds.length && !deferCupSizeFiltering)
      params.cupSizeIds = filters.cupSizeIds.join(",");
    if (filters.colors.length) params.colors = filters.colors.join(",");

    if (sortOption === "az") {
      params.orderProperty = "product.name";
      params.orderAscending = true;
    } else if (sortOption === "za") {
      params.orderProperty = "product.name";
      params.orderAscending = false;
    } else if (sortOption === "low") {
      params.orderProperty = "FinalPrice";
      params.orderAscending = true;
    } else if (sortOption === "high") {
      params.orderProperty = "FinalPrice";
      params.orderAscending = false;
    } else if (sortOption === "rating") {
      params.orderProperty = "Rating";
      params.orderAscending = false;
    }

    return params;
  }, [q, colorQuery, filters, sortOption]);

  /* ── Products query ────────────────────────────────────────────────────── */
  const { data: productData, isLoading } = useQuery({
    queryKey: ["gs", JSON.stringify(buildParams())],
    queryFn: () => listProducts(buildParams()),
    enabled: !!q && q.trim().length >= 1,
  });

  const raw: any[] = productData?.list ?? [];
  const fuzzyFiltered = colorQuery
    ? raw
    : (() => {
        const f = raw.filter(
          (p: any) =>
            fuzzyMatch(q, p.name ?? "") ||
            fuzzyMatch(q, p.description ?? "") ||
            fuzzyMatch(q, p.color ?? ""),
        );
        return f.length > 0 ? f : raw;
      })();

  const allGrouped = useMemo(() => {
    const groups = new Map<number, any[]>();
    fuzzyFiltered.forEach((p: any) => {
      if (!groups.has(p.productId)) groups.set(p.productId, []);
      groups.get(p.productId)!.push(p);
    });
    return Array.from(groups.values())
      .map((variants) => ({
        ...variants[0],
        allVariants: variants,
        allColors: variants.map((v: any) => v.color).filter(Boolean),
      }))
      .filter(
        (product) =>
          matchesVariantCollectionSizeAndCupFilters(
            product.allVariants,
            filters,
          ) &&
          matchesVariantCollectionPriceFilters(product.allVariants, filters),
      );
  }, [fuzzyFiltered, filters]);

  const totalCards = allGrouped.length;
  const totalPages = Math.ceil(totalCards / PAGE_SIZE);
  const displayed = allGrouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Active filter count (for toolbar badge) ───────────────────────────── */
  const activeQuickPrice = useMemo(() => {
    const { priceMin, priceMax } = filters;
    if (priceMin !== null || priceMax !== null)
      return { min: priceMin, max: priceMax };
    return null;
  }, [filters.priceMin, filters.priceMax]);

  const activeFilterCount = useMemo(
    () => getAppliedFilterCount(filters),
    [filters],
  );

  const handleQuickPrice = (min: number | null, max: number | null) => {
    setFilters((f) => ({ ...f, priceMin: min, priceMax: max }));
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortOption(value);
    setPage(1);
  };

  /* ── Pagination ─────────────────────────────────────────────────────────── */
  const pagesArr = (() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (
      let p = Math.max(2, page - 1);
      p <= Math.min(totalPages - 1, page + 1);
      p++
    )
      pages.push(p);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  })();

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
  };

  return (
    <div>
      {/* ══ Sticky toolbar (same layout as before — filter LEFT · sort CENTER · count RIGHT) ══ */}
      <div className="s-globalsearch-f4837a">
        <div className="container">
          {q && (
            <ProductToolbar
              productCount={totalCards}
              appliedFilterCount={activeFilterCount}
              onFilterClick={() => setFilterOpen((o) => !o)}
              sortOption={sortOption}
              onSortChange={handleSortChange}
              onQuickPrice={handleQuickPrice}
              activeQuickPrice={activeQuickPrice}
            />
          )}

          <ProductActiveFilters
            filters={filters}
            onFiltersChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ══ Shared ProductFilters drawer (replaces inline filter) ══ */}
      <ProductFilters
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        productCount={totalCards}
      />

      {/* ══ Page body ══ */}
      <div className="container s-globalsearch-58358e s-globalsearch-ff9e69e4">
        {isMobile && q && (
          <p className="gs-result-label">
            Results for <span className="gs-result-query">"{q}"</span>
          </p>
        )}
        {/* Color badge */}
        {q && colorQuery && anchorHex && (
          <div className="s-cart-1fdbde">
            <span
              className="s-globalsearch-1ccf92"
              style={{ background: anchorHex }}
            />
            <span className="s-globalsearch-d2dadc">
              Showing all {q.toLowerCase()} shades
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && q && (
          <div className="s-wishlist-444f00">
            <div className="s-globalsearch-650876" />
          </div>
        )}

        {/* Landing — no query */}
        {!q && !isLoading && (
          <div className="s-ourblog-f6d3dd">
            <i className="bi bi-search s-globalsearch-d99dd5" />
            <h3 className="s-globalsearch-e2634d s-globalsearch-ff62995b">
              Search TWAM Collection
            </h3>
            <div className="s-globalsearch-bfdb8f">
              {[
                "Bras",
                "Panties",
                "Sports Bra",
                "Leakproof",
                "Black",
                "Wine",
                "Pink",
                "Navy",
                "Nude",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setSearchParams({ q: s })}
                  className="s-globalsearch-66d96a s-globalsearch-ff9e69e4"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--brand)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--ivory)";
                    e.currentTarget.style.color = "var(--brand)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {q && !isLoading && allGrouped.length === 0 && (
          <div className="s-productdetai-490f26">
            <i className="bi bi-emoji-frown s-globalsearch-a2eb79" />
            <h3 className="s-globalsearch-e4d44f s-globalsearch-ff62995b">
              No results for "{q}"
            </h3>
            <div className="s-globalsearch-739925">
              <button
                onClick={() => setSearchParams({})}
                className="s-globalsearch-5edfcb s-globalsearch-ff9e69e4"
              >
                Clear
              </button>
              <button
                onClick={() => navigate("/user-products/product-list")}
                className="s-globalsearch-fa3f7c s-globalsearch-ff9e69e4"
              >
                Browse All
              </button>
            </div>
          </div>
        )}

        {/* Product grid */}
        {!isLoading && displayed.length > 0 && (
          <>
            <div className="gs-grid s-globalsearch-fe6df2">
              {displayed.map((product: any) => (
                <div key={`${product.productId}-${product.productVariantId}`}>
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
              <div className="s-productlist-a86882">
                <button
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                  className="gs-page-arrow"
                  aria-label="Previous page"
                >
                  <i className="bi bi-chevron-left" />
                </button>
                {pagesArr.map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="s-globalsearch-dcda95">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`gs-page-btn${page === p ? " active" : ""}`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  disabled={page === totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="gs-page-arrow"
                  aria-label="Next page"
                >
                  <i className="bi bi-chevron-right" />
                </button>
                <span className="s-globalsearch-6883e7 s-globalsearch-ff9e69e4">
                  {displayed.length} shown · Page {page}/{totalPages}
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
