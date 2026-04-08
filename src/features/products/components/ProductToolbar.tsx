import { useMemo } from "react";

interface ProductToolbarProps {
  productCount: number;
  appliedFilterCount?: number;
  onFilterClick: () => void;
  sortOption: string;
  onSortChange: (value: string) => void;
  onQuickPrice: (min: number | null, max: number | null) => void;
  activeQuickPrice?: { min: number | null; max: number | null } | null;
}

const SORT_OPTIONS = [
  { label: "None", value: "" },
  { label: "Top Rated", value: "rating" },
  { label: "Latest", value: "latest" },
  { label: "A to Z", value: "az" },
  { label: "Z to A", value: "za" },
  { label: "Price: Low to High", value: "low" },
  { label: "Price: High to Low", value: "high" },
];

const QUICK_PRICES = [
  { label: "Rs.0-1k", min: null, max: 1000 },
  { label: "Rs.0-1.5k", min: null, max: 1500 },
];

export default function ProductToolbar({
  productCount,
  appliedFilterCount = 0,
  onFilterClick,
  sortOption,
  onSortChange,
  onQuickPrice,
  activeQuickPrice,
}: ProductToolbarProps) {
  const currentSort = useMemo(() => {
    return SORT_OPTIONS.some((opt) => opt.value === sortOption) ? sortOption : "";
  }, [sortOption]);

  return (
    <div className="product-toolbar">
      <div className="container product-toolbar__inner">
        <div className="product-toolbar__left">
          <button
            type="button"
            onClick={onFilterClick}
            className="product-toolbar__filter-button s-globalsearch-fd1c89"
          >
            <i className="bi bi-sliders" />
            Filters
            {appliedFilterCount > 0 && (
              <span className="product-toolbar__filter-badge">
                {appliedFilterCount}
              </span>
            )}
          </button>

          <div className="gs-scroll product-toolbar__quick-prices">
            {QUICK_PRICES.map((qp) => {
              const isActive =
                activeQuickPrice?.min === qp.min &&
                activeQuickPrice?.max === qp.max;
              return (
                <button
                  type="button"
                  key={qp.label}
                  className={`gs-price-quick${isActive ? " active" : ""}`}
                  onClick={() =>
                    onQuickPrice(
                      isActive ? null : qp.min,
                      isActive ? null : qp.max,
                    )
                  }
                >
                  {qp.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="product-toolbar__right">
          <div className="product-toolbar__count" aria-live="polite">
            <span className="product-toolbar__count-number">{productCount}</span>
            <span className="product-toolbar__count-label">
              {productCount === 1 ? "Product" : "Products"}
            </span>
          </div>

          <label className="product-toolbar__sort">
            <span className="product-toolbar__sort-label">Sort By</span>
            <span
              className="product-toolbar__sort-divider"
              aria-hidden="true"
            />
            <span className="product-toolbar__sort-control">
              <select
                value={currentSort}
                onChange={(e) => onSortChange(e.target.value)}
                aria-label="Sort products"
                className="product-toolbar__sort-select"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
