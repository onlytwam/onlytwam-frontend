/**
 * AdminProductDetail.tsx — v3
 * Layout mirrors the user-side ProductDetail:
 *   LEFT  (sticky) : per-variant image gallery with per-image upload / delete
 *   RIGHT (scroll)  : all product + variant info, every field editable on click
 *
 * Variants shown as colour swatches (like user side).
 * Selecting a swatch updates the left-column images.
 * Sizes shown as chips with live stock count; click to expand inline edit.
 * "Hide / Show Variant" sits where Buy-Now / Add-to-Cart would be on the user page.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

// ─── Design tokens (same palette as the rest of the admin) ───────────────────
const P = "#7A1E2C";
const PLT = "#F5E9E6";
const BDR = "#E6DAD3";
const GRY = "#F3EFEC";
const TXT = "#2B2B2B";
const SUB = "#8A7F7A";
const BG = "#FAF7F4";
const WHITE = "#ffffff";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function imgUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return "http://127.0.0.1:8000/" + src.replace(/\\/g, "/");
}

function resolveColor(c: string | null | undefined): string {
  if (!c) return "#d0c8c2";
  const s = c.trim();
  if (s.startsWith("#") || s.startsWith("rgb")) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  return s;
}

const fieldStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: "none",
  borderBottom: `1.5px solid ${BDR}`,
  padding: "8px 0",
  fontSize: 14,
  color: TXT,
  background: "transparent",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  ...extra,
});

// ─── Inline editable text/textarea ───────────────────────────────────────────
function InlineField({
  label,
  value,
  multiline = false,
  placeholder = "Click to edit…",
  onSave,
  large,
}: {
  label?: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  onSave: (v: string) => void;
  large?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  const viewStyle: React.CSSProperties = {
    fontSize: large ? 22 : 14,
    fontWeight: large ? 700 : 400,
    color: value ? TXT : SUB,
    cursor: "pointer",
    padding: "6px 0",
    borderBottom: `1.5px dashed ${BDR}`,
    minHeight: 32,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: large ? 1.3 : 1.6,
  };

  return (
    <div style={{ marginBottom: label ? 18 : 0 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 5,
          }}
        >
          {label}
        </div>
      )}
      {editing ? (
        <>
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              style={{
                ...fieldStyle({
                  resize: "vertical",
                  lineHeight: 1.6,
                  fontSize: large ? 20 : 14,
                }),
              }}
              autoFocus
            />
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={fieldStyle({
                fontSize: large ? 20 : 14,
                fontWeight: large ? 700 : 400,
              })}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(value);
                }
              }}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={commit}
              style={{
                padding: "5px 14px",
                background: P,
                color: WHITE,
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft(value);
              }}
              style={{
                padding: "5px 12px",
                background: GRY,
                color: TXT,
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div
          onClick={() => {
            setEditing(true);
            setDraft(value);
          }}
          style={viewStyle}
          title="Click to edit"
        >
          {value || (
            <span style={{ fontStyle: "italic", color: SUB }}>
              {placeholder}
            </span>
          )}
          <i
            className="bi bi-pencil"
            style={{ fontSize: 11, color: SUB, marginLeft: 8, opacity: 0.6 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Inline select field ──────────────────────────────────────────────────────
function InlineSelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: number | null | undefined;
  options: { id: number; name: string }[];
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const current = options.find((o) => o.id === value);

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SUB,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      {editing ? (
        <>
          <select
            value={draft ?? ""}
            onChange={(e) => setDraft(Number(e.target.value))}
            style={fieldStyle({ cursor: "pointer" })}
            autoFocus
          >
            <option value="">— Select —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                setEditing(false);
                if (draft && draft !== value) onSave(draft);
              }}
              style={{
                padding: "5px 14px",
                background: P,
                color: WHITE,
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: "5px 12px",
                background: GRY,
                color: TXT,
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            fontSize: 14,
            color: current ? TXT : SUB,
            cursor: "pointer",
            padding: "6px 0",
            borderBottom: `1.5px dashed ${BDR}`,
            minHeight: 32,
          }}
          title="Click to edit"
        >
          {current?.name ?? (
            <span style={{ fontStyle: "italic" }}>Not set</span>
          )}
          <i
            className="bi bi-pencil"
            style={{ fontSize: 11, color: SUB, marginLeft: 8, opacity: 0.6 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Per-Variant Image Manager ────────────────────────────────────────────────
// Each image tile has individual upload/delete. Left pane shows the gallery.
function ImagePane({
  images,
  variantId,
  activeIdx,
  onSelect,
  onRefresh,
}: {
  images: { productImageId?: number; filePath?: string }[];
  variantId: number;
  activeIdx: number;
  onSelect: (i: number) => void;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const resolved = images
    .map((im, i) => ({ ...im, src: imgUrl(im.filePath), idx: i }))
    .filter((im) => im.src);

  // Scroll active thumb into view
  useEffect(() => {
    if (!thumbRef.current) return;
    const el = thumbRef.current.children[activeIdx] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      await api.post(`/ProductVariants/${variantId}/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${files.length} image(s) uploaded`);
      onRefresh();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(imageId?: number, idx?: number) {
    if (!imageId || !window.confirm("Delete this image?")) return;
    try {
      await api.delete(`/ProductVariants/${variantId}/images/${imageId}`);
      toast.success("Image deleted");
      onRefresh();
      if (idx !== undefined && idx === activeIdx)
        onSelect(Math.max(0, activeIdx - 1));
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {/* Vertical thumbnail strip */}
      {resolved.length > 1 && (
        <div
          ref={thumbRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: 72,
            flexShrink: 0,
            maxHeight: 440,
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          {resolved.map((im) => (
            <div
              key={im.idx}
              onClick={() => onSelect(im.idx)}
              style={{
                position: "relative",
                flexShrink: 0,
                width: 72,
                height: 88,
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                border: `2px solid ${im.idx === activeIdx ? P : BDR}`,
                opacity: im.idx === activeIdx ? 1 : 0.65,
              }}
              onMouseEnter={() => setHoveredIdx(im.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <img
                src={im.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {hoveredIdx === im.idx && im.productImageId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(im.productImageId, im.idx);
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(198,40,40,0.75)",
                    border: "none",
                    color: WHITE,
                    cursor: "pointer",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Delete"
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main image + controls */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            position: "relative",
            background: GRY,
            borderRadius: 12,
            overflow: "hidden",
            aspectRatio: "3/4",
          }}
          onMouseEnter={() => setHoveredIdx(-1)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {resolved.length > 0 ? (
            <>
              <img
                src={resolved[activeIdx]?.src ?? resolved[0].src}
                alt="product"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {/* Prev / Next */}
              {resolved.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      onSelect(
                        (activeIdx - 1 + resolved.length) % resolved.length,
                      )
                    }
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(0,0,0,0.4)",
                      color: WHITE,
                      border: "none",
                      borderRadius: "50%",
                      width: 30,
                      height: 30,
                      cursor: "pointer",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => onSelect((activeIdx + 1) % resolved.length)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(0,0,0,0.4)",
                      color: WHITE,
                      border: "none",
                      borderRadius: "50%",
                      width: 30,
                      height: 30,
                      cursor: "pointer",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              {/* Delete current */}
              {hoveredIdx === -1 && resolved[activeIdx]?.productImageId && (
                <button
                  onClick={() =>
                    handleDelete(resolved[activeIdx].productImageId, activeIdx)
                  }
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(198,40,40,0.85)",
                    color: WHITE,
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Delete this image"
                >
                  <i className="bi bi-trash" /> Delete
                </button>
              )}
              {/* Counter */}
              {resolved.length > 1 && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.45)",
                    color: WHITE,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 12,
                  }}
                >
                  {activeIdx + 1}/{resolved.length}
                </span>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 8,
                color: "#c0b0aa",
              }}
            >
              <i className="bi bi-image" style={{ fontSize: 48 }} />
              <span style={{ fontSize: 13 }}>No images yet</span>
            </div>
          )}
        </div>

        {/* Upload button */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleUpload(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "8px 0",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: `1.5px dashed ${P}`,
            background: PLT,
            color: P,
            cursor: uploading ? "wait" : "pointer",
            opacity: uploading ? 0.65 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <i className="bi bi-cloud-upload" />
          {uploading ? "Uploading…" : "Upload Image(s)"}
        </button>
      </div>
    </div>
  );
}

// ─── Inline editable size row ─────────────────────────────────────────────────
// ── Stock breakdown mini-card (read-only, shown in header when collapsed too) ─
function StockBreakdown({ pvd }: { pvd: any }) {
  const total = pvd.stockQuantity ?? 0;
  const processed = pvd.processedQuantity ?? 0;
  const refunded = pvd.returnedQuantity ?? 0;
  const available =
    pvd.availableQuantity ?? Math.max(0, total - processed + refunded);

  const isOOS = available <= 0;
  const isLow = available > 0 && available <= 3;
  const availColor = isOOS ? "#c62828" : isLow ? "#e65100" : "#2e7d32";
  const availBg = isOOS ? "#fdecea" : isLow ? "#fff3e0" : "#e8f5e9";

  const pill = (label: string, value: number, color: string, bg: string) => (
    <div style={{ textAlign: "center", minWidth: 58 }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color,
          background: bg,
          borderRadius: 8,
          padding: "4px 8px",
          display: "inline-block",
          minWidth: 36,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: SUB,
          marginTop: 3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {pill("Total", total, "#1565c0", "#e3f2fd")}
      <span style={{ color: SUB, fontSize: 13 }}>−</span>
      {pill("Processed", processed, "#6a1b9a", "#f3e5f5")}
      <span style={{ color: SUB, fontSize: 13 }}>+</span>
      {pill("Refunded", refunded, "#2e7d32", "#e8f5e9")}
      <span style={{ color: SUB, fontSize: 13 }}>=</span>
      {pill("Available", available, availColor, availBg)}
    </div>
  );
}

function SizeRow({ pvd, onRefresh }: { pvd: any; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDel] = useState(false);
  const [form, setForm] = useState({
    stockQuantity: pvd.stockQuantity ?? 0,
    mrpPrice: pvd.mrpPrice ?? 0,
    discountPercent: pvd.discountPercent ?? 0,
    finalPrice: pvd.finalPrice ?? 0,
    cgst: pvd.cgst ?? 0,
    sgst: pvd.sgst ?? 0,
  });

  useEffect(() => {
    setForm({
      stockQuantity: pvd.stockQuantity ?? 0,
      mrpPrice: pvd.mrpPrice ?? 0,
      discountPercent: pvd.discountPercent ?? 0,
      finalPrice: pvd.finalPrice ?? 0,
      cgst: pvd.cgst ?? 0,
      sgst: pvd.sgst ?? 0,
    });
  }, [pvd]);

  async function save() {
    setSaving(true);
    try {
      // Only stockQuantity (total) is editable here.
      // processedQuantity / returnedQuantity are managed automatically by the
      // order and refund flows; availableQuantity is derived server-side.
      await api.put(
        `/ProductVariantDetail/${pvd.productVariantDetailId}`,
        form,
      );
      toast.success("Saved");
      setOpen(false);
      onRefresh();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove size ${pvd.sizeLabel}?`)) return;
    setDel(true);
    try {
      await api.delete(`/ProductVariantDetail/${pvd.productVariantDetailId}`);
      toast.success("Size removed");
      onRefresh();
    } catch {
      toast.error("Remove failed");
    } finally {
      setDel(false);
    }
  }

  const available =
    pvd.availableQuantity ??
    Math.max(
      0,
      (pvd.stockQuantity ?? 0) -
        (pvd.processedQuantity ?? 0) +
        (pvd.returnedQuantity ?? 0),
    );
  const isOOS = available <= 0;
  const isLow = available > 0 && available <= 3;
  const stockColor = isOOS ? "#c62828" : isLow ? "#e65100" : "#2e7d32";
  const stockLabel = isOOS
    ? "Out of stock"
    : isLow
    ? `Only ${available} left`
    : `${available} available`;

  const numField = (key: keyof typeof form, label: string) => (
    <div key={key}>
      <div
        style={{ fontSize: 10, fontWeight: 700, color: SUB, marginBottom: 3 }}
      >
        {label}
      </div>
      <input
        type="number"
        min={0}
        step={key.includes("Price") ? 0.01 : 1}
        value={form[key]}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
        }
        style={fieldStyle({ fontSize: 13 })}
      />
    </div>
  );

  return (
    <div
      style={{
        border: `1px solid ${open ? P : BDR}`,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 8,
        transition: "border-color 0.2s",
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
          background: open ? PLT : WHITE,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "3px 12px",
            borderRadius: 20,
            background: open ? P : GRY,
            color: open ? WHITE : TXT,
            minWidth: 42,
            textAlign: "center",
          }}
        >
          {pvd.sizeLabel || "—"}
        </span>
        {pvd.cupSizeLabel && (
          <span style={{ fontSize: 12, color: SUB }}>/ {pvd.cupSizeLabel}</span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 600,
            color: stockColor,
          }}
        >
          {stockLabel}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: TXT }}>
          ₹{pvd.finalPrice?.toFixed(0) ?? "—"}
        </span>
        <i
          className={`bi bi-chevron-${open ? "up" : "down"}`}
          style={{ color: SUB, fontSize: 12 }}
        />
      </div>

      {/* Expanded edit form */}
      {open && (
        <div
          style={{
            padding: "14px 16px",
            background: "#fffbf8",
            borderTop: `1px solid ${BDR}`,
          }}
        >
          {/* ── Stock breakdown (read-only) ─────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Stock Breakdown
            </div>
            <div
              style={{
                background: GRY,
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              <StockBreakdown pvd={pvd} />
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: SUB,
                  fontStyle: "italic",
                }}
              >
                Available = Total − Processed + Refunded
              </div>
            </div>
          </div>

          {/* ── Editable fields ─────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "10px 16px",
              marginBottom: 14,
            }}
          >
            {numField("stockQuantity", "Total Qty (Restock)")}
            {numField("mrpPrice", "MRP (₹)")}
            {numField("discountPercent", "Discount %")}
            {numField("finalPrice", "Final Price (₹)")}
            {numField("cgst", "CGST %")}
            {numField("sgst", "SGST %")}
          </div>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              marginBottom: 12,
              fontStyle: "italic",
            }}
          >
            Processed &amp; Refunded quantities are updated automatically by the
            order and refund flows.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "7px 18px",
                background: P,
                color: WHITE,
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "7px 14px",
                background: WHITE,
                border: `1px solid ${BDR}`,
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              style={{
                marginLeft: "auto",
                padding: "7px 14px",
                background: "#fdecea",
                color: "#c62828",
                border: "1px solid #ef9a9a",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {deleting ? (
                "Removing…"
              ) : (
                <>
                  <i className="bi bi-trash" /> Remove Size
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add-size inline form ─────────────────────────────────────────────────────
function AddSizeForm({
  variantId,
  productId,
  onAdded,
}: {
  variantId: number;
  productId: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSave] = useState(false);
  const [form, setForm] = useState({
    sizeId: 0,
    cupSizeId: null as number | null,
    stockQuantity: 0,
    mrpPrice: 0,
    discountPercent: 0,
    finalPrice: 0,
    cgst: 0,
    sgst: 0,
  });

  const { data: sizesData } = useQuery({
    queryKey: ["admin-sizes"],
    queryFn: () =>
      api.get("/Size/", { params: { "Page.Size": 200 } }).then((r) => r.data),
    staleTime: 300_000,
  });
  const { data: cupSizesData } = useQuery({
    queryKey: ["admin-cupsizes"],
    queryFn: () =>
      api
        .get("/CupSize/", { params: { "Page.Size": 200 } })
        .then((r) => r.data),
    staleTime: 300_000,
  });
  const sizes: any[] = sizesData?.list ?? [];
  const cupSizes: any[] = cupSizesData?.list ?? [];

  async function save() {
    if (!form.sizeId) return toast.error("Select a size");
    setSave(true);
    try {
      await api.post("/ProductVariantDetail/", {
        ...form,
        productId,
        productVariantId: variantId,
        cupSizeId: form.cupSizeId || null,
        availableQuantity: form.stockQuantity,
      });
      toast.success("Size added");
      setOpen(false);
      setForm({
        sizeId: 0,
        cupSizeId: null,
        stockQuantity: 0,
        mrpPrice: 0,
        discountPercent: 0,
        finalPrice: 0,
        cgst: 0,
        sgst: 0,
      });
      onAdded();
    } catch {
      toast.error("Failed to add size");
    } finally {
      setSave(false);
    }
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "8px 0",
          border: `1.5px dashed ${P}`,
          borderRadius: 10,
          background: PLT,
          color: P,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <i className="bi bi-plus" /> Add Size
      </button>
    );

  return (
    <div
      style={{
        border: `1.5px solid ${P}`,
        borderRadius: 10,
        padding: 16,
        background: "#fffbf8",
      }}
    >
      <div
        style={{ fontSize: 13, fontWeight: 700, color: P, marginBottom: 12 }}
      >
        Add New Size
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "10px 16px",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: SUB,
              marginBottom: 3,
            }}
          >
            Size *
          </div>
          <select
            value={form.sizeId || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, sizeId: Number(e.target.value) }))
            }
            style={fieldStyle({ fontSize: 13 })}
          >
            <option value="">— Select Size —</option>
            {sizes.map((s: any) => (
              <option key={s.sizeId} value={s.sizeId}>
                {s.sizeLabel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: SUB,
              marginBottom: 3,
            }}
          >
            Cup Size
          </div>
          <select
            value={form.cupSizeId ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                cupSizeId: e.target.value ? Number(e.target.value) : null,
              }))
            }
            style={fieldStyle({ fontSize: 13 })}
          >
            <option value="">None</option>
            {cupSizes.map((s: any) => (
              <option key={s.cupSizeId} value={s.cupSizeId}>
                {s.sizeLabel}
              </option>
            ))}
          </select>
        </div>
        {[
          ["stockQuantity", "Total Qty (Stock) *"],
          ["mrpPrice", "MRP (₹) *"],
          ["discountPercent", "Discount %"],
          ["finalPrice", "Final Price (₹) *"],
          ["cgst", "CGST %"],
          ["sgst", "SGST %"],
        ].map(([key, label]) => (
          <div key={key}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <input
              type="number"
              min={0}
              step={(key as string).includes("Price") ? 0.01 : 1}
              value={(form as any)[key] || 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
              }
              style={fieldStyle({ fontSize: 13 })}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "7px 18px",
            background: P,
            color: WHITE,
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Adding…" : "Add Size"}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            padding: "7px 14px",
            background: WHITE,
            border: `1px solid ${BDR}`,
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Add Variant modal ────────────────────────────────────────────────────────
function AddVariantModal({
  productId,
  onClose,
  onAdded,
}: {
  productId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    variantName: "",
    productCode: "",
    color: "",
    variantDescription: "",
    isBestSeller: false,
    isReturnAvailable: false,
    isCupSize: false,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.variantName) return toast.error("Variant name required");
    setSaving(true);
    try {
      await api.post("/ProductVariants/", { ...form, productId });
      toast.success("Variant created");
      onAdded();
      onClose();
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: WHITE,
          borderRadius: 16,
          padding: 32,
          width: "min(500px, 94vw)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: TXT,
            marginBottom: 20,
          }}
        >
          Add New Variant
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px 20px",
            marginBottom: 16,
          }}
        >
          {[
            ["variantName", "Variant Name *"],
            ["productCode", "Product Code *"],
            ["color", "Color (hex / name)"],
            ["variantDescription", "Description"],
          ].map(([key, label]) => (
            <div
              key={key}
              style={{
                gridColumn: key === "variantDescription" ? "1/-1" : undefined,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: SUB,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <input
                value={(form as any)[key] || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                style={fieldStyle({ fontSize: 13 })}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {[
            ["isBestSeller", "Best Seller"],
            ["isReturnAvailable", "Return Available"],
            ["isCupSize", "Cup Size"],
          ].map(([k, l]) => (
            <label
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={(form as any)[k]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [k]: e.target.checked }))
                }
              />
              {l}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px 0",
              background: P,
              color: WHITE,
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Creating…" : "Create Variant"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              background: GRY,
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              cursor: "pointer",
              color: TXT,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const productId = Number(id);
  const isNew = !id || id === "new";

  const [selVariantId, setSelVariantId] = useState<number | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [addVariantOpen, setAddVariantOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const {
    data: product,
    isLoading: pLoading,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => api.get(`/Products/${productId}`).then((r) => r.data),
    enabled: !isNew,
  });

  const { data: catsData } = useQuery({
    queryKey: ["admin-cats-all"],
    queryFn: () =>
      api
        .get("/Category", { params: { "Page.Size": 500 } })
        .then((r) => r.data),
    staleTime: 120_000,
  });
  const { data: brandsData } = useQuery({
    queryKey: ["admin-brands-all"],
    queryFn: () =>
      api
        .get("/Brand/", { params: { showAll: true, "Page.Size": 200 } })
        .then((r) => r.data),
    staleTime: 120_000,
  });

  const allCats: any[] = catsData?.list ?? [];
  const allBrands: any[] = brandsData?.list ?? [];
  const parentCats = allCats.filter(
    (c) => !c.parentCategoryId || c.parentCategoryId === 0,
  );
  const childCats = (pid: number) =>
    allCats.filter((c) => Number(c.parentCategoryId) === Number(pid));

  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ["admin-variants-full", productId],
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
    enabled: !isNew,
  });
  const variants: any[] = variantsData?.list ?? [];

  // Auto-select first variant
  useEffect(() => {
    if (!selVariantId && variants.length > 0)
      setSelVariantId(variants[0].productVariantId);
  }, [variants, selVariantId]);

  const selVariant = variants.find((v) => v.productVariantId === selVariantId);

  // Images for selected variant (fresh from API)
  const { data: imagesData, refetch: refetchImages } = useQuery({
    queryKey: ["admin-variant-images", selVariantId],
    queryFn: () =>
      api.get(`/ProductVariants/${selVariantId}/images`).then((r) => r.data),
    enabled: !!selVariantId,
  });
  const variantImages: any[] = Array.isArray(imagesData) ? imagesData : [];

  // Reset image index when variant switches
  useEffect(() => {
    setActiveImgIdx(0);
  }, [selVariantId]);

  // PVD (sizes) for selected variant
  const { data: pvdData, refetch: refetchPvd } = useQuery({
    queryKey: ["admin-pvd", selVariantId],
    queryFn: () =>
      api
        .get("/ProductVariantDetail/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "productVariantId",
                comparison: "eq",
                value: String(selVariantId),
              },
            ]),
            "Page.Size": 100,
          },
        })
        .then((r) => r.data),
    enabled: !!selVariantId,
  });
  const pvds: any[] = pvdData?.list ?? [];

  // ── Patch product ────────────────────────────────────────────────────────────
  async function patchProduct(data: Record<string, any>) {
    try {
      await api.put(`/Products/${productId}`, { ...product, ...data });
      toast.success("Saved");
      refetchProduct();
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    } catch {
      toast.error("Save failed");
    }
  }

  // ── Patch variant ────────────────────────────────────────────────────────────
  async function patchVariant(data: Record<string, any>) {
    if (!selVariantId) return;
    try {
      await api.put(`/ProductVariants/${selVariantId}`, {
        ...selVariant,
        ...data,
        productId,
      });
      toast.success("Saved");
      refetchVariants();
    } catch {
      toast.error("Save failed");
    }
  }

  // ── Toggle variant visibility ────────────────────────────────────────────────
  async function toggleVariantActive() {
    if (!selVariantId) return;
    try {
      await api.patch(`/ProductVariants/${selVariantId}/toggle-active`);
      toast.success(
        selVariant?.isActive !== false ? "Variant hidden" : "Variant shown",
      );
      refetchVariants();
    } catch {
      toast.error("Failed");
    }
  }

  const goBack = () => navigate(-1);

  if (isNew) {
    navigate("/admin/products/new-form");
    return null;
  }
  if (pLoading)
    return (
      <div style={{ padding: 60, textAlign: "center", color: SUB }}>
        <i
          className="bi bi-hourglass-split"
          style={{ fontSize: 36, display: "block", marginBottom: 12 }}
        />
        Loading product…
      </div>
    );
  if (!product)
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p style={{ color: "#c62828" }}>Product not found.</p>
        <button
          onClick={goBack}
          style={{
            marginTop: 12,
            width: 34,
            height: 34,
            background: WHITE,
            color: P,
            border: `1px solid ${BDR}`,
            borderRadius: 999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Go back"
          title="Back"
        >
          <i className="bi bi-arrow-left" />
        </button>
      </div>
    );

  const stateColors: Record<string, { bg: string; color: string }> = {
    Approved: { bg: "#e8f5e9", color: "#2e7d32" },
    Created: { bg: "#e3f2fd", color: "#1565c0" },
    Rejected: { bg: "#fdecea", color: "#c62828" },
    Modified: { bg: "#fff8e1", color: "#f57f17" },
  };
  const sc = stateColors[product.state] ?? { bg: GRY, color: SUB };

  const isHidden = selVariant?.isActive === false;

  return (
    <div style={{ background: BG, minHeight: "100vh", paddingBottom: 80 }}>
      {/* ── Sticky header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: WHITE,
          borderBottom: `1px solid ${BDR}`,
          padding: "16px 32px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={goBack}
          style={{
            width: 34,
            height: 34,
            background: WHITE,
            border: `1px solid ${BDR}`,
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 14,
            color: P,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Go back"
          title="Back"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TXT }}>
            {product.name || "Unnamed Product"}
          </h2>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              marginTop: 1,
              fontFamily: "'Courier New',monospace",
            }}
          >
            #{product.productCode}
          </div>
        </div>
        <span
          style={{
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: sc.bg,
            color: sc.color,
            border: `1.5px solid ${sc.color}`,
          }}
        >
          {product.state || "Draft"}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: product.isActive !== false ? "#e8f5e9" : "#fdecea",
            color: product.isActive !== false ? "#2e7d32" : "#c62828",
          }}
        >
          {product.isActive !== false ? "Active" : "Inactive"}
        </span>
        <button
          onClick={() => setAddVariantOpen(true)}
          style={{
            padding: "7px 16px",
            background: P,
            color: WHITE,
            border: "none",
            borderRadius: 9,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          <i className="bi bi-plus-lg" /> Add Variant
        </button>
      </div>

      {/* ── Two-column layout (mirrors user ProductDetail) ──────────────────────── */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 32px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          alignItems: "start",
        }}
      >
        {/* ══════════════════════════════════════════════════════════════════════
            LEFT — Sticky image gallery for currently selected variant
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ position: "sticky", top: 80 }}>
          {selVariant ? (
            <ImagePane
              key={selVariantId!}
              images={variantImages}
              variantId={selVariantId!}
              activeIdx={activeImgIdx}
              onSelect={setActiveImgIdx}
              onRefresh={() => {
                refetchImages();
                refetchVariants();
              }}
            />
          ) : (
            <div
              style={{
                aspectRatio: "3/4",
                background: GRY,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#c0b0aa",
              }}
            >
              <i className="bi bi-image" style={{ fontSize: 48 }} />
              <span>Select a variant</span>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT — Scrollable product + variant info
        ══════════════════════════════════════════════════════════════════════ */}
        <div>
          {/* Brand */}
          <InlineField
            label="Brand"
            value={
              allBrands.find((b) => b.brandId === product.brandId)?.brandName ??
              ""
            }
            placeholder="Set brand…"
            onSave={(v) => {
              const match = allBrands.find(
                (b) => b.brandName.toLowerCase() === v.toLowerCase(),
              );
              if (match) patchProduct({ brandId: match.brandId });
              else
                toast("Brand not found — use the dropdown below", {
                  icon: "⚠️",
                });
            }}
          />

          {/* Product Name */}
          <div style={{ marginBottom: 6 }}>
            <InlineField
              value={product.name || ""}
              placeholder="Product name…"
              onSave={(v) => patchProduct({ name: v })}
              large
            />
          </div>

          {/* SKU */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 12, color: SUB }}>SKU:</span>
            <span
              style={{
                fontFamily: "'Courier New',monospace",
                fontSize: 12,
                color: SUB,
                cursor: "pointer",
              }}
              onClick={() => {}}
            >
              <InlineField
                value={product.productCode || ""}
                placeholder="SKU…"
                onSave={(v) => patchProduct({ productCode: v })}
              />
            </span>
          </div>

          {/* Price summary from selected variant's first PVD */}
          {pvds.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: P }}>
                ₹{pvds[0].finalPrice?.toFixed(0)}
              </span>
              {pvds[0].mrpPrice > pvds[0].finalPrice && (
                <>
                  <span
                    style={{
                      fontSize: 14,
                      color: SUB,
                      textDecoration: "line-through",
                    }}
                  >
                    ₹{pvds[0].mrpPrice?.toFixed(0)}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "#e8f5e9",
                      color: "#2e7d32",
                    }}
                  >
                    {Math.round(
                      ((pvds[0].mrpPrice - pvds[0].finalPrice) /
                        pvds[0].mrpPrice) *
                        100,
                    )}
                    % OFF
                  </span>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <InlineField
            label="Description"
            value={product.description || ""}
            multiline
            placeholder="Add a description…"
            onSave={(v) => patchProduct({ description: v })}
          />

          {/* Tags */}
          <InlineField
            label="Tags"
            value={product.tag || ""}
            placeholder="Add tags…"
            onSave={(v) => patchProduct({ tag: v })}
          />

          <div style={{ height: 1, background: BDR, margin: "20px 0" }} />

          {/* ── Variant swatches (like user-side colour picker) ────────────── */}
          {variants.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Variants ({variants.length})
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {variants.map((v) => {
                  const isSel = v.productVariantId === selVariantId;
                  const hex = resolveColor(v.color);
                  const firstImg = (v.images ?? [])[0];
                  const imgSrc = firstImg ? imgUrl(firstImg.filePath) : null;
                  return (
                    <button
                      key={v.productVariantId}
                      onClick={() => setSelVariantId(v.productVariantId)}
                      title={v.variantName}
                      style={{
                        width: 64,
                        height: 78,
                        padding: 0,
                        border: `2.5px solid ${isSel ? P : "transparent"}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                        background: GRY,
                        position: "relative",
                        opacity: v.isActive === false ? 0.45 : 1,
                      }}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={v.variantName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: hex,
                          }}
                        />
                      )}
                      {v.isActive === false && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="bi bi-eye-slash"
                            style={{ color: WHITE, fontSize: 12 }}
                          />
                        </div>
                      )}
                      {isSel && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            background: P,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {selVariant && (
                <div style={{ marginTop: 6, fontSize: 12, color: SUB }}>
                  <span style={{ fontWeight: 700, color: TXT }}>
                    {selVariant.variantName}
                  </span>
                  {selVariant.color && (
                    <>
                      {" "}
                      ·{" "}
                      <span style={{ fontFamily: "'Courier New',monospace" }}>
                        {selVariant.color}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Variant-specific editable fields ──────────────────────────── */}
          {selVariant && (
            <div
              style={{
                background: GRY,
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: P,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 14,
                }}
              >
                Variant Info
              </div>
              <InlineField
                label="Variant Name"
                value={selVariant.variantName || ""}
                onSave={(v) => patchVariant({ variantName: v })}
              />
              <InlineField
                label="Variant Product Code"
                value={selVariant.productCode || ""}
                onSave={(v) => patchVariant({ productCode: v })}
              />
              <InlineField
                label="Color (hex/name)"
                value={selVariant.color || ""}
                onSave={(v) => patchVariant({ color: v })}
              />
              <InlineField
                label="Variant Description"
                value={selVariant.variantDescription || ""}
                multiline
                onSave={(v) => patchVariant({ variantDescription: v })}
              />
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                {[
                  ["isBestSeller", "⭐ Best Seller"],
                  ["isReturnAvailable", "↩ Returns"],
                  ["isCupSize", "🍵 Cup Size"],
                ].map(([k, l]) => (
                  <label
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      color: TXT,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!selVariant[k as string]}
                      onChange={(e) =>
                        patchVariant({ [k as string]: e.target.checked })
                      }
                    />{" "}
                    {l}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 1, background: BDR, margin: "20px 0" }} />

          {/* ── Sizes section ────────────────────────────────────────────── */}
          {selVariant && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SUB,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Sizes & Stock ({pvds.length})
                </div>
              </div>
              {pvds.length === 0 ? (
                <div
                  style={{
                    padding: "20px 0",
                    textAlign: "center",
                    color: SUB,
                    fontSize: 13,
                  }}
                >
                  <i
                    className="bi bi-box-seam"
                    style={{
                      fontSize: 28,
                      display: "block",
                      marginBottom: 8,
                      opacity: 0.4,
                    }}
                  />
                  No sizes yet
                </div>
              ) : (
                pvds.map((pvd: any) => (
                  <SizeRow
                    key={pvd.productVariantDetailId}
                    pvd={pvd}
                    onRefresh={refetchPvd}
                  />
                ))
              )}
              <div style={{ marginTop: 10 }}>
                <AddSizeForm
                  variantId={selVariantId!}
                  productId={productId}
                  onAdded={refetchPvd}
                />
              </div>
            </div>
          )}

          {/* ── Hide / Show Variant — where Buy Now / Add to Cart sit ────── */}
          {selVariant && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button
                onClick={toggleVariantActive}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  cursor: "pointer",
                  border: "none",
                  background: isHidden ? "#e8f5e9" : PLT,
                  color: isHidden ? "#2e7d32" : P,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <i className={`bi ${isHidden ? "bi-eye" : "bi-eye-slash"}`} />
                {isHidden ? "Show Variant" : "Hide Variant"}
              </button>
            </div>
          )}

          <div style={{ height: 1, background: BDR, margin: "20px 0" }} />

          {/* ── Product-level fields ────────────────────────────────────── */}
          <div
            style={{
              background: WHITE,
              border: `1px solid ${BDR}`,
              borderRadius: 12,
              padding: "20px 20px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: P,
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <i className="bi bi-info-circle" style={{ marginRight: 6 }} />
              Product Fields
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 28px",
              }}
            >
              <InlineSelect
                label="Parent Category"
                value={product.categoryId}
                options={parentCats.map((c) => ({
                  id: c.categoryId,
                  name: c.name,
                }))}
                onSave={(v) =>
                  patchProduct({ categoryId: v, childCategoryId: null })
                }
              />
              <InlineSelect
                label="Child Category"
                value={product.childCategoryId}
                options={childCats(product.categoryId || 0).map((c) => ({
                  id: c.categoryId,
                  name: c.name,
                }))}
                onSave={(v) => patchProduct({ childCategoryId: v })}
              />
              <InlineSelect
                label="Brand"
                value={product.brandId}
                options={allBrands.map((b) => ({
                  id: b.brandId,
                  name: b.brandName,
                }))}
                onSave={(v) => patchProduct({ brandId: v })}
              />
            </div>

            <div
              style={{ height: 1, background: BDR, margin: "12px 0 16px" }}
            />

            {/* Toggle product active */}
            <button
              onClick={() =>
                api
                  .patch(`/Products/${productId}/toggle-active`)
                  .then(() => {
                    toast.success("Toggled");
                    refetchProduct();
                  })
                  .catch(() => toast.error("Failed"))
              }
              style={{
                padding: "7px 16px",
                background: product.isActive !== false ? "#fff8e1" : "#e8f5e9",
                color: product.isActive !== false ? "#e65100" : "#2e7d32",
                border: `1.5px solid ${
                  product.isActive !== false ? "#ffe082" : "#c8e6c9"
                }`,
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {product.isActive !== false
                ? "🙈 Hide Product"
                : "👁 Show Product"}
            </button>
          </div>
        </div>
      </div>

      {addVariantOpen && (
        <AddVariantModal
          productId={productId}
          onClose={() => setAddVariantOpen(false)}
          onAdded={refetchVariants}
        />
      )}
    </div>
  );
}
