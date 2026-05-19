import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 15;
const primary = "#7A1E2C";
const primaryLt = "#F5E9E6";
const border = "#E6DAD3";
const grey = "#F3EFEC";
const sub = "#8A7F7A";
const txt = "#2B2B2B";

// ── Image helpers ─────────────────────────────────────────────────────────────
function resolveImg(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return "/" + src.replace(/\\/g, "/");
}

// ── Status helpers ────────────────────────────────────────────────────────────
interface StatusInfo {
  fullyActive: boolean;
  reasons: { label: string; type: "deleted" | "inactive" | "hidden" }[];
}

function getStatusInfo(p: any, isExplicitlyHidden?: boolean): StatusInfo {
  const reasons: StatusInfo["reasons"] = [];

  if (p.brandDeletedInd) {
    reasons.push({
      label: `Brand "${p.brandName || p.brandId}" has been deleted`,
      type: "deleted",
    });
  } else if (p.brandIsActive === false) {
    reasons.push({
      label: `Brand "${p.brandName || p.brandId}" is hidden`,
      type: "hidden",
    });
  }

  if (p.categoryDeletedInd) {
    reasons.push({
      label: `Category "${p.categoryName || p.categoryId}" has been deleted`,
      type: "deleted",
    });
  } else if (p.categoryIsActive === false) {
    reasons.push({
      label: `Category "${p.categoryName || p.categoryId}" is inactive`,
      type: "inactive",
    });
  }

  if (p.isActive === false && reasons.length === 0) {
    reasons.push({ label: "Product is hidden by admin", type: "inactive" });
  } else if (isExplicitlyHidden && reasons.length > 0) {
    reasons.unshift({ label: "Product is hidden by admin", type: "inactive" });
  }

  return { fullyActive: reasons.length === 0, reasons };
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({
  product,
  isExplicitlyHidden,
  onToggle,
  loading,
}: {
  product: any;
  isExplicitlyHidden?: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    above: boolean;
  }>({ top: 0, left: 0, above: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { fullyActive, reasons } = getStatusInfo(product, isExplicitlyHidden);
  const isOwnActive = product.isActive !== false;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const POPOVER_HEIGHT = 220;
        const MARGIN = 12;
        const spaceBelow = window.innerHeight - rect.bottom;
        const above = spaceBelow < POPOVER_HEIGHT + MARGIN;
        setPopoverPos({
          top: above ? rect.top - MARGIN : rect.bottom + MARGIN,
          left: rect.left + rect.width / 2,
          above,
        });
      }
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const pillBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 11px",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 20,
    whiteSpace: "nowrap",
    cursor: "pointer",
    border: "1.5px solid",
    transition: "all 0.15s",
    opacity: loading ? 0.6 : 1,
  };

  if (fullyActive) {
    return (
      <button
        onClick={onToggle}
        disabled={loading}
        title="Product is visible to customers. Click to hide."
        style={{
          ...pillBase,
          background: "#e8f5e9",
          color: "#2e7d32",
          borderColor: "#a5d6a7",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#43a047",
            display: "inline-block",
          }}
        />
        Active
      </button>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const POPOVER_HEIGHT = 220;
            const MARGIN = 12;
            const spaceBelow = window.innerHeight - rect.bottom;
            const above = spaceBelow < POPOVER_HEIGHT + MARGIN;
            setPopoverPos({
              top: above ? rect.top - MARGIN : rect.bottom + MARGIN,
              left: rect.left + rect.width / 2,
              above,
            });
          }
          setOpen((o) => !o);
        }}
        title="Click to see why this product is not visible"
        style={{
          ...pillBase,
          background: "#fdecea",
          color: "#c62828",
          borderColor: "#ef9a9a",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#e53935",
            display: "inline-block",
          }}
        />
        Inactive
        <i
          className={`bi bi-chevron-${open ? "up" : "down"}`}
          style={{ fontSize: 9, marginLeft: 2 }}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              transform: popoverPos.above
                ? "translateX(-50%) translateY(-100%)"
                : "translateX(-50%)",
              zIndex: 999999,
              background: "#fff",
              border: "1px solid #ef9a9a",
              borderRadius: 10,
              boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
              padding: "14px 16px",
              minWidth: 280,
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                position: "absolute",
                ...(popoverPos.above
                  ? {
                      bottom: -7,
                      borderBottom: "1px solid #ef9a9a",
                      borderRight: "1px solid #ef9a9a",
                      borderTop: "none",
                      borderLeft: "none",
                    }
                  : {
                      top: -7,
                      borderTop: "1px solid #ef9a9a",
                      borderLeft: "1px solid #ef9a9a",
                      borderBottom: "none",
                      borderRight: "none",
                    }),
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 12,
                height: 12,
                background: "#fff",
              }}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: "#b71c1c",
                marginBottom: 8,
              }}
            >
              <i className="bi bi-eye-slash-fill" /> Hidden from customers
            </div>
            <div style={{ fontSize: 11, color: "#777", marginBottom: 10 }}>
              This product is not visible because:
            </div>
            {reasons.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  color: r.type === "deleted" ? "#7f0000" : "#c62828",
                  marginBottom: 6,
                  background: r.type === "deleted" ? "#fff3e0" : "#fdecea",
                  borderRadius: 6,
                  padding: "5px 8px",
                }}
              >
                <i
                  className={`bi ${
                    r.type === "deleted" ? "bi-trash-fill" : "bi-eye-slash-fill"
                  }`}
                  style={{ fontSize: 12, marginTop: 1, flexShrink: 0 }}
                />
                <span>{r.label}</span>
              </div>
            ))}
            {isOwnActive &&
              reasons.some(
                (r) =>
                  r.label.includes("Brand") || r.label.includes("Category"),
              ) && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#888",
                    borderTop: `1px solid ${border}`,
                    paddingTop: 8,
                  }}
                >
                  Fix the brand / category issue to make this product visible
                  again.
                </div>
              )}
            {!isOwnActive &&
              !reasons.some(
                (r) =>
                  r.label.startsWith("Brand") || r.label.startsWith("Category"),
              ) && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onToggle();
                  }}
                  disabled={loading}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    background: "#e8f5e9",
                    color: "#2e7d32",
                    border: "1.5px solid #a5d6a7",
                    borderRadius: 7,
                    padding: "6px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  <i className="bi bi-eye" /> Make product active
                </button>
              )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Toggle pill ───────────────────────────────────────────────────────────────
function TogglePill({
  isActive,
  onToggle,
  loading,
}: {
  isActive: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={isActive ? "Click to deactivate" : "Click to activate"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        fontSize: 11,
        fontWeight: 700,
        background: isActive ? "#e8f5e9" : "#fdecea",
        color: isActive ? "#2e7d32" : "#c62828",
        border: `1.5px solid ${isActive ? "#a5d6a7" : "#ef9a9a"}`,
        borderRadius: 20,
        cursor: loading ? "wait" : "pointer",
        whiteSpace: "nowrap",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.18s",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isActive ? "#43a047" : "#e53935",
          display: "inline-block",
        }}
      />
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}

// ── Hide/Show button ──────────────────────────────────────────────────────────
function HideShowButton({
  isOwnActive,
  hasExternalReasons,
  isExplicitlyHidden,
  onToggle,
  loading,
}: {
  isOwnActive: boolean;
  hasExternalReasons: boolean;
  isExplicitlyHidden?: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  const showAsActive =
    (isOwnActive || hasExternalReasons) && !isExplicitlyHidden;
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={
        showAsActive
          ? "Hide product from customers"
          : "Show product to customers"
      }
      style={{
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 7,
        border: `1px solid ${showAsActive ? "#ffe082" : "#c8e6c9"}`,
        background: showAsActive ? "#fff8e1" : "#e8f5e9",
        color: showAsActive ? "#e65100" : "#2e7d32",
        cursor: loading ? "wait" : "pointer",
        whiteSpace: "nowrap",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {showAsActive ? "🙈 Hide" : "👁 Show"}
    </button>
  );
}

// ── Image modal ───────────────────────────────────────────────────────────────
function ImageModal({
  images,
  onClose,
}: {
  images: any[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          maxWidth: 520,
          width: "92%",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: sub,
          }}
        >
          ✕
        </button>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>
          Images ({images.length})
        </div>
        {images.length === 0 ? (
          <div style={{ textAlign: "center", color: sub, padding: "32px 0" }}>
            No images uploaded
          </div>
        ) : (
          <>
            <img
              src={images[idx]?.fileData || images[idx]?.filePath}
              alt=""
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 8,
                border: `1px solid ${border}`,
              }}
            />
            {images.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  overflowX: "auto",
                }}
              >
                {images.map((img: any, i: number) => (
                  <img
                    key={i}
                    src={img.fileData || img.filePath}
                    alt=""
                    onClick={() => setIdx(i)}
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: `2px solid ${i === idx ? primary : border}`,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── VariantDetailRow ──────────────────────────────────────────────────────────
function VariantDetailRow({
  pvd,
  sizes,
  cupSizes,
  onRefresh,
}: {
  pvd: any;
  sizes: any[];
  cupSizes: any[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const toggleActive = useMutation({
    mutationFn: () =>
      api.patch(
        `/ProductVariantDetail/${pvd.productVariantDetailId}/toggle-active`,
      ),
    onSuccess: () => {
      toast.success("Updated");
      onRefresh();
    },
    onError: () => toast.error("Failed"),
  });
  const saveEdit = useMutation({
    mutationFn: (data: any) =>
      api.put(`/ProductVariantDetail/${pvd.productVariantDetailId}`, data),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      onRefresh();
    },
    onError: () => toast.error("Save failed"),
  });
  const deletePvd = useMutation({
    mutationFn: () =>
      api.delete(`/ProductVariantDetail/${pvd.productVariantDetailId}`),
    onSuccess: () => {
      toast.success("Deleted");
      onRefresh();
    },
    onError: () => toast.error("Delete failed"),
  });

  function startEdit() {
    setForm({
      sizeId: pvd.sizeId || "",
      cupSizeId: pvd.cupSizeId || "",
      stockQuantity: pvd.stockQuantity ?? 0,
      availableQuantity: pvd.availableQuantity ?? 0,
      mrpPrice: pvd.mrpPrice ?? 0,
      finalPrice: pvd.finalPrice ?? 0,
      discountPercent: pvd.discountPercent ?? 0,
    });
    setEditing(true);
  }

  const iA = pvd.isActive !== false;
  const cell = { padding: "10px 12px" } as React.CSSProperties;

  if (editing)
    return (
      <tr style={{ background: "#fffdf0" }}>
        <td style={cell}>
          <select
            value={form.sizeId}
            onChange={(e) => setForm({ ...form, sizeId: e.target.value })}
            style={{
              width: "100%",
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
            }}
          >
            <option value="">— None —</option>
            {sizes.map((s: any) => (
              <option key={s.sizeId} value={s.sizeId}>
                {s.sizeLabel}
              </option>
            ))}
          </select>
        </td>
        <td style={cell}>
          <select
            value={form.cupSizeId}
            onChange={(e) => setForm({ ...form, cupSizeId: e.target.value })}
            style={{
              width: "100%",
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
            }}
          >
            <option value="">— None —</option>
            {cupSizes.map((c: any) => (
              <option key={c.cupSizeId} value={c.cupSizeId}>
                {c.sizeLabel}
              </option>
            ))}
          </select>
        </td>
        <td style={cell}>
          <input
            type="number"
            value={form.stockQuantity}
            onChange={(e) =>
              setForm({ ...form, stockQuantity: e.target.value })
            }
            style={{
              width: 70,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
            }}
          />
        </td>
        <td style={{ ...cell, fontSize: 12, color: sub }}>
          {pvd.processedQuantity ?? 0} sold
        </td>
        <td style={{ ...cell, fontSize: 12, color: sub }}>
          {pvd.availableQuantity ?? 0} avail
        </td>
        <td style={cell}>
          <input
            type="number"
            value={form.mrpPrice}
            onChange={(e) => setForm({ ...form, mrpPrice: e.target.value })}
            style={{
              width: 80,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
            }}
          />
        </td>
        <td style={cell}>
          <input
            type="number"
            value={form.finalPrice}
            onChange={(e) => setForm({ ...form, finalPrice: e.target.value })}
            style={{
              width: 80,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
            }}
          />
        </td>
        <td style={{ ...cell, fontSize: 12 }}>—</td>
        <td style={cell}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => saveEdit.mutate(form)}
              disabled={saveEdit.isPending}
              style={{
                background: primary,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {saveEdit.isPending ? "…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                background: grey,
                color: txt,
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );

  return (
    <tr
      style={{
        background: iA ? "transparent" : "#fff8f8",
        opacity: iA ? 1 : 0.65,
      }}
    >
      <td style={{ ...cell, fontSize: 12 }}>{pvd.sizeLabel || "—"}</td>
      <td style={{ ...cell, fontSize: 12 }}>{pvd.cupSizeLabel || "—"}</td>
      <td style={{ ...cell, fontSize: 12, fontWeight: 600 }}>
        {pvd.stockQuantity ?? 0}
      </td>
      <td style={{ ...cell, fontSize: 12, color: sub }}>
        {pvd.processedQuantity ?? 0} sold
      </td>
      <td style={{ ...cell, fontSize: 12, color: sub }}>
        {pvd.availableQuantity ?? 0} avail
      </td>
      <td style={{ ...cell, fontSize: 12 }}>
        ₹{pvd.mrpPrice?.toFixed(2) ?? "—"}
      </td>
      <td style={{ ...cell, fontSize: 12, fontWeight: 600, color: primary }}>
        ₹{pvd.finalPrice?.toFixed(2) ?? "—"}
      </td>
      <td style={cell}>
        <TogglePill
          isActive={iA}
          onToggle={() => toggleActive.mutate()}
          loading={toggleActive.isPending}
        />
      </td>
      <td style={cell}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={startEdit}
            style={{
              background: primaryLt,
              color: primary,
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <i className="bi bi-pencil" />
          </button>
          <button
            onClick={() => {
              if (window.confirm("Delete this size/detail?"))
                deletePvd.mutate();
            }}
            style={{
              background: "#fdecea",
              color: "#c62828",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── VariantDetailPanel ────────────────────────────────────────────────────────
function VariantDetailPanel({ variantId }: { variantId: number }) {
  const { data: pvdData, refetch } = useQuery({
    queryKey: ["pvd-list", variantId],
    queryFn: () =>
      api
        .get("/ProductVariantDetail/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "productVariantId",
                comparison: "eq",
                value: String(variantId),
              },
            ]),
            "Page.Size": 100,
          },
        })
        .then((r) => r.data),
  });
  const { data: sizesData } = useQuery({
    queryKey: ["sizes-all"],
    queryFn: () => api.get("/Size/").then((r) => r.data?.list || r.data || []),
  });
  const { data: cupSizesData } = useQuery({
    queryKey: ["cupsizes-all"],
    queryFn: () =>
      api.get("/CupSize/").then((r) => r.data?.list || r.data || []),
  });

  const pvds = pvdData?.list ?? [];
  const sizes = Array.isArray(sizesData) ? sizesData : [];
  const cups = Array.isArray(cupSizesData) ? cupSizesData : [];
  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: sub,
    borderBottom: `1px solid ${border}`,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "0 0 14px 48px" }}>
      <div
        style={{
          background: "#fffcf9",
          border: `1px solid ${border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: "#faf4f0",
            borderBottom: `1px solid ${border}`,
            fontSize: 12,
            fontWeight: 700,
            color: sub,
          }}
        >
          <i className="bi bi-grid-3x3-gap" /> Size / Detail breakdown (
          {pvds.length})
        </div>
        {pvds.length === 0 ? (
          <div style={{ padding: "16px 14px", fontSize: 12, color: sub }}>
            No size details found
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f3f0" }}>
                  {[
                    "Size",
                    "Cup Size",
                    "Stock Added",
                    "Sold",
                    "Available",
                    "MRP",
                    "Final Price",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvds.map((pvd: any) => (
                  <VariantDetailRow
                    key={pvd.productVariantDetailId}
                    pvd={pvd}
                    sizes={sizes}
                    cupSizes={cups}
                    onRefresh={refetch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── VariantRow ────────────────────────────────────────────────────────────────
function VariantRow({
  variant,
  productId,
  onNavigate,
}: {
  variant: any;
  productId: number;
  onNavigate: (id: number) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [imgData, setImgData] = useState<any[]>([]);

  const toggleActive = useMutation({
    mutationFn: () =>
      api.patch(`/ProductVariants/${variant.productVariantId}/toggle-active`),
    onSuccess: () => toast.success("Variant updated"),
    onError: () => toast.error("Failed"),
  });

  async function openImages() {
    try {
      const r = await api.get(
        `/ProductVariants/${variant.productVariantId}/images`,
      );
      setImgData(r.data?.images || r.data || []);
    } catch {
      setImgData([]);
    }
    setImgOpen(true);
  }

  const isActive = variant.isActive !== false;
  const color = variant.color;

  return (
    <>
      <tr
        style={{
          background: isActive ? "transparent" : "#fff8f8",
          opacity: isActive ? 1 : 0.72,
        }}
      >
        <td style={{ padding: "10px 12px", width: 32 }}>
          <button
            onClick={() => setDetailOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: sub,
              fontSize: 14,
            }}
          >
            <i className={`bi bi-chevron-${detailOpen ? "down" : "right"}`} />
          </button>
        </td>
        <td style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {color && (
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: color,
                  border: `1px solid ${border}`,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {variant.variantName || "—"}
              </div>
              {color && <div style={{ fontSize: 11, color: sub }}>{color}</div>}
            </div>
          </div>
        </td>
        <td style={{ padding: "10px 12px", fontSize: 12, color: sub }}>
          {variant.productCode || "—"}
        </td>
        <td style={{ padding: "10px 12px", fontSize: 12 }}>
          {variant.isCupSize ? "Cup Size" : "Regular"}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <TogglePill
            isActive={isActive}
            onToggle={() => toggleActive.mutate()}
            loading={toggleActive.isPending}
          />
        </td>
        <td style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={openImages}
              title="View images"
              style={{
                background: "#e3f2fd",
                color: "#1565c0",
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <i className="bi bi-images" />
            </button>
            <button
              onClick={() => onNavigate(variant.productVariantId)}
              title="Edit variant"
              style={{
                background: primaryLt,
                color: primary,
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <i className="bi bi-pencil" />
            </button>
          </div>
        </td>
      </tr>
      {detailOpen && (
        <tr>
          <td
            colSpan={6}
            style={{ padding: 0, borderBottom: `1px solid ${border}` }}
          >
            <VariantDetailPanel variantId={variant.productVariantId} />
          </td>
        </tr>
      )}
      {imgOpen && (
        <ImageModal images={imgData} onClose={() => setImgOpen(false)} />
      )}
    </>
  );
}

// ── VariantPanel ──────────────────────────────────────────────────────────────
function VariantPanel({ productId }: { productId: number }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["variants", productId],
    queryFn: () =>
      api
        .get("/ProductVariants/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "productId",
                comparison: "eq",
                value: String(productId),
              },
            ]),
            "Page.Size": 100,
          },
        })
        .then((r) => r.data),
  });

  const variants = data?.list ?? [];
  const total = data?.count ?? 0;
  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: sub,
    borderBottom: `1px solid ${border}`,
  };

  return (
    <div style={{ padding: "0 0 16px 32px" }}>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${border}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            background: primaryLt,
            borderBottom: `1px solid ${border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: primary }}>
            <i className="bi bi-layers" /> {total} Variant
            {total !== 1 ? "s" : ""}
          </div>
          <button
            onClick={() => navigate(`/admin/products/${productId}`)}
            style={{
              background: primary,
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "5px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <i className="bi bi-plus" /> Add Variant
          </button>
        </div>
        {isLoading ? (
          <div style={{ padding: "20px 16px", fontSize: 12, color: sub }}>
            Loading variants…
          </div>
        ) : variants.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              fontSize: 12,
              color: sub,
              textAlign: "center",
            }}
          >
            No variants found
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: grey }}>
                <th style={{ width: 32 }} />
                {["Color / Name", "Code", "Type", "Status", "Actions"].map(
                  (h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {variants.map((v: any) => (
                <VariantRow
                  key={v.productVariantId}
                  variant={v}
                  productId={productId}
                  onNavigate={(vid) =>
                    navigate(`/admin/products/${productId}?variant=${vid}`)
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Icon card (used for brands, categories) ───────────────────────────────────
// Matches TwamBrands card: 3:1 banner image + name below
function BannerCard({
  image,
  name,
  count,
  onClick,
  isActive = true,
  badge,
}: {
  image?: string | null;
  name: string;
  count?: number;
  onClick: () => void;
  isActive?: boolean;
  badge?: string;
}) {
  const imgSrc = resolveImg(image);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #f5f0e6",
        borderRadius: 8,
        padding: 0,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        transition: "all 0.2s",
        background: "#fff",
        textAlign: "left",
        overflow: "hidden",
        opacity: isActive ? 1 : 0.62,
        width: "100%",
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = primary;
        b.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
        b.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = "#f5f0e6";
        b.style.boxShadow = "none";
        b.style.transform = "none";
      }}
    >
      {/* 3:1 banner frame */}
      <span
        style={{
          width: "100%",
          aspectRatio: "3 / 1",
          background: "#f5f0e6",
          display: "block",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <i
              className="bi bi-image"
              style={{ fontSize: 30, color: "#c8b8b0" }}
            />
          </span>
        )}
        {badge && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: badge === "DELETED" ? "#c62828" : "#e65100",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {badge}
          </span>
        )}
      </span>
      {/* name + count */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 14px 13px",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#000",
            lineHeight: 1.3,
          }}
        >
          {name}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: count > 0 ? primaryLt : grey,
              color: count > 0 ? primary : sub,
              borderRadius: 20,
              padding: "2px 9px",
              flexShrink: 0,
            }}
          >
            {count} {count === 1 ? "product" : "products"}
          </span>
        )}
      </span>
    </button>
  );
}

// ── Breadcrumb bar ────────────────────────────────────────────────────────────
function Breadcrumbs({
  crumbs,
  onNavigate,
}: {
  crumbs: { label: string; onClick?: () => void }[];
  onNavigate: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && (
            <i
              className="bi bi-chevron-right"
              style={{ fontSize: 10, color: sub }}
            />
          )}
          <span
            onClick={c.onClick ? c.onClick : undefined}
            style={{
              color: c.onClick ? primary : txt,
              fontWeight: c.onClick ? 600 : 700,
              cursor: c.onClick ? "pointer" : "default",
              textDecoration: c.onClick ? "underline" : "none",
            }}
          >
            {c.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Products table ────────────────────────────────────────────────────────────
function ProductsTable({
  brandId,
  categoryId,
  totalLabel,
}: {
  brandId?: number;
  categoryId?: number;
  totalLabel: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [confirmDelete, setConfirm] = useState<any>(null);
  const [explicitlyHiddenIds, setExplicitlyHiddenIds] = useState<Set<number>>(
    new Set(),
  );

  const buildParams = useCallback(() => {
    const filters: any[] = [];
    if (brandId !== undefined)
      filters.push({
        property: "brandId",
        comparison: "eq",
        value: String(brandId),
      });
    if (categoryId !== undefined)
      filters.push({
        property: "categoryId",
        comparison: "eq",
        value: String(categoryId),
      });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index": page,
      "Page.Size": PAGE_SIZE,
      "Order.Property": "ModifiedDate",
      "Order.Ascending": "false",
    };
  }, [brandId, categoryId, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products-filtered", brandId, categoryId, page],
    queryFn: () =>
      api
        .get("/Products/", { params: { ...buildParams(), adminView: true } })
        .then((r) => r.data),
  });

  const toggleProduct = useMutation({
    mutationFn: (id: number) => api.patch(`/Products/${id}/toggle-active`),
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const handleToggleProduct = (p: any) => {
    const hasExt =
      p.brandIsActive === false ||
      !!p.brandDeletedInd ||
      p.categoryIsActive === false ||
      !!p.categoryDeletedInd;
    const isExpHidden = explicitlyHiddenIds.has(p.productId);
    if (hasExt && p.isActive === false && !isExpHidden) {
      setExplicitlyHiddenIds((prev) => new Set([...prev, p.productId]));
    } else if (hasExt && isExpHidden) {
      setExplicitlyHiddenIds((prev) => {
        const s = new Set(prev);
        s.delete(p.productId);
        return s;
      });
    } else {
      toggleProduct.mutate(p.productId);
    }
  };

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/Products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const products = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div>
      <div style={{ fontSize: 13, color: sub, marginBottom: 14 }}>
        {isLoading
          ? "Loading…"
          : `${total} product${total !== 1 ? "s" : ""} in ${totalLabel}`}
      </div>

      <div className="s-adminbrands-a637bc">
        <div className="s-admindashboa-ce7380">
          <table className="s-adminbrands-de3642">
            <thead>
              <tr className="s-admininvento-d3aab0">
                <th className="s-admininvento-947fb4" style={{ width: 40 }} />
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
                    <td colSpan={8} className="s-adminorders-652ef8">
                      <div className="s-adminorders-ac15d0" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="s-admininvento-2925c8">
                    <i className="bi bi-box-seam s-adminorders-9fdb4f" /> No
                    products found
                  </td>
                </tr>
              ) : (
                products.flatMap((p: any) => {
                  const isExpanded = expandedProduct === p.productId;
                  const isOwnActive = p.isActive !== false;
                  const { fullyActive } = getStatusInfo(p);
                  const rows: any[] = [];

                  rows.push(
                    <tr
                      key={p.productId}
                      className="s-adminbrands-59d787"
                      style={{
                        background: isExpanded
                          ? primaryLt
                          : fullyActive
                          ? "transparent"
                          : "#fff8f8",
                        opacity: fullyActive ? 1 : 0.8,
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded)
                          e.currentTarget.style.background = "var(--ivory)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isExpanded
                          ? primaryLt
                          : fullyActive
                          ? "transparent"
                          : "#fff8f8";
                      }}
                    >
                      {/* Expand */}
                      <td
                        className="s-adminbrands-7dcd2c"
                        style={{ width: 40 }}
                      >
                        <button
                          onClick={() =>
                            setExpandedProduct(isExpanded ? null : p.productId)
                          }
                          title={
                            isExpanded ? "Collapse variants" : "View variants"
                          }
                          style={{
                            background: isExpanded ? primary : "none",
                            color: isExpanded ? "#fff" : sub,
                            border: isExpanded ? "none" : `1px solid ${border}`,
                            borderRadius: 6,
                            width: 28,
                            height: 28,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                          }}
                        >
                          <i
                            className={`bi bi-chevron-${
                              isExpanded ? "down" : "right"
                            }`}
                          />
                        </button>
                      </td>

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
                              (e.target as HTMLImageElement).style.opacity =
                                "0";
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              background: grey,
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <i
                              className="bi bi-image"
                              style={{ color: sub, fontSize: 18 }}
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
                        <span
                          style={{
                            color: p.brandDeletedInd
                              ? "#c62828"
                              : p.brandIsActive === false
                              ? "#e65100"
                              : undefined,
                          }}
                        >
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
                        <span
                          style={{
                            color: p.categoryDeletedInd
                              ? "#c62828"
                              : p.categoryIsActive === false
                              ? "#e65100"
                              : undefined,
                          }}
                        >
                          {p.categoryName || "—"}
                        </span>
                        {p.categoryDeletedInd && (
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
                        {!p.categoryDeletedInd &&
                          p.categoryIsActive === false && (
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
                              INACTIVE
                            </span>
                          )}
                      </td>

                      {/* Status */}
                      <td
                        className="s-adminbrands-7dcd2c"
                        style={{ textAlign: "center" }}
                      >
                        <StatusPill
                          product={p}
                          isExplicitlyHidden={explicitlyHiddenIds.has(
                            p.productId,
                          )}
                          onToggle={() => handleToggleProduct(p)}
                          loading={toggleProduct.isPending}
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
                          <HideShowButton
                            isOwnActive={isOwnActive}
                            hasExternalReasons={
                              p.brandIsActive === false ||
                              !!p.brandDeletedInd ||
                              p.categoryIsActive === false ||
                              !!p.categoryDeletedInd
                            }
                            isExplicitlyHidden={explicitlyHiddenIds.has(
                              p.productId,
                            )}
                            onToggle={() => handleToggleProduct(p)}
                            loading={toggleProduct.isPending}
                          />
                          <button
                            onClick={() => setConfirm(p)}
                            className="s-adminproduct-d37b04"
                            title="Delete"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                  );

                  if (isExpanded) {
                    rows.push(
                      <tr key={`${p.productId}-variants`}>
                        <td
                          colSpan={8}
                          style={{
                            padding: 0,
                            borderBottom: `2px solid ${border}`,
                          }}
                        >
                          <VariantPanel productId={p.productId} />
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>

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

// ── Banner card grid (matches TwamBrands layout) ─────────────────────────────
function BannerGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
        gap: 24,
        padding: "4px 0 28px",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE BY BRAND
// ─────────────────────────────────────────────────────────────────────────────

type BrandLevel =
  | { view: "brands" }
  | { view: "categories"; brand: any }
  | { view: "subcategories"; brand: any; category: any }
  | { view: "products"; brand: any; category?: any; subCategory?: any };

function BrowseByBrand({ onCreateProduct }: { onCreateProduct: () => void }) {
  const navigate = useNavigate();
  const [level, setLevel] = useState<BrandLevel>({ view: "brands" });

  // All brands (admin — include inactive so admin can see them)
  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: ["admin-brands-browse"],
    queryFn: () =>
      api
        .get("/Brand/", { params: { showAll: true, "Page.Size": 200 } })
        .then((r) => r.data),
  });
  const brands: any[] = brandsData?.list ?? [];

  // All categories (flat list, admin)
  const { data: catsData, isLoading: catsLoading } = useQuery({
    queryKey: ["admin-cats-browse"],
    queryFn: () =>
      api
        .get("/Category/", { params: { "Page.Size": 500 } })
        .then((r) => r.data),
  });
  const allCats: any[] = catsData?.list ?? [];

  // ── Derive categories to show for a brand ────────────────────────────────
  // We get products filtered by brandId, collect all unique categoryIds,
  // then show only parent categories (parentCategoryId == null) that appear.
  // Products fetch to get category presence.
  const selectedBrand = level.view !== "brands" ? (level as any).brand : null;
  const selectedCat =
    level.view === "subcategories" ||
    (level.view === "products" && (level as any).category)
      ? (level as any).category
      : null;

  // Fetch all products for this brand (lightweight — just for category presence)
  const { data: brandProductsData } = useQuery({
    queryKey: ["brand-products-meta", selectedBrand?.brandId],
    enabled: !!selectedBrand,
    queryFn: () =>
      api
        .get("/Products/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "brandId",
                comparison: "eq",
                value: String(selectedBrand.brandId),
              },
            ]),
            "Page.Size": 1000,
            adminView: true,
          },
        })
        .then((r) => r.data),
  });
  const brandProducts: any[] = brandProductsData?.list ?? [];

  // categoryIds present in this brand
  const catIdsInBrand = new Set(
    brandProducts.map((p: any) => p.categoryId).filter(Boolean),
  );

  // parent categories (parentCategoryId == null) that appear in this brand
  const parentCatsInBrand = allCats.filter(
    (c) => !c.parentCategoryId && catIdsInBrand.has(c.categoryId),
  );

  // If category has NO children → products live directly here.
  // If category HAS children → show subcategory icons.
  const getChildCats = (catId: number) =>
    allCats.filter(
      (c) => c.parentCategoryId === catId && catIdsInBrand.has(c.categoryId),
    );

  // count products per category (within brand)
  const countInCat = (catId: number) =>
    brandProducts.filter((p: any) => p.categoryId === catId).length;

  // ── Breadcrumbs ──────────────────────────────────────────────────────────
  function buildCrumbs() {
    const crumbs: { label: string; onClick?: () => void }[] = [
      {
        label: "All Brands",
        onClick:
          level.view !== "brands"
            ? () => setLevel({ view: "brands" })
            : undefined,
      },
    ];
    if (level.view !== "brands") {
      const b = (level as any).brand;
      crumbs.push({
        label: b.brandName,
        onClick:
          level.view !== "categories"
            ? () => setLevel({ view: "categories", brand: b })
            : undefined,
      });
    }
    if (
      level.view === "subcategories" ||
      (level.view === "products" && (level as any).category)
    ) {
      const b = (level as any).brand;
      const cat = (level as any).category;
      crumbs.push({
        label: cat.name,
        onClick:
          level.view === "products" && (level as any).subCategory
            ? () => {
                const children = getChildCats(cat.categoryId);
                if (children.length)
                  setLevel({ view: "subcategories", brand: b, category: cat });
                else setLevel({ view: "products", brand: b, category: cat });
              }
            : undefined,
      });
    }
    if (level.view === "products" && (level as any).subCategory) {
      crumbs.push({ label: (level as any).subCategory.name });
    }
    return crumbs;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (level.view === "brands") {
    return (
      <div>
        {brandsLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            Loading brands…
          </div>
        ) : brands.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            No brands found
          </div>
        ) : (
          <BannerGrid>
            {brands.map((b: any) => (
              <BannerCard
                key={b.brandId}
                image={b.brandImage}
                name={b.brandName}
                isActive={b.isActive !== false}
                badge={
                  b.deletedInd
                    ? "DELETED"
                    : b.isActive === false
                    ? "HIDDEN"
                    : undefined
                }
                onClick={() => setLevel({ view: "categories", brand: b })}
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  const brand = (level as any).brand;

  if (level.view === "categories") {
    const isLoadingCats = catsLoading || !brandProductsData;
    return (
      <div>
        <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
        {isLoadingCats ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            Loading categories…
          </div>
        ) : parentCatsInBrand.length === 0 ? (
          // No categories at all — show products directly
          <ProductsTable brandId={brand.brandId} totalLabel={brand.brandName} />
        ) : (
          <BannerGrid>
            {parentCatsInBrand.map((cat: any) => (
              <BannerCard
                key={cat.categoryId}
                image={cat.categoryImage}
                name={cat.name}
                count={countInCat(cat.categoryId)}
                isActive={cat.isActive !== false}
                badge={cat.isActive === false ? "INACTIVE" : undefined}
                onClick={() => {
                  const children = getChildCats(cat.categoryId);
                  if (children.length > 0) {
                    setLevel({ view: "subcategories", brand, category: cat });
                  } else {
                    setLevel({ view: "products", brand, category: cat });
                  }
                }}
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  if (level.view === "subcategories") {
    const cat = (level as any).category;
    const children = getChildCats(cat.categoryId);
    return (
      <div>
        <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
        {children.length === 0 ? (
          <ProductsTable
            brandId={brand.brandId}
            categoryId={cat.categoryId}
            totalLabel={cat.name}
          />
        ) : (
          <BannerGrid>
            {children.map((subItem: any) => (
              <BannerCard
                key={subItem.categoryId}
                image={subItem.categoryImage}
                name={subItem.name}
                count={countInCat(subItem.categoryId)}
                isActive={subItem.isActive !== false}
                badge={subItem.isActive === false ? "INACTIVE" : undefined}
                onClick={() =>
                  setLevel({
                    view: "products",
                    brand,
                    category: cat,
                    subCategory: subItem,
                  })
                }
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  // products
  const cat = (level as any).category;
  const subCat = (level as any).subCategory;
  const targetCat = subCat || cat;
  return (
    <div>
      <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
      <ProductsTable
        brandId={brand.brandId}
        categoryId={targetCat?.categoryId}
        totalLabel={targetCat?.name || brand.brandName}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE BY CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

type CatLevel =
  | { view: "categories" }
  | { view: "subcategories"; category: any }
  | { view: "brands"; category: any; subCategory?: any }
  | { view: "products"; category: any; subCategory?: any; brand: any };

function BrowseByCategory({
  onCreateProduct,
}: {
  onCreateProduct: () => void;
}) {
  const navigate = useNavigate();
  const [level, setLevel] = useState<CatLevel>({ view: "categories" });

  // All categories (admin)
  const { data: catsData, isLoading: catsLoading } = useQuery({
    queryKey: ["admin-cats-browse"],
    queryFn: () =>
      api
        .get("/Category/", { params: { "Page.Size": 500 } })
        .then((r) => r.data),
  });
  const allCats: any[] = catsData?.list ?? [];

  // All brands
  const { data: brandsData } = useQuery({
    queryKey: ["admin-brands-browse"],
    queryFn: () =>
      api
        .get("/Brand/", { params: { showAll: true, "Page.Size": 200 } })
        .then((r) => r.data),
  });
  const allBrands: any[] = brandsData?.list ?? [];

  const selectedCat =
    level.view !== "categories" ? (level as any).category : null;
  const selectedSubCat =
    level.view === "brands" || level.view === "products"
      ? (level as any).subCategory
      : null;

  // Fetch all products for the active category (to find which brands are present)
  const activeCatId = selectedSubCat?.categoryId ?? selectedCat?.categoryId;
  const { data: catProductsData } = useQuery({
    queryKey: ["cat-products-meta", activeCatId],
    enabled: !!activeCatId,
    queryFn: () =>
      api
        .get("/Products/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "categoryId",
                comparison: "eq",
                value: String(activeCatId),
              },
            ]),
            "Page.Size": 1000,
            adminView: true,
          },
        })
        .then((r) => r.data),
  });
  const catProducts: any[] = catProductsData?.list ?? [];

  // top-level (parent) categories
  const parentCats = allCats.filter((c) => !c.parentCategoryId);
  const getChildCats = (catId: number) =>
    allCats.filter((c) => c.parentCategoryId === catId);

  // brands present in a given set of products
  const brandIdsInCat = new Set(
    catProducts.map((p: any) => p.brandId).filter(Boolean),
  );
  const brandsInCat = allBrands.filter((b: any) =>
    brandIdsInCat.has(b.brandId),
  );

  const countInBrand = (brandId: number) =>
    catProducts.filter((p: any) => p.brandId === brandId).length;

  function buildCrumbs() {
    const crumbs: { label: string; onClick?: () => void }[] = [
      {
        label: "All Categories",
        onClick:
          level.view !== "categories"
            ? () => setLevel({ view: "categories" })
            : undefined,
      },
    ];
    if (level.view !== "categories") {
      const cat = (level as any).category;
      crumbs.push({
        label: cat.name,
        onClick:
          level.view !== "subcategories"
            ? () => {
                const children = getChildCats(cat.categoryId);
                if (children.length)
                  setLevel({ view: "subcategories", category: cat });
                else setLevel({ view: "brands", category: cat });
              }
            : undefined,
      });
    }
    if (
      (level.view === "brands" || level.view === "products") &&
      (level as any).subCategory
    ) {
      const subCat = (level as any).subCategory;
      crumbs.push({
        label: subCat.name,
        onClick:
          level.view === "products"
            ? () =>
                setLevel({
                  view: "brands",
                  category: (level as any).category,
                  subCategory: subCat,
                })
            : undefined,
      });
    }
    if (level.view === "products") {
      crumbs.push({ label: (level as any).brand?.brandName });
    }
    return crumbs;
  }

  if (level.view === "categories") {
    return (
      <div>
        {catsLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            Loading categories…
          </div>
        ) : parentCats.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            No categories found
          </div>
        ) : (
          <BannerGrid>
            {parentCats.map((cat: any) => (
              <BannerCard
                key={cat.categoryId}
                image={cat.categoryImage}
                name={cat.name}
                isActive={cat.isActive !== false}
                onClick={() => {
                  const children = getChildCats(cat.categoryId);
                  if (children.length)
                    setLevel({ view: "subcategories", category: cat });
                  else setLevel({ view: "brands", category: cat });
                }}
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  if (level.view === "subcategories") {
    const cat = (level as any).category;
    const children = getChildCats(cat.categoryId);
    return (
      <div>
        <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
        {children.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            No sub-categories
          </div>
        ) : (
          <BannerGrid>
            {children.map((subItem: any) => (
              <BannerCard
                key={subItem.categoryId}
                image={subItem.categoryImage}
                name={subItem.name}
                isActive={subItem.isActive !== false}
                onClick={() =>
                  setLevel({
                    view: "brands",
                    category: cat,
                    subCategory: subItem,
                  })
                }
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  if (level.view === "brands") {
    const cat = (level as any).category;
    const subCat = (level as any).subCategory;
    const isLoadingBrands = !catProductsData;
    return (
      <div>
        <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
        {isLoadingBrands ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: sub }}>
            Loading brands…
          </div>
        ) : brandsInCat.length === 0 ? (
          // No brands → show products directly
          <ProductsTable
            categoryId={activeCatId}
            totalLabel={subCat?.name || cat.name}
          />
        ) : (
          <BannerGrid>
            {brandsInCat.map((b: any) => (
              <BannerCard
                key={b.brandId}
                image={b.brandImage}
                name={b.brandName}
                count={countInBrand(b.brandId)}
                isActive={b.isActive !== false}
                onClick={() =>
                  setLevel({
                    view: "products",
                    category: cat,
                    subCategory: subCat,
                    brand: b,
                  })
                }
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  // products
  const cat = (level as any).category;
  const subCat = (level as any).subCategory;
  const brand = (level as any).brand;
  return (
    <div>
      <Breadcrumbs crumbs={buildCrumbs()} onNavigate={() => {}} />
      <ProductsTable
        brandId={brand.brandId}
        categoryId={activeCatId}
        totalLabel={`${subCat?.name || cat.name} › ${brand.brandName}`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AdminProducts
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminProducts() {
  const navigate = useNavigate();
  const [browseBy, setBrowseBy] = useState<"brands" | "categories">("brands");
  // Reset browse state when switching modes
  const [browseKey, setBrowseKey] = useState(0);

  function handleBrowseChange(val: "brands" | "categories") {
    setBrowseBy(val);
    setBrowseKey((k) => k + 1);
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Products</h2>
          <p className="s-adminblog-1c2c10">
            Browse and manage products by brand or category
          </p>
        </div>
        <div
          className="s-adminproduct-0f6417"
          style={{ gap: 12, alignItems: "center" }}
        >
          {/* Browse-by dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: sub,
                whiteSpace: "nowrap",
              }}
            >
              Browse by
            </label>
            <select
              value={browseBy}
              onChange={(e) =>
                handleBrowseChange(e.target.value as "brands" | "categories")
              }
              style={{
                border: `1.5px solid ${border}`,
                borderRadius: 8,
                padding: "7px 32px 7px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: txt,
                background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16'%3E%3Cpath fill='%238A7F7A' d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") no-repeat right 10px center`,
                appearance: "none",
                cursor: "pointer",
                outline: "none",
                minWidth: 130,
              }}
            >
              <option value="brands">Brands</option>
              <option value="categories">Categories</option>
            </select>
          </div>

          <button
            onClick={() => navigate("/admin/products/new")}
            className="s-adminproduct-1f0204"
          >
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
        </div>
      </div>

      {/* ── Browse panel ── */}
      <div className="s-adminbrands-a637bc" style={{ padding: "20px 24px" }}>
        {browseBy === "brands" ? (
          <BrowseByBrand
            key={browseKey}
            onCreateProduct={() => navigate("/admin/products/new")}
          />
        ) : (
          <BrowseByCategory
            key={browseKey}
            onCreateProduct={() => navigate("/admin/products/new")}
          />
        )}
      </div>
    </div>
  );
}
