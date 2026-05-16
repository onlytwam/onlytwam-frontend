import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import { useMenuStore } from "@/shared/store/menuStore";

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
    onUploaded(imageUrl);
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

// ── Image Viewer Modal ───────────────────────────────────────────────────────
function ImageViewerModal({
  url,
  name,
  onClose,
  onDelete,
}: {
  url: string;
  name: string;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>
            {name}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#888",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: "80vw",
            maxHeight: "70vh",
            objectFit: "contain",
            borderRadius: 8,
          }}
        />
        {/* Footer row: open link + delete button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "#6B0F2A",
              textDecoration: "underline",
            }}
          >
            Open full image ↗
          </a>
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                border: "1px solid #f5c6cb",
                background: "#fdecea",
                color: "#c62828",
                cursor: "pointer",
              }}
            >
              🗑 Delete Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── View-only Category Modal ─────────────────────────────────────────────────
function ViewCategoryModal({
  cat,
  onClose,
  onEdit,
  onViewImage,
}: {
  cat: any;
  onClose: () => void;
  onEdit: () => void;
  onViewImage: (url: string, name: string, categoryId: number) => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 0",
        borderBottom: "1px solid #f0e8e3",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: "#333", wordBreak: "break-word" }}>
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="s-admincategor-172a23">
      <div
        className="s-adminbrands-cd5358"
        style={{ maxWidth: 460, width: "100%" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <h3 className="s-adminblog-e6371f" style={{ margin: 0 }}>
            Category Details
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#888",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {cat.categoryImage && (
          <div
            style={{
              width: "100%",
              height: 140,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 12,
              cursor: "pointer",
              border: "1px solid #eadfd8",
            }}
            onClick={() =>
              onViewImage(cat.categoryImage, cat.name, cat.categoryId)
            }
            title="Click to view full image"
          >
            <img
              src={cat.categoryImage}
              alt={cat.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {row("ID", `#${cat.categoryId}`)}
          {row("Name", cat.name)}
          {row("Description", cat.description)}
          {row(
            "Parent",
            cat.parentCategoryName
              ? `${cat.parentCategoryName} (#${cat.parentCategoryId})`
              : cat.parentCategoryId
              ? `#${cat.parentCategoryId}`
              : "Root (No Parent)",
          )}
          {row(
            "Status",
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: cat.isActive !== false ? "#e6f4ea" : "#fdecea",
                color: cat.isActive !== false ? "#2e7d32" : "#c62828",
              }}
            >
              {cat.isActive !== false ? "Active" : "Inactive"}
            </span>,
          )}
        </div>

        <div className="s-adminblog-679e96" style={{ marginTop: 16 }}>
          <button onClick={onClose} className="s-admincategor-68998a">
            Close
          </button>
          <button onClick={onEdit} className="s-admincategor-153727">
            ✏️ Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const qc = useQueryClient();
  const { setMenus } = useMenuStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [viewModal, setViewModal] = useState<any>(null);
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<any>(null);
  const [viewImage, setViewImage] = useState<{
    url: string;
    name: string;
    categoryId?: number;
  } | null>(null);
  const [hideParentConfirm, setHideParentConfirm] = useState<any>(null);
  const [unhideChildrenConfirm, setUnhideChildrenConfirm] = useState<{
    cat: any;
    childCount: number;
  } | null>(null);

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
      const { bandSizeType: _b, hasCupSize: _h, ...payload } = form;
      return form.categoryId
        ? api.put(`/Category/${form.categoryId}`, payload)
        : api.post("/Category", payload);
    },
    onSuccess: (res, form) => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      if (form.categoryId) {
        setModal(null);
      } else {
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
    onSuccess: (res: any) => {
      const deleted = res?.data?.childrenDeleted ?? 0;
      toast.success(
        deleted > 0
          ? `Deleted category and ${deleted} child categor${
              deleted === 1 ? "y" : "ies"
            }.`
          : "Category deleted.",
      );
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const doToggleVisibility = useMutation({
    mutationFn: ({
      id,
      unhideChildren,
    }: {
      id: number;
      unhideChildren?: boolean;
    }) =>
      api.patch(`/Category/${id}/visibility`, null, {
        params: unhideChildren ? { unhideChildren: true } : undefined,
      }),

    // ── Optimistic update ────────────────────────────────────────────────────
    // Immediately flip isActive in every "admin-categories" cache entry so the
    // row badge and button label change the instant the user clicks — no waiting
    // for the network round-trip.
    onMutate: async ({ id, unhideChildren }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic data
      await qc.cancelQueries({ queryKey: ["admin-categories"] });

      // Snapshot current data for rollback on error
      const previousData = qc.getQueriesData({
        queryKey: ["admin-categories"],
      });

      // Apply optimistic flip to every cached page/search variant
      qc.setQueriesData({ queryKey: ["admin-categories"] }, (old: any) => {
        if (!old?.list) return old;
        const newList = old.list.map((cat: any) => {
          if (cat.categoryId === id) {
            const newActive = !cat.isActive;
            // If hiding a parent, also optimistically hide its children in this page
            if (!newActive) {
              return { ...cat, isActive: false };
            }
            return { ...cat, isActive: true };
          }
          // If hiding — cascade to children already loaded in this page
          const parentBeingHidden = old.list.find(
            (c: any) => c.categoryId === id && c.isActive !== false,
          );
          if (parentBeingHidden && cat.parentCategoryId === id) {
            return { ...cat, isActive: false };
          }
          // If un-hiding with unhideChildren — restore children
          if (unhideChildren && cat.parentCategoryId === id) {
            return { ...cat, isActive: true };
          }
          return cat;
        });
        return { ...old, list: newList };
      });

      return { previousData };
    },

    onSuccess: (res: any) => {
      const state = res?.data?.isActive ? "visible" : "hidden";
      toast.success(`Category is now ${state}.`);
      // Reconcile with server truth
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      // Invalidate every public category query so storefront reflects change immediately
      qc.invalidateQueries({
        predicate: (q) => {
          const key = String(q.queryKey[0] ?? "");
          return key.includes("categor") || key === "gs-categories";
        },
      });
      // Also invalidate product queries so hidden-category products disappear
      qc.invalidateQueries({ queryKey: ["all-products-page"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      // Clear the navbar sessionStorage cache and zustand store so Navbar re-fetches
      sessionStorage.removeItem("menus");
      setMenus([]);
      // Notify same-tab Navbar via CustomEvent
      window.dispatchEvent(new CustomEvent("categoriesUpdated"));
      // Notify all other open tabs in the same browser via BroadcastChannel
      // (covers the storefront open in a separate tab while admin is in another)
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("category_visibility");
        ch.postMessage({ type: "CATEGORIES_UPDATED" });
        ch.close();
      }
      setHideParentConfirm(null);
      setUnhideChildrenConfirm(null);
    },

    // Roll back optimistic update if the API call fails
    onError: (_err, _vars, context: any) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]: [any, any]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      toast.error("Could not update visibility.");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Category/${id}/image`),
    onSuccess: () => {
      toast.success("Category image removed.");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setConfirmDeleteImage(null);
      setViewImage(null);
    },
    onError: () => toast.error("Could not delete image."),
  });

  const cats = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const getChildCount = (categoryId: number) =>
    cats.filter((c: any) => c.parentCategoryId === categoryId).length;

  const handleToggleVisibility = (c: any) => {
    const childCount = getChildCount(c.categoryId);
    const isCurrentlyVisible = c.isActive !== false;
    if (isCurrentlyVisible) {
      if (childCount > 0) setHideParentConfirm({ cat: c, childCount });
      else doToggleVisibility.mutate({ id: c.categoryId });
    } else {
      if (childCount > 0) setUnhideChildrenConfirm({ cat: c, childCount });
      else doToggleVisibility.mutate({ id: c.categoryId });
    }
  };

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
              {[
                "ID",
                "Image",
                "Name",
                "Description",
                "Parent",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="s-adminbrands-84e069">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="s-adminbrands-3e0634">
                  Loading…
                </td>
              </tr>
            ) : cats.length === 0 ? (
              <tr>
                <td colSpan={7} className="s-adminbrands-3e0634">
                  No categories found.
                </td>
              </tr>
            ) : (
              cats.map((c: any) => (
                <tr
                  key={c.categoryId}
                  className="s-adminbrands-59d787"
                  style={{
                    background: c.isActive === false ? "#fffbf0" : undefined,
                  }}
                >
                  <td className="s-admincategor-ec7211">{c.categoryId}</td>

                  {/* Image cell */}
                  <td className="s-admincategor-ec7211">
                    {c.categoryImage ? (
                      <div style={{ position: "relative", width: 52 }}>
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
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            setViewImage({
                              url: c.categoryImage,
                              name: c.name,
                              categoryId: c.categoryId,
                            })
                          }
                          title="Click to view full image"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <button
                          onClick={() => setConfirmDeleteImage(c)}
                          title="Remove image"
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            background: "#6B0F2A",
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                            lineHeight: "18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          }}
                        >
                          ×
                        </button>
                      </div>
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

                  <td className="s-admincategor-46dbfc">
                    {c.name}
                    {c.isActive === false && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          background: "#fdecea",
                          color: "#c62828",
                          padding: "2px 6px",
                          borderRadius: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Inactive
                      </span>
                    )}
                    {getChildCount(c.categoryId) > 0 && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          background: "#e3f2fd",
                          color: "#1565c0",
                          padding: "2px 6px",
                          borderRadius: 10,
                          fontWeight: 600,
                        }}
                      >
                        parent
                      </span>
                    )}
                  </td>
                  <td className="s-admincategor-ec7211">
                    {c.description || "—"}
                  </td>
                  <td className="s-admincategor-ec7211">
                    {c.parentCategoryName
                      ? `${c.parentCategoryName} (#${c.parentCategoryId})`
                      : c.parentCategoryId
                      ? `#${c.parentCategoryId}`
                      : "Root"}
                  </td>

                  {/* Status badge */}
                  <td className="s-admincategor-ec7211">
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          c.isActive !== false ? "#e6f4ea" : "#fdecea",
                        color: c.isActive !== false ? "#2e7d32" : "#c62828",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {c.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="s-admincategor-19b711">
                    <div
                      className="s-adminbrands-ac734d"
                      style={{ gap: 4, flexWrap: "wrap" }}
                    >
                      <button
                        onClick={() => setViewModal(c)}
                        className="s-adminbrands-6ea383"
                        style={{
                          background: "#e8eaf6",
                          color: "#3949ab",
                          border: "1px solid #9fa8da",
                        }}
                      >
                        👁 View
                      </button>
                      <button
                        onClick={() => handleToggleVisibility(c)}
                        disabled={doToggleVisibility.isPending}
                        title={
                          c.isActive !== false
                            ? "Hide this category everywhere"
                            : "Make this category visible again"
                        }
                        style={{
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: "1px solid",
                          cursor: doToggleVisibility.isPending
                            ? "not-allowed"
                            : "pointer",
                          opacity:
                            doToggleVisibility.isPending &&
                            doToggleVisibility.variables?.id === c.categoryId
                              ? 0.6
                              : 1,
                          background:
                            c.isActive !== false ? "#fff8e1" : "#e8f5e9",
                          borderColor:
                            c.isActive !== false ? "#f9a825" : "#43a047",
                          color: c.isActive !== false ? "#e65100" : "#2e7d32",
                        }}
                      >
                        {doToggleVisibility.isPending &&
                        doToggleVisibility.variables?.id === c.categoryId
                          ? "…"
                          : c.isActive !== false
                          ? "🙈 Hide"
                          : "👁 Show"}
                      </button>
                      <button
                        onClick={() => setConfirm(c)}
                        className="s-adminbrands-6ea383"
                        style={{
                          background: "#fdecea",
                          color: "#c62828",
                          border: "1px solid #f5c6cb",
                        }}
                      >
                        🗑 Delete
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

      {/* ─── View-only Modal ─── */}
      {viewModal && (
        <ViewCategoryModal
          cat={viewModal}
          onClose={() => setViewModal(null)}
          onEdit={() => {
            setModal(viewModal);
            setViewModal(null);
          }}
          onViewImage={(url, name, categoryId) =>
            setViewImage({ url, name, categoryId })
          }
        />
      )}

      {/* ─── Edit/Add Modal ─── */}
      {modal && (
        <div className="s-admincategor-172a23">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">
              {modal.categoryId ? "Edit" : "New"} Category
            </h3>
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
              {modal.categoryImage && (
                <button
                  onClick={() =>
                    setViewImage({
                      url: modal.categoryImage,
                      name: modal.name,
                      categoryId: modal.categoryId,
                    })
                  }
                  style={{
                    marginBottom: 10,
                    padding: "4px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#e8eaf6",
                    color: "#3949ab",
                    border: "1px solid #9fa8da",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  👁 View Current Image
                </button>
              )}
              <ImageUploadField
                categoryId={modal.categoryId}
                currentUrl={modal.categoryImage}
                onUploaded={(url) => setModal({ ...modal, categoryImage: url })}
              />
            </div>
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

      {/* ─── Delete Confirm (parent warning) ─── */}
      {confirm &&
        (() => {
          const childCount = getChildCount(confirm.categoryId);
          const isParent = childCount > 0;
          return (
            <div className="s-admincategor-172a23">
              <div className="s-adminblog-69ab70" style={{ maxWidth: 440 }}>
                <h3 className="s-adminblog-caf79d">Delete "{confirm.name}"?</h3>
                {isParent ? (
                  <>
                    <div
                      style={{
                        background: "#fff3e0",
                        border: "1px solid #ffb74d",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 12,
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#e65100",
                          fontWeight: 600,
                        }}
                      >
                        This is a parent category with{" "}
                        <strong>
                          {childCount} child categor
                          {childCount === 1 ? "y" : "ies"}
                        </strong>
                        . Deleting it will also permanently delete all its child
                        categories.
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0 0 16px",
                        fontSize: 13,
                        color: "#555",
                      }}
                    >
                      This action cannot be undone.
                    </p>
                  </>
                ) : (
                  <p className="s-adminbrands-93cf07">This cannot be undone.</p>
                )}
                <div className="s-adminblog-679e96">
                  <button
                    onClick={() => setConfirm(null)}
                    className="s-admincategor-3dc5de"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(confirm.categoryId)}
                    disabled={deleteMutation.isPending}
                    className="s-admincategor-5e62fe"
                  >
                    {deleteMutation.isPending
                      ? "Deleting…"
                      : isParent
                      ? `Delete + ${childCount} Child${
                          childCount === 1 ? "" : "ren"
                        }`
                      : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ─── Hide Parent Confirm ─── */}
      {hideParentConfirm && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70" style={{ maxWidth: 440 }}>
            <h3 className="s-adminblog-caf79d">
              Hide "{hideParentConfirm.cat.name}"?
            </h3>
            <div
              style={{
                background: "#fff8e1",
                border: "1px solid #f9a825",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 18 }}>🙈</span>
              <span style={{ fontSize: 13, color: "#e65100", fontWeight: 600 }}>
                This is a parent category with{" "}
                <strong>
                  {hideParentConfirm.childCount} child categor
                  {hideParentConfirm.childCount === 1 ? "y" : "ies"}
                </strong>
                . Hiding it will also hide all its child categories from the
                storefront.
              </span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555" }}>
              You can restore individual child categories later by clicking
              "Show" on each one.
            </p>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setHideParentConfirm(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  doToggleVisibility.mutate({
                    id: hideParentConfirm.cat.categoryId,
                  })
                }
                disabled={doToggleVisibility.isPending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  background: "#e65100",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: doToggleVisibility.isPending ? 0.6 : 1,
                }}
              >
                {doToggleVisibility.isPending
                  ? "Please wait…"
                  : `Hide + ${hideParentConfirm.childCount} Child${
                      hideParentConfirm.childCount === 1 ? "" : "ren"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Unhide Children? ─── */}
      {unhideChildrenConfirm && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70" style={{ maxWidth: 460 }}>
            <h3 className="s-adminblog-caf79d">
              Show "{unhideChildrenConfirm.cat.name}"?
            </h3>
            <div
              style={{
                background: "#e8f5e9",
                border: "1px solid #43a047",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 18 }}>👁</span>
              <span style={{ fontSize: 13, color: "#2e7d32", fontWeight: 600 }}>
                This parent has{" "}
                <strong>
                  {unhideChildrenConfirm.childCount} hidden child categor
                  {unhideChildrenConfirm.childCount === 1 ? "y" : "ies"}
                </strong>
                . Would you like to make them visible too?
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px" }}>
              Choose <strong>Yes</strong> to restore all child categories, or{" "}
              <strong>No</strong> to show only this parent — you can then
              manually restore individual children as needed.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setUnhideChildrenConfirm(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  doToggleVisibility.mutate({
                    id: unhideChildrenConfirm.cat.categoryId,
                    unhideChildren: false,
                  })
                }
                disabled={doToggleVisibility.isPending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 7,
                  border: "1px solid #bdbdbd",
                  background: "#f5f5f5",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                No, Show Parent Only
              </button>
              <button
                onClick={() =>
                  doToggleVisibility.mutate({
                    id: unhideChildrenConfirm.cat.categoryId,
                    unhideChildren: true,
                  })
                }
                disabled={doToggleVisibility.isPending}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  background: "#2e7d32",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: doToggleVisibility.isPending ? 0.6 : 1,
                }}
              >
                {doToggleVisibility.isPending
                  ? "Please wait…"
                  : "Yes, Show All Children Too"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Image Confirm ─── */}
      {confirmDeleteImage && (
        <div className="s-admincategor-172a23">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Remove image for "{confirmDeleteImage.name}"?
            </h3>
            <p className="s-adminbrands-93cf07">
              The image will be permanently deleted.
            </p>
            {confirmDeleteImage.categoryImage && (
              <img
                src={confirmDeleteImage.categoryImage}
                alt={confirmDeleteImage.name}
                style={{
                  width: "100%",
                  maxHeight: 140,
                  objectFit: "cover",
                  borderRadius: 8,
                  margin: "8px 0",
                }}
              />
            )}
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirmDeleteImage(null)}
                className="s-admincategor-3dc5de"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteImageMutation.mutate(confirmDeleteImage.categoryId)
                }
                className="s-admincategor-5e62fe"
              >
                {deleteImageMutation.isPending ? "Removing…" : "Remove Image"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Viewer ─── */}
      {viewImage && (
        <ImageViewerModal
          url={viewImage.url}
          name={viewImage.name}
          onClose={() => setViewImage(null)}
          onDelete={
            viewImage.categoryId
              ? () => {
                  // find the full cat object to reuse existing confirmDeleteImage flow
                  const cat = cats.find(
                    (c: any) => c.categoryId === viewImage.categoryId,
                  );
                  setViewImage(null);
                  setConfirmDeleteImage(
                    cat ?? {
                      categoryId: viewImage.categoryId,
                      name: viewImage.name,
                      categoryImage: viewImage.url,
                    },
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
