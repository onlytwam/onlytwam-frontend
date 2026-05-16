import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { getImageUrl } from "@/shared/utils/helpers";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Brand {
  brandId: number;
  brandName: string;
  brandDescription: string | null;
  brandLogo: string | null;
  brandImage: string | null;
  isActive: boolean;
}

interface ModalState {
  brandId?: number;
  brandName: string;
  description: string;
  _logoFile: File | null;
  _existingLogo: string | null;
  // image fields (uploaded via dedicated /image endpoint after save)
  _existingImage: string | null;
  _imageUrl: string; // live URL returned after upload
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
  return getImageUrl(`/${src}`);
}

function buildBrandFormData(modal: ModalState): FormData {
  const fd = new FormData();
  fd.append("brandName", modal.brandName.trim());
  fd.append("brandDescription", modal.description.trim());
  fd.append("isActive", "true");
  if (modal._logoFile) fd.append("brandLogo", modal._logoFile);
  return fd;
}

// ─────────────────────────────────────────────
// Brand image upload hook  (mirrors useCategoryImageUpload)
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
// ImageUploadField  (identical UI to AdminCategories)
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
      {/* Preview box */}
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

      {/* File picker */}
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

      {/* Upload / clear buttons */}
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
// Main component
// ─────────────────────────────────────────────

export default function AdminBrands() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<Brand | null>(null);
  const [confirmDelImage, setConfirmDelImage] = useState<Brand | null>(null);

  // ── Query ───────────────────────────────────────────────────────────────────

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
        },
      });
      return data as { list: Brand[]; count: number };
    },
  });

  const brands = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (m: ModalState) => {
      if (!m.brandName.trim()) throw new Error("Brand name is required");
      const fd = buildBrandFormData(m);
      return m.brandId
        ? api.put(`/Brand/${m.brandId}`, fd)
        : api.post("/Brand/", fd);
    },
    onSuccess: (res, m) => {
      toast.success("Brand saved!");
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      if (m.brandId) {
        // Editing — close modal
        setModal(null);
      } else {
        // Creating — keep modal open so image can be uploaded
        const newId = res?.data?.brandId;
        setModal((prev) => (prev ? { ...prev, brandId: newId } : prev));
        if (newId) {
          toast("Brand created — you can now upload an image.", { icon: "🖼️" });
        }
      }
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? e?.message ?? "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (brandId: number) => api.delete(`/Brand/${brandId}`),
    onSuccess: () => {
      toast.success("Brand deleted");
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed — brand may be in use"),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (brandId: number) => api.delete(`/Brand/${brandId}/image`),
    onSuccess: () => {
      toast.success("Brand image removed.");
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      setConfirmDelImage(null);
      // Also clear the image in the open modal if applicable
      setModal((prev) =>
        prev ? { ...prev, _existingImage: null, _imageUrl: "" } : prev,
      );
    },
    onError: () => toast.error("Could not delete image."),
  });

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAdd = () =>
    setModal({
      brandName: "",
      description: "",
      _logoFile: null,
      _existingLogo: null,
      _existingImage: null,
      _imageUrl: "",
    });

  const openEdit = (b: Brand) =>
    setModal({
      brandId: b.brandId,
      brandName: b.brandName,
      description: b.brandDescription ?? "",
      _logoFile: null,
      _existingLogo: b.brandLogo ?? null,
      _existingImage: b.brandImage ?? null,
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
              {["Logo", "Image", "Name", "Description", "Actions"].map((h) => (
                <th key={h} className="s-adminbrands-84e069">
                  {h}
                </th>
              ))}
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
                const logoSrc = resolveImgSrc(b.brandLogo);
                const imageSrc = resolveImgSrc(b.brandImage);
                return (
                  <tr key={b.brandId} className="s-adminbrands-59d787">
                    {/* Logo */}
                    <td className="s-adminbrands-7dcd2c">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={b.brandName}
                          className="s-adminbrands-0c5599"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="s-adminbrands-6167ec">
                          <i className="bi bi-image s-adminbrands-95b451" />
                        </div>
                      )}
                    </td>

                    {/* Brand image */}
                    <td className="s-adminbrands-7dcd2c">
                      {imageSrc ? (
                        <div
                          style={{
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <img
                            src={imageSrc}
                            alt={`${b.brandName} image`}
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #e8ddd8",
                              display: "block",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                          {/* Quick-remove button */}
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
                        </div>
                      ) : (
                        <div className="s-adminbrands-6167ec">
                          <i className="bi bi-card-image s-adminbrands-95b451" />
                        </div>
                      )}
                    </td>

                    <td className="s-adminbrands-c25a6e">{b.brandName}</td>
                    <td className="s-adminbrands-6d0b42">
                      {b.brandDescription ?? "—"}
                    </td>

                    {/* Actions */}
                    <td className="s-adminbrands-7dcd2c">
                      <div className="s-adminbrands-ac734d">
                        <button
                          onClick={() => openEdit(b)}
                          className="s-adminbrands-6ea383"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirm(b)}
                          className="s-adminbrands-6ea383"
                        >
                          Delete
                        </button>
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

            {/* Name & Description */}
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

            {/* Logo upload (sent with save FormData) */}
            <div className="s-adminblog-22a617">
              <label className="s-addressform-f1fb64">Logo</label>
              {modal._existingLogo && !modal._logoFile && (
                <img
                  src={resolveImgSrc(modal._existingLogo)}
                  alt="current logo"
                  style={{
                    height: 40,
                    marginBottom: 6,
                    display: "block",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {modal._logoFile && (
                <img
                  src={URL.createObjectURL(modal._logoFile)}
                  alt="new logo preview"
                  style={{
                    height: 40,
                    marginBottom: 6,
                    display: "block",
                    objectFit: "contain",
                  }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                className="inp-field"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setModal((prev) =>
                    prev ? { ...prev, _logoFile: file } : prev,
                  );
                }}
              />
            </div>

            {/* Divider */}
            <hr style={{ margin: "12px 0", borderColor: "#ede6e1" }} />

            {/* Brand Image — dedicated upload endpoint (same as AdminCategories) */}
            <div className="s-adminblog-22a617">
              <label
                className="s-addressform-f1fb64"
                style={{ marginBottom: 6, display: "block" }}
              >
                Brand Image
              </label>
              <ImageUploadField
                brandId={modal.brandId}
                currentUrl={
                  modal._imageUrl || modal._existingImage || undefined
                }
                onUploaded={(url) =>
                  setModal((prev) =>
                    prev
                      ? { ...prev, _imageUrl: url, _existingImage: url }
                      : prev,
                  )
                }
              />
              {/* Show remove-image link when an image already exists */}
              {(modal._imageUrl || modal._existingImage) && modal.brandId && (
                <button
                  onClick={() =>
                    setConfirmDelImage(
                      brands.find((b) => b.brandId === modal.brandId) ?? null,
                    )
                  }
                  style={{
                    marginTop: 6,
                    background: "none",
                    border: "none",
                    color: "#c0392b",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  🗑 Remove image
                </button>
              )}
            </div>

            {/* Modal buttons */}
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
              This cannot be undone. Products linked to this brand may be
              affected.
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
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
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
    </div>
  );
}
