import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Approved:                         { bg: "var(--ivory)", color: "var(--brand)" },
  Pending:                          { bg: "var(--ivory)", color: "var(--brand)" },
  Draft:                            { bg: "var(--ivory)", color: "var(--heirloom)" },
  Rejected:                         { bg: "#fff0f0",      color: "#c0392b" },
  "Submitted To Inventory Manager": { bg: "var(--ivory)", color: "var(--brand)" },
  "Submitted To Product Manager":   { bg: "var(--ivory)", color: "var(--brand)" },
  Created:                          { bg: "#f0fff4",      color: "#27ae60" },
  Modified:                         { bg: "#fffbf0",      color: "#e67e22" },
};

const STATUS_OPTIONS = [
  "All", "Approved", "Pending", "Draft", "Created",
  "Modified", "Rejected", "Submitted To Inventory Manager", "Submitted To Product Manager",
];
const PAGE_SIZE = 15;

export default function AdminProducts() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page,          setPage]    = useState(1);
  const [statusFilter,  setStatus]  = useState("All");
  const [confirmDelete, setConfirm] = useState<any>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const buildParams = useCallback(() => {
    const filters: any[] = [];
    if (search.trim())
      filters.push({ property: "QuickSearch", comparison: "contains", value: search.trim() });
    if (statusFilter !== "All")
      filters.push({ property: "State", comparison: "==", value: statusFilter });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index":      page,
      "Page.Size":       PAGE_SIZE,
      "Order.Property":  "ModifiedDate",
      // ✅ FIX 1: was boolean false — must be a string
      "Order.Ascending": "false",
    };
  }, [search, page, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search, page, statusFilter],
    queryFn:  () => api.get("/Products/", { params: buildParams() }).then((r) => r.data),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/Products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  // ✅ FIX 2: Pass the full product object so PUT doesn't wipe other fields
  const updateState = useMutation({
    mutationFn: ({ id, state, product }: { id: number; state: string; product: any }) =>
      api.put(`/Products/${id}`, { ...product, state }),
    onSuccess: () => {
      toast.success("Status updated!");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const products = data?.list ?? [];
  const total    = data?.count ?? 0;
  const pages    = Math.ceil(total / PAGE_SIZE) || 1;

  const badge = (state: string) => {
    const s = STATUS_STYLE[state] ?? { bg: "var(--ivory)", color: "var(--heirloom)" };
    return (
      <span
        className="s-adminorders-3cbcde s-adminproduct-69e3b0"
        style={{ background: s.bg, color: s.color, fontWeight: 600, borderRadius: 20, padding: "3px 10px", fontSize: 12 }}
      >
        {state || "Draft"}
      </span>
    );
  };

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Products</h2>
          <p className="s-adminblog-1c2c10">
            {total} product{total !== 1 ? "s" : ""}
            {(search || statusFilter !== "All") ? " (filtered)" : " total"}
          </p>
        </div>
        <div className="s-adminproduct-0f6417">
          <button onClick={() => navigate("/admin/products/new")} className="s-adminproduct-1f0204">
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search products…"
            className="s-adminproduct-def428"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="s-adminproduct-3cdc6b"
          >
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="s-adminbrands-a637bc">
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {["Image", "Name", "Code", "Brand", "Category", "Status", "Actions"].map((h) => (
                  <th key={h} className="s-admininvento-947fb4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="s-adminorders-652ef8">
                      <div className="s-adminorders-ac15d0" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="s-admininvento-2925c8">
                    <i className="bi bi-box-seam s-adminorders-9fdb4f" />
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((p: any) => (
                  <tr
                    key={p.productId}
                    className="s-adminbrands-59d787"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ivory)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="s-adminbrands-7dcd2c">
                      {/* ✅ FIX 3: Added more image field name fallbacks */}
                      {(p.imageUrl || p.image || p.selectedImage || p.thumbnail) ? (
                        <img
                          src={p.imageUrl || p.image || p.selectedImage || p.thumbnail}
                          alt={p.name}
                          className="s-adminproduct-b1c1e9"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, background: "var(--ivory)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="bi bi-image" style={{ color: "var(--heirloom)", fontSize: 18 }} />
                        </div>
                      )}
                    </td>
                    <td className="s-adminbrands-7dcd2c">
                      <div
                        onClick={() => navigate(`/admin/products/${p.productId}`)}
                        className="s-adminproduct-48c60a"
                        style={{ cursor: "pointer" }}
                      >
                        {p.name}
                      </div>
                      <div className="s-adminproduct-ee9064">{p.description}</div>
                    </td>
                    <td className="s-adminproduct-4d12db">{p.productCode || "—"}</td>
                    {/* ✅ FIX 4: Guard against p.brand being a plain object */}
                    <td className="s-adminproduct-d86977">
                      {p.brandName || p.brand?.name || (typeof p.brand === "string" ? p.brand : null) || "—"}
                    </td>
                    <td className="s-adminproduct-d86977">{p.categoryName || "—"}</td>
                    <td className="s-adminbrands-7dcd2c">{badge(p.state)}</td>
                    <td className="s-adminbrands-7dcd2c">
                      <div className="s-adminproduct-6209be">
                        <button
                          onClick={() => navigate(`/admin/products/${p.productId}`)}
                          className="s-adminproduct-bec64d"
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        {p.state !== "Approved" && (
                          <button
                            // ✅ FIX 2 (cont): pass full product to avoid wiping fields
                            onClick={() => updateState.mutate({ id: p.productId, state: "Approved", product: p })}
                            disabled={updateState.isPending}
                            className="s-adminproduct-d37b04"
                            title="Approve"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => setConfirm(p)}
                          className="s-adminproduct-d37b04"
                          title="Delete"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="s-adminorders-0fe0c2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="s-adminproduct-26d310">
              ← Prev
            </button>
            <span className="s-adminorders-caf6f2">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="s-adminproduct-26d310">
              Next →
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="s-adminproduct-d9e7c0" onClick={() => setConfirm(null)}>
          <div className="s-adminblog-69ab70" onClick={(e) => e.stopPropagation()}>
            <h3 className="s-adminproduct-23729b">Delete Product</h3>
            <p className="s-adminproduct-655c7d">
              Delete <strong>"{confirmDelete.name}"</strong>? This cannot be undone.
            </p>
            <div className="s-adminbrands-bccf37">
              <button
                // ✅ FIX 5: Close modal immediately, don't wait for onSuccess
                onClick={() => {
                  setConfirm(null);
                  deleteProduct.mutate(confirmDelete.productId);
                }}
                disabled={deleteProduct.isPending}
                className="s-adminproduct-885bd5"
              >
                {deleteProduct.isPending ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setConfirm(null)} className="s-adminproduct-c641e3">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
