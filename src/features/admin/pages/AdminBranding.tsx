/**
 * src/features/admin/pages/AdminBranding.tsx
 * ─────────────────────────────────────────────
 * Admin image manager — "Home" folder layout.
 *
 * Features:
 *  1. All images grouped under a "Home" folder
 *  2. Click any image/video preview to open a full-screen lightbox viewer
 *  3. Delete button clears the slot (removes blob from storage)
 *  4. Hide / Show toggle for home-section slots (TWAM, Best Sellers, New Arrivals)
 *     → flips isActive so the section disappears / reappears on the home page
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllPageImages,
  uploadPageImage,
  deletePageImage,
  setPageImageVisibility,
} from "@/features/images/api/images.api";
import type { PageImageDto } from "@/features/images/api/images.api";
import { IMAGE_KEYS } from "@/features/images/constants/imageKeys";
import toast from "react-hot-toast";
import { getImageUrl } from "@/shared/utils/helpers";

// ── Slot metadata ─────────────────────────────────────────────────────────

const SLOT_META: Record<
  string,
  {
    label: string;
    hint: string;
    acceptBoth?: boolean;
    canHide?: boolean;
    /** When set, the Hide/Show toggle operates on this key instead of pageKey */
    visibilityKey?: string;
  }
> = {
  [IMAGE_KEYS.LOGIN_BACKGROUND]: {
    label: "Login Page Background",
    hint: "Full-page background shown behind the sign-in glass card.",
  },
  [IMAGE_KEYS.HOME_HERO_MOBILE]: {
    label: "Home Hero — Mobile Banner",
    hint: "Full-width banner shown at the top of the home page on mobile.",
  },
  [IMAGE_KEYS.HOME_HERO_DESKTOP]: {
    label: "Home Hero — Desktop",
    hint: "Fullscreen hero shown on desktop. Upload a video (.mp4, .webm) for an animated hero, or an image for a static banner. Auto-detected by file extension.",
    acceptBoth: true,
  },
  [IMAGE_KEYS.HOME_SECTION_TWAM]: {
    label: "Home Section — TWAM",
    hint: "Background image for the TWAM featured-products section on the home page.",
    canHide: true,
  },
  [IMAGE_KEYS.HOME_SECTION_BESTSELLERS]: {
    label: "Home Section — Best Sellers",
    hint: "Background image for the Best Sellers section on the home page.",
    canHide: true,
  },
  [IMAGE_KEYS.HOME_SECTION_NEWARRIVALS]: {
    label: "Home Section — New Arrivals",
    hint: "Background image for the New Arrivals section on the home page.",
    canHide: true,
  },
  [IMAGE_KEYS.HOME_SHOP_ALL_PRODUCTS]: {
    label: "Shop by Category",
    hint: "Upload the banner image for the 'All Products' tile. Use Hide / Show to toggle the entire Shop by Category section on the home page.",
    canHide: true,
    visibilityKey: IMAGE_KEYS.HOME_SHOP_BY_CATEGORY,
  },
};

const SLOT_ORDER = [
  IMAGE_KEYS.LOGIN_BACKGROUND,
  IMAGE_KEYS.HOME_HERO_MOBILE,
  IMAGE_KEYS.HOME_HERO_DESKTOP,
  IMAGE_KEYS.HOME_SECTION_TWAM,
  IMAGE_KEYS.HOME_SECTION_BESTSELLERS,
  IMAGE_KEYS.HOME_SECTION_NEWARRIVALS,
  IMAGE_KEYS.HOME_SHOP_ALL_PRODUCTS,
];

// ── Helpers ───────────────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

// ── Lightbox ──────────────────────────────────────────────────────────────

function Lightbox({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  const isVideo = isVideoUrl(url);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: 24,
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#fff",
          borderRadius: "50%",
          width: 44,
          height: 44,
          fontSize: 22,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          zIndex: 10000,
        }}
        title="Close"
      >
        ×
      </button>

      {/* Label */}
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 14,
          letterSpacing: "0.04em",
          textAlign: "center",
        }}
      >
        {label}
      </p>

      {/* Media */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "82vh",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          lineHeight: 0,
        }}
      >
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "82vh", display: "block" }}
          />
        ) : (
          <img
            src={url}
            alt={label}
            style={{
              maxWidth: "90vw",
              maxHeight: "82vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        )}
      </div>

      <p
        style={{
          color: "rgba(255,255,255,0.38)",
          fontSize: 11,
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Click outside or press × to close
      </p>
    </div>
  );
}

// ── ImageSlotCard ─────────────────────────────────────────────────────────

interface SlotCardProps {
  dto: PageImageDto;
  label: string;
  hint: string;
  acceptBoth?: boolean;
  canHide?: boolean;
  /** When provided, Hide/Show reads & writes this key's isActive instead of dto.pageKey */
  visibilityKey?: string;
  /** DTO for the visibilityKey slot (fetched separately by the parent) */
  visibilityDto?: PageImageDto;
}

function ImageSlotCard({
  dto,
  label,
  hint,
  acceptBoth = false,
  canHide = false,
  visibilityKey,
  visibilityDto,
}: SlotCardProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { pageKey, imageUrl: currentUrl } = dto;
  // If a separate visibilityKey is provided, use its isActive; otherwise fall back to dto.isActive
  const isActive = visibilityKey
    ? visibilityDto?.isActive ?? true
    : dto.isActive;
  const effectiveVisibilityKey = visibilityKey ?? pageKey;

  // ── Upload mutation ────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPageImage(pageKey, file),
    onSuccess: () => {
      toast.success(`${label} updated.`);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["all-page-images"] });
      qc.invalidateQueries({ queryKey: ["page-image", pageKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || `Failed to update ${label}.`);
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deletePageImage(pageKey),
    onSuccess: () => {
      toast.success(`${label} removed.`);
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ["all-page-images"] });
      qc.invalidateQueries({ queryKey: ["page-image", pageKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || `Failed to delete ${label}.`);
    },
  });

  // ── Visibility mutation ────────────────────────────────────────────────
  const visibilityMutation = useMutation({
    mutationFn: (active: boolean) =>
      setPageImageVisibility(effectiveVisibilityKey, active),
    onSuccess: (res) => {
      toast.success(
        res.isActive
          ? `${label} section is now visible.`
          : `${label} section is now hidden.`,
      );
      qc.invalidateQueries({ queryKey: ["all-page-images"] });
      qc.invalidateQueries({ queryKey: ["page-image", pageKey] });
      qc.invalidateQueries({
        queryKey: ["page-image", effectiveVisibilityKey],
      });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail || "Failed to update visibility.",
      );
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleCancel = () => {
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resolvedCurrentUrl = getImageUrl(currentUrl || null, "");
  const displayUrl = previewUrl || resolvedCurrentUrl;
  const showAsVideo = acceptBoth ? isVideoUrl(previewUrl || currentUrl) : false;
  const hasMedia = !!displayUrl;

  return (
    <>
      {lightboxOpen && hasMedia && (
        <Lightbox
          url={displayUrl}
          label={label}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div
        style={{
          background: "#fff",
          border: `1px solid ${
            isActive === false && canHide ? "#e8d5da" : "#eadfd8"
          }`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 4px 18px rgba(107,15,42,0.06)",
          display: "flex",
          flexDirection: "column",
          opacity: isActive === false ? 0.72 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {/* ── Preview strip ────────────────────────────────────────────── */}
        <div
          onClick={() => hasMedia && setLightboxOpen(true)}
          title={hasMedia ? "Click to view full size" : undefined}
          style={{
            height: 160,
            background:
              !showAsVideo && displayUrl
                ? `url("${displayUrl}") center/cover no-repeat`
                : "#f5f0eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderBottom: "1px solid #eadfd8",
            flexShrink: 0,
            overflow: "hidden",
            cursor: hasMedia ? "zoom-in" : "default",
          }}
        >
          {showAsVideo && displayUrl && (
            <video
              key={displayUrl}
              src={displayUrl}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
          )}

          {!displayUrl && (
            <span style={{ fontSize: 12, color: "#b89fa8" }}>No image set</span>
          )}

          {/* Preview badge */}
          {previewUrl && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "#6B0F2A",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 20,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Preview
            </span>
          )}

          {/* View button overlay */}
          {hasMedia && !previewUrl && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 0.18s, background 0.18s",
              }}
              className="preview-hover-overlay"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = "1";
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(0,0,0,0.38)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = "0";
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(0,0,0,0)";
              }}
            >
              <span
                style={{
                  background: "rgba(255,255,255,0.92)",
                  color: "#6B0F2A",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "6px 16px",
                  borderRadius: 20,
                  letterSpacing: "0.04em",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  userSelect: "none",
                }}
              >
                {showAsVideo ? "▶ Play" : "👁 View"}
              </span>
            </div>
          )}

          {/* Hidden badge */}
          {canHide && isActive === false && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(60,30,40,0.78)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: 20,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Hidden
            </span>
          )}
        </div>

        {/* ── Card body ────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "14px 16px 16px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Label + hint */}
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: "#3b0e1c",
              }}
            >
              {label}
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 11.5,
                color: "#9e6070",
                lineHeight: 1.5,
              }}
            >
              {hint}
            </p>
          </div>

          {/* Key badge */}
          <code
            style={{
              fontSize: 10,
              background: "#f5f0eb",
              color: "#7a4a5a",
              padding: "2px 8px",
              borderRadius: 6,
              display: "inline-block",
              width: "fit-content",
            }}
          >
            {pageKey}
          </code>

          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept={
              acceptBoth ? "image/*,video/mp4,video/webm,video/ogg" : "image/*"
            }
            onChange={handleFileChange}
            style={{
              fontSize: 12,
              border: "1px solid #d9cac2",
              borderRadius: 8,
              padding: "6px 10px",
              background: "#faf8f6",
              cursor: "pointer",
            }}
          />

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={uploadMutation.isPending || !previewUrl}
              style={{
                flex: 1,
                background:
                  uploadMutation.isPending || !previewUrl
                    ? "#d4b8be"
                    : "#6B0F2A",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 700,
                cursor:
                  uploadMutation.isPending || !previewUrl
                    ? "not-allowed"
                    : "pointer",
                transition: "background 0.2s",
              }}
            >
              {uploadMutation.isPending ? "Saving…" : "Save"}
            </button>
            {previewUrl && (
              <button
                onClick={handleCancel}
                style={{
                  background: "#f5f0eb",
                  color: "#6B0F2A",
                  border: "1px solid #d9cac2",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {/* ── Bottom action row: Delete + Hide/Show ─────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 2,
              paddingTop: 10,
              borderTop: "1px solid #f0e8e4",
            }}
          >
            {/* Delete button */}
            {currentUrl && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending}
                style={{
                  background: "transparent",
                  color: "#c0596e",
                  border: "1px solid #e8c4cc",
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                🗑 Delete
              </button>
            )}

            {/* Confirm delete */}
            {confirmDelete && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{ fontSize: 11, color: "#c0596e", fontWeight: 600 }}
                >
                  Remove image?
                </span>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  style={{
                    background: "#c0596e",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {deleteMutation.isPending ? "…" : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: "#f5f0eb",
                    color: "#6B0F2A",
                    border: "1px solid #d9cac2",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  No
                </button>
              </div>
            )}

            {!currentUrl && !confirmDelete && (
              <span style={{ fontSize: 11, color: "#c0a0a8" }}>
                No image uploaded
              </span>
            )}

            {/* Hide / Show toggle (only for home section slots) */}
            {canHide && (
              <button
                onClick={() => visibilityMutation.mutate(!isActive)}
                disabled={visibilityMutation.isPending}
                title={
                  isActive
                    ? "Hide this section on the home page"
                    : "Show this section on the home page"
                }
                style={{
                  background: isActive ? "#fff4f6" : "#f0faf4",
                  color: isActive ? "#b03050" : "#207843",
                  border: `1px solid ${isActive ? "#f0c0cc" : "#b0dcc0"}`,
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: visibilityMutation.isPending ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  marginLeft: "auto",
                  transition: "all 0.18s",
                }}
              >
                {visibilityMutation.isPending
                  ? "…"
                  : isActive
                  ? "👁 Hide Section"
                  : "👁 Show Section"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#f5f0eb",
        borderRadius: 16,
        height: 360,
        animation: "pulse 1.4s infinite",
      }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

// ── Folder definitions ────────────────────────────────────────────────────────
// Each entry describes one page-folder shown in the top-level grid.
// Add more here as new pages gain image slots.
const PAGE_FOLDERS = [
  {
    key: "home",
    label: "Home",
    subtitle:
      "Login, hero banners, section backgrounds, and category carousel images",
    slots: SLOT_ORDER,
  },
] as const;

type FolderKey = (typeof PAGE_FOLDERS)[number]["key"];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminBranding() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-page-images"],
    queryFn: getAllPageImages,
  });

  // null  = top-level folder list
  // "home" (or any future key) = inside that folder
  const [openFolder, setOpenFolder] = useState<FolderKey | null>(null);

  // Build lookup: pageKey → full DTO
  const dtoMap: Record<string, PageImageDto> = {};
  data?.images.forEach((img) => {
    dtoMap[img.pageKey] = img;
  });

  const activeFolder = PAGE_FOLDERS.find((f) => f.key === openFolder) ?? null;

  // ── Inside a folder ────────────────────────────────────────────────────────
  if (activeFolder) {
    return (
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 28,
          }}
        >
          <button
            onClick={() => setOpenFolder(null)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 14,
              color: "#9e6070",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#6B0F2A")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#9e6070")
            }
          >
            {/* left arrow */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Page Images
          </button>

          <span style={{ color: "#d4b0bb", fontSize: 14 }}>/</span>

          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#3b0e1c",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>📂</span>
            {activeFolder.label}
          </span>
        </div>

        {/* Folder title row */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#6B0F2A",
              margin: 0,
            }}
          >
            {activeFolder.label}
          </h1>
          <p style={{ marginTop: 6, color: "#8a6070", fontSize: 14 }}>
            {activeFolder.subtitle}
          </p>
        </div>

        {/* Image grid */}
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {activeFolder.slots.map((k) => (
              <SkeletonCard key={k} />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {activeFolder.slots.map((key) => {
              const meta = SLOT_META[key] ?? { label: key, hint: "" };
              const fallbackDto: PageImageDto = {
                pageKey: key,
                imageUrl: "",
                isActive: true,
              };
              const dto = dtoMap[key] ?? fallbackDto;
              // For slots that delegate visibility to a separate key, fetch that DTO too
              const visibilityDto = meta.visibilityKey
                ? dtoMap[meta.visibilityKey] ?? {
                    pageKey: meta.visibilityKey,
                    imageUrl: "",
                    isActive: true,
                  }
                : undefined;
              return (
                <ImageSlotCard
                  key={key}
                  dto={dto}
                  label={meta.label}
                  hint={meta.hint}
                  acceptBoth={meta.acceptBoth}
                  canHide={meta.canHide}
                  visibilityKey={meta.visibilityKey}
                  visibilityDto={visibilityDto}
                />
              );
            })}
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }
        `}</style>
      </div>
    );
  }

  // ── Top-level folder list ──────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{ fontSize: 28, fontWeight: 800, color: "#6B0F2A", margin: 0 }}
        >
          Page Images
        </h1>
        <p
          style={{
            marginTop: 8,
            color: "#8a6070",
            maxWidth: 640,
            fontSize: 14,
          }}
        >
          Upload background, hero, and section images for each page. Files are
          stored in blob storage on Azure (or locally during development) and
          served dynamically to every visitor.
        </p>
      </div>

      {/* Folder grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {PAGE_FOLDERS.map((folder) => (
          <button
            key={folder.key}
            onClick={() => setOpenFolder(folder.key)}
            style={{
              background: "#fff",
              border: "1.5px solid #e4d4da",
              borderRadius: 16,
              padding: "22px 22px 20px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: "0 2px 10px rgba(107,15,42,0.05)",
              transition:
                "border-color 0.18s, box-shadow 0.18s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#b87090";
              el.style.boxShadow = "0 6px 24px rgba(107,15,42,0.12)";
              el.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#e4d4da";
              el.style.boxShadow = "0 2px 10px rgba(107,15,42,0.05)";
              el.style.transform = "translateY(0)";
            }}
          >
            {/* Icon + label row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  filter: "drop-shadow(0 2px 4px rgba(107,15,42,0.15))",
                }}
              >
                📁
              </span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#3b0e1c",
                  }}
                >
                  {folder.label}
                </p>
                <span
                  style={{
                    fontSize: 11,
                    color: "#b89fa8",
                    fontWeight: 600,
                    background: "#eedfe4",
                    padding: "2px 8px",
                    borderRadius: 20,
                    display: "inline-block",
                    marginTop: 3,
                  }}
                >
                  {folder.slots.length} slots
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#9e6070",
                lineHeight: 1.5,
              }}
            >
              {folder.subtitle}
            </p>

            {/* Open arrow */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
                color: "#6B0F2A",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Open
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.5 6.5h8M7 2.5l4 4-4 4"
                  stroke="#6B0F2A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
