import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/shared/api/axiosInstance";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — match AdminProducts.tsx exactly
// ─────────────────────────────────────────────────────────────────────────────
const PRIMARY = "#7A1E2C";
const PRIMARY_LT = "#F5E9E6";
const BORDER = "#E6DAD3";
const GREY = "#F3EFEC";
const SUB = "#8A7F7A";
const TXT = "#2B2B2B";
const MAX_SWATCHES = 7;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveImg(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return encodeURI("http://127.0.0.1:8000/" + src.replace(/\\/g, "/"));
}

interface StatusInfo {
  fullyActive: boolean;
  reasons: { label: string; type: string }[];
}

function getStatusInfo(p: any): StatusInfo {
  const reasons: StatusInfo["reasons"] = [];
  if (p.brandDeletedInd)
    reasons.push({
      label: `Brand "${p.brandName || p.brandId}" deleted`,
      type: "deleted",
    });
  else if (p.brandIsActive === false)
    reasons.push({
      label: `Brand "${p.brandName || p.brandId}" hidden`,
      type: "hidden",
    });
  if (p.categoryDeletedInd)
    reasons.push({
      label: `Category "${p.categoryName || p.categoryId}" deleted`,
      type: "deleted",
    });
  else if (p.categoryIsActive === false)
    reasons.push({
      label: `Category "${p.categoryName || p.categoryId}" inactive`,
      type: "inactive",
    });
  if (p.isActive === false && reasons.length === 0)
    reasons.push({ label: "Hidden by admin", type: "inactive" });
  return { fullyActive: reasons.length === 0, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorSwatch — circle showing a hex/named color from the variant's color field
// ─────────────────────────────────────────────────────────────────────────────
function ColorSwatch({
  color,
  imgSrc,
  title,
}: {
  color?: string | null;
  imgSrc?: string | null;
  title?: string;
}) {
  const bg = color
    ? color.startsWith("#") ||
      color.startsWith("rgb") ||
      color.startsWith("hsl")
      ? color
      : color.length === 6 && /^[0-9a-fA-F]+$/.test(color)
      ? `#${color}`
      : color
    : "#d0c8c2";

  return (
    <span
      title={title || color || "Variant"}
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-block",
        border: "1.5px solid rgba(0,0,0,0.18)",
        overflow: "hidden",
        position: "relative",
        background: imgSrc ? undefined : bg,
        backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VariantSwatchRow — fetches variants for a product and renders color swatches
// ─────────────────────────────────────────────────────────────────────────────
function VariantSwatchRow({ productId }: { productId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-card-variants", productId],
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
            "Page.Size": 50,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  const variants: any[] = data?.list ?? [];
  const count = variants.length;

  if (isLoading) {
    return (
      <div
        style={{ display: "flex", gap: 5, alignItems: "center", minHeight: 24 }}
      >
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#e8e0da",
              display: "inline-block",
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (count === 0) {
    return (
      <div
        style={{
          fontSize: 11,
          color: "#c0b8b2",
          fontStyle: "italic",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <i className="bi bi-palette" style={{ fontSize: 12 }} />
        No variants
      </div>
    );
  }

  const visible = variants.slice(0, MAX_SWATCHES);
  const extra = count - MAX_SWATCHES;

  return (
    <div>
      {/* Label row */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SUB,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 5,
        }}
      >
        {count} Variant{count !== 1 ? "s" : ""}
      </div>
      {/* Swatches row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        {visible.map((v: any) => {
          const firstImg = v.images?.[0]?.filePath
            ? resolveImg(v.images[0].filePath)
            : null;
          return (
            <ColorSwatch
              key={v.productVariantId}
              color={v.color}
              imgSrc={firstImg}
              title={
                v.variantName || v.color || `Variant ${v.productVariantId}`
              }
            />
          );
        })}
        {extra > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: SUB,
              background: GREY,
              borderRadius: 20,
              padding: "2px 7px",
              lineHeight: 1.5,
            }}
          >
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminProductCardProps {
  product: any;
  onToggle: (id: number) => void;
  onDelete: (product: any) => void;
  toggleLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminProductCard — the main component
// ─────────────────────────────────────────────────────────────────────────────
export function AdminProductCard({
  product: p,
  onToggle,
  onDelete,
  toggleLoading,
}: AdminProductCardProps) {
  const navigate = useNavigate();
  const { fullyActive, reasons } = getStatusInfo(p);
  const [reasonsOpen, setReasonsOpen] = useState(false);

  // Backend now returns imageUrl directly (first product image).
  // Fall back to checking legacy fields just in case.
  const thumbSrc = resolveImg(
    p.imageUrl || p.image || p.selectedImage || p.thumbnail,
  );

  // Derive the "own" hidden state for the hide/show button label
  const isOwnHidden = p.isActive === false;
  const showAsActive = fullyActive; // active means fully active (not hidden by anything)

  return (
    <div
      style={{
        background: fullyActive ? "#fff" : "#fffafa",
        border: `1.5px solid ${fullyActive ? BORDER : "#e8b8b8"}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: fullyActive
          ? "0 2px 10px rgba(0,0,0,0.06)"
          : "0 2px 10px rgba(180,0,0,0.07)",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.18s, transform 0.18s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 6px 24px rgba(0,0,0,0.12)";
        (e.currentTarget as HTMLDivElement).style.transform =
          "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = fullyActive
          ? "0 2px 10px rgba(0,0,0,0.06)"
          : "0 2px 10px rgba(180,0,0,0.07)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* ── Status badge overlay ── */}
      {!fullyActive && (
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 3,
            background: "rgba(198,40,40,0.92)",
            backdropFilter: "blur(4px)",
            color: "#fff",
            fontSize: 9,
            fontWeight: 800,
            padding: "3px 9px",
            borderRadius: 20,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          Inactive
        </span>
      )}

      {/* ── Image area ── */}
      <div
        onClick={() => navigate(`/admin/products/${p.productId}/detail`)}
        style={{
          width: "100%",
          paddingBottom: "75%",
          position: "relative",
          background: GREY,
          overflow: "hidden",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={p.name || "Product"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: fullyActive ? 1 : 0.65,
              transition: "opacity 0.2s",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0";
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 6,
              color: "#c8b8b0",
            }}
          >
            <i className="bi bi-image" style={{ fontSize: 36 }} />
            <span style={{ fontSize: 11 }}>No image</span>
          </div>
        )}

        {/* Hover overlay hint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(122,30,44,0)",
            transition: "background 0.18s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
          className="img-hover-overlay"
        />
      </div>

      {/* ── Info area ── */}
      <div
        style={{
          padding: "12px 14px 8px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Product name */}
        <div
          onClick={() => navigate(`/admin/products/${p.productId}/detail`)}
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: TXT,
            cursor: "pointer",
            lineHeight: 1.35,
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
          title={p.name || undefined}
        >
          {p.name || "Unnamed Product"}
        </div>

        {/* Product code */}
        {p.productCode && (
          <div
            style={{
              fontSize: 11,
              color: SUB,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.03em",
            }}
          >
            #{p.productCode}
          </div>
        )}

        {/* Brand + Category tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {p.brandName && (
            <span
              title={
                p.brandDeletedInd
                  ? "Brand deleted"
                  : p.brandIsActive === false
                  ? "Brand hidden from public"
                  : undefined
              }
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: p.brandDeletedInd
                  ? "#fdecea"
                  : p.brandIsActive === false
                  ? "#fff3e0"
                  : PRIMARY_LT,
                color: p.brandDeletedInd
                  ? "#c62828"
                  : p.brandIsActive === false
                  ? "#e65100"
                  : PRIMARY,
                border: `1px solid ${
                  p.brandDeletedInd
                    ? "#ef9a9a"
                    : p.brandIsActive === false
                    ? "#ffcc80"
                    : "#e8cdd3"
                }`,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <i className="bi bi-bag" style={{ fontSize: 9 }} />
              {p.brandName}
              {p.brandDeletedInd && " ✕"}
              {!p.brandDeletedInd && p.brandIsActive === false && " ⚠"}
            </span>
          )}
          {p.categoryName && (
            <span
              title={
                p.categoryDeletedInd
                  ? "Category deleted"
                  : p.categoryIsActive === false
                  ? "Category inactive"
                  : undefined
              }
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: p.categoryDeletedInd
                  ? "#fdecea"
                  : p.categoryIsActive === false
                  ? "#fff3e0"
                  : "#f0f4ff",
                color: p.categoryDeletedInd
                  ? "#c62828"
                  : p.categoryIsActive === false
                  ? "#e65100"
                  : "#3949ab",
                border: `1px solid ${
                  p.categoryDeletedInd
                    ? "#ef9a9a"
                    : p.categoryIsActive === false
                    ? "#ffcc80"
                    : "#c5cae9"
                }`,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <i className="bi bi-tag" style={{ fontSize: 9 }} />
              {p.categoryName}
              {p.categoryDeletedInd && " ✕"}
              {!p.categoryDeletedInd && p.categoryIsActive === false && " ⚠"}
            </span>
          )}
        </div>

        {/* Inactive reasons — expandable */}
        {!fullyActive && reasons.length > 0 && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setReasonsOpen((o) => !o)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 10,
                color: "#c62828",
                textDecoration: "underline dotted",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <i
                className="bi bi-exclamation-triangle"
                style={{ fontSize: 10 }}
              />
              {reasons[0].label}
              {reasons.length > 1 && ` +${reasons.length - 1} more`}
            </button>
            {reasonsOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "#fff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 11,
                  zIndex: 100,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.13)",
                  minWidth: 190,
                  pointerEvents: "none",
                }}
              >
                {reasons.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      color: "#c62828",
                      marginBottom: i < reasons.length - 1 ? 5 : 0,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 4,
                    }}
                  >
                    <span>•</span>
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Variant swatches */}
        <div style={{ marginTop: 4 }}>
          <VariantSwatchRow productId={p.productId} />
        </div>
      </div>

      {/* ── Action bar ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 12px 12px",
          marginTop: "auto",
          borderTop: `1px solid ${BORDER}`,
          background: "#fafaf9",
        }}
      >
        {/* Edit — opens new full-detail page */}
        <button
          onClick={() => navigate(`/admin/products/${p.productId}/detail`)}
          title="Edit product"
          style={{
            flex: 1,
            padding: "6px 0",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 7,
            border: `1.5px solid ${BORDER}`,
            background: "#fff",
            color: PRIMARY,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            transition: "background 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              PRIMARY_LT;
            (e.currentTarget as HTMLButtonElement).style.borderColor = PRIMARY;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER;
          }}
        >
          <i className="bi bi-pencil" /> Edit
        </button>

        {/* Hide / Show */}
        <button
          onClick={() => onToggle(p.productId)}
          disabled={toggleLoading}
          title={showAsActive ? "Hide from public" : "Show to public"}
          style={{
            flex: 1,
            padding: "6px 0",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 7,
            border: `1.5px solid ${!isOwnHidden ? "#ffe082" : "#c8e6c9"}`,
            background: !isOwnHidden ? "#fff8e1" : "#e8f5e9",
            color: !isOwnHidden ? "#e65100" : "#2e7d32",
            cursor: toggleLoading ? "wait" : "pointer",
            opacity: toggleLoading ? 0.55 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            transition: "opacity 0.1s",
          }}
        >
          {!isOwnHidden ? "🙈 Hide" : "👁 Show"}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(p)}
          title="Delete product"
          style={{
            padding: "6px 11px",
            fontSize: 13,
            borderRadius: 7,
            border: "1.5px solid #ef9a9a",
            background: "#fdecea",
            color: "#c62828",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#f8c8c8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#fdecea";
          }}
        >
          <i className="bi bi-trash" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminProductCardSkeleton — loading placeholder
// ─────────────────────────────────────────────────────────────────────────────
export function AdminProductCardSkeleton() {
  const shimmer: React.CSSProperties = {
    background: "linear-gradient(90deg, #f0ebe7 25%, #e6ddd8 50%, #f0ebe7 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    borderRadius: 6,
  };
  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      {/* Image placeholder */}
      <div
        style={{ width: "100%", paddingBottom: "75%", position: "relative" }}
      >
        <div style={{ position: "absolute", inset: 0, ...shimmer }} />
      </div>
      {/* Info placeholder */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ height: 16, width: "75%", ...shimmer }} />
        <div style={{ height: 11, width: "40%", ...shimmer }} />
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{ height: 18, width: 60, borderRadius: 20, ...shimmer }}
          />
          <div
            style={{ height: 18, width: 70, borderRadius: 20, ...shimmer }}
          />
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{ width: 20, height: 20, borderRadius: "50%", ...shimmer }}
            />
          ))}
        </div>
      </div>
      {/* Action bar placeholder */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 12px 12px",
          borderTop: `1px solid ${BORDER}`,
          background: "#fafaf9",
        }}
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: 1, height: 32, borderRadius: 7, ...shimmer }}
          />
        ))}
        <div style={{ width: 40, height: 32, borderRadius: 7, ...shimmer }} />
      </div>
      {/* Shimmer keyframe injected once via a style tag */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
