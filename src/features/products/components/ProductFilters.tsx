/**
 * ProductFilters.tsx — Updated
 *
 * Color filter now matches GlobalSearch sidebar:
 *   - Circular swatches (28px) with checkmark overlay when selected
 *   - Label beneath each swatch
 *   - Uses gs-color-swatch CSS class from twam.css
 *
 * Price slider fixes:
 *   - pointer-events set correctly so thumbs are draggable
 *   - Min / Max ₹ value labels shown beneath the slider dots
 *   - Double-click the "Price" title to reset price filter
 *
 * Size / Brand pills use gs-size-pill / gs-brand-pill classes (GlobalSearch style)
 */

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listCategories,
  listBrands,
  getProductColors,
  listSizes,
  listCupSizes,
} from "@/features/products/api/products.api";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProductFilterState {
  colorFamilies: number[];
  sizeIds: number[];
  cupSizeIds: number[];
  brandIds: number[];
  categoryIds: number[];
  priceMin: number | null;
  priceMax: number | null;
}

interface ProductFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ProductFilterState;
  onFiltersChange: (filters: ProductFilterState) => void;
  productCount: number;
  currentCategoryId?: number | null;
  currentSubcategoryId?: number | null;
  colorNameSearch?: string;
  onColorNameSearchChange?: (value: string) => void;
}

interface ProductActiveFiltersProps {
  filters: ProductFilterState;
  onFiltersChange: (filters: ProductFilterState) => void;
}

// ─── Color Families (same as GlobalSearch) ────────────────────────────────────
interface NormalizedFilterOption {
  id: number;
  label: string;
}

function normalizeOptionList(
  rawList: any[],
  idKeys: string[],
  labelKeys: string[],
): NormalizedFilterOption[] {
  const optionMap = new Map<number, string>();

  for (const item of rawList || []) {
    let id: number | null = null;
    for (const key of idKeys) {
      const value = item?.[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        id = value;
        break;
      }
      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        !Number.isNaN(Number(value))
      ) {
        id = Number(value);
        break;
      }
    }

    if (id === null) continue;

    let label = "";
    for (const key of labelKeys) {
      const value = item?.[key];
      if (typeof value === "string" && value.trim() !== "") {
        label = value.trim();
        break;
      }
    }

    optionMap.set(id, label || optionMap.get(id) || String(id));
  }

  return Array.from(optionMap, ([id, label]) => ({ id, label }));
}

function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return false;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

const SIZE_ID_KEYS = ["sizeId", "SizeId", "sizeID"];
const CUP_SIZE_ID_KEYS = ["cupSizeId", "CupSizeId", "cupsizeId"];
const CUP_SIZE_LABEL_KEYS = [
  "cupSizeLabel",
  "CupSizeLabel",
  "cupSize",
  "cupSizeName",
  "cup",
];
function readPositiveId(source: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value)) &&
      Number(value) > 0
    ) {
      return Number(value);
    }
  }
  return null;
}

function readFiniteNumber(source: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }
  return null;
}

function readBooleanFlag(source: any, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim() !== "") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
  }
  return null;
}

// hasCupSizeOption: returns true if this variant/product has cup-size data.
// Solely based on the isCupSize flag and data presence — no product-name overrides.
function hasCupSizeOption(source: any): boolean {
  const explicitFlag = readBooleanFlag(source, ["isCupSize", "IsCupSize"]);

  if (explicitFlag !== null) {
    return explicitFlag;
  }

  if (readPositiveId(source, CUP_SIZE_ID_KEYS) !== null) return true;

  if (Array.isArray(source?.cupSizes) && source.cupSizes.length > 0)
    return true;

  return CUP_SIZE_LABEL_KEYS.some((key) => {
    const value = source?.[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

export function shouldDeferCupSizeFiltering(
  filters: Pick<ProductFilterState, "sizeIds" | "cupSizeIds">,
): boolean {
  return filters.sizeIds.length > 0 && filters.cupSizeIds.length > 0;
}

export function matchesVariantSizeAndCupFilters(
  variant: any,
  filters: Pick<ProductFilterState, "sizeIds" | "cupSizeIds">,
): boolean {
  const hasSizeFilter = filters.sizeIds.length > 0;
  const hasCupSizeFilter = filters.cupSizeIds.length > 0;
  const sizeId = readPositiveId(variant, SIZE_ID_KEYS);
  const cupSizeId = readPositiveId(variant, CUP_SIZE_ID_KEYS);

  if (hasSizeFilter && (sizeId === null || !filters.sizeIds.includes(sizeId))) {
    return false;
  }

  if (!hasCupSizeFilter) return true;

  if (!hasSizeFilter) {
    return cupSizeId !== null && filters.cupSizeIds.includes(cupSizeId);
  }

  if (!hasCupSizeOption(variant)) return true;

  return cupSizeId !== null && filters.cupSizeIds.includes(cupSizeId);
}

export function matchesVariantCollectionSizeAndCupFilters(
  variants: any[],
  filters: Pick<ProductFilterState, "sizeIds" | "cupSizeIds">,
): boolean {
  const list = Array.isArray(variants) ? variants : [];
  const hasSizeFilter = filters.sizeIds.length > 0;
  const hasCupSizeFilter = filters.cupSizeIds.length > 0;

  if (!hasSizeFilter && !hasCupSizeFilter) return true;
  if (list.length === 0) return false;

  if (!hasSizeFilter || !hasCupSizeFilter) {
    return list.some((variant) =>
      matchesVariantSizeAndCupFilters(variant, filters),
    );
  }

  const sizeMatchedVariants = list.filter((variant) => {
    const sizeId = readPositiveId(variant, SIZE_ID_KEYS);
    return sizeId !== null && filters.sizeIds.includes(sizeId);
  });

  if (sizeMatchedVariants.length === 0) return false;

  const cupAwareSizeVariants = sizeMatchedVariants.filter(hasCupSizeOption);
  if (cupAwareSizeVariants.length === 0) return true;

  return cupAwareSizeVariants.some((variant) => {
    const cupSizeId = readPositiveId(variant, CUP_SIZE_ID_KEYS);
    return cupSizeId !== null && filters.cupSizeIds.includes(cupSizeId);
  });
}

export function getVariantEffectivePrice(variant: any): number {
  return (
    readFiniteNumber(variant, [
      "finalPrice",
      "price",
      "FinalPrice",
      "Price",
      "salePrice",
      "SalePrice",
    ]) ?? 0
  );
}

export function matchesVariantPriceFilters(
  variant: any,
  filters: Pick<ProductFilterState, "priceMin" | "priceMax">,
): boolean {
  const price = getVariantEffectivePrice(variant);

  if (filters.priceMin !== null && price < filters.priceMin) return false;
  if (filters.priceMax !== null && price > filters.priceMax) return false;

  return true;
}

export function matchesVariantCollectionPriceFilters(
  variants: any[],
  filters: Pick<ProductFilterState, "priceMin" | "priceMax">,
): boolean {
  if (filters.priceMin === null && filters.priceMax === null) return true;

  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) return false;

  return list.some((variant) => matchesVariantPriceFilters(variant, filters));
}

// ── Color family matching ──────────────────────────────────────────────────────

/**
 * Given a raw color value (name or hex), return which COLOR_FAMILY label it
 * belongs to (e.g. "navy blue" → "Blue"). Returns null if no family matches.
 */
/**
 * Returns true if the variant's color belongs to one of the selected color families.
 * Falls through to true when no color filter is active.
 */
export function matchesVariantColorFilters(
  variant: any,
  filters: Pick<ProductFilterState, "colorFamilies">,
): boolean {
  const hasColorFamilyFilter = filters.colorFamilies.length > 0;

  if (!hasColorFamilyFilter) return true;

  const colorFamilyId = readPositiveId(variant, [
    "colorFamilyId",
    "ColorFamilyId",
    "productColorId",
    "ProductColorId",
  ]);

  return (
    colorFamilyId !== null && filters.colorFamilies.includes(colorFamilyId)
  );
}

/**
 * Returns true if at least one variant in the collection matches the color
 * filter. Returns true when no filter is active.
 */
export function matchesVariantCollectionColorFilters(
  variants: any[],
  filters: Pick<ProductFilterState, "colorFamilies">,
): boolean {
  const hasFilter = filters.colorFamilies.length > 0;
  if (!hasFilter) return true;

  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) return false;

  return list.some((v) => matchesVariantColorFilters(v, filters));
}

// ── Fuzzy variant colour-name search ─────────────────────────────────────────

/** Normalise a string for fuzzy matching: lowercase, collapse whitespace. */
function fuzzyNorm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Returns true if the variant's colorName fuzzy-matches the search term.
 * Empty / blank term always returns true (no filter active).
 */
export function matchesVariantColorNameSearch(
  variant: any,
  search: string,
): boolean {
  const term = fuzzyNorm(search);
  if (!term) return true;
  const name = fuzzyNorm(
    variant?.colorName ||
      variant?.ColorName ||
      variant?.color ||
      variant?.Color ||
      "",
  );
  if (!name) return false;
  // Fuzzy: every character of the term appears in order inside the name
  let ti = 0;
  for (let i = 0; i < name.length && ti < term.length; i++) {
    if (name[i] === term[ti]) ti++;
  }
  return ti === term.length;
}

/**
 * Returns true if at least one variant in the collection fuzzy-matches
 * the colour name search. Always true when search is empty.
 */
export function matchesVariantCollectionColorNameSearch(
  variants: any[],
  search: string,
): boolean {
  if (!search.trim()) return true;
  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) return false;
  return list.some((v) => matchesVariantColorNameSearch(v, search));
}

/**
 * Given a product's allVariants list and a colour-name search term,
 * returns only the variants that match (or all if search is empty).
 */
export function filterVariantsByColorName(
  variants: any[],
  search: string,
): any[] {
  if (!search.trim()) return variants;
  return (Array.isArray(variants) ? variants : []).filter((v) =>
    matchesVariantColorNameSearch(v, search),
  );
}

export function getAppliedFilterCount(filters: ProductFilterState): number {
  return (
    filters.colorFamilies.length +
    filters.sizeIds.length +
    filters.cupSizeIds.length +
    filters.brandIds.length +
    filters.categoryIds.length +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0)
  );
}

export function ProductActiveFilters({
  filters,
  onFiltersChange,
}: ProductActiveFiltersProps) {
  const { data: colorsData } = useQuery({
    queryKey: ["product-colors"],
    queryFn: getProductColors,
    staleTime: 5 * 60 * 1000,
  });
  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => listBrands({ "Page.Size": 500 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: sizesData } = useQuery({
    queryKey: ["sizes"],
    queryFn: () => listSizes({ "page.size": 200 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: cupSizesData } = useQuery({
    queryKey: ["cup-sizes"],
    queryFn: () => listCupSizes({ "page.size": 100 }),
    staleTime: 10 * 60 * 1000,
  });

  const allColors = useMemo(() => colorsData || [], [colorsData]);
  const allBrands = useMemo(() => brandsData?.list || [], [brandsData]);
  const allCategories = useMemo(
    () => categoriesData?.list || [],
    [categoriesData],
  );
  const allSizes = useMemo(
    () =>
      normalizeOptionList(
        sizesData?.list || [],
        ["sizeId", "id"],
        ["sizeLabel", "label", "name"],
      ),
    [sizesData],
  );
  const allCupSizes = useMemo(
    () =>
      normalizeOptionList(
        cupSizesData?.list || [],
        ["cupSizeId", "sizeId", "id"],
        ["cupSizeLabel", "sizeLabel", "label", "name"],
      ),
    [cupSizesData],
  );
  const activeFilterCount = useMemo(
    () => getAppliedFilterCount(filters),
    [filters],
  );

  if (activeFilterCount === 0) return null;

  const updateFilters = (partial: Partial<ProductFilterState>) =>
    onFiltersChange({ ...filters, ...partial });

  const clearAllFilters = () =>
    onFiltersChange({
      colorFamilies: [],
      sizeIds: [],
      cupSizeIds: [],
      brandIds: [],
      categoryIds: [],
      priceMin: null,
      priceMax: null,
    });

  return (
    <div className="container">
      <div className="s-globalsearch-2b5321">
        {filters.colorFamilies.map((familyId) => {
          const family = allColors.find((c) => c.id === familyId);
          return (
            <span key={`color-${familyId}`} className="gs-active-chip">
              {family && (
                <span
                  className="s-globalsearch-170863"
                  style={{ background: family.hex }}
                />
              )}
              {family?.name || `Color ${familyId}`}
              <i
                className="bi bi-x s-globalsearch-7b6f74"
                onClick={() =>
                  updateFilters({
                    colorFamilies: filters.colorFamilies.filter(
                      (x) => x !== familyId,
                    ),
                  })
                }
              />
            </span>
          );
        })}

        {filters.brandIds.map((id) => {
          const brand = allBrands.find((b: any) => b.brandId === id);
          return (
            <span key={`brand-${id}`} className="gs-active-chip">
              {brand?.brandName || "Brand"}
              <i
                className="bi bi-x s-globalsearch-7b6f74"
                onClick={() =>
                  updateFilters({
                    brandIds: filters.brandIds.filter((x) => x !== id),
                  })
                }
              />
            </span>
          );
        })}

        {filters.categoryIds.map((id) => {
          const category = allCategories.find((c: any) => c.categoryId === id);
          return (
            <span key={`category-${id}`} className="gs-active-chip">
              {category?.name || "Category"}
              <i
                className="bi bi-x s-globalsearch-7b6f74"
                onClick={() =>
                  updateFilters({
                    categoryIds: filters.categoryIds.filter((x) => x !== id),
                  })
                }
              />
            </span>
          );
        })}

        {filters.sizeIds.map((id) => {
          const size = allSizes.find((s) => s.id === id);
          return (
            <span key={`size-${id}`} className="gs-active-chip">
              {size?.label || `Size ${id}`}
              <i
                className="bi bi-x s-globalsearch-7b6f74"
                onClick={() =>
                  updateFilters({
                    sizeIds: filters.sizeIds.filter((x) => x !== id),
                  })
                }
              />
            </span>
          );
        })}

        {filters.cupSizeIds.map((id) => {
          const cupSize = allCupSizes.find((s) => s.id === id);
          return (
            <span key={`cup-${id}`} className="gs-active-chip">
              {cupSize?.label || `Cup ${id}`}
              <i
                className="bi bi-x s-globalsearch-7b6f74"
                onClick={() =>
                  updateFilters({
                    cupSizeIds: filters.cupSizeIds.filter((x) => x !== id),
                  })
                }
              />
            </span>
          );
        })}

        {(filters.priceMin !== null || filters.priceMax !== null) && (
          <span className="gs-active-chip">
            Rs.{filters.priceMin ?? 0} - Rs.{filters.priceMax ?? "Max"}
            <i
              className="bi bi-x s-globalsearch-7b6f74"
              onClick={() =>
                updateFilters({
                  priceMin: null,
                  priceMax: null,
                })
              }
            />
          </span>
        )}

        <button
          onClick={clearAllFilters}
          className="s-globalsearch-9a4839 s-globalsearch-ff9e69e4"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductFilters({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  productCount,
  currentCategoryId,
  currentSubcategoryId,
  colorNameSearch: colorNameSearchProp = "",
  onColorNameSearchChange,
}: ProductFiltersProps) {
  const [brandSearch, setBrandSearch] = useState("");
  const [colorNameSearch, setColorNameSearch] = useState(colorNameSearchProp);

  // Sync internal state when prop changes (e.g. external clear)
  useEffect(() => {
    setColorNameSearch(colorNameSearchProp);
  }, [colorNameSearchProp]);
  const PRICE_FLOOR = 0;
  const PRICE_CEIL = 10000;
  const PRICE_STEP = 100;
  const [sliderMin, setSliderMin] = useState(filters.priceMin ?? PRICE_FLOOR);
  const [sliderMax, setSliderMax] = useState(filters.priceMax ?? PRICE_CEIL);
  const [hoveredSliderValue, setHoveredSliderValue] = useState<number | null>(
    null,
  );
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderValuesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSliderMin(filters.priceMin ?? PRICE_FLOOR);
    setSliderMax(filters.priceMax ?? PRICE_CEIL);
  }, [filters.priceMin, filters.priceMax]);

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: colorsData } = useQuery({
    queryKey: ["product-colors"],
    queryFn: getProductColors,
    staleTime: 5 * 60 * 1000,
  });
  const { data: sizesData } = useQuery({
    queryKey: ["sizes"],
    queryFn: () => listSizes({ "page.size": 200 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: cupSizesData } = useQuery({
    queryKey: ["cup-sizes"],
    queryFn: () => listCupSizes({ "page.size": 100 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => listBrands({ "Page.Size": 500 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ pageSize: 200 }),
    staleTime: 10 * 60 * 1000,
  });

  const allColors = useMemo(() => colorsData || [], [colorsData]);
  const allSizes = useMemo(
    () =>
      normalizeOptionList(
        sizesData?.list || [],
        ["sizeId", "id"],
        ["sizeLabel", "label", "name"],
      ),
    [sizesData],
  );
  const allCupSizes = useMemo(
    () =>
      normalizeOptionList(
        cupSizesData?.list || [],
        ["cupSizeId", "sizeId", "id"],
        ["cupSizeLabel", "sizeLabel", "label", "name"],
      ),
    [cupSizesData],
  );
  const allBrands = useMemo(() => brandsData?.list || [], [brandsData]);
  const allCategories = useMemo(
    () => categoriesData?.list || [],
    [categoriesData],
  );

  const categoriesToShow = useMemo(() => {
    if (currentSubcategoryId) return [];
    if (currentCategoryId)
      return allCategories.filter(
        (c: any) => c.parentCategoryId === currentCategoryId,
      );
    return allCategories.filter((c: any) => !c.parentCategoryId);
  }, [allCategories, currentCategoryId, currentSubcategoryId]);

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return allBrands;
    return allBrands.filter((b: any) =>
      b.brandName?.toLowerCase().includes(brandSearch.toLowerCase()),
    );
  }, [allBrands, brandSearch]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateFilters = (partial: Partial<ProductFilterState>) =>
    onFiltersChange({ ...filters, ...partial });

  const toggleColorFamily = (familyId: number) => {
    const selected = filters.colorFamilies.includes(familyId);
    // Fix: [].every() is vacuously true in JS — without this guard, clicking a family
    // with no mapped colors always runs the deselect branch, so nothing ever gets selected.
    if (selected) {
      updateFilters({
        colorFamilies: filters.colorFamilies.filter((f) => f !== familyId),
      });
    } else {
      updateFilters({
        colorFamilies: Array.from(
          new Set([...filters.colorFamilies, familyId]),
        ),
      });
    }
  };

  const toggleItem = (key: keyof ProductFilterState, value: any) => {
    const current = filters[key] as any[];
    updateFilters({
      [key]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      colorFamilies: [],
      sizeIds: [],
      cupSizeIds: [],
      brandIds: [],
      categoryIds: [],
      priceMin: null,
      priceMax: null,
    });
    setSliderMin(PRICE_FLOOR);
    setSliderMax(PRICE_CEIL);
    setHoveredSliderValue(null);
    setColorNameSearch("");
    onColorNameSearchChange?.("");
  };

  const resetPriceFilter = () => {
    updateFilters({ priceMin: null, priceMax: null });
    setSliderMin(PRICE_FLOOR);
    setSliderMax(PRICE_CEIL);
    setHoveredSliderValue(null);
  };

  const activeFilterCount = useMemo(
    () => getAppliedFilterCount(filters),
    [filters],
  );

  const hasPriceFilter = filters.priceMin !== null || filters.priceMax !== null;
  const minPct = ((sliderMin - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100;
  const maxPct = ((sliderMax - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100;
  const isMinHandleOverlap = sliderMin >= sliderMax - 500;
  const { dismiss } = useOverlayBackDismiss(onClose, isOpen);

  const commitPriceMin = (value: number) =>
    updateFilters({
      priceMin: value > PRICE_FLOOR ? value : null,
    });

  const commitPriceMax = (value: number) =>
    updateFilters({
      priceMax: value < PRICE_CEIL ? value : null,
    });

  const clampPriceValue = (value: number) => {
    const stepped = Math.round(value / PRICE_STEP) * PRICE_STEP;
    return Math.min(PRICE_CEIL, Math.max(PRICE_FLOOR, stepped));
  };

  const setMinFromValue = (value: number, commit = false) => {
    const nextMin = Math.min(clampPriceValue(value), sliderMax - PRICE_STEP);
    setSliderMin(nextMin);
    if (commit) commitPriceMin(nextMin);
  };

  const setMaxFromValue = (value: number, commit = false) => {
    const nextMax = Math.max(clampPriceValue(value), sliderMin + PRICE_STEP);
    setSliderMax(nextMax);
    if (commit) commitPriceMax(nextMax);
  };

  const getSliderHoverPoint = (clientX: number) => {
    const shell = sliderTrackRef.current;
    if (!shell) return null;

    const rect = shell.getBoundingClientRect();
    if (rect.width <= 0) return null;

    const clampedRatio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    const hoverPct = clampedRatio * 100;
    const hoverValue = clampPriceValue(
      PRICE_FLOOR + clampedRatio * (PRICE_CEIL - PRICE_FLOOR),
    );

    return { hoverPct, hoverValue };
  };

  const setSliderHoverPoint = (clientX: number) => {
    const next = getSliderHoverPoint(clientX);
    const shell = sliderTrackRef.current;
    if (!next || !shell) return;

    shell.style.setProperty("--gs-hover-pct", `${next.hoverPct}%`);
    setHoveredSliderValue(next.hoverValue);
  };

  const handleSliderTrackPointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const next = getSliderHoverPoint(e.clientX);
    if (!next) return;

    setSliderHoverPoint(e.clientX);
    setMaxFromValue(next.hoverValue, true);
  };

  useEffect(() => {
    const elements = [sliderTrackRef.current, sliderValuesRef.current];
    elements.forEach((element) => {
      if (!element) return;
      element.style.setProperty("--gs-min-pct", `${minPct}%`);
      element.style.setProperty("--gs-max-pct", `${maxPct}%`);
    });
  }, [isOpen, minPct, maxPct]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="gs-backdrop" onClick={dismiss} />

      {/* Drawer — same markup pattern as GlobalSearch */}
      <div className="gs-drawer">
        {/* Header */}
        <div className="s-globalsearch-ae6b9e">
          <div className="s-resetpasswor-6e6177">
            <i className="bi bi-sliders s-globalsearch-b69e24" />
            <span className="s-globalsearch-b86140 s-globalsearch-ff62995b">
              Filters
            </span>
            {activeFilterCount > 0 && (
              <span className="s-globalsearch-c0a778">{activeFilterCount}</span>
            )}
          </div>
          <button onClick={dismiss} className="s-globalsearch-a3af62">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="gs-drawer-body">
          <div className="s-productlist-4402fd">
            {/* ─ 1. COLOR — circular swatches + checkmark (GlobalSearch style) ─ */}
            <div className="gs-filter-section">
              <p className="gs-sec-label">Color</p>
              <div className="s-globalsearch-1372cd">
                {allColors.map((fam) => {
                  const selected = filters.colorFamilies.includes(fam.id);
                  return (
                    <div
                      key={fam.id}
                      className="s-globalsearch-264bb7 gs-filter-color-option"
                      onClick={() => toggleColorFamily(fam.id)}
                    >
                      <div
                        className={`gs-color-swatch s-globalsearch-2da4c6${
                          selected ? " active" : ""
                        }`}
                        style={{ background: fam.hex }}
                        title={fam.name}
                      >
                        {selected && (
                          <div className="s-globalsearch-0ec8e4">
                            <i
                              className={`bi bi-check s-globalsearch-79d144 gs-filter-color-check${
                                isLightHex(fam.hex)
                                  ? " gs-filter-color-check-dark"
                                  : ""
                              }`}
                            />
                          </div>
                        )}
                      </div>
                      <span
                        className={`s-globalsearch-deaf69 gs-filter-color-label${
                          selected ? " active" : ""
                        }`}
                      >
                        {fam.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Variant colour-name search */}
              <div className="gs-filter-color-name-search">
                <div className="s-globalsearch-303890 gs-filter-color-name-field">
                  <i className="bi bi-search gs-filter-color-name-icon" />
                  <input
                    type="text"
                    placeholder="Search colour name…"
                    value={colorNameSearch}
                    onChange={(e) => {
                      setColorNameSearch(e.target.value);
                      onColorNameSearchChange?.(e.target.value);
                    }}
                    className="s-globalsearch-30c0ee s-globalsearch-ff9e69e4 gs-filter-search gs-filter-color-name-input"
                  />
                  {colorNameSearch && (
                    <button
                      type="button"
                      className="gs-filter-color-name-clear"
                      onClick={() => {
                        setColorNameSearch("");
                        onColorNameSearchChange?.("");
                      }}
                      title="Clear colour search"
                    >
                      <i className="bi bi-x" />
                    </button>
                  )}
                </div>
                {colorNameSearch.trim() && (
                  <p className="gs-filter-color-name-hint">
                    Showing products with a variant named like “
                    {colorNameSearch}”
                  </p>
                )}
              </div>
            </div>

            {/* ─ 2. SIZE ─ */}
            {(allSizes.length > 0 || allCupSizes.length > 0) && (
              <div className="gs-filter-section">
                <p className="gs-sec-label">Size</p>
                {allSizes.length > 0 && (
                  <>
                    <div className="s-globalsearch-2dc2e6">Band / Alpha</div>
                    <div
                      className={`s-globalsearch-af9fea gs-filter-size-row${
                        allCupSizes.length > 0 ? " has-cup-sizes" : ""
                      }`}
                    >
                      {allSizes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`gs-size-pill${
                            filters.sizeIds.includes(s.id) ? " active" : ""
                          }`}
                          onClick={() => toggleItem("sizeIds", s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {allCupSizes.length > 0 && (
                  <>
                    <div className="s-globalsearch-2dc2e6">Cup Size</div>
                    <div className="s-quickshopmod-07988e gs-filter-size-row">
                      {allCupSizes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`gs-size-pill${
                            filters.cupSizeIds.includes(s.id) ? " active" : ""
                          }`}
                          onClick={() => toggleItem("cupSizeIds", s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ 3. BRAND ─ */}
            {allBrands.length > 0 && (
              <div className="gs-filter-section">
                <p className="gs-sec-label">Brand</p>
                <input
                  type="text"
                  placeholder="Search brands..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  className="s-globalsearch-30c0ee s-globalsearch-ff9e69e4 gs-filter-search"
                />
                <div className="s-productlist-48e5f5">
                  {filteredBrands.map((brand: any) => {
                    const active = filters.brandIds.includes(brand.brandId);
                    return (
                      <button
                        key={brand.brandId}
                        className={`gs-brand-pill${active ? " active" : ""}`}
                        onClick={() => toggleItem("brandIds", brand.brandId)}
                      >
                        {active && (
                          <i className="bi bi-check s-addresslist-2c42ad" />
                        )}
                        {brand.brandName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─ 4. CATEGORY ─ */}
            {categoriesToShow.length > 0 && (
              <div className="gs-filter-section">
                <p className="gs-sec-label">Category</p>
                <div className="s-productlist-a8c057">
                  {categoriesToShow.map((cat: any) => {
                    const checked = filters.categoryIds.includes(
                      cat.categoryId,
                    );
                    return (
                      <label
                        key={cat.categoryId}
                        className={`s-globalsearch-6ab205 gs-filter-category-option${
                          checked ? " active" : ""
                        }`}
                      >
                        <div
                          className={`s-globalsearch-455413 gs-filter-category-indicator${
                            checked ? " active" : ""
                          }`}
                        >
                          {checked && (
                            <i className="bi bi-check s-adminproduct-b5c012" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleItem("categoryIds", cat.categoryId)
                          }
                          className="s-addressform-8251cb"
                        />
                        <span
                          className={`s-globalsearch-080038 gs-filter-category-label${
                            checked ? " active" : ""
                          }`}
                        >
                          {cat.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─ 5. PRICE — fixed slider + values under dots + double-click to reset ─ */}
            <div className="gs-filter-section">
              {/* Title row */}
              <div className="gs-filter-headrow">
                <p
                  className="gs-sec-label gs-filter-price-label"
                  title="Double-click to reset price"
                  onDoubleClick={resetPriceFilter}
                >
                  Price Range
                </p>
                {hasPriceFilter && (
                  <button
                    onClick={resetPriceFilter}
                    className="gs-filter-reset"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Dual-range slider */}
              <div
                ref={sliderTrackRef}
                className="gs-price-slider-shell"
                onMouseMove={(e) => setSliderHoverPoint(e.clientX)}
                onMouseLeave={() => {
                  setHoveredSliderValue(null);
                }}
              >
                <div
                  className={`gs-price-slider-hover-tooltip${
                    hoveredSliderValue !== null ? " active" : ""
                  }`}
                >
                  Rs.
                  {(hoveredSliderValue ?? PRICE_FLOOR).toLocaleString("en-IN")}
                </div>
                {/* Track */}
                <div
                  className="gs-price-slider-track"
                  onPointerDown={handleSliderTrackPointerDown}
                >
                  <div className="gs-price-slider-fill" />
                </div>
                {/* Min input */}
                <input
                  type="range"
                  min={PRICE_FLOOR}
                  max={PRICE_CEIL}
                  step={PRICE_STEP}
                  value={sliderMin}
                  onChange={(e) => setMinFromValue(Number(e.target.value))}
                  onMouseUp={() => commitPriceMin(sliderMin)}
                  onTouchEnd={() => commitPriceMin(sliderMin)}
                  onKeyUp={() => commitPriceMin(sliderMin)}
                  className={`price-slider-min${
                    isMinHandleOverlap ? " is-overlap" : ""
                  }`}
                />
                {/* Max input */}
                <input
                  type="range"
                  min={PRICE_FLOOR}
                  max={PRICE_CEIL}
                  step={PRICE_STEP}
                  value={sliderMax}
                  onChange={(e) => setMaxFromValue(Number(e.target.value))}
                  onMouseUp={() => commitPriceMax(sliderMax)}
                  onTouchEnd={() => commitPriceMax(sliderMax)}
                  onKeyUp={() => commitPriceMax(sliderMax)}
                  className="price-slider-max"
                />
              </div>

              {/* ₹ value labels under dots */}
              <div ref={sliderValuesRef} className="gs-price-slider-values">
                <span className="gs-price-slider-value gs-price-slider-value-min">
                  Rs.{sliderMin.toLocaleString("en-IN")}
                </span>
                <span className="gs-price-slider-value gs-price-slider-value-max">
                  Rs.{sliderMax.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Manual min / max inputs */}
              <div className="s-adminproduct-04b6ac gs-filter-price-inputs">
                <div className="s-globalsearch-303890 gs-filter-price-field">
                  <span className="s-globalsearch-54d625">Rs.</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin ?? ""}
                    min={0}
                    onChange={(e) => {
                      const val =
                        e.target.value !== "" ? Number(e.target.value) : null;
                      updateFilters({ priceMin: val });
                      setSliderMin(
                        val !== null ? Math.min(val, PRICE_CEIL) : PRICE_FLOOR,
                      );
                    }}
                    className="s-productlist-4706fe s-globalsearch-ff9e69e4 gs-filter-number-input"
                  />
                </div>
                <span className="s-globalsearch-db3041">-</span>
                <div className="s-globalsearch-303890 gs-filter-price-field">
                  <span className="s-globalsearch-54d625">Rs.</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax ?? ""}
                    min={0}
                    onChange={(e) => {
                      const val =
                        e.target.value !== "" ? Number(e.target.value) : null;
                      updateFilters({ priceMax: val });
                      setSliderMax(
                        val !== null ? Math.min(val, PRICE_CEIL) : PRICE_CEIL,
                      );
                    }}
                    className="s-productlist-4706fe s-globalsearch-ff9e69e4 gs-filter-number-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gs-drawer-footer">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="s-globalsearch-36d424 s-globalsearch-ff9e69e4"
            >
              Clear All
            </button>
          )}
          <button
            onClick={dismiss}
            className="s-globalsearch-8a02af s-globalsearch-ff9e69e4"
          >
            Show {productCount} Products
          </button>
        </div>
      </div>
    </>
  );
}
