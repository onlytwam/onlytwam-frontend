// payment-checkout-reports.tsx
import React, { useState, useCallback } from "react";
import type { CSSProperties } from "react";
import api from "@/shared/api/axiosInstance";

const REPORT_PREFIX = "/Report";
const PAGE_SIZE = 10;

// ─── THEME ───────────────────────────────────────────────────
const T = {
  brand: "#6A012A",
  brandLt: "#F7EEF2",
  brandMid: "#E8C5D0",
  brandHov: "#F2E0E8",
  white: "#ffffff",
  text: "#1A0008",
  textMid: "#6B3048",
  textSub: "#9E7080",
  bg: "#F9F4F6",
  fail: "#A32D2D",
  failBg: "#FCEBEB",
  success: "#2D7A4F",
  successBg: "#EAF4EE",
  warn: "#7A4E00",
  warnBg: "#FEF3DC",
};

// ─── TYPES ───────────────────────────────────────────────────
interface ColumnDef {
  header: string;
  field: string;
  primary?: boolean;
  numeric?: boolean;
  currency?: boolean;
  percent?: boolean;
  date?: boolean;
  badge?: boolean;
}

interface StatDef {
  label: string;
  fn: (rows: Record<string, unknown>[]) => unknown;
  fmt?: string;
}

interface ReportConfig {
  key: string;
  endpoint: string;
  label: string;
  icon: string;
  accent: string;
  columns: ColumnDef[];
  statDefs: StatDef[];
}

// ─── REPORT DEFINITIONS ──────────────────────────────────────
const REPORTS: ReportConfig[] = [
  {
    key: "payment-method",
    endpoint: "/PaymentMethodUsage",
    label: "Payment Method Usage",
    icon: "🏦",
    accent: T.brand,
    columns: [
      { header: "Payment Method", field: "PaymentMethod", primary: true },
      { header: "Total Orders", field: "TotalOrders", numeric: true },
      { header: "Total Revenue", field: "TotalRevenue", currency: true },
      { header: "Usage %", field: "UsagePercent", percent: true },
    ],
    statDefs: [
      { label: "Total Methods", fn: (rows) => rows.length },
      {
        label: "Total Orders",
        fn: (rows) => rows.reduce((s, r) => s + n(r.TotalOrders), 0),
        fmt: "int",
      },
      {
        label: "Total Revenue",
        fn: (rows) => rows.reduce((s, r) => s + n(r.TotalRevenue), 0),
        fmt: "inr",
      },
      {
        label: "Top Method",
        fn: (rows) => (rows[0]?.PaymentMethod as string) ?? "—",
        fmt: "str",
      },
    ],
  },
  {
    key: "return-rate",
    endpoint: "/ReturnRateReason",
    label: "Return Rate by Reason",
    icon: "↩",
    accent: "#C05D00",
    columns: [
      { header: "Return Reason", field: "ReturnReason", primary: true },
      { header: "Total Returns", field: "TotalReturns", numeric: true },
      { header: "Return Value", field: "ReturnValue", currency: true },
    ],
    statDefs: [
      { label: "Return Reasons", fn: (rows) => rows.length },
      {
        label: "Total Returns",
        fn: (rows) => rows.reduce((s, r) => s + n(r.TotalReturns), 0),
        fmt: "int",
      },
      {
        label: "Return Value",
        fn: (rows) => rows.reduce((s, r) => s + n(r.ReturnValue), 0),
        fmt: "inr",
      },
      {
        label: "Top Reason",
        fn: (rows) => (rows[0]?.ReturnReason as string) ?? "—",
        fmt: "str",
      },
    ],
  },
  {
    key: "failed-payment",
    endpoint: "/FailedPaymentReport",
    label: "Failed Payment Report",
    icon: "⊗",
    accent: T.fail,
    columns: [
      { header: "Order ID", field: "OrderId", primary: true },
      { header: "Date", field: "CreatedDate", date: true },
      { header: "Amount", field: "TotalAmount", currency: true },
      { header: "Payment Method", field: "PaymentMethod" },
      { header: "Payment Status", field: "PaymentStatus", badge: true },
      { header: "State", field: "State" },
    ],
    statDefs: [
      { label: "Failed Orders", fn: (rows) => rows.length },
      {
        label: "Total Amount",
        fn: (rows) => rows.reduce((s, r) => s + n(r.TotalAmount), 0),
        fmt: "inr",
      },
      {
        label: "Methods",
        fn: (rows) => new Set(rows.map((r) => r.PaymentMethod)).size,
      },
      {
        label: "Failed Count",
        fn: (rows) =>
          rows.filter((r) => r.PaymentStatus === "Failed").length + " Failed",
      },
    ],
  },
  {
    key: "tax-region",
    endpoint: "/TaxByRegionReport",
    label: "Tax Collected by Region",
    icon: "🏛",
    accent: "#1A5FA5",
    columns: [
      { header: "Region", field: "Region", primary: true },
      { header: "Total Tax", field: "TotalTax", currency: true },
      { header: "Invoice Count", field: "InvoiceCount", numeric: true },
    ],
    statDefs: [
      {
        label: "Active Regions",
        fn: (rows) => rows.filter((r) => n(r.TotalTax) > 0).length,
      },
      {
        label: "Total Tax",
        fn: (rows) => rows.reduce((s, r) => s + n(r.TotalTax), 0),
        fmt: "inr",
      },
      {
        label: "Total Invoices",
        fn: (rows) => rows.reduce((s, r) => s + n(r.InvoiceCount), 0),
        fmt: "int",
      },
      {
        label: "Top Region",
        fn: (rows) => (rows[0]?.Region as string) ?? "—",
        fmt: "str",
      },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────
const n = (v: unknown): number => Number(v) || 0;
const inrFull = (v: unknown): string =>
  "₹" +
  n(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const inrShort = (v: unknown): string => {
  const x = n(v);
  if (x >= 1e7) return "₹" + (x / 1e7).toFixed(2) + " Cr";
  if (x >= 1e5) return "₹" + (x / 1e5).toFixed(2) + " L";
  return "₹" + x.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

function fmtStat(raw: unknown, fmt: string): string {
  if (fmt === "inr") return inrShort(raw);
  if (fmt === "int") return Number(raw).toLocaleString("en-IN");
  return String(raw);
}

function fmtCell(col: ColumnDef, val: unknown): string {
  if (val == null || val === "") return "—";
  if (col.currency) return inrFull(val);
  if (col.percent) return n(val).toFixed(2) + "%";
  if (col.numeric) return n(val).toLocaleString("en-IN");
  if (col.date) {
    try {
      return new Date(String(val)).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function buildFilters(sd: string, ed: string): string {
  const p: string[] = [];
  if (sd) p.push(`StartDate:${sd}`);
  if (ed) p.push(`EndDate:${ed}`);
  return p.join(",");
}

// ─── BADGE ───────────────────────────────────────────────────
const BADGE_MAP: Record<string, { bg: string; color: string }> = {
  Failed: { bg: T.failBg, color: T.fail },
  Pending: { bg: T.warnBg, color: T.warn },
  Cancelled: { bg: "#EDEDED", color: "#555" },
  Paid: { bg: T.successBg, color: T.success },
  Completed: { bg: T.successBg, color: T.success },
  Refunded: { bg: "#E8F0FE", color: "#1A5FA5" },
};

function Badge({ value }: { value: string }) {
  const s = BADGE_MAP[value] ?? { bg: "#EEE", color: "#555" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "3px 11px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

// ─── STAT CARDS ──────────────────────────────────────────────
function StatCards({
  config,
  allRows,
}: {
  config: ReportConfig;
  allRows: Record<string, unknown>[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 12,
        marginBottom: 20,
      }}
    >
      {config.statDefs.map((s, i) => {
        const raw = s.fn(allRows);
        const val = s.fmt ? fmtStat(raw, s.fmt) : raw;
        const isLong = String(val).length > 10;
        return (
          <div
            key={i}
            style={{
              background: T.brandLt,
              borderRadius: 10,
              border: `1px solid ${T.brandMid}`,
              borderTop: `3px solid ${config.accent}`,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: T.textMid,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: isLong ? 13 : 22,
                fontWeight: 700,
                color: T.text,
                lineHeight: 1.2,
              }}
            >
              {String(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGINATION ──────────────────────────────────────────────
function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
    else if (Math.abs(i - page) === 3) pages.push("…");
  }
  const dedupe = pages.filter((p, i) => !(p === "…" && pages[i - 1] === "…"));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 18,
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 12, color: T.textSub }}>
        {Math.min((page - 1) * pageSize + 1, total)}–
        {Math.min(page * pageSize, total)} of {total.toLocaleString("en-IN")}{" "}
        records
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(
          [
            ["‹", page - 1, page === 1],
            ...dedupe.map((p) => [p, p, p === "…" || p === page]),
            ["›", page + 1, page === totalPages],
          ] as [string | number, number, boolean][]
        ).map(([label, target, disabled], i) => (
          <button
            key={i}
            disabled={!!disabled}
            onClick={() => !disabled && onChange(target)}
            style={{
              minWidth: 32,
              height: 32,
              padding: "0 8px",
              border: `1px solid ${label === page ? T.brand : T.brandMid}`,
              borderRadius: 6,
              background: label === page ? T.brand : T.white,
              color: label === page ? T.white : disabled ? T.textSub : T.text,
              fontSize: 13,
              fontWeight: label === page ? 600 : 400,
              cursor: disabled ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {label === "…" ? "…" : label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── DATA TABLE ──────────────────────────────────────────────
function DataTable({
  columns,
  rows,
}: {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}) {
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 10,
        border: `1px solid ${T.brandMid}`,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                style={{
                  padding: "12px 16px",
                  textAlign:
                    col.numeric || col.currency || col.percent
                      ? "right"
                      : "left",
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.white,
                  background: T.brand,
                  fontFamily: "inherit",
                  letterSpacing: 0.3,
                  whiteSpace: "nowrap",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                background:
                  hov === i ? T.brandHov : i % 2 === 0 ? T.white : T.brandLt,
                borderBottom: `1px solid ${T.brandMid}`,
                transition: "background 0.1s",
              }}
            >
              {columns.map((col, j) => {
                const val = row[col.field];
                return (
                  <td
                    key={j}
                    style={{
                      padding: "11px 16px",
                      fontSize: 13,
                      color: T.text,
                      fontWeight: col.primary ? 600 : 400,
                      textAlign:
                        col.numeric || col.currency || col.percent
                          ? "right"
                          : "left",
                      verticalAlign: "middle",
                      whiteSpace: col.primary ? "nowrap" : "normal",
                    }}
                  >
                    {col.badge ? (
                      <Badge value={String(val ?? "")} />
                    ) : (
                      fmtCell(col, val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── LOADING / EMPTY / ERROR ─────────────────────────────────
function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "64px 0",
      }}
    >
      <style>{`@keyframes twirl{to{transform:rotate(360deg)}}`}</style>
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        style={{ animation: "twirl 0.75s linear infinite" }}
      >
        <circle cx="20" cy="20" r="16" stroke={T.brandMid} strokeWidth="4" />
        <path
          d="M20 4a16 16 0 0 1 16 16"
          stroke={T.brand}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ marginTop: 14, fontSize: 13, color: T.textMid }}>
        Fetching report…
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 0",
        color: T.textSub,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: T.brandLt,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="12" cy="12" r="8" stroke={T.brandMid} strokeWidth="2.5" />
          <path
            d="M18 18l7 7"
            stroke={T.brandMid}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: T.failBg,
        border: `1px solid #F5C6C6`,
        borderRadius: 10,
        padding: "13px 18px",
      }}
    >
      <span style={{ color: T.fail, fontSize: 13 }}>⚠ {message}</span>
      <button
        onClick={onRetry}
        style={{
          background: "none",
          border: `1px solid ${T.fail}`,
          borderRadius: 16,
          padding: "4px 14px",
          color: T.fail,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── REPORT PANEL ────────────────────────────────────────────
interface ReportState {
  status: "idle" | "loading" | "success" | "error";
  rows: Record<string, unknown>[];
  allRows: Record<string, unknown>[];
  total: number;
  error: string | null;
}

function ReportPanel({ config }: { config: ReportConfig }) {
  const today = new Date().toISOString().split("T")[0];
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];

  const [sd, setSd] = useState(d30);
  const [ed, setEd] = useState(today);
  const [page, setPage] = useState(1);
  const [st, setSt] = useState<ReportState>({
    status: "idle",
    rows: [],
    allRows: [],
    total: 0,
    error: null,
  });

  const fetchReport = useCallback(
    async (pg: number, s: string, e: string) => {
      setSt((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const f = buildFilters(s, e);
        const { data: json } = await api.get(
          `${REPORT_PREFIX}${config.endpoint}`,
          {
            params: {
              ...(f ? { Filters: f } : {}),
              "Page.Index": pg,
              "Page.Size": PAGE_SIZE,
            },
          },
        );

        const rows: Record<string, unknown>[] = Array.isArray(json)
          ? json
          : json.list ??
            json.Data ??
            json.data ??
            json.Items ??
            json.items ??
            [];
        const total: number = Array.isArray(json)
          ? rows.length
          : Number(
              json.count ??
                json.Count ??
                json.Total ??
                json.total ??
                rows.length,
            );

        setSt((prev) => ({
          status: "success",
          rows,
          allRows: pg === 1 ? rows : prev.allRows,
          total,
          error: null,
        }));
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { detail?: string; message?: string } };
          message?: string;
        };
        const msg =
          axiosErr?.response?.data?.detail ??
          axiosErr?.response?.data?.message ??
          axiosErr?.message ??
          "Unexpected error";
        setSt((prev) => ({ ...prev, status: "error", error: msg }));
      }
    },
    [config.endpoint],
  );

  function handleRun() {
    setPage(1);
    fetchReport(1, sd, ed);
  }
  function handleClear() {
    setSd(d30);
    setEd(today);
    setPage(1);
    setSt({ status: "idle", rows: [], allRows: [], total: 0, error: null });
  }
  function handlePage(p: number) {
    setPage(p);
    fetchReport(p, sd, ed);
  }

  function downloadCSV() {
    if (!st.rows.length) return;
    const hdr = config.columns.map((c) => c.header).join(",");
    const body = st.rows.map((r) =>
      config.columns
        .map((c) => `"${String(r[c.field] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([[hdr, ...body].join("\n")], { type: "text/csv" }),
    );
    a.download = `${config.key}_${sd}_${ed}.csv`;
    a.click();
  }

  const btnBase: CSSProperties = {
    border: "none",
    borderRadius: 20,
    padding: "9px 22px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.15s",
  };

  return (
    <div
      style={{
        background: T.white,
        borderRadius: 16,
        padding: "28px 32px",
        boxShadow: "0 2px 20px rgba(106,1,42,0.07)",
        border: `1px solid ${T.brandMid}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: T.brandLt,
              border: `1px solid ${T.brandMid}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {config.icon}
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: T.text,
                letterSpacing: "-0.3px",
              }}
            >
              {config.label}
            </h2>
            <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>
              {config.endpoint}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleRun}
            disabled={st.status === "loading"}
            style={{
              ...btnBase,
              background: T.brand,
              color: T.white,
              opacity: st.status === "loading" ? 0.65 : 1,
            }}
          >
            {st.status === "loading" ? "Loading…" : "Run Report"}
          </button>
          <button
            onClick={handleClear}
            style={{ ...btnBase, background: T.brandMid, color: T.brand }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 26,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: "14px 20px",
          background: T.brandLt,
          borderRadius: 10,
          border: `1px solid ${T.brandMid}`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: T.textMid,
            fontWeight: 700,
            letterSpacing: 0.5,
            alignSelf: "center",
          }}
        >
          DATE RANGE
        </span>
        {[
          { l: "Start Date", v: sd, s: setSd },
          { l: "End Date", v: ed, s: setEd },
        ].map(({ l, v, s }) => (
          <div
            key={l}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <label style={{ fontSize: 11, color: T.textMid, fontWeight: 500 }}>
              {l}
            </label>
            <input
              type="date"
              value={v}
              max={today}
              onChange={(e) => s(e.target.value)}
              style={{
                border: "none",
                borderBottom: `1.5px solid ${T.brandMid}`,
                background: "transparent",
                padding: "7px 10px",
                fontSize: 13,
                color: T.text,
                outline: "none",
                fontFamily: "inherit",
                minWidth: 155,
                cursor: "pointer",
              }}
            />
          </div>
        ))}
        {st.status === "success" && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: T.textSub,
              alignSelf: "flex-end",
              paddingBottom: 4,
            }}
          >
            {st.total.toLocaleString("en-IN")} record{st.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {st.status === "idle" && (
        <EmptyState text="Select a date range and click Run Report." />
      )}
      {st.status === "loading" && <Spinner />}
      {st.status === "error" && (
        <ErrorBanner message={st.error} onRetry={handleRun} />
      )}
      {st.status === "success" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 14,
            }}
          >
            <button
              onClick={downloadCSV}
              style={{
                ...btnBase,
                background: T.brand,
                color: T.white,
                padding: "7px 16px",
                fontSize: 12,
              }}
            >
              ⬇ Export CSV
            </button>
          </div>
          {st.allRows.length > 0 && (
            <StatCards config={config} allRows={st.allRows} />
          )}
          {st.rows.length === 0 ? (
            <EmptyState text="No data found for the selected date range." />
          ) : (
            <>
              <DataTable columns={config.columns} rows={st.rows} />
              <Pagination
                page={page}
                total={st.total}
                pageSize={PAGE_SIZE}
                onChange={handlePage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function PaymentFinancialReports() {
  const [activeKey, setActive] = useState(REPORTS[0].key);
  const active = REPORTS.find((r) => r.key === activeKey)!;

  const pill = (on: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 18px",
    border: `1.5px solid ${on ? T.brand : T.brandMid}`,
    borderRadius: 30,
    background: on ? T.brand : T.white,
    color: on ? T.white : T.textMid,
    fontWeight: on ? 600 : 400,
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.18s",
    whiteSpace: "nowrap",
    userSelect: "none" as const,
    boxShadow: on ? "0 2px 8px rgba(106,1,42,0.25)" : "none",
  });

  return (
    <div
      style={{
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        background: T.bg,
        minHeight: "100vh",
        padding: "28px 32px",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
          position: "relative",
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.brand,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M12 5l-5 5 5 5"
              stroke={T.brand}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          ← Back
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 21,
            fontWeight: 700,
            color: T.text,
            letterSpacing: "-0.3px",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          💰 Payment &amp; Financial Reports
        </h1>
        <div />
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}
      >
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            style={pill(activeKey === r.key)}
          >
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>
      <ReportPanel key={activeKey} config={active} />
    </div>
  );
}
