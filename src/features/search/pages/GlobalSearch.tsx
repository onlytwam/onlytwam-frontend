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

const PRI      = '#6B0F2A';
const HEIRLOOM = '#9E6070';
const IVORY    = '#F5F0E6';
const FONTS    = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const FONT_UI  = '"Trebuchet MS", "Gill Sans", Arial, sans-serif';

/* ─────────────────────────────────────────────────────────────────────────────
   COLOR FAMILIES  (filter swatches — same as ProductList)
───────────────────────────────────────────────────────────────────────────── */
const COLOR_FAMILIES: { label: string; swatch: string; keywords: string[] }[] = [
  { label: 'Red',    swatch: '#c62828', keywords: ['red','crimson','scarlet','cherry','maroon','burgundy','wine','rose','brick'] },
  { label: 'Pink',   swatch: '#e91e8c', keywords: ['pink','blush','magenta','fuchsia','hot pink','baby pink','salmon'] },
  { label: 'Purple', swatch: '#7b1fa2', keywords: ['purple','violet','lavender','mauve','lilac','plum','indigo'] },
  { label: 'Blue',   swatch: '#1565c0', keywords: ['blue','navy','cobalt','sky','azure','teal','steel','powder blue','denim','royal'] },
  { label: 'Green',  swatch: '#2e7d32', keywords: ['green','olive','mint','sage','forest','lime','khaki','army'] },
  { label: 'Yellow', swatch: '#f9a825', keywords: ['yellow','gold','mustard','amber','lemon','corn'] },
  { label: 'Orange', swatch: '#e65100', keywords: ['orange','peach','apricot','tangerine','coral','rust'] },
  { label: 'Brown',  swatch: '#6d4c41', keywords: ['brown','tan','beige','caramel','chocolate','mocha','nude','khaki','sand'] },
  { label: 'Grey',   swatch: '#616161', keywords: ['grey','gray','silver','charcoal','slate','ash'] },
  { label: 'White',  swatch: '#f5f5f5', keywords: ['white','ivory','cream','snow','off-white','pearl'] },
  { label: 'Black',  swatch: '#212121', keywords: ['black','ebony','onyx','jet'] },
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
  black:'#000000', cloud:'#C1C3C7', desert_rose:'#C48B9F', grey:'#808080',
  lavender:'#E6E6FA', maroon:'#800000', mist:'#C4C3D0', navy:'#000080',
  nude:'#E3BC9A', orange:'#FF7F00', pink:'#FFC0CB', red:'#FF0000',
  rose:'#FF007F', skin:'#FFCBA4', teal:'#008080', white:'#FFFFFF',
  wine:'#722F37',
  gray:'#808080', silver:'#C0C0C0', charcoal:'#36454F', ash:'#B2BEB5',
  ivory:'#FFFFF0', cream:'#FFFDD0', beige:'#F5F5DC', off_white:'#FAF9F6',
  brown:'#964B00', tan:'#D2B48C', nude_beige:'#E3BC9A', caramel:'#C68642',
  crimson:'#DC143C', scarlet:'#FF2400', burgundy:'#800020', maroon_red:'#800000',
  hot_pink:'#FF69B4', blush:'#DE5D83', salmon:'#FA8072', magenta:'#FF00FF',
  coral:'#FF7F50', rust:'#B7410E', amber:'#FFBF00', gold:'#FFD700',
  mustard:'#FFDB58', yellow:'#FFFF00', green:'#008000', olive:'#808000',
  mint:'#98FF98', sage:'#8F9779', forest:'#228B22', emerald:'#50C878',
  turquoise:'#40E0D0', aqua:'#00FFFF', blue:'#0000FF', cobalt:'#0047AB',
  sky:'#87CEEB', denim:'#1560BD', royal:'#4169E1', purple:'#800080',
  violet:'#8B00FF', lilac:'#C8A2C8', plum:'#DDA0DD', indigo:'#4B0082',
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

  /* ── Shared CSS ──────────────────────────────────────────────────────── */
  const css = `
    .gs-fsort-btn { background:none; border:1.5px solid ${HEIRLOOM}44; border-radius:8px; padding:7px 14px; font-size:13px; cursor:pointer; font-family:inherit; color:#444; transition:all .18s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
    .gs-fsort-btn.active,.gs-fsort-btn:hover { border-color:${PRI}; color:${PRI}; background:${PRI}08; }
    .gs-price-quick { border:1.5px solid ${HEIRLOOM}44; border-radius:999px; padding:5px 12px; font-size:12px; cursor:pointer; font-family:inherit; color:${HEIRLOOM}; font-weight:600; background:none; transition:all .18s; }
    .gs-price-quick.active { background:${PRI}; color:#fff; border-color:${PRI}; }
    .gs-color-swatch { width:28px; height:28px; border-radius:50%; cursor:pointer; transition:transform .18s,box-shadow .18s; flex-shrink:0; position:relative; }
    .gs-color-swatch:hover { transform:scale(1.15); }
    .gs-color-swatch.active { box-shadow:0 0 0 2px #fff,0 0 0 4px ${PRI}; transform:scale(1.1); }
    .gs-brand-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:999px; border:1.5px solid; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; background:none; transition:all .18s; }
    .gs-brand-pill.active { background:${PRI}; color:#fff; border-color:${PRI}; }
    .gs-brand-pill:not(.active) { color:#555; border-color:#ddd; }
    .gs-brand-pill:hover:not(.active) { border-color:${PRI}; color:${PRI}; }
    .gs-size-pill { display:inline-flex; align-items:center; justify-content:center; min-width:42px; padding:5px 10px; border-radius:8px; border:1.5px solid #ddd; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; background:none; transition:all .18s; color:#555; }
    .gs-size-pill.active { background:${PRI}; color:#fff; border-color:${PRI}; }
    .gs-size-pill:hover:not(.active) { border-color:${PRI}; color:${PRI}; }
    .gs-active-chip { display:inline-flex; align-items:center; gap:5px; background:${PRI}12; border:1px solid ${PRI}40; color:${PRI}; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; font-family:inherit; }
    .gs-scroll { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
    .gs-scroll::-webkit-scrollbar { display:none; }
    .gs-sec-label { font-size:11px; font-weight:700; color:${PRI}; text-transform:uppercase; letter-spacing:.6px; margin:0 0 10px; font-family:${FONTS}; }
    .gs-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1200; animation:gsFbIn .2s ease; }
    @keyframes gsFbIn { from{opacity:0} to{opacity:1} }
    .gs-drawer { position:fixed; top:0; left:0; height:100%; width:340px; max-width:90vw; background:#fff; z-index:1201; display:flex; flex-direction:column; box-shadow:4px 0 32px rgba(107,15,42,.18); animation:gsFdIn .25s cubic-bezier(.4,0,.2,1); }
    @keyframes gsFdIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
    .gs-drawer-body { flex:1; overflow-y:auto; padding:20px 20px 16px; scrollbar-width:thin; scrollbar-color:${PRI}33 transparent; }
    .gs-drawer-body::-webkit-scrollbar { width:4px; }
    .gs-drawer-body::-webkit-scrollbar-thumb { background:${PRI}33; border-radius:4px; }
    .gs-drawer-footer { padding:14px 20px; border-top:1px solid ${IVORY}; display:flex; gap:10px; background:#fff; flex-shrink:0; }
    .gs-page-btn { min-width:36px; height:36px; border-radius:8px; border:1.5px solid ${HEIRLOOM}; background:#fff; color:${PRI}; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; padding:0 8px; transition:all .18s; }
    .gs-page-btn.active { background:${PRI}; color:#fff; border-color:${PRI}; font-weight:700; }
    .gs-page-arrow { min-width:36px; height:36px; border-radius:8px; border:1.5px solid ${HEIRLOOM}; background:#fff; color:${PRI}; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; transition:all .18s; }
    .gs-page-arrow:disabled { opacity:.4; cursor:default; }
    @keyframes gsSpin { to{transform:rotate(360deg)} }
    @media(max-width:991px){.gs-grid{grid-template-columns:repeat(2,1fr)!important;}}
    @media(max-width:575px){.gs-grid{grid-template-columns:repeat(1,1fr)!important;}}

  `;

  return (
    <>
      <style>{css}</style>
      <Breadcrumb items={breadcrumbs} />

      {/* ══ Sticky toolbar ══ */}
      <div style={{ background: '#fff', borderBottom: `2px solid ${PRI}22`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(107,15,42,.06)' }}>
        <div className="container">

          {/* Row 1 — filter button LEFT · sort pills · count RIGHT */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', flexWrap: 'wrap' }}>

            {/* ── Filter button — LEFT ── */}
            {q && (
              <button
                onClick={() => setFilterOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: filterOpen ? PRI : '#fff', color: filterOpen ? '#fff' : PRI, border: `1.5px solid ${PRI}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT_UI, transition: 'all .18s', flexShrink: 0 }}
              >
                <i className="bi bi-sliders" />
                Filters {activeFilterCount > 0 && (
                  <span style={{ background: filterOpen ? 'rgba(255,255,255,0.3)' : PRI, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* ── Sort pills — centre ── */}
            <div className="gs-scroll" style={{ flex: 1, gap: 6 }}>
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
              <span style={{ fontSize: 13, color: HEIRLOOM, fontFamily: FONT_UI, flexShrink: 0 }}>
                <strong style={{ color: PRI }}>{totalCards}</strong> product{totalCards !== 1 ? 's' : ''} for <em>"{q}"</em>
              </span>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 10, borderTop: `1px solid ${IVORY}`, paddingTop: 8 }}>
              {filters.colorFamilies.map(fam => {
                const famData = COLOR_FAMILIES.find(f => f.label === fam);
                return (
                  <span key={fam} className="gs-active-chip">
                    {famData && <span style={{ width: 10, height: 10, borderRadius: '50%', background: famData.swatch, display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }} />}
                    {fam}
                    <i className="bi bi-x" style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => toggleColorFamily(fam)} />
                  </span>
                );
              })}
              {filters.brandIds.map(id => {
                const brand = allBrands.find((b: any) => b.brandId === id);
                return brand ? (
                  <span key={id} className="gs-active-chip">
                    {brand.brandName}
                    <i className="bi bi-x" style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => toggleBrand(id)} />
                  </span>
                ) : null;
              })}
              {(filters.priceMin != null || filters.priceMax != null) && (
                <span className="gs-active-chip">
                  ₹{filters.priceMin ?? 0} – ₹{filters.priceMax ?? '∞'}
                  <i className="bi bi-x" style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => setFilters(f => ({ ...f, priceMin: null, priceMax: null }))} />
                </span>
              )}
              {filters.sizeIds.length > 0 && (
                <span className="gs-active-chip">
                  {filters.sizeIds.length} size{filters.sizeIds.length > 1 ? 's' : ''}
                  <i className="bi bi-x" style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => setFilters(f => ({ ...f, sizeIds: [] }))} />
                </span>
              )}
              {filters.cupSizeIds.length > 0 && (
                <span className="gs-active-chip">
                  {filters.cupSizeIds.length} cup size{filters.cupSizeIds.length > 1 ? 's' : ''}
                  <i className="bi bi-x" style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => setFilters(f => ({ ...f, cupSizeIds: [] }))} />
                </span>
              )}
              <button
                onClick={clearAllFilters}
                style={{ background: 'none', border: 'none', color: HEIRLOOM, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT_UI, padding: '4px 6px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: `2px solid ${PRI}18`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-sliders" style={{ color: PRI, fontSize: 18 }} />
                <span style={{ fontFamily: FONTS, fontWeight: 700, fontSize: 17, color: PRI }}>Filters</span>
                {activeFilterCount > 0 && (
                  <span style={{ background: PRI, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setFilterOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRI, fontSize: 22, lineHeight: 1, padding: 4 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="gs-drawer-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ─ 1. COLOR ─ */}
                <div>
                  <p className="gs-sec-label">Color</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    {COLOR_FAMILIES.map(fam => {
                      if (colorFamilyMap.size > 0 && !colorFamilyMap.has(fam.label)) return null;
                      const selected = filters.colorFamilies.includes(fam.label);
                      return (
                        <div key={fam.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => toggleColorFamily(fam.label)}>
                          <div
                            className={`gs-color-swatch${selected ? ' active' : ''}`}
                            style={{ background: fam.swatch, border: selected ? `2.5px solid ${PRI}` : '2.5px solid rgba(0,0,0,.1)' }}
                            title={fam.label}
                          >
                            {selected && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="bi bi-check" style={{ color: ['White', 'Yellow'].includes(fam.label) ? '#333' : '#fff', fontSize: 13, fontWeight: 900 }} />
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 10, color: selected ? PRI : '#888', fontWeight: selected ? 700 : 400, fontFamily: FONT_UI }}>{fam.label}</span>
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
                        <div style={{ fontSize: 11, color: HEIRLOOM, fontWeight: 600, marginBottom: 6 }}>Band / Alpha</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: allCupSizes.length > 0 ? 14 : 0 }}>
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
                        <div style={{ fontSize: 11, color: HEIRLOOM, fontWeight: 600, marginBottom: 6 }}>Cup Size</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                    style={{ width: '100%', padding: '8px 12px', border: `1.5px solid ${HEIRLOOM}55`, borderRadius: 8, marginBottom: 10, fontSize: 13, outline: 'none', fontFamily: FONT_UI, boxSizing: 'border-box', background: '#fafafa' }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {filteredBrands.map((brand: any) => {
                      const active = filters.brandIds.includes(brand.brandId);
                      return (
                        <button key={brand.brandId} className={`gs-brand-pill${active ? ' active' : ''}`} onClick={() => toggleBrand(brand.brandId)}>
                          {active && <i className="bi bi-check" style={{ fontSize: 11 }} />}
                          {brand.brandName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 4. CATEGORY ─ */}
                <div>
                  <p className="gs-sec-label">Category</p>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {categories.map((cat: any) => {
                      const checked = filters.categoryIds.includes(cat.categoryId);
                      return (
                        <label key={cat.categoryId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: 'pointer', borderRadius: 8, background: checked ? `${PRI}10` : 'transparent', transition: 'background .15s' }}>
                          <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${checked ? PRI : '#ccc'}`, background: checked ? PRI : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                            {checked && <i className="bi bi-check" style={{ color: '#fff', fontSize: 11 }} />}
                          </div>
                          <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat.categoryId)} style={{ display: 'none' }} />
                          <span style={{ fontSize: 13, color: checked ? PRI : '#444', fontWeight: checked ? 600 : 400 }}>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ─ 5. PRICE RANGE ─ */}
                <div>
                  <p className="gs-sec-label">Price Range</p>
                  <div className="gs-scroll" style={{ marginBottom: 12 }}>
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, border: `1.5px solid ${HEIRLOOM}55`, borderRadius: 8, display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#fafafa' }}>
                      <span style={{ padding: '0 8px', color: PRI, fontSize: 14, fontWeight: 600 }}>₹</span>
                      <input type="number" placeholder="Min" value={filters.priceMin ?? ''} min={0}
                        onChange={e => setFilters(f => ({ ...f, priceMin: e.target.value !== '' ? Number(e.target.value) : null }))}
                        onKeyDown={e => { if (e.key === 'Enter') setPage(1); }}
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 6px', fontSize: 13, background: 'transparent', fontFamily: FONT_UI }} />
                    </div>
                    <span style={{ color: HEIRLOOM, fontWeight: 600 }}>—</span>
                    <div style={{ flex: 1, border: `1.5px solid ${HEIRLOOM}55`, borderRadius: 8, display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#fafafa' }}>
                      <span style={{ padding: '0 8px', color: PRI, fontSize: 14, fontWeight: 600 }}>₹</span>
                      <input type="number" placeholder="Max" value={filters.priceMax ?? ''} min={0}
                        onChange={e => setFilters(f => ({ ...f, priceMax: e.target.value !== '' ? Number(e.target.value) : null }))}
                        onKeyDown={e => { if (e.key === 'Enter') setPage(1); }}
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 6px', fontSize: 13, background: 'transparent', fontFamily: FONT_UI }} />
                    </div>
                    <button onClick={() => setPage(1)} style={{ background: PRI, color: '#fff', border: 'none', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FONT_UI }}>
                      Go
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="gs-drawer-footer">
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} style={{ flex: 1, padding: '10px 0', border: `1.5px solid ${PRI}`, background: '#fff', color: PRI, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_UI }}>
                  Clear All
                </button>
              )}
              <button onClick={() => setFilterOpen(false)} style={{ flex: 2, padding: '10px 0', background: PRI, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT_UI }}>
                Show {allGrouped.length} Products
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ Page body ══ */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 64, fontFamily: FONT_UI, minHeight: '60vh' }}>

        {/* Color search badge */}
        {q && colorQuery && anchorHex && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: anchorHex, display: 'inline-block', border: '2px solid rgba(0,0,0,.15)', flexShrink: 0 }} />
            <span style={{ background: IVORY, color: PRI, padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: `1px solid ${HEIRLOOM}60` }}>
              Showing all {q.toLowerCase()} shades
            </span>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && q && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${IVORY}`, borderTopColor: PRI, borderRadius: '50%', animation: 'gsSpin .8s linear infinite' }} />
          </div>
        )}

        {/* Landing state — no query */}
        {!q && !isLoading && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <i className="bi bi-search" style={{ fontSize: 64, color: HEIRLOOM, opacity: .35, display: 'block', marginBottom: 20 }} />
            <h3 style={{ fontFamily: FONTS, fontWeight: 700, color: PRI, marginBottom: 16 }}>Search TWAM Collection</h3>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Bras', 'Panties', 'Sports Bra', 'Leakproof', 'Black', 'Wine', 'Pink', 'Navy', 'Nude'].map(s => (
                <button key={s} onClick={() => setSearchParams({ q: s })}
                  style={{ background: IVORY, color: PRI, border: `1.5px solid ${PRI}40`, padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontFamily: FONT_UI }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PRI; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = IVORY; (e.currentTarget as HTMLElement).style.color = PRI; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {q && !isLoading && allGrouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <i className="bi bi-emoji-frown" style={{ fontSize: 56, color: HEIRLOOM, opacity: .4, display: 'block', marginBottom: 16 }} />
            <h3 style={{ fontFamily: FONTS, color: PRI, marginBottom: 8 }}>No results for "{q}"</h3>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={() => setSearchParams({})}
                style={{ background: IVORY, color: PRI, border: `1.5px solid ${HEIRLOOM}`, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: FONT_UI }}>
                Clear
              </button>
              <button onClick={() => navigate('/user-products/product-list')}
                style={{ background: PRI, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: FONT_UI, fontWeight: 600 }}>
                Browse All
              </button>
            </div>
          </div>
        )}

        {/* ── Product grid using shared ProductCard ── */}
        {!isLoading && displayed.length > 0 && (
          <>
            <div className="gs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              {displayed.map((product: any) => (
                <div key={`${product.productId}-${product.productVariantId}`}>
                  <ProductCard product={product} onQuickShop={setQuickShopId} showColors={true} />
                </div>
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '32px 0 8px', flexWrap: 'wrap' }}>
                <button disabled={page === 1} onClick={() => goToPage(page - 1)} className="gs-page-arrow" aria-label="Previous page">
                  <i className="bi bi-chevron-left" />
                </button>
                {pagesArr.map((p, i) =>
                  p === '...'
                    ? <span key={`el-${i}`} style={{ padding: '0 4px', color: HEIRLOOM, userSelect: 'none' }}>…</span>
                    : (
                      <button key={p} onClick={() => goToPage(p as number)} className={`gs-page-btn${page === p ? ' active' : ''}`}>
                        {p}
                      </button>
                    )
                )}
                <button disabled={page === totalPages} onClick={() => goToPage(page + 1)} className="gs-page-arrow" aria-label="Next page">
                  <i className="bi bi-chevron-right" />
                </button>
                <span style={{ fontSize: 12, color: HEIRLOOM, marginLeft: 8, fontFamily: FONT_UI }}>
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