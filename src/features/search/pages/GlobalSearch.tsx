/**
 * GlobalSearch.tsx
 *
 * Color search  : detects color words → sends colors=<n> → backend expands
 *                 via hex proximity against ProductColor table → exact matches
 * Regular search: quickSearch with fuzzy (tshirt→t-shirt, paded→padded)
 * Grouping      : one card per product (grouped by productId) — 20 cards per page
 * Filter drawer : Color → Size → Brand → Category → Price  (same as ProductList)
 * Layout        : product count LEFT · filter button RIGHT
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  listProducts, listCategories, listBrands,
  getProductColors, listSizes, listCupSizes,
} from '@/features/products/api/products.api';
import ProductCard from '@/features/products/components/ProductCard';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { useBreadcrumb } from '@/shared/hooks/useBreadcrumb';
import QuickShopModal from '@/features/products/components/QuickShopModal';

const FONTS    = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI  = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

/* ─────────────────────────────────────────────────────────────────────────────
   COLOR FAMILIES  (filter swatches — same as ProductList)
───────────────────────────────────────────────────────────────────────────── */
const COLOR_FAMILIES: { label: string; swatch: string; keywords: string[] }[] = [
  { label: 'Red',    swatch: 'var(--brand)', keywords: ['red','crimson','scarlet','cherry','maroon','burgundy','wine','rose','brick'] },
  { label: 'Pink',   swatch: '#e91e8c', keywords: ['pink','blush','magenta','fuchsia','hot pink','baby pink','salmon'] },
  { label: 'Purple', swatch: 'var(--brand)', keywords: ['purple','violet','lavender','mauve','lilac','plum','indigo'] },
  { label: 'Blue',   swatch: 'var(--brand)', keywords: ['blue','navy','cobalt','sky','azure','teal','steel','powder blue','denim','royal'] },
  { label: 'Green',  swatch: 'var(--brand)', keywords: ['green','olive','mint','sage','forest','lime','khaki','army'] },
  { label: 'Yellow', swatch: 'var(--brand)', keywords: ['yellow','gold','mustard','amber','lemon','corn'] },
  { label: 'Orange', swatch: 'var(--brand)', keywords: ['orange','peach','apricot','tangerine','coral','rust'] },
  { label: 'Brown',  swatch: 'var(--brand)', keywords: ['brown','tan','beige','caramel','chocolate','mocha','nude','khaki','sand'] },
  { label: 'Grey',   swatch: 'var(--heirloom)', keywords: ['grey','gray','silver','charcoal','slate','ash'] },
  { label: 'White',  swatch: 'var(--ivory)', keywords: ['white','ivory','cream','snow','off-white','pearl'] },
  { label: 'Black',  swatch: '#000000', keywords: ['black','ebony','onyx','jet'] },
];

function colorToFamily(rawColor: string): string | null {
  const lower = rawColor.toLowerCase().trim();
  for (const fam of COLOR_FAMILIES) {
    if (fam.keywords.some(k => lower.includes(k) || k.includes(lower))) return fam.label;
  }
  return null;
}

function groupColors(rawColors: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of rawColors) {
    const fam = colorToFamily(c) ?? 'Other';
    const existing = map.get(fam) ?? [];
    existing.push(c);
    map.set(fam, existing);
  }
  return map;
}

/* ─────────────────────────────────────────────────────────────────────────────
   COLOR DETECTION  (for search query — detects if the typed query is a color)
───────────────────────────────────────────────────────────────────────────── */
const COLOR_HEX: Record<string, string> = {
  black:'#000000', cloud:'var(--heirloom)', desert_rose:'var(--heirloom)', grey:'var(--heirloom)',
  lavender:'#E6E6FA', maroon:'var(--brand)', mist:'var(--heirloom)', navy:'#000080',
  nude:'#E3BC9A', orange:'var(--brand)', pink:'#FFC0CB', red:'var(--brand)',
  rose:'#FF007F', skin:'#FFCBA4', teal:'#008080', white:'#FFFFFF',
  wine:'var(--brand)',
  gray:'var(--heirloom)', silver:'var(--heirloom)', charcoal:'#36454F', ash:'#B2BEB5',
  ivory:'#ffffff', cream:'var(--ivory)', beige:'var(--ivory)', off_white:'var(--ivory)',
  brown:'#964B00', tan:'#D2B48C', nude_beige:'#E3BC9A', caramel:'#C68642',
  crimson:'var(--brand)', scarlet:'#FF2400', burgundy:'var(--brand)', maroon_red:'var(--brand)',
  hot_pink:'#FF69B4', blush:'#DE5D83', salmon:'#FA8072', magenta:'#FF00FF',
  coral:'var(--brand)', rust:'#B7410E', amber:'var(--blush)', gold:'var(--blush)',
  mustard:'var(--blush)', yellow:'#FFFF00', green:'var(--brand)', olive:'#808000',
  mint:'#98FF98', sage:'#8F9779', forest:'#228B22', emerald:'#50C878',
  turquoise:'#40E0D0', aqua:'#00FFFF', blue:'#0000FF', cobalt:'var(--brand)',
  sky:'#87CEEB', denim:'var(--brand)', royal:'#4169E1', purple:'var(--brand)',
  violet:'#8B00FF', lilac:'#C8A2C8', plum:'#DDA0DD', indigo:'var(--brand)',
  grape:'#6F2DA8', orchid:'#DA70D6',
};

function resolveHex(q: string): string | null {
  const key = q.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  const plain = q.toLowerCase().trim();
  if (COLOR_HEX[plain]) return COLOR_HEX[plain];
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    if (plain.includes(name.replace(/_/g, ' ')) || name.replace(/_/g, ' ').includes(plain)) return hex;
  }
  return null;
}

function isColorQuery(q: string): boolean {
  return q.trim().length >= 3 && resolveHex(q) !== null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUZZY MATCHING
───────────────────────────────────────────────────────────────────────────── */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]+/g, '');
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}
function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = normalize(query), t = normalize(target);
  if (t.includes(q) || q.includes(t)) return true;
  for (const a of q.split(/\s+/)) {
    if (a.length < 3) continue;
    for (const b of t.split(/\s+/)) {
      if (b.startsWith(a)) return true;
      if (b.length >= 3 && levenshtein(a, b) / Math.max(a.length, b.length) <= 0.35) return true;
    }
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FILTER STATE
───────────────────────────────────────────────────────────────────────────── */
interface FilterState {
  categoryIds:   number[];
  brandIds:      number[];
  sizeIds:       number[];
  cupSizeIds:    number[];
  colorFamilies: string[];
  rawColors:     string[];
  priceMin:      number | null;
  priceMax:      number | null;
  sortOption:    string;
}

const DEFAULT_FILTERS: FilterState = {
  categoryIds: [], brandIds: [], sizeIds: [], cupSizeIds: [],
  colorFamilies: [], rawColors: [],
  priceMin: null, priceMax: null,
  sortOption: '',
};

const SORT_OPTIONS = [
  { val: '',       label: '✨ Latest' },
  { val: 'az',     label: 'A → Z' },
  { val: 'za',     label: 'Z → A' },
  { val: 'low',    label: '₹ Low → High' },
  { val: 'high',   label: '₹ High → Low' },
  { val: 'rating', label: '⭐ Top Rated' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate     = useNavigate();
  const q            = searchParams.get('q') || '';
  const breadcrumbs  = useBreadcrumb({ searchQuery: q || undefined });

  const [quickShopId, setQuickShopId] = useState<number | null>(null);
  const [page, setPage]               = useState(1);
  const [filterOpen, setFilterOpen]   = useState(false);
  const [filters, setFilters]         = useState<FilterState>(DEFAULT_FILTERS);
  const [brandSearch, setBrandSearch] = useState('');

  const PAGE_SIZE = 20;

  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [page]);

  // Single-word colour detection
  const colorQuery = q.trim().split(/\s+/).length === 1 && isColorQuery(q);
  const anchorHex  = colorQuery ? resolveHex(q) : null;

  /* ── Filter data queries ──────────────────────────────────────────────── */
  const { data: categoriesData } = useQuery({
    queryKey: ['filter-categories'],
    queryFn:  () => listCategories({ pageSize: 500, orderProperty: 'Name', orderAscending: true }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: brandsData } = useQuery({
    queryKey: ['filter-brands'],
    queryFn:  () => listBrands({ 'Page.Size': 500, 'Order.Property': 'ModifiedDate', 'Order.Ascending': false }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: rawColorList = [] } = useQuery({
    queryKey: ['product-colors'],
    queryFn:  getProductColors,
    staleTime: 10 * 60 * 1000,
  });
  const { data: sizesData } = useQuery({
    queryKey: ['filter-sizes'],
    queryFn:  () => listSizes({ 'Page.Size': 200, 'Order.Property': 'orderNo', 'Order.Ascending': true }),
    staleTime: 10 * 60 * 1000,
    retry: false,        // /Size is admin-only; don't retry on 403
    throwOnError: false, // page still renders; size filter stays hidden
  });
  const { data: cupSizesData } = useQuery({
    queryKey: ['filter-cup-sizes'],
    queryFn:  () => listCupSizes({ 'Page.Size': 50, 'Order.Ascending': true }),
    staleTime: 10 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });

  const categories     = categoriesData?.list ?? [];
  const allBrands      = brandsData?.list ?? [];
  const allSizes       = sizesData?.list ?? [];
  const allCupSizes    = cupSizesData?.list ?? [];
  const filteredBrands = brandSearch
    ? allBrands.filter((b: any) => b.brandName?.toLowerCase().includes(brandSearch.toLowerCase()))
    : allBrands;
  // getProductColors returns ColorListItem[] — extract name strings before passing
  // to groupColors (which calls .toLowerCase() and expects plain strings)
  const colorFamilyMap = useMemo(
    () => groupColors((rawColorList as any[]).map((c: any) => (typeof c === 'string' ? c : c.name ?? ''))),
    [rawColorList]
  );

  /* ── Build API params ────────────────────────────────────────────────── */
  const buildParams = useCallback(() => {
    const params: Record<string, any> = {
      pageNumber: 1,
      pageSize:   500,
      orderProperty:  'ModifiedDate',
      orderAscending: false,
    };

    if (colorQuery)       params.colors      = q;
    else if (q)           params.quickSearch = q;

    if (filters.categoryIds.length) params.categoryIds = filters.categoryIds.join(',');
    if (filters.brandIds.length)    params.brandIds    = filters.brandIds.join(',');
    if (filters.sizeIds.length)     params.sizeIds     = filters.sizeIds.join(',');
    if (filters.cupSizeIds.length)  params.cupSizeIds  = filters.cupSizeIds.join(',');
    if (filters.rawColors.length)   params.colors      = filters.rawColors.join(',');
    if (filters.priceMin != null)   params.priceMin    = filters.priceMin;
    if (filters.priceMax != null)   params.priceMax    = filters.priceMax;

    if      (filters.sortOption === 'az')     { params.orderProperty = 'product.name'; params.orderAscending = true; }
    else if (filters.sortOption === 'za')     { params.orderProperty = 'product.name'; params.orderAscending = false; }
    else if (filters.sortOption === 'low')    { params.orderProperty = 'FinalPrice';   params.orderAscending = true; }
    else if (filters.sortOption === 'high')   { params.orderProperty = 'FinalPrice';   params.orderAscending = false; }
    else if (filters.sortOption === 'rating') { params.orderProperty = 'Rating';       params.orderAscending = false; }

    return params;
  }, [q, colorQuery, filters]);

  /* ── Products query ──────────────────────────────────────────────────── */
  const { data: productData, isLoading } = useQuery({
    queryKey: ['gs', JSON.stringify(buildParams())],
    queryFn:  () => listProducts(buildParams()),
    enabled:  !!q && q.trim().length >= 1,
  });

  const raw: any[] = productData?.list ?? [];

  // Fuzzy client-side filter for regular searches
  const fuzzyFiltered: any[] = colorQuery
    ? raw
    : (() => {
        const f = raw.filter((p: any) =>
          fuzzyMatch(q, p.name ?? '') ||
          fuzzyMatch(q, p.description ?? '') ||
          fuzzyMatch(q, p.color ?? '')
        );
        return f.length > 0 ? f : raw;
      })();

  // Group by productId — one card per unique product, variants attached
  const allGrouped: any[] = useMemo(() => {
    const groups = new Map<number, any[]>();
    fuzzyFiltered.forEach((p: any) => {
      if (!groups.has(p.productId)) groups.set(p.productId, []);
      groups.get(p.productId)!.push(p);
    });
    return Array.from(groups.values()).map(variants => ({
      ...variants[0],
      allVariants: variants,
      allColors:   variants.map((v: any) => v.color).filter(Boolean),
    }));
  }, [fuzzyFiltered]);

  // Always count grouped cards, never raw variants
  const totalCards = allGrouped.length;
  const totalPages = Math.ceil(totalCards / PAGE_SIZE);
  const displayed  = allGrouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Toggle helpers ──────────────────────────────────────────────────── */
  const toggleColorFamily = (familyLabel: string) => {
    setFilters(f => {
      const selected    = f.colorFamilies.includes(familyLabel);
      const newFamilies = selected
        ? f.colorFamilies.filter(x => x !== familyLabel)
        : [...f.colorFamilies, familyLabel];
      const newRaw = newFamilies.flatMap(fam => {
        const fromDb = colorFamilyMap.get(fam);
        if (fromDb && fromDb.length > 0) return fromDb;
        const famData = COLOR_FAMILIES.find(fd => fd.label === fam);
        return famData ? famData.keywords : [];
      });
      return { ...f, colorFamilies: newFamilies, rawColors: newRaw };
    });
    setPage(1);
  };

  const toggleCategory  = (id: number) => { setFilters(f => ({ ...f, categoryIds: f.categoryIds.includes(id)  ? f.categoryIds.filter(x => x !== id)  : [...f.categoryIds,  id] })); setPage(1); };
  const toggleBrand     = (id: number) => { setFilters(f => ({ ...f, brandIds:    f.brandIds.includes(id)     ? f.brandIds.filter(x => x !== id)     : [...f.brandIds,     id] })); setPage(1); };
  const toggleSize      = (id: number) => { setFilters(f => ({ ...f, sizeIds:     f.sizeIds.includes(id)      ? f.sizeIds.filter(x => x !== id)      : [...f.sizeIds,      id] })); setPage(1); };
  const toggleCupSize   = (id: number) => { setFilters(f => ({ ...f, cupSizeIds:  f.cupSizeIds.includes(id)   ? f.cupSizeIds.filter(x => x !== id)   : [...f.cupSizeIds,   id] })); setPage(1); };
  const clearAllFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); };

  const activeFilterCount =
    filters.categoryIds.length + filters.brandIds.length +
    filters.colorFamilies.length + filters.sizeIds.length +
    filters.cupSizeIds.length + (filters.priceMin != null ? 1 : 0);

  /* ── Smart pagination array ──────────────────────────────────────────── */
  const pagesArr = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  })();

  const goToPage = (p: number) => { if (p < 1 || p > totalPages || p === page) return; setPage(p); };

  return (
    <>
      <Breadcrumb items={breadcrumbs} />

      {/* ══ Sticky toolbar ══ */}
      <div className="s-globalsearch-f4837a">
        <div className="container">

          {/* Row 1 — filter button LEFT · sort pills · count RIGHT */}
          <div className="s-globalsearch-6b6f58">

            {/* ── Filter button — LEFT ── */}
            {q && (
              <button
                onClick={() => setFilterOpen(o => !o)}
                className="s-globalsearch-fd1c89" style={ {background: filterOpen ? 'var(--brand)' : '#fff', color: filterOpen ? '#fff' : 'var(--brand)', fontFamily: FONT_UI} }
              >
                <i className="bi bi-sliders" />
                Filters {activeFilterCount > 0 && (
                  <span className="s-globalsearch-c9a470" style={ {background: filterOpen ? 'rgba(255,255,255,0.3)' : 'var(--brand)'} }>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* ── Sort pills — centre ── */}
            <div className="gs-scroll s-globalsearch-a290ea">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.val}
                  className={`gs-fsort-btn${opt.val !== '' && filters.sortOption === opt.val ? ' active' : ''}`}
                  onClick={() => { setFilters(f => ({ ...f, sortOption: opt.val })); setPage(1); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* ── Product count — RIGHT ── */}
            {q && !isLoading && totalCards > 0 && (
              <span className="s-globalsearch-599c0c s-globalsearch-ff9e69e4">
                <strong className="s-globalsearch-b29d07">{totalCards}</strong> product{totalCards !== 1 ? 's' : ''} for <em>"{q}"</em>
              </span>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="s-globalsearch-2b5321">
              {filters.colorFamilies.map(fam => {
                const famData = COLOR_FAMILIES.find(f => f.label === fam);
                return (
                  <span key={fam} className="gs-active-chip">
                    {famData && <span className="s-globalsearch-170863" />}
                    {fam}
                    <i className="bi bi-x s-globalsearch-7b6f74" onClick={() => toggleColorFamily(fam)} />
                  </span>
                );
              })}
              {filters.brandIds.map(id => {
                const brand = allBrands.find((b: any) => b.brandId === id);
                return brand ? (
                  <span key={id} className="gs-active-chip">
                    {brand.brandName}
                    <i className="bi bi-x s-globalsearch-7b6f74" onClick={() => toggleBrand(id)} />
                  </span>
                ) : null;
              })}
              {(filters.priceMin != null || filters.priceMax != null) && (
                <span className="gs-active-chip">
                  ₹{filters.priceMin ?? 0} – ₹{filters.priceMax ?? '∞'}
                  <i className="bi bi-x s-globalsearch-7b6f74" onClick={() => setFilters(f => ({ ...f, priceMin: null, priceMax: null }))} />
                </span>
              )}
              {filters.sizeIds.length > 0 && (
                <span className="gs-active-chip">
                  {filters.sizeIds.length} size{filters.sizeIds.length > 1 ? 's' : ''}
                  <i className="bi bi-x s-globalsearch-7b6f74" onClick={() => setFilters(f => ({ ...f, sizeIds: [] }))} />
                </span>
              )}
              {filters.cupSizeIds.length > 0 && (
                <span className="gs-active-chip">
                  {filters.cupSizeIds.length} cup size{filters.cupSizeIds.length > 1 ? 's' : ''}
                  <i className="bi bi-x s-globalsearch-7b6f74" onClick={() => setFilters(f => ({ ...f, cupSizeIds: [] }))} />
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="s-globalsearch-9a4839 s-globalsearch-ff9e69e4"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ Filter Sidebar Drawer ══ */}
      {filterOpen && (
        <>
          <div className="gs-backdrop" onClick={() => setFilterOpen(false)} />
          <div className="gs-drawer">

            {/* Header */}
            <div className="s-globalsearch-ae6b9e">
              <div className="s-resetpasswor-6e6177">
                <i className="bi bi-sliders s-globalsearch-b69e24" />
                <span className="s-globalsearch-b86140 s-globalsearch-ff62995b">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="s-globalsearch-c0a778">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setFilterOpen(false)} className="s-globalsearch-a3af62">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="gs-drawer-body">
              <div className="s-productlist-4402fd">

                {/* ─ 1. COLOR ─ */}
                <div>
                  <p className="gs-sec-label">Color</p>
                  <div className="s-globalsearch-1372cd">
                    {COLOR_FAMILIES.map(fam => {
                      if (colorFamilyMap.size > 0 && !colorFamilyMap.has(fam.label)) return null;
                      const selected = filters.colorFamilies.includes(fam.label);
                      return (
                        <div key={fam.label} className="s-globalsearch-264bb7" onClick={() => toggleColorFamily(fam.label)}>
                          <div
                            className={`gs-color-swatch${selected ? ' active' : ''} s-globalsearch-2da4c6`} style={ {border: selected ? `2.5px solid var(--brand)` : '2.5px solid rgba(0,0,0,.1)'} }
                            title={fam.label}
                          >
                            {selected && (
                              <div className="s-globalsearch-0ec8e4">
                                <i className="bi bi-check s-globalsearch-79d144" style={{ color: ['White', 'Yellow'].includes(fam.label) ? '#000' : '#fff' }} />
                              </div>
                            )}
                          </div>
                          <span className="s-globalsearch-deaf69" style={ {color: selected ? 'var(--brand)' : 'var(--heirloom)', fontWeight: selected ? 700 : 400, fontFamily: FONT_UI} }>{fam.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 2. SIZE ─ */}
                {(allSizes.length > 0 || allCupSizes.length > 0) && (
                  <div>
                    <p className="gs-sec-label">Size</p>
                    {allSizes.length > 0 && (
                      <>
                        <div className="s-globalsearch-2dc2e6">Band / Alpha</div>
                        <div className="s-globalsearch-af9fea" style={ {marginBottom: allCupSizes.length > 0 ? 14 : 0} }>
                          {allSizes.map((s: any) => (
                            <button key={s.sizeId} className={`gs-size-pill${filters.sizeIds.includes(s.sizeId) ? ' active' : ''}`} onClick={() => toggleSize(s.sizeId)}>
                              {s.sizeLabel}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {allCupSizes.length > 0 && (
                      <>
                        <div className="s-globalsearch-2dc2e6">Cup Size</div>
                        <div className="s-quickshopmod-07988e">
                          {allCupSizes.map((s: any) => (
                            <button key={s.cupSizeId ?? s.sizeId} className={`gs-size-pill${filters.cupSizeIds.includes(s.cupSizeId ?? s.sizeId) ? ' active' : ''}`} onClick={() => toggleCupSize(s.cupSizeId ?? s.sizeId)}>
                              {s.sizeLabel}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─ 3. BRAND ─ */}
                <div>
                  <p className="gs-sec-label">Brand</p>
                  <input
                    type="text" placeholder="🔍 Search brands…" value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    className="s-globalsearch-30c0ee s-globalsearch-ff9e69e4"
                  />
                  <div className="s-productlist-48e5f5">
                    {filteredBrands.map((brand: any) => {
                      const active = filters.brandIds.includes(brand.brandId);
                      return (
                        <button key={brand.brandId} className={`gs-brand-pill${active ? ' active' : ''}`} onClick={() => toggleBrand(brand.brandId)}>
                          {active && <i className="bi bi-check s-addresslist-2c42ad" />}
                          {brand.brandName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 4. CATEGORY ─ */}
                <div>
                  <p className="gs-sec-label">Category</p>
                  <div className="s-productlist-a8c057">
                    {categories.map((cat: any) => {
                      const checked = filters.categoryIds.includes(cat.categoryId);
                      return (
                        <label key={cat.categoryId} className="s-globalsearch-6ab205" style={ {background: checked ? `var(--brand)10` : 'transparent'} }>
                          <div className="s-globalsearch-455413" style={ {border: `2px solid ${checked ? 'var(--brand)' : 'var(--ivory)'}`, background: checked ? 'var(--brand)' : '#fff'} }>
                            {checked && <i className="bi bi-check s-adminproduct-b5c012" />}
                          </div>
                          <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat.categoryId)} className="s-addressform-8251cb" />
                          <span className="s-globalsearch-080038" style={ {color: checked ? 'var(--brand)' : 'var(--heirloom)', fontWeight: checked ? 600 : 400} }>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 5. PRICE RANGE ─ */}
                <div>
                  <p className="gs-sec-label">Price Range</p>
                  <div className="gs-scroll s-adminproduct-02d219">
                    {[
                      { label: 'Under ₹500', min: null, max: 500  },
                      { label: '₹500–₹1k',   min: 500,  max: 1000 },
                      { label: '₹1k–₹2k',    min: 1000, max: 2000 },
                      { label: '₹2k–₹5k',    min: 2000, max: 5000 },
                      { label: '₹5k+',        min: 5000, max: null  },
                    ].map(p => {
                      const isActive = filters.priceMin === p.min && filters.priceMax === p.max;
                      return (
                        <button key={p.label} className={`gs-price-quick${isActive ? ' active' : ''}`} onClick={() => { setFilters(f => ({ ...f, priceMin: p.min, priceMax: p.max })); setPage(1); }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="s-adminproduct-04b6ac">
                    <div className="s-globalsearch-303890">
                      <span className="s-globalsearch-54d625">₹</span>
                      <input type="number" placeholder="Min" value={filters.priceMin ?? ''} min={0}
                        onChange={e => setFilters(f => ({ ...f, priceMin: e.target.value !== '' ? Number(e.target.value) : null }))}
                        onKeyDown={e => { if (e.key === 'Enter') setPage(1); }}
                        className="s-productlist-4706fe s-globalsearch-ff9e69e4" />
                    </div>
                    <span className="s-globalsearch-db3041">—</span>
                    <div className="s-globalsearch-303890">
                      <span className="s-globalsearch-54d625">₹</span>
                      <input type="number" placeholder="Max" value={filters.priceMax ?? ''} min={0}
                        onChange={e => setFilters(f => ({ ...f, priceMax: e.target.value !== '' ? Number(e.target.value) : null }))}
                        onKeyDown={e => { if (e.key === 'Enter') setPage(1); }}
                        className="s-productlist-4706fe s-globalsearch-ff9e69e4" />
                    </div>
                    <button onClick={() => setPage(1)} className="s-globalsearch-7f6192 s-globalsearch-ff9e69e4">
                      Go
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="gs-drawer-footer">
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="s-globalsearch-36d424 s-globalsearch-ff9e69e4">
                  Clear All
                </button>
              )}
              <button onClick={() => setFilterOpen(false)} className="s-globalsearch-8a02af s-globalsearch-ff9e69e4">
                Show {allGrouped.length} Products
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ Page body ══ */}
      <div className="container s-globalsearch-58358e s-globalsearch-ff9e69e4">

        {/* Color search badge */}
        {q && colorQuery && anchorHex && (
          <div className="s-cart-1fdbde">
            <span className="s-globalsearch-1ccf92" style={ {background: anchorHex} } />
            <span className="s-globalsearch-d2dadc">
              Showing all {q.toLowerCase()} shades
            </span>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && q && (
          <div className="s-wishlist-444f00">
            <div className="s-globalsearch-650876" />
          </div>
        )}

        {/* Landing state — no query */}
        {!q && !isLoading && (
          <div className="s-ourblog-f6d3dd">
            <i className="bi bi-search s-globalsearch-d99dd5" />
            <h3 className="s-globalsearch-e2634d s-globalsearch-ff62995b">Search TWAM Collection</h3>
            <div className="s-globalsearch-bfdb8f">
              {['Bras', 'Panties', 'Sports Bra', 'Leakproof', 'Black', 'Wine', 'Pink', 'Navy', 'Nude'].map(s => (
                <button key={s} onClick={() => setSearchParams({ q: s })}
                  className="s-globalsearch-66d96a s-globalsearch-ff9e69e4"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--brand)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ivory)'; (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; }}>
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
            <h3 className="s-globalsearch-e4d44f s-globalsearch-ff62995b">No results for "{q}"</h3>
            <div className="s-globalsearch-739925">
              <button onClick={() => setSearchParams({})}
                className="s-globalsearch-5edfcb s-globalsearch-ff9e69e4">
                Clear
              </button>
              <button onClick={() => navigate('/user-products/product-list')}
                className="s-globalsearch-fa3f7c s-globalsearch-ff9e69e4">
                Browse All
              </button>
            </div>
          </div>
        )}

        {/* ── Product grid using shared ProductCard ── */}
        {!isLoading && displayed.length > 0 && (
          <>
            <div className="gs-grid s-globalsearch-fe6df2">
              {displayed.map((product: any) => (
                <div key={`${product.productId}-${product.productVariantId}`}>
                  <ProductCard product={product} onQuickShop={setQuickShopId} showColors={true} />
                </div>
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="s-productlist-a86882">
                <button disabled={page === 1} onClick={() => goToPage(page - 1)} className="gs-page-arrow" aria-label="Previous page">
                  <i className="bi bi-chevron-left" />
                </button>
                {pagesArr.map((p, i) =>
                  p === '...'
                    ? <span key={`el-${i}`} className="s-globalsearch-dcda95">…</span>
                    : (
                      <button key={p} onClick={() => goToPage(p as number)} className={`gs-page-btn${page === p ? ' active' : ''}`}>
                        {p}
                      </button>
                    )
                )}
                <button disabled={page === totalPages} onClick={() => goToPage(page + 1)} className="gs-page-arrow" aria-label="Next page">
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

      {quickShopId && <QuickShopModal productVariantId={quickShopId} onClose={() => setQuickShopId(null)} />}
    </>
  );
}