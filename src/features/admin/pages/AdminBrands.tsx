import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Brand {
  brandId: number;
  brandName: string;
  brandDescription: string | null;
  brandImage: string | null;
  isActive: boolean;
  deletedInd?: boolean;
}

interface ModalState {
  brandId?: number;
  brandName: string;
  description: string;
  _imageUrl: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function resolveImgSrc(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return "/" + src.replace(/\\/g, "/");
}

// ─────────────────────────────────────────────
// Brand image upload hook
// ─────────────────────────────────────────────

function useBrandImageUpload(
  brandId: number | undefined,
  onSuccess: (imageUrl: string) => void,
) {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!brandId)
        throw new Error("Save the brand first before uploading an image.");
      const form = new FormData();
      form.append("file", file);
      const res = await api.put(`/Brand/${brandId}/image`, form);
      return res.data;
    },
    onSuccess: (res: any) => {
      toast.success("Brand image updated.");
      onSuccess(res?.imageUrl ?? "");
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail || e?.message || "Image upload failed.",
      ),
  });
}

// ─────────────────────────────────────────────
// ImageUploadField
// ─────────────────────────────────────────────

function ImageUploadField({
  brandId,
  currentUrl,
  onUploaded,
}: {
  brandId?: number;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const qc = useQueryClient();

  const upload = useBrandImageUpload(brandId, (imageUrl: string) => {
    qc.invalidateQueries({ queryKey: ["admin-brands"] });
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploaded(imageUrl);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    if (!brandId) {
      toast.error("Save the brand first, then upload its image.");
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

      {!brandId && (
        <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
          Save the brand first, then you can upload its image.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ImageViewerModal
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// DeleteImageConfirm modal
// ─────────────────────────────────────────────

function DeleteImageModal({
  brand,
  onConfirm,
  onCancel,
  isPending,
}: {
  brand: Brand;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="s-adminbrands-942dbe">
      <div className="s-adminblog-69ab70">
        <h3 className="s-adminblog-caf79d">
          Remove image from "{brand.brandName}"?
        </h3>
        {brand.brandImage && (
          <img
            src={resolveImgSrc(brand.brandImage)}
            alt={brand.brandName}
            style={{
              width: 80,
              height: 80,
              objectFit: "cover",
              borderRadius: 8,
              margin: "8px auto",
              display: "block",
            }}
          />
        )}
        <p className="s-adminbrands-93cf07">
          The image will be permanently deleted and cannot be recovered.
        </p>
        <div className="s-adminblog-679e96">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="s-adminbrands-c554f0"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="s-adminbrands-ad5bf3"
          >
            {isPending ? "Deleting…" : "Delete Image"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status badge helper
// ─────────────────────────────────────────────

function BrandStatusBadge({ brand }: { brand: Brand }) {
  if (brand.deletedInd) {
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: 10,
          fontWeight: 700,
          background: "#fdecea",
          color: "#c62828",
          borderRadius: 20,
          padding: "2px 8px",
          letterSpacing: "0.05em",
        }}
      >
        DELETED
      </span>
    );
  }
  if (!brand.isActive) {
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: 10,
          fontWeight: 700,
          background: "#fff8e1",
          color: "#e65100",
          borderRadius: 20,
          padding: "2px 8px",
          letterSpacing: "0.05em",
        }}
      >
        HIDDEN
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        background: "#e8f5e9",
        color: "#2e7d32",
        borderRadius: 20,
        padding: "2px 8px",
        letterSpacing: "0.05em",
      }}
    >
      ACTIVE
    </span>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function AdminBrands() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<Brand | null>(null);
  const [confirmDelImage, setConfirmDelImage] = useState<Brand | null>(null);
  const [viewImage, setViewImage] = useState<{
    url: string;
    name: string;
    brandId: number;
  } | null>(null);
  // Shown before unhiding: ask whether to also reactivate products (single API call)
  const [productCascadeConfirm, setProductCascadeConfirm] = useState<{
    brandId: number;
    brandName: string;
  } | null>(null);

  // ── Query — admin view: showAll=true includes hidden brands ─────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["admin-brands", page, search],
    queryFn: async () => {
      const filters = search.trim()
        ? JSON.stringify([
            {
              property: "QuickSearch",
              comparison: "contains",
              value: search.trim(),
            },
          ])
        : undefined;
      const { data } = await api.get("/Brand/", {
        params: {
          ...(filters ? { Filters: filters } : {}),
          "Page.Index": page,
          "Page.Size": PAGE_SIZE,
          "Order.Property": "Name",
          "Order.Ascending": true,
          showAll: true, // admin sees hidden brands too (never sees deleted ones via list)
        },
      });
      return data as { list: Brand[]; count: number };
    },
  });

  const brands = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  // ── Product count per brand ───────────────────────────────────────────────
  const { data: brandCountData } = useQuery({
    queryKey: ["brand-product-counts"],
    queryFn: () =>
      api
        .get("/MDM/BrandProductCount", { params: { "Page.Size": 500 } })
        .then(
          (r) =>
            (r.data?.list ?? []) as { brandId: number; productCount: number }[],
        ),
    staleTime: 30_000,
  });

  const brandCountMap = useMemo<Record<number, number>>(() => {
    if (!brandCountData) return {};
    return Object.fromEntries(
      brandCountData.map((r: any) => [r.brandId, r.productCount]),
    );
  }, [brandCountData]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (m: ModalState) => {
      if (!m.brandName.trim()) throw new Error("Brand name is required");
      const fd = new FormData();
      fd.append("brandName", m.brandName.trim());
      fd.append("brandDescription", m.description.trim());
      fd.append("isActive", "true");
      return m.brandId
        ? api.put(`/Brand/${m.brandId}`, fd)
        : api.post("/Brand/", fd);
    },
    onSuccess: (res, m) => {
      toast.success("Brand saved!");
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      if (m.brandId) {
        setModal(null);
      } else {
        const newId = res?.data?.brandId;
        setModal((prev) => (prev ? { ...prev, brandId: newId } : prev));
        if (newId)
          toast("Brand created — you can now upload an image.", { icon: "🖼️" });
      }
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? e?.message ?? "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (brandId: number) => api.delete(`/Brand/${brandId}`),
    onSuccess: () => {
      toast.success(
        "Brand deleted. All its products are now inactive and hidden from all user pages.",
      );
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      // Also invalidate product queries so admin products list refreshes brand badges
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  // ── Toggle visibility mutation ──────────────────────────────────────────────

  // ── Toggle visibility mutation ──────────────────────────────────────────────
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({
      brandId,
      cascadeProducts,
    }: {
      brandId: number;
      cascadeProducts?: boolean;
    }) =>
      api.patch(`/Brand/${brandId}/toggle-visibility`, null, {
        params: cascadeProducts ? { cascadeProducts: true } : undefined,
      }),
    onMutate: async ({ brandId }) => {
      await qc.cancelQueries({ queryKey: ["admin-brands"] });
      const previous = qc.getQueriesData({ queryKey: ["admin-brands"] });
      qc.setQueriesData({ queryKey: ["admin-brands"] }, (old: any) => {
        if (!old?.list) return old;
        return {
          ...old,
          list: old.list.map((b: Brand) =>
            b.brandId === brandId ? { ...b, isActive: !b.isActive } : b,
          ),
        };
      });
      return { previous };
    },
    onSuccess: (res, { brandId, cascadeProducts }) => {
      const newIsActive = res?.data?.isActive;
      const brandName = res?.data?.brandName ?? "Brand";
      // Toast only when SHOWING (unhiding) — hiding is intentionally silent
      if (newIsActive) {
        toast.success(
          cascadeProducts
            ? `"${brandName}" is now visible. All its products are shown.`
            : `"${brandName}" is now visible.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setProductCascadeConfirm(null);
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.previous) {
        ctx.previous.forEach(([key, val]: any) => qc.setQueryData(key, val));
      }
      toast.error("Could not update brand visibility.");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (brandId: number) => api.delete(`/Brand/${brandId}/image`),
    onSuccess: () => {
      toast.success("Brand image removed.");
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      setConfirmDelImage(null);
      setViewImage(null);
      setModal((prev) => (prev ? { ...prev, _imageUrl: "" } : prev));
    },
    onError: () => toast.error("Could not delete image."),
  });

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAdd = () =>
    setModal({ brandName: "", description: "", _imageUrl: "" });

  const openEdit = (b: Brand) =>
    setModal({
      brandId: b.brandId,
      brandName: b.brandName,
      description: b.brandDescription ?? "",
      _imageUrl: b.brandImage ?? "",
    });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header ── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Brands</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminbrands-bccf37">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search brands…"
            className="inp-field s-adminbrands-b9d1c5"
          />
          <button onClick={openAdd} className="s-adminbrands-d3409f">
            + Add Brand
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead>
            <tr className="s-adminbrands-1ba202">
              {["Image", "Name", "Description", "Status", "Actions"].map(
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
                <td colSpan={5} className="s-adminbrands-3e0634">
                  Loading…
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="s-adminbrands-3e0634">
                  No brands found.
                </td>
              </tr>
            ) : (
              brands.map((b) => {
                const imgSrc = resolveImgSrc(b.brandImage);
                const isDeleted = !!b.deletedInd;
                return (
                  <tr
                    key={b.brandId}
                    className="s-adminbrands-59d787"
                    style={{
                      opacity: isDeleted ? 0.5 : 1,
                      background: isDeleted
                        ? "#fdf5f5"
                        : !b.isActive
                        ? "#fffbf0"
                        : undefined,
                    }}
                  >
                    {/* Image */}
                    <td className="s-adminbrands-7dcd2c">
                      {imgSrc ? (
                        <div
                          style={{
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <img
                            src={imgSrc}
                            alt={b.brandName}
                            title="Click to view"
                            onClick={() =>
                              !isDeleted &&
                              setViewImage({
                                url: imgSrc,
                                name: b.brandName,
                                brandId: b.brandId,
                              })
                            }
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #e8ddd8",
                              display: "block",
                              cursor: isDeleted ? "default" : "pointer",
                              filter: isDeleted ? "grayscale(80%)" : undefined,
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                          {!isDeleted && (
                            <button
                              title="Remove image"
                              onClick={() => setConfirmDelImage(b)}
                              style={{
                                position: "absolute",
                                top: -6,
                                right: -6,
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                background: "#6B0F2A",
                                color: "#fff",
                                border: "none",
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: "pointer",
                                lineHeight: "18px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="s-adminbrands-6167ec">
                          <i className="bi bi-image s-adminbrands-95b451" />
                        </div>
                      )}
                    </td>

                    <td className="s-adminbrands-c25a6e">
                      {b.brandName}
                      {(() => {
                        const count = brandCountMap[b.brandId] ?? 0;
                        return (
                          <span
                            title={`${count} product${
                              count !== 1 ? "s" : ""
                            } in this brand`}
                            style={{
                              marginLeft: 7,
                              fontSize: 10,
                              background: count > 0 ? "#f3e5f5" : "#f5f5f5",
                              color: count > 0 ? "#6a1b9a" : "#9e9e9e",
                              padding: "2px 7px",
                              borderRadius: 10,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {count} {count === 1 ? "product" : "products"}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="s-adminbrands-6d0b42">
                      {b.brandDescription ?? "—"}
                    </td>

                    {/* Status badge */}
                    <td className="s-adminbrands-7dcd2c">
                      <BrandStatusBadge brand={b} />
                    </td>

                    {/* Actions */}
                    <td className="s-adminbrands-7dcd2c">
                      <div className="s-adminbrands-ac734d">
                        {/* Edit — disabled for deleted brands */}
                        {!isDeleted && (
                          <button
                            onClick={() => openEdit(b)}
                            className="s-adminbrands-6ea383"
                          >
                            Edit
                          </button>
                        )}

                        {/* Hide / Show toggle — only for non-deleted brands */}
                        {!isDeleted && (
                          <button
                            onClick={() => {
                              if (b.isActive) {
                                // HIDING: silent, auto-cascade all products immediately
                                toggleVisibilityMutation.mutate({
                                  brandId: b.brandId,
                                  cascadeProducts: true,
                                });
                              } else {
                                // UNHIDING: ask about products first, then fire ONE call
                                setProductCascadeConfirm({
                                  brandId: b.brandId,
                                  brandName: b.brandName,
                                });
                              }
                            }}
                            disabled={toggleVisibilityMutation.isPending}
                            title={
                              b.isActive
                                ? "Hide brand — removes it and all its products from all user pages"
                                : "Show brand — makes it and its products visible to users again"
                            }
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 7,
                              border: `1px solid ${
                                b.isActive ? "#ffe082" : "#c8e6c9"
                              }`,
                              background: b.isActive ? "#fff8e1" : "#e8f5e9",
                              color: b.isActive ? "#e65100" : "#2e7d32",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.isActive ? "🙈 Hide" : "👁 Show"}
                          </button>
                        )}

                        {/* Delete — soft-delete; shows confirmation */}
                        {!isDeleted && (
                          <button
                            onClick={() => setConfirm(b)}
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 7,
                              border: "1px solid #f5c6cb",
                              background: "#fdecea",
                              color: "#c62828",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🗑 Delete
                          </button>
                        )}

                        {/* Deleted brand: show inactive button that toasts "Brand deleted" */}
                        {isDeleted && (
                          <button
                            onClick={() =>
                              toast.error(
                                "This brand has been deleted. Its products are inactive.",
                              )
                            }
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 7,
                              border: "1px solid #f5c6cb",
                              background: "#fdecea",
                              color: "#c62828",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Brand Deleted
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="s-adminblog-213a15">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className="s-adminbrands-93c0a2"
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

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminbrands-cd5358">
            <h3 className="s-adminblog-e6371f">
              {modal.brandId ? "Edit" : "New"} Brand
            </h3>

            {(
              [
                ["Brand Name *", "brandName", "text"],
                ["Description", "description", "text"],
              ] as const
            ).map(([label, key, type]) => (
              <div key={key} className="s-adminblog-22a617">
                <label className="s-addressform-f1fb64">{label}</label>
                <input
                  type={type}
                  value={modal[key] ?? ""}
                  onChange={(e) =>
                    setModal((prev) =>
                      prev ? { ...prev, [key]: e.target.value } : prev,
                    )
                  }
                  className="inp-field"
                />
              </div>
            ))}

            <hr style={{ margin: "12px 0", borderColor: "#ede6e1" }} />

            <div className="s-adminblog-22a617">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <label className="s-addressform-f1fb64" style={{ margin: 0 }}>
                  🖼️ Brand Image
                </label>
                {modal._imageUrl && (
                  <button
                    onClick={() =>
                      modal.brandId &&
                      setViewImage({
                        url: modal._imageUrl,
                        name: modal.brandName,
                        brandId: modal.brandId,
                      })
                    }
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6B0F2A",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    👁 View Current Image
                  </button>
                )}
              </div>
              <ImageUploadField
                brandId={modal.brandId}
                currentUrl={modal._imageUrl || undefined}
                onUploaded={(url) =>
                  setModal((prev) =>
                    prev ? { ...prev, _imageUrl: url } : prev,
                  )
                }
              />
            </div>

            <div className="s-adminbrands-fcea5e">
              <button
                onClick={() => setModal(null)}
                className="s-adminbrands-5a7ba1"
                disabled={saveMutation.isPending}
              >
                {modal.brandId ? "Close" : "Cancel"}
              </button>
              <button
                onClick={() => modal && saveMutation.mutate(modal)}
                disabled={!modal.brandName.trim() || saveMutation.isPending}
                className="s-adminbrands-d3409f"
                style={{ opacity: !modal.brandName.trim() ? 0.5 : 1 }}
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : modal.brandId
                  ? "Save Changes"
                  : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Brand Confirm ── */}
      {confirm && (
        <div className="s-adminbrands-942dbe">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Delete "{confirm.brandName}"?
            </h3>
            <p className="s-adminbrands-93cf07">
              Deleting this brand will{" "}
              <strong>make all its products inactive</strong> and hide them from
              every user-facing page (categories, all-products, filters, brand
              page). The brand record is preserved in the database.
            </p>
            <p
              className="s-adminbrands-93cf07"
              style={{ fontSize: 11, color: "#999" }}
            >
              Admin products list will still show affected products with a
              "BRAND DELETED" badge.
            </p>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                disabled={deleteMutation.isPending}
                className="s-adminbrands-c554f0"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirm && deleteMutation.mutate(confirm.brandId)
                }
                disabled={deleteMutation.isPending}
                className="s-adminbrands-ad5bf3"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Image Confirm ── */}
      {confirmDelImage && (
        <DeleteImageModal
          brand={confirmDelImage}
          isPending={deleteImageMutation.isPending}
          onConfirm={() => deleteImageMutation.mutate(confirmDelImage.brandId)}
          onCancel={() => setConfirmDelImage(null)}
        />
      )}

      {/* ── Show Brand — Also show products? (asked BEFORE the API call) ── */}
      {productCascadeConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => {
            // Backdrop = "No" — unhide brand without cascading products
            toggleVisibilityMutation.mutate({
              brandId: productCascadeConfirm.brandId,
            });
            setProductCascadeConfirm(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 28px 22px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }}>👁</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              Also show all products under "{productCascadeConfirm.brandName}"?
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#666",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Do you also want to reactivate all products under this brand so
              customers can see them?{" "}
              <span style={{ color: "#999" }}>
                (No = products stay inactive; manage them individually from the
                Products page.)
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {/* Yes — ONE call: unhide brand + cascade products */}
              <button
                onClick={() => {
                  toggleVisibilityMutation.mutate({
                    brandId: productCascadeConfirm.brandId,
                    cascadeProducts: true,
                  });
                  setProductCascadeConfirm(null);
                }}
                disabled={toggleVisibilityMutation.isPending}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  background: "#2e7d32",
                  color: "#fff",
                }}
              >
                Yes, show all products
              </button>
              {/* No — ONE call: unhide brand only */}
              <button
                onClick={() => {
                  toggleVisibilityMutation.mutate({
                    brandId: productCascadeConfirm.brandId,
                  });
                  setProductCascadeConfirm(null);
                }}
                disabled={toggleVisibilityMutation.isPending}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "1.5px solid #ddd",
                  background: "#f9f9f9",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#444",
                }}
              >
                No, manage manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Viewer ── */}
      {viewImage && (
        <ImageViewerModal
          url={viewImage.url}
          name={viewImage.name}
          onClose={() => setViewImage(null)}
          onDelete={() => {
            const brand = brands.find((b) => b.brandId === viewImage.brandId);
            setViewImage(null);
            setConfirmDelImage(
              brand ?? {
                brandId: viewImage.brandId,
                brandName: viewImage.name,
                brandDescription: null,
                brandImage: viewImage.url,
                isActive: true,
              },
            );
          }}
        />
      )}
    </div>
  );
}
