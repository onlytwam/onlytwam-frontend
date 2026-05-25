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
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useParams,
  useNavigate,
  useOutletContext,
  useLocation,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import {
  COLOR_FAMILY_OPTIONS,
  guessColorFamily,
  getFamilySwatch,
} from "@/shared/utils/colorHelpers";
import { getImageUrl } from "@/shared/utils/helpers";
import type { AdminLayoutOutletContext } from "@/features/admin/components/AdminLayout";

// ─── Design tokens (same palette as the rest of the admin) ───────────────────
const P = "#7A1E2C";

// ─── Current user helper (reads from common auth storage) ────────────────────
function getCurrentUser(): { name: string; role: string } {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("user") ||
      sessionStorage.getItem("currentUser") ||
      "{}";
    const u = JSON.parse(raw);
    const name =
      u.name || u.userName || u.firstName || u.fullName || u.email || "Admin";
    const role = u.role || u.roleName || u.roleType || u.userRole || "Admin";
    return { name, role };
  } catch {
    return { name: "Admin", role: "Admin" };
  }
}
function savedToast(extra?: string) {
  const { name, role } = getCurrentUser();
  toast.success(`Saved by ${name} (${role})${extra ? " — " + extra : ""}`);
}
function updatedToast(field?: string) {
  const { name, role } = getCurrentUser();
  toast.success(
    `${field ? field + " updated" : "Updated"} by ${name} (${role})`,
  );
}
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
  if (/^data:image\//.test(src)) return src;
  if (/^[A-Za-z0-9+/]+=*$/.test(src) && src.length > 120)
    return `data:image/jpeg;base64,${src}`;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/assets/")) return src;
  if (src.startsWith("/uploads/")) return `http://127.0.0.1:8000${src}`;
  if (src.startsWith("uploads/")) return `http://127.0.0.1:8000/${src}`;
  return getImageUrl(src, "");
}

function imagePathFromAny(image: any): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  return (
    image.fileData ||
    image.imageUrl ||
    image.imageURL ||
    image.filePath ||
    image.image ||
    image.selectedImage ||
    image.thumbnail ||
    image.fileName ||
    image.imagePath ||
    image.src ||
    image.url ||
    image.path ||
    ""
  );
}

function mergeImageSources(...sources: any[]): any[] {
  const merged: any[] = [];
  const seen = new Set<string>();

  sources.flat().forEach((image) => {
    const filePath = imagePathFromAny(image);
    if (!filePath) return;

    const key = filePath.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    merged.push({
      ...(typeof image === "object" && image !== null ? image : {}),
      filePath,
    });
  });

  return merged;
}

function resolveColor(c: string | null | undefined): string {
  if (!c) return "#d0c8c2";
  const s = c.trim();
  if (s.startsWith("#") || s.startsWith("rgb")) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  return s;
}

function getVariantColor(variant: any): string {
  // Use family swatch color for display; no per-variant hex
  return getFamilySwatch(variant?.colorFamily);
}

function imageIdFromAny(image: any): number | undefined {
  const raw =
    image?.productImageId ??
    image?.productVariantImageId ??
    image?.imageId ??
    image?.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
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
  // `committed` = locally edited value shown in view mode (may differ from server `value`)
  const [committed, setCommitted] = useState(value);

  useEffect(() => {
    setDraft(value);
    setCommitted(value);
  }, [value]);

  const isDirty = committed !== value;

  function commit() {
    const next = draft.trim();
    setEditing(false);
    setCommitted(next);
    if (next !== value) onSave(next);
  }

  function cancel() {
    setEditing(false);
    setDraft(committed);
  }

  const viewStyle: React.CSSProperties = {
    fontSize: large ? 22 : 14,
    fontWeight: large ? 700 : 400,
    color: committed ? TXT : SUB,
    cursor: "pointer",
    padding: "6px 0",
    borderBottom: isDirty ? `1.5px solid #f59e0b` : `1.5px dashed ${BDR}`,
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
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {label}
          {isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f59e0b",
                display: "inline-block",
              }}
              title="Unsaved change"
            />
          )}
        </div>
      )}
      {editing ? (
        multiline ? (
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
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
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
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
          />
        )
      ) : (
        <div
          onClick={() => {
            setEditing(true);
            setDraft(committed);
          }}
          style={viewStyle}
          title="Click to edit"
        >
          {committed || (
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
  // localValue tracks pending selection (may differ from server `value`)
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const isDirty = localValue !== value;
  const current = options.find((o) => o.id === localValue);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = Number(e.target.value);
    setLocalValue(next);
    setEditing(false);
    if (next !== value) onSave(next);
  }

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
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {isDirty && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#f59e0b",
              display: "inline-block",
            }}
            title="Unsaved change"
          />
        )}
      </div>
      {editing ? (
        <select
          value={localValue ?? ""}
          onChange={handleChange}
          onBlur={() => setEditing(false)}
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
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            fontSize: 14,
            color: current ? TXT : SUB,
            cursor: "pointer",
            padding: "6px 0",
            borderBottom: isDirty
              ? `1.5px solid #f59e0b`
              : `1.5px dashed ${BDR}`,
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

// ─── Inline string-select (Color Family) ─────────────────────────────────────
function InlineStringSelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  options: readonly string[];
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const isDirty = localValue !== (value ?? "");
  const swatch = getFamilySwatch(localValue);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setLocalValue(next);
    setEditing(false);
    if (next !== (value ?? "")) onSave(next);
  }

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
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {isDirty && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#f59e0b",
              display: "inline-block",
            }}
            title="Unsaved change"
          />
        )}
      </div>
      {editing ? (
        <select
          value={localValue}
          onChange={handleChange}
          onBlur={() => setEditing(false)}
          style={fieldStyle({ cursor: "pointer" })}
          autoFocus
        >
          <option value="">— Not set —</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            fontSize: 14,
            color: localValue ? TXT : SUB,
            cursor: "pointer",
            padding: "6px 0",
            borderBottom: isDirty
              ? "1.5px solid #f59e0b"
              : `1.5px dashed ${BDR}`,
            minHeight: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          title="Click to edit"
        >
          {localValue && (
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: swatch,
                border: "1px solid #ddd",
                flexShrink: 0,
              }}
            />
          )}
          {localValue || <span style={{ fontStyle: "italic" }}>Not set</span>}
          <i
            className="bi bi-pencil"
            style={{ fontSize: 11, color: SUB, opacity: 0.6 }}
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
  images: any[];
  variantId: number;
  activeIdx: number;
  onSelect: (i: number) => void;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [thumbStart, setThumbStart] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const resolved = images
    .map((im, i) => ({
      ...(typeof im === "object" && im !== null ? im : {}),
      src: imgUrl(imagePathFromAny(im)),
      idx: i,
      productImageId: imageIdFromAny(im),
    }))
    .filter((im) => im.src);
  const activeResolvedIdx = Math.max(
    0,
    resolved.findIndex((im) => im.idx === activeIdx),
  );
  const currentImage = resolved[activeResolvedIdx] ?? resolved[0];
  const maxVisibleThumbs = 4;
  const visibleThumbs = resolved.slice(
    thumbStart,
    thumbStart + maxVisibleThumbs,
  );
  const canPageThumbsUp = thumbStart > 0;
  const canPageThumbsDown = thumbStart + maxVisibleThumbs < resolved.length;

  useEffect(() => {
    if (resolved.length <= maxVisibleThumbs) {
      setThumbStart(0);
      return;
    }

    setThumbStart((start) => {
      if (activeResolvedIdx < start) return activeResolvedIdx;
      if (activeResolvedIdx >= start + maxVisibleThumbs) {
        return activeResolvedIdx - maxVisibleThumbs + 1;
      }
      return Math.min(start, Math.max(0, resolved.length - maxVisibleThumbs));
    });
  }, [activeResolvedIdx, resolved.length]);

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
    if (!imageId) {
      toast.error("This image cannot be deleted from here yet");
      return;
    }
    if (!window.confirm("Delete this image?")) return;
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
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: 72,
            flexShrink: 0,
            alignItems: "stretch",
          }}
        >
          {resolved.length > maxVisibleThumbs && (
            <button
              type="button"
              onClick={() => setThumbStart((s) => Math.max(0, s - 1))}
              disabled={!canPageThumbsUp}
              aria-label="Previous thumbnails"
              title="Previous thumbnails"
              style={{
                height: 24,
                borderRadius: 999,
                border: `1px solid ${BDR}`,
                background: WHITE,
                color: canPageThumbsUp ? P : "#c9beb8",
                cursor: canPageThumbsUp ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="bi bi-chevron-up" />
            </button>
          )}
          {visibleThumbs.map((im) => (
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
            >
              <img
                src={im.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
          {resolved.length > maxVisibleThumbs && (
            <button
              type="button"
              onClick={() =>
                setThumbStart((s) =>
                  Math.min(resolved.length - maxVisibleThumbs, s + 1),
                )
              }
              disabled={!canPageThumbsDown}
              aria-label="Next thumbnails"
              title="Next thumbnails"
              style={{
                height: 24,
                borderRadius: 999,
                border: `1px solid ${BDR}`,
                background: WHITE,
                color: canPageThumbsDown ? P : "#c9beb8",
                cursor: canPageThumbsDown ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="bi bi-chevron-down" />
            </button>
          )}
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
        >
          {resolved.length > 0 ? (
            <>
              <img
                src={currentImage.src}
                alt="product"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/assets/category-bg.png";
                }}
              />
              {/* Prev / Next */}
              {resolved.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      onSelect(
                        resolved[
                          (activeResolvedIdx - 1 + resolved.length) %
                            resolved.length
                        ].idx,
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
                    onClick={() =>
                      onSelect(
                        resolved[(activeResolvedIdx + 1) % resolved.length].idx,
                      )
                    }
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
              {currentImage?.productImageId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(currentImage.productImageId, currentImage.idx);
                  }}
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
                  {activeResolvedIdx + 1}/{resolved.length}
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

// ─── Size Palette — shows all MDM sizes as tiles, add / expand inline ────────
function SizePalette({
  variantId,
  productId,
  isCupSize,
  onRefresh,
  registerSave,
  onCupSizeToggle,
  navigate,
}: {
  variantId: number;
  productId: number;
  isCupSize: boolean;
  onRefresh: () => void;
  registerSave: (id: number, fn: () => Promise<void>) => void;
  onCupSizeToggle?: (val: boolean) => void;
  navigate: (path: string) => void;
}) {
  // Single endpoint returns all MDM sizes + embedded PVD data
  const {
    data: paletteData,
    isLoading: paletteLoading,
    refetch: refetchPalette,
  } = useQuery({
    queryKey: ["admin-size-palette", variantId],
    queryFn: () =>
      api
        .get(`/ProductVariantDetail/AdminSizePalette/${variantId}`)
        .then((r) => r.data),
    enabled: !!variantId,
  });

  const allSizes: any[] = paletteData?.bandSizes ?? [];
  const bandSizesByType: Record<string, any[]> =
    paletteData?.bandSizesByType ?? {};
  const hasMultipleTypes = Object.keys(bandSizesByType).length > 1;
  const allCupSizes: any[] = paletteData?.cupSizes ?? [];
  const paletteIsCup: boolean = isCupSize || !!paletteData?.hasCupSize;

  // Which tiles are expanded (either existing pvd open or add-form open)
  const [openTile, setOpenTile] = useState<string | null>(null); // "band-{sizeId}" | "cup-{cupSizeId}" | "add-band-{sizeId}" | "add-cup-{cupSizeId}"
  const [selectedBandSizeId, setSelectedBandSizeId] = useState<number | null>(
    null,
  );
  const [addForm, setAddForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  function initAddForm(sizeId: number | null, cupSizeId: number | null) {
    setAddForm({
      sizeId,
      cupSizeId,
      stockQuantity: 0,
      mrpPrice: 0,
      finalPrice: 0,
      cgst: 0,
      sgst: 0,
    });
  }

  async function addSize() {
    setSaving(true);
    try {
      const mrp = addForm.mrpPrice ?? 0;
      const fp = addForm.finalPrice ?? 0;
      const discountPercent =
        mrp > 0 ? Math.round(((mrp - fp) / mrp) * 100) : 0;
      await api.post("/ProductVariantDetail/", {
        ...addForm,
        discountPercent,
        productId,
        productVariantId: variantId,
        availableQuantity: addForm.stockQuantity,
      });
      savedToast("size added");
      setOpenTile(null);
      setAddForm({});
      onRefresh();
      refetchPalette();
    } catch {
      toast.error("Failed to add size");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSize(pvd: any) {
    if (
      !window.confirm(
        `Remove size ${pvd.sizeLabel}${
          pvd.cupSizeLabel ? " / " + pvd.cupSizeLabel : ""
        }?`,
      )
    )
      return;
    setDeleting(pvd.productVariantDetailId);
    try {
      await api.delete(`/ProductVariantDetail/${pvd.productVariantDetailId}`);
      toast.success("Removed");
      setOpenTile(null);
      onRefresh();
      refetchPalette();
    } catch {
      toast.error("Remove failed");
    } finally {
      setDeleting(null);
    }
  }

  async function updateStock(pvd: any, qty: number) {
    // Route stock changes through the StockLog endpoint so they are
    // properly audited with changedBy="ProductDetail" source
    try {
      await api.put(`/StockLog/update/${pvd.productVariantDetailId}`, {
        stockQuantity: qty,
        note: "Updated from Product Detail page",
        changedBy: "ProductDetail",
      });
      toast.success("Total stock updated");
      onRefresh();
      refetchPalette();
    } catch {
      toast.error("Update failed");
    }
  }

  async function updatePvd(
    pvd: any,
    fields: {
      stockQuantity: number;
      mrpPrice: number;
      finalPrice: number;
      stockId?: string;
    },
  ) {
    const mrp = fields.mrpPrice ?? 0;
    const fp = fields.finalPrice ?? 0;
    const discountPercent = mrp > 0 ? Math.round(((mrp - fp) / mrp) * 100) : 0;
    try {
      await api.put(`/ProductVariantDetail/${pvd.productVariantDetailId}`, {
        ...pvd,
        ...fields,
        discountPercent,
      });
      updatedToast();
      onRefresh();
      refetchPalette();
    } catch {
      toast.error("Save failed");
    }
  }

  // Register each existing pvd's save function (no-op — stock saved via tile)
  useEffect(() => {
    allSizes.forEach((s: any) => {
      if (s.pvd) registerSave(s.pvd.productVariantDetailId, async () => {});
    });
    allCupSizes.forEach((cs: any) => {
      cs.pvds?.forEach((p: any) =>
        registerSave(p.productVariantDetailId, async () => {}),
      );
    });
  }, [allSizes, allCupSizes]);

  const tileBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    height: 40,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    padding: "0 14px",
    transition: "all 0.15s",
    position: "relative",
  };

  const addNumField = (key: string, label: string) => (
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
        value={addForm[key] ?? 0}
        onChange={(e) =>
          setAddForm((f) => ({ ...f, [key]: Number(e.target.value) }))
        }
        style={fieldStyle({ fontSize: 13 })}
      />
    </div>
  );

  function StockPanel({ pvd }: { pvd: any }) {
    const total = pvd.stockQuantity ?? 0;
    const processed = pvd.processedQuantity ?? 0;
    const refunded = pvd.returnedQuantity ?? 0;
    const available =
      pvd.availableQuantity ?? Math.max(0, total - processed + refunded);

    const availColor =
      available <= 0 ? "#c62828" : available <= 3 ? "#e65100" : "#2e7d32";
    const availBg =
      available <= 0 ? "#fdecea" : available <= 3 ? "#fff3e0" : "#e8f5e9";

    // Inline total-stock editor state
    const [editingStock, setEditingStock] = useState(false);
    const [stockDraft, setStockDraft] = useState(total);
    const [savingStock, setSavingStock] = useState(false);

    useEffect(() => {
      setStockDraft(total);
    }, [total]);

    async function commitStock() {
      if (stockDraft === total) {
        setEditingStock(false);
        return;
      }
      setSavingStock(true);
      try {
        await updateStock(pvd, stockDraft);
        setEditingStock(false);
      } finally {
        setSavingStock(false);
      }
    }

    const roLbl = (text: string) => (
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: SUB,
          marginBottom: 2,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {text}
      </div>
    );
    const roPill = (val: number, color: string, bg: string) => (
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color,
          background: bg,
          borderRadius: 6,
          padding: "3px 10px",
          display: "inline-block",
          minWidth: 36,
          textAlign: "center",
        }}
      >
        {val}
      </div>
    );

    return (
      <div
        style={{
          marginTop: 10,
          padding: "10px 12px",
          background: GRY,
          borderRadius: 10,
        }}
      >
        {/* Stock ID — read-only reference */}
        {pvd.stockId && (
          <div
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Stock ID
            </span>
            <span
              style={{
                fontFamily: "'Courier New',monospace",
                fontSize: 11,
                color: TXT,
                background: WHITE,
                border: `1px solid ${BDR}`,
                borderRadius: 5,
                padding: "1px 7px",
              }}
            >
              {pvd.stockId}
            </span>
          </div>
        )}

        {/* Stock summary row */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          {/* ── TOTAL STOCK — editable inline ── */}
          <div>
            {roLbl("Total Stock")}
            {editingStock ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setStockDraft((d) => Math.max(0, d - 1))}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    border: `1.5px solid ${BDR}`,
                    background: WHITE,
                    fontSize: 15,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: TXT,
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={stockDraft}
                  onChange={(e) =>
                    setStockDraft(Math.max(0, Number(e.target.value)))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitStock();
                    if (e.key === "Escape") setEditingStock(false);
                  }}
                  style={{
                    width: 60,
                    textAlign: "center",
                    fontSize: 15,
                    fontWeight: 800,
                    border: `1.5px solid ${P}`,
                    borderRadius: 6,
                    padding: "3px 4px",
                    outline: "none",
                    color: "#1565c0",
                  }}
                  autoFocus
                />
                <button
                  onClick={() => setStockDraft((d) => d + 1)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    border: `1.5px solid ${BDR}`,
                    background: WHITE,
                    fontSize: 15,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: TXT,
                  }}
                >
                  +
                </button>
                <button
                  onClick={commitStock}
                  disabled={savingStock}
                  style={{
                    padding: "3px 10px",
                    background: P,
                    color: WHITE,
                    border: "none",
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {savingStock ? "…" : "✓"}
                </button>
                <button
                  onClick={() => {
                    setEditingStock(false);
                    setStockDraft(total);
                  }}
                  style={{
                    padding: "3px 6px",
                    background: "transparent",
                    color: SUB,
                    border: "none",
                    borderRadius: 5,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingStock(true)}
                title="Click to edit total stock"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#1565c0",
                  background: "#e3f2fd",
                  borderRadius: 6,
                  padding: "3px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                  border: "1.5px dashed #90caf9",
                  minWidth: 36,
                }}
              >
                {total}
                <i
                  className="bi bi-pencil"
                  style={{ fontSize: 10, opacity: 0.6 }}
                />
              </div>
            )}
            <div style={{ fontSize: 9, color: SUB, marginTop: 2 }}>
              click to edit
            </div>
          </div>

          {/* ── Read-only: Available, Processed, Returned ── */}
          <div>
            {roLbl("Available")}
            {roPill(available, availColor, availBg)}
          </div>
          <div>
            {roLbl("Processed")}
            {roPill(processed, "#6a1b9a", "#f3e5f5")}
            <div style={{ fontSize: 8, color: SUB, marginTop: 2 }}>
              auto (orders)
            </div>
          </div>
          <div>
            {roLbl("Returned")}
            {roPill(refunded, "#795548", "#efebe9")}
            <div style={{ fontSize: 8, color: SUB, marginTop: 2 }}>
              auto (returns)
            </div>
          </div>
        </div>

        {/* Info note */}
        <div
          style={{
            fontSize: 10,
            color: SUB,
            marginBottom: 8,
            background: WHITE,
            borderRadius: 6,
            padding: "4px 8px",
            border: `1px dashed ${BDR}`,
          }}
        >
          ℹ️ Only <strong>Total Stock</strong> can be changed here. Processed &
          Returned are auto-managed by orders. For full stock control →{" "}
          <span
            onClick={() =>
              navigate(
                `/admin/stock?pvdId=${pvd.productVariantDetailId}&productId=${pvd.productId}&variantId=${pvd.productVariantId}`,
              )
            }
            style={{
              color: P,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Stock Management Page
          </span>
        </div>

        {/* Action row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() =>
              navigate(
                `/admin/stock?pvdId=${pvd.productVariantDetailId}&productId=${pvd.productId}&variantId=${pvd.productVariantId}`,
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "transparent",
              color: P,
              border: `1.5px solid ${P}`,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <i className="bi bi-box-seam" />
            Full Stock Page
          </button>
          <button
            onClick={() => deleteSize(pvd)}
            disabled={deleting === pvd.productVariantDetailId}
            style={{
              padding: "7px 10px",
              background: "#fdecea",
              color: "#c62828",
              border: "1px solid #ef9a9a",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </div>
    );
  }

  function AddPanel({
    onSave,
    onCancel,
  }: {
    onSave: () => void;
    onCancel: () => void;
  }) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: "12px 14px",
          background: "#fffbf8",
          border: `1px solid ${P}`,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "8px 12px",
            marginBottom: 10,
          }}
        >
          {addNumField("stockQuantity", "Stock Qty *")}
          {addNumField("mrpPrice", "MRP (₹) *")}
          {addNumField("finalPrice", "Selling Price (₹) *")}
          {/* Discount — auto-calculated, read-only */}
          <div key="discountDisplay">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                marginBottom: 3,
              }}
            >
              Discount %
            </div>
            <div
              style={{
                ...fieldStyle({ fontSize: 13 }),
                background: "#f5f5f5",
                color: SUB,
                cursor: "default",
                display: "flex",
                alignItems: "center",
              }}
            >
              {(() => {
                const mrp = addForm.mrpPrice ?? 0;
                const fp = addForm.finalPrice ?? 0;
                return mrp > 0
                  ? `${Math.round(((mrp - fp) / mrp) * 100)}%`
                  : "—";
              })()}
            </div>
          </div>
          {addNumField("cgst", "CGST %")}
          {addNumField("sgst", "SGST %")}
          {/* Stock ID */}
          <div style={{ gridColumn: "1/-1" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                marginBottom: 3,
              }}
            >
              Stock ID
            </div>
            <input
              type="text"
              placeholder="e.g. STK-001"
              value={addForm.stockId ?? ""}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, stockId: e.target.value }))
              }
              style={fieldStyle({ fontSize: 13 })}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "8px 0",
              background: P,
              color: WHITE,
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {saving ? "Adding…" : "Add Size"}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              background: GRY,
              color: TXT,
              border: "none",
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

  // ── Band sizes section ─────────────────────────────────────────────────────
  // ── Band sizes section — shows ALL MDM band sizes grouped by type ──────────
  const renderBandSizes = () => {
    if (paletteLoading || allSizes.length === 0) return null;

    // Render tile buttons for a list of sizes
    const renderTiles = (sizes: any[]) =>
      sizes.map((s) => {
        const pvd = s.pvd ?? null;
        const isSelected = selectedBandSizeId === s.sizeId;

        if (paletteIsCup) {
          // ── Cup-size mode: band tiles are SELECTORS — always clickable ──────
          return (
            <div key={s.sizeId} style={{ marginBottom: 4 }}>
              <button
                style={{
                  ...tileBase,
                  border: isSelected
                    ? `2px solid ${P}`
                    : pvd
                    ? `2px solid #333`
                    : `1.5px dashed #ccc`,
                  background: isSelected ? PLT : pvd ? WHITE : "#fafafa",
                  color: isSelected ? P : pvd ? "#222" : "#aaa",
                  cursor: "pointer",
                  boxShadow: isSelected ? `0 0 0 3px ${PLT}` : "none",
                }}
                onClick={() => {
                  setSelectedBandSizeId(isSelected ? null : s.sizeId);
                  setOpenTile(null); // close any open cup tile when band changes
                }}
                title={
                  pvd
                    ? `Select ${s.sizeLabel}`
                    : `${s.sizeLabel} — no stock yet`
                }
              >
                {!pvd && (
                  <span
                    style={{
                      position: "absolute",
                      top: -7,
                      right: -7,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#bbb",
                      color: "#fff",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                    }}
                  >
                    +
                  </span>
                )}
                {s.sizeLabel}
              </button>
            </div>
          );
        }

        // ── No-cup mode: show stock badge directly on band tile ───────────────
        const available = pvd
          ? pvd.availableQuantity ??
            Math.max(
              0,
              (pvd.stockQuantity ?? 0) -
                (pvd.processedQuantity ?? 0) +
                (pvd.returnedQuantity ?? 0),
            )
          : null;
        const oos = pvd && available !== null && available <= 0;
        const key = pvd ? `band-${s.sizeId}` : `add-band-${s.sizeId}`;
        const isOpen = openTile === key;

        return (
          <div key={s.sizeId}>
            <button
              style={{
                ...tileBase,
                border: pvd
                  ? `2px solid ${isOpen ? P : oos ? "#ef9a9a" : "#333"}`
                  : `1.5px dashed #ccc`,
                background: isOpen ? PLT : pvd ? WHITE : "#fafafa",
                color: pvd ? (isOpen ? P : "#222") : "#aaa",
                cursor: "pointer",
                boxShadow: pvd && isOpen ? `0 0 0 3px ${PLT}` : "none",
                flexDirection: "column",
                height: "auto",
                minHeight: 40,
                paddingTop: 4,
                paddingBottom: 4,
                gap: 2,
              }}
              onClick={() => {
                if (!pvd) {
                  setOpenTile(isOpen ? null : key);
                  initAddForm(s.sizeId, null);
                } else {
                  setOpenTile(isOpen ? null : key);
                }
              }}
              title={
                pvd
                  ? `${s.sizeLabel} — ${available} available`
                  : `Add ${s.sizeLabel}`
              }
            >
              {!pvd && (
                <span
                  style={{
                    position: "absolute",
                    top: -7,
                    right: -7,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#888",
                    color: "#fff",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  +
                </span>
              )}
              {s.sizeLabel}
              {pvd && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: oos ? "#e53935" : "#2e7d32",
                    lineHeight: 1,
                  }}
                >
                  {oos ? "OOS" : `${available} avail`}
                </span>
              )}
            </button>
          </div>
        );
      });

    // If backend returned grouped data, render each type in its own labelled sub-section
    if (hasMultipleTypes) {
      const typeOrder = ["numerical", "alphabetical"];
      const typeLabels: Record<string, string> = {
        numerical: "Band Sizes — Numerical",
        alphabetical: "Band Sizes — Alphabetical",
        other: "Band Sizes",
      };
      const sortedTypes = [
        ...typeOrder.filter((t) => bandSizesByType[t]),
        ...Object.keys(bandSizesByType).filter((t) => !typeOrder.includes(t)),
      ];
      // Find the open pvd/addState across all types for panel rendering
      const openBandNoCupPvd = (() => {
        if (!openTile) return null;
        if (openTile.startsWith("add-band-")) return null;
        if (!openTile.startsWith("band-")) return null;
        const sid = parseInt(openTile.replace("band-", ""));
        return allSizes.find((x: any) => x.sizeId === sid)?.pvd ?? null;
      })();
      const openBandNoCupAddSizeId = (() => {
        if (!openTile || !openTile.startsWith("add-band-")) return null;
        return parseInt(openTile.replace("add-band-", ""));
      })();

      return (
        <div style={{ marginBottom: 20 }}>
          {sortedTypes.map((type) => (
            <div key={type} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                {typeLabels[type] ?? `Band Sizes — ${type}`}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {renderTiles(bandSizesByType[type])}
              </div>
            </div>
          ))}
          {openBandNoCupPvd && (
            <div style={{ marginTop: 8 }}>
              <StockPanel pvd={openBandNoCupPvd} />
            </div>
          )}
          {openBandNoCupAddSizeId !== null && (
            <div style={{ marginTop: 8 }}>
              <AddPanel onSave={addSize} onCancel={() => setOpenTile(null)} />
            </div>
          )}
        </div>
      );
    }

    // Single type — original flat layout
    const openBandNoCupPvdSingle = (() => {
      if (!openTile || !openTile.startsWith("band-")) return null;
      const sid = parseInt(openTile.replace("band-", ""));
      return allSizes.find((x: any) => x.sizeId === sid)?.pvd ?? null;
    })();
    const openBandNoCupAddSingle = openTile?.startsWith("add-band-") ?? false;

    return (
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          Band Sizes
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {renderTiles(allSizes)}
        </div>
        {openBandNoCupPvdSingle && (
          <div style={{ marginTop: 8 }}>
            <StockPanel pvd={openBandNoCupPvdSingle} />
          </div>
        )}
        {openBandNoCupAddSingle && (
          <div style={{ marginTop: 8 }}>
            <AddPanel onSave={addSize} onCancel={() => setOpenTile(null)} />
          </div>
        )}
      </div>
    );
  };

  // ── Cup sizes section (only when isCupSize === true) ───────────────────────
  const renderCupSizes = () => {
    if (allCupSizes.length === 0) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          Cup Sizes
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: paletteIsCup ? P : SUB,
              textTransform: "none",
              letterSpacing: 0,
              background: paletteIsCup ? PLT : GRY,
              border: `1.5px solid ${paletteIsCup ? P : BDR}`,
              borderRadius: 20,
              padding: "2px 8px",
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={paletteIsCup}
              style={{ accentColor: P, width: 13, height: 13 }}
              onChange={(e) => onCupSizeToggle?.(e.target.checked)}
            />
            {paletteIsCup ? "✓ Enabled" : "Enable Cup Sizes"}
          </label>
          {paletteIsCup && (
            <span style={{ fontSize: 11, color: P, fontWeight: 700 }}>
              ↓ Select a band size to manage cup stock
            </span>
          )}
        </div>

        {/* Prompt user to select a band size first */}
        {paletteIsCup && !selectedBandSizeId && (
          <div
            style={{
              fontSize: 12,
              color: "#e65100",
              background: "#fff8e1",
              border: "1px solid #ffe082",
              borderRadius: 8,
              padding: "8px 14px",
              marginBottom: 10,
              display: "inline-block",
            }}
          >
            ← Select a band size above to see cup size stock
          </div>
        )}

        {paletteIsCup && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {allCupSizes.map((cs) => {
              // Find the PVD that matches the selected band + this cup
              const pvd = selectedBandSizeId
                ? (cs.pvds ?? []).find(
                    (p: any) => p.sizeId === selectedBandSizeId,
                  ) ?? null
                : null;

              const hasPvd = !!pvd;
              const key = selectedBandSizeId
                ? hasPvd
                  ? `cup-${selectedBandSizeId}-${cs.cupSizeId}`
                  : `add-cup-${selectedBandSizeId}-${cs.cupSizeId}`
                : `cup-${cs.cupSizeId}`;
              const isOpen = openTile === key;

              const available = pvd
                ? pvd.availableQuantity ??
                  Math.max(
                    0,
                    (pvd.stockQuantity ?? 0) -
                      (pvd.processedQuantity ?? 0) +
                      (pvd.returnedQuantity ?? 0),
                  )
                : null;
              const oos = pvd && available !== null && available <= 0;

              // When no band is selected, grey out all cup tiles
              const isDisabled = !selectedBandSizeId;

              return (
                <div key={cs.cupSizeId}>
                  <button
                    disabled={isDisabled}
                    style={{
                      ...tileBase,
                      border: isDisabled
                        ? `1.5px dashed #ddd`
                        : hasPvd
                        ? `2px solid ${isOpen ? P : oos ? "#ef9a9a" : "#333"}`
                        : `1.5px dashed #ccc`,
                      background: isDisabled
                        ? "#f5f5f5"
                        : isOpen
                        ? PLT
                        : hasPvd
                        ? WHITE
                        : "#fafafa",
                      color: isDisabled
                        ? "#ccc"
                        : hasPvd
                        ? isOpen
                          ? P
                          : "#222"
                        : "#aaa",
                      boxShadow: hasPvd && isOpen ? `0 0 0 3px ${PLT}` : "none",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      flexDirection: "column",
                      height: "auto",
                      minHeight: 40,
                      paddingTop: 4,
                      paddingBottom: 4,
                      gap: 2,
                    }}
                    onClick={() => {
                      if (isDisabled) return;
                      if (!hasPvd) {
                        setOpenTile(isOpen ? null : key);
                        initAddForm(selectedBandSizeId, cs.cupSizeId);
                      } else {
                        setOpenTile(isOpen ? null : key);
                      }
                    }}
                    title={
                      isDisabled
                        ? "Select a band size first"
                        : hasPvd
                        ? `${cs.sizeLabel} — ${available} available`
                        : `Add ${cs.sizeLabel}`
                    }
                  >
                    {!isDisabled && !hasPvd && (
                      <span
                        style={{
                          position: "absolute",
                          top: -7,
                          right: -7,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#888",
                          color: "#fff",
                          fontSize: 11,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                        }}
                      >
                        +
                      </span>
                    )}
                    {cs.sizeLabel}
                    {/* Show stock for selected band+cup combination */}
                    {selectedBandSizeId && hasPvd && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: oos ? "#e53935" : "#2e7d32",
                          lineHeight: 1,
                        }}
                      >
                        {oos ? "OOS" : `${available} avail`}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {/* Stock/Add panel for cup sizes — below all tiles, never between them */}
        {paletteIsCup &&
          (() => {
            if (!openTile) return null;
            if (openTile.startsWith("cup-") && !openTile.startsWith("add-")) {
              const parts = openTile.replace("cup-", "").split("-");
              if (parts.length === 2) {
                const bandId = parseInt(parts[0]);
                const cupId = parseInt(parts[1]);
                const cs = allCupSizes.find((x: any) => x.cupSizeId === cupId);
                const pvd =
                  (cs?.pvds ?? []).find((p: any) => p.sizeId === bandId) ??
                  null;
                if (pvd)
                  return (
                    <div style={{ marginTop: 8 }}>
                      <StockPanel pvd={pvd} />
                    </div>
                  );
              }
            }
            if (openTile.startsWith("add-cup-")) {
              return (
                <div style={{ marginTop: 8 }}>
                  <AddPanel
                    onSave={addSize}
                    onCancel={() => setOpenTile(null)}
                  />
                </div>
              );
            }
            return null;
          })()}
      </div>
    );
  };

  // ── Derive activePvd from current open tile ─────────────────────────────────
  let activePvd: any = null;
  if (openTile && !openTile.startsWith("add-")) {
    if (openTile.startsWith("band-")) {
      const sizeId = parseInt(openTile.replace("band-", ""));
      const s = allSizes.find((x: any) => x.sizeId === sizeId);
      activePvd = s?.pvd ?? null;
    } else if (openTile.startsWith("cup-")) {
      const raw = openTile.replace("cup-", "");
      const parts = raw.split("-");
      if (parts.length === 2) {
        const bandId = parseInt(parts[0]);
        const cupId = parseInt(parts[1]);
        const cs = allCupSizes.find((x: any) => x.cupSizeId === cupId);
        activePvd =
          (cs?.pvds ?? []).find((p: any) => p.sizeId === bandId) ?? null;
      }
    }
  }

  // ── Inline-editable price field (matches InlineField style) ─────────────────
  function PriceInlineField({
    label,
    pvd: pv,
    field,
  }: {
    label: string;
    pvd: any;
    field: "mrpPrice" | "finalPrice";
  }) {
    const [editing, setPriceEditing] = useState(false);
    const [draft, setDraft] = useState<number>(pv[field] ?? 0);
    const [committed, setCommitted] = useState<number>(pv[field] ?? 0);

    useEffect(() => {
      setDraft(pv[field] ?? 0);
      setCommitted(pv[field] ?? 0);
    }, [pv, field]);

    const isDirty = committed !== (pv[field] ?? 0);

    async function commit() {
      setPriceEditing(false);
      setCommitted(draft);
      if (draft !== (pv[field] ?? 0)) {
        await updatePvd(pv, {
          stockQuantity: pv.stockQuantity ?? 0,
          mrpPrice: field === "mrpPrice" ? draft : pv.mrpPrice ?? 0,
          finalPrice: field === "finalPrice" ? draft : pv.finalPrice ?? 0,
        });
      }
    }

    return (
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {label}
          {isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f59e0b",
                display: "inline-block",
              }}
              title="Unsaved change"
            />
          )}
        </div>
        {editing ? (
          <input
            type="number"
            min={0}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(Number(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setPriceEditing(false);
                setDraft(committed);
              }
            }}
            style={fieldStyle({ fontSize: 16, fontWeight: 700 })}
          />
        ) : (
          <div
            onClick={() => {
              setPriceEditing(true);
              setDraft(committed);
            }}
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: TXT,
              cursor: "pointer",
              padding: "6px 0",
              borderBottom: isDirty
                ? "1.5px solid #f59e0b"
                : `1.5px dashed ${BDR}`,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Click to edit"
          >
            ₹{committed.toLocaleString("en-IN")}
            <i
              className="bi bi-pencil"
              style={{ fontSize: 11, color: SUB, opacity: 0.6 }}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Inline-editable Stock ID field ─────────────────────────────────────────
  function StockIdInlineField({ pvd: pv }: { pvd: any }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<string>(pv.stockId ?? "");
    const [committed, setCommitted] = useState<string>(pv.stockId ?? "");

    useEffect(() => {
      setDraft(pv.stockId ?? "");
      setCommitted(pv.stockId ?? "");
    }, [pv]);

    const isDirty = committed !== (pv.stockId ?? "");

    async function commit() {
      setEditing(false);
      setCommitted(draft);
      if (draft !== (pv.stockId ?? "")) {
        await updatePvd(pv, {
          stockQuantity: pv.stockQuantity ?? 0,
          mrpPrice: pv.mrpPrice ?? 0,
          finalPrice: pv.finalPrice ?? 0,
          stockId: draft,
        });
      }
    }

    return (
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Stock ID
          {isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f59e0b",
                display: "inline-block",
              }}
              title="Unsaved change"
            />
          )}
        </div>
        {editing ? (
          <input
            type="text"
            value={draft}
            autoFocus
            placeholder="e.g. STK-001"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(committed);
              }
            }}
            style={fieldStyle({
              fontSize: 13,
              fontFamily: "'Courier New',monospace",
            })}
          />
        ) : (
          <div
            onClick={() => {
              setEditing(true);
              setDraft(committed);
            }}
            style={{
              fontSize: 13,
              fontFamily: "'Courier New',monospace",
              color: committed ? TXT : SUB,
              cursor: "pointer",
              padding: "6px 0",
              borderBottom: isDirty
                ? "1.5px solid #f59e0b"
                : `1.5px dashed ${BDR}`,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Click to edit"
          >
            {committed || (
              <span style={{ fontStyle: "italic", color: SUB }}>Not set</span>
            )}
            <i
              className="bi bi-pencil"
              style={{ fontSize: 11, color: SUB, opacity: 0.6 }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {paletteLoading && (
        <div style={{ fontSize: 12, color: SUB, padding: "10px 0" }}>
          Loading sizes…
        </div>
      )}
      {!paletteLoading && allSizes.length === 0 && (
        <div style={{ fontSize: 12, color: SUB, padding: "10px 0" }}>
          No band sizes found in MDM.
        </div>
      )}
      {renderBandSizes()}
      {renderCupSizes()}

      {/* ── Pricing section — shown when a size with a pvd is selected ──────── */}
      {activePvd && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1.5px solid ${BDR}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Pricing
          </div>

          {/* Stock ID — inline editable */}
          <StockIdInlineField pvd={activePvd} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 24px",
              marginBottom: 12,
            }}
          >
            <PriceInlineField
              label="MRP (₹)"
              pvd={activePvd}
              field="mrpPrice"
            />
            <PriceInlineField
              label="Selling Price (₹)"
              pvd={activePvd}
              field="finalPrice"
            />
          </div>
          {/* Auto-calculated discount badge */}
          {(() => {
            const mrp = activePvd.mrpPrice ?? 0;
            const fp = activePvd.finalPrice ?? 0;
            const disc = mrp > 0 ? Math.round(((mrp - fp) / mrp) * 100) : 0;
            if (disc <= 0) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SUB,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Discount
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#2e7d32",
                    background: "#e8f5e9",
                    borderRadius: 6,
                    padding: "2px 10px",
                  }}
                >
                  {disc}% off
                </div>
              </div>
            );
          })()}
        </div>
      )}
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
    colorFamily: "",
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
        {/* Color Family */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase" as const,
            }}
          >
            Color Family
          </div>
          <select
            value={form.colorFamily}
            onChange={(e) =>
              setForm((f) => ({ ...f, colorFamily: e.target.value }))
            }
            style={{
              ...fieldStyle({ cursor: "pointer" }),
              appearance: "auto" as const,
            }}
          >
            <option value="">— Select family —</option>
            {COLOR_FAMILY_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
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
  const location = useLocation();
  const adminLayout = useOutletContext<AdminLayoutOutletContext | null>();
  const setSidebarCollapsed = adminLayout?.setSidebarCollapsed;
  const qc = useQueryClient();
  const productId = Number(id);
  const isNew = !id || id === "new";

  const [selVariantId, setSelVariantId] = useState<number | null>(null);
  // Map of productVariantDetailId → save fn, populated by SizeRow children
  const sizeRowSavers = useRef<Map<number, () => Promise<void>>>(new Map());

  // ── Pending (uncommitted to server) field changes ─────────────────────────
  const [pendingProduct, setPendingProduct] = useState<Record<string, any>>({});
  const [pendingVariant, setPendingVariant] = useState<Record<string, any>>({});

  const isDirty =
    Object.keys(pendingProduct).length > 0 ||
    Object.keys(pendingVariant).length > 0;

  function queueProduct(data: Record<string, any>) {
    setPendingProduct((p) => ({ ...p, ...data }));
  }
  function queueVariant(data: Record<string, any>) {
    setPendingVariant((p) => ({ ...p, ...data }));
  }

  // ── Navigation blocker ────────────────────────────────────────────────────
  const [showNavModal, setShowNavModal] = useState(false);
  const [pendingNavFn, setPendingNavFn] = useState<(() => void) | null>(null);

  // Intercept browser back/forward when dirty
  useEffect(() => {
    if (!isDirty) return;
    // Push a dummy history entry so the back button fires popstate first
    window.history.pushState({ __navGuard: true }, "");
    const handler = (e: PopStateEvent) => {
      if (isDirty) {
        // Push entry back so the URL doesn't change yet
        window.history.pushState({ __navGuard: true }, "");
        toast("⚠️ You have unsaved changes — save or discard before leaving.", {
          duration: 4000,
        });
        setShowNavModal(true);
        setPendingNavFn(() => () => {
          window.history.go(-2); // go back past our dummy entry
        });
      }
    };
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [isDirty]);

  // Browser close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function requestNav(fn: () => void) {
    if (isDirty) {
      toast("⚠️ You have unsaved changes — save or discard before leaving.", {
        duration: 4000,
      });
      setPendingNavFn(() => fn);
      setShowNavModal(true);
    } else fn();
  }

  async function confirmNavSave() {
    await saveAll();
    setShowNavModal(false);
    if (pendingNavFn) {
      pendingNavFn();
      setPendingNavFn(null);
    }
  }

  function confirmNavDiscard() {
    setPendingProduct({});
    setPendingVariant({});
    setShowNavModal(false);
    if (pendingNavFn) {
      pendingNavFn();
      setPendingNavFn(null);
    }
  }

  function cancelNav() {
    setShowNavModal(false);
    setPendingNavFn(null);
  }
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [addVariantOpen, setAddVariantOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed?.(true);
  }, [setSidebarCollapsed]);

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
  const { data: taxHsnData } = useQuery({
    queryKey: ["mdm-taxhsn-all"],
    queryFn: () =>
      api
        .get("/MDM/TaxHSNCode", { params: { "Page.Size": 500 } })
        .then((r) => r.data),
    staleTime: 300_000,
  });
  const { data: fabricsData } = useQuery({
    queryKey: ["mdm-fabrics-all"],
    queryFn: () =>
      api
        .get("/MDM/Fabrics", { params: { "Page.Size": 500 } })
        .then((r) => r.data),
    staleTime: 300_000,
  });

  const allCats: any[] = catsData?.list ?? [];
  const allBrands: any[] = brandsData?.list ?? [];
  const allTaxHsn: any[] = taxHsnData?.list ?? [];
  const allFabrics: any[] = fabricsData?.list ?? [];
  const parentCats = allCats.filter(
    (c) => !c.parentCategoryId || c.parentCategoryId === 0,
  );
  const childCats = (pid: number) =>
    allCats.filter((c) => Number(c.parentCategoryId) === Number(pid));

  const productVariants = Array.isArray(product?.allVariants)
    ? product.allVariants.filter((v: any) => v.deletedInd !== true)
    : [];

  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ["admin-variants-full", productId],
    queryFn: () =>
      api
        .get("/ProductVariants", {
          params: {
            Filters: JSON.stringify([
              {
                property: "ProductId",
                comparison: "==",
                value: String(productId),
              },
            ]),
            "Page.Size": 100,
          },
        })
        .then((r) => r.data),
    enabled: !isNew,
  });
  const fetchedVariants: any[] = (
    Array.isArray(variantsData) ? variantsData : variantsData?.list ?? []
  ).filter((v: any) => v.deletedInd !== true);
  const variants: any[] = useMemo(() => {
    const byId = new Map<number, any>();
    [...productVariants, ...fetchedVariants].forEach((variant) => {
      const id = Number(variant?.productVariantId);
      if (!id) return;
      byId.set(id, { ...(byId.get(id) ?? {}), ...variant });
    });
    return Array.from(byId.values());
  }, [productVariants, fetchedVariants]);

  // Auto-select first variant
  useEffect(() => {
    if (!selVariantId && variants.length > 0)
      setSelVariantId(variants[0].productVariantId);
  }, [variants, selVariantId]);

  // Clear registered savers whenever the selected variant changes
  useEffect(() => {
    sizeRowSavers.current.clear();
    setPendingVariant({});
  }, [selVariantId]);

  const selVariant = variants.find((v) => v.productVariantId === selVariantId);

  // Images for selected variant (fresh from API)
  const { data: imagesData, refetch: refetchImages } = useQuery({
    queryKey: ["admin-variant-images", selVariantId],
    queryFn: () =>
      api.get(`/ProductVariants/${selVariantId}/images`).then((r) => r.data),
    enabled: !!selVariantId,
  });

  const { data: userVariantDetail } = useQuery({
    queryKey: ["admin-user-variant-detail", selVariantId],
    queryFn: () =>
      api
        .get(`/ProductVariantDetail/UserProductVariant/${selVariantId}`)
        .then((r) => r.data),
    enabled: !!selVariantId,
    staleTime: 60_000,
  });

  const variantImages: any[] = useMemo(
    () =>
      mergeImageSources(
        Array.isArray(imagesData) ? imagesData : imagesData?.list ?? [],
        userVariantDetail?.images,
        userVariantDetail?.image,
        selVariant?.images,
        selVariant?.imageUrl ||
          selVariant?.image ||
          selVariant?.selectedImage ||
          selVariant?.thumbnail,
      ),
    [imagesData, userVariantDetail, selVariant],
  );

  // Reset image index when variant switches
  useEffect(() => {
    setActiveImgIdx(0);
  }, [selVariantId]);

  useEffect(() => {
    if (activeImgIdx >= variantImages.length) {
      setActiveImgIdx(Math.max(0, variantImages.length - 1));
    }
  }, [activeImgIdx, variantImages.length]);

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
      updatedToast();
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
      updatedToast();
      refetchVariants();
    } catch {
      toast.error("Save failed");
    }
  }

  // ── Save everything ───────────────────────────────────────────────────────
  const [savingAll, setSavingAll] = useState(false);
  async function saveAll() {
    setSavingAll(true);
    try {
      if (Object.keys(pendingProduct).length > 0) {
        await patchProduct(pendingProduct);
        setPendingProduct({});
      }
      if (Object.keys(pendingVariant).length > 0) {
        await patchVariant(pendingVariant);
        setPendingVariant({});
      }
      if (sizeRowSavers.current.size > 0) {
        await Promise.all(
          [...sizeRowSavers.current.values()].map((fn) => fn()),
        );
      }
      if (
        Object.keys(pendingProduct).length === 0 &&
        Object.keys(pendingVariant).length === 0 &&
        sizeRowSavers.current.size === 0
      ) {
        toast("Nothing to save");
      }
    } finally {
      setSavingAll(false);
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
      refetchProduct();
    } catch {
      toast.error("Toggle failed — please try again");
    }
  }

  const goBack = () =>
    requestNav(() =>
      navigate("/admin/products", {
        state: location.state, // restores the brand/category drill-down position
      }),
    );

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
          onClick={() =>
            api
              .patch(`/Products/${productId}/toggle-active`)
              .then(() => {
                toast.success(
                  product.isActive !== false
                    ? "Product hidden"
                    : "Product shown",
                );
                refetchProduct();
                // Invalidate the products list so the card updates immediately on back-navigate
                qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
                qc.invalidateQueries({
                  queryKey: ["admin-product", productId],
                });
              })
              .catch(() => toast.error("Failed"))
          }
          style={{
            padding: "4px 12px",
            background: product.isActive !== false ? "#fff8e1" : "#e8f5e9",
            color: product.isActive !== false ? "#e65100" : "#2e7d32",
            border: `1.5px solid ${
              product.isActive !== false ? "#ffe082" : "#c8e6c9"
            }`,
            borderRadius: 20,
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {product.isActive !== false ? "Hide Product" : "Show Product"}
        </button>
      </div>

      {/* ── Unsaved-changes banner ─────────────────────────────────────────── */}
      {isDirty && (
        <div
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            padding: "8px 32px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "#92400e",
            position: "sticky",
            top: 57,
            zIndex: 99,
          }}
        >
          <span style={{ fontSize: 15 }}>●</span>
          <span style={{ fontWeight: 600 }}>You have unsaved changes.</span>
          <span style={{ color: "#a16207" }}>
            Click <strong>Save</strong> below to apply them.
          </span>
          <button
            onClick={() => {
              setPendingProduct({});
              setPendingVariant({});
            }}
            style={{
              marginLeft: "auto",
              padding: "3px 12px",
              border: "1px solid #fbbf24",
              background: "transparent",
              color: "#92400e",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
        </div>
      )}

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
          <InlineSelect
            label="Brand"
            value={product.brandId}
            options={allBrands.map((b) => ({
              id: b.brandId,
              name: b.brandName,
            }))}
            onSave={(v) => queueProduct({ brandId: v })}
          />

          {/* Product Name */}
          <div style={{ marginBottom: 6 }}>
            <InlineField
              value={product.name || ""}
              placeholder="Product name…"
              onSave={(v) => queueProduct({ name: v })}
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
                onSave={(v) => queueProduct({ productCode: v })}
              />
            </span>
          </div>

          {/* Tax HSN Code — product level */}
          <InlineSelect
            label="Tax / HSN Code"
            value={product.taxHSNCodeId}
            options={allTaxHsn.map((t) => ({
              id: t.taxHSNCodeId,
              name: t.hsnCode
                ? `${t.hsnCode}${
                    t.hsnDescription ? " — " + t.hsnDescription : ""
                  }${t.totalGST ? " (" + t.totalGST + "% GST)" : ""}`
                : String(t.taxHSNCodeId),
            }))}
            onSave={(v) => queueProduct({ taxHSNCodeId: v })}
          />

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
            onSave={(v) => queueProduct({ description: v })}
          />

          {/* Tags */}
          <InlineField
            label="Tags"
            value={product.tag || ""}
            placeholder="Add tags…"
            onSave={(v) => queueProduct({ tag: v })}
          />

          <div style={{ height: 1, background: BDR, margin: "20px 0" }} />

          {/* ── Category selectors ───────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 20px",
              marginBottom: 4,
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
                queueProduct({ categoryId: v, childCategoryId: null })
              }
            />
            <InlineSelect
              label="Child Category"
              value={product.childCategoryId}
              options={childCats(product.categoryId || 0).map((c) => ({
                id: c.categoryId,
                name: c.name,
              }))}
              onSave={(v) => queueProduct({ childCategoryId: v })}
            />
          </div>

          {/* ── Variant swatches (like user-side colour picker) ────────────── */}
          {variants.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
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
                  Variants ({variants.length})
                </div>
                <button
                  onClick={() => setAddVariantOpen(true)}
                  style={{
                    padding: "6px 12px",
                    background: P,
                    color: WHITE,
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  <i className="bi bi-plus-lg" /> Add Variant
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {variants.map((v) => {
                  const isSel = v.productVariantId === selVariantId;
                  const hex = getVariantColor(v);
                  const firstImg = mergeImageSources(
                    v.images,
                    v.imageUrl ||
                      v.imageURL ||
                      v.image ||
                      v.selectedImage ||
                      v.thumbnail,
                  )[0];
                  const imgSrc = firstImg
                    ? imgUrl(imagePathFromAny(firstImg))
                    : null;
                  return (
                    <button
                      key={v.productVariantId}
                      onClick={() =>
                        requestNav(() => setSelVariantId(v.productVariantId))
                      }
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
            </div>
          )}

          {/* ── Color / Color Family / Fabric — 3-col ───────────────────── */}
          {selVariant && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0 16px",
                marginBottom: 4,
              }}
            >
              <InlineField
                label="Color Name"
                value={selVariant.color || ""}
                placeholder="e.g. Dark Navy Blue…"
                onSave={(v) => {
                  const suggested = !selVariant.colorFamily
                    ? guessColorFamily(v)
                    : null;
                  queueVariant(
                    suggested
                      ? { color: v, colorFamily: suggested }
                      : { color: v },
                  );
                }}
              />
              <InlineStringSelect
                label="Color Family"
                value={
                  pendingVariant.colorFamily !== undefined
                    ? pendingVariant.colorFamily
                    : selVariant.colorFamily || null
                }
                options={COLOR_FAMILY_OPTIONS}
                onSave={(v) => queueVariant({ colorFamily: v })}
              />
              <InlineSelect
                label="Fabric"
                value={selVariant.fabricId}
                options={allFabrics.map((f) => ({
                  id: f.fabricId,
                  name: f.name || f.fabricCode || String(f.fabricId),
                }))}
                onSave={(v) => queueVariant({ fabricId: v })}
              />
            </div>
          )}

          {/* ── Best Seller + Returns — variant-level, shown right below colour ── */}
          {selVariant && (
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              {(
                [
                  ["isBestSeller", "Best Seller"],
                  ["isReturnAvailable", "Returns"],
                ] as [string, string][]
              ).map(([key, label]) => {
                const currentVal =
                  pendingVariant[key] !== undefined
                    ? pendingVariant[key]
                    : !!selVariant[key];
                return (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      color: TXT,
                      userSelect: "none" as const,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={currentVal}
                      style={{ accentColor: P, width: 14, height: 14 }}
                      onChange={(e) =>
                        queueVariant({ [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          )}

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
                  Sizes & Stock
                </div>
              </div>
              <SizePalette
                variantId={selVariantId!}
                productId={productId}
                isCupSize={!!selVariant.isCupSize}
                onRefresh={refetchPvd}
                registerSave={(id, fn) => sizeRowSavers.current.set(id, fn)}
                onCupSizeToggle={(val) => queueVariant({ isCupSize: val })}
                navigate={navigate}
              />

              {/* ── Save + Hide/Show Variant ────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 16,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={saveAll}
                  disabled={savingAll}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 12,
                    cursor: "pointer",
                    border: "none",
                    background: P,
                    color: WHITE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    minWidth: 120,
                  }}
                >
                  <i className="bi bi-floppy" />
                  {savingAll ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={toggleVariantActive}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    fontSize: 14,
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
                    minWidth: 120,
                  }}
                >
                  <i className={`bi ${isHidden ? "bi-eye" : "bi-eye-slash"}`} />
                  {isHidden ? "Show Variant" : "Hide Variant"}
                </button>
                <button
                  onClick={() =>
                    navigate(`/admin/stock?productId=${productId}`)
                  }
                  style={{
                    padding: "13px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 12,
                    cursor: "pointer",
                    border: `1.5px solid ${P}`,
                    background: "transparent",
                    color: P,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  title="View full product history in Stock page"
                >
                  <i className="bi bi-clock-history" />
                  History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Unsaved-changes warning modal ─────────────────────────────────── */}
      {showNavModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: WHITE,
              borderRadius: 16,
              padding: "28px 32px",
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: TXT,
                marginBottom: 8,
              }}
            >
              Unsaved changes
            </div>
            <div
              style={{
                fontSize: 13,
                color: SUB,
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              You have edits that haven't been saved yet. Do you want to save
              them before leaving?
            </div>
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                onClick={confirmNavSave}
                style={{
                  padding: "10px 0",
                  background: P,
                  color: WHITE,
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save & Continue
              </button>
              <button
                onClick={confirmNavDiscard}
                style={{
                  padding: "10px 0",
                  background: "#fdecea",
                  color: "#c62828",
                  border: "1px solid #ef9a9a",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Discard & Continue
              </button>
              <button
                onClick={cancelNav}
                style={{
                  padding: "10px 0",
                  background: GRY,
                  color: TXT,
                  border: "none",
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Stay on page
              </button>
            </div>
          </div>
        </div>
      )}

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
