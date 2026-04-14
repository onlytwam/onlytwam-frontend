import { useMemo, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

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

function SortSidebar({
  currentSort,
  onSortChange,
  onClose,
}: {
  currentSort: string;
  onSortChange: (v: string) => void;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toolbar = document.querySelector(
      ".product-toolbar",
    ) as HTMLElement | null;
    const drawer = drawerRef.current;
    if (toolbar && drawer) {
      const bottom = Math.round(toolbar.getBoundingClientRect().bottom);
      drawer.style.top = `${bottom}px`;
      drawer.style.height = `calc(100% - ${bottom}px)`;
    }
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !t.closest(".sort-drawer") &&
        !t.closest(".product-toolbar__sort-btn")
      )
        onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      <div className="sort-backdrop" onClick={onClose} />
      <div className="sort-drawer" ref={drawerRef}>
        <div className="sort-drawer__header">
          <span className="sort-drawer__title">Sort By</span>
          <button
            className="sort-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`sort-drawer__option${currentSort === opt.value ? " active" : ""}`}
            onClick={() => {
              onSortChange(opt.value);
              onClose();
            }}
          >
            {opt.label}
            {currentSort === opt.value && (
              <i className="bi bi-check2 sort-drawer__check" />
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

export default function ProductToolbar({
  productCount,
  appliedFilterCount = 0,
  onFilterClick,
  sortOption,
  onSortChange,
  onQuickPrice,
  activeQuickPrice,
}: ProductToolbarProps) {
  const isMobile = useIsMobile();
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = useMemo(() => {
    return SORT_OPTIONS.some((opt) => opt.value === sortOption)
      ? sortOption
      : "";
  }, [sortOption]);

  useEffect(() => {
    if (!isMobile) return;
    if (sortOpen) {
      (window as any).__drawerOpen = true;
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
    } else {
      (window as any).__drawerOpen = false;
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [sortOpen, isMobile]);

  // Close sort when filter opens
  useEffect(() => {
    const fn = () => setSortOpen(false);
    window.addEventListener("filter-opened", fn);
    return () => window.removeEventListener("filter-opened", fn);
  }, []);

  return (
    <div className="product-toolbar">
      <div className="container product-toolbar__inner">
        <div className="product-toolbar__left">
          <button
            type="button"
            onClick={() => {
              setSortOpen(false);
              onFilterClick();
            }}
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
            <span className="product-toolbar__count-number">
              {productCount}
            </span>
            <span className="product-toolbar__count-label">
              {productCount === 1 ? "Product" : "Products"}
            </span>
          </div>

          {!isMobile ? (
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
          ) : (
            <button
              type="button"
              className={`product-toolbar__sort-btn${sortOpen ? " active" : ""}`}
              onClick={() => {
                // Close filter if open, then toggle sort
                window.dispatchEvent(new Event("close-filter"));
                setSortOpen((o) => !o);
              }}
            >
              SORT BY
            </button>
          )}
        </div>
      </div>

      {isMobile && sortOpen && (
        <SortSidebar
          currentSort={currentSort}
          onSortChange={onSortChange}
          onClose={() => setSortOpen(false)}
        />
      )}
    </div>
  );
}
