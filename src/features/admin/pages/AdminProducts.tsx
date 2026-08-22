import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/features/auth/store/authStore";
import toast from "react-hot-toast";
import {
  AdminProductCard,
  AdminProductCardSkeleton,
} from "@/features/admin/components/AdminProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;
const PRIMARY = "#7A1E2C";
const PRIMARY_LT = "#F5E9E6";
const BORDER = "#E6DAD3";
const GREY = "#F3EFEC";
const SUB = "#8A7F7A";
const TXT = "#2B2B2B";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
// Backend returns full URLs — just delegate to getImageUrl
function resolveImg(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/assets")) return src;
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// BannerCard  ← exact same markup/classes as TwamBrands
// ─────────────────────────────────────────────────────────────────────────────
function BannerCard({
  image,
  name,
  count,
  onClick,
  isActive = true,
  badge,
  activeCount,
  inactiveCount,
}: {
  image?: string | null;
  name: string;
  count?: number;
  onClick: () => void;
  isActive?: boolean;
  badge?: string;
  activeCount?: number;
  inactiveCount?: number;
}) {
  const imgSrc = resolveImg(image);
  return (
    <button
      type="button"
      onClick={onClick}
      className="s-twambrands-cd99a8"
      aria-label={name}
      style={{ opacity: isActive ? 1 : 0.62, position: "relative" }}
    >
      <span
        className="s-twambrands-image-frame"
        style={{ position: "relative", display: "block" }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            className="s-twambrands-62d26f"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/fallback.png";
            }}
          />
        ) : (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              minHeight: 80,
              flexDirection: "column",
              gap: 4,
              color: "#c8b8b0",
            }}
          >
            <i className="bi bi-image" style={{ fontSize: 30 }} />
          </span>
        )}
        {/* Count badge — top-left over the image */}
        {count !== undefined && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              lineHeight: 1.4,
            }}
          >
            {count} {count === 1 ? "product" : "products"}
          </span>
        )}
        {/* Status badge — top-right */}
        {badge && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background:
                badge === "DELETED"
                  ? "#c62828"
                  : badge === "HIDDEN"
                  ? "#e65100"
                  : "#555",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 20,
            }}
          >
            {badge}
          </span>
        )}
      </span>
      {/* Name row */}
      <p className="s-twambrands-f87e81">{name}</p>
      {/* Active / inactive counts */}
      {(activeCount !== undefined || inactiveCount !== undefined) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 11,
            paddingBottom: 8,
            flexWrap: "wrap",
          }}
        >
          {activeCount !== undefined && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#2e7d32",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#43a047",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {activeCount} active
            </span>
          )}
          {inactiveCount !== undefined && inactiveCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#c62828",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#e53935",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {inactiveCount} inactive
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function BannerGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 360px))",
        gap: 28,
      }}
    >
      {children}
    </div>
  );
}

// "Show All" card — placed first in each banner grid level
function AllProductsCard({
  label,
  count,
  activeCount,
  inactiveCount,
  onClick,
}: {
  label: string;
  count: number;
  activeCount?: number;
  inactiveCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: `2px dashed ${PRIMARY}`,
        borderRadius: 14,
        background: PRIMARY_LT,
        cursor: "pointer",
        padding: "22px 16px",
        minHeight: 140,
        transition: "box-shadow 0.15s",
      }}
      onMouseOver={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 4px 18px rgba(122,30,44,0.18)")
      }
      onMouseOut={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.boxShadow = "none")
      }
    >
      <i
        className="bi bi-grid-3x3-gap-fill"
        style={{ fontSize: 32, color: PRIMARY }}
      />
      <span
        style={{ fontSize: 14, fontWeight: 800, color: PRIMARY, marginTop: 4 }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#8A7F7A",
          background: "rgba(122,30,44,0.08)",
          borderRadius: 20,
          padding: "2px 12px",
        }}
      >
        {count} product{count !== 1 ? "s" : ""}
      </span>
      {(activeCount !== undefined || inactiveCount !== undefined) && (
        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 11,
            marginTop: 2,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {activeCount !== undefined && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#2e7d32",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#43a047",
                  display: "inline-block",
                }}
              />
              {activeCount} active
            </span>
          )}
          {inactiveCount !== undefined && inactiveCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#c62828",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#e53935",
                  display: "inline-block",
                }}
              />
              {inactiveCount} inactive
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 360px))",
        gap: 28,
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="s-twambrands-79a62b" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────
function Breadcrumbs({
  crumbs,
}: {
  crumbs: { label: string; onClick?: () => void }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 13,
        marginBottom: 20,
      }}
    >
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && (
            <i
              className="bi bi-chevron-right"
              style={{ fontSize: 10, color: SUB }}
            />
          )}
          <span
            onClick={c.onClick}
            style={{
              color: c.onClick ? PRIMARY : TXT,
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

// ─────────────────────────────────────────────────────────────────────────────
// Status / pill helpers (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
interface StatusInfo {
  fullyActive: boolean;
  reasons: { label: string; type: string }[];
}
function getStatusInfo(p: any, isExplicitlyHidden?: boolean): StatusInfo {
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
  else if (isExplicitlyHidden && reasons.length > 0)
    reasons.unshift({ label: "Hidden by admin", type: "inactive" });
  return { fullyActive: reasons.length === 0, reasons };
}

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
  const { fullyActive } = getStatusInfo(product, isExplicitlyHidden);
  if (fullyActive) {
    return (
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 11px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 20,
          background: "#e8f5e9",
          color: "#2e7d32",
          border: "1.5px solid #a5d6a7",
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
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
    <button
      onClick={onToggle}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 20,
        background: "#fdecea",
        color: "#c62828",
        border: "1.5px solid #ef9a9a",
        cursor: "pointer",
        opacity: loading ? 0.6 : 1,
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
    </button>
  );
}

function HideShowButton({
  isOwnActive,
  isExplicitlyHidden,
  onToggle,
  loading,
}: {
  isOwnActive: boolean;
  isExplicitlyHidden?: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  const showAsActive = isOwnActive && !isExplicitlyHidden;
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      style={{
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 7,
        border: `1px solid ${showAsActive ? "#ffe082" : "#c8e6c9"}`,
        background: showAsActive ? "#fff8e1" : "#e8f5e9",
        color: showAsActive ? "#e65100" : "#2e7d32",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {showAsActive ? "🙈 Hide" : "👁 Show"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VariantDetailPanel (collapsed — size/price rows per variant)
// ─────────────────────────────────────────────────────────────────────────────
function VariantDetailPanel({ variantId }: { variantId: number }) {
  const { data, refetch } = useQuery({
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
  const pvds = data?.list ?? [];
  const th: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: SUB,
    borderBottom: `1px solid ${BORDER}`,
  };
  return (
    <div style={{ padding: "0 0 14px 48px" }}>
      <div
        style={{
          background: "#fffcf9",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: "#faf4f0",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 12,
            fontWeight: 700,
            color: SUB,
          }}
        >
          Size / Detail ({pvds.length})
        </div>
        {pvds.length === 0 ? (
          <div style={{ padding: "16px 14px", fontSize: 12, color: SUB }}>
            No size details
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f3f0" }}>
                  {[
                    "Size",
                    "Cup",
                    "Stock",
                    "Sold",
                    "Available",
                    "MRP",
                    "Final",
                    "Status",
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvds.map((pvd: any) => {
                  const iA = pvd.isActive !== false;
                  const td: React.CSSProperties = {
                    padding: "10px 12px",
                    fontSize: 12,
                  };
                  return (
                    <tr
                      key={pvd.productVariantDetailId}
                      style={{ opacity: iA ? 1 : 0.65 }}
                    >
                      <td style={td}>{pvd.sizeLabel || "—"}</td>
                      <td style={td}>{pvd.cupSizeLabel || "—"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {pvd.stockQuantity ?? 0}
                      </td>
                      <td style={{ ...td, color: SUB }}>
                        {pvd.processedQuantity ?? 0}
                      </td>
                      <td style={{ ...td, color: SUB }}>
                        {pvd.availableQuantity ?? 0}
                      </td>
                      <td style={td}>₹{pvd.mrpPrice?.toFixed(2) ?? "—"}</td>
                      <td style={{ ...td, fontWeight: 600, color: PRIMARY }}>
                        ₹{pvd.finalPrice?.toFixed(2) ?? "—"}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: iA ? "#e8f5e9" : "#fdecea",
                            color: iA ? "#2e7d32" : "#c62828",
                          }}
                        >
                          {iA ? "Active" : "Off"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VariantPanel
// ─────────────────────────────────────────────────────────────────────────────
function VariantPanel({ productId }: { productId: number }) {
  const navigate = useNavigate();
  const [openDetail, setOpenDetail] = useState<number | null>(null);
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
  const th: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: SUB,
    borderBottom: `1px solid ${BORDER}`,
  };
  return (
    <div style={{ padding: "0 0 16px 32px" }}>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            background: PRIMARY_LT,
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: PRIMARY }}>
            <i className="bi bi-layers" /> {variants.length} Variant
            {variants.length !== 1 ? "s" : ""}
          </div>
          <button
            onClick={() => navigate(`/admin/products/${productId}/detail`)}
            style={{
              background: PRIMARY,
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
          <div style={{ padding: "20px 16px", fontSize: 12, color: SUB }}>
            Loading…
          </div>
        ) : variants.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              fontSize: 12,
              color: SUB,
              textAlign: "center",
            }}
          >
            No variants
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: GREY }}>
                <th style={{ width: 32 }} />
                {["Color/Name", "Code", "Type", "Status", "Actions"].map(
                  (h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {variants.flatMap((v: any) => {
                const isExp = openDetail === v.productVariantId;
                const iA = v.isActive !== false;
                const td: React.CSSProperties = { padding: "10px 12px" };
                const rows: any[] = [];
                rows.push(
                  <tr
                    key={v.productVariantId}
                    style={{
                      background: iA ? "transparent" : "#fff8f8",
                      opacity: iA ? 1 : 0.72,
                    }}
                  >
                    <td style={td}>
                      <button
                        onClick={() =>
                          setOpenDetail(isExp ? null : v.productVariantId)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: SUB,
                        }}
                      >
                        <i
                          className={`bi bi-chevron-${
                            isExp ? "down" : "right"
                          }`}
                        />
                      </button>
                    </td>
                    <td style={td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {v.color && (
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: v.color,
                              border: `1px solid ${BORDER}`,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {v.variantName || "—"}
                          </div>
                          {v.color && (
                            <div style={{ fontSize: 11, color: SUB }}>
                              {v.color}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: SUB }}>
                      {v.productCode || "—"}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {v.isCupSize ? "Cup" : "Regular"}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: iA ? "#e8f5e9" : "#fdecea",
                          color: iA ? "#2e7d32" : "#c62828",
                        }}
                      >
                        {iA ? "Active" : "Off"}
                      </span>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() =>
                          navigate(
                            `/admin/products/${productId}?variant=${v.productVariantId}`,
                          )
                        }
                        style={{
                          background: PRIMARY_LT,
                          color: PRIMARY,
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                    </td>
                  </tr>,
                );
                if (isExp)
                  rows.push(
                    <tr key={`${v.productVariantId}-d`}>
                      <td
                        colSpan={6}
                        style={{
                          padding: 0,
                          borderBottom: `1px solid ${BORDER}`,
                        }}
                      >
                        <VariantDetailPanel variantId={v.productVariantId} />
                      </td>
                    </tr>,
                  );
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ProductsTable  (now renders as an admin product card grid)
// ─────────────────────────────────────────────────────────────────────────────
const CARD_PAGE_SIZE = 12; // cards per page — 4 per row × 3 rows

function ProductsTable({
  brandId,
  categoryId,
  isChildCategory,
  totalLabel,
  navState,
}: {
  brandId?: number;
  categoryId?: number;
  isChildCategory?: boolean; // true → filter by childCategoryId, false/undefined → categoryId
  totalLabel: string;
  navState?: any;
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirm] = useState<any>(null);

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
        // If this is a subcategory (child), filter by childCategoryId field
        property: isChildCategory ? "childCategoryId" : "categoryId",
        comparison: "eq",
        value: String(categoryId),
      });
    return {
      ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
      "Page.Index": page,
      "Page.Size": CARD_PAGE_SIZE,
      "Order.Property": "ModifiedDate",
      "Order.Ascending": "false",
    };
  }, [brandId, categoryId, isChildCategory, page]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-products-filtered",
      brandId,
      categoryId,
      isChildCategory,
      page,
    ],
    queryFn: () =>
      api
        .get("/Products/", { params: { ...buildParams(), adminView: true } })
        .then((r) => r.data),
  });

  const toggleProduct = useMutation({
    mutationFn: (id: number) => api.patch(`/Products/${id}/toggle-active`),
    onMutate: async (id: number) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["admin-products-filtered"] });
      // Snapshot previous data for all matching queries
      const previousData = qc.getQueriesData({
        queryKey: ["admin-products-filtered"],
      });
      // Optimistically flip isActive on the matching product in every cached page
      qc.setQueriesData(
        { queryKey: ["admin-products-filtered"] },
        (old: any) => {
          if (!old?.list) return old;
          return {
            ...old,
            list: old.list.map((p: any) =>
              p.productId === id ? { ...p, isActive: !p.isActive } : p,
            ),
          };
        },
      );
      return { previousData };
    },
    onError: (_err, _id, context: any) => {
      // Roll back on failure
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]: [any, any]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to update product visibility");
    },
    onSuccess: () => {
      toast.success("Updated");
    },
    onSettled: () => {
      // Always refetch to sync with server
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`/Products/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-products-filtered"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  const products = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / CARD_PAGE_SIZE) || 1;

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          fontSize: 13,
          color: SUB,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          {isLoading
            ? "Loading products…"
            : `${total} product${total !== 1 ? "s" : ""} in `}
          {!isLoading && <strong style={{ color: TXT }}>{totalLabel}</strong>}
        </span>
        {pages > 1 && !isLoading && (
          <span style={{ fontSize: 12, color: SUB }}>
            Page {page} of {pages}
          </span>
        )}
      </div>

      {/* Card grid */}
      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {Array.from({ length: CARD_PAGE_SIZE }).map((_, i) => (
            <AdminProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: SUB,
            fontSize: 14,
          }}
        >
          <i
            className="bi bi-box-seam"
            style={{
              fontSize: 40,
              display: "block",
              marginBottom: 12,
              opacity: 0.4,
            }}
          />
          No products found in {totalLabel}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {products.map((p: any) => (
            <AdminProductCard
              key={p.productId}
              product={p}
              navState={navState}
              onToggle={(id) => toggleProduct.mutate(id)}
              onDelete={(prod) => setConfirm(prod)}
              toggleLoading={toggleProduct.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 28,
            flexWrap: "wrap",
          }}
        >
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="s-adminproduct-26d310"
          >
            ← Prev
          </button>

          {/* Page number pills */}
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map(
            (pg) => (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: `1.5px solid ${pg === page ? PRIMARY : BORDER}`,
                  background: pg === page ? PRIMARY : "#fff",
                  color: pg === page ? "#fff" : TXT,
                  fontWeight: pg === page ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
              >
                {pg}
              </button>
            ),
          )}

          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="s-adminproduct-26d310"
          >
            Next →
          </button>
        </div>
      )}

      {/* Delete confirm modal */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared data hooks (both browse modes share same cache keys)
// ─────────────────────────────────────────────────────────────────────────────
function useBrands() {
  return useQuery({
    queryKey: ["admin-brands-browse"],
    queryFn: () =>
      api
        .get("/Brand/", {
          params: {
            showAll: true,
            "Page.Size": 200,
            "Order.Property": "ModifiedDate",
            "Order.Ascending": false,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });
}

function useCategories() {
  return useQuery({
    queryKey: ["admin-cats-browse"],
    queryFn: () =>
      api
        .get("/Category", {
          params: {
            "Page.Size": 500,
            "Order.Property": "DisplayOrder",
            "Order.Ascending": true,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BrowseByBrand
// Level 0: brand icons
// Level 1: parent-category icons for that brand
// Level 2: child-category icons (if any)
// Level 3: products table
// ─────────────────────────────────────────────────────────────────────────────
type BrandNav =
  | { view: "brands" }
  | { view: "categories"; brand: any }
  | { view: "subcategories"; brand: any; category: any }
  | { view: "products"; brand: any; category?: any; subCategory?: any };

function BrowseByBrand() {
  const navigate = useNavigate();
  const location = useLocation();
  const [nav, setNav] = useState<BrandNav>(() => {
    // Restore nav position when returning from product detail via back button
    const restored = location.state?.navState;
    return restored ?? { view: "brands" };
  });
  const { data: brandsData, isLoading: brandsLoading } = useBrands();
  const { data: catsData, isLoading: catsLoading } = useCategories();

  const brands: any[] = brandsData?.list ?? [];
  const allCats: any[] = catsData?.list ?? [];

  // Fetch all products for selected brand (to know which categories exist in it)
  const selBrand = nav.view !== "brands" ? (nav as any).brand : null;
  const { data: bpData, isLoading: bpLoading } = useQuery({
    queryKey: ["brand-products-meta", selBrand?.brandId],
    enabled: !!selBrand,
    queryFn: () =>
      api
        .get("/Products/", {
          params: {
            Filters: JSON.stringify([
              {
                property: "brandId",
                comparison: "eq",
                value: String(selBrand.brandId),
              },
            ]),
            "Page.Size": 1000,
            adminView: true,
          },
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  const brandProducts: any[] = bpData?.list ?? [];

  // Products store parent category in categoryId and subcategory in childCategoryId.
  // We need both sets to correctly detect which categories/subcategories exist for this brand.
  const catIdsInBrand = new Set(
    brandProducts.map((p: any) => p.categoryId).filter(Boolean),
  );
  const childCatIdsInBrand = new Set(
    brandProducts.map((p: any) => p.childCategoryId).filter(Boolean),
  );

  function parentCatsInBrand() {
    return allCats.filter((c: any) => {
      if (c.parentCategoryId && c.parentCategoryId !== 0) return false; // skip child cats
      // Show parent cat if any product has it as categoryId (parent)
      if (catIdsInBrand.has(c.categoryId)) return true;
      // Also show if any child category of this parent has products (via childCategoryId)
      return allCats.some(
        (child: any) =>
          Number(child.parentCategoryId) === Number(c.categoryId) &&
          childCatIdsInBrand.has(child.categoryId),
      );
    });
  }
  function childCats(catId: number) {
    // A subcategory belongs here if its parentCategoryId matches AND
    // some product has it as childCategoryId
    return allCats.filter(
      (c: any) =>
        Number(c.parentCategoryId) === Number(catId) &&
        childCatIdsInBrand.has(c.categoryId),
    );
  }
  // Count products whose parent category matches (used for parent-level counts)
  function countInParentCat(catId: number) {
    return brandProducts.filter((p: any) => p.categoryId === catId).length;
  }
  // Count products in a subcategory via childCategoryId
  function countInCat(catId: number) {
    // If this is a child cat, count by childCategoryId; otherwise count by categoryId
    const isChildCat = allCats.some(
      (c: any) => c.categoryId === catId && c.parentCategoryId,
    );
    if (isChildCat) {
      return brandProducts.filter((p: any) => p.childCategoryId === catId)
        .length;
    }
    return brandProducts.filter((p: any) => p.categoryId === catId).length;
  }
  function countActiveInCat(catId: number) {
    const isChildCat = allCats.some(
      (c: any) => c.categoryId === catId && c.parentCategoryId,
    );
    if (isChildCat) {
      return brandProducts.filter(
        (p: any) => p.childCategoryId === catId && p.isActive !== false,
      ).length;
    }
    return brandProducts.filter(
      (p: any) => p.categoryId === catId && p.isActive !== false,
    ).length;
  }
  function countInactiveInCat(catId: number) {
    const isChildCat = allCats.some(
      (c: any) => c.categoryId === catId && c.parentCategoryId,
    );
    if (isChildCat) {
      return brandProducts.filter(
        (p: any) => p.childCategoryId === catId && p.isActive === false,
      ).length;
    }
    return brandProducts.filter(
      (p: any) => p.categoryId === catId && p.isActive === false,
    ).length;
  }
  // Brand-level total / active / inactive
  function countForBrandAll(bId: number) {
    return allBrandProducts.filter((p: any) => p.brandId === bId);
  }

  // Breadcrumbs
  function crumbs() {
    const out: { label: string; onClick?: () => void }[] = [
      {
        label: "All Brands",
        onClick:
          nav.view !== "brands" ? () => setNav({ view: "brands" }) : undefined,
      },
    ];
    if (
      nav.view === "categories" ||
      nav.view === "subcategories" ||
      nav.view === "products"
    ) {
      const b = (nav as any).brand;
      out.push({
        label: b.brandName,
        onClick:
          nav.view !== "categories"
            ? () => setNav({ view: "categories", brand: b })
            : undefined,
      });
    }
    if (nav.view === "subcategories" || nav.view === "products") {
      const b = (nav as any).brand;
      const c = (nav as any).category;
      if (!c) {
        // "All products in brand" shortcut — no category crumb needed
      } else {
        const hasChildren = childCats(c.categoryId).length > 0;
        out.push({
          label: c.name,
          onClick:
            nav.view === "products" && (nav as any).subCategory
              ? () =>
                  setNav(
                    hasChildren
                      ? { view: "subcategories", brand: b, category: c }
                      : { view: "products", brand: b, category: c },
                  )
              : undefined,
        });
      }
    }
    if (nav.view === "products" && (nav as any).subCategory) {
      out.push({ label: (nav as any).subCategory.name });
    }
    return out;
  }

  // Fetch product counts per brand (for the brand grid badges)
  const { data: brandCountData } = useQuery({
    queryKey: ["brand-product-counts"],
    queryFn: () =>
      api.get("/Category/GetCategoryProductCount").then((r) => r.data),
    staleTime: 60_000,
  });
  // Also get per-brand product counts via products API summary
  const { data: allBrandProductsData } = useQuery({
    queryKey: ["all-brand-products-count"],
    queryFn: () =>
      api
        .get("/Products/", { params: { "Page.Size": 1000, adminView: true } })
        .then((r) => r.data),
    staleTime: 60_000,
  });
  const allBrandProducts: any[] = allBrandProductsData?.list ?? [];
  function countForBrand(brandId: number) {
    return allBrandProducts.filter((p: any) => p.brandId === brandId).length;
  }

  // ── Level 0: brands ────────────────────────────────────────────────────────
  if (nav.view === "brands") {
    return brandsLoading ? (
      <SkeletonGrid />
    ) : brands.length === 0 ? (
      <p className="s-twambrands-1c5031">No brands found.</p>
    ) : (
      <BannerGrid>
        {brands.map((b: any) => {
          const bProds = countForBrandAll(b.brandId);
          const bActive = bProds.filter(
            (p: any) => p.isActive !== false,
          ).length;
          const bInactive = bProds.filter(
            (p: any) => p.isActive === false,
          ).length;
          return (
            <BannerCard
              key={b.brandId}
              image={b.brandImage}
              name={b.brandName}
              isActive={b.isActive !== false}
              count={bProds.length}
              activeCount={bActive}
              inactiveCount={bInactive}
              badge={
                b.deletedInd
                  ? "DELETED"
                  : b.isActive === false
                  ? "HIDDEN"
                  : undefined
              }
              onClick={() => setNav({ view: "categories", brand: b })}
            />
          );
        })}
      </BannerGrid>
    );
  }

  const brand = (nav as any).brand;

  // ── Level 1: categories for brand ─────────────────────────────────────────
  if (nav.view === "categories") {
    const loading = catsLoading || bpLoading;
    const pCats = parentCatsInBrand();
    const brandTotal = brandProducts.length;
    const brandActive = brandProducts.filter(
      (p: any) => p.isActive !== false,
    ).length;
    const brandInactive = brandProducts.filter(
      (p: any) => p.isActive === false,
    ).length;
    return (
      <div>
        <Breadcrumbs crumbs={crumbs()} />
        {loading ? (
          <SkeletonGrid />
        ) : pCats.length === 0 ? (
          // No categories found for this brand — show products directly
          <ProductsTable
            brandId={brand.brandId}
            totalLabel={brand.brandName}
            navState={nav}
          />
        ) : (
          <BannerGrid>
            {/* "All Products in Brand" shortcut card */}
            <AllProductsCard
              label={`All ${brand.brandName} Products`}
              count={brandTotal}
              activeCount={brandActive}
              inactiveCount={brandInactive}
              onClick={() =>
                setNav({ view: "products", brand, category: undefined })
              }
            />
            {pCats.map((cat: any) => (
              <BannerCard
                key={cat.categoryId}
                image={cat.categoryImage}
                name={cat.name}
                count={countInCat(cat.categoryId)}
                activeCount={countActiveInCat(cat.categoryId)}
                inactiveCount={countInactiveInCat(cat.categoryId)}
                isActive={cat.isActive !== false}
                badge={cat.isActive === false ? "INACTIVE" : undefined}
                onClick={() => {
                  const children = childCats(cat.categoryId);
                  setNav(
                    children.length > 0
                      ? { view: "subcategories", brand, category: cat }
                      : { view: "products", brand, category: cat },
                  );
                }}
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  // ── Level 2: sub-categories (icon grid, same style as brand/category levels) ──
  if (nav.view === "subcategories") {
    const cat = (nav as any).category;
    const children = childCats(cat.categoryId);
    return (
      <div>
        <Breadcrumbs crumbs={crumbs()} />
        {children.length === 0 ? (
          <ProductsTable
            brandId={brand.brandId}
            categoryId={cat.categoryId}
            totalLabel={cat.name}
            navState={nav}
          />
        ) : (
          <BannerGrid>
            {/* Sub-category icon cards — same style as brand/category icons */}
            {children.map((sc: any) => (
              <BannerCard
                key={sc.categoryId}
                image={sc.categoryImage}
                name={sc.name}
                count={countInCat(sc.categoryId)}
                activeCount={countActiveInCat(sc.categoryId)}
                inactiveCount={countInactiveInCat(sc.categoryId)}
                isActive={sc.isActive !== false}
                badge={sc.isActive === false ? "INACTIVE" : undefined}
                onClick={() =>
                  setNav({
                    view: "products",
                    brand,
                    category: cat,
                    subCategory: sc,
                  })
                }
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  // ── Level 3: products ──────────────────────────────────────────────────────
  const cat = (nav as any).category;
  const sc = (nav as any).subCategory;
  const totalLabel = cat
    ? sc
      ? `${cat.name} › ${sc.name}`
      : cat.name
    : brand.brandName;
  return (
    <div>
      <Breadcrumbs crumbs={crumbs()} />
      <ProductsTable
        brandId={brand.brandId}
        categoryId={sc?.categoryId ?? cat?.categoryId}
        isChildCategory={!!sc}
        totalLabel={totalLabel}
        navState={nav}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BrowseByCategory
// Level 0: all top-level category icons
// Level 1: sub-category icons (if any), else brand icons
// Level 2: brand icons inside category
// Level 3: products table
// ─────────────────────────────────────────────────────────────────────────────
type CatNav =
  | { view: "categories" }
  | { view: "subcategories"; category: any }
  | { view: "brands"; category: any; subCategory?: any }
  | { view: "products"; category: any; subCategory?: any; brand?: any };

function BrowseByCategory() {
  const location = useLocation();
  const [nav, setNav] = useState<CatNav>(() => {
    const restored = location.state?.navState;
    return restored ?? { view: "categories" };
  });
  const { data: catsData, isLoading: catsLoading } = useCategories();
  const { data: brandsData } = useBrands();

  const allCats: any[] = catsData?.list ?? [];
  const allBrands: any[] = brandsData?.list ?? [];

  // Fetch ALL products once for level-0 category counts (active/inactive)
  const { data: allProdsData } = useQuery({
    queryKey: ["all-products-cat-browse"],
    queryFn: () =>
      api
        .get("/Products/", { params: { "Page.Size": 1000, adminView: true } })
        .then((r) => r.data),
    staleTime: 60_000,
  });
  const allProds: any[] = allProdsData?.list ?? [];
  function countActiveForCatGlobal(catId: number) {
    return allProds.filter(
      (p: any) => p.categoryId === catId && p.isActive !== false,
    ).length;
  }
  function countInactiveForCatGlobal(catId: number) {
    return allProds.filter(
      (p: any) => p.categoryId === catId && p.isActive === false,
    ).length;
  }

  const selCat = nav.view !== "categories" ? (nav as any).category : null;
  const selSub =
    nav.view === "brands" || nav.view === "products"
      ? (nav as any).subCategory
      : null;
  const activeCatId = selSub?.categoryId ?? selCat?.categoryId;

  // When showing brands inside a category that has no subCategory selected,
  // we need product counts across the parent AND all its child categories,
  // because products are stored under child-category IDs.
  const activeCatChildIds = useMemo(() => {
    if (!activeCatId || selSub) return []; // subcat already selected — exact match is fine
    return allCats
      .filter((c: any) => Number(c.parentCategoryId) === Number(activeCatId))
      .map((c: any) => c.categoryId);
  }, [activeCatId, selSub, allCats]);

  const catIdsToFetch = activeCatChildIds.length
    ? [activeCatId, ...activeCatChildIds]
    : activeCatId
    ? [activeCatId]
    : [];

  // Fetch products for the active category (+ all children if no subcat selected)
  // so brandsInCat is populated even when products live under subcategory IDs.
  const { data: cpData, isLoading: cpLoading } = useQuery({
    queryKey: ["cat-products-meta", activeCatId, activeCatChildIds],
    enabled: catIdsToFetch.length > 0,
    queryFn: () =>
      api
        .get("/Products/", {
          params: {
            Filters: JSON.stringify(
              catIdsToFetch.map((cid: number) => ({
                property: "categoryId",
                comparison: "eq",
                value: String(cid),
              })),
            ),
            "Page.Size": 1000,
            adminView: true,
          },
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  const catProducts: any[] = cpData?.list ?? [];

  function countActiveInBrand(brandId: number) {
    return catProducts.filter(
      (p: any) => p.brandId === brandId && p.isActive !== false,
    ).length;
  }
  function countInactiveInBrand(brandId: number) {
    return catProducts.filter(
      (p: any) => p.brandId === brandId && p.isActive === false,
    ).length;
  }
  // Active/inactive for a subcategory inside the fetched catProducts
  function countActiveByCat(catId: number) {
    return catProducts.filter(
      (p: any) => p.categoryId === catId && p.isActive !== false,
    ).length;
  }
  function countInactiveByCat(catId: number) {
    return catProducts.filter(
      (p: any) => p.categoryId === catId && p.isActive === false,
    ).length;
  }

  const parentCats = allCats.filter(
    (c: any) => !c.parentCategoryId || c.parentCategoryId === 0,
  );
  function childCats(catId: number) {
    return allCats.filter(
      (c: any) => Number(c.parentCategoryId) === Number(catId),
    );
  }

  const brandIdsInCat = new Set(
    catProducts.map((p: any) => p.brandId).filter(Boolean),
  );
  const brandsInCat = allBrands.filter((b: any) =>
    brandIdsInCat.has(b.brandId),
  );
  function countInBrand(brandId: number) {
    return catProducts.filter((p: any) => p.brandId === brandId).length;
  }

  function crumbs() {
    const out: { label: string; onClick?: () => void }[] = [
      {
        label: "All Categories",
        onClick:
          nav.view !== "categories"
            ? () => setNav({ view: "categories" })
            : undefined,
      },
    ];
    if (nav.view !== "categories") {
      const cat = (nav as any).category;
      out.push({
        label: cat.name,
        onClick:
          nav.view !== "subcategories"
            ? () => {
                const children = childCats(cat.categoryId);
                setNav(
                  children.length > 0
                    ? { view: "subcategories", category: cat }
                    : { view: "brands", category: cat },
                );
              }
            : undefined,
      });
    }
    if (
      (nav.view === "brands" || nav.view === "products") &&
      (nav as any).subCategory
    ) {
      const sc = (nav as any).subCategory;
      out.push({
        label: sc.name,
        onClick:
          nav.view === "products"
            ? () =>
                setNav({
                  view: "brands",
                  category: (nav as any).category,
                  subCategory: sc,
                })
            : undefined,
      });
    }
    if (nav.view === "products" && (nav as any).brand)
      out.push({ label: (nav as any).brand?.brandName });
    return out;
  }

  // Fetch product counts per category (for the category grid badges)
  const { data: catCountData } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: () =>
      api
        .get("/Category/GetCategoryProductCount")
        .then((r) => r.data as { categoryId: number; count: number }[]),
    staleTime: 60_000,
  });
  const catCountMap: Record<number, number> = Object.fromEntries(
    (catCountData || []).map((r: any) => [r.categoryId, r.count]),
  );
  // Sum counts for parent categories (direct + children)
  function countForCat(catId: number): number {
    const direct = catCountMap[catId] ?? 0;
    const children = allCats.filter(
      (c: any) => Number(c.parentCategoryId) === Number(catId),
    );
    const childSum = children.reduce(
      (acc: number, ch: any) => acc + (catCountMap[ch.categoryId] ?? 0),
      0,
    );
    return direct + childSum;
  }
  function countActiveForCat(catId: number): number {
    const direct = countActiveForCatGlobal(catId);
    const children = allCats.filter(
      (c: any) => Number(c.parentCategoryId) === Number(catId),
    );
    return (
      direct +
      children.reduce(
        (acc: number, ch: any) => acc + countActiveForCatGlobal(ch.categoryId),
        0,
      )
    );
  }
  function countInactiveForCat(catId: number): number {
    const direct = countInactiveForCatGlobal(catId);
    const children = allCats.filter(
      (c: any) => Number(c.parentCategoryId) === Number(catId),
    );
    return (
      direct +
      children.reduce(
        (acc: number, ch: any) =>
          acc + countInactiveForCatGlobal(ch.categoryId),
        0,
      )
    );
  }

  // ── Level 0 ───────────────────────────────────────────────────────────────
  if (nav.view === "categories") {
    return catsLoading ? (
      <SkeletonGrid />
    ) : parentCats.length === 0 ? (
      <p className="s-twambrands-1c5031">No categories found.</p>
    ) : (
      <BannerGrid>
        {parentCats.map((cat: any) => (
          <BannerCard
            key={cat.categoryId}
            image={cat.categoryImage}
            name={cat.name}
            count={countForCat(cat.categoryId)}
            activeCount={countActiveForCat(cat.categoryId)}
            inactiveCount={countInactiveForCat(cat.categoryId)}
            isActive={cat.isActive !== false}
            badge={cat.isActive === false ? "INACTIVE" : undefined}
            onClick={() => {
              const children = childCats(cat.categoryId);
              setNav(
                children.length > 0
                  ? { view: "subcategories", category: cat }
                  : { view: "brands", category: cat },
              );
            }}
          />
        ))}
      </BannerGrid>
    );
  }

  // ── Level 1: sub-categories ───────────────────────────────────────────────
  if (nav.view === "subcategories") {
    const cat = (nav as any).category;
    const children = childCats(cat.categoryId);
    const catTotal = countForCat(cat.categoryId);
    const catActive = countActiveForCat(cat.categoryId);
    const catInactive = countInactiveForCat(cat.categoryId);
    return (
      <div>
        <Breadcrumbs crumbs={crumbs()} />
        {children.length === 0 ? (
          <p className="s-twambrands-1c5031">No sub-categories.</p>
        ) : (
          <BannerGrid>
            {/* "All Products in Category" shortcut card */}
            <AllProductsCard
              label={`All ${cat.name} Products`}
              count={catTotal}
              activeCount={catActive}
              inactiveCount={catInactive}
              onClick={() =>
                setNav({ view: "products", category: cat, brand: undefined })
              }
            />
            {children.map((sc: any) => (
              <BannerCard
                key={sc.categoryId}
                image={sc.categoryImage}
                name={sc.name}
                count={catCountMap[sc.categoryId] ?? 0}
                activeCount={countActiveForCatGlobal(sc.categoryId)}
                inactiveCount={countInactiveForCatGlobal(sc.categoryId)}
                isActive={sc.isActive !== false}
                badge={sc.isActive === false ? "INACTIVE" : undefined}
                onClick={() =>
                  setNav({ view: "brands", category: cat, subCategory: sc })
                }
              />
            ))}
          </BannerGrid>
        )}
      </div>
    );
  }

  // ── Level 2: brands inside category ──────────────────────────────────────
  if (nav.view === "brands") {
    const cat = (nav as any).category;
    const scItem = (nav as any).subCategory;
    const catTotal = catProducts.length;
    const catActive = catProducts.filter(
      (p: any) => p.isActive !== false,
    ).length;
    const catInactive = catProducts.filter(
      (p: any) => p.isActive === false,
    ).length;
    const levelLabel = scItem?.name ?? cat.name;
    return (
      <div>
        <Breadcrumbs crumbs={crumbs()} />
        {cpLoading ? (
          <SkeletonGrid />
        ) : brandsInCat.length === 0 ? (
          // No brands found — show products directly
          <ProductsTable
            categoryId={activeCatId}
            totalLabel={levelLabel}
            navState={nav}
          />
        ) : (
          <BannerGrid>
            {/* "All Products in SubCat/Category" shortcut card */}
            <AllProductsCard
              label={`All ${levelLabel} Products`}
              count={catTotal}
              activeCount={catActive}
              inactiveCount={catInactive}
              onClick={() =>
                setNav({
                  view: "products",
                  category: cat,
                  subCategory: scItem,
                  brand: undefined,
                })
              }
            />
            {brandsInCat.map((b: any) => (
              <BannerCard
                key={b.brandId}
                image={b.brandImage}
                name={b.brandName}
                count={countInBrand(b.brandId)}
                activeCount={countActiveInBrand(b.brandId)}
                inactiveCount={countInactiveInBrand(b.brandId)}
                isActive={b.isActive !== false}
                badge={
                  b.deletedInd
                    ? "DELETED"
                    : b.isActive === false
                    ? "HIDDEN"
                    : undefined
                }
                onClick={() =>
                  setNav({
                    view: "products",
                    category: cat,
                    subCategory: scItem,
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

  // ── Level 3: products ─────────────────────────────────────────────────────
  const cat = (nav as any).category;
  const scItem = (nav as any).subCategory;
  const brand = (nav as any).brand;
  const levelLabel = scItem?.name ?? cat.name;
  const totalLabel = brand ? `${levelLabel} › ${brand.brandName}` : levelLabel;
  return (
    <div>
      <Breadcrumbs crumbs={crumbs()} />
      <ProductsTable
        brandId={brand?.brandId}
        categoryId={activeCatId}
        totalLabel={totalLabel}
        navState={nav}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchBar + SearchResults (name/code only — stockId navigates directly)
// ─────────────────────────────────────────────────────────────────────────────
type SearchMode = "nameCode" | "stockId";

// Name/Code results — renders product cards
function NameCodeResults({
  term,
  onClear,
}: {
  term: string;
  onClear: () => void;
}) {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product-search-name", term],
    queryFn: () =>
      api
        .get("/Products/Search", { params: { q: term, "Page.Size": 60 } })
        .then((r) => r.data),
    enabled: !!term,
    staleTime: 10_000,
  });

  const toggleProduct = useMutation({
    mutationFn: (id: number) => api.patch(`/Products/${id}/toggle-active`),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["product-search-name", term] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const products: any[] = data?.list ?? [];
  const total: number = data?.count ?? 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: PRIMARY_LT,
              border: `1.5px solid ${PRIMARY}`,
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: PRIMARY,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-search" />"{term}"
          </span>
          {!isLoading && (
            <span style={{ fontSize: 13, color: SUB }}>
              {total === 0
                ? "No products found"
                : `${total} product${total !== 1 ? "s" : ""} matched`}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          style={{
            background: "none",
            border: `1.5px solid ${BORDER}`,
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: SUB,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="bi bi-x-lg" /> Clear search
        </button>
      </div>

      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <AdminProductCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "#c62828",
            fontSize: 14,
          }}
        >
          <i
            className="bi bi-exclamation-circle"
            style={{ fontSize: 32, display: "block", marginBottom: 10 }}
          />
          Search failed — please try again.
        </div>
      ) : products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: SUB,
            fontSize: 14,
          }}
        >
          <i
            className="bi bi-search"
            style={{
              fontSize: 38,
              display: "block",
              marginBottom: 14,
              opacity: 0.35,
            }}
          />
          <div style={{ fontWeight: 700, marginBottom: 6, color: TXT }}>
            No results for "{term}"
          </div>
          <div style={{ fontSize: 13 }}>
            Try a different product name or code.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {products.map((p: any) => (
            <AdminProductCard
              key={p.productId}
              product={p}
              onToggle={(id) => toggleProduct.mutate(id)}
              onDelete={() => {}}
              toggleLoading={toggleProduct.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminProducts (main)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminProducts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isStoreManager = (user as any)?.roleId === 4 || (user as any)?.roleId === 7;
  const [browseKey, setBrowseKey] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>("nameCode");
  const [inputVal, setInputVal] = useState("");
  const [activeSearch, setActiveSearch] = useState<{
    mode: SearchMode;
    term: string;
  } | null>(null);
  const [stockIdSearching, setStockIdSearching] = useState(false);
  const [stockIdError, setStockIdError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleBrowseChange() {
    setBrowseKey((k) => k + 1);
  }

  async function triggerSearch() {
    const term = inputVal.trim();
    if (!term) return;

    if (searchMode === "stockId") {
      // Stock ID → look up PVD and navigate directly to product detail
      setStockIdSearching(true);
      setStockIdError(null);
      try {
        const res = await api.get("/ProductVariantDetail/FindByStockId", {
          params: { stockId: term },
        });
        const hit = res.data;
        // Navigate to the product detail page, passing highlight state
        navigate(`/admin/products/${hit.productId}`, {
          state: {
            highlightVariantId: hit.productVariantId,
            highlightSizeId: hit.sizeId,
            highlightCupSizeId: hit.cupSizeId,
            highlightStockId: hit.stockId,
            highlightPvdId: hit.productVariantDetailId,
          },
        });
      } catch (err: any) {
        const msg =
          err?.response?.status === 404
            ? `No variant found with Stock ID "${term}"`
            : "Search failed — please try again.";
        setStockIdError(msg);
      } finally {
        setStockIdSearching(false);
      }
      return;
    }

    // Name/code mode — show results inline
    setActiveSearch({ mode: searchMode, term });
  }

  function clearSearch() {
    setActiveSearch(null);
    setStockIdError(null);
    setInputVal("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") triggerSearch();
    if (e.key === "Escape") clearSearch();
  }

  function handleModeChange(m: SearchMode) {
    setSearchMode(m);
    setActiveSearch(null);
    setStockIdError(null);
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const placeholder =
    searchMode === "nameCode"
      ? "Search by product name or code…"
      : "Enter Stock ID to open that variant directly…";

  return (
    <div>
      {/* Header */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Products</h2>
          <p className="s-adminblog-1c2c10">
            Browse and manage products by brand
          </p>
        </div>
        {!isStoreManager && (
          <button
            className="s-adminproduct-1f0204"
            onClick={() => navigate("/admin/products/new")}
          >
            <i className="bi bi-plus-lg" /> Create New Product
          </button>
        )}
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${BORDER}`,
          background: "#fdfaf8",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* Mode toggle pills */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: 10,
              border: `1.5px solid ${BORDER}`,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {(
              [
                { value: "nameCode", icon: "bi-tag", label: "Name / Code" },
                { value: "stockId", icon: "bi-box-seam", label: "Stock ID" },
              ] as { value: SearchMode; icon: string; label: string }[]
            ).map(({ value, icon, label }) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: searchMode === value ? PRIMARY : "#fff",
                  color: searchMode === value ? "#fff" : SUB,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                <i className={`bi ${icon}`} />
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <i
              className="bi bi-search"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: SUB,
                fontSize: 13,
                pointerEvents: "none",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                setStockIdError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={stockIdSearching}
              style={{
                width: "100%",
                padding: "9px 40px 9px 36px",
                fontSize: 13,
                border: `1.5px solid ${
                  stockIdError ? "#ef9a9a" : activeSearch ? PRIMARY : BORDER
                }`,
                borderRadius: 9,
                outline: "none",
                boxSizing: "border-box",
                background: stockIdSearching ? "#f5f5f5" : "#fff",
                color: TXT,
                transition: "border-color 0.15s",
              }}
            />
            {inputVal && !stockIdSearching && (
              <button
                onClick={clearSearch}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: SUB,
                  fontSize: 14,
                  padding: 2,
                }}
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={triggerSearch}
            disabled={!inputVal.trim() || stockIdSearching}
            style={{
              background:
                inputVal.trim() && !stockIdSearching ? PRIMARY : "#e0d6d0",
              color: inputVal.trim() && !stockIdSearching ? "#fff" : "#b0a8a3",
              border: "none",
              borderRadius: 9,
              padding: "9px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor:
                inputVal.trim() && !stockIdSearching ? "pointer" : "default",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              transition: "background 0.15s",
              flexShrink: 0,
              minWidth: 100,
              justifyContent: "center",
            }}
          >
            {stockIdSearching ? (
              <>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Searching…
              </>
            ) : (
              <>
                <i
                  className={`bi ${
                    searchMode === "stockId"
                      ? "bi-box-arrow-in-right"
                      : "bi-search"
                  }`}
                />
                {searchMode === "stockId" ? "Open" : "Search"}
              </>
            )}
          </button>

          {/* Inline hint / error for stockId mode */}
          {searchMode === "stockId" &&
            !stockIdError &&
            !stockIdSearching &&
            !activeSearch && (
              <span
                style={{ fontSize: 11, color: "#c0b8b2", whiteSpace: "nowrap" }}
              >
                Finds the exact variant &amp; size — opens the product page
                directly
              </span>
            )}
        </div>

        {/* Stock ID error message */}
        {stockIdError && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: "#fdecea",
              border: "1px solid #ef9a9a",
              borderRadius: 9,
              fontSize: 13,
              color: "#c62828",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i className="bi bi-exclamation-circle-fill" />
            {stockIdError}
          </div>
        )}

        {/* CSS for spinner */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="s-adminbrands-a637bc" style={{ padding: "24px 28px" }}>
        {activeSearch && activeSearch.mode === "nameCode" ? (
          <NameCodeResults
            key={activeSearch.term}
            term={activeSearch.term}
            onClear={clearSearch}
          />
        ) : (
          <BrowseByBrand key={`brands-${browseKey}`} />
        )}
      </div>
    </div>
  );
}
