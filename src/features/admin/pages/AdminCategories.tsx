import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

// ── Category image upload hook ───────────────────────────────────────────────
function useCategoryImageUpload(
  categoryId: number | undefined,
  onSuccess: (imageUrl: string) => void,
) {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!categoryId)
        throw new Error("Save the category first before uploading an image.");
      const form = new FormData();
      form.append("file", file);
      const res = await api.put(`/Category/${categoryId}/image`, form);
      return res.data;
    },
    onSuccess: (res: any) => {
      toast.success("Category image updated.");
      onSuccess(res?.imageUrl ?? "");
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail || e?.message || "Image upload failed.",
      ),
  });
}

// ── ImageUploadField ─────────────────────────────────────────────────────────
function ImageUploadField({
  categoryId,
  currentUrl,
  onUploaded,
}: {
  categoryId?: number;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const qc = useQueryClient();

  const upload = useCategoryImageUpload(categoryId, (imageUrl: string) => {
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploaded(imageUrl); // ← forward URL to parent so modal state stays in sync
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
  };

  const handleSave = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    if (!categoryId) {
      toast.error("Save the category first, then upload its image.");
      return;
    }
    upload.mutate(file);
  };

  const displayUrl = preview || currentUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Thumbnail preview */}
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 10,
          border: "1.5px dashed #d9cac2",
          background: displayUrl
            ? `url("${displayUrl}") center/cover no-repeat #f5f0eb`
            : "#f5f0eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!displayUrl && (
          <span style={{ fontSize: 12, color: "#b89fa8" }}>No image</span>
        )}
        {preview && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "#6B0F2A",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 20,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Preview
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{
          fontSize: 12,
          border: "1px solid #d9cac2",
          borderRadius: 8,
          padding: "6px 10px",
          background: "#faf8f6",
          cursor: "pointer",
        }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={upload.isPending || !preview}
          style={{
            flex: 1,
            background: upload.isPending || !preview ? "#d4b8be" : "#6B0F2A",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 0",
            fontSize: 12,
            fontWeight: 700,
            cursor: upload.isPending || !preview ? "not-allowed" : "pointer",
          }}
        >
          {upload.isPending ? "Uploading…" : "Upload Image"}
        </button>
        {preview && (
          <button
            onClick={() => {
              setPreview("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{
              background: "#f5f0eb",
              color: "#6B0F2A",
              border: "1px solid #d9cac2",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {!categoryId && (
        <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
          Save the category first, then you can upload its image.
        </p>
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
    mutationFn: (form: any) => {
      // Strip client-only fields before sending to the backend
      const { bandSizeType: _b, hasCupSize: _h, ...payload } = form;
      return form.categoryId
        ? api.put(`/Category/${form.categoryId}`, payload)
        : api.post("/Category", payload);
    },
    onSuccess: (res, form) => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      if (form.categoryId) {
        // Editing — close the modal
        setModal(null);
      } else {
        // Creating — keep modal open and inject the new categoryId so the
        // ImageUploadField can immediately accept file uploads
        setModal((prev: any) => ({
          ...prev,
          categoryId: res?.data?.categoryId,
        }));
      }
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

  const openNew = () =>
    setModal({
      name: "",
      description: "",
      parentCategoryId: null,
      categoryImage: "",
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
              {["ID", "Image", "Name", "Description", "Parent", "Actions"].map(
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

                  {/* Category image thumbnail */}
                  <td className="s-admincategor-ec7211">
                    {c.categoryImage ? (
                      <img
                        src={c.categoryImage}
                        alt={c.name}
                        style={{
                          width: 52,
                          height: 52,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #eadfd8",
                          display: "block",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          background: "#f5f0eb",
                          border: "1px dashed #d9cac2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: 9, color: "#b89fa8" }}>
                          None
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="s-admincategor-46dbfc">{c.name}</td>
                  <td className="s-admincategor-ec7211">
                    {c.description || "—"}
                  </td>
                  <td className="s-admincategor-ec7211">
                    {c.parentCategoryId ? `#${c.parentCategoryId}` : "Root"}
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

            {/* ─── Category Image ─── */}
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
                🖼️ Category Image
              </p>
              <ImageUploadField
                categoryId={modal.categoryId}
                currentUrl={modal.categoryImage}
                onUploaded={(url) => setModal({ ...modal, categoryImage: url })}
              />
            </div>

            {/* Note: sizes (alpha/numerical/cup) are determined automatically from
                product PVD data — no category-level size config needed. */}

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
