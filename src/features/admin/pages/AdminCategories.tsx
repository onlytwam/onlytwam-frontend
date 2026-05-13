import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

// ── Size preview chip ────────────────────────────────────────────────────────
function SizeChip({ label, type }: { label: string; type: "band" | "cup" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: type === "band" ? "#ede7f6" : "#fce4ec",
        color: type === "band" ? "#6a1b9a" : "#b71c1c",
        margin: "2px 3px 2px 0",
        border: `1px solid ${type === "band" ? "#ce93d8" : "#f48fb1"}`,
      }}
    >
      {label}
    </span>
  );
}

// ── Sizes preview section (shown inside the modal when type is selected) ─────
function CategorySizesPreview({
  categoryId,
  bandSizeType,
  hasCupSize,
}: {
  categoryId?: number;
  bandSizeType: string | null;
  hasCupSize: boolean;
}) {
  // Fetch sizes from MDM filtered by type (works even before save via ?type= param)
  const { data: mdmSizes, isLoading: loadingSizes } = useQuery({
    queryKey: ["mdm-sizes-preview", bandSizeType],
    enabled: !!bandSizeType,
    queryFn: () =>
      api
        .get("/MDM/Size", {
          params: {
            Filters: JSON.stringify([
              {
                property: "SizeType",
                comparison: "eq",
                value:
                  bandSizeType === "numerical" ? "numerical" : "alphabetical",
              },
            ]),
            "Page.Size": 100,
          },
        })
        .then((r) => r.data?.list ?? []),
  });

  const { data: mdmCups, isLoading: loadingCups } = useQuery({
    queryKey: ["mdm-cups-preview"],
    enabled: hasCupSize,
    queryFn: () =>
      api
        .get("/MDM/CupSize", { params: { "Page.Size": 100 } })
        .then((r) => r.data?.list ?? []),
  });

  if (!bandSizeType && !hasCupSize) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "#fff",
        border: "1px dashed #d1c4e9",
        borderRadius: 8,
      }}
    >
      {bandSizeType && (
        <div style={{ marginBottom: hasCupSize ? 10 : 0 }}>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              fontWeight: 700,
              color: "#6a1b9a",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {bandSizeType === "numerical" ? "🔢 Numerical" : "🔤 Alphabetical"}{" "}
            Band Sizes
          </p>
          {loadingSizes ? (
            <span style={{ fontSize: 11, color: "#aaa" }}>Loading…</span>
          ) : mdmSizes && mdmSizes.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {mdmSizes.map((s: any) => (
                <SizeChip key={s.sizeId} label={s.sizeLabel} type="band" />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#aaa" }}>
              No sizes of this type in MDM yet.
            </span>
          )}
        </div>
      )}

      {hasCupSize && (
        <div>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              fontWeight: 700,
              color: "#b71c1c",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            🩱 Cup Sizes
          </p>
          {loadingCups ? (
            <span style={{ fontSize: 11, color: "#aaa" }}>Loading…</span>
          ) : mdmCups && mdmCups.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {mdmCups.map((c: any) => (
                <SizeChip key={c.cupSizeId} label={c.sizeLabel} type="cup" />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#aaa" }}>
              No cup sizes in MDM yet.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories", page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim())
        filters.push({
          property: "QuickSearch",
          comparison: "contains",
          value: search.trim(),
        });
      return api
        .get("/Category", {
          params: {
            ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
            "Page.Index": page,
            "Page.Size": PAGE_SIZE,
            "Order.Property": "Name",
            "Order.Ascending": true,
          },
        })
        .then((r) => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) =>
      form.categoryId
        ? api.put(`/Category/${form.categoryId}`, form)
        : api.post("/Category", form),
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setModal(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Category/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const cats = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const sizeBadge = (c: any) => {
    const parts: string[] = [];
    if (c.bandSizeType === "alpha") parts.push("Alpha");
    if (c.bandSizeType === "numerical") parts.push("Num");
    if (c.hasCupSize) parts.push("Cup");
    if (!parts.length) return null;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: 10,
          background: "#f3e5f5",
          color: "#6a1b9a",
          marginLeft: 4,
        }}
      >
        {parts.join(" · ")}
      </span>
    );
  };

  const openNew = () =>
    setModal({
      name: "",
      description: "",
      parentCategoryId: null,
      bandSizeType: null,
      hasCupSize: false,
    });

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Categories</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminbrands-bccf37">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search…"
            className="inp-field s-admincategor-7a6c83"
          />
          <button onClick={openNew} className="s-admincategor-153727">
            + Add Category
          </button>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead>
            <tr className="s-adminbrands-1ba202">
              {["ID", "Name", "Description", "Parent", "Sizes", "Actions"].map(
                (h) => (
                  <th key={h} className="s-adminbrands-84e069">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="s-adminbrands-3e0634">
                  Loading…
                </td>
              </tr>
            ) : cats.length === 0 ? (
              <tr>
                <td colSpan={6} className="s-adminbrands-3e0634">
                  No categories found.
                </td>
              </tr>
            ) : (
              cats.map((c: any) => (
                <tr key={c.categoryId} className="s-adminbrands-59d787">
                  <td className="s-admincategor-ec7211">{c.categoryId}</td>
                  <td className="s-admincategor-46dbfc">{c.name}</td>
                  <td className="s-admincategor-ec7211">
                    {c.description || "—"}
                  </td>
                  <td className="s-admincategor-ec7211">
                    {c.parentCategoryId ? `#${c.parentCategoryId}` : "Root"}
                  </td>
                  <td className="s-admincategor-ec7211">
                    {sizeBadge(c) ?? "—"}
                  </td>
                  <td className="s-admincategor-19b711">
                    <div className="s-adminbrands-ac734d">
                      <button
                        onClick={() => setModal(c)}
                        className="s-adminbrands-6ea383"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirm(c)}
                        className="s-adminbrands-6ea383"
                      >
                        Delete
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
        <div className="s-adminblog-213a15">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className="s-admincategor-431a8a"
              style={{
                borderColor: page === i + 1 ? "var(--brand)" : "var(--ivory)",
                background: page === i + 1 ? "var(--brand)" : "#fff",
                color: page === i + 1 ? "#fff" : "#000",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Modal ─── */}
      {modal && (
        <div className="s-admincategor-172a23">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">
              {modal.categoryId ? "Edit" : "New"} Category
            </h3>

            {/* Name & Description */}
            {(
              [
                ["Name *", "name"],
                ["Description", "description"],
              ] as [string, string][]
            ).map(([l, k]) => (
              <div key={k} className="s-adminblog-22a617">
                <label className="s-addressform-f1fb64">{l}</label>
                <input
                  value={modal[k] || ""}
                  onChange={(e) => setModal({ ...modal, [k]: e.target.value })}
                  className="inp-field"
                />
              </div>
            ))}

            {/* Parent Category */}
            <div className="s-adminblog-19fd7a">
              <label className="s-addressform-f1fb64">
                Parent Category ID (optional)
              </label>
              <input
                type="number"
                value={modal.parentCategoryId || ""}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    parentCategoryId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="inp-field"
              />
            </div>

            {/* ─── Size Configuration ─── */}
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                background: "#fafafa",
                border: "1.5px solid #ece6f0",
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#333",
                }}
              >
                📐 Size Configuration
              </p>

              {/* Band size type */}
              <div style={{ marginBottom: 14 }}>
                <label
                  className="s-addressform-f1fb64"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Band Sizes
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(
                    [
                      {
                        key: "alpha",
                        label: "🔤 Alphabetical",
                        hint: "S, M, L, XL…",
                      },
                      {
                        key: "numerical",
                        label: "🔢 Numerical",
                        hint: "32, 34, 36…",
                      },
                    ] as { key: string; label: string; hint: string }[]
                  ).map((opt) => {
                    const active = modal.bandSizeType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() =>
                          setModal({
                            ...modal,
                            bandSizeType: active ? null : opt.key,
                          })
                        }
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "8px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          border: `1.5px solid ${
                            active ? "var(--brand)" : "#ddd"
                          }`,
                          background: active ? "var(--brand)" : "#fff",
                          color: active ? "#fff" : "#444",
                          transition: "all 0.15s",
                          minWidth: 130,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          {opt.label}
                        </span>
                        <span
                          style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}
                        >
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                  {modal.bandSizeType && (
                    <button
                      onClick={() => setModal({ ...modal, bandSizeType: null })}
                      style={{
                        alignSelf: "center",
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: "transparent",
                        color: "#999",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                {!modal.bandSizeType && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#aaa" }}>
                    No band size type selected — all sizes will show.
                  </p>
                )}
              </div>

              {/* Cup sizes toggle */}
              <div style={{ marginBottom: 12 }}>
                <label
                  className="s-addressform-f1fb64"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Cup Sizes
                </label>
                <button
                  onClick={() =>
                    setModal({ ...modal, hasCupSize: !modal.hasCupSize })
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1.5px solid ${
                      modal.hasCupSize ? "var(--brand)" : "#ddd"
                    }`,
                    background: modal.hasCupSize ? "var(--brand)" : "#fff",
                    color: modal.hasCupSize ? "#fff" : "#555",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${
                        modal.hasCupSize ? "rgba(255,255,255,0.6)" : "#ccc"
                      }`,
                      background: modal.hasCupSize ? "#fff" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {modal.hasCupSize && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--brand)",
                          display: "block",
                        }}
                      />
                    )}
                  </span>
                  {modal.hasCupSize ? "🩱 Cup Sizes Enabled" : "No Cup Sizes"}
                </button>
              </div>

              {/* ── Live size preview ── */}
              <CategorySizesPreview
                categoryId={modal.categoryId}
                bandSizeType={modal.bandSizeType}
                hasCupSize={!!modal.hasCupSize}
              />
            </div>

            {/* Footer buttons */}
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setModal(null)}
                className="s-admincategor-68998a"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(modal)}
                disabled={!modal.name}
                className="s-admincategor-153727"
                style={{ opacity: !modal.name ? 0.5 : 1 }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─── */}
      {confirm && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">Delete "{confirm.name}"?</h3>
            <p className="s-adminbrands-93cf07">This cannot be undone.</p>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirm.categoryId)}
                className="s-admincategor-5e62fe"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
