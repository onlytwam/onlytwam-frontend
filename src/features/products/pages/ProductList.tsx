// src/pages/ProductList.tsx
// Fixes applied:
//  1. ✅ productsData?.list (was .products — caused zero products to ever render)
//  2. ✅ buildParams uses camelCase keys matching products.api.ts
//  3. ✅ Sort options mapped to orderProperty/orderAscending (matches GlobalSearch)
//  4. ✅ Toolbar layout: Filter LEFT · Sort CENTER · Count RIGHT (mirrors GlobalSearch)
//  5. ✅ Brand/size/cupSize field names fixed (brandName, sizeLabel)
//  6. ✅ Brand search input added (matches GlobalSearch)
//  7. ✅ Price filter replaced with quick-buttons + min/max inputs (matches GlobalSearch)
//  8. ✅ Discount tag no longer clipped — removed stale overflow:hidden from ProductList.css
//  9. ✅ ProductCard imported from component, no inline card CSS/JSX
// 10. ✅ Smart category filter: root→subcategories with products, subcategory→hidden

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
  getCategoryProductCounts,
} from "@/features/products/api/products.api";
import QuickShopModal from "@/features/products/components/QuickShopModal";
import ProductCard from "@/features/products/components/ProductCard";

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
    swatch: "var(--brand)",
    hexRanges: ["var(--brand)", "var(--brand)", "var(--brand)", "var(--brand)"],
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
    swatch: "var(--brand)",
    hexRanges: ["var(--brand)", "#9370DB", "#8A2BE2", "#9400D3"],
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
    swatch: "var(--brand)",
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
    swatch: "var(--brand)",
    hexRanges: ["var(--brand)", "#228B22", "#32CD32", "#90EE90"],
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
    swatch: "var(--brand)",
    hexRanges: ["#FFFF00", "var(--blush)", "var(--blush)", "#BDB76B"],
    keywords: ["yellow", "gold", "mustard", "amber", "lemon", "corn", "cream"],
  },
  {
    label: "Orange",
    swatch: "var(--brand)",
    hexRanges: ["var(--brand)", "var(--brand)", "var(--brand)", "var(--brand)"],
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
    swatch: "var(--brand)",
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
    swatch: "var(--heirloom)",
    hexRanges: ["var(--heirloom)", "var(--heirloom)", "var(--heirloom)", "#778899"],
    keywords: ["grey", "gray", "silver", "charcoal", "slate", "ash", "smoke"],
  },
  {
    label: "White",
    swatch: "var(--ivory)",
    hexRanges: ["#FFFFFF", "var(--ivory)", "#ffffff", "var(--ivory)"],
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
    swatch: "#000000",
    hexRanges: ["#000000", "#36454F", "#000000"],
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
  sortOption: "default",
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
  const PRICE_FLOOR = 0;
  const PRICE_CEIL = 10000;
  const [sliderMin, setSliderMin] = useState(PRICE_FLOOR);
  const [sliderMax, setSliderMax] = useState(PRICE_CEIL);

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
  // Map of categoryId → product count — used to hide subcategories with zero products
  const { data: categoryCountsRaw = [] } = useQuery({
    queryKey: ["categoryProductCounts"],
    queryFn: getCategoryProductCounts,
    staleTime: 5 * 60 * 1000,
  });
  const categoryCountMap = useMemo(() => {
    const map = new Map<number, number>();
    const arr: any[] = Array.isArray(categoryCountsRaw)
      ? categoryCountsRaw
      : [];
    arr.forEach((item: any) => {
      const id = item.categoryId ?? item.CategoryId;
      const count = item.productCount ?? item.ProductCount ?? item.count ?? 0;
      if (id != null) map.set(Number(id), Number(count));
    });
    return map;
  }, [categoryCountsRaw]);

  const buildParams = useCallback(() => {
    const p: any = {
      pageSize: 500,
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

    // Map sort option values to API fields
    if (filters.sortOption === "latest") {
      p.orderProperty = "ModifiedDate";
      p.orderAscending = false;
    } else if (filters.sortOption === "az") {
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
    } else {
      // default — no specific sort, let API decide
      p.orderProperty = "ModifiedDate";
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
    const groups = new Map<number, any[]>();
    allProducts.forEach((p: any) => {
      if (!groups.has(p.productId)) groups.set(p.productId, []);
      groups.get(p.productId)!.push(p);
    });
    return Array.from(groups.values()).map((variants) => ({
      ...variants[0],
      allVariants: variants,
    }));
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
    setSliderMin(PRICE_FLOOR);
    setSliderMax(PRICE_CEIL);
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

  const currentCategory = categories.find((c: any) => c.categoryId === catId);
  const categoryName = currentCategory?.name || "";
  const categoryImage = getCategoryImage(categoryName);

  // ── Smart category filter logic ──────────────────────────────────────────
  // • No catId (all products / global browse) → show root categories with products
  // • Main category (parentCategoryId = null) → show direct subcategories that
  //   have products (handles cases like Essentials/SwimWear where products are
  //   stored in the parent directly and subcategories have zero products)
  // • Subcategory (parentCategoryId is set) → hide category filter entirely
  const isMainCategory = Boolean(
    catId && currentCategory?.parentCategoryId === null,
  );

  const categoriesToShowInFilter = useMemo(() => {
    // Helper: returns true if category has any products (falls back to true when
    // the counts API hasn't loaded yet, so we don't flash an empty list)
    const hasProducts = (id: number) =>
      categoryCountMap.size === 0 || (categoryCountMap.get(id) ?? 0) > 0;

    if (!catId) {
      // All-products page: root categories that have products
      return categories.filter(
        (c: any) => c.parentCategoryId === null && hasProducts(c.categoryId),
      );
    }
    if (isMainCategory) {
      // On a root category: show subcategories that actually have products
      const subs = categories.filter(
        (c: any) => c.parentCategoryId === catId && hasProducts(c.categoryId),
      );
      return subs; // empty → section hidden, products stored directly in parent
    }
    // On a subcategory: hide the category filter entirely
    return [];
  }, [catId, categories, isMainCategory, categoryCountMap]);

  // Build breadcrumb items for Crumb[] prop
  const breadcrumbItems: Crumb[] = categoryName
    ? [
        { label: "Home", path: "/" },
        { label: "Shop", path: "/user-products/product-list" },
        { label: categoryName },
      ]
    : [{ label: "Home", path: "/" }, { label: "Shop" }];

  return (
    <div className="s-productlist-3ab64d s-productlist-ff586331">
      <Breadcrumb items={breadcrumbItems} />

      {categoryImage && (
        <div className="category-hero-banner">
          <img src={categoryImage} alt={categoryName} loading="lazy" />
        </div>
      )}

      {/* Toolbar — filter LEFT · sort CENTER · count RIGHT (mirrors GlobalSearch) */}
      <div
        className="filter-inline-bar s-productlist-443104"
      >
        <div
          className="container s-adminproduct-4f5591"
        >
          {/* Left: Filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className="s-productlist-c43a49 s-productlist-ff0afd28"
          >
            <i className="bi bi-sliders s-productlist-ecd182" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="s-productlist-d2ca22"
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Centre: Sort pills */}
          <div
            className="s-productlist-4e2836"
          >
            {[
              { label: "✨ Latest", value: "latest" },
              { label: "A → Z", value: "az" },
              { label: "Z → A", value: "za" },
              { label: "₹ Low → High", value: "low" },
              { label: "₹ High → Low", value: "high" },
              { label: "⭐ Top Rated", value: "rating" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setSortOption(s.value)}
                className={`sort-pill${filters.sortOption === s.value ? " active" : ""} s-productlist-b9ab83`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Right: Product count */}
          <span
            className="s-productlist-955672 s-productlist-ff0afd28"
          >
            <strong className="s-productlist-6ff513">{totalCount}</strong>{" "}
            {totalCount === 1 ? "product" : "products"}
          </span>
        </div>
      </div>

      {/* Active filters chips */}
      {activeFilterCount > 0 && (
        <div className="container s-productlist-a9e730">
          <div
            className="s-productlist-a6b0b8"
          >
            <span
              className="s-productlist-6b0a08 s-productlist-ff0afd28"
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
                  className="bi bi-x s-productlist-9b88cd"
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
                    className="bi bi-x s-productlist-9b88cd"
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
                    className="bi bi-x s-productlist-9b88cd"
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
                    className="bi bi-x s-productlist-9b88cd"
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
                    className="bi bi-x s-productlist-9b88cd"
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
                  className="bi bi-x s-productlist-9b88cd"
                />
              </button>
            )}
            <button
              onClick={clearAllFilters}
              className="s-productlist-b250e2 s-productlist-ff0afd28"
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
                className="s-productlist-464604 s-productlist-ff586331"
              >
                Filters
              </h3>
              <button
                onClick={() => setFilterOpen(false)}
                className="s-productlist-9dcc3b"
              >
                <i className="bi bi-x" />
              </button>
            </div>

            {/* Body */}
            <div className="filter-drawer-body">
              <div
                className="s-productlist-4402fd"
              >
                {/* ─ 1. COLOR ─ */}
                <div>
                  <p className="filter-section-label">Color</p>
                  <div className="s-productlist-a2d5a5">
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
                          className="s-productlist-ad8bc4" style={ {border: `2px solid ${isActive ? 'var(--brand)' : "var(--ivory)"}`, background: isActive ? `var(--brand)10` : "#fff", fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--brand)' : "var(--heirloom)", fontFamily: FONT_UI} }
                        >
                          <div
                            className="s-productlist-6441e7 s-productlist-711db7"
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
                  <div className="s-adminorders-2af484">
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
                    <div className="s-adminorders-2af484">
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
                    className="s-productlist-9dfc9c s-productlist-ff0afd28"
                  />
                  <div
                    className="s-productlist-48e5f5"
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
                              className="bi bi-check s-addresslist-2c42ad"
                            />
                          )}
                          {br.brandName ?? br.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 5. CATEGORY / SUBCATEGORY ─ (hidden on subcategory pages or when no child categories have products) */}
                {categoriesToShowInFilter.length > 0 && (
                  <div>
                    <p className="filter-section-label">
                      {isMainCategory ? "Subcategory" : "Category"}
                    </p>
                    <div
                      className="s-productlist-a8c057"
                    >
                      {categoriesToShowInFilter.map((cat: any) => {
                        const checked = filters.categoryIds.includes(
                          cat.categoryId,
                        );
                        return (
                          <label
                            key={cat.categoryId}
                            className="s-productlist-158eba" style={ {background: checked ? `var(--brand)10` : "transparent"} }
                          >
                            <div
                              className="s-productlist-4dc61c" style={ {border: `2px solid ${checked ? 'var(--brand)' : "var(--ivory)"}`, background: checked ? 'var(--brand)' : "#fff"} }
                            >
                              {checked && (
                                <i
                                  className="bi bi-check s-adminproduct-b5c012"
                                />
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(cat.categoryId)}
                              className="s-addressform-8251cb"
                            />
                            <span
                              className="s-productlist-ab59ad" style={ {color: checked ? 'var(--brand)' : "var(--heirloom)", fontWeight: checked ? 600 : 400} }
                            >
                              {cat.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─ 6. PRICE RANGE ─ */}
                <div>
                  <p className="filter-section-label">Price Range</p>
                  {/* Dual range slider bar */}
                  <div className="s-productlist-476428">
                    <div className="s-userdashboar-474527">
                      <span className="s-productlist-1da4a9 s-productlist-ff0afd28">
                        ₹{sliderMin.toLocaleString("en-IN")}
                      </span>
                      <span className="s-productlist-1da4a9 s-productlist-ff0afd28">
                        ₹{sliderMax >= PRICE_CEIL ? "10k+" : sliderMax.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="s-productlist-e51ab8">
                      {/* Track background */}
                      <div className="s-productlist-b260d9" />
                      {/* Active range highlight */}
                      <div className="s-productlist-b2f4a3" style={ {left: `${((sliderMin - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100}%`, right: `${100 - ((sliderMax - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100}%`} } />
                      {/* Min slider */}
                      <input
                        type="range"
                        min={PRICE_FLOOR}
                        max={PRICE_CEIL}
                        step={100}
                        value={sliderMin}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), sliderMax - 100);
                          setSliderMin(val);
                        }}
                        onMouseUp={() => {
                          setFilters((f) => ({ ...f, priceMin: sliderMin > PRICE_FLOOR ? sliderMin : null }));
                          setPage(1);
                        }}
                        onTouchEnd={() => {
                          setFilters((f) => ({ ...f, priceMin: sliderMin > PRICE_FLOOR ? sliderMin : null }));
                          setPage(1);
                        }}
                        className="price-slider s-productlist-7203f1 s-productlist-d12ad6"
                      />
                      {/* Max slider */}
                      <input
                        type="range"
                        min={PRICE_FLOOR}
                        max={PRICE_CEIL}
                        step={100}
                        value={sliderMax}
                        onChange={(e) => {
                          const val = Math.max(Number(e.target.value), sliderMin + 100);
                          setSliderMax(val);
                        }}
                        onMouseUp={() => {
                          setFilters((f) => ({ ...f, priceMax: sliderMax < PRICE_CEIL ? sliderMax : null }));
                          setPage(1);
                        }}
                        onTouchEnd={() => {
                          setFilters((f) => ({ ...f, priceMax: sliderMax < PRICE_CEIL ? sliderMax : null }));
                          setPage(1);
                        }}
                        className="price-slider s-productlist-4dec44 s-productlist-d12ad6"
                      />
                      </div>
                  </div>
                  {/* Quick price buttons */}
                  <div className="filter-scroll s-adminproduct-02d219">
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
                            setSliderMin(p.min ?? PRICE_FLOOR);
                            setSliderMax(p.max ?? PRICE_CEIL);
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
                    className="s-adminproduct-04b6ac"
                  >
                    <div
                      className="s-productlist-eb6593"
                    >
                      <span
                        className="s-productlist-01f74c"
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.priceMin ?? ""}
                        min={0}
                        onChange={(e) => {
                          const val = e.target.value !== "" ? Number(e.target.value) : null;
                          setFilters((f) => ({ ...f, priceMin: val }));
                          if (val !== null) setSliderMin(val);
                          else setSliderMin(PRICE_FLOOR);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setPage(1);
                        }}
                        className="s-productlist-4706fe s-productlist-ff0afd28"
                      />
                    </div>
                    <span className="s-productlist-fdec40">—</span>
                    <div
                      className="s-productlist-eb6593"
                    >
                      <span
                        className="s-productlist-01f74c"
                      >
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.priceMax ?? ""}
                        min={0}
                        onChange={(e) => {
                          const val = e.target.value !== "" ? Number(e.target.value) : null;
                          setFilters((f) => ({ ...f, priceMax: val }));
                          if (val !== null) setSliderMax(val);
                          else setSliderMax(PRICE_CEIL);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setPage(1);
                        }}
                        className="s-productlist-4706fe s-productlist-ff0afd28"
                      />
                    </div>
                    <button
                      onClick={() => setPage(1)}
                      className="s-productlist-dc5d39 s-productlist-ff0afd28"
                    >
                      Go
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="filter-drawer-footer">
              <button
                onClick={clearAllFilters}
                className="s-productlist-0d455c s-productlist-ff0afd28"
              >
                Clear All
              </button>
              <button
                onClick={() => setFilterOpen(false)}
                className="s-productlist-e7f1bf s-productlist-ff0afd28"
              >
                Show {groupedProducts.length} Products
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Product grid ── */}
      <div className="container s-productlist-22e220">
        {productsLoading ? (
          <div
            className="s-productlist-18a79d"
          >
            <div
              className="s-productlist-feb323"
            />
            </div>
        ) : groupedProducts.length === 0 ? (
          <div
            className="s-productlist-3fa2c3"
          >
            <i
              className="bi bi-bag-x s-productlist-28e718"
            />
            <p className="s-productlist-3964c5 s-productlist-ff586331">
              No products found
            </p>
            <button
              onClick={clearAllFilters}
              className="s-productlist-972b82 s-productlist-ff0afd28"
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
                className="s-productlist-a86882"
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
                      className="s-productlist-2ab2e0"
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
                  className="s-productlist-f6dfaf s-productlist-ff0afd28"
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
