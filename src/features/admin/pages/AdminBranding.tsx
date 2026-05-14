/**
 * src/features/admin/pages/AdminBranding.tsx
 * ─────────────────────────────────────────────
 * Admin page-image manager.
 * Shows every registered page-image slot; allows the admin to preview the
 * current image and upload a replacement.  All images are stored via the
 * unified  /api/images  module (blob on Azure, local /uploads/ in dev).
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllPageImages,
  uploadPageImage,
} from "@/features/images/api/images.api";
import { IMAGE_KEYS } from "@/features/images/constants/imageKeys";
import toast from "react-hot-toast";

// ── Metadata for the UI labels ─────────────────────────────────────────────
const SLOT_META: Record<string, { label: string; hint: string }> = {
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
  },
  [IMAGE_KEYS.HOME_SECTION_TWAM]: {
    label: "Home Section — TWAM Background",
    hint: "Background image for the TWAM featured-products section.",
  },
  [IMAGE_KEYS.HOME_SECTION_BESTSELLERS]: {
    label: "Home Section — Best Sellers Background",
    hint: "Background image for the Best Sellers products section.",
  },
  [IMAGE_KEYS.HOME_SECTION_NEWARRIVALS]: {
    label: "Home Section — New Arrivals Background",
    hint: "Background image for the New Arrivals products section.",
  },
  [IMAGE_KEYS.HOME_SHOP_ALL_PRODUCTS]: {
    label: "Shop by Category — All Products Banner",
    hint: "Banner image for the 'All Products' tile in the Shop by Category carousel.",
  },
};

// Ordered display list
const SLOT_ORDER = [
  IMAGE_KEYS.LOGIN_BACKGROUND,
  IMAGE_KEYS.HOME_HERO_MOBILE,
  IMAGE_KEYS.HOME_HERO_DESKTOP,
  IMAGE_KEYS.HOME_SECTION_TWAM,
  IMAGE_KEYS.HOME_SECTION_BESTSELLERS,
  IMAGE_KEYS.HOME_SECTION_NEWARRIVALS,
  IMAGE_KEYS.HOME_SHOP_ALL_PRODUCTS,
];

// ── ImageSlotCard ──────────────────────────────────────────────────────────

interface SlotCardProps {
  pageKey: string;
  currentUrl: string;
  label: string;
  hint: string;
  acceptBoth?: boolean; // accepts both image and video (auto-detects preview)
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function ImageSlotCard({
  pageKey,
  currentUrl,
  label,
  hint,
  acceptBoth = false,
}: SlotCardProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const mutation = useMutation({
    mutationFn: (file: File) => uploadPageImage(pageKey, file),
    onSuccess: () => {
      toast.success(`${label} updated.`);
      setPreviewUrl("");
      qc.invalidateQueries({ queryKey: ["all-page-images"] });
      qc.invalidateQueries({ queryKey: ["page-image", pageKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || `Failed to update ${label}.`);
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
    mutation.mutate(file);
  };

  const handleCancel = () => {
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayUrl = previewUrl || currentUrl;
  const showAsVideo = acceptBoth ? isVideoUrl(previewUrl || currentUrl) : false;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eadfd8",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 18px rgba(107,15,42,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Preview strip */}
      <div
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
        }}
      >
        {showAsVideo && displayUrl && (
          <video
            key={displayUrl}
            src={displayUrl}
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!displayUrl && (
          <span style={{ fontSize: 12, color: "#b89fa8" }}>No image set</span>
        )}
        {previewUrl && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
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
      </div>

      {/* Content */}
      <div
        style={{
          padding: "16px 18px 18px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
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
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9e6070" }}>
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

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <button
            onClick={handleSave}
            disabled={mutation.isPending || !previewUrl}
            style={{
              flex: 1,
              background:
                mutation.isPending || !previewUrl ? "#d4b8be" : "#6B0F2A",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 700,
              cursor:
                mutation.isPending || !previewUrl ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {mutation.isPending ? "Saving…" : "Save"}
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
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminBranding() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-page-images"],
    queryFn: getAllPageImages,
  });

  // Build a lookup: pageKey → imageUrl
  const urlMap: Record<string, string> = {};
  data?.images.forEach((img) => {
    urlMap[img.pageKey] = img.imageUrl;
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{ fontSize: 28, fontWeight: 800, color: "#6B0F2A", margin: 0 }}
        >
          Images
        </h1>
        <p style={{ marginTop: 8, color: "#8a6070", maxWidth: 600 }}>
          Upload background, hero, and section images for each page. Supports
          images and video URLs. Files are stored in blob storage on Azure (or
          locally during development) and served dynamically to every visitor.
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {SLOT_ORDER.map((key) => (
            <div
              key={key}
              style={{
                width: 300,
                height: 280,
                background: "#f5f0eb",
                borderRadius: 16,
                animation: "pulse 1.4s infinite",
              }}
            />
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
          {SLOT_ORDER.map((key) => {
            const meta = SLOT_META[key] ?? { label: key, hint: "" };
            return (
              <ImageSlotCard
                key={key}
                pageKey={key}
                acceptBoth={key === IMAGE_KEYS.HOME_HERO_DESKTOP}
                currentUrl={urlMap[key] ?? ""}
                label={meta.label}
                hint={meta.hint}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
