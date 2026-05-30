// OrderFulfillmentReports.tsx — fully integrated with corrected API mappings
import { useState, useRef, useEffect, useCallback } from "react";
import api from "@/shared/api/axiosInstance";

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  burgundy: "#6A012A",
  blushPink: "#9D3250",
  heirloomRose: "#CF828E",
  light: "#FFF0F3",
  lightBorder: "#F0D5DB",
  lightHover: "#FFF5F7",
  white: "#FFFFFF",
  text: "#1A1A18",
  textSub: "#7A6A6D",
  green: "#3B6D11", greenBg: "#EAF3DE",
  blue: "#185FA5", blueBg: "#E6F1FB",
  amber: "#854F0B", amberBg: "#FAEEDA",
  red: "#A32D2D", redBg: "#FCEBEB",
  purple: "#6B21A8", purpleBg: "#F3E8FB",
};

// ─── Filter builder ───────────────────────────────────────────────────────────
// Backend expects: Filters query param as JSON string OR flat filters[N].property style
// We send flat style matching the router's _paging() helper
function buildParams(filters: Record<string, any> = {}, pageIndex = 1, pageSize = 200) {
  const params: Record<string, any> = {
    "Page.Index": pageIndex,
    "Page.Size": pageSize,
  };
  let i = 0;
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params[`filters[${i}].property`] = key;
    params[`filters[${i}].comparison`] = "==";
    params[`filters[${i}].value`] = String(value);
    i++;
  }
  return params;
}

// ─── Safe API caller ──────────────────────────────────────────────────────────
async function callAPI(endpoint: string, filters: Record<string, any> = {}) {
  const res = await api.get(`/Report/${endpoint}`, {
    params: buildParams(filters),
  });
  const raw = res.data;
  // Backend returns { list: [...], totalCount: N } via ReportListResponse schema
  const list =
    raw?.list ??
    raw?.data ??
    raw?.items ??
    (Array.isArray(raw) ? raw : []);
  return {
    list: Array.isArray(list) ? list : [],
    meta: raw,
    totalCount: raw?.totalCount ?? raw?.total ?? list.length,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inr = (n: any) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function fmtDate(s: any) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? String(s)
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function firstOfMonthStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

// Flexible field picker — tries multiple casing variants
function pick(obj: any, ...keys: string[]) {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
    // also try camelCase → PascalCase and vice versa
    const pascal = k.charAt(0).toUpperCase() + k.slice(1);
    if (obj[pascal] != null) return obj[pascal];
  }
  return null;
}

function num(v: any, decimals = 0) {
  const n = Number(v ?? 0);
  return isNaN(n) ? "—" : decimals > 0 ? n.toFixed(decimals) : n.toLocaleString("en-IN");
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  Completed: { bg: C.greenBg, color: C.green },
  Delivered: { bg: C.greenBg, color: C.green },
  Confirmed: { bg: C.greenBg, color: C.green },
  Shipped: { bg: C.blueBg, color: C.blue },
  "In Transit": { bg: C.blueBg, color: C.blue },
  Processing: { bg: C.amberBg, color: C.amber },
  Pending: { bg: C.amberBg, color: C.amber },
  "Payment Pending": { bg: C.amberBg, color: C.amber },
  Cancelled: { bg: C.redBg, color: C.red },
  Refunded: { bg: C.redBg, color: C.red },
  Returned: { bg: C.purpleBg, color: C.purple },
  Backordered: { bg: C.redBg, color: C.red },
  "Out of Stock": { bg: C.amberBg, color: C.amber },
  "In Stock": { bg: C.greenBg, color: C.green },
  "Low Stock": { bg: C.amberBg, color: C.amber },
};

function Badge({ label }: { label: string }) {
  const s = STATUS_MAP[label] || { bg: "#F1EFE8", color: C.textSub };
  return (
    <span style={{
      display: "inline-block", background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, padding: "3px 10px",
      borderRadius: 20, whiteSpace: "nowrap",
    }}>
      {label || "—"}
    </span>
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ textAlign: "center", padding: "56px 0" }}>
      <div style={{
        display: "inline-block", width: 34, height: 34,
        border: `3px solid ${C.lightBorder}`, borderTopColor: C.blushPink,
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ marginTop: 10, fontSize: 13, color: C.textSub }}>Loading report…</div>
    </div>
  );
}

function ErrorMsg({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>⚠️ {msg}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ ...pillBtn(C.blushPink), padding: "7px 20px" }}>
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: C.textSub }}>
      <svg width="72" height="72" viewBox="0 0 80 80" fill="none" style={{ opacity: 0.35, marginBottom: 12 }}>
        <circle cx="40" cy="40" r="36" fill="#E0D0D0" />
        <circle cx="36" cy="36" r="14" stroke="#A08080" strokeWidth="4" fill="none" />
        <line x1="46" y1="46" x2="60" y2="60" stroke="#A08080" strokeWidth="4" strokeLinecap="round" />
        <rect x="26" y="56" width="28" height="3" rx="1.5" fill="#A08080" opacity="0.4" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#7A6A6A" }}>No Data Available</div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
        Select filters and click Run to generate report
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function DataTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div style={{ border: `1px solid ${C.lightBorder}`, borderRadius: 10, overflow: "hidden", marginTop: 14 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={i} style={{
                  background: C.heirloomRose, color: "#fff", fontWeight: 600,
                  fontSize: 12, textAlign: "left", padding: "12px 16px", whiteSpace: "nowrap",
                }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: `1px solid ${C.lightBorder}`,
                  background: i % 2 === 0 ? C.white : C.lightHover,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.light)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? C.white : C.lightHover)}
              >
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "10px 16px", color: C.text, verticalAlign: "middle" }}>
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const pillBtn = (bg: string, outline = false): React.CSSProperties => ({
  background: outline ? "transparent" : bg,
  color: outline ? bg : "#fff",
  border: `2px solid ${bg}`,
  borderRadius: 24, padding: "9px 24px",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
  letterSpacing: "0.02em", whiteSpace: "nowrap",
  transition: "opacity 0.15s",
});

function DownloadBar({ onExcel, onPdf }: { onExcel: () => void; onPdf: () => void }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
      <button onClick={onExcel} style={pillBtn(C.blushPink)}>Excel Download</button>
      <button onClick={onPdf} style={pillBtn(C.burgundy)}>PDF Download</button>
    </div>
  );
}

function exportCSV(data: any[], filename: string) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(",")),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename + ".csv";
  a.click();
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({
  start, end, onChange,
}: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const display = (s: string) =>
    s
      ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
      : "—";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: C.light, border: "none", borderBottom: `2px solid ${C.blushPink}`,
          borderRadius: "6px 6px 0 0", padding: "10px 16px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minWidth: 260, gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: C.blushPink, fontWeight: 600, marginBottom: 2 }}>
            Date Range
          </div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
            {display(start)} &nbsp;–&nbsp; {display(end)}
          </div>
        </div>
        <svg width="18" height="18" fill="none" stroke={C.blushPink} strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 999, background: C.white,
          border: `1px solid ${C.lightBorder}`, borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 18, minWidth: 280,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 12, color: C.blushPink, fontWeight: 600 }}>
              Start Date
              <input
                type="date" value={start} max={end || todayStr()}
                onChange={e => onChange(e.target.value, end)}
                style={{
                  display: "block", marginTop: 4, width: "100%", padding: "7px 10px",
                  border: `1px solid ${C.lightBorder}`, borderRadius: 6, fontSize: 13, outline: "none",
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: C.blushPink, fontWeight: 600 }}>
              End Date
              <input
                type="date" value={end} min={start} max={todayStr()}
                onChange={e => onChange(start, e.target.value)}
                style={{
                  display: "block", marginTop: 4, width: "100%", padding: "7px 10px",
                  border: `1px solid ${C.lightBorder}`, borderRadius: 6, fontSize: 13, outline: "none",
                }}
              />
            </label>
            <button onClick={() => setOpen(false)} style={pillBtn(C.blushPink)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Type Dropdown ────────────────────────────────────────────────────────────
function TypeDropdown({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 300 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: C.light, border: "none", borderBottom: `2px solid ${C.burgundy}`,
          borderRadius: "6px 6px 0 0", padding: "10px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: C.burgundy, fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</div>
        </div>
        <svg width="14" height="14" fill={C.burgundy} viewBox="0 0 20 20">
          <path d="M5 8l5 5 5-5z" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 999, background: C.white,
          border: `1px solid ${C.lightBorder}`, borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: "100%",
        }}>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                padding: "12px 16px", fontSize: 14, cursor: "pointer",
                background: opt === value ? C.light : C.white, color: C.text,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: `1px solid ${C.lightBorder}`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.lightHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt === value ? C.light : C.white; }}
            >
              {opt}
              {opt === value && (
                <svg width="16" height="16" fill="none" stroke={C.blushPink} strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter Row ───────────────────────────────────────────────────────────────
function FilterRow({
  children, onRun, onClear, running,
}: { children: React.ReactNode; onRun: () => void; onClear: () => void; running: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      flexWrap: "wrap", gap: 14, marginBottom: 16,
    }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        {children}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onRun} disabled={running} style={{ ...pillBtn(C.blushPink), opacity: running ? 0.7 : 1 }}>
          {running ? "Running…" : "Run"}
        </button>
        <button onClick={onClear} style={pillBtn(C.burgundy)}>Clear All</button>
      </div>
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────
function StatCards({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
      gap: 12, marginBottom: 16,
    }}>
      {items.map(({ label, value }) => (
        <div key={label} style={{
          background: C.light, border: `1px solid ${C.lightBorder}`,
          borderRadius: 10, padding: "14px 18px",
        }}>
          <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.blushPink, marginTop: 4 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ORDER SUMMARY
// Backend: GET /Report/OrderSummary
// Returns: { list: [{ OrderStatus, TotalOrders, TotalRevenue, AvgOrderValue }] }
// — grouped by State (not individual orders)
// ═══════════════════════════════════════════════════════════════════════════════
function OrderSummaryPanel() {
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      // Backend filters: StartDate and EndDate for date-range filtering
      const { list } = await callAPI("OrderSummary", {
        StartDate: start,
        EndDate: end,
      });
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  function clear() {
    setRows([]); setRan(false); setError(null);
    setStart(firstOfMonthStr()); setEnd(todayStr());
  }

  // Aggregate totals from grouped rows
  const totalOrders = rows.reduce((s, r) => s + Number(pick(r, "TotalOrders", "totalOrders") ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(pick(r, "TotalRevenue", "totalRevenue") ?? 0), 0);
  const avgOrderVal = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && rows.length > 0 && (
        <>
          <StatCards items={[
            { label: "Total Orders", value: totalOrders.toLocaleString("en-IN") },
            { label: "Total Revenue", value: inr(totalRevenue) },
            { label: "Avg Order Value", value: inr(avgOrderVal) },
          ]} />
          <DownloadBar
            onExcel={() => exportCSV(rows, "order_summary")}
            onPdf={() => alert("PDF export")}
          />
          <DataTable
            cols={["Order Status", "Total Orders", "Total Revenue", "Avg Order Value"]}
            rows={rows.map(r => [
              // Backend returns o."State" AS "OrderStatus"
              <Badge label={pick(r, "OrderStatus", "orderStatus", "State", "state") ?? "—"} />,
              num(pick(r, "TotalOrders", "totalOrders")),
              inr(pick(r, "TotalRevenue", "totalRevenue")),
              inr(pick(r, "AvgOrderValue", "avgOrderValue")),
            ])}
          />
        </>
      )}
      {!loading && !error && ran && rows.length === 0 && <EmptyState />}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SHIPPING STATUS
// Backend: GET /Report/OrderShippingStatus
// Returns: { list: [{ OrderId, CreatedDate, OrderState, TrackingNumber,
//                     ShipmentStatus, CourierName, EstimatedDeliveryDate }] }
// NOTE: No "destination" in backend — omitted from table
// ═══════════════════════════════════════════════════════════════════════════════
function ShippingStatusPanel() {
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("OrderShippingStatus", {
        StartDate: start,
        EndDate: end,
      });
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  function clear() {
    setRows([]); setRan(false); setError(null);
    setStart(firstOfMonthStr()); setEnd(todayStr());
  }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && rows.length > 0 && (
        <>
          <DownloadBar
            onExcel={() => exportCSV(rows, "shipping_status")}
            onPdf={() => alert("PDF export")}
          />
          <DataTable
            cols={["Order ID", "Order Date", "Tracking ID", "Shipment Status", "Payment Mode", "Shipment Amount", "Qty", "Invoice No.", "Invoice Date", "Order State"]}
            rows={rows.map(r => [
              pick(r, "OrderId", "orderId"),
              fmtDate(pick(r, "CreatedDate", "createdDate")),
              <code style={{ fontSize: 11, background: C.light, padding: "2px 6px", borderRadius: 4 }}>
                {pick(r, "TrackingNumber", "trackingNumber", "TrackingId", "trackingId") ?? "—"}
              </code>,
              <Badge label={pick(r, "ShipmentStatus", "shipmentStatus") ?? "—"} />,
              pick(r, "PaymentMode", "paymentMode") ?? "—",
              inr(pick(r, "ShipmentAmount", "shipmentAmount", "TotalAmount", "totalAmount")),
              pick(r, "Quantity", "quantity") ?? "—",
              pick(r, "InvoiceNumber", "invoiceNumber") ?? "—",
              fmtDate(pick(r, "InvoiceDate", "invoiceDate")),
              <Badge label={pick(r, "OrderState", "orderState") ?? "—"} />,
            ])}
          />
        </>
      )}
      {!loading && !error && ran && rows.length === 0 && <EmptyState />}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AVERAGE ORDER VALUE
// Backend: GET /Report/AverageOrderValue
// Returns: { list: [{ Month, OrderCount, AvgOrderValue, TotalRevenue }] }
// — monthly breakdown, not a single aggregate row
// ═══════════════════════════════════════════════════════════════════════════════
function AOVPanel() {
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("AverageOrderValue", {
        StartDate: start,
        EndDate: end,
      });
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  function clear() {
    setRows([]); setRan(false); setError(null);
    setStart(firstOfMonthStr()); setEnd(todayStr());
  }

  // Aggregate across all monthly rows for summary cards
  const totalOrders = rows.reduce((s, r) => s + Number(pick(r, "OrderCount", "orderCount") ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(pick(r, "TotalRevenue", "totalRevenue") ?? 0), 0);
  const overallAOV = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && rows.length > 0 && (
        <>
          <StatCards items={[
            { label: "Total Orders", value: totalOrders.toLocaleString("en-IN") },
            { label: "Total Revenue", value: inr(totalRevenue) },
            { label: "Overall AOV", value: inr(overallAOV) },
            { label: "Months in Range", value: rows.length.toString() },
          ]} />
          <DownloadBar
            onExcel={() => exportCSV(rows, "aov_report")}
            onPdf={() => alert("PDF export")}
          />
          <DataTable
            cols={["Month", "Order Count", "Avg Order Value", "Total Revenue"]}
            rows={rows.map(r => [
              // Backend: DATE_TRUNC('month', ...) AS "Month"
              fmtDate(pick(r, "Month", "month")),
              // Backend: COUNT(OrderId) AS "OrderCount"
              num(pick(r, "OrderCount", "orderCount")),
              // Backend: AVG(TotalAmount) AS "AvgOrderValue"
              inr(pick(r, "AvgOrderValue", "avgOrderValue")),
              // Backend: SUM(TotalAmount) AS "TotalRevenue"
              inr(pick(r, "TotalRevenue", "totalRevenue")),
            ])}
          />
        </>
      )}
      {!loading && !error && ran && rows.length === 0 && <EmptyState />}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ORDER FULFILLMENT TIME
// Backend: GET /Report/OrderFulfillment
// Returns: { list: [{ OrderId, CreatedDate, OrderState, ShipmentStatus, FulfillmentHours }] }
// NOTE: Backend has no "Type" filter — the dropdown selects a view mode on the frontend
//       Basic = per-order rows | Summary = aggregated avg | By Platform = grouped (future)
// ═══════════════════════════════════════════════════════════════════════════════
const FULFILLMENT_TYPES = [
  "Per-Order Fulfillment Details",
  "Summary: Average Fulfillment Time",
  "Fulfillment by Shipment Status",
];

function FulfillmentPanel() {
  const [type, setType] = useState(FULFILLMENT_TYPES[0]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      // Backend has no Type param — fetch all and transform on frontend
      const { list } = await callAPI("OrderFulfillment");
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function clear() {
    setRows([]); setRan(false); setError(null); setType(FULFILLMENT_TYPES[0]);
  }

  // Derived views from raw fulfillment data
  const rowsWithCalc = rows.map(r => {
    const hrs = Number(pick(r, "FulfillmentHours", "fulfillmentHours") ?? 0);
    return { ...r, _hrs: hrs, _days: parseFloat((hrs / 24).toFixed(2)) };
  });

  // Summary: average fulfillment time
  const avgHrs = rowsWithCalc.length
    ? rowsWithCalc.reduce((s, r) => s + r._hrs, 0) / rowsWithCalc.length
    : 0;
  const avgDays = parseFloat((avgHrs / 24).toFixed(2));

  // By-status grouping
  const byStatus: Record<string, { count: number; totalHrs: number }> = {};
  for (const r of rowsWithCalc) {
    const status = pick(r, "ShipmentStatus", "shipmentStatus", "OrderState", "orderState") ?? "Unknown";
    if (!byStatus[status]) byStatus[status] = { count: 0, totalHrs: 0 };
    byStatus[status].count++;
    byStatus[status].totalHrs += r._hrs;
  }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="View Type" value={type} options={FULFILLMENT_TYPES} onChange={setType} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}

      {!loading && !error && ran && (
        <>
          {/* Summary view */}
          {type === FULFILLMENT_TYPES[1] && rows.length > 0 && (
            <>
              <StatCards items={[
                { label: "Total Orders", value: rows.length.toLocaleString("en-IN") },
                { label: "Avg Fulfillment", value: `${avgHrs.toFixed(1)} hrs` },
                { label: "Avg Fulfillment", value: `${avgDays} days` },
              ]} />
              <DownloadBar
                onExcel={() => exportCSV([{ totalOrders: rows.length, avgFulfillmentHrs: avgHrs, avgFulfillmentDays: avgDays }], "fulfillment_summary")}
                onPdf={() => alert("PDF export")}
              />
              <DataTable
                cols={["Metric", "Value"]}
                rows={[
                  ["Total Orders Analyzed", rows.length.toLocaleString("en-IN")],
                  ["Average Fulfillment Time (Hrs)", avgHrs.toFixed(2)],
                  ["Average Fulfillment Time (Days)", avgDays.toFixed(2)],
                  ["Fastest Fulfillment", `${Math.min(...rowsWithCalc.map(r => r._hrs)).toFixed(2)} hrs`],
                  ["Slowest Fulfillment", `${Math.max(...rowsWithCalc.map(r => r._hrs)).toFixed(2)} hrs`],
                ]}
              />
            </>
          )}

          {/* By-status view */}
          {type === FULFILLMENT_TYPES[2] && rows.length > 0 && (
            <>
              <DownloadBar
                onExcel={() => exportCSV(
                  Object.entries(byStatus).map(([status, d]) => ({
                    status, orderCount: d.count, avgFulfillmentHrs: (d.totalHrs / d.count).toFixed(2),
                  })),
                  "fulfillment_by_status"
                )}
                onPdf={() => alert("PDF export")}
              />
              <DataTable
                cols={["Shipment Status", "Order Count", "Avg Fulfillment (Hrs)", "Avg Fulfillment (Days)"]}
                rows={Object.entries(byStatus).map(([status, d]) => {
                  const avg = d.totalHrs / d.count;
                  return [
                    <Badge label={status} />,
                    d.count.toLocaleString("en-IN"),
                    avg.toFixed(2),
                    (avg / 24).toFixed(2),
                  ];
                })}
              />
            </>
          )}

          {/* Per-order view (default) */}
          {type === FULFILLMENT_TYPES[0] && (
            <>
              {rows.length > 0 && (
                <DownloadBar
                  onExcel={() => exportCSV(rowsWithCalc, "fulfillment_details")}
                  onPdf={() => alert("PDF export")}
                />
              )}
              <DataTable
                // Backend: OrderId, CreatedDate, OrderState, ShipmentStatus, FulfillmentHours
                cols={["Order ID", "Order Date", "Order State", "Shipment Status", "Fulfillment (Hrs)", "Fulfillment (Days)"]}
                rows={rowsWithCalc.map(r => [
                  pick(r, "OrderId", "orderId"),
                  fmtDate(pick(r, "CreatedDate", "createdDate")),
                  <Badge label={pick(r, "OrderState", "orderState") ?? "—"} />,
                  <Badge label={pick(r, "ShipmentStatus", "shipmentStatus") ?? "—"} />,
                  r._hrs.toFixed(2),
                  r._days.toFixed(2),
                ])}
              />
            </>
          )}

          {rows.length === 0 && <EmptyState />}
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. BACKORDERED / OUT-OF-STOCK
// Backend: GET /Report/StockBackOrder
// Returns: { list: [{ ProductName, ProductVariantDetailId, StockQuantity, PendingOrders }] }
// NOTE: Backend returns product-level stock data (not order-level with customer info)
//       Frontend adapts accordingly — "Backordered" = PendingOrders > 0 && StockQuantity == 0
//       No Type filter on backend — frontend derives the two views from StockQuantity
// ═══════════════════════════════════════════════════════════════════════════════
const BACKORDER_TYPES = ["Out-of-Stock Items", "Items with Pending Orders"];

function BackorderPanel() {
  const [type, setType] = useState(BACKORDER_TYPES[0]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      // Backend returns all zero-stock items; no Type param needed
      const { list } = await callAPI("StockBackOrder");
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function clear() {
    setRows([]); setRan(false); setError(null); setType(BACKORDER_TYPES[0]);
  }

  // Filter frontend view by type
  const filteredRows = rows.filter(r => {
    const qty = Number(pick(r, "StockQuantity", "stockQuantity") ?? 0);
    const pending = Number(pick(r, "PendingOrders", "pendingOrders") ?? 0);
    if (type === BACKORDER_TYPES[0]) return qty === 0;               // Out-of-stock
    return pending > 0;                                              // Has pending orders
  });

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="View Type" value={type} options={BACKORDER_TYPES} onChange={setType} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          {filteredRows.length > 0 && (
            <>
              <StatCards items={[
                { label: "Total Products", value: filteredRows.length.toLocaleString("en-IN") },
                { label: "Total Pending Ord.", value: filteredRows.reduce((s, r) => s + Number(pick(r, "PendingOrders", "pendingOrders") ?? 0), 0).toLocaleString("en-IN") },
              ]} />
              <DownloadBar
                onExcel={() => exportCSV(filteredRows, "backorder_report")}
                onPdf={() => alert("PDF export")}
              />
            </>
          )}
          <DataTable
            // Backend: ProductName, ProductVariantDetailId, StockQuantity, PendingOrders
            cols={["Product Name", "Variant ID", "Stock Qty", "Pending Orders", "Status"]}
            rows={filteredRows.map(r => {
              const qty = Number(pick(r, "StockQuantity", "stockQuantity") ?? 0);
              const pending = Number(pick(r, "PendingOrders", "pendingOrders") ?? 0);
              const status = qty === 0 && pending > 0 ? "Backordered" : qty === 0 ? "Out of Stock" : "In Stock";
              return [
                pick(r, "ProductName", "productName") ?? "—",
                pick(r, "ProductVariantDetailId", "productVariantDetailId") ?? "—",
                qty,
                pending,
                <Badge label={status} />,
              ];
            })}
          />
          {filteredRows.length === 0 && <EmptyState />}
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RETURN RATE AND REASONS
// Backend: No endpoint exists yet — component shows a "Coming Soon" notice
// while still being accessible in the nav. Once the backend endpoint is added,
// swap the callAPI call below and remove the notice.
// Expected endpoint: GET /Report/ReturnRateReason?filters[0].property=Type&...
// Expected response for "Return Rate by Product":
//   { list: [{ ProductName, TotalSold, TotalReturned, ReturnRate, RevenueImpact }] }
// Expected response for "Top Return Reasons":
//   { list: [{ Reason, Count, Rate, Trend, Impact }] }
// ═══════════════════════════════════════════════════════════════════════════════
const RETURN_TYPES = ["Return Rate by Product", "Top Return Reasons"];

function ReturnRatePanel() {
  const [type, setType] = useState(RETURN_TYPES[0]);
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setRan(true);
    try {
      // ⚠️ Backend endpoint not yet implemented.
      // When available, replace with: await callAPI("ReturnRateReason", { Type: type, StartDate: start, EndDate: end })
      const { list } = await callAPI("ReturnRateReason", {
        Type: type,
        StartDate: start,
        EndDate: end,
      });
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "Return rate report endpoint not yet available"
      );
    } finally {
      setLoading(false);
    }
  }, [type, start, end]);

  function clear() {
    setRows([]); setRan(false); setError(null);
    setType(RETURN_TYPES[0]); setStart(firstOfMonthStr()); setEnd(todayStr());
  }

  const byProduct = type === RETURN_TYPES[0];

  return (
    <>
      {/* Pending backend notice */}
      <div style={{
        background: C.amberBg, border: `1px solid #E8C97A`, borderRadius: 8,
        padding: "10px 16px", marginBottom: 14, fontSize: 12, color: C.amber,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span>
          <strong>Backend endpoint pending:</strong> The <code>/Report/ReturnRateReason</code> route
          has not been implemented yet. This panel will display live data once it is added.
        </span>
      </div>

      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="Select Type" value={type} options={RETURN_TYPES} onChange={setType} />
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && rows.length > 0 && (
        <>
          <DownloadBar
            onExcel={() => exportCSV(rows, "return_rate")}
            onPdf={() => alert("PDF export")}
          />
          {byProduct ? (
            <DataTable
              // API: ReturnReason, TotalReturns, ReturnValue
              cols={["Return Reason", "Total Returns", "Return Value"]}
              rows={rows.map(r => [
                pick(r, "ReturnReason", "returnReason", "ProductName", "productName") ?? "—",
                pick(r, "TotalReturns", "totalReturns", "TotalReturned", "totalReturned") ?? 0,
                inr(pick(r, "ReturnValue", "returnValue", "RevenueImpact", "revenueImpact")),
              ])}
            />
          ) : (
            <DataTable
              // API: ReturnReason, TotalReturns, ReturnValue
              cols={["Reason", "Total Returns", "Return Value"]}
              rows={rows.map(r => [
                pick(r, "ReturnReason", "returnReason", "Reason", "reason") ?? "—",
                pick(r, "TotalReturns", "totalReturns", "Count", "count") ?? 0,
                inr(pick(r, "ReturnValue", "returnValue", "Impact", "impact")),
              ])}
            />
          )}
        </>
      )}
      {!loading && !error && ran && rows.length === 0 && <EmptyState />}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── Report Config ────────────────────────────────────────────────────────────
const REPORTS = [
  {
    id: "summary", label: "Order Summary Report", sub: "Grouped by order status",
    Panel: OrderSummaryPanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    id: "shipping", label: "Shipping Status Report", sub: "Shipment tracking & status",
    Panel: ShippingStatusPanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" /><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6" /></svg>,
  },
  {
    id: "aov", label: "Average Order Value", sub: "Monthly AOV & revenue breakdown",
    Panel: AOVPanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: "fulfillment", label: "Order Fulfillment Time", sub: "Processing & shipping speed",
    Panel: FulfillmentPanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: "backorder", label: "Backordered / Out-of-Stock", sub: "Inventory shortage tracking",
    Panel: BackorderPanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h10M3 14h6m11-4v8m0 0l-3-3m3 3l3-3" /></svg>,
  },
  {
    id: "returns", label: "Return Rate and Reasons", sub: "Product & reason breakdown",
    Panel: ReturnRatePanel,
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  },
];

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function OrderFulfillmentReports() {
  const [active, setActive] = useState(REPORTS[0].id);
  const report = REPORTS.find(r => r.id === active)!;
  const Panel = report.Panel;

  return (
    <div style={{ minHeight: "100vh", background: "#F7F3F4", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.88; }
        input[type=date]:focus { outline: 2px solid ${C.blushPink}; border-radius: 4px; }
        code { font-family: 'SF Mono', 'Consolas', monospace; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.lightBorder}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, marginBottom: 12 }}>
            <button style={{ background: "none", border: "none", color: C.blushPink, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ← Reports
            </button>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, textAlign: "center", marginBottom: 20 }}>
            📦 Order &amp; Fulfillment Reports
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingBottom: 20 }}>
            {REPORTS.map(r => {
              const isActive = active === r.id;
              return (
                <button key={r.id} onClick={() => setActive(r.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 30, textAlign: "left",
                  border: `2px solid ${isActive ? C.blushPink : C.lightBorder}`,
                  background: isActive ? C.light : C.white,
                  color: isActive ? C.burgundy : C.textSub,
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: isActive ? `0 2px 10px rgba(157,50,80,0.15)` : "none",
                }}>
                  <span style={{ color: isActive ? C.blushPink : C.heirloomRose, flexShrink: 0 }}>{r.icon}</span>
                  <div>
                    <div style={{ lineHeight: 1.3 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: C.heirloomRose, fontWeight: 400, marginTop: 1 }}>{r.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 24px" }}>
        <div style={{
          background: C.white, borderRadius: 14, border: `1px solid ${C.lightBorder}`,
          padding: "26px 28px", boxShadow: "0 2px 12px rgba(106,1,42,0.06)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 22, paddingBottom: 16, borderBottom: `1px solid ${C.lightBorder}`,
          }}>
            <span style={{ color: C.blushPink }}>{report.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{report.label}</div>
              <div style={{ fontSize: 12, color: C.heirloomRose, marginTop: 2 }}>{report.sub}</div>
            </div>
          </div>
          <Panel key={active} />
        </div>
      </div>
    </div>
  );
}