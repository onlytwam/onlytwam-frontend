import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 15;

/** Returns all reasons why a product is hidden from customers. */
function getInactiveReasons(p: any): string[] {
  const reasons: string[] = [];
  if (p.brandDeletedInd) reasons.push("Brand has been deleted");
  else if (p.brandIsActive === false) reasons.push("Brand is hidden");
  if (p.categoryDeletedInd) reasons.push("Category has been deleted");
  else if (p.categoryIsActive === false) reasons.push("Category is inactive");
  return reasons;
}

// ── Active / Inactive pill shown in the Status column ────────────────────────
function StatusPill({
  product,
  openId,
  setOpenId,
  popoverRef,
}: {
  product: any;
  openId: number | null;
  setOpenId: (id: number | null) => void;
  popoverRef: React.RefObject<HTMLDivElement>;
}) {
  const reasons = getInactiveReasons(product);
  const isInactive = reasons.length > 0;
  const isOpen = openId === product.productId;

  if (!isInactive) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 700,
          background: "#e8f5e9",
          color: "#2e7d32",
          borderRadius: 20,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#43a047",
            display: "inline-block",
          }}
        />
        Active
      </span>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpenId(isOpen ? null : product.productId)}
        title="Click to see why this product is hidden from customers"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 700,
          background: "#fdecea",
          color: "#c62828",
          border: "1.5px solid #ef9a9a",
          borderRadius: 20,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#e53935",
            display: "inline-block",
          }}
        />
        Inactive
        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 9, marginLeft: 2 }}
        />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #ef9a9a",
            borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
            padding: "14px 16px",
            minWidth: 240,
          }}
        >
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: -7,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 12,
              height: 12,
              background: "#fff",
              borderTop: "1px solid #ef9a9a",
              borderLeft: "1px solid #ef9a9a",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              fontWeight: 700,
              fontSize: 12,
              color: "#b71c1c",
            }}
          >
            <i className="bi bi-eye-slash-fill" />
            Hidden from customers
          </div>

          <div style={{ fontSize: 11, color: "#777", marginBottom: 10 }}>
            This product is not visible because:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {reasons.map((reason) => (
              <div
                key={reason}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#c62828",
                }}
              >
                <i
                  className="bi bi-x-circle-fill"
                  style={{ fontSize: 13, flexShrink: 0 }}
                />
                {reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirm] = useState<any>(null);

  // Which product's status popover is open
  const [openPopover, setOpenPopover] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpenPopover(null);
      }
    }
    if (openPopover !== null)
      document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openPopover]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const buildParams = useCallback(() => {
    const filters: any[] = [];
    if (search.trim())
      filters.push({
        property: "QuickSearch",
        comparison: "contains",
        value: search.trim(),
      });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index": page,
      "Page.Size": PAGE_SIZE,
      "Order.Property": "ModifiedDate",
      "Order.Ascending": "false",
    };
  }, [search, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search, page],
    queryFn: () =>
      api
        .get("/Products/", { params: { ...buildParams(), adminView: true } })
        .then((r) => r.data),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/Products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const products = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div>
      {/* ── Header ── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Products</h2>
          <p className="s-adminblog-1c2c10">
            {total} product{total !== 1 ? "s" : ""}
            {search ? " (filtered)" : " total"}
          </p>
        </div>
        <div className="s-adminproduct-0f6417">
          <button
            onClick={() => navigate("/admin/products/new")}
            className="s-adminproduct-1f0204"
          >
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search products…"
            className="s-adminproduct-def428"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="s-adminbrands-a637bc">
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                {[
                  "Image",
                  "Name",
                  "Code",
                  "Brand",
                  "Category",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="s-admininvento-947fb4">
                    {h}
                  </th>
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--ivory)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Image */}
                    <td className="s-adminbrands-7dcd2c">
                      {p.imageUrl ||
                      p.image ||
                      p.selectedImage ||
                      p.thumbnail ? (
                        <img
                          src={
                            p.imageUrl ||
                            p.image ||
                            p.selectedImage ||
                            p.thumbnail
                          }
                          alt={p.name}
                          className="s-adminproduct-b1c1e9"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "0";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            background: "var(--ivory)",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="bi bi-image"
                            style={{ color: "var(--heirloom)", fontSize: 18 }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="s-adminbrands-7dcd2c">
                      <div
                        onClick={() =>
                          navigate(`/admin/products/${p.productId}`)
                        }
                        className="s-adminproduct-48c60a"
                        style={{ cursor: "pointer" }}
                      >
                        {p.name}
                      </div>
                      <div className="s-adminproduct-ee9064">
                        {p.description}
                      </div>
                    </td>

                    {/* Code */}
                    <td className="s-adminproduct-4d12db">
                      {p.productCode || "—"}
                    </td>

                    {/* Brand */}
                    <td className="s-adminproduct-d86977">
                      <span>
                        {p.brandName ||
                          p.brand?.name ||
                          (typeof p.brand === "string" ? p.brand : null) ||
                          "—"}
                      </span>
                      {p.brandDeletedInd && (
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: 10,
                            background: "#fdecea",
                            color: "#c62828",
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontWeight: 700,
                          }}
                        >
                          DELETED
                        </span>
                      )}
                      {!p.brandDeletedInd && p.brandIsActive === false && (
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: 10,
                            background: "#fff8e1",
                            color: "#e65100",
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontWeight: 700,
                          }}
                        >
                          HIDDEN
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="s-adminproduct-d86977">
                      <span>{p.categoryName || "—"}</span>
                      {p.categoryDeletedInd && (
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: 10,
                            background: "#fdecea",
                            color: "#c62828",
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontWeight: 700,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          DELETED
                        </span>
                      )}
                      {!p.categoryDeletedInd &&
                        p.categoryIsActive === false && (
                          <span
                            style={{
                              marginLeft: 5,
                              fontSize: 10,
                              background: "#fff8e1",
                              color: "#e65100",
                              padding: "1px 5px",
                              borderRadius: 4,
                              fontWeight: 700,
                              textTransform: "uppercase" as const,
                              letterSpacing: "0.04em",
                              whiteSpace: "nowrap" as const,
                            }}
                          >
                            INACTIVE
                          </span>
                        )}
                    </td>

                    {/* ── Status column: Active or Inactive (clickable) ── */}
                    <td className="s-adminbrands-7dcd2c">
                      <StatusPill
                        product={p}
                        openId={openPopover}
                        setOpenId={setOpenPopover}
                        popoverRef={popoverRef}
                      />
                    </td>

                    {/* Actions */}
                    <td className="s-adminbrands-7dcd2c">
                      <div className="s-adminproduct-6209be">
                        <button
                          onClick={() =>
                            navigate(`/admin/products/${p.productId}`)
                          }
                          className="s-adminproduct-bec64d"
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
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

        {/* Pagination */}
        {pages > 1 && (
          <div className="s-adminorders-0fe0c2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="s-adminproduct-26d310"
            >
              ← Prev
            </button>
            <span className="s-adminorders-caf6f2">
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="s-adminproduct-26d310"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="s-adminproduct-d9e7c0" onClick={() => setConfirm(null)}>
          <div
            className="s-adminblog-69ab70"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="s-adminproduct-23729b">Delete Product</h3>
            <p className="s-adminproduct-655c7d">
              Delete <strong>"{confirmDelete.name}"</strong>? This cannot be
              undone.
            </p>
            <div className="s-adminbrands-bccf37">
              <button
                onClick={() => {
                  setConfirm(null);
                  deleteProduct.mutate(confirmDelete.productId);
                }}
                disabled={deleteProduct.isPending}
                className="s-adminproduct-885bd5"
              >
                {deleteProduct.isPending ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="s-adminproduct-c641e3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
