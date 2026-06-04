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
  colorFamilyHexOf,
  colorFamilyNameOf,
  normalizeColorFamily,
  FALLBACK_COLOR_FAMILY_HEX,
  type ColorFamilyOption,
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
// API_ORIGIN removed — backend always returns full URLs

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Backend returns full URLs — no URL construction needed on the frontend.
function imgUrl(src: string | null | undefined): string {
  if (!src) return "";
  // Keep base64 data inline (legacy path)
  if (/^data:image\//.test(src)) return src;
  if (/^[A-Za-z0-9+/]+=*$/.test(src) && src.length > 120)
    return `data:image/jpeg;base64,${src}`;
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

    // Normalize to a path-only key so that relative and absolute forms of
    // the same file don't both get included (e.g. "uploads/x.jpg" vs
    // "http://127.0.0.1:8000/uploads/x.jpg" are the same image).
    let key = filePath.trim().toLowerCase();
    try {
      // If it's a full URL, use just the pathname for dedup
      key = new URL(key).pathname;
    } catch {
      // Not a URL — strip any leading host:port prefix if present
      key = key.replace(/^https?:\/\/[^/]+/, "");
    }
    if (!key) return;
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
  return colorFamilyHexOf(variant);
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
  required = false,
}: {
  label?: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  onSave: (v: string) => void;
  large?: boolean;
  required?: boolean;
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
    // Always call onSave so that if the user typed → changed → reverted,
    // pendingProduct is updated to the correct value rather than holding a stale change.
    onSave(next);
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
          {required && (
            <span style={{ color: "#c62828", marginLeft: 2 }}>*</span>
          )}
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
  required = false,
}: {
  label: string;
  value: number | null | undefined;
  options: { id: number; name: string }[];
  onSave: (v: number) => void;
  required?: boolean;
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
        {required && <span style={{ color: "#c62828", marginLeft: 2 }}>*</span>}
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
function InlineColorFamilySelect({
  label,
  valueId,
  valueName,
  options,
  onSave,
}: {
  label: string;
  valueId: number | null | undefined;
  valueName?: string | null;
  options: ColorFamilyOption[];
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(valueId ? String(valueId) : "");

  useEffect(() => {
    setLocalValue(valueId ? String(valueId) : "");
  }, [valueId]);

  const savedValue = valueId ? String(valueId) : "";
  const isDirty = localValue !== savedValue;
  const current = options.find((o) => String(o.id) === localValue);
  const displayName = current?.name || valueName || "";
  const swatch = current?.hex || FALLBACK_COLOR_FAMILY_HEX;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setLocalValue(next);
    setEditing(false);
    if (next !== savedValue) onSave(next ? Number(next) : null);
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
            color: displayName ? TXT : SUB,
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
          {displayName && (
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
          {displayName || <span style={{ fontStyle: "italic" }}>Not set</span>}
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
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || err?.message || "Upload failed",
      );
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
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
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

// ─── Standalone numeric input (defined OUTSIDE SizePalette so it never ────────
// remounts on addForm state change — fixes the focus-lost-after-one-digit bug)
function NumInput({
  label,
  value,
  isPrice = false,
  onChange,
  onMrpBlur,
}: {
  label: string;
  value: number;
  isPrice?: boolean;
  onChange: (val: number) => void;
  onMrpBlur?: (val: number) => void;
}) {
  const [raw, setRaw] = useState<string>(value === 0 ? "" : String(value));

  // Sync inbound value changes (e.g. when finalPrice is auto-filled from mrp)
  useEffect(() => {
    // Only overwrite if the parsed version differs — avoids clobbering mid-type
    const parsed = isPrice ? parseFloat(raw) || 0 : parseInt(raw, 10) || 0;
    if (parsed !== value) {
      setRaw(value === 0 ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const allowed = isPrice ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;

  function commit() {
    const num =
      raw === "" ? 0 : isPrice ? parseFloat(raw) || 0 : parseInt(raw, 10) || 0;
    onChange(num);
    if (onMrpBlur) onMrpBlur(num);
  }

  return (
    <div>
      <div
        style={{ fontSize: 10, fontWeight: 700, color: SUB, marginBottom: 3 }}
      >
        {label}
      </div>
      <input
        type="text"
        inputMode={isPrice ? "decimal" : "numeric"}
        pattern={isPrice ? "[0-9]*.?[0-9]*" : "[0-9]*"}
        value={raw}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value;
          if (v !== "" && !allowed.test(v)) return;
          setRaw(v);
        }}
        onBlur={commit}
        style={{
          ...fieldStyle({ fontSize: 13 }),
          MozAppearance: "textfield" as any,
        }}
      />
    </div>
  );
}

// ─── Standalone text input (same pattern as NumInput — lives outside SizePalette
// so it never remounts on addForm state changes, preventing focus-loss)
function TextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  // Pure controlled input — no local state, no useEffect.
  // The previous implementation held a local copy in useState and synced it
  // via useEffect([value]). Every keystroke called onChange → parent updated
  // addForm.stockId → re-render changed the value prop → useEffect fired →
  // setLocal() scheduled another render → input lost focus after each digit.
  return (
    <div>
      <div
        style={{ fontSize: 10, fontWeight: 700, color: SUB, marginBottom: 3 }}
      >
        {label}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={fieldStyle({ fontSize: 13 })}
      />
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
  isAlphaSize,
  onRefresh,
  registerSave,
  onCupSizeToggle,
  navigate,
  highlightSizeId,
  highlightCupSizeId,
  highlightStockId,
}: {
  variantId: number;
  productId: number;
  isCupSize: boolean;
  isAlphaSize: boolean;
  onRefresh: () => void;
  registerSave: (id: number, fn: () => Promise<void>) => void;
  onCupSizeToggle?: (val: boolean) => void;
  navigate: (path: string) => void;
  highlightSizeId?: number | null;
  highlightCupSizeId?: number | null;
  highlightStockId?: string | null;
}) {
  // Resolve effective flag values before the query so they can drive the queryKey.
  // The prop carries the live (unsaved) checkbox state from the parent; the palette
  // API response carries the saved DB value. Prop takes priority.
  // isAlphaSize: false/null → numerical (default); true → alphabetical.
  const effectiveIsAlpha: boolean = isAlphaSize ?? false;
  const effectiveIsCup: boolean = isCupSize ?? false;

  // Single endpoint returns all MDM sizes + embedded PVD data.
  // Include effectiveIsAlpha/Cup in the queryKey so React Query refetches
  // immediately when the admin toggles the checkbox — before saving.
  const {
    data: paletteData,
    isLoading: paletteLoading,
    refetch: refetchPalette,
  } = useQuery({
    queryKey: [
      "admin-size-palette",
      variantId,
      effectiveIsAlpha,
      effectiveIsCup,
    ],
    queryFn: () =>
      api
        .get(`/ProductVariantDetail/AdminSizePalette/${variantId}`, {
          params: {
            isAlphaSize: effectiveIsAlpha,
            isCupSize: effectiveIsCup,
          },
        })
        .then((r) => r.data),
    enabled: !!variantId,
  });

  const allBandSizes: any[] = paletteData?.bandSizes ?? [];

  // Filter band sizes: show only the type matching the alpha toggle.
  // sizeType comes from mdm.Size — "alphabetical" | "numerical" | null.
  // When alpha is NOT set, always show numerical (never show alpha or null-type sizes).
  const allSizes: any[] = effectiveIsAlpha
    ? allBandSizes.filter((s: any) => s.sizeType === "alphabetical")
    : allBandSizes.filter((s: any) => s.sizeType === "numerical");

  // Rebuild grouped-by-type from the filtered set (keeps multi-type header logic intact).
  const bandSizesByType: Record<string, any[]> = {};
  for (const s of allSizes) {
    const k = s.sizeType || "other";
    if (!bandSizesByType[k]) bandSizesByType[k] = [];
    bandSizesByType[k].push(s);
  }
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

  // ── Highlight / deep-link auto-open ────────────────────────────────────────
  const highlightTileRef = useRef<HTMLDivElement | null>(null);
  const [highlightPulse, setHighlightPulse] = useState(false);

  // When palette data loads, auto-select the band size and open the right tile
  useEffect(() => {
    if (!paletteData || !highlightSizeId) return;

    if (paletteIsCup) {
      // Cup-size product: select the band, then open the cup tile
      setSelectedBandSizeId(highlightSizeId);
      if (highlightCupSizeId) {
        const key = `cup-${highlightSizeId}-${highlightCupSizeId}`;
        setOpenTile(key);
      }
    } else {
      // Regular product: open the band tile
      const key = `band-${highlightSizeId}`;
      setOpenTile(key);
    }

    // Pulse after a short delay to let the tile render
    const t = setTimeout(() => {
      setHighlightPulse(true);
      highlightTileRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // Remove pulse class after animation completes
      setTimeout(() => setHighlightPulse(false), 3000);
    }, 400);
    return () => clearTimeout(t);
    // Only run once when paletteData first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteData]);

  function initAddForm(sizeId: number | null, cupSizeId: number | null) {
    setAddForm({
      sizeId,
      cupSizeId,
      stockQuantity: 0,
      mrpPrice: 0,
      finalPrice: 0,
      // cgst/sgst auto-computed server-side from TaxHSNCode — not set here
    });
  }

  async function addSize() {
    setSaving(true);
    try {
      // NumInput commits values on blur, so addForm always has clean numbers.
      // Default finalPrice to mrpPrice if still 0.
      const mrp = addForm.mrpPrice ?? 0;
      const fp = addForm.finalPrice || mrp;
      const discountPercent =
        mrp > 0 ? Math.round(((mrp - fp) / mrp) * 100) : 0;
      await api.post("/ProductVariantDetail/", {
        ...addForm,
        finalPrice: fp,
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
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || "Failed to add size";
      toast.error(msg);
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

  // addNumField removed — replaced by <NumInput> standalone component above SizePalette
  // to prevent focus-loss on every keystroke (component was re-created on each addForm update).

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
          {/* Stock Qty */}
          <NumInput
            label="Stock Qty *"
            value={addForm.stockQuantity ?? 0}
            isPrice={false}
            onChange={(v) => setAddForm((f) => ({ ...f, stockQuantity: v }))}
          />
          {/* MRP — auto-fills Selling Price when Selling Price is untouched */}
          <NumInput
            label="MRP (₹) *"
            value={addForm.mrpPrice ?? 0}
            isPrice={true}
            onChange={(v) => setAddForm((f) => ({ ...f, mrpPrice: v }))}
            onMrpBlur={(v) =>
              setAddForm((f) => {
                // Only auto-fill if selling price is still 0 / untouched
                if (!f.finalPrice || f.finalPrice === 0) {
                  return { ...f, mrpPrice: v, finalPrice: v };
                }
                return { ...f, mrpPrice: v };
              })
            }
          />
          {/* Selling Price */}
          <NumInput
            label="Selling Price (₹) *"
            value={addForm.finalPrice ?? 0}
            isPrice={true}
            onChange={(v) => setAddForm((f) => ({ ...f, finalPrice: v }))}
          />
          {/* Stock ID */}
          <div style={{ gridColumn: "1/-1" }}>
            <TextInput
              label="Stock ID"
              value={addForm.stockId ?? ""}
              placeholder="e.g. STK-001"
              onChange={(v) => setAddForm((f) => ({ ...f, stockId: v }))}
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
        const isHighlightBand =
          !!highlightSizeId &&
          s.sizeId === highlightSizeId &&
          paletteIsCup &&
          !highlightCupSizeId;

        if (paletteIsCup) {
          // ── Cup-size mode: band tiles are SELECTORS — always clickable ──────
          return (
            <div
              key={s.sizeId}
              style={{ marginBottom: 4 }}
              ref={isHighlightBand ? highlightTileRef : undefined}
            >
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
        const isHighlightTile =
          !!highlightSizeId && s.sizeId === highlightSizeId && !paletteIsCup;

        return (
          <div
            key={s.sizeId}
            ref={isHighlightTile ? highlightTileRef : undefined}
            style={
              isHighlightTile && highlightPulse
                ? { animation: "pvd-highlight-pulse 1.4s ease 2" }
                : undefined
            }
          >
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
          {paletteIsCup && (
            <span style={{ fontSize: 11, color: P, fontWeight: 700 }}>
              ↓ Select a band size, then a cup size to set stock
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
              const isHighlightCup =
                !!highlightCupSizeId &&
                cs.cupSizeId === highlightCupSizeId &&
                selectedBandSizeId === highlightSizeId;

              return (
                <div
                  key={cs.cupSizeId}
                  ref={isHighlightCup ? highlightTileRef : undefined}
                  style={
                    isHighlightCup && highlightPulse
                      ? { animation: "pvd-highlight-pulse 1.4s ease 2" }
                      : undefined
                  }
                >
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
      {/* ── Stock-ID highlight banner ─────────────────────────────────────── */}
      {highlightStockId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            padding: "9px 14px",
            background: "#fff8e1",
            border: "1.5px solid #ffe082",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          <i
            className="bi bi-box-seam"
            style={{ color: "#e65100", fontSize: 16 }}
          />
          <span>
            Showing match for Stock ID{" "}
            <strong style={{ color: "#e65100", fontFamily: "monospace" }}>
              {highlightStockId}
            </strong>
          </span>
          {highlightPulse && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "#e65100",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#e65100",
                  animation: "pvd-dot-blink 0.8s ease infinite",
                  display: "inline-block",
                }}
              />
              Highlighted below
            </span>
          )}
        </div>
      )}

      {/* keyframes */}
      <style>{`
        @keyframes pvd-highlight-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(230,81,0,0.55); border-radius: 12px; }
          40%  { box-shadow: 0 0 0 10px rgba(230,81,0,0); border-radius: 12px; }
          100% { box-shadow: 0 0 0 0 rgba(230,81,0,0);   border-radius: 12px; }
        }
        @keyframes pvd-dot-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {paletteLoading && (
        <div style={{ fontSize: 12, color: SUB, padding: "10px 0" }}>
          Loading sizes…
        </div>
      )}
      {!paletteLoading && allSizes.length === 0 && (
        <div style={{ fontSize: 12, color: SUB, padding: "10px 0" }}>
          No band sizes found in MDM for the selected size type.
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

          {/* FIX (Req 3): Show CGST / SGST computed values for the selected size.
              These are stored in ProductVariantDetail.CGST/SGST at create/update time
              via _auto_compute_tax(). Previously they were only shown in the Add form. */}
          {(activePvd.cgst > 0 || activePvd.sgst > 0) && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px dashed ${BDR}`,
              }}
            >
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
                Tax (Auto from HSN Code)
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px 24px",
                }}
              >
                {activePvd.cgst > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>
                      CGST %
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1a1a2e",
                        background: "#f0f4ff",
                        borderRadius: 6,
                        padding: "3px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {activePvd.cgst}%
                      {activePvd.finalPrice > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: 400,
                          }}
                        >
                          (₹
                          {(
                            (activePvd.finalPrice * activePvd.cgst) /
                            100
                          ).toFixed(2)}
                          )
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {activePvd.sgst > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>
                      SGST %
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1a1a2e",
                        background: "#f0f4ff",
                        borderRadius: 6,
                        padding: "3px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {activePvd.sgst}%
                      {activePvd.finalPrice > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: 400,
                          }}
                        >
                          (₹
                          {(
                            (activePvd.finalPrice * activePvd.sgst) /
                            100
                          ).toFixed(2)}
                          )
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Variant modal ────────────────────────────────────────────────────────
function AddVariantModal({
  productId,
  colorFamilies,
  onClose,
  onAdded,
  isNew = false,
}: {
  productId: number;
  colorFamilies: ColorFamilyOption[];
  onClose: () => void;
  onAdded: (variantData?: Record<string, any>, newVariantId?: number) => void;
  isNew?: boolean;
}) {
  const [form, setForm] = useState({
    variantName: "",
    color: "",
    colorFamilyId: "",
    variantDescription: "",
    isBestSeller: false,
    isReturnAvailable: false,
    isCupSize: false,
    isAlphaSize: false,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.color.trim()) return toast.error("Color Name is required");
    if (!form.colorFamilyId) return toast.error("Color Family is required");
    // New product mode: stage variant locally, no API call yet
    if (isNew) {
      onAdded({ ...form });
      toast.success("Variant staged — it will be saved when you click Save");
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/ProductVariants", {
        ...form,
        colorFamilyId: form.colorFamilyId ? Number(form.colorFamilyId) : null,
        productId,
      });
      toast.success("Variant created");
      const newVariantId: number | undefined =
        res?.data?.productVariantId ?? res?.data?.id ?? undefined;
      onAdded(undefined, newVariantId);
      onClose();
    } catch {
      toast.error("Failed to create variant");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = form.color.trim() !== "" && form.colorFamilyId !== "";

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

        {/* Required: Color Name + Color Family */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px 20px",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: SUB,
                fontWeight: 700,
                marginBottom: 4,
                textTransform: "uppercase" as const,
              }}
            >
              Color Name <span style={{ color: "#c0392b" }}>*</span>
            </div>
            <input
              value={form.color}
              placeholder="e.g. Midnight Black"
              onChange={(e) =>
                setForm((f) => ({ ...f, color: e.target.value }))
              }
              style={fieldStyle({
                fontSize: 13,
                borderColor: !form.color.trim() ? "#e0c0c0" : undefined,
              })}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: SUB,
                fontWeight: 700,
                marginBottom: 4,
                textTransform: "uppercase" as const,
              }}
            >
              Color Family <span style={{ color: "#c0392b" }}>*</span>
            </div>
            <select
              value={form.colorFamilyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, colorFamilyId: e.target.value }))
              }
              style={{
                ...fieldStyle({
                  cursor: "pointer",
                  borderColor: !form.colorFamilyId ? "#e0c0c0" : undefined,
                }),
                appearance: "auto" as const,
              }}
            >
              <option value="">— Select family —</option>
              {colorFamilies.map((cf) => (
                <option key={cf.id} value={cf.id}>
                  {cf.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional: Variant Name */}
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
            Variant Name
          </div>
          <input
            value={form.variantName}
            onChange={(e) =>
              setForm((f) => ({ ...f, variantName: e.target.value }))
            }
            style={fieldStyle({ fontSize: 13 })}
          />
        </div>

        {/* Optional: Description */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase" as const,
            }}
          >
            Description
          </div>
          <input
            value={form.variantDescription}
            onChange={(e) =>
              setForm((f) => ({ ...f, variantDescription: e.target.value }))
            }
            style={fieldStyle({ fontSize: 13 })}
          />
        </div>

        {/* Toggles */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap" as const,
            gap: "10px 20px",
            marginBottom: 24,
          }}
        >
          {(
            [
              ["isBestSeller", "Best Seller"],
              ["isReturnAvailable", "Return Available"],
              ["isCupSize", "Cup Size"],
              ["isAlphaSize", "Alpha Size"],
            ] as [keyof typeof form, string][]
          ).map(([k, l]) => (
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
                checked={form[k] as boolean}
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
            disabled={saving || !canSubmit}
            style={{
              flex: 1,
              padding: "10px 0",
              background: saving || !canSubmit ? "#c8a0a8" : P,
              color: WHITE,
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              cursor: saving || !canSubmit ? "not-allowed" : "pointer",
              fontWeight: 700,
              transition: "background 0.2s",
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

// ─── Inline size pre-fill form (for new product before saving) ───────────────
function NewSizeTileForm({
  sizeKey,
  sizes,
  onUpdate,
  onClose,
}: {
  sizeKey: string;
  sizes: Record<
    string,
    {
      mrpPrice: string;
      finalPrice: string;
      stockQuantity: string;
      stockId: string;
    }
  >;
  onUpdate: (key: string, field: string, value: string) => void;
  onClose: () => void;
}) {
  const val = sizes[sizeKey] ?? {
    mrpPrice: "",
    finalPrice: "",
    stockQuantity: "",
    stockId: "",
  };
  const mrp = Number(val.mrpPrice || 0);
  const fin = Number(val.finalPrice || 0);
  const disc =
    mrp > 0 && fin > 0 && fin <= mrp
      ? Math.round(((mrp - fin) / mrp) * 100)
      : 0;

  const fld: React.CSSProperties = {
    border: "none",
    borderBottom: `1.5px solid ${BDR}`,
    padding: "6px 0",
    fontSize: 13,
    color: TXT,
    background: "transparent",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        background: "#f9f9fb",
        border: `1.5px solid ${P}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px 16px",
      }}
    >
      <div>
        <label style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>
          MRP (₹) *
        </label>
        <input
          type="number"
          min={0}
          style={fld}
          placeholder="0"
          value={val.mrpPrice}
          onChange={(e) => onUpdate(sizeKey, "mrpPrice", e.target.value)}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>
          Selling Price (₹) *
        </label>
        <input
          type="number"
          min={0}
          style={fld}
          placeholder="0"
          value={val.finalPrice}
          onChange={(e) => onUpdate(sizeKey, "finalPrice", e.target.value)}
        />
        {disc > 0 && (
          <span style={{ fontSize: 10, color: "#2e7d32", fontWeight: 600 }}>
            {disc}% off
          </span>
        )}
        {mrp > 0 && fin > mrp && (
          <span style={{ fontSize: 10, color: P, fontWeight: 600 }}>
            Cannot exceed MRP
          </span>
        )}
      </div>
      <div>
        <label style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>
          Stock Qty *
        </label>
        <input
          type="number"
          min={0}
          style={fld}
          placeholder="0"
          value={val.stockQuantity}
          onChange={(e) => onUpdate(sizeKey, "stockQuantity", e.target.value)}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>
          Stock ID
        </label>
        <input
          type="text"
          style={fld}
          placeholder="Optional"
          value={val.stockId}
          onChange={(e) => onUpdate(sizeKey, "stockId", e.target.value)}
        />
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "5px 14px",
            fontSize: 12,
            borderRadius: 8,
            border: `1.5px solid ${BDR}`,
            background: "transparent",
            color: SUB,
            cursor: "pointer",
          }}
        >
          Done
        </button>
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

  // ── Stock-ID deep-link highlight state (from AdminProducts stockId search) ──
  const hlVariantId: number | null = location.state?.highlightVariantId ?? null;
  const hlSizeId: number | null = location.state?.highlightSizeId ?? null;
  const hlCupSizeId: number | null = location.state?.highlightCupSizeId ?? null;
  const hlStockId: string | null = location.state?.highlightStockId ?? null;
  // After a new product is first saved, auto-scroll to the Sizes & Stock section
  const autoOpenSizes: boolean = location.state?.autoOpenSizes ?? false;
  const sizesRef = useRef<HTMLDivElement | null>(null);

  const [selVariantId, setSelVariantId] = useState<number | null>(
    hlVariantId ?? null, // pre-seed from deep-link if present
  );
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
  const { data: colorFamiliesData } = useQuery({
    queryKey: ["mdm-product-colors"],
    queryFn: () =>
      api
        .get("/MDM/ProductColor", { params: { "Page.Size": 200 } })
        .then((r) => r.data),
    staleTime: 300_000,
  });
  // MDM sizes (band) + cup sizes — used for pre-fill tiles on new product
  const { data: mdmSizesData } = useQuery({
    queryKey: ["mdm-sizes-all"],
    queryFn: () =>
      api.get("/Size", { params: { "Page.Size": 200 } }).then((r) => r.data),
    staleTime: 300_000,
  });
  const { data: mdmCupSizesData } = useQuery({
    queryKey: ["mdm-cupsizes-all"],
    queryFn: () =>
      api.get("/CupSize", { params: { "Page.Size": 200 } }).then((r) => r.data),
    staleTime: 300_000,
  });
  const allMdmSizes: any[] = mdmSizesData?.list ?? [];
  const allMdmCupSizes: any[] = mdmCupSizesData?.list ?? [];

  const allCats: any[] = catsData?.list ?? [];
  const allBrands: any[] = brandsData?.list ?? [];
  const allTaxHsn: any[] = taxHsnData?.list ?? [];
  const allFabrics: any[] = fabricsData?.list ?? [];
  const allColorFamilies: ColorFamilyOption[] = useMemo(() => {
    const raw: any[] = colorFamiliesData?.list ?? colorFamiliesData ?? [];
    return raw
      .map((c: any) => normalizeColorFamily(c))
      .filter((c): c is ColorFamilyOption => Boolean(c));
  }, [colorFamiliesData]);
  const parentCats = allCats.filter(
    (c) => !c.parentCategoryId || c.parentCategoryId === 0,
  );
  const childCats = (pid: number) =>
    allCats.filter((c) => Number(c.parentCategoryId) === Number(pid));

  // Derive effectiveProduct early so it can be used throughout the component
  const effectiveProduct = isNew ? ({} as any) : product ?? ({} as any);

  const productVariants = Array.isArray(effectiveProduct?.allVariants)
    ? effectiveProduct.allVariants.filter((v: any) => v.deletedInd !== true)
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

  // Auto-select first variant — but preserve a deep-link pre-seeded value
  useEffect(() => {
    if (!selVariantId && variants.length > 0) {
      // prefer the highlight variant if it exists in the list, else first
      const target = hlVariantId
        ? variants.find((v) => v.productVariantId === hlVariantId)
        : null;
      setSelVariantId(
        target ? target.productVariantId : variants[0].productVariantId,
      );
    }
  }, [variants, selVariantId, hlVariantId]);

  // Clear registered savers whenever the selected variant changes
  useEffect(() => {
    sizeRowSavers.current.clear();
    setPendingVariant({});
  }, [selVariantId]);

  // After a new-product save navigates here with autoOpenSizes=true,
  // wait for the variant to be selected then scroll straight to Sizes & Stock.
  useEffect(() => {
    if (!autoOpenSizes || !selVariantId || !sizesRef.current) return;
    const t = setTimeout(() => {
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600);
    return () => clearTimeout(t);
  }, [autoOpenSizes, selVariantId]);

  const selVariant = variants.find((v) => v.productVariantId === selVariantId);

  // Images for selected variant (fresh from API)
  const { data: imagesData, refetch: refetchImages } = useQuery({
    queryKey: ["admin-variant-images", selVariantId],
    queryFn: () =>
      api.get(`/ProductVariants/${selVariantId}/images`).then((r) => r.data),
    enabled: !!selVariantId,
  });

  // userVariantDetail query removed — images come solely from the /images endpoint.
  // WARNING: Do NOT reference userVariantDetail here — it was never declared and
  // causes "ReferenceError: userVariantDetail is not defined" which crashes the page.

  // Images come solely from the per-variant API response.
  // Do NOT merge selVariant.images / thumbnail fields — those are product-level
  // or stale data that causes every variant to show the same image pool.
  const variantImages: any[] = useMemo(
    () =>
      mergeImageSources(
        Array.isArray(imagesData) ? imagesData : imagesData?.list ?? [],
      ),
    [imagesData],
  );

  // Reset image index when variant switches
  useEffect(() => {
    setActiveImgIdx(0);
  }, [selVariantId]);

  useEffect(() => {
    setActiveImgIdx((prev) =>
      prev >= variantImages.length
        ? Math.max(0, variantImages.length - 1)
        : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantImages.length]);

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
  // NOTE: Send ONLY the changed delta — do NOT spread the full `product` object.
  // The product from the API includes allVariants (with base64 image data), brandName,
  // categoryName, etc. Spreading it creates a massive payload that can exceed request
  // size limits and causes all saves to fail. The backend's `if val is not None` logic
  // is designed for partial updates, so sending only changed fields is correct.
  async function patchProduct(data: Record<string, any>) {
    try {
      await api.put(`/Products/${productId}`, data);
      updatedToast();
      refetchProduct();
      refetchPvd();
      // Invalidate the size palette cache for ALL variants of this product so
      // CGST/SGST values (recalculated server-side after HSN change) are shown
      // immediately without a manual page refresh.
      qc.invalidateQueries({ queryKey: ["admin-size-palette"] });
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    } catch {
      toast.error("Save failed");
    }
  }

  // ── Patch variant ────────────────────────────────────────────────────────────
  async function patchVariant(data: Record<string, any>) {
    if (!selVariantId) return;
    try {
      // Strip heavy / read-only fields that should not be sent back to the API
      const {
        images: _i,
        allSizes: _as,
        pvds: _pvds,
        ...safeVariant
      } = selVariant ?? {};
      await api.put(`/ProductVariants/${selVariantId}`, {
        ...safeVariant,
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
    // NEW PRODUCT: create product + variant in DB on first save
    if (isNew) {
      setSavingAll(true);
      try {
        const { name: adminName } = getCurrentUser();
        // 1. Create the product with all filled-in fields
        const productRes = await api.post("/Products/", {
          ...pendingProduct,
          state: "Draft",
          createdBy: adminName,
        });
        const newProductId: number = productRes.data?.productId;
        if (!newProductId) throw new Error("No productId returned");
        // 2. Create the variant if one was staged — capture the new variantId
        let newVariantId: number | undefined;
        if (pendingNewVariant) {
          const variantRes = await api.post("/ProductVariants", {
            ...pendingNewVariant,
            colorFamilyId: pendingNewVariant.colorFamilyId
              ? Number(pendingNewVariant.colorFamilyId)
              : null,
            productId: newProductId,
          });
          newVariantId =
            variantRes.data?.productVariantId ?? variantRes.data?.id;
        }
        // 3. (Sizes are added on the real product page after redirect)
        toast.success("Product & variant saved! Now add sizes & stock below.");
        qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
        // Navigate to the real product page; pass the new variantId so it
        // auto-selects the variant and scrolls to the Sizes & Stock section.
        navigate(`/admin/products/${newProductId}`, {
          replace: true,
          state: {
            ...(location.state ?? {}),
            highlightVariantId: newVariantId ?? null,
            autoOpenSizes: true,
          },
        });
      } catch {
        toast.error("Failed to save product \u2014 please try again");
      } finally {
        setSavingAll(false);
      }
      return;
    }
    // EXISTING PRODUCT: patch changed fields
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

  // ── New product mode ─────────────────────────────────────────────────────
  // The page renders normally with all fields empty. The admin fills in all
  // required product-level fields, then adds a variant (stored in local state),
  // then adds at least one size. Only when Save is clicked does the product
  // get POSTed to the DB (POST /Products → POST /ProductVariants).
  const [pendingNewVariant, setPendingNewVariant] = useState<Record<
    string,
    any
  > | null>(null);
  // Pre-filled size data for new product before saving
  // key = `${sizeId}` or `${sizeId}-${cupSizeId}`, value = { mrpPrice, finalPrice, stockQuantity, stockId }
  const [pendingNewVariantSizes, setPendingNewVariantSizes] = useState<
    Record<
      string,
      {
        mrpPrice: string;
        finalPrice: string;
        stockQuantity: string;
        stockId: string;
      }
    >
  >({});
  const updatePendingSize = (key: string, field: string, value: string) => {
    setPendingNewVariantSizes((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {
          mrpPrice: "",
          finalPrice: "",
          stockQuantity: "",
          stockId: "",
        }),
        [field]: value,
      },
    }));
  };
  // Which size tile is expanded in the new-product size pre-fill UI
  const [newProductExpandedSize, setNewProductExpandedSize] = useState<
    string | null
  >(null);

  if (!isNew && pLoading)
    return (
      <div style={{ padding: 60, textAlign: "center", color: SUB }}>
        <i
          className="bi bi-hourglass-split"
          style={{ fontSize: 36, display: "block", marginBottom: 12 }}
        />
        Loading product…
      </div>
    );
  if (!isNew && !product)
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
  const sc = stateColors[effectiveProduct.state] ?? { bg: GRY, color: SUB };

  const isHidden = selVariant?.isActive === false;

  // \u2500\u2500 Mandatory product-level fields (must be set before Add Variant unlocks) \u2500\u2500
  const effectiveName = pendingProduct.name ?? effectiveProduct.name;
  const effectiveBrandId = pendingProduct.brandId ?? effectiveProduct.brandId;
  const effectiveHsnId =
    pendingProduct.taxHSNCodeId ?? effectiveProduct.taxHSNCodeId;
  const effectiveFabricId =
    pendingProduct.fabricId ?? effectiveProduct.fabricId;
  const effectiveCatId =
    pendingProduct.categoryId ?? effectiveProduct.categoryId;
  const effectiveChildId =
    "childCategoryId" in pendingProduct
      ? pendingProduct.childCategoryId
      : effectiveProduct.childCategoryId;

  const effectiveDescription =
    pendingProduct.description ?? effectiveProduct.description;
  const effectiveTag = pendingProduct.tag ?? effectiveProduct.tag;

  const missingProductFields: string[] = [];
  if (!effectiveName?.trim()) missingProductFields.push("Product Name");
  if (!effectiveBrandId) missingProductFields.push("Brand");
  if (!effectiveHsnId) missingProductFields.push("Tax / HSN Code");
  if (!effectiveFabricId) missingProductFields.push("Fabric");
  if (!effectiveCatId) missingProductFields.push("Parent Category");
  if (!effectiveChildId) missingProductFields.push("Child Category");
  if (!effectiveDescription?.trim()) missingProductFields.push("Description");

  const productFieldsComplete = missingProductFields.length === 0;
  const hasVariant = isNew ? !!pendingNewVariant : variants.length > 0;
  const hasSizes = isNew
    ? true // sizes are added after the product+variant is saved and redirected
    : pvds.length > 0;
  // For new products: only need product fields + variant to save (sizes added after)
  // For existing products: product fields + variant + at least one size required
  const canSave = isNew
    ? productFieldsComplete && hasVariant
    : productFieldsComplete && hasVariant && hasSizes;

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
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: pendingProduct.name ?? effectiveProduct.name ? TXT : SUB,
            }}
          >
            {(pendingProduct.name ?? effectiveProduct.name) || (
              <span
                style={{ fontStyle: "italic", fontWeight: 400, fontSize: 15 }}
              >
                Not set
              </span>
            )}
          </h2>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              marginTop: 1,
              fontFamily: "'Courier New',monospace",
            }}
          >
            #
            {pendingProduct.productCode ??
              effectiveProduct.productCode ??
              "NEW"}
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
          {isNew ? "New" : effectiveProduct.state || "Draft"}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background:
              !isNew && effectiveProduct.isActive !== false
                ? "#e8f5e9"
                : "#fdecea",
            color:
              !isNew && effectiveProduct.isActive !== false
                ? "#2e7d32"
                : "#c62828",
          }}
        >
          {!isNew
            ? effectiveProduct.isActive !== false
              ? "Active"
              : "Inactive"
            : "Draft"}
        </span>
        <button
          onClick={() =>
            api
              .patch(`/Products/${productId}/toggle-active`)
              .then(() => {
                toast.success(
                  effectiveProduct.isActive !== false
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
            background:
              effectiveProduct.isActive !== false ? "#fff8e1" : "#e8f5e9",
            color: effectiveProduct.isActive !== false ? "#e65100" : "#2e7d32",
            border: `1.5px solid ${
              effectiveProduct.isActive !== false ? "#ffe082" : "#c8e6c9"
            }`,
            borderRadius: 20,
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {effectiveProduct.isActive !== false
            ? "Hide Product"
            : "Show Product"}
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
                qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
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
                gap: 10,
                color: "#c0b0aa",
                padding: 24,
                textAlign: "center",
              }}
            >
              <i className="bi bi-palette" style={{ fontSize: 44 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#a08880" }}>
                No variants yet
              </span>
              <span style={{ fontSize: 12, color: "#c0b0aa", lineHeight: 1.5 }}>
                Use <strong style={{ color: "#a08880" }}>+ Add Variant</strong>{" "}
                on the right to create your first colour variant, then upload
                images here.
              </span>
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
            required
            value={pendingProduct.brandId ?? effectiveProduct.brandId}
            options={allBrands.map((b) => ({
              id: b.brandId,
              name: b.brandName,
            }))}
            onSave={(v) => queueProduct({ brandId: v })}
          />

          {/* Product Name */}
          <div style={{ marginBottom: 6 }}>
            <InlineField
              label="Product Name"
              required
              value={pendingProduct.name ?? effectiveProduct.name ?? ""}
              placeholder="Not set"
              onSave={(v) => queueProduct({ name: v })}
              large
            />
          </div>

          {/* Product Code */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 12, color: SUB }}>Product Code:</span>
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
                value={
                  pendingProduct.productCode ??
                  effectiveProduct.productCode ??
                  ""
                }
                placeholder="Product Code…"
                onSave={(v) => queueProduct({ productCode: v })}
              />
            </span>
          </div>

          {/* Tax HSN Code + Fabric — both product level, side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 16px",
            }}
          >
            <InlineSelect
              label="Tax / HSN Code"
              required
              value={
                pendingProduct.taxHSNCodeId ?? effectiveProduct.taxHSNCodeId
              }
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
            <InlineSelect
              label="Fabric"
              required
              value={pendingProduct.fabricId ?? effectiveProduct.fabricId}
              options={allFabrics.map((f) => ({
                id: f.fabricId,
                name: f.name || f.fabricCode || String(f.fabricId),
              }))}
              onSave={(v) => queueProduct({ fabricId: v })}
            />
          </div>

          {/* Recalculate Taxes button — fixes existing PVDs with missing CGST/SGST */}
          {(pendingProduct.taxHSNCodeId ?? effectiveProduct.taxHSNCodeId) && (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={async () => {
                  try {
                    const res = await api.post(
                      `/Products/${productId}/recalculate-taxes`,
                    );
                    const { updated = 0, skipped = 0 } = res.data ?? {};
                    toast.success(
                      `Taxes recalculated — ${updated} size(s) updated${
                        skipped ? `, ${skipped} skipped (no price)` : ""
                      }`,
                    );
                    refetchPvd();
                    qc.invalidateQueries({ queryKey: ["admin-size-palette"] });
                  } catch {
                    toast.error("Recalculate failed — check HSN code setup");
                  }
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#1d4ed8",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 6,
                  padding: "4px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                ⟳ Recalculate CGST / SGST for all sizes
              </button>
            </div>
          )}

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
            required
            value={
              pendingProduct.description ?? effectiveProduct.description ?? ""
            }
            multiline
            placeholder="Add a description…"
            onSave={(v) => queueProduct({ description: v })}
          />

          {/* Tags */}
          <InlineField
            label="Tags"
            value={pendingProduct.tag ?? effectiveProduct.tag ?? ""}
            placeholder="Add tags…"
            onSave={(v) => queueProduct({ tag: v })}
          />

          <div style={{ height: 1, background: BDR, margin: "20px 0" }} />

          {/* ── Category selectors ───────────────────────────────────────── */}
          {/* BUG FIX: Use the effective (pending OR server) categoryId so that
              when the user changes the parent category the child dropdown
              immediately re-filters to show only that parent's children,
              even before the save round-trip. */}
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
              required
              value={pendingProduct.categoryId ?? effectiveProduct.categoryId}
              options={parentCats.map((c) => ({
                id: c.categoryId,
                name: c.name,
              }))}
              onSave={(v) =>
                queueProduct({ categoryId: v, childCategoryId: null })
              }
            />
            {(() => {
              // Effective parent: prefer the locally-queued value so child options
              // update instantly when parent changes (before save+refetch).
              const effectiveCatId =
                (pendingProduct.categoryId ?? effectiveProduct.categoryId) || 0;
              // Effective child: prefer locally-queued value; null means cleared.
              const effectiveChildId =
                "childCategoryId" in pendingProduct
                  ? pendingProduct.childCategoryId
                  : effectiveProduct.childCategoryId;
              return (
                <InlineSelect
                  label="Child Category"
                  required
                  value={effectiveChildId}
                  options={childCats(effectiveCatId).map((c) => ({
                    id: c.categoryId,
                    name: c.name,
                  }))}
                  onSave={(v) => queueProduct({ childCategoryId: v })}
                />
              );
            })()}
          </div>

          {/* ── VARIANT section label ────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "22px 0 16px",
            }}
          >
            <div style={{ flex: 1, height: 1, background: BDR }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Variant
            </span>
            <div style={{ flex: 1, height: 1, background: BDR }} />
          </div>

          {/* ── Variant swatches (like user-side colour picker) ────────────── */}
          <div style={{ marginBottom: 20 }}>
            {/* Header row — always visible so Add Variant is always accessible */}
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
                {variants.length > 0
                  ? `Variants (${variants.length})`
                  : "Variants"}
              </div>
              {hlStockId && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#e65100",
                    background: "#fff8e1",
                    border: "1px solid #ffe082",
                    borderRadius: 10,
                    padding: "2px 9px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <i className="bi bi-box-seam" />
                  Stock ID match
                </span>
              )}
              <button
                onClick={() => {
                  if (!productFieldsComplete) {
                    toast.error(
                      `Fill in required fields first: ${missingProductFields.join(
                        ", ",
                      )}`,
                      { duration: 4000 },
                    );
                    return;
                  }
                  setAddVariantOpen(true);
                }}
                disabled={!productFieldsComplete}
                title={
                  productFieldsComplete
                    ? "Add a colour variant"
                    : `Complete required fields first: ${missingProductFields.join(
                        ", ",
                      )}`
                }
                style={{
                  padding: "6px 12px",
                  background: productFieldsComplete ? P : "#d1c4c7",
                  color: WHITE,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: productFieldsComplete ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  opacity: productFieldsComplete ? 1 : 0.65,
                }}
              >
                <i className="bi bi-plus-lg" /> Add Variant
              </button>
            </div>
            {/* Show staged (unsaved) variant in new product mode */}
            {isNew && pendingNewVariant && (
              <div style={{ padding: "8px 0 4px" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: SUB,
                    fontWeight: 700,
                    marginBottom: 8,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Variant
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#e65100",
                      background: "#fff8e1",
                      border: "1px solid #ffe082",
                      borderRadius: 10,
                      padding: "1px 8px",
                      textTransform: "none" as const,
                      letterSpacing: 0,
                    }}
                  >
                    Not saved yet
                  </span>
                </div>

                {/* Variant swatch tile */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 78,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: `2.5px solid ${P}`,
                      background: GRY,
                      position: "relative",
                      cursor: "default",
                    }}
                    title={
                      pendingNewVariant.variantName ||
                      pendingNewVariant.color ||
                      "Variant"
                    }
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background:
                          colorFamilyHexOf(pendingNewVariant) || "#ccc",
                      }}
                    />
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
                  </div>
                </div>

                {/* Variant info row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#e8f5e9",
                    border: "1px solid #c8e6c9",
                    borderRadius: 8,
                    padding: "8px 14px",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      background: colorFamilyHexOf(pendingNewVariant) || "#ccc",
                      border: "1px solid #ddd",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1b5e20",
                      }}
                    >
                      {pendingNewVariant.variantName ||
                        pendingNewVariant.color ||
                        "Variant"}
                    </div>
                    {pendingNewVariant.color && (
                      <div style={{ fontSize: 11, color: "#2e7d32" }}>
                        Color: {pendingNewVariant.color}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setPendingNewVariant(null)}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      padding: "3px 10px",
                      background: "#fdecea",
                      color: "#c62828",
                      border: "1px solid #ef9a9a",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>

                {/* Save button */}
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => {
                      if (!canSave) {
                        if (!productFieldsComplete) {
                          toast.error(
                            `Fill in required fields: ${missingProductFields.join(
                              ", ",
                            )}`,
                            { duration: 4000 },
                          );
                        } else if (!hasVariant) {
                          toast.error("Add at least one colour variant.", {
                            duration: 4000,
                          });
                        }
                        return;
                      }
                      saveAll();
                    }}
                    disabled={savingAll}
                    style={{
                      padding: "11px 28px",
                      fontSize: 14,
                      fontWeight: 700,
                      borderRadius: 10,
                      cursor: savingAll || !canSave ? "not-allowed" : "pointer",
                      border: "none",
                      background: canSave ? P : "#d1c4c7",
                      color: WHITE,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: savingAll ? 0.7 : 1,
                    }}
                  >
                    <i className="bi bi-floppy" />
                    {savingAll ? "Saving…" : "Save Product"}
                  </button>
                  {!canSave && !savingAll && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#b45309",
                        fontWeight: 600,
                        lineHeight: 1.4,
                      }}
                    >
                      {!productFieldsComplete
                        ? `Missing: ${missingProductFields.join(", ")}`
                        : "No variant added yet"}
                    </div>
                  )}
                </div>
              </div>
            )}
            {!isNew && variants.length === 0 && (
              <div style={{ padding: "8px 0 4px" }}>
                {!productFieldsComplete ? (
                  <div
                    style={{
                      background: "#fff8e1",
                      border: "1px solid #ffe082",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#7c4d00",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <i
                        className="bi bi-exclamation-triangle-fill"
                        style={{ color: "#f59e0b" }}
                      />
                      Complete these required fields before adding a variant:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                      {missingProductFields.map((f) => (
                        <li key={f} style={{ fontWeight: 600 }}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#2e7d32",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <i className="bi bi-check-circle-fill" /> All required
                    fields set — click <strong>+ Add Variant</strong> to
                    continue.
                  </div>
                )}
              </div>
            )}
            {variants.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {variants.map((v) => {
                  const isSel = v.productVariantId === selVariantId;
                  const isHlVariant =
                    !!hlVariantId && v.productVariantId === hlVariantId;
                  const hex = getVariantColor(v);
                  const firstImg =
                    Array.isArray(v.images) && v.images.length > 0
                      ? v.images[0]
                      : null;
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
                        border: isSel
                          ? `2.5px solid ${P}`
                          : isHlVariant
                          ? `2.5px solid #e65100`
                          : `2.5px solid transparent`,
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                        background: GRY,
                        position: "relative",
                        opacity: v.isActive === false ? 0.45 : 1,
                        boxShadow:
                          isHlVariant && !isSel
                            ? "0 0 0 3px #fff3e0"
                            : undefined,
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
            )}
          </div>

          {/* ── Variant Name + Description — editable, shown when a variant is selected ── */}
          {selVariant && (
            <div style={{ marginBottom: 4 }}>
              <InlineField
                label="Variant Name"
                value={
                  pendingVariant.variantName !== undefined
                    ? pendingVariant.variantName
                    : selVariant.variantName || ""
                }
                placeholder="e.g. Dark Navy…"
                onSave={(v) => queueVariant({ variantName: v })}
              />
              <InlineField
                label="Variant Description"
                value={
                  pendingVariant.variantDescription !== undefined
                    ? pendingVariant.variantDescription
                    : selVariant.variantDescription || ""
                }
                placeholder="Short description for this colour / variant…"
                multiline
                onSave={(v) => queueVariant({ variantDescription: v })}
              />
            </div>
          )}

          {/* ── Color Name / Color Family — 2-col (Fabric moved to product level) ── */}
          {selVariant && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 16px",
                marginBottom: 4,
              }}
            >
              <InlineField
                label="Color Name"
                value={selVariant.color || ""}
                placeholder="e.g. Dark Navy Blue…"
                onSave={(v) => queueVariant({ color: v })}
              />
              <InlineColorFamilySelect
                label="Color Family"
                valueId={
                  pendingVariant.colorFamilyId !== undefined
                    ? pendingVariant.colorFamilyId
                    : selVariant.colorFamilyId ?? null
                }
                valueName={colorFamilyNameOf(selVariant)}
                options={allColorFamilies}
                onSave={(v) => queueVariant({ colorFamilyId: v })}
              />
            </div>
          )}

          {/* ── Best Seller / Returns / Cup Size — variant-level toggles ── */}
          {selVariant && (
            <div
              style={{
                display: "flex",
                gap: 20,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
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

              {/* Cup Size — plain checkbox, same as Best Seller / Returns */}
              <label
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
                  checked={
                    pendingVariant.isCupSize !== undefined
                      ? !!pendingVariant.isCupSize
                      : !!selVariant.isCupSize
                  }
                  style={{ accentColor: P, width: 14, height: 14 }}
                  onChange={(e) =>
                    queueVariant({ isCupSize: e.target.checked })
                  }
                />
                Cup Size
              </label>

              {/* Alpha Size — hides numerical sizes when ticked */}
              <label
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
                  checked={
                    pendingVariant.isAlphaSize !== undefined
                      ? !!pendingVariant.isAlphaSize
                      : !!selVariant.isAlphaSize
                  }
                  style={{ accentColor: P, width: 14, height: 14 }}
                  onChange={(e) =>
                    queueVariant({ isAlphaSize: e.target.checked })
                  }
                />
                Alpha Size
              </label>
            </div>
          )}

          {/* ── Variant Detail divider ───────────────────────────────────── */}
          {selVariant && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "22px 0 16px",
              }}
            >
              <div style={{ flex: 1, height: 1, background: BDR }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Variant Detail
              </span>
              <div style={{ flex: 1, height: 1, background: BDR }} />
            </div>
          )}

          {/* ── Sizes section ────────────────────────────────────────────── */}
          {selVariant && (
            <div ref={sizesRef} style={{ marginBottom: 20 }}>
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
                isCupSize={
                  pendingVariant.isCupSize !== undefined
                    ? !!pendingVariant.isCupSize
                    : !!selVariant.isCupSize
                }
                onRefresh={refetchPvd}
                registerSave={(id, fn) => sizeRowSavers.current.set(id, fn)}
                isAlphaSize={
                  pendingVariant.isAlphaSize !== undefined
                    ? !!pendingVariant.isAlphaSize
                    : !!selVariant.isAlphaSize
                }
                onCupSizeToggle={(val) => queueVariant({ isCupSize: val })}
                navigate={navigate}
                highlightSizeId={selVariantId === hlVariantId ? hlSizeId : null}
                highlightCupSizeId={
                  selVariantId === hlVariantId ? hlCupSizeId : null
                }
                highlightStockId={
                  selVariantId === hlVariantId ? hlStockId : null
                }
              />

              {/* ── Action buttons: Save · Discard · Hide/Show · History ── */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 18,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {/* Save */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <button
                    onClick={() => {
                      if (!canSave) {
                        if (!productFieldsComplete) {
                          toast.error(
                            `Fill in required fields: ${missingProductFields.join(
                              ", ",
                            )}`,
                            { duration: 4000 },
                          );
                        } else if (!hasVariant) {
                          toast.error(
                            "Add at least one colour variant before saving.",
                            { duration: 4000 },
                          );
                        } else if (!hasSizes) {
                          toast.error(
                            "Add at least one size to the variant before saving.",
                            { duration: 4000 },
                          );
                        }
                        return;
                      }
                      saveAll();
                    }}
                    disabled={savingAll}
                    title={
                      !productFieldsComplete
                        ? `Fill in required fields: ${missingProductFields.join(
                            ", ",
                          )}`
                        : !hasVariant
                        ? "Add at least one colour variant before saving"
                        : !hasSizes && !isNew
                        ? "Add at least one size before saving"
                        : "Save all changes"
                    }
                    style={{
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 10,
                      cursor: savingAll || !canSave ? "not-allowed" : "pointer",
                      border: "none",
                      background: canSave ? P : "#d1c4c7",
                      color: WHITE,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: savingAll ? 0.7 : 1,
                    }}
                  >
                    <i className="bi bi-floppy" />
                    {savingAll ? "Saving…" : "Save"}
                  </button>
                  {!canSave && !savingAll && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#b45309",
                        fontWeight: 600,
                        maxWidth: 180,
                        lineHeight: 1.4,
                      }}
                    >
                      {!productFieldsComplete
                        ? `Missing: ${missingProductFields.join(", ")}`
                        : !hasVariant
                        ? "No variant added yet"
                        : !isNew
                        ? "No sizes added yet"
                        : ""}
                    </div>
                  )}
                </div>

                {/* Discard — always visible; enabled only when isDirty */}
                <button
                  onClick={() => {
                    if (!isDirty) return;
                    setPendingProduct({});
                    setPendingVariant({});
                  }}
                  disabled={!isDirty}
                  style={{
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 10,
                    cursor: isDirty ? "pointer" : "not-allowed",
                    border: `1.5px solid ${isDirty ? BDR : "#e5e7eb"}`,
                    background: "transparent",
                    color: isDirty ? SUB : "#d1d5db",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                  title={
                    isDirty ? "Discard unsaved changes" : "No unsaved changes"
                  }
                >
                  <i className="bi bi-x-circle" />
                  Discard
                </button>

                {/* Spacer pushes Hide + History to the right */}
                <div style={{ flex: 1 }} />

                {/* Hide / Show Variant */}
                <button
                  onClick={toggleVariantActive}
                  style={{
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: "none",
                    background: isHidden ? "#e8f5e9" : PLT,
                    color: isHidden ? "#2e7d32" : P,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className={`bi ${isHidden ? "bi-eye" : "bi-eye-slash"}`} />
                  {isHidden ? "Show Variant" : "Hide Variant"}
                </button>

                {/* History */}
                <button
                  onClick={() =>
                    navigate(`/admin/stock?productId=${productId}`)
                  }
                  style={{
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1.5px solid ${P}`,
                    background: "transparent",
                    color: P,
                    display: "flex",
                    alignItems: "center",
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
          productId={isNew ? 0 : productId}
          colorFamilies={allColorFamilies}
          onClose={() => setAddVariantOpen(false)}
          onAdded={(
            variantData?: Record<string, any>,
            newVariantId?: number,
          ) => {
            if (isNew && variantData) {
              // Stage the variant locally; no API call yet
              setPendingNewVariant(variantData);
            } else {
              refetchVariants().then(() => {
                if (newVariantId) {
                  setSelVariantId(newVariantId);
                }
              });
            }
          }}
          isNew={isNew}
        />
      )}
    </div>
  );
}
