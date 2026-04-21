import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { formatPrice } from "@/shared/utils/helpers";

const PAGE_SIZE = 15; // match AdminProducts PAGE_SIZE

const STATUS_OPTIONS = [
  "All",
  "Created",
  "Approved",
  "Pending",
  "Draft",
  "Modified",
  "Rejected",
  "Submitted To Inventory Manager",
  "Submitted To Product Manager",
];


const STOCK_OPTIONS = [
  { label: "All Stock",    value: "all" },
  { label: "In Stock",     value: "in"  },
  { label: "Low Stock",    value: "low" },
  { label: "Out of Stock", value: "out" },
];

// Mirrors STATUS_STYLE from AdminProducts exactly
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Approved:                         { bg: "var(--ivory)", color: "var(--brand)"    },
  Pending:                          { bg: "var(--ivory)", color: "var(--brand)"    },
  Draft:                            { bg: "var(--ivory)", color: "var(--heirloom)" },
  Rejected:                         { bg: "#fff0f0",      color: "#c0392b"         },
  "Submitted To Inventory Manager": { bg: "var(--ivory)", color: "var(--brand)"    },
  "Submitted To Product Manager":   { bg: "var(--ivory)", color: "var(--brand)"    },
  Created:                          { bg: "#f0fff4",      color: "#27ae60"         },
  Modified:                         { bg: "#fffbf0",      color: "#e67e22"         },
};

export default function AdminInventory() {
  const [page,         setPage]        = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [stockFilter,  setStockFilter]  = useState("all");

  // Mirrors buildParams() from AdminProducts exactly
  const buildParams = useCallback(() => {
    const filters: any[] = [];

    if (statusFilter !== "All")
      filters.push({ property: "State", comparison: "==", value: statusFilter });

    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index":      page,       // 1-based — same as AdminProducts
      "Page.Size":       PAGE_SIZE,
      "Order.Property":  "ModifiedDate",
      "Order.Ascending": false,
    };
  }, [page, statusFilter]);

  // Mirrors useQuery pattern from AdminProducts exactly
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-inventory", page, statusFilter],
    queryFn:  () =>
      api
        .get("/ProductVariantDetail/UserProductVariantDetail", { params: buildParams() })
        .then((r) => r.data),
  });

  // Same keys as AdminProducts: data?.list, data?.count
  const allItems: any[] = data?.list  ?? [];
  const total:    number = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side stock filter on top of paginated server data
  const items = allItems.filter((i) => {
    const qty = i.stockQuantity ?? i.availableQuantity ?? 0;
    if (stockFilter === "out") return qty === 0;
    if (stockFilter === "low") return qty > 0 && qty < 10;
    if (stockFilter === "in")  return qty >= 10;
    return true;
  });

  const lowStock   = allItems.filter((i) => { const q = i.stockQuantity ?? i.availableQuantity ?? 0; return q > 0 && q < 10; }).length;
  const outOfStock = allItems.filter((i) => (i.stockQuantity ?? i.availableQuantity ?? 0) === 0).length;
  const inStock    = allItems.length - lowStock - outOfStock;

  const stockLevel = (qty: number) => {
    if (qty === 0) return { label: "Out of Stock", bg: "#fff0f0", color: "#c0392b" };
    if (qty < 10)  return { label: "Low Stock",    bg: "#fff8e1", color: "#e67e22" };
    return               { label: "In Stock",      bg: "#f0fff4", color: "#27ae60" };
  };

  // Same badge style as AdminProducts
  const stateBadge = (state: string) => {
    const s = STATUS_STYLE[state] ?? { bg: "var(--ivory)", color: "var(--heirloom)" };
    return (
      <span
        className="s-adminorders-3cbcde s-adminproduct-69e3b0"
        style={{
          background: s.bg,
          color: s.color,
          fontWeight: 600,
          borderRadius: 20,
          padding: "3px 10px",
          fontSize: 12,
        }}
      >
        {state || "—"}
      </span>
    );
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1); // reset page on filter change
  };

  return (
    <div>
      <div className="s-adminblog-19fd7a">
        <h2 className="s-adminblog-91c675">Inventory Analytics</h2>
        <p className="s-adminblog-1c2c10">
          {total} variant{total !== 1 ? "s" : ""}
          {statusFilter !== "All" ? " (filtered)" : " total"}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="s-admininvento-8801e6">
        {[
          { title: "Total Variants", value: total,      icon: "bi-box-seam",             color: "var(--brand)" },
          { title: "Low Stock",      value: lowStock,   icon: "bi-exclamation-triangle",  color: "#e67e22"      },
          { title: "Out of Stock",   value: outOfStock, icon: "bi-x-circle",              color: "#c0392b"      },
          { title: "In Stock",       value: inStock,    icon: "bi-check-circle",          color: "#27ae60"      },
        ].map((card) => (
          <div key={card.title} className="s-admininvento-3f01df">
            <div className="s-admininvento-69f9d2">
              <div>
                <p className="s-admininvento-b153ec">{card.title}</p>
                <h3 className="s-admininvento-99662a">{card.value}</h3>
              </div>
              <i
                className={`bi ${card.icon} s-admindashboa-e17804 s-admininvento-85152d`}
                style={{ color: card.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="s-adminbrands-a637bc">
        {/* Header + Filters */}
        <div className="s-admininvento-19cca5">
          <h3 className="s-adminblog-ffb607">Product Variants — Stock Levels</h3>
          <div className="d-flex align-items-center gap-3">
            <span className="s-adminnewslet-f01220">
              Showing {items.length} of {total}
            </span>

            {/* Status filter — matches AdminProducts STATUS_OPTIONS */}
            <select
              className="form-select form-select-sm"
              style={{ width: "auto", minWidth: 140 }}
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Stock level filter — client-side */}
            <select
              className="form-select form-select-sm"
              style={{ width: "auto", minWidth: 130 }}
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              {STOCK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {["Product", "Variant", "Size", "MRP", "Final Price", "Stock", "Stock Status", "State"].map((h) => (
                  <th key={h} className="s-admininvento-947fb4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <tr>
                  <td colSpan={8} className="s-admininvento-06b8df">
                    <span className="text-danger">
                      <i className="bi bi-exclamation-circle me-2" />
                      Failed to load inventory. Please try again.
                    </span>
                  </td>
                </tr>
              ) : isLoading ? (
                // Mirrors AdminProducts skeleton loader
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="s-adminorders-652ef8">
                      <div className="s-adminorders-ac15d0" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="s-admininvento-2925c8">
                    <i className="bi bi-box-seam s-adminorders-9fdb4f" />
                    No inventory data found.
                  </td>
                </tr>
              ) : (
                items.map((item: any) => {
                  const qty    = item.stockQuantity ?? item.availableQuantity ?? 0;
                  const sl     = stockLevel(qty);
                  const rowKey =
                    item.productVariantDetailId ??
                    item.variantId ??
                    `${item.productName}-${item.variantName}-${item.sizeLabel}`;

                  return (
                    <tr
                      key={rowKey}
                      className="s-adminbrands-59d787"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ivory)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="s-admindashboa-004ec1">
                        {item.productName || item.name || "—"}
                      </td>
                      <td className="s-admindashboa-76859f">
                        {item.variantName || item.color || "—"}
                      </td>
                      <td className="s-admindashboa-76859f">
                        {item.sizeLabel || item.size || "—"}
                      </td>
                      <td className="s-admindashboa-76859f">
                        {item.mrpPrice   ? formatPrice(item.mrpPrice)   : "—"}
                      </td>
                      <td className="s-admindashboa-004ec1">
                        {item.finalPrice ? formatPrice(item.finalPrice) : "—"}
                      </td>
                      <td className="s-admininvento-192c9d s-admininvento-14b4f2">
                        {qty}
                      </td>
                      <td className="s-admindashboa-f5f90c">
                        <span
                          className="s-admindashboa-dbacab s-admininvento-3e3854"
                          style={{ background: sl.bg, color: sl.color }}
                        >
                          {sl.label}
                        </span>
                      </td>
                      <td className="s-admindashboa-f5f90c">
                        {stateBadge(item.state ?? item.status ?? "")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — mirrors AdminProducts exactly */}
        {totalPages > 1 && (
          <div className="s-adminorders-0fe0c2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="s-adminproduct-26d310"
            >
              ← Prev
            </button>

            {/* Page number buttons with ellipsis */}
            <div className="d-flex gap-2 align-items-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`ellipsis-${idx}`} className="s-adminorders-caf6f2">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`s-adminproduct-26d310 ${p === page ? "btn-dark" : ""}`}
                      style={p === page ? { background: "var(--brand)", color: "#fff", border: "none" } : {}}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <span className="s-adminorders-caf6f2">Page {page} of {totalPages}</span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="s-adminproduct-26d310"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
