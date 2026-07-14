/**
 * AdminCouponsList.tsx
 * ─────────────────────
 * Admin page: unified view of ALL coupons created across every section
 * (Digital/Generic, User-Specific, Brand-Specific).
 *
 * Tabs:
 *  • All       — every coupon regardless of status
 *  • Active    — isActive=true, not yet used/expired
 *  • Used      — isUsed=true OR has a CouponUsage entry (shows who used it + when)
 *  • Inactive  — isActive=false
 *
 * For "Used" tab, shows: coupon code, type, discount, user email, used-on
 * date+time, order ID.
 *
 * Route: /admin/coupon-list
 * Nav:   Add "Coupon List" below "Coupons" in AdminLayout.tsx
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";

// ── Types ──────────────────────────────────────────────────────────────────

type StatusTab = "all" | "active" | "used" | "inactive";

interface CouponRow {
  couponId:       number;
  couponCode:     string;
  couponName:     string | null;
  couponType:     string | null;
  discount:       number | null;
  startDate:      string | null;
  endDate:        string | null;
  isActive:       boolean;
  isUsed:         boolean;
  brandId:        number | null;
  brandName:      string | null;
  // usage info (only present when isUsed=true)
  usedByEmail:    string | null;
  usedAt:         string | null;
  usedOrderId:    number | null;
}

interface ListResponse {
  list:  CouponRow[];
  count: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function typeLabel(t: string | null) {
  if (!t) return "Generic";
  switch (t) {
    case "brand_specific":  return "Brand";
    case "user_specific":   return "User";
    case "generic":         return "Generic";
    default:                return t;
  }
}

function typeBadge(t: string | null) {
  const label = typeLabel(t);
  const colors: Record<string, { bg: string; color: string }> = {
    Brand:   { bg: "#e8f0fe", color: "#1a56db" },
    User:    { bg: "#f0fdf4", color: "#16a34a" },
    Generic: { bg: "#fef9c3", color: "#854d0e" },
  };
  const style = colors[label] ?? { bg: "#f5f5f5", color: "#555" };
  return (
    <span style={{
      ...style, padding: "2px 8px", borderRadius: 10,
      fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const td: React.CSSProperties = {
  padding: "10px 12px", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle",
};
const th: React.CSSProperties = {
  ...td, fontWeight: 700, background: "#f9f9f9", fontSize: 12,
  color: "#555", textTransform: "uppercase", letterSpacing: "0.5px",
};

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminCouponsList() {
  const [tab,     setTab]     = useState<StatusTab>("all");
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");

  const { data, isLoading, isError } = useQuery<ListResponse>({
    queryKey: ["admin-coupons-list", tab, page, search],
    queryFn: () =>
      api.get("/Coupons/AdminList", {
        params: {
          status:       tab === "all" ? undefined : tab,
          search:       search || undefined,
          "Page.Index": page,
          "Page.Size":  PAGE_SIZE,
        },
      }).then((r) => r.data),
  });

  const list  = data?.list  ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const tabStyle = (t: StatusTab): React.CSSProperties => ({
    padding: "7px 18px", borderRadius: 6, fontSize: 13, cursor: "pointer",
    border: "1px solid #ddd",
    background: tab === t ? "var(--brand, #6b0f2a)" : "#fff",
    color:      tab === t ? "#fff" : "#555",
    fontWeight: tab === t ? 600 : 400,
  });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Coupon List</h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            All coupons created across Digital, User-Specific and Brand sections.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            padding: "8px 14px", borderRadius: 6, border: "1px solid #ddd",
            fontSize: 13, minWidth: 220,
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {(["all", "active", "used", "inactive"] as StatusTab[]).map((t) => (
          <button key={t} style={tabStyle(t)}
            onClick={() => { setTab(t); setPage(1); }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#999", alignSelf: "center" }}>
          {total} coupon{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <p style={{ color: "#aaa", padding: 40, textAlign: "center" }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: "#c0392b", padding: 20 }}>Failed to load. Please try again.</p>
      ) : list.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", background: "#fafafa", borderRadius: 8, color: "#aaa" }}>
          No coupons found for this filter.
        </div>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {tab === "used"
                  ? ["Code", "Type", "Name", "Discount", "Valid Until", "Status",
                     "Used By (Email)", "Used On", "Order"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))
                  : ["Code", "Type", "Name / Brand", "Discount", "Valid From", "Valid Until", "Status"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.couponId} style={{ background: "#fff" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <td style={td}>
                    <code style={{
                      background: "#f5f5f5", padding: "2px 8px",
                      borderRadius: 4, fontSize: 12, fontWeight: 600,
                    }}>
                      {c.couponCode}
                    </code>
                  </td>
                  <td style={td}>{typeBadge(c.couponType)}</td>

                  {tab === "used" ? (
                    <>
                      <td style={td}>{c.couponName || "—"}</td>
                      <td style={td}><b>{c.discount ?? "—"}%</b></td>
                      <td style={td}>{fmtDate(c.endDate)}</td>
                      <td style={td}>
                        <span style={{
                          background: "#f5e6e6", color: "#c0392b",
                          padding: "2px 8px", borderRadius: 10,
                          fontSize: 11, fontWeight: 600,
                        }}>Used</span>
                      </td>
                      <td style={{ ...td, color: c.usedByEmail ? "#333" : "#aaa" }}>
                        {c.usedByEmail || "—"}
                      </td>
                      <td style={td}>{fmtDateTime(c.usedAt)}</td>
                      <td style={td}>
                        {c.usedOrderId
                          ? <span style={{ color: "#1a56db", fontWeight: 600 }}>#{c.usedOrderId}</span>
                          : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={td}>
                        <div>{c.couponName || "—"}</div>
                        {c.brandName && (
                          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                            Brand: {c.brandName}
                          </div>
                        )}
                      </td>
                      <td style={td}><b>{c.discount ?? "—"}%</b></td>
                      <td style={td}>{fmtDate(c.startDate)}</td>
                      <td style={td}>{fmtDate(c.endDate)}</td>
                      <td style={td}>
                        {c.isUsed ? (
                          <span style={{ background: "#f5e6e6", color: "#c0392b", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Used</span>
                        ) : c.isActive ? (
                          <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Active</span>
                        ) : (
                          <span style={{ background: "#f5f5f5", color: "#888", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>Inactive</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#ccc" : "#333" }}
          >← Prev</button>
          <span style={{ padding: "7px 14px", fontSize: 13, color: "#666" }}>
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: page >= pages ? "not-allowed" : "pointer", color: page >= pages ? "#ccc" : "#333" }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}