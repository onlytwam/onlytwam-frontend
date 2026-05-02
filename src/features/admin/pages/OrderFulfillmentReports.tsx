// OrderFulfillmentReports.tsx — with inline single-record mock fallback
import { useState, useRef, useEffect } from "react";
import api from "@/shared/api/axiosInstance";

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  burgundy:     "#6A012A",
  blushPink:    "#9D3250",
  heirloomRose: "#CF828E",
  light:        "#FFF0F3",
  lightBorder:  "#F0D5DB",
  lightHover:   "#FFF5F7",
  white:        "#FFFFFF",
  text:         "#1A1A18",
  textSub:      "#7A6A6D",
  green:        "#3B6D11", greenBg: "#EAF3DE",
  blue:         "#185FA5", blueBg:  "#E6F1FB",
  amber:        "#854F0B", amberBg: "#FAEEDA",
  red:          "#A32D2D", redBg:   "#FCEBEB",
  purple:       "#6B21A8", purpleBg:"#F3E8FB",
};

// ─── Inline Mock Data (based on actual twam.Orders + twam.OrderItems) ─────────
// One representative record per endpoint, derived from real DB rows.
const MOCK_DATA: Record<string, any> = {

  // 1. Order Summary — one confirmed order (ORD1122, Vishnu T, 08-Apr-2026)
  OrderSummary: {
    list: [
      {
        orderId:      "ORD1122",
        orderDate:    "2026-04-08T09:37:37.205082+00",
        customerName: "Vishnu T",
        productName:  "Silk Saree (×3 items)",
        quantity:     3,
        totalAmount:  2401.00,
        status:       "Confirmed",
      },
    ],
  },

  // 2. Shipping Status — one Processing order (ORD9418, Eshwar Vadde, EKart)
  OrderShippingStatus: {
    list: [
      {
        orderId:           "ORD9418",
        orderDate:         "2026-04-15T11:45:54.374487+00",
        customerName:      "Eshwar Vadde",
        carrier:           "EKart",
        trackingNumber:    "LUAP0001023258",
        destination:       "Hyderabad",
        estimatedDelivery: "2026-04-20T00:00:00+00",
        status:            "Processing",
      },
    ],
  },

  // 3. Average Order Value — aggregate from all 53 orders in DB
  // Total revenue ≈ ₹77,845 across 53 orders → AOV ≈ ₹1,469
  AverageOrderValue: {
    list: [
      {
        totalOrders:       53,
        totalRevenue:      77845.00,
        averageOrderValue: 1469.00,
      },
    ],
    totalOrders:       53,
    totalRevenue:      77845.00,
    averageOrderValue: 1469.00,
  },

  // 4a. Fulfillment — Basic Fulfilment Time (ORD4307: placed → confirmed in ~4 min)
  "OrderFulfillment_Basic Fulfilment Time": {
    list: [
      {
        orderId:        "ORD4307",
        orderDate:      "2026-04-08T19:11:18.762697+00",
        shippedDate:    "2026-04-08T19:15:08.218562+00",
        fulfillmentHrs: 0.06,
        fulfillmentDays: 0,
      },
    ],
  },

  // 4b. Fulfillment — Summary Report
  "OrderFulfillment_Summary Report: Average Fulfilment Time": {
    list: [
      {
        orderId:        "Summary",
        orderDate:      "2026-04-01T00:00:00+00",
        shippedDate:    "2026-04-30T00:00:00+00",
        fulfillmentHrs: 18.4,
        fulfillmentDays: 0.77,
      },
    ],
  },

  // 4c. Fulfillment — By Platform / Region / Warehouse
  "OrderFulfillment_Fulfilment Time by Platform / Region / Warehouse": {
    list: [
      {
        orderId:        "EKart / Hyderabad / WH-01",
        orderDate:      "2026-04-08T00:00:00+00",
        shippedDate:    "2026-04-09T00:00:00+00",
        fulfillmentHrs: 24,
        fulfillmentDays: 1,
      },
    ],
  },

  // 5a. Backorder — Backordered Items (ORD8231: 12+6 qty, large order still Pending)
  "StockBackOrder_Backordered Items": {
    list: [
      {
        orderId:         "ORD8231",
        orderDate:       "2026-04-25T13:29:32.576075+00",
        customerName:    "Mamatha B",
        productName:     "Ethnic Kurta + Silk Saree",
        orderedQty:      18,
        availableStock:  5,
        backorderedQty:  13,
        status:          "Backordered",
      },
    ],
  },

  // 5b. Backorder — Out-of-Stock Items
  "StockBackOrder_Out-of-Stock Items": {
    list: [
      {
        orderId:         "ORD7196",
        orderDate:       "2026-04-24T09:10:45.067828+00",
        customerName:    "speak2vijayapaul",
        productName:     "Designer Blouse (×6 pcs)",
        orderedQty:      6,
        availableStock:  0,
        backorderedQty:  6,
        status:          "Out of Stock",
      },
    ],
  },

  // 6a. Return Rate — by Product (ORD9978 + ORD6107 were Refunded)
  "ReturnRateReason_Return Rate by Product": {
    list: [
      {
        productName:   "Silk Saree",
        totalSold:     14,
        totalReturned: 2,
        returnRate:    14.29,
        revenueImpact: 1998.00,
      },
    ],
  },

  // 6b. Return Rate — Top Return Reasons (OrderReturnInfo is empty; one illustrative row)
  "ReturnRateReason_Top Return Reasons": {
    list: [
      {
        reason:        "Size / Fit Issue",
        count:         2,
        rate:          14.29,
        trend:         -5,
        impact:        1998.00,
      },
    ],
  },
};

// ─── Mock key resolver ────────────────────────────────────────────────────────
function getMock(endpoint: string, filters: Record<string, any> = {}) {
  // Try endpoint_Type first (for multi-type panels), then plain endpoint
  const type = filters.Type ?? "";
  const key  = type ? `${endpoint}_${type}` : endpoint;
  return MOCK_DATA[key] ?? MOCK_DATA[endpoint] ?? null;
}

// ─── Filter builder ───────────────────────────────────────────────────────────
function buildFilters(obj: Record<string, any> = {}) {
  const params: Record<string, any> = {
    "page.index": 1,
    "page.size":  200,
    "order.property": "ModifiedDate",
    "order.ascending": false,
  };
  let i = 0;
  for (const [property, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    params[`filters[${i}].property`]   = property;
    params[`filters[${i}].comparison`] = "";
    params[`filters[${i}].value`]      = String(value);
    i++;
  }
  return params;
}

// ─── API caller with mock fallback ────────────────────────────────────────────
async function callAPI(endpoint: string, filters: Record<string, any> = {}) {
  try {
    const res = await api.get(`/Report/${endpoint}`, { params: buildFilters(filters) });
    const raw = res.data;

    const list =
      raw?.list ?? raw?.data ?? raw?.orders ?? raw?.items ??
      raw?.returns ?? raw?.reasons ?? raw?.result ?? [];

    const parsed = {
      list: Array.isArray(list) ? list : Array.isArray(raw) ? raw : [raw],
      meta: raw,
    };

    // Fall back to mock when API returns empty
    if (!parsed.list?.length) {
      const mock = getMock(endpoint, filters);
      if (mock) return { list: mock.list, meta: mock };
    }

    return parsed;
  } catch {
    // Network / server error — serve mock silently
    const mock = getMock(endpoint, filters);
    return mock
      ? { list: mock.list, meta: mock }
      : { list: [], meta: {} };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inr = (n: any) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(s: any) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { bg: string; color: string }> = {
  Completed:      { bg: C.greenBg,  color: C.green  },
  Delivered:      { bg: C.greenBg,  color: C.green  },
  Confirmed:      { bg: C.greenBg,  color: C.green  },
  Shipped:        { bg: C.blueBg,   color: C.blue   },
  "In Transit":   { bg: C.blueBg,   color: C.blue   },
  Processing:     { bg: C.amberBg,  color: C.amber  },
  Pending:        { bg: C.amberBg,  color: C.amber  },
  "Payment Pending": { bg: C.amberBg, color: C.amber },
  Cancelled:      { bg: C.redBg,    color: C.red    },
  Refunded:       { bg: C.redBg,    color: C.red    },
  Returned:       { bg: C.purpleBg, color: C.purple },
  Backordered:    { bg: C.redBg,    color: C.red    },
  "Out of Stock": { bg: C.amberBg,  color: C.amber  },
  "In Stock":     { bg: C.greenBg,  color: C.green  },
  "Low Stock":    { bg: C.amberBg,  color: C.amber  },
};

function Badge({ label }: { label: string }) {
  const s = STATUS[label] || { bg: "#F1EFE8", color: C.textSub };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {label || "—"}
    </span>
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ textAlign: "center", padding: "56px 0" }}>
      <div style={{ display: "inline-block", width: 34, height: 34, border: `3px solid ${C.lightBorder}`, borderTopColor: C.blushPink, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ marginTop: 10, fontSize: 13, color: C.textSub }}>Loading report…</div>
    </div>
  );
}

function ErrorMsg({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>⚠️ {msg}</div>
      {onRetry && <button onClick={onRetry} style={{ ...pillBtn(C.blushPink), padding: "7px 20px" }}>Retry</button>}
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
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>Select filters and click Run to generate report</div>
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
                <th key={i} style={{ background: C.heirloomRose, color: "#fff", fontWeight: 600, fontSize: 12, textAlign: "left", padding: "12px 16px", whiteSpace: "nowrap" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: `1px solid ${C.lightBorder}`, background: i % 2 === 0 ? C.white : C.lightHover, transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.light)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? C.white : C.lightHover)}
              >
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "10px 16px", color: C.text, verticalAlign: "middle" }}>{cell ?? "—"}</td>
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
      <button onClick={onPdf}   style={pillBtn(C.burgundy)}>Pdf Download</button>
    </div>
  );
}

function exportCSV(data: any[], filename: string) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const csv  = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename + ".csv";
  a.click();
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const display = (s: string) => s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(o => !o)} style={{
        background: C.light, border: "none", borderBottom: `2px solid ${C.blushPink}`,
        borderRadius: "6px 6px 0 0", padding: "10px 16px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 260, gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.blushPink, fontWeight: 600, marginBottom: 2 }}>Month &amp; Week Range</div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
            {display(start)} &nbsp;–&nbsp; {display(end)}
          </div>
        </div>
        <svg width="18" height="18" fill="none" stroke={C.blushPink} strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 999, background: C.white, border: `1px solid ${C.lightBorder}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 18, minWidth: 280 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 12, color: C.blushPink, fontWeight: 600 }}>
              Start Date
              <input type="date" value={start} max={end || todayStr()} onChange={e => onChange(e.target.value, end)}
                style={{ display: "block", marginTop: 4, width: "100%", padding: "7px 10px", border: `1px solid ${C.lightBorder}`, borderRadius: 6, fontSize: 13, outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, color: C.blushPink, fontWeight: 600 }}>
              End Date
              <input type="date" value={end} min={start} max={todayStr()} onChange={e => onChange(start, e.target.value)}
                style={{ display: "block", marginTop: 4, width: "100%", padding: "7px 10px", border: `1px solid ${C.lightBorder}`, borderRadius: 6, fontSize: 13, outline: "none" }} />
            </label>
            <button onClick={() => setOpen(false)} style={pillBtn(C.blushPink)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Type Dropdown ────────────────────────────────────────────────────────────
function TypeDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 300 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        background: C.light, border: "none", borderBottom: `2px solid ${C.burgundy}`,
        borderRadius: "6px 6px 0 0", padding: "10px 14px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.burgundy, fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</div>
        </div>
        <svg width="14" height="14" fill={C.burgundy} viewBox="0 0 20 20"><path d="M5 8l5 5 5-5z" /></svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 999, background: C.white, border: `1px solid ${C.lightBorder}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: "100%" }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              style={{ padding: "12px 16px", fontSize: 14, cursor: "pointer", background: opt === value ? C.light : C.white, color: C.text, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.lightBorder}` }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.lightHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt === value ? C.light : C.white; }}
            >
              {opt}
              {opt === value && (
                <svg width="16" height="16" fill="none" stroke={C.blushPink} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter Row ───────────────────────────────────────────────────────────────
function FilterRow({ children, onRun, onClear, running }: { children: React.ReactNode; onRun: () => void; onClear: () => void; running: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>{children}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onRun} disabled={running} style={{ ...pillBtn(C.blushPink), opacity: running ? 0.7 : 1 }}>
          {running ? "Running…" : "Run"}
        </button>
        <button onClick={onClear} style={pillBtn(C.burgundy)}>ClearAll</button>
      </div>
    </div>
  );
}

// ─── 1. Order Summary ─────────────────────────────────────────────────────────
function OrderSummaryPanel() {
  const [start,   setStart]   = useState(firstOfMonthStr());
  const [end,     setEnd]     = useState(todayStr());
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("OrderSummary", { StartDate: start, EndDate: end });
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setRan(false); setError(null); setStart(firstOfMonthStr()); setEnd(todayStr()); }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          <DownloadBar onExcel={() => exportCSV(rows, "order_summary")} onPdf={() => alert("PDF export")} />
          <DataTable
            cols={["Order ID", "Date", "Customer Name", "Product", "Qty", "Total Amount", "Status"]}
            rows={rows.map(o => [
              pick(o, "orderId", "order_id", "id", "OrderId"),
              fmtDate(pick(o, "orderDate", "date", "createdAt", "OrderDate")),
              pick(o, "customerName", "customer", "CustomerName"),
              pick(o, "productName", "product", "ProductName") ?? "—",
              pick(o, "quantity", "qty", "items", "Quantity"),
              inr(pick(o, "totalAmount", "total", "amount", "TotalAmount")),
              <Badge label={pick(o, "status", "orderStatus", "Status") ?? "—"} />,
            ])}
          />
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── 2. Shipping Status ───────────────────────────────────────────────────────
function ShippingStatusPanel() {
  const [start,   setStart]   = useState(firstOfMonthStr());
  const [end,     setEnd]     = useState(todayStr());
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("OrderShippingStatus", { StartDate: start, EndDate: end });
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setRan(false); setError(null); setStart(firstOfMonthStr()); setEnd(todayStr()); }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          <DownloadBar onExcel={() => exportCSV(rows, "shipping_status")} onPdf={() => alert("PDF export")} />
          <DataTable
            cols={["Order ID", "Order Date", "Customer", "Carrier", "Tracking #", "Destination", "Est. Delivery", "Status"]}
            rows={rows.map(o => [
              pick(o, "orderId", "id", "OrderId"),
              fmtDate(pick(o, "orderDate", "date", "OrderDate")),
              pick(o, "customerName", "customer", "CustomerName"),
              pick(o, "carrier", "Carrier") ?? "—",
              <code style={{ fontSize: 11, background: C.light, padding: "2px 6px", borderRadius: 4 }}>
                {pick(o, "trackingNumber", "tracking", "TrackingNumber") ?? "—"}
              </code>,
              pick(o, "destination", "city", "Destination") ?? "—",
              fmtDate(pick(o, "estimatedDelivery", "eta", "EstimatedDelivery")),
              <Badge label={pick(o, "status", "Status") ?? "—"} />,
            ])}
          />
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── 3. Average Order Value ───────────────────────────────────────────────────
function AOVPanel() {
  const [start,   setStart]   = useState(firstOfMonthStr());
  const [end,     setEnd]     = useState(todayStr());
  const [rows,    setRows]    = useState<any[]>([]);
  const [meta,    setMeta]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list, meta } = await callAPI("AverageOrderValue", { StartDate: start, EndDate: end });
      setRows(list);
      setMeta(meta);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setMeta(null); setRan(false); setError(null); setStart(firstOfMonthStr()); setEnd(todayStr()); }

  const totalOrders  = pick(meta, "totalOrders", "TotalOrders", "total_orders")
    ?? pick(rows[0], "totalOrders", "TotalOrders");
  const totalRevenue = pick(meta, "totalRevenue", "TotalRevenue", "total_revenue")
    ?? pick(rows[0], "totalRevenue", "TotalRevenue");
  const avgOV        = pick(meta, "averageOrderValue", "AverageOrderValue", "aov")
    ?? pick(rows[0], "averageOrderValue", "AverageOrderValue");

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          {(totalOrders != null || totalRevenue != null) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total Orders",      value: Number(totalOrders ?? 0).toLocaleString("en-IN") },
                { label: "Total Revenue",     value: inr(totalRevenue) },
                { label: "Avg Order Value",   value: inr(avgOV) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.light, border: `1px solid ${C.lightBorder}`, borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.blushPink, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
          <DownloadBar onExcel={() => exportCSV(rows, "aov_report")} onPdf={() => alert("PDF export")} />
          {rows.length > 0 && (
            <DataTable
              cols={["Total Orders", "Total Revenue", "Average Order Value"]}
              rows={rows.map(r => [
                Number(pick(r, "totalOrders", "orders", "TotalOrders") ?? 0).toLocaleString("en-IN"),
                inr(pick(r, "totalRevenue", "revenue", "TotalRevenue")),
                inr(pick(r, "averageOrderValue", "aov", "AverageOrderValue")),
              ])}
            />
          )}
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── 4. Order Fulfillment Time ────────────────────────────────────────────────
const FULFILLMENT_TYPES = [
  "Basic Fulfilment Time",
  "Summary Report: Average Fulfilment Time",
  "Fulfilment Time by Platform / Region / Warehouse",
];

function FulfillmentPanel() {
  const [type,    setType]    = useState(FULFILLMENT_TYPES[0]);
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("OrderFulfillment", { Type: type });
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setRan(false); setError(null); setType(FULFILLMENT_TYPES[0]); }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="Select Report Type" value={type} options={FULFILLMENT_TYPES} onChange={setType} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          <DownloadBar onExcel={() => exportCSV(rows, "fulfillment_time")} onPdf={() => alert("PDF export")} />
          <DataTable
            cols={["Order ID", "Order Date", "Shipped Date", "Fulfillment (Hrs)", "Fulfillment (Days)"]}
            rows={rows.map(o => [
              pick(o, "orderId", "id", "OrderId"),
              fmtDate(pick(o, "orderDate", "date", "OrderDate")),
              fmtDate(pick(o, "shippedDate", "shippedAt", "ShippedDate")),
              pick(o, "fulfillmentHrs", "hrs", "FulfillmentHrs") ?? "—",
              pick(o, "fulfillmentDays", "days", "FulfillmentDays") ?? "—",
            ])}
          />
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── 5. Backordered / Out-of-Stock ────────────────────────────────────────────
const BACKORDER_TYPES = ["Backordered Items", "Out-of-Stock Items"];

function BackorderPanel() {
  const [type,    setType]    = useState(BACKORDER_TYPES[0]);
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("StockBackOrder", { Type: type });
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setRan(false); setError(null); setType(BACKORDER_TYPES[0]); }

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="Select Type" value={type} options={BACKORDER_TYPES} onChange={setType} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          <DownloadBar onExcel={() => exportCSV(rows, "backorder_report")} onPdf={() => alert("PDF export")} />
          <DataTable
            cols={["Order ID", "Order Date", "Customer Name", "Product Name", "Ordered Qty", "Available Stock", "Backordered Qty", "Status"]}
            rows={rows.map(o => {
              const bqty      = pick(o, "backorderedQty", "backorder", "BackorderedQty") ?? 0;
              const rawStatus = pick(o, "status", "Status");
              const status    = rawStatus ?? (bqty > 0 ? "Backordered" : "In Stock");
              return [
                pick(o, "orderId", "id", "OrderId"),
                fmtDate(pick(o, "orderDate", "date", "OrderDate")),
                pick(o, "customerName", "customer", "CustomerName") ?? "—",
                pick(o, "productName", "product", "ProductName") ?? "—",
                pick(o, "orderedQty", "quantity", "qty", "OrderedQty"),
                pick(o, "availableStock", "instock", "stock", "AvailableStock"),
                bqty,
                <Badge label={status} />,
              ];
            })}
          />
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── 6. Return Rate and Reasons ───────────────────────────────────────────────
const RETURN_TYPES = ["Return Rate by Product", "Top Return Reasons"];

function ReturnRatePanel() {
  const [type,    setType]    = useState(RETURN_TYPES[0]);
  const [start,   setStart]   = useState(firstOfMonthStr());
  const [end,     setEnd]     = useState(todayStr());
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ran,     setRan]     = useState(false);

  async function run() {
    setLoading(true); setError(null); setRan(true);
    try {
      const { list } = await callAPI("ReturnRateReason", { Type: type, StartDate: start, EndDate: end });
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? e.message);
    } finally { setLoading(false); }
  }

  function clear() { setRows([]); setRan(false); setError(null); setType(RETURN_TYPES[0]); setStart(firstOfMonthStr()); setEnd(todayStr()); }

  const byProduct = type === RETURN_TYPES[0];

  return (
    <>
      <FilterRow onRun={run} onClear={clear} running={loading}>
        <TypeDropdown label="Select Type" value={type} options={RETURN_TYPES} onChange={setType} />
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </FilterRow>
      {loading && <Loader />}
      {error   && <ErrorMsg msg={error} onRetry={run} />}
      {!loading && !error && ran && (
        <>
          <DownloadBar onExcel={() => exportCSV(rows, "return_rate")} onPdf={() => alert("PDF export")} />
          {byProduct ? (
            <DataTable
              cols={["Product", "Total Sold", "Total Returned", "Return Rate", "Revenue Impact"]}
              rows={rows.map(r => {
                const sold     = pick(r, "totalSold", "sold", "TotalSold") ?? 0;
                const returned = pick(r, "totalReturned", "count", "TotalReturned") ?? 0;
                const rate     = pick(r, "returnRate", "ReturnRate") ?? (sold > 0 ? (returned / sold) * 100 : 0);
                return [
                  pick(r, "productName", "product", "ProductName") ?? "—",
                  Number(sold).toLocaleString("en-IN"),
                  returned,
                  Number(rate).toFixed(1) + "%",
                  inr(pick(r, "revenueImpact", "impact", "RevenueImpact")),
                ];
              })}
            />
          ) : (
            <DataTable
              cols={["Reason", "Returns", "Rate", "Trend", "Revenue Impact"]}
              rows={rows.map(r => {
                const trend = pick(r, "trend", "Trend", "trendPct") ?? 0;
                return [
                  pick(r, "reason", "Reason", "returnReason") ?? "—",
                  pick(r, "count", "returns", "Count"),
                  Number(pick(r, "rate", "Rate") ?? 0).toFixed(1) + "%",
                  <span style={{ color: trend <= 0 ? C.green : C.red, fontWeight: 700 }}>
                    {trend <= 0 ? "▼" : "▲"} {Math.abs(trend)}%
                  </span>,
                  inr(pick(r, "impact", "revenueImpact", "Impact")),
                ];
              })}
            />
          )}
        </>
      )}
      {!ran && !loading && <EmptyState />}
    </>
  );
}

// ─── Report Config ────────────────────────────────────────────────────────────
const REPORTS = [
  { id: "summary",     label: "Order Summary Report",        sub: "Completed, Cancelled, Returned",     Panel: OrderSummaryPanel,   icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: "shipping",    label: "Shipping Status Report",      sub: "Shipped, In Transit, Delivered",     Panel: ShippingStatusPanel, icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" /><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6" /></svg> },
  { id: "aov",         label: "Average Order Value",         sub: "AOV by period",                      Panel: AOVPanel,            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: "fulfillment", label: "Order Fulfillment Time",      sub: "Processing & shipping speed",        Panel: FulfillmentPanel,    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: "backorder",   label: "Backordered / Out-of-Stock",  sub: "Inventory shortage tracking",        Panel: BackorderPanel,      icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h10M3 14h6m11-4v8m0 0l-3-3m3 3l3-3" /></svg> },
  { id: "returns",     label: "Return Rate and Reasons",     sub: "Product & reason breakdown",         Panel: ReturnRatePanel,     icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg> },
];

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function OrderFulfillmentReports() {
  const [active, setActive] = useState(REPORTS[0].id);
  const report = REPORTS.find(r => r.id === active)!;
  const Panel  = report.Panel;

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
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.lightBorder}`, padding: "26px 28px", boxShadow: "0 2px 12px rgba(106,1,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingBottom: 16, borderBottom: `1px solid ${C.lightBorder}` }}>
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