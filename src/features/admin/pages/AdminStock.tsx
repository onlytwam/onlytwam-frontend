/**
 * AdminStock.tsx — v2
 * Stock Management Page with:
 *  - Auto-seed on mount (silent, no button)
 *  - 📋 Global History button — all product lifecycle events (newest first)
 *  - 🕐 Per-product History button — full audit trail for one product
 *  - Stock change history per-PVD with source badges
 *  - DB_CHANGE auto-detection and alert banner
 *  - Search by Product Name, Product Code, OR Stock ID
 *
 * Stock authority:
 *   Admin (Stock Page) — full control
 *   order_system       — processes ORDER_PROCESSED / ORDER_RETURNED
 *   ProductDetail      — Total Stock only
 *   db_direct          — detected → shown as ⚠️ DB_CHANGE alert
 *   INITIAL_STOCK      — hidden from history UI (system bootstrap)
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = "#7A1E2C";
const PLT = "#F5E9E6";
const BDR = "#E6DAD3";
const GRY = "#F3EFEC";
const TXT = "#2B2B2B";
const SUB = "#8A7F7A";
const BG = "#FAF7F4";
const WHITE = "#ffffff";

// ─── Size display helper ─────────────────────────────────────────────────────
function fmtSize(
  band: string | null | undefined,
  cup: string | null | undefined,
): string {
  const b = (band || "").trim();
  const c = (cup || "").trim();
  if (b && c) return `${b}${c}`; // "32B"
  return b || c || "";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Backend always returns full URLs — no construction needed
function imgUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/assets")) return src;
  return "";
}

function fmtDateFull(iso: string | null | undefined): {
  dayName: string;
  date: string;
  time: string;
  relative: string;
} {
  if (!iso) return { dayName: "—", date: "—", time: "—", relative: "" };
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  return {
    dayName: d.toLocaleDateString("en-IN", { weekday: "long" }),
    date: d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    relative:
      min < 1
        ? "just now"
        : min < 60
        ? `${min}m ago`
        : hr < 24
        ? `${hr}h ago`
        : day === 1
        ? "yesterday"
        : day < 7
        ? `${day}d ago`
        : "",
  };
}

// ─── Change-type metadata ─────────────────────────────────────────────────────
const CHANGE_META: Record<
  string,
  { color: string; bg: string; label: string; icon: string }
> = {
  TOTAL_STOCK: {
    color: "#1565c0",
    bg: "#e3f2fd",
    label: "Total Stock",
    icon: "📦",
  },
  PROCESSED: {
    color: "#6a1b9a",
    bg: "#f3e5f5",
    label: "Processed",
    icon: "🔄",
  },
  RETURNED: { color: "#795548", bg: "#efebe9", label: "Returned", icon: "↩️" },
  AVAILABLE: {
    color: "#2e7d32",
    bg: "#e8f5e9",
    label: "Available",
    icon: "✅",
  },
  ORDER_PROCESSED: {
    color: "#0277bd",
    bg: "#e1f5fe",
    label: "Order Processed",
    icon: "🛒",
  },
  ORDER_RETURNED: {
    color: "#6d4c41",
    bg: "#efebe9",
    label: "Order Returned",
    icon: "↩️",
  },
  DB_CHANGE: {
    color: "#b71c1c",
    bg: "#ffebee",
    label: "⚠️ Direct DB Change",
    icon: "🚨",
  },
  INITIAL_STOCK: {
    color: "#e65100",
    bg: "#fff3e0",
    label: "Initial Stock",
    icon: "📋",
  },
};
const getMeta = (ct: string) =>
  CHANGE_META[ct] ?? {
    color: SUB,
    bg: GRY,
    label: ct.replace(/_/g, " "),
    icon: "•",
  };

function srcLabel(
  changedBy: string | null,
  entries: any[],
): { text: string; color: string; bg: string } {
  if (entries.some((e) => e.changeType === "DB_CHANGE"))
    return { text: "⚠️ Direct DB Edit", color: "#b71c1c", bg: "#ffebee" };
  const cb = (changedBy ?? "").toLowerCase();
  if (cb === "order_system")
    return { text: "🛒 Order System", color: "#0277bd", bg: "#e1f5fe" };
  if (cb === "productdetail")
    return { text: "📝 Product Detail", color: "#6a1b9a", bg: "#f3e5f5" };
  if (cb === "admin")
    return { text: "👤 Admin (Stock Page)", color: "#2e7d32", bg: "#e8f5e9" };
  if (cb === "system" || cb === "db_direct")
    return { text: "⚙️ System", color: "#e65100", bg: "#fff3e0" };
  return { text: `👤 ${changedBy ?? "Unknown"}`, color: SUB, bg: GRY };
}

// ─── Audit event metadata (for product history) ───────────────────────────────
const AUDIT_META: Record<string, { color: string; bg: string; icon: string }> =
  {
    PRODUCT_CREATED: { color: "#2e7d32", bg: "#e8f5e9", icon: "🆕" },
    PRODUCT_DELETED: { color: "#c62828", bg: "#fdecea", icon: "🗑️" },
    PRODUCT_UPDATED: { color: "#1565c0", bg: "#e3f2fd", icon: "✏️" },
    VARIANT_ADDED: { color: "#7b1fa2", bg: "#f3e5f5", icon: "🎨" },
    VARIANT_DELETED: { color: "#c62828", bg: "#fdecea", icon: "🎨🗑️" },
    SIZE_ADDED: { color: "#0277bd", bg: "#e1f5fe", icon: "📐" },
    SIZE_DELETED: { color: "#c62828", bg: "#fdecea", icon: "📐🗑️" },
    STOCK_UPDATED: { color: "#1565c0", bg: "#e3f2fd", icon: "📦" },
  };
const getAuditMeta = (et: string) =>
  AUDIT_META[et] ?? { color: SUB, bg: GRY, icon: "•" };

// ─── Log grouping (for PVD stock history) ────────────────────────────────────
interface LogGroup {
  sessionTime: string;
  changedBy: string | null;
  note: string | null;
  entries: any[];
  snapshot: {
    totalStock: number | null;
    processedQuantity: number | null;
    returnedQuantity: number | null;
    availableQuantity: number | null;
  };
}
function groupLogs(logs: any[]): LogGroup[] {
  const visible = logs.filter((l) => l.changeType !== "INITIAL_STOCK");
  if (!visible.length) return [];
  const sorted = [...visible].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );
  const groups: LogGroup[] = [];
  let cur: any[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(
      new Date(sorted[i - 1].createdDate).getTime() -
        new Date(sorted[i].createdDate).getTime(),
    );
    if (
      diff < 10000 &&
      sorted[i - 1].changedBy === sorted[i].changedBy &&
      sorted[i - 1].note === sorted[i].note
    ) {
      cur.push(sorted[i]);
    } else {
      groups.push(buildGroup(cur));
      cur = [sorted[i]];
    }
  }
  groups.push(buildGroup(cur));
  return groups;
}
function buildGroup(entries: any[]): LogGroup {
  const newest = entries.reduce((a, b) =>
    new Date(a.createdDate) > new Date(b.createdDate) ? a : b,
  );
  const snap = entries[0];
  return {
    sessionTime: newest.createdDate,
    changedBy: newest.changedBy ?? null,
    note: newest.note ?? null,
    entries,
    snapshot: {
      totalStock: snap.totalStock,
      processedQuantity: snap.processedQuantity,
      returnedQuantity: snap.returnedQuantity,
      availableQuantity: snap.availableQuantity,
    },
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function Pill({
  val,
  color,
  bg,
  label,
}: {
  val: number;
  color: string;
  bg: string;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: SUB,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color,
          background: bg,
          borderRadius: 7,
          padding: "4px 12px",
          minWidth: 42,
          textAlign: "center",
        }}
      >
        {val ?? 0}
      </span>
    </div>
  );
}
function StatusBadge({ pvd }: { pvd: any }) {
  const avail = pvd.availableQuantity ?? 0;
  if (avail <= 0)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#c62828",
          background: "#fdecea",
          borderRadius: 20,
          padding: "2px 8px",
        }}
      >
        Out of Stock
      </span>
    );
  if (avail <= 3)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#e65100",
          background: "#fff3e0",
          borderRadius: 20,
          padding: "2px 8px",
        }}
      >
        Low Stock
      </span>
    );
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#2e7d32",
        background: "#e8f5e9",
        borderRadius: 20,
        padding: "2px 8px",
      }}
    >
      In Stock
    </span>
  );
}

// ─── Unified event renderer helpers ──────────────────────────────────────────
const LIFECYCLE_META: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  PRODUCT_CREATED: {
    color: "#2e7d32",
    bg: "#e8f5e9",
    icon: "🆕",
    label: "Product Created",
  },
  PRODUCT_DELETED: {
    color: "#c62828",
    bg: "#fdecea",
    icon: "🗑️",
    label: "Product Deleted",
  },
  PRODUCT_UPDATED: {
    color: "#1565c0",
    bg: "#e3f2fd",
    icon: "✏️",
    label: "Product Updated",
  },
  VARIANT_ADDED: {
    color: "#7b1fa2",
    bg: "#f3e5f5",
    icon: "🎨",
    label: "Variant Added",
  },
  VARIANT_DELETED: {
    color: "#c62828",
    bg: "#fdecea",
    icon: "🎨",
    label: "Variant Deleted",
  },
  SIZE_ADDED: {
    color: "#0277bd",
    bg: "#e1f5fe",
    icon: "📐",
    label: "Size Added",
  },
  SIZE_DELETED: {
    color: "#c62828",
    bg: "#fdecea",
    icon: "📐",
    label: "Size Deleted",
  },
  STOCK_UPDATED: {
    color: "#1565c0",
    bg: "#e3f2fd",
    icon: "📦",
    label: "Stock Updated",
  },
};
const STOCK_META: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  TOTAL_STOCK: {
    color: "#1565c0",
    bg: "#e3f2fd",
    icon: "📦",
    label: "Total Stock",
  },
  PROCESSED: {
    color: "#6a1b9a",
    bg: "#f3e5f5",
    icon: "🔄",
    label: "Processed",
  },
  RETURNED: { color: "#795548", bg: "#efebe9", icon: "↩️", label: "Returned" },
  ORDER_PROCESSED: {
    color: "#0277bd",
    bg: "#e1f5fe",
    icon: "🛒",
    label: "Order Processed",
  },
  ORDER_RETURNED: {
    color: "#6d4c41",
    bg: "#efebe9",
    icon: "↩️",
    label: "Order Returned",
  },
  DB_CHANGE: {
    color: "#b71c1c",
    bg: "#ffebee",
    icon: "🚨",
    label: "⚠️ DB Change",
  },
  INITIAL_STOCK: {
    color: "#e65100",
    bg: "#fff3e0",
    icon: "📋",
    label: "Initial Stock",
  },
};

function getEventMeta(e: any) {
  if (e.eventCategory === "lifecycle")
    return (
      LIFECYCLE_META[e.eventType] ?? {
        color: SUB,
        bg: GRY,
        icon: "•",
        label: e.eventType?.replace(/_/g, " ") ?? "Event",
      }
    );
  return (
    STOCK_META[e.eventType] ?? {
      color: SUB,
      bg: GRY,
      icon: "📊",
      label: e.eventType?.replace(/_/g, " ") ?? "Stock",
    }
  );
}

function srcBadge(e: any): { text: string; color: string; bg: string } {
  if (e.eventType === "DB_CHANGE")
    return { text: "⚠️ Direct DB Edit", color: "#b71c1c", bg: "#ffebee" };
  const cb = (e.changedBy ?? e.eventSource ?? "").toLowerCase();
  if (cb === "order_system")
    return { text: "🛒 Order System", color: "#0277bd", bg: "#e1f5fe" };
  if (cb === "productdetail")
    return { text: "📝 Product Detail", color: "#6a1b9a", bg: "#f3e5f5" };
  if (cb === "admin")
    return { text: "👤 Admin (Stock Page)", color: "#2e7d32", bg: "#e8f5e9" };
  if (cb === "system" || cb === "db_direct")
    return { text: "⚙️ System", color: "#e65100", bg: "#fff3e0" };
  if (cb === "bulkupload")
    return { text: "📤 Bulk Upload", color: "#00695c", bg: "#e0f2f1" };
  if (e.eventSource === "ProductDetail")
    return { text: "📝 Product Detail", color: "#6a1b9a", bg: "#f3e5f5" };
  if (e.eventSource === "BulkUpload")
    return { text: "📤 Bulk Upload", color: "#00695c", bg: "#e0f2f1" };
  return {
    text: `👤 ${e.changedBy ?? e.eventSource ?? "System"}`,
    color: SUB,
    bg: GRY,
  };
}

// Compact card for the global history (dense, paginated list)
function EventCardCompact({ e }: { e: any }) {
  const meta = getEventMeta(e);
  const src = srcBadge(e);
  const dt = fmtDateFull(e.createdDate);
  const isDbChange = e.eventType === "DB_CHANGE";

  return (
    <div
      style={{
        border: `1px solid ${isDbChange ? "#f87171" : BDR}`,
        borderRadius: 10,
        background: isDbChange ? "#fff5f5" : WHITE,
        borderLeft: `4px solid ${meta.color}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "9px 12px",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>
          {meta.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type + source badges */}
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: meta.color,
                background: meta.bg,
                borderRadius: 20,
                padding: "2px 7px",
                whiteSpace: "nowrap",
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: src.color,
                background: src.bg,
                borderRadius: 20,
                padding: "2px 7px",
                whiteSpace: "nowrap",
              }}
            >
              {src.text}
            </span>
          </div>
          {/* Description */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: TXT,
              marginBottom: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {e.description || "—"}
          </div>
          {/* Context pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {e.productCode && (
              <span
                style={{
                  fontSize: 10,
                  color: SUB,
                  fontFamily: "monospace",
                  background: GRY,
                  borderRadius: 4,
                  padding: "1px 5px",
                  border: `1px solid ${BDR}`,
                }}
              >
                {e.productCode}
              </span>
            )}
            {e.variantName && (
              <span
                style={{
                  fontSize: 10,
                  color: "#7b1fa2",
                  background: "#f3e5f5",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                {e.variantName}
              </span>
            )}
            {e.sizeLabel && (
              <span
                style={{
                  fontSize: 10,
                  color: "#0277bd",
                  background: "#e1f5fe",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                {e.sizeLabel}
              </span>
            )}
            {e.stockId && (
              <span
                style={{
                  fontSize: 10,
                  color: "#5d4037",
                  background: "#efebe9",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontFamily: "monospace",
                }}
              >
                #{e.stockId}
              </span>
            )}
          </div>
          {/* Stock change pill (for stock events) */}
          {e.eventCategory === "stock" &&
            e.previousValue !== null &&
            e.newValue !== null && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#888",
                    background: WHITE,
                    borderRadius: 4,
                    padding: "1px 6px",
                    border: `1px solid ${BDR}`,
                    fontWeight: 700,
                  }}
                >
                  {e.previousValue ?? "—"}
                </span>
                <span style={{ color: SUB, fontSize: 11 }}>→</span>
                <span
                  style={{
                    fontSize: 11,
                    color: meta.color,
                    background: meta.bg,
                    borderRadius: 4,
                    padding: "1px 6px",
                    border: `1.5px solid ${meta.color}`,
                    fontWeight: 700,
                  }}
                >
                  {e.newValue ?? "—"}
                </span>
                {(() => {
                  const d = (e.newValue ?? 0) - (e.previousValue ?? 0);
                  return d !== 0 ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: d > 0 ? "#2e7d32" : "#c62828",
                        background: d > 0 ? "#e8f5e9" : "#fdecea",
                        borderRadius: 20,
                        padding: "1px 6px",
                      }}
                    >
                      {d > 0 ? `+${d}` : d}
                    </span>
                  ) : null;
                })()}
              </div>
            )}
        </div>
        {/* Time */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P }}>
            {dt.time}
          </div>
          <div style={{ fontSize: 10, color: SUB }}>{dt.date}</div>
          {dt.relative && (
            <div
              style={{
                fontSize: 9,
                color: WHITE,
                background: SUB,
                borderRadius: 20,
                padding: "1px 5px",
                marginTop: 2,
                display: "inline-block",
              }}
            >
              {dt.relative}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Full card for per-product history (expanded details)
function EventCardFull({ e, isOrigin }: { e: any; isOrigin?: boolean }) {
  const meta = getEventMeta(e);
  const dt = fmtDateFull(e.createdDate);
  const isStock = e.eventCategory === "stock";
  const isDbChange = e.eventType === "DB_CHANGE";
  const delta = isStock ? (e.newValue ?? 0) - (e.previousValue ?? 0) : null;

  return (
    <div
      style={{
        border: `1.5px solid ${
          isDbChange ? "#f87171" : isOrigin ? "#c8e6c9" : BDR
        }`,
        borderRadius: 12,
        background: isDbChange ? "#fff5f5" : isOrigin ? "#f0fff4" : WHITE,
        borderLeft: `4px solid ${meta.color}`,
        overflow: "hidden",
      }}
    >
      {/* ── Header: event type badge + description ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 14px 8px",
          background: isDbChange ? "#fff0f0" : isOrigin ? "#f0fff4" : GRY,
          borderBottom: `1px solid ${BDR}`,
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>
          {meta.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              marginBottom: 4,
              alignItems: "center",
            }}
          >
            {/* Event type */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: meta.color,
                background: meta.bg,
                borderRadius: 20,
                padding: "2px 9px",
              }}
            >
              {meta.label}
            </span>
            {isOrigin && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#2e7d32",
                  background: "#dcfce7",
                  borderRadius: 20,
                  padding: "2px 8px",
                }}
              >
                🌱 Origin
              </span>
            )}
          </div>
          {/* Description */}
          <div style={{ fontSize: 12, fontWeight: 700, color: TXT }}>
            {e.description || "—"}
          </div>
        </div>
      </div>

      {/* ── Context row: variant / size / stock-id pills ── */}
      {(e.variantName ||
        e.sizeLabel ||
        e.stockId ||
        (e.productCode && !isStock)) && (
        <div
          style={{
            padding: "7px 14px 0",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {e.variantName && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#7b1fa2",
                background: "#f3e5f5",
                borderRadius: 5,
                padding: "2px 8px",
              }}
            >
              🎨 {e.variantName}
            </span>
          )}
          {e.sizeLabel && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#0277bd",
                background: "#e1f5fe",
                borderRadius: 5,
                padding: "2px 8px",
              }}
            >
              📐 {e.sizeLabel}
            </span>
          )}
          {e.stockId && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#5d4037",
                background: "#efebe9",
                borderRadius: 5,
                padding: "2px 8px",
              }}
            >
              #{e.stockId}
            </span>
          )}
          {e.productCode && !isStock && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: SUB,
                background: GRY,
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {e.productCode}
            </span>
          )}
        </div>
      )}

      {/* ── Stock change block ── */}
      {isStock && (
        <div
          style={{
            margin: "8px 14px 0",
            padding: "10px 12px",
            background: GRY,
            borderRadius: 10,
            border: `1px solid ${BDR}`,
          }}
        >
          {/* Before → After + delta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#888",
                background: WHITE,
                borderRadius: 6,
                padding: "2px 10px",
                border: `1px solid ${BDR}`,
              }}
            >
              {e.previousValue ?? "—"}
            </span>
            <span style={{ fontSize: 14, color: SUB }}>→</span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: meta.color,
                background: meta.bg,
                borderRadius: 6,
                padding: "2px 10px",
                border: `1.5px solid ${meta.color}`,
              }}
            >
              {e.newValue ?? "—"}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: delta > 0 ? "#2e7d32" : "#c62828",
                  background: delta > 0 ? "#e8f5e9" : "#fdecea",
                  borderRadius: 20,
                  padding: "2px 8px",
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
          {/* Snapshot */}
          {(e.totalStock !== null ||
            e.processedQuantity !== null ||
            e.returnedQuantity !== null ||
            e.availableQuantity !== null) && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 5,
                }}
              >
                Stock Snapshot After Change
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { l: "Total", v: e.totalStock, c: "#1565c0", b: "#e3f2fd" },
                  {
                    l: "Processed",
                    v: e.processedQuantity,
                    c: "#6a1b9a",
                    b: "#f3e5f5",
                  },
                  {
                    l: "Returned",
                    v: e.returnedQuantity,
                    c: "#795548",
                    b: "#efebe9",
                  },
                  {
                    l: "Available",
                    v: e.availableQuantity,
                    c: "#2e7d32",
                    b: "#e8f5e9",
                  },
                ]
                  .filter((x) => x.v !== null && x.v !== undefined)
                  .map(({ l, v, c, b }) => (
                    <div
                      key={l}
                      style={{ display: "flex", alignItems: "center", gap: 3 }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: SUB,
                          textTransform: "uppercase",
                        }}
                      >
                        {l}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: c,
                          background: b,
                          borderRadius: 4,
                          padding: "1px 7px",
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* Note */}
          {e.note && e.note !== e.description && (
            <div
              style={{
                marginTop: 6,
                padding: "5px 8px",
                background: "#fffbf0",
                border: "1px solid #ffe082",
                borderRadius: 6,
                fontSize: 11,
                color: TXT,
                fontStyle: "italic",
              }}
            >
              💬 {e.note}
            </div>
          )}
        </div>
      )}

      {/* Stock before/after for lifecycle SIZE_ADDED */}
      {!isStock && e.stockBefore !== null && e.stockAfter !== null && (
        <div
          style={{
            margin: "6px 14px 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
          }}
        >
          <span style={{ color: SUB }}>Stock:</span>
          <span
            style={{
              fontWeight: 800,
              color: "#888",
              background: WHITE,
              borderRadius: 4,
              padding: "1px 6px",
              border: `1px solid ${BDR}`,
            }}
          >
            {e.stockBefore ?? "—"}
          </span>
          <span style={{ color: SUB }}>→</span>
          <span
            style={{
              fontWeight: 800,
              color: "#1565c0",
              background: "#e3f2fd",
              borderRadius: 4,
              padding: "1px 6px",
              border: "1.5px solid #1565c0",
            }}
          >
            {e.stockAfter ?? "—"}
          </span>
        </div>
      )}

      {/* ── Footer: username + role + day / date / time ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          marginTop: 6,
          borderTop: `1px solid ${BDR}`,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {/* Left: who */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i
            className="bi bi-person-circle"
            style={{ color: meta.color, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: TXT }}>
            {e.changedBy || "—"}
          </span>
          {e.role && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: P,
                background: PLT,
                borderRadius: 20,
                padding: "1px 7px",
                border: `1px solid ${BDR}`,
              }}
            >
              {e.role}
            </span>
          )}
        </div>
        {/* Right: day · date · time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: TXT }}>
            {dt.dayName}
          </span>
          <span style={{ fontSize: 11, color: SUB }}>{dt.date}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: P }}>
            🕐 {dt.time}
          </span>
          {dt.relative && (
            <span
              style={{
                fontSize: 9,
                color: WHITE,
                background: SUB,
                borderRadius: 20,
                padding: "1px 6px",
              }}
            >
              {dt.relative}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mod event type meta ─────────────────────────────────────────────────────
const MOD_META: Record<string, { icon: string; color: string; bg: string }> = {
  PRODUCT_UPDATED: { icon: "✏️", color: "#1565c0", bg: "#e3f2fd" },
  VARIANT_ADDED: { icon: "🎨", color: "#7b1fa2", bg: "#f3e5f5" },
  VARIANT_DELETED: { icon: "🎨", color: "#c62828", bg: "#fdecea" },
  SIZE_ADDED: { icon: "📐", color: "#0277bd", bg: "#e1f5fe" },
  SIZE_DELETED: { icon: "📐", color: "#c62828", bg: "#fdecea" },
};
function modMeta(et: string) {
  return MOD_META[et] ?? { icon: "✏️", color: "#1565c0", bg: "#e3f2fd" };
}

// ─── Global History Modal — product directory ─────────────────────────────────
// Each product shows: image thumbnail, name, code.
// Click to expand: creation (day/date/time, by who + role) + modification log.
// "View on Stock Page" button navigates to that product's stock detail.
function GlobalHistoryPage({
  onBack,
  onOpenProductHistory,
}: {
  onBack: () => void;
  onOpenProductHistory: (p: {
    productId: number;
    name: string;
    productCode: string;
  }) => void;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const SIZE = 30;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function load(p: number, q: string) {
    setLoading(true);
    try {
      const res = await api.get("/StockLog/product-directory", {
        params: { page: p, size: SIZE, search: q },
      });
      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(page, debSearch);
  }, [page, debSearch]);
  const totalPages = Math.ceil(total / SIZE);

  function buildVariantTree(mods: any[]) {
    const tree = new Map<string, { variantRow: any | null; sizeRows: any[] }>();
    const productLevel: any[] = [];
    for (const mod of mods) {
      if (mod.eventType === "PRODUCT_UPDATED") {
        productLevel.push(mod);
        continue;
      }
      const parts = (mod.context || "").split(" / ");
      const vname = parts[0].trim() || "(no variant)";
      if (!tree.has(vname)) tree.set(vname, { variantRow: null, sizeRows: [] });
      const entry = tree.get(vname)!;
      if (
        mod.eventType === "VARIANT_ADDED" ||
        mod.eventType === "VARIANT_DELETED"
      ) {
        entry.variantRow = mod;
      } else {
        entry.sizeRows.push(mod);
      }
    }
    return { tree, productLevel };
  }

  const EVENT_LABEL: Record<string, string> = {
    VARIANT_ADDED: "Variant Added",
    VARIANT_DELETED: "Variant Deleted",
    SIZE_ADDED: "Size Added",
    SIZE_DELETED: "Size Removed",
    PRODUCT_UPDATED: "Product Updated",
  };
  const EVENT_COLOR: Record<string, string> = {
    VARIANT_ADDED: "#6A1B9A",
    VARIANT_DELETED: "#8B0000",
    SIZE_ADDED: "#0A4F8A",
    SIZE_DELETED: "#8B0000",
    PRODUCT_UPDATED: "#1A5C1A",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F0E6",
        fontFamily: "inherit",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          background: WHITE,
          borderBottom: `1.5px solid ${BDR}`,
          padding: "14px 28px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: `1.5px solid ${BDR}`,
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            color: TXT,
          }}
        >
          <i className="bi bi-arrow-left" /> Back to Stock
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TXT }}>
            Product History
          </h1>
          <div style={{ fontSize: 12, color: SUB }}>
            {total} product{total !== 1 ? "s" : ""} · creation & modification
            log
          </div>
        </div>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: `1.5px solid ${BDR}`,
            borderRadius: 8,
            background: WHITE,
            padding: "6px 12px",
            gap: 8,
            minWidth: 280,
          }}
        >
          <i className="bi bi-search" style={{ color: SUB, fontSize: 12 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or code…"
            style={{
              border: "none",
              outline: "none",
              fontSize: 13,
              color: TXT,
              background: "transparent",
              flex: 1,
              fontFamily: "inherit",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: SUB,
                fontSize: 14,
                padding: 0,
              }}
            >
              <i className="bi bi-x" />
            </button>
          )}
        </div>
      </div>

      {/* ── Product list ── */}
      <div style={{ padding: "20px 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 64, color: SUB }}>
            <i
              className="bi bi-arrow-repeat"
              style={{
                fontSize: 28,
                animation: "spin 1s linear infinite",
                display: "block",
                marginBottom: 10,
              }}
            />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 64,
              color: SUB,
              background: WHITE,
              borderRadius: 12,
              border: `1.5px solid ${BDR}`,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            {search
              ? `No products found for "${search}".`
              : "No products found."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(540px, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
            {items.map((item) => {
              const isOpen = expanded === item.productId;
              const dt = fmtDateFull(item.createdDate);
              const mods = item.modifications ?? [];
              const thumb = imgUrl(item.image);
              const { tree, productLevel } = buildVariantTree(mods);

              return (
                <div
                  key={item.productId}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    background: WHITE,
                    border: `1.5px solid ${isOpen ? "#A0A0A0" : BDR}`,
                    boxShadow: isOpen
                      ? "0 2px 12px rgba(0,0,0,0.08)"
                      : "0 1px 3px rgba(0,0,0,0.04)",
                    gridColumn: isOpen ? "1 / -1" : "auto",
                  }}
                >
                  {/* ── Product row (White + ivory accent on hover) ── */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : item.productId)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: isOpen ? "#F5F0E6" : WHITE,
                      borderBottom: isOpen ? `1.5px solid ${BDR}` : "none",
                      transition: "background 0.12s",
                    }}
                  >
                    {/* Image */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: `1.5px solid ${BDR}`,
                        flexShrink: 0,
                        background: GRY,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <i
                          className="bi bi-image"
                          style={{ fontSize: 18, color: "#ccc" }}
                        />
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: TXT,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.productName || "Unnamed Product"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 3,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            color: SUB,
                            background: GRY,
                            borderRadius: 4,
                            padding: "1px 6px",
                            border: `1px solid ${BDR}`,
                          }}
                        >
                          {item.productCode}
                        </span>
                        {mods.length > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: SUB,
                              background: GRY,
                              borderRadius: 20,
                              padding: "1px 7px",
                              border: `1px solid ${BDR}`,
                            }}
                          >
                            {mods.length} change{mods.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Date */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: SUB }}>{dt.date}</div>
                      <div
                        style={{ fontSize: 11, fontWeight: 700, color: TXT }}
                      >
                        🕐 {dt.time}
                      </div>
                      {dt.relative && (
                        <div
                          style={{
                            fontSize: 9,
                            color: WHITE,
                            background: SUB,
                            borderRadius: 20,
                            padding: "1px 6px",
                            marginTop: 2,
                            display: "inline-block",
                          }}
                        >
                          {dt.relative}
                        </div>
                      )}
                    </div>
                    <i
                      className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
                      style={{ fontSize: 12, color: SUB, flexShrink: 0 }}
                    />
                  </div>

                  {/* ── Expanded body ── */}
                  {isOpen && (
                    <div>
                      {/* 1. Product Created */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 16px",
                          borderBottom: `1px solid ${BDR}`,
                          background: WHITE,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>🌱</span>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#1A5C1A",
                              marginBottom: 3,
                            }}
                          >
                            Product Created
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              {dt.dayName}
                            </span>
                            <span style={{ fontSize: 11, color: SUB }}>
                              {dt.date}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              🕐 {dt.time}
                            </span>
                            {dt.relative && (
                              <span
                                style={{
                                  fontSize: 9,
                                  color: WHITE,
                                  background: SUB,
                                  borderRadius: 20,
                                  padding: "1px 5px",
                                }}
                              >
                                {dt.relative}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.createdBy && (
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              {item.createdBy}
                            </div>
                            {item.createdByRole && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: SUB,
                                  background: GRY,
                                  borderRadius: 20,
                                  padding: "1px 6px",
                                  border: `1px solid ${BDR}`,
                                }}
                              >
                                {item.createdByRole}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Variants */}
                      {Array.from(tree.entries()).map(([vname, vdata], vi) => {
                        const allRows = [
                          ...(vdata.variantRow ? [vdata.variantRow] : []),
                          ...vdata.sizeRows,
                        ];
                        return (
                          <div key={vname}>
                            {/* Variant sub-header */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "7px 16px",
                                background: "#F5F0E6",
                                borderTop: `1px solid ${BDR}`,
                                borderBottom: `1px solid ${BDR}`,
                              }}
                            >
                              <span style={{ fontSize: 12 }}>🎨</span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: TXT,
                                  flex: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {vname}
                              </span>
                              <span style={{ fontSize: 10, color: SUB }}>
                                {allRows.length} change
                                {allRows.length !== 1 ? "s" : ""}
                              </span>
                            </div>

                            {/* Event rows */}
                            {allRows.map((mod: any, mi: number) => {
                              const mdt = fmtDateFull(mod.createdDate);
                              const evtColor =
                                EVENT_COLOR[mod.eventType] || SUB;
                              const evtLabel =
                                EVENT_LABEL[mod.eventType] ||
                                mod.label ||
                                mod.eventType;
                              const isSizeRow =
                                mod.eventType === "SIZE_ADDED" ||
                                mod.eventType === "SIZE_DELETED";
                              const sizeTag = isSizeRow
                                ? mod.sizeDisplay ||
                                  (mod.context?.includes(" / ")
                                    ? mod.context.split(" / ").slice(1).join("")
                                    : null)
                                : null;
                              return (
                                <div
                                  key={mi}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "8px 16px 8px 32px",
                                    background:
                                      mi % 2 === 0 ? WHITE : "#FDFAF8",
                                    borderBottom: `1px solid #F0EBE6`,
                                    borderLeft: `3px solid ${evtColor}`,
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        marginBottom: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          color: evtColor,
                                        }}
                                      >
                                        {evtLabel}
                                      </span>
                                      {sizeTag && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: "#0A4F8A",
                                            background: "#E3F2FD",
                                            borderRadius: 4,
                                            padding: "2px 7px",
                                            fontWeight: 700,
                                          }}
                                        >
                                          📐 {sizeTag}
                                        </span>
                                      )}
                                      {isSizeRow &&
                                        mod.stockAfter !== null &&
                                        mod.stockAfter !== undefined && (
                                          <span
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 800,
                                              color: "#1A5C1A",
                                              background: "#E8F5E9",
                                              borderRadius: 4,
                                              padding: "2px 7px",
                                            }}
                                          >
                                            📦 Stock: {mod.stockAfter}
                                          </span>
                                        )}
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: TXT,
                                        }}
                                      >
                                        {mdt.dayName}
                                      </span>
                                      <span
                                        style={{ fontSize: 11, color: SUB }}
                                      >
                                        {mdt.date}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: TXT,
                                        }}
                                      >
                                        🕐 {mdt.time}
                                      </span>
                                      {mdt.relative && (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            color: WHITE,
                                            background: SUB,
                                            borderRadius: 20,
                                            padding: "1px 5px",
                                          }}
                                        >
                                          {mdt.relative}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {mod.changedBy && (
                                    <div
                                      style={{
                                        textAlign: "right",
                                        flexShrink: 0,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: TXT,
                                        }}
                                      >
                                        {mod.changedBy}
                                      </div>
                                      {mod.role && (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            color: SUB,
                                            background: GRY,
                                            borderRadius: 20,
                                            padding: "1px 6px",
                                            border: `1px solid ${BDR}`,
                                          }}
                                        >
                                          {mod.role}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* 3. Product-level changes */}
                      {productLevel.map((mod: any, mi: number) => {
                        const mdt = fmtDateFull(mod.createdDate);
                        return (
                          <div
                            key={mi}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "8px 16px",
                              background: WHITE,
                              borderTop: `1px solid ${BDR}`,
                              borderLeft: `3px solid #1565c0`,
                            }}
                          >
                            <span style={{ fontSize: 12 }}>✏️</span>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "#1565c0",
                                  marginBottom: 3,
                                }}
                              >
                                Product Updated
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: TXT,
                                  }}
                                >
                                  {mdt.dayName}
                                </span>
                                <span style={{ fontSize: 11, color: SUB }}>
                                  {mdt.date}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: TXT,
                                  }}
                                >
                                  🕐 {mdt.time}
                                </span>
                              </div>
                            </div>
                            {mod.changedBy && (
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: TXT,
                                  textAlign: "right",
                                }}
                              >
                                {mod.changedBy}
                                {mod.role && (
                                  <div style={{ fontSize: 9, color: SUB }}>
                                    {mod.role}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Action buttons */}
                      <div
                        style={{
                          padding: "10px 16px",
                          borderTop: `1px solid ${BDR}`,
                          background: "#F5F0E6",
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <button
                          onClick={() => {
                            onBack();
                            navigate(
                              `/admin/stock?productId=${item.productId}`,
                            );
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            background: TXT,
                            color: WHITE,
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <i className="bi bi-box-seam" /> View on Stock Page
                        </button>
                        <button
                          onClick={() =>
                            onOpenProductHistory({
                              productId: item.productId,
                              name: item.productName,
                              productCode: item.productCode,
                            })
                          }
                          style={{
                            padding: "8px 14px",
                            background: WHITE,
                            color: TXT,
                            border: `1.5px solid ${BDR}`,
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <i className="bi bi-clock-history" /> Full History
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "20px 0 32px",
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: "7px 16px",
                border: `1.5px solid ${BDR}`,
                borderRadius: 8,
                background: WHITE,
                color: page <= 1 ? "#ccc" : TXT,
                cursor: page <= 1 ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: SUB }}>
              Page {page} / {totalPages} · {total} products
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                padding: "7px 16px",
                border: `1.5px solid ${BDR}`,
                borderRadius: 8,
                background: WHITE,
                color: page >= totalPages ? "#ccc" : TXT,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductHistoryModal({
  product,
  onClose,
}: {
  product: any;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"lifecycle" | "stock">("lifecycle");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/StockLog/product-history/${product.productId}`)
      .then((r) => setEvents(r.data ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [product.productId]);

  const filtered = events.filter((e) => e.eventCategory === filter);

  // Summary counts
  const lifecycleCount = events.filter(
    (e) => e.eventCategory === "lifecycle",
  ).length;
  const stockCount = events.filter((e) => e.eventCategory === "stock").length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 620,
          maxWidth: "96vw",
          height: "100vh",
          background: WHITE,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-6px 0 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: `1.5px solid ${BDR}`,
            background: PLT,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 22 }}>🕐</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: P,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {product.name || "Product"} — Full History
              </div>
              <div
                style={{ fontSize: 11, color: SUB, fontFamily: "monospace" }}
              >
                {product.productCode || `ID ${product.productId}`}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: `1.5px solid ${BDR}`,
                background: WHITE,
                cursor: "pointer",
                fontSize: 16,
                color: SUB,
              }}
            >
              ✕
            </button>
          </div>

          {/* Filter tabs — Changes | Stock only */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["lifecycle", "stock"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 16px",
                  borderRadius: 20,
                  border: `1.5px solid ${filter === f ? P : BDR}`,
                  background: filter === f ? P : WHITE,
                  color: filter === f ? WHITE : TXT,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f === "lifecycle"
                  ? `✏️ Changes (${lifecycleCount})`
                  : `📦 Stock (${stockCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: SUB }}>
              <i
                className="bi bi-arrow-repeat"
                style={{
                  fontSize: 24,
                  animation: "spin 1s linear infinite",
                  display: "block",
                  marginBottom: 8,
                }}
              />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: SUB }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              {events.length === 0
                ? "No history yet for this product. Events are recorded when products, variants, or sizes are created/deleted and when stock changes."
                : `No ${filter} events found.`}
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 28 }}>
              {/* Vertical timeline spine */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: `linear-gradient(to bottom, ${P}, ${BDR})`,
                }}
              />

              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {filtered.map((e, idx) => {
                  const meta = getEventMeta(e);
                  return (
                    <div key={e.eventId} style={{ position: "relative" }}>
                      {/* Dot on timeline */}
                      <div
                        style={{
                          position: "absolute",
                          left: -22,
                          top: 12,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: meta.color,
                          border: `2.5px solid ${WHITE}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: `0 0 0 2px ${meta.color}33`,
                          zIndex: 1,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            lineHeight: 1,
                            userSelect: "none",
                          }}
                        >
                          {meta.icon.slice(0, 1)}
                        </span>
                      </div>
                      <EventCardCompact e={e} />
                    </div>
                  );
                })}

                {/* End of timeline marker */}
                <div style={{ position: "relative", paddingLeft: 2 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -22,
                      top: 4,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: BDR,
                      border: `2px solid ${WHITE}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 8, color: SUB }}>■</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: SUB,
                      fontStyle: "italic",
                      paddingTop: 2,
                    }}
                  >
                    — End of history —
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DB-Change Alert Banner ───────────────────────────────────────────────────
function DbChangeBanner({
  pvdId,
  stockId,
}: {
  pvdId: number;
  stockId?: string | null;
}) {
  return (
    <div
      style={{
        margin: "0 0 14px",
        padding: "10px 14px",
        background: "#fff5f5",
        border: "2px solid #b71c1c",
        borderRadius: 10,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 20 }}>🚨</span>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#b71c1c",
            marginBottom: 3,
          }}
        >
          Direct Database Change Detected
        </div>
        <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.5 }}>
          Stock values for {stockId ? `#${stockId}` : `PVD ${pvdId}`} differ
          from the last logged entry — a direct DB edit was made outside the
          app. A <strong>DB_CHANGE</strong> entry has been recorded in history.
        </div>
      </div>
    </div>
  );
}

// ─── Stock Detail Panel ───────────────────────────────────────────────────────
function StockDetailPanel({
  pvd,
  onClose,
  onSaved,
}: {
  pvd: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalQty, setTotalQty] = useState<number>(pvd.stockQuantity ?? 0);
  const [processedQty, setProcessedQty] = useState<number>(
    pvd.processedQuantity ?? 0,
  );
  const [returnedQty, setReturnedQty] = useState<number>(
    pvd.returnedQuantity ?? 0,
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");

  const available = Math.max(0, totalQty - processedQty + returnedQty);
  const availColor =
    available <= 0 ? "#c62828" : available <= 3 ? "#e65100" : "#2e7d32";
  const availBg =
    available <= 0 ? "#fdecea" : available <= 3 ? "#fff3e0" : "#e8f5e9";

  useEffect(() => {
    setTotalQty(pvd.stockQuantity ?? 0);
    setProcessedQty(pvd.processedQuantity ?? 0);
    setReturnedQty(pvd.returnedQuantity ?? 0);
  }, [pvd]);

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const r = await api.get(`/StockLog/logs/${pvd.productVariantDetailId}`);
      setLogs(r.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }
  useEffect(() => {
    loadLogs();
  }, [pvd.productVariantDetailId]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/StockLog/update/${pvd.productVariantDetailId}`, {
        stockQuantity: totalQty,
        processedQuantity: processedQty,
        returnedQuantity: returnedQty,
        note: note || null,
        changedBy: "Admin",
      });
      toast.success("Stock updated & logged");
      setNote("");
      await loadLogs();
      onSaved();
    } catch {
      toast.error("Failed to update stock");
    } finally {
      setSaving(false);
    }
  }

  const visibleLogCount = logs.filter(
    (l) => l.changeType !== "INITIAL_STOCK",
  ).length;

  return (
    <div
      style={{
        border: `1.5px solid ${BDR}`,
        borderRadius: 14,
        background: WHITE,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(122,30,44,0.07)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1.5px solid ${BDR}`,
          background: PLT,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: P }}>
            {fmtSize(pvd.sizeLabel, pvd.cupSizeLabel) || "—"}
          </div>
          {pvd.stockId && (
            <div
              style={{
                fontSize: 11,
                color: SUB,
                fontFamily: "monospace",
                marginTop: 2,
              }}
            >
              #{pvd.stockId}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge pvd={{ ...pvd, availableQuantity: available }} />
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1.5px solid ${BDR}`,
              background: WHITE,
              cursor: "pointer",
              fontSize: 14,
              color: SUB,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {pvd.dbChangeAlert && (
        <div style={{ padding: "14px 18px 0" }}>
          <DbChangeBanner
            pvdId={pvd.productVariantDetailId}
            stockId={pvd.stockId}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1.5px solid ${BDR}` }}>
        {(["edit", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: activeTab === tab ? P : SUB,
              background: activeTab === tab ? PLT : WHITE,
              borderBottom:
                activeTab === tab
                  ? `2.5px solid ${P}`
                  : "2.5px solid transparent",
            }}
          >
            {tab === "edit"
              ? "✏️ Edit Stock"
              : `📋 History (${visibleLogCount})`}
          </button>
        ))}
      </div>

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-around",
              background: GRY,
              borderRadius: 10,
              padding: "14px 10px",
              marginBottom: 18,
            }}
          >
            <Pill val={totalQty} color="#1565c0" bg="#e3f2fd" label="Total" />
            <Pill
              val={processedQty}
              color="#6a1b9a"
              bg="#f3e5f5"
              label="Processed"
            />
            <Pill
              val={returnedQty}
              color="#795548"
              bg="#efebe9"
              label="Returned"
            />
            <Pill
              val={available}
              color={availColor}
              bg={availBg}
              label="Available"
            />
          </div>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              background: "#fffbf8",
              border: `1px dashed ${BDR}`,
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Available = Total − Processed + Returned
          </div>
          {[
            {
              label: "Total Stock",
              key: "total",
              value: totalQty,
              setter: setTotalQty,
              hint: "Units received. Change here to restock.",
            },
            {
              label: "Processed (Orders)",
              key: "processed",
              value: processedQty,
              setter: setProcessedQty,
              hint: "Auto-updated by order system. Override only to correct errors.",
            },
            {
              label: "Returned Stock",
              key: "returned",
              value: returnedQty,
              setter: setReturnedQty,
              hint: "Auto-updated on cancellation/refund.",
            },
          ].map(({ label, key, value, setter, hint }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                {label}
              </label>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setter(Math.max(0, Number(e.target.value)))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: `1.5px solid ${BDR}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: TXT,
                  background: WHITE,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = P)}
                onBlur={(e) => (e.target.style.borderColor = BDR)}
              />
              <div style={{ fontSize: 10, color: SUB, marginTop: 3 }}>
                {hint}
              </div>
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received new batch from supplier…"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: `1.5px solid ${BDR}`,
                borderRadius: 8,
                fontSize: 13,
                color: TXT,
                background: WHITE,
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = P)}
              onBlur={(e) => (e.target.style.borderColor = BDR)}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: "11px 0",
              background: saving ? "#b0b0b0" : P,
              color: WHITE,
              border: "none",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "💾 Save Stock & Log Change"}
          </button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div style={{ padding: 18 }}>
          {loadingLogs ? (
            <div style={{ textAlign: "center", padding: 32, color: SUB }}>
              Loading history…
            </div>
          ) : visibleLogCount === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: SUB,
                background: GRY,
                borderRadius: 10,
              }}
            >
              No stock changes recorded yet.
              <br />
              <span style={{ fontSize: 11 }}>
                Changes appear here after the first edit or order.
              </span>
            </div>
          ) : (
            (() => {
              const groups = groupLogs(logs);
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div style={{ fontSize: 11, color: SUB }}>
                    {groups.length} events · {visibleLogCount} log entries
                  </div>
                  {groups.map((group, gi) => {
                    const dt = fmtDateFull(group.sessionTime);
                    const isDbChange = group.entries.some(
                      (e) => e.changeType === "DB_CHANGE",
                    );
                    const src = srcLabel(group.changedBy, group.entries);
                    const hasDecrease = group.entries.some(
                      (e) => (e.newValue ?? 0) < (e.previousValue ?? 0),
                    );
                    const accentColor = isDbChange
                      ? "#b71c1c"
                      : hasDecrease
                      ? "#c62828"
                      : "#2e7d32";
                    return (
                      <div
                        key={gi}
                        style={{
                          border: `1.5px solid ${isDbChange ? "#b71c1c" : BDR}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: isDbChange ? "#fff5f5" : WHITE,
                          borderLeft: `4px solid ${accentColor}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            padding: "10px 14px 8px",
                            borderBottom: `1px solid ${BDR}`,
                            background: isDbChange ? "#fff0f0" : GRY,
                            gap: 8,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: src.color,
                                  background: src.bg,
                                  borderRadius: 20,
                                  padding: "2px 8px",
                                }}
                              >
                                {src.text}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              {dt.dayName}, {dt.date}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginTop: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  color: P,
                                  fontWeight: 700,
                                }}
                              >
                                🕐 {dt.time}
                              </span>
                              {dt.relative && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: WHITE,
                                    background: SUB,
                                    borderRadius: 20,
                                    padding: "1px 7px",
                                  }}
                                >
                                  {dt.relative}
                                </span>
                              )}
                            </div>
                          </div>
                          {group.changedBy && (
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              <i
                                className="bi bi-person-circle"
                                style={{ marginRight: 4, color: SUB }}
                              />
                              {group.changedBy}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "10px 14px" }}>
                          {group.entries.map((entry) => {
                            const delta =
                              (entry.newValue ?? 0) -
                              (entry.previousValue ?? 0);
                            const meta = getMeta(entry.changeType);
                            return (
                              <div
                                key={entry.stockLogId}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 10px",
                                  background: meta.bg,
                                  borderRadius: 8,
                                  marginBottom: 5,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: meta.color,
                                    minWidth: 110,
                                  }}
                                >
                                  {meta.icon} {meta.label}
                                </span>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    flex: 1,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: "#888",
                                      background: WHITE,
                                      borderRadius: 5,
                                      padding: "1px 8px",
                                      border: `1px solid ${BDR}`,
                                      minWidth: 32,
                                      textAlign: "center",
                                    }}
                                  >
                                    {entry.previousValue ?? "—"}
                                  </span>
                                  <span style={{ color: SUB }}>→</span>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: meta.color,
                                      background: WHITE,
                                      borderRadius: 5,
                                      padding: "1px 8px",
                                      border: `1.5px solid ${meta.color}`,
                                      minWidth: 32,
                                      textAlign: "center",
                                    }}
                                  >
                                    {entry.newValue ?? "—"}
                                  </span>
                                </div>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color:
                                      delta > 0
                                        ? "#2e7d32"
                                        : delta < 0
                                        ? "#c62828"
                                        : SUB,
                                    background:
                                      delta > 0
                                        ? "#e8f5e9"
                                        : delta < 0
                                        ? "#fdecea"
                                        : GRY,
                                    borderRadius: 20,
                                    padding: "2px 8px",
                                  }}
                                >
                                  {delta > 0
                                    ? `+${delta}`
                                    : delta === 0
                                    ? "±0"
                                    : delta}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {group.note && (
                          <div
                            style={{
                              margin: "0 14px 12px",
                              padding: "8px 12px",
                              background: "#fffbf0",
                              border: "1px solid #ffe082",
                              borderRadius: 8,
                              fontSize: 12,
                              color: TXT,
                              fontStyle: "italic",
                            }}
                          >
                            💬 {group.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

// ─── PVD Row ──────────────────────────────────────────────────────────────────
function PvdRow({
  pvd,
  isOpen,
  onToggle,
  onSaved,
}: {
  pvd: any;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const total = pvd.stockQuantity ?? 0;
  const processed = pvd.processedQuantity ?? 0;
  const returned = pvd.returnedQuantity ?? 0;
  const available =
    pvd.availableQuantity ?? Math.max(0, total - processed + returned);
  const sizeLabel = fmtSize(pvd.sizeLabel, pvd.cupSizeLabel) || "—";
  const hasAlert = pvd.dbChangeAlert;
  return (
    <div style={{ borderBottom: `1px solid ${BDR}` }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          cursor: "pointer",
          background: hasAlert ? "#fff0f0" : isOpen ? PLT : WHITE,
          borderLeft: hasAlert ? "4px solid #b71c1c" : "4px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!isOpen)
            (e.currentTarget as HTMLElement).style.background = hasAlert
              ? "#ffe0e0"
              : GRY;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = hasAlert
            ? "#fff0f0"
            : isOpen
            ? PLT
            : WHITE;
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isOpen ? P : TXT,
            minWidth: 80,
          }}
        >
          {sizeLabel}
        </div>
        <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          {[
            { l: "Total", v: total, c: "#1565c0", b: "#e3f2fd" },
            { l: "Processed", v: processed, c: "#6a1b9a", b: "#f3e5f5" },
            { l: "Returned", v: returned, c: "#795548", b: "#efebe9" },
            {
              l: "Available",
              v: available,
              c:
                available <= 0
                  ? "#c62828"
                  : available <= 3
                  ? "#e65100"
                  : "#2e7d32",
              b:
                available <= 0
                  ? "#fdecea"
                  : available <= 3
                  ? "#fff3e0"
                  : "#e8f5e9",
            },
          ].map(({ l, v, c, b }) => (
            <div
              key={l}
              style={{ display: "flex", alignItems: "center", gap: 3 }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: SUB,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {l}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: c,
                  background: b,
                  borderRadius: 5,
                  padding: "1px 7px",
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
        {hasAlert && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#b71c1c",
              background: "#ffebee",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            🚨 DB Change
          </span>
        )}
        <StatusBadge pvd={{ ...pvd, availableQuantity: available }} />
        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 11, color: SUB }}
        />
      </div>
      {isOpen && (
        <div style={{ padding: "0 14px 14px" }}>
          <StockDetailPanel pvd={pvd} onClose={onToggle} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

// ─── Variant Row ──────────────────────────────────────────────────────────────
function VariantRow({
  variant,
  isOpen,
  onToggle,
  targetPvdId,
}: {
  variant: any;
  isOpen: boolean;
  onToggle: () => void;
  targetPvdId?: number | null;
}) {
  const [pvds, setPvds] = useState<any[]>([]);
  const [loadingPvds, setLoadingPvds] = useState(false);
  const [openPvd, setOpenPvd] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingPvds(true);
    api
      .get(`/StockLog/pvds/${variant.productVariantId}`)
      .then((r) => {
        const data = r.data ?? [];
        setPvds(data);
        const alerts = data.filter((p: any) => p.dbChangeAlert);
        if (alerts.length > 0)
          toast.error(
            `⚠️ ${alerts.length} direct DB change${
              alerts.length > 1 ? "s" : ""
            } detected in ${variant.variantName || "this variant"}!`,
            { duration: 6000 },
          );
        if (
          targetPvdId &&
          data.find((p: any) => p.productVariantDetailId === targetPvdId)
        ) {
          setOpenPvd(targetPvdId);
          setTimeout(() => {
            const el = document.getElementById(`pvd-${targetPvdId}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        }
      })
      .catch(() => setPvds([]))
      .finally(() => setLoadingPvds(false));
  }, [isOpen, variant.productVariantId, targetPvdId]);

  const reloadPvds = useCallback(() => {
    api
      .get(`/StockLog/pvds/${variant.productVariantId}`)
      .then((r) => setPvds(r.data ?? []));
  }, [variant.productVariantId]);

  const totalStock = pvds.reduce((s, p) => s + (p.stockQuantity ?? 0), 0);
  const totalAvail = pvds.reduce((s, p) => s + (p.availableQuantity ?? 0), 0);
  const alertCount = pvds.filter((p) => p.dbChangeAlert).length;
  const colorHex = variant.color?.startsWith("#") ? variant.color : null;

  return (
    <div style={{ borderBottom: `1px solid ${BDR}` }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          cursor: "pointer",
          background: isOpen ? "#fdf6f4" : WHITE,
        }}
        onMouseEnter={(e) => {
          if (!isOpen) (e.currentTarget as HTMLElement).style.background = GRY;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isOpen
            ? "#fdf6f4"
            : WHITE;
        }}
      >
        {colorHex ? (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: colorHex,
              border: "1.5px solid #ddd",
            }}
          />
        ) : (
          <i className="bi bi-palette" style={{ fontSize: 14, color: SUB }} />
        )}
        <div style={{ flex: 1 }}>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: isOpen ? P : TXT }}
          >
            {variant.variantName ||
              variant.color ||
              `Variant #${variant.productVariantId}`}
          </div>
          <div style={{ fontSize: 11, color: SUB }}>
            {pvds.length} size{pvds.length !== 1 ? "s" : ""} · Total:{" "}
            {totalStock} · Available: {totalAvail}
          </div>
        </div>
        {alertCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b71c1c",
              background: "#ffebee",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            🚨 {alertCount} DB alert{alertCount > 1 ? "s" : ""}
          </span>
        )}
        {!variant.isActive && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#888",
              background: "#eee",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            Inactive
          </span>
        )}
        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 11, color: SUB }}
        />
      </div>
      {isOpen && (
        <div style={{ borderTop: `1px solid ${BDR}` }}>
          {loadingPvds ? (
            <div style={{ padding: 20, textAlign: "center", color: SUB }}>
              Loading sizes…
            </div>
          ) : pvds.length === 0 ? (
            <div style={{ padding: "16px 18px", color: SUB }}>
              No sizes configured for this variant.
            </div>
          ) : (
            pvds.map((pvd) => (
              <div
                key={pvd.productVariantDetailId}
                id={`pvd-${pvd.productVariantDetailId}`}
              >
                <PvdRow
                  pvd={pvd}
                  isOpen={openPvd === pvd.productVariantDetailId}
                  onToggle={() =>
                    setOpenPvd((prev) =>
                      prev === pvd.productVariantDetailId
                        ? null
                        : pvd.productVariantDetailId,
                    )
                  }
                  onSaved={reloadPvds}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────
function ProductRow({
  product,
  isOpen,
  onToggle,
  targetVariantId,
  targetPvdId,
  onShowHistory,
}: {
  product: any;
  isOpen: boolean;
  onToggle: () => void;
  targetVariantId?: number | null;
  targetPvdId?: number | null;
  onShowHistory: (p: any) => void;
}) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [openVariant, setOpenVariant] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingVariants(true);
    api
      .get(`/StockLog/variants/${product.productId}`)
      .then((r) => {
        const data = r.data ?? [];
        setVariants(data);
        if (
          targetVariantId &&
          data.find((v: any) => v.productVariantId === targetVariantId)
        )
          setOpenVariant(targetVariantId);
      })
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [isOpen, product.productId, targetVariantId]);

  const thumb = imgUrl(product.image);
  return (
    <div
      style={{
        border: `1.5px solid ${isOpen ? P : BDR}`,
        borderRadius: 12,
        overflow: "hidden",
        background: WHITE,
        boxShadow: isOpen ? `0 4px 16px rgba(122,30,44,0.08)` : "none",
        transition: "all 0.2s",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          cursor: "pointer",
          background: isOpen ? PLT : WHITE,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            overflow: "hidden",
            border: `1.5px solid ${BDR}`,
            flexShrink: 0,
            background: GRY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <i
              className="bi bi-image"
              style={{ fontSize: 20, color: "#ccc" }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: isOpen ? P : TXT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name || "Unnamed Product"}
          </div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
            <span
              style={{
                fontFamily: "monospace",
                background: GRY,
                borderRadius: 4,
                padding: "1px 6px",
                border: `1px solid ${BDR}`,
              }}
            >
              {product.productCode || `#${product.productId}`}
            </span>
          </div>
        </div>

        {/* Per-product history button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowHistory(product);
          }}
          title="View product history"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            background: PLT,
            color: P,
            border: `1.5px solid ${P}`,
            borderRadius: 7,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <i className="bi bi-clock-history" /> History
        </button>

        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 12, color: SUB }}
        />
      </div>
      {isOpen && (
        <div style={{ borderTop: `1.5px solid ${BDR}` }}>
          {loadingVariants ? (
            <div style={{ padding: 20, textAlign: "center", color: SUB }}>
              Loading variants…
            </div>
          ) : variants.length === 0 ? (
            <div style={{ padding: 16, color: SUB }}>No variants found.</div>
          ) : (
            variants.map((v) => (
              <VariantRow
                key={v.productVariantId}
                variant={v}
                isOpen={openVariant === v.productVariantId}
                onToggle={() =>
                  setOpenVariant((prev) =>
                    prev === v.productVariantId ? null : v.productVariantId,
                  )
                }
                targetPvdId={
                  targetVariantId === v.productVariantId ? targetPvdId : null
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
// ─── Authenticated Excel download helper — uses axios (handles CORS + auth) ──
async function downloadExcel(path: string, filename: string) {
  try {
    const res = await api.get(`/${path}`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed:", err);
    alert("Download failed — check the console for details.");
  }
}

export default function AdminStock() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openProduct, setOpenProduct] = useState<number | null>(null);

  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any | null>(null);

  const SIZE = 30;

  const pvdIdParam = searchParams.get("pvdId");
  const productIdParam = searchParams.get("productId");
  const variantIdParam = searchParams.get("variantId");
  useEffect(() => {
    if (productIdParam) setOpenProduct(Number(productIdParam));
  }, [productIdParam]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await api.get("/StockLog/products", {
        params: { page, size: SIZE, search: debouncedSearch },
      });
      setProducts(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadProducts();
  }, [page, debouncedSearch]);
  const totalPages = Math.ceil(total / SIZE);

  // Show full-page history view when active
  if (showGlobalHistory) {
    return (
      <GlobalHistoryPage
        onBack={() => setShowGlobalHistory(false)}
        onOpenProductHistory={(p) => {
          setShowGlobalHistory(false);
          setHistoryProduct(p);
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "inherit" }}>
      {/* Modals */}
      {historyProduct && (
        <ProductHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {/* Page header */}
      <div
        style={{
          background: WHITE,
          borderBottom: `1.5px solid ${BDR}`,
          padding: "18px 28px 14px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: SUB,
              fontSize: 18,
              padding: 0,
            }}
          >
            <i className="bi bi-arrow-left" />
          </button>
          <div>
            <h1
              style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TXT }}
            >
              Stock Management
            </h1>
            <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
              {total} product{total !== 1 ? "s" : ""} · Click a product to see
              variants and manage stock
            </div>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Global History button */}
            <button
              onClick={() => setShowGlobalHistory(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: `1.5px solid ${P}`,
                background: PLT,
                color: P,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <i className="bi bi-clock-history" />
              📋 History
            </button>

            {/* Download Changes Excel */}
            <button
              onClick={() =>
                downloadExcel("StockLog/export/changes", "product_changes.xlsx")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "1.5px solid #2e7d32",
                background: "#f0fff4",
                color: "#2e7d32",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="Download all product & variant changes as Excel"
            >
              <i className="bi bi-download" />
              ✏️ Changes
            </button>

            {/* Download Stock Excel */}
            <button
              onClick={() =>
                downloadExcel("StockLog/export/stock", "stock_changes.xlsx")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "1.5px solid #1565c0",
                background: "#e3f2fd",
                color: "#1565c0",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="Download all stock quantity changes as Excel"
            >
              <i className="bi bi-download" />
              📦 Stock
            </button>

            {/* Search — works for Name, Product Code, AND Stock ID */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `1.5px solid ${BDR}`,
                borderRadius: 9,
                background: WHITE,
                padding: "6px 12px",
                gap: 8,
                minWidth: 280,
              }}
            >
              <i
                className="bi bi-search"
                style={{ color: SUB, fontSize: 13 }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code, or Stock ID…"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: TXT,
                  background: "transparent",
                  flex: 1,
                  fontFamily: "inherit",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: SUB,
                    fontSize: 14,
                    padding: 0,
                  }}
                >
                  <i className="bi bi-x" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "10px 28px",
          flexWrap: "wrap",
          borderBottom: `1px solid ${BDR}`,
          background: "#fdfaf8",
        }}
      >
        {[
          { color: "#1565c0", label: "Total — units received" },
          { color: "#6a1b9a", label: "Processed — orders placed" },
          { color: "#795548", label: "Returned — customer returns" },
          {
            color: "#2e7d32",
            label: "Available = Total − Processed + Returned",
          },
          {
            color: "#b71c1c",
            label: "🚨 DB Change — direct database edit detected",
          },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: SUB }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Source key */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "6px 28px",
          flexWrap: "wrap",
          borderBottom: `1px solid ${BDR}`,
          background: "#faf9f8",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: SUB,
            textTransform: "uppercase",
          }}
        >
          History sources:
        </span>
        {[
          { text: "👤 Admin (Stock Page)", c: "#2e7d32", b: "#e8f5e9" },
          { text: "🛒 Order System", c: "#0277bd", b: "#e1f5fe" },
          { text: "📝 Product Detail", c: "#6a1b9a", b: "#f3e5f5" },
          { text: "⚠️ Direct DB Edit", c: "#b71c1c", b: "#ffebee" },
        ].map(({ text, c, b }) => (
          <span
            key={text}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: c,
              background: b,
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            {text}
          </span>
        ))}
      </div>

      {/* Product list */}
      <div
        style={{
          padding: "20px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: SUB,
              fontSize: 14,
            }}
          >
            <i
              className="bi bi-arrow-repeat"
              style={{ fontSize: 24, animation: "spin 1s linear infinite" }}
            />
            <br />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: SUB,
              fontSize: 14,
              background: WHITE,
              borderRadius: 12,
              border: `1.5px solid ${BDR}`,
            }}
          >
            <i
              className="bi bi-box-seam"
              style={{ fontSize: 36, display: "block", marginBottom: 12 }}
            />
            No products found{search ? ` for "${search}"` : ""}.
          </div>
        ) : (
          products.map((p) => (
            <ProductRow
              key={p.productId}
              product={p}
              isOpen={openProduct === p.productId}
              onToggle={() =>
                setOpenProduct((prev) =>
                  prev === p.productId ? null : p.productId,
                )
              }
              targetVariantId={
                openProduct === p.productId && variantIdParam
                  ? Number(variantIdParam)
                  : null
              }
              targetPvdId={
                openProduct === p.productId && pvdIdParam
                  ? Number(pvdIdParam)
                  : null
              }
              onShowHistory={setHistoryProduct}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "16px 28px 32px",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: "7px 14px",
              border: `1.5px solid ${BDR}`,
              borderRadius: 8,
              background: WHITE,
              color: page <= 1 ? "#ccc" : TXT,
              cursor: page <= 1 ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: SUB }}>
            Page {page} of {totalPages} ({total} products)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: "7px 14px",
              border: `1.5px solid ${BDR}`,
              borderRadius: 8,
              background: WHITE,
              color: page >= totalPages ? "#ccc" : TXT,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
