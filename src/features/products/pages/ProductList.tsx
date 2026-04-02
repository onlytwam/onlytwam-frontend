// src/pages/ProductList.tsx
// Enhanced version with improved filters:
//  1. ✅ Size and Cup Size filters added
//  2. ✅ Improved color filter logic with better color matching
//  3. ✅ Price range slider instead of direct input
//  4. ✅ Fixed page scroll when filter sidebar is open
//  5. ✅ Minimalistic and elegant design improvements

import "./ProductList.css";

import Breadcrumb from "@/shared/components/Breadcrumb";
import type { Crumb } from "@/shared/components/Breadcrumb";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  listProducts,
  listCategories,
  listBrands,
  getProductColors,
  listSizes,
  listCupSizes,
} from "@/features/products/api/products.api";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";

const PRI = "#6B0F2A";
const HEIRLOOM = "#9E6070";
const IVORY = "#F5F0E6";
const FONTS = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

// ─── Enhanced Color families with tighter matching ───────────────────────────
const COLOR_FAMILIES: {
  label: string;
  swatch: string;
  hexRanges?: string[];
  keywords: string[];
}[] = [
  {
    label: "Red",
    swatch: "#c62828",
    hexRanges: ["#8B0000", "#DC143C", "#FF0000", "#B22222"],
    keywords: [
      "red",
      "crimson",
      "scarlet",
      "cherry",
      "maroon",
      "burgundy",
      "wine",
      "brick",
      "ruby",
    ],
  },
  {
    label: "Pink",
    swatch: "#e91e8c",
    hexRanges: ["#FFC0CB", "#FF69B4", "#FF1493", "#DB7093"],
    keywords: [
      "pink",
      "blush",
      "rose",
      "magenta",
      "fuchsia",
      "hot pink",
      "baby pink",
    ],
  },
  {
    label: "Purple",
    swatch: "#7b1fa2",
    hexRanges: ["#800080", "#9370DB", "#8A2BE2", "#9400D3"],
    keywords: [
      "purple",
      "violet",
      "lavender",
      "mauve",
      "lilac",
      "plum",
      "indigo",
      "orchid",
    ],
  },
  {
    label: "Blue",
    swatch: "#1565c0",
    hexRanges: ["#0000FF", "#4169E1", "#1E90FF", "#00BFFF", "#5F9EA0"],
    keywords: [
      "blue",
      "navy",
      "cobalt",
      "sky",
      "azure",
      "steel",
      "powder blue",
      "denim",
      "royal",
      "sapphire",
    ],
  },
  {
    label: "Teal",
    swatch: "#008080",
    hexRanges: ["#008080", "#20B2AA", "#48D1CC", "#40E0D0"],
    keywords: ["teal", "turquoise", "cyan", "aqua", "sea green"],
  },
  {
    label: "Green",
    swatch: "#2e7d32",
    hexRanges: ["#008000", "#228B22", "#32CD32", "#90EE90"],
    keywords: [
      "green",
      "olive",
      "mint",
      "sage",
      "forest",
      "lime",
      "emerald",
      "jade",
    ],
  },
  {
    label: "Yellow",
    swatch: "#f9a825",
    hexRanges: ["#FFFF00", "#FFD700", "#F0E68C", "#BDB76B"],
    keywords: ["yellow", "gold", "mustard", "amber", "lemon", "corn", "cream"],
  },
  {
    label: "Orange",
    swatch: "#e65100",
    hexRanges: ["#FF8C00", "#FF6347", "#FF4500", "#FFA500"],
    keywords: ["orange", "tangerine", "coral"],
  },
  {
    label: "Peach",
    swatch: "#FFDAB9",
    hexRanges: ["#FFDAB9", "#FFE5B4", "#FFDEAD"],
    keywords: ["peach", "apricot"],
  },
  {
    label: "Brown",
    swatch: "#6d4c41",
    hexRanges: ["#8B4513", "#A0522D", "#D2691E", "#CD853F"],
    keywords: [
      "brown",
      "tan",
      "beige",
      "caramel",
      "chocolate",
      "mocha",
      "sand",
      "coffee",
    ],
  },
  {
    label: "Nude",
    swatch: "#D4A59A",
    hexRanges: ["#D4A59A", "#E0AC9D", "#C68E7C"],
    keywords: ["nude", "skin", "flesh"],
  },
  {
    label: "Grey",
    swatch: "#616161",
    hexRanges: ["#808080", "#A9A9A9", "#696969", "#778899"],
    keywords: ["grey", "gray", "silver", "charcoal", "slate", "ash", "smoke"],
  },
  {
    label: "White",
    swatch: "#f5f5f5",
    hexRanges: ["#FFFFFF", "#F5F5F5", "#FFFAF0", "#FAF0E6"],
    keywords: [
      "white",
      "ivory",
      "cream",
      "snow",
      "off-white",
      "pearl",
      "eggshell",
    ],
  },
  {
    label: "Black",
    swatch: "#212121",
    hexRanges: ["#000000", "#36454F", "#343434"],
    keywords: ["black", "ebony", "onyx", "jet", "charcoal"],
  },
];

// Enhanced color matching function - much stricter
function colorToFamily(rawColor: string): string | null {
  const lower = rawColor.toLowerCase().trim();

  // Exact keyword match first (stricter)
  for (const fam of COLOR_FAMILIES) {
    // Check for exact word boundaries
    for (const keyword of fam.keywords) {
      // Exact match
      if (lower === keyword) return fam.label;

      // Word boundary match (e.g., "light blue" matches "blue")
      const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, "i");
      if (wordBoundaryRegex.test(lower)) return fam.label;
    }
  }

  // No match found
  return null;
}

function groupColors(
  rawColors: { name: string; hex: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of rawColors) {
    const fam = colorToFamily(c.name);
    if (fam) {
      const existing = map.get(fam) ?? [];
      existing.push(c.name); // store name — sent to backend as the filter value
      map.set(fam, existing);
    }
  }
  return map;
}

// ─── Category images ──────────────────────────────────────────────────────────
const CAT_IMAGE_MAP: { pattern: RegExp; file: string }[] = [
  { pattern: /active/i, file: "Active Wear.jpg" },
  { pattern: /balconette/i, file: "Balconette Bras.jpg" },
  { pattern: /bandeau/i, file: "Bandeau Bras.jpg" },
  { pattern: /beginner/i, file: "Beginners Bras.jpg" },
  { pattern: /bestsell/i, file: "BestSellers.jpg" },
  { pattern: /bikini/i, file: "Bikini.jpg" },
  { pattern: /boy.?short/i, file: "Boy Shorts.jpg" },
  { pattern: /^bras?$/i, file: "bras.jpg" },
  { pattern: /bridal/i, file: "Bridal Bras.jpg" },
  { pattern: /brief/i, file: "Brief.jpg" },
  { pattern: /cotton/i, file: "Cotton Bras.jpg" },
  { pattern: /essential/i, file: "essentials.jpg" },
  { pattern: /high.waist|high.leg/i, file: "High-Waist & High-Leg.jpg" },
  { pattern: /hipster/i, file: "Hipster.jpg" },
  { pattern: /lace/i, file: "Lace.jpg" },
  { pattern: /leakproof/i, file: "leakproof.jpg" },
  { pattern: /mastectomy/i, file: "Mastectomy Bras.jpg" },
  { pattern: /minimizer/i, file: "Minimizer Bras.jpg" },
  { pattern: /nursing/i, file: "Nursing Bras.jpg" },
  { pattern: /only.?twam/i, file: "Only TWAM.jpg" },
  { pattern: /panty|panties/i, file: "panties.jpg" },
  { pattern: /push.?up/i, file: "Push up Bras.jpg" },
  { pattern: /seamless.?bra/i, file: "Seamless Bras.jpg" },
  { pattern: /seamless.?pant/i, file: "Seamless Panty.jpg" },
  { pattern: /shape/i, file: "Shapewear.jpg" },
  { pattern: /sports?.bra/i, file: "Sports bra.jpg" },
  { pattern: /strapless/i, file: "Strapless Bras.jpg" },
  { pattern: /swim/i, file: "Swim Wear.jpg" },
  { pattern: /thong|g.?string/i, file: "Thongs & V-Strings.jpg" },
  { pattern: /t.?shirt.?bra/i, file: "T-Shirt Bras.jpg" },
];

function getCategoryImage(categoryName: string): string | null {
  if (!categoryName) return null;
  const match = CAT_IMAGE_MAP.find((m) => m.pattern.test(categoryName));
  return match ? `/assets/categories/${match.file}` : null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FilterState {
  categoryIds: number[];
  brandIds: number[];
  sizeIds: number[];
  cupSizeIds: number[];
  colorFamilies: string[];
  rawColors: string[];
  priceMin: number | null;
  priceMax: number | null;
  sortOption: string;
  search: string;
  isBestSeller: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  categoryIds: [],
  brandIds: [],
  sizeIds: [],
  cupSizeIds: [],
  colorFamilies: [],
  rawColors: [],
  priceMin: null,
  priceMax: null,
  sortOption: "",
  search: "",
  isBestSeller: false,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductList() {
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [searchParams] = useSearchParams();

  const catId = Number(categoryId) || 0;
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";
  const urlBrand = Number(searchParams.get("brandId")) || 0;
  const urlSize = Number(searchParams.get("sizeId")) || 0;
  const urlCupSize = Number(searchParams.get("cupSizeId")) || 0;
  const urlBestSeller = searchParams.get("bestseller") === "true";

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickShopId, setQuickShopId] = useState<number | null>(null);

  // Price slider state
  const [brandSearch, setBrandSearch] = useState("");

  useEffect(() => {
    if (urlSearch) setFilters((f) => ({ ...f, search: urlSearch }));
    if (urlBrand) setFilters((f) => ({ ...f, brandIds: [urlBrand] }));
    if (urlSize) setFilters((f) => ({ ...f, sizeIds: [urlSize] }));
    if (urlCupSize) setFilters((f) => ({ ...f, cupSizeIds: [urlCupSize] }));
    if (urlBestSeller) setFilters((f) => ({ ...f, isBestSeller: true }));
  }, [urlSearch, urlBrand, urlSize, urlCupSize, urlBestSeller]);

  // Disable body scroll when filter is open
  useEffect(() => {
    if (filterOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "0px"; // Prevent layout shift
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [filterOpen]);

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    select: (d: any) => d?.list ?? [],
  });
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: listBrands,
    select: (d: any) => d?.list ?? [],
  });
  const { data: sizes = [] } = useQuery({
    queryKey: ["sizes"],
    queryFn: listSizes,
    select: (d: any) => d?.list ?? [],
  });
  const { data: cupSizes = [] } = useQuery({
    queryKey: ["cupSizes"],
    queryFn: listCupSizes,
    select: (d: any) => d?.list ?? [],
  });
  const { data: rawColorList = [] } = useQuery({
    queryKey: ["productColors"],
    queryFn: getProductColors,
  });

  const buildParams = useCallback(() => {
    const p: any = {
      orderProperty: "ModifiedDate",
      orderAscending: false,
    };

    // Combine URL category param with drawer-selected category IDs
    const allCatIds = catId
      ? [catId, ...filters.categoryIds.filter((id) => id !== catId)]
      : filters.categoryIds;
    if (allCatIds.length) p.categoryIds = allCatIds.join(",");

    if (filters.brandIds.length) p.brandIds = filters.brandIds.join(",");
    if (filters.sizeIds.length) p.sizeIds = filters.sizeIds.join(",");
    if (filters.cupSizeIds.length) p.cupSizeIds = filters.cupSizeIds.join(",");
    if (filters.rawColors.length) p.colors = filters.rawColors.join(",");
    if (filters.priceMin !== null) p.priceMin = filters.priceMin;
    if (filters.priceMax !== null) p.priceMax = filters.priceMax;
    if (filters.search) p.quickSearch = filters.search;
    if (filters.isBestSeller) p.isBestSeller = true;

    // Map sort option values to API fields (same as GlobalSearch)
    if (filters.sortOption === "az") {
      p.orderProperty = "product.name";
      p.orderAscending = true;
    } else if (filters.sortOption === "za") {
      p.orderProperty = "product.name";
      p.orderAscending = false;
    } else if (filters.sortOption === "low") {
      p.orderProperty = "FinalPrice";
      p.orderAscending = true;
    } else if (filters.sortOption === "high") {
      p.orderProperty = "FinalPrice";
      p.orderAscending = false;
    } else if (filters.sortOption === "rating") {
      p.orderProperty = "Rating";
      p.orderAscending = false;
    }

    return p;
  }, [catId, filters]);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", buildParams()],
    queryFn: () => listProducts(buildParams()),
  });

  const allProducts = productsData?.list || [];
  const totalCount = productsData?.totalCount || allProducts.length;

  const groupedProducts = useMemo(() => {
    const seen = new Set<number>();
    return allProducts.filter((p: any) => {
      if (seen.has(p.productId)) return false;
      seen.add(p.productId);
      return true;
    });
  }, [allProducts]);

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
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const colorFamilyMap = useMemo(
    () => groupColors(rawColorList),
    [rawColorList],
  );

  const filteredBrands = useMemo(
    () =>
      brandSearch
        ? brands.filter((b: any) =>
            (b.brandName ?? b.name ?? "")
              .toLowerCase()
              .includes(brandSearch.toLowerCase()),
          )
        : brands,
    [brands, brandSearch],
  );

  const toggleColorFamily = (label: string) => {
    const raw = colorFamilyMap.get(label) ?? [];
    setFilters((f) => {
      const alreadySelected = f.colorFamilies.includes(label);
      if (alreadySelected) {
        return {
          ...f,
          colorFamilies: f.colorFamilies.filter((c) => c !== label),
          rawColors: f.rawColors.filter((c) => !raw.includes(c)),
        };
      } else {
        return {
          ...f,
          colorFamilies: [...f.colorFamilies, label],
          rawColors: [...f.rawColors, ...raw],
        };
      }
    });
    setPage(1);
  };

  const toggleBrand = (id: number) => {
    setFilters((f) => ({
      ...f,
      brandIds: f.brandIds.includes(id)
        ? f.brandIds.filter((b) => b !== id)
        : [...f.brandIds, id],
    }));
    setPage(1);
  };

  const toggleSize = (id: number) => {
    setFilters((f) => ({
      ...f,
      sizeIds: f.sizeIds.includes(id)
        ? f.sizeIds.filter((s) => s !== id)
        : [...f.sizeIds, id],
    }));
    setPage(1);
  };

  const toggleCupSize = (id: number) => {
    setFilters((f) => ({
      ...f,
      cupSizeIds: f.cupSizeIds.includes(id)
        ? f.cupSizeIds.filter((c) => c !== id)
        : [...f.cupSizeIds, id],
    }));
    setPage(1);
  };

  const toggleCategory = (id: number) => {
    setFilters((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const activeFilterCount =
    filters.categoryIds.length +
    filters.brandIds.length +
    filters.sizeIds.length +
    filters.cupSizeIds.length +
    filters.colorFamilies.length +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0);

  const setSortOption = (opt: string) => {
    setFilters((f) => ({ ...f, sortOption: opt }));
    setPage(1);
  };

  const categoryName =
    categories.find((c: any) => c.categoryId === catId)?.name || "";
  const categoryImage = getCategoryImage(categoryName);

  // Build breadcrumb items for Crumb[] prop
  const breadcrumbItems: Crumb[] = categoryName
    ? [
        { label: "Home", path: "/" },
        { label: "Shop", path: "/user-products/product-list" },
        { label: categoryName },
      ]
    : [{ label: "Home", path: "/" }, { label: "Shop" }];

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS }}>
      <Breadcrumb items={breadcrumbItems} />

      {categoryImage && (
        <div className="category-hero-banner">
          <img src={categoryImage} alt={categoryName} loading="lazy" />
        </div>
      )}

      {/* Toolbar — filter LEFT · sort CENTER · count RIGHT (mirrors GlobalSearch) */}
      <div
        className="filter-inline-bar"
        style={{ position: "sticky", top: 0, zIndex: 100 }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* Left: Filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              border: `1.5px solid ${PRI}`,
              background: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT_UI,
              color: PRI,
              transition: "all .2s",
              flexShrink: 0,
            }}
          >
            <i className="bi bi-sliders" style={{ fontSize: 15 }} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: PRI,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Centre: Sort pills */}
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 6,
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {[
              { label: "✨ Latest", value: "" },
              { label: "A → Z", value: "az" },
              { label: "Z → A", value: "za" },
              { label: "₹ Low → High", value: "low" },
              { label: "₹ High → Low", value: "high" },
              { label: "⭐ Top Rated", value: "rating" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setSortOption(s.value)}
                className={`sort-pill${filters.sortOption === s.value ? " active" : ""}`}
                style={{ whiteSpace: "nowrap" }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Right: Product count */}
          <span
            style={{
              fontSize: 13,
              color: HEIRLOOM,
              fontFamily: FONT_UI,
              flexShrink: 0,
            }}
          >
            <strong style={{ color: PRI }}>{totalCount}</strong>{" "}
            {totalCount === 1 ? "product" : "products"}
          </span>
        </div>
      </div>

      {/* Active filters chips */}
      {activeFilterCount > 0 && (
        <div className="container" style={{ padding: "16px 0 8px" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: HEIRLOOM,
                fontWeight: 600,
                fontFamily: FONT_UI,
              }}
            >
              Active Filters:
            </span>
            {filters.colorFamilies.map((c) => (
              <button
                key={c}
                onClick={() => toggleColorFamily(c)}
                className="filter-chip"
              >
                {c}{" "}
                <i
                  className="bi bi-x"
                  style={{ marginLeft: 4, fontSize: 14 }}
                />
              </button>
            ))}
            {filters.sizeIds.map((id) => {
              const sz = sizes.find((s: any) => s.sizeId === id);
              return sz ? (
                <button
                  key={id}
                  onClick={() => toggleSize(id)}
                  className="filter-chip"
                >
                  Size: {sz.sizeLabel ?? sz.name}{" "}
                  <i
                    className="bi bi-x"
                    style={{ marginLeft: 4, fontSize: 14 }}
                  />
                </button>
              ) : null;
            })}
            {filters.cupSizeIds.map((id) => {
              const cs = cupSizes.find((c: any) => c.cupSizeId === id);
              return cs ? (
                <button
                  key={id}
                  onClick={() => toggleCupSize(id)}
                  className="filter-chip"
                >
                  Cup: {cs.sizeLabel ?? cs.size}{" "}
                  <i
                    className="bi bi-x"
                    style={{ marginLeft: 4, fontSize: 14 }}
                  />
                </button>
              ) : null;
            })}
            {filters.brandIds.map((id) => {
              const br = brands.find((b: any) => b.brandId === id);
              return br ? (
                <button
                  key={id}
                  onClick={() => toggleBrand(id)}
                  className="filter-chip"
                >
                  {br.brandName ?? br.name}{" "}
                  <i
                    className="bi bi-x"
                    style={{ marginLeft: 4, fontSize: 14 }}
                  />
                </button>
              ) : null;
            })}
            {filters.categoryIds.map((id) => {
              const cat = categories.find((c: any) => c.categoryId === id);
              return cat ? (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  className="filter-chip"
                >
                  {cat.name}{" "}
                  <i
                    className="bi bi-x"
                    style={{ marginLeft: 4, fontSize: 14 }}
                  />
                </button>
              ) : null;
            })}
            {(filters.priceMin !== null || filters.priceMax !== null) && (
              <button
                onClick={() => {
                  setFilters((f) => ({ ...f, priceMin: null, priceMax: null }));
                }}
                className="filter-chip"
              >
                Price: ₹{filters.priceMin ?? 0}–₹{filters.priceMax ?? "10k+"}{" "}
                <i
                  className="bi bi-x"
                  style={{ marginLeft: 4, fontSize: 14 }}
                />
              </button>
            )}
            <button
              onClick={clearAllFilters}
              style={{
                fontSize: 12,
                color: PRI,
                fontWeight: 600,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: FONT_UI,
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Filter Drawer */}
      {filterOpen && (
        <>
          <div
            className="filter-drawer-overlay"
            onClick={() => setFilterOpen(false)}
          />
          <div className="filter-drawer">
            {/* Header */}
            <div className="filter-drawer-header">
              <h3
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: PRI,
                  fontFamily: FONTS,
                }}
              >
                Filters
              </h3>
              <button
                onClick={() => setFilterOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 24,
                  color: PRI,
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="bi bi-x" />
              </button>
            </div>

            {/* Body */}
            <div className="filter-drawer-body">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {/* ─ 1. COLOR ─ */}
                <div>
                  <p className="filter-section-label">Color</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {COLOR_FAMILIES.filter((fam) =>
                      colorFamilyMap.has(fam.label),
                    ).map((fam) => {
                      const isActive = filters.colorFamilies.includes(
                        fam.label,
                      );
                      return (
                        <button
                          key={fam.label}
                          onClick={() => toggleColorFamily(fam.label)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 14px",
                            border: `2px solid ${isActive ? PRI : "#ddd"}`,
                            background: isActive ? `${PRI}10` : "#fff",
                            borderRadius: 24,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? PRI : "#444",
                            transition: "all .2s",
                            fontFamily: FONT_UI,
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: fam.swatch,
                              border: "2px solid #fff",
                              boxShadow: "0 0 0 1px #00000020",
                            }}
                          />
                          <span>{fam.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 2. SIZE ─ */}
                <div>
                  <p className="filter-section-label">Size</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sizes.map((sz: any) => {
                      const checked = filters.sizeIds.includes(sz.sizeId);
                      return (
                        <button
                          key={sz.sizeId}
                          onClick={() => toggleSize(sz.sizeId)}
                          className={`size-chip${checked ? " active" : ""}`}
                        >
                          {sz.sizeLabel ?? sz.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 3. CUP SIZE ─ */}
                {cupSizes.length > 0 && (
                  <div>
                    <p className="filter-section-label">Cup Size</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {cupSizes.map((cs: any) => {
                        const checked = filters.cupSizeIds.includes(
                          cs.cupSizeId,
                        );
                        return (
                          <button
                            key={cs.cupSizeId}
                            onClick={() => toggleCupSize(cs.cupSizeId)}
                            className={`size-chip${checked ? " active" : ""}`}
                          >
                            {cs.sizeLabel ?? cs.size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─ 4. BRAND ─ */}
                <div>
                  <p className="filter-section-label">Brand</p>
                  <input
                    type="text"
                    placeholder="🔍 Search brands…"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: `1.5px solid ${HEIRLOOM}55`,
                      borderRadius: 8,
                      marginBottom: 10,
                      fontSize: 13,
                      outline: "none",
                      fontFamily: FONT_UI,
                      boxSizing: "border-box",
                      background: "#fafafa",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      maxHeight: 160,
                      overflowY: "auto",
                    }}
                  >
                    {filteredBrands.map((br: any) => {
                      const checked = filters.brandIds.includes(br.brandId);
                      return (
                        <button
                          key={br.brandId}
                          onClick={() => toggleBrand(br.brandId)}
                          className={`brand-pill${checked ? " active" : ""}`}
                        >
                          {checked && (
                            <i
                              className="bi bi-check"
                              style={{ fontSize: 11 }}
                            />
                          )}
                          {br.brandName ?? br.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 5. CATEGORY ─ */}
                <div>
                  <p className="filter-section-label">Category</p>
                  <div
                    style={{
                      maxHeight: 200,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {categories.map((cat: any) => {
                      const checked = filters.categoryIds.includes(
                        cat.categoryId,
                      );
                      return (
                        <label
                          key={cat.categoryId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 10px",
                            cursor: "pointer",
                            borderRadius: 8,
                            background: checked ? `${PRI}10` : "transparent",
                            transition: "background .15s",
                          }}
                        >
                          <div
                            style={{
                              width: 17,
                              height: 17,
                              borderRadius: 4,
                              border: `2px solid ${checked ? PRI : "#ccc"}`,
                              background: checked ? PRI : "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all .15s",
                            }}
                          >
                            {checked && (
                              <i
                                className="bi bi-check"
                                style={{ color: "#fff", fontSize: 11 }}
                              />
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(cat.categoryId)}
                            style={{ display: "none" }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              color: checked ? PRI : "#444",
                              fontWeight: checked ? 600 : 400,
                            }}
                          >
                            {cat.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 6. PRICE RANGE ─ */}
                <div>
                  <p className="filter-section-label">Price Range</p>
                  {/* Quick price buttons */}
                  <div className="filter-scroll" style={{ marginBottom: 12 }}>
                    {[
                      { label: "Under ₹500", min: null, max: 500 },
                      { label: "₹500–₹1k", min: 500, max: 1000 },
                      { label: "₹1k–₹2k", min: 1000, max: 2000 },
                      { label: "₹2k–₹5k", min: 2000, max: 5000 },
                      { label: "₹5k+", min: 5000, max: null },
                    ].map((p) => {
                      const isActive =
                        filters.priceMin === p.min &&
                        filters.priceMax === p.max;
                      return (
                        <button
                          key={p.label}
                          className={`price-quick${isActive ? " active" : ""}`}
                          onClick={() => {
                            setFilters((f) => ({
                              ...f,
                              priceMin: p.min,
                              priceMax: p.max,
                            }));
                            setPage(1);
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Min / Max inputs */}
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div
                      style={{
                        flex: 1,
                        border: `1.5px solid ${HEIRLOOM}55`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        overflow: "hidden",
                        background: "#fafafa",
                      }}
                    >
                      <span
                        style={{
                          padding: "0 8px",
                          color: PRI,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.priceMin ?? ""}
                        min={0}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            priceMin:
                              e.target.value !== ""
                                ? Number(e.target.value)
                                : null,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setPage(1);
                        }}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          padding: "9px 6px",
                          fontSize: 13,
                          background: "transparent",
                          fontFamily: FONT_UI,
                        }}
                      />
                    </div>
                    <span style={{ color: HEIRLOOM, fontWeight: 600 }}>—</span>
                    <div
                      style={{
                        flex: 1,
                        border: `1.5px solid ${HEIRLOOM}55`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        overflow: "hidden",
                        background: "#fafafa",
                      }}
                    >
                      <span
                        style={{
                          padding: "0 8px",
                          color: PRI,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.priceMax ?? ""}
                        min={0}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            priceMax:
                              e.target.value !== ""
                                ? Number(e.target.value)
                                : null,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setPage(1);
                        }}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          padding: "9px 6px",
                          fontSize: 13,
                          background: "transparent",
                          fontFamily: FONT_UI,
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setPage(1)}
                      style={{
                        background: PRI,
                        color: "#fff",
                        border: "none",
                        padding: "9px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: FONT_UI,
                      }}
                    >
                      Go
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="filter-drawer-footer">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    border: `1.5px solid ${PRI}`,
                    background: "#fff",
                    color: PRI,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: FONT_UI,
                  }}
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setFilterOpen(false)}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  background: PRI,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: FONT_UI,
                }}
              >
                Show {groupedProducts.length} Products
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Product grid ── */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        {productsLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 320,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: `4px solid ${IVORY}`,
                borderTopColor: PRI,
                borderRadius: "50%",
                animation: "plSpin .8s linear infinite",
              }}
            />
            <style>{`@keyframes plSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : groupedProducts.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 280,
              gap: 12,
            }}
          >
            <i
              className="bi bi-bag-x"
              style={{ fontSize: 56, color: HEIRLOOM, opacity: 0.4 }}
            />
            <p style={{ color: HEIRLOOM, fontSize: 16, fontFamily: FONTS }}>
              No products found
            </p>
            <button
              onClick={clearAllFilters}
              style={{
                background: PRI,
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: FONT_UI,
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div key={page} className="pl-grid-wrap pl-grid">
              {groupedProducts
                .slice((page - 1) * pageSize, page * pageSize)
                .map((product: any) => (
                  <div key={product.productId} className="pl-card-anim">
                    <ProductCard
                      product={product}
                      onQuickShop={setQuickShopId}
                      showColors={true}
                    />
                  </div>
                ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  padding: "32px 0 8px",
                  flexWrap: "wrap",
                }}
              >
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
                    <span
                      key={`el-${i}`}
                      style={{
                        padding: "0 4px",
                        color: HEIRLOOM,
                        userSelect: "none",
                      }}
                    >
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
                <span
                  style={{
                    fontSize: 12,
                    color: HEIRLOOM,
                    marginLeft: 8,
                    fontFamily: FONT_UI,
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
    </div>
  );
}
