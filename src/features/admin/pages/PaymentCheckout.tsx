// payment-checkout-reports.tsx
import React, { useState } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const B        = "#6A012A";
const B_LIGHT  = "#F7EEF2";
const B_MID    = "#E8C5D0";
const B_HOVER  = "#F2E0E8";
const WHITE    = "#ffffff";
const TEXT     = "#1A0008";
const TEXT_MID = "#6B3048";
const TEXT_SUB = "#999";

// ─── MOCK DATA (derived from provided table dumps) ────────────────────────────
const MOCK_DATA = {
  "payment-method": [
    {
      paymentMethod: "Credit Card",
      orderCount: 24,
      totalRevenue: 14745,
      avgOrderValue: 614.38,
      usagePercent: 92.3,
    },
    {
      paymentMethod: "COD (Cash on Delivery)",
      orderCount: 2,
      totalRevenue: 998,
      avgOrderValue: 499,
      usagePercent: 7.7,
    },
  ],

  "failed-payment": [
    {
      orderId: "ORD14-BC3E2225",
      customerName: "Customer #783968",
      amount: 749,
      paymentMethod: "Credit Card (41111-XXXX-1111)",
      failureReason: "Invalid Mobile Number",
      date: "2026-04-08T19:10:05Z",
    },
    {
      orderId: "ORD14-BC3E2225",
      customerName: "Customer #783968",
      amount: 749,
      paymentMethod: "Credit Card (41111-XXXX-1111)",
      failureReason: "Invalid Mobile Number (retry)",
      date: "2026-04-08T19:10:33Z",
    },
  ],

  "refunds-disputes": [
    {
      orderId: "ORD1",
      customerName: "Customer #783951",
      refundAmount: 2097,
      reason: "Order cancelled",
      status: "Refunded",
      date: "2026-04-08T19:28:47Z",
    },
    {
      orderId: "ORD3",
      customerName: "Customer #783953",
      refundAmount: 2097,
      reason: "Order cancelled",
      status: "Refunded",
      date: "2026-04-08T19:28:50Z",
    },
    {
      orderId: "ORD13",
      customerName: "Customer #783963",
      refundAmount: 499,
      reason: "Order cancelled",
      status: "Refunded",
      date: "2026-04-08T19:29:04Z",
    },
    {
      orderId: "ORD14-BC3E2225",
      customerName: "Customer #783968",
      refundAmount: 749,
      reason: "Payment failed",
      status: "Refunded",
      date: "2026-04-08T19:29:01Z",
    },
  ],

  "tax-region": [
    {
      region: "Telangana",
      totalOrders: 26,
      taxableAmount: 14745,
      taxCollected: 2654.1,
      taxRate: 18,
    },
    {
      region: "Other / Unassigned",
      totalOrders: 0,
      taxableAmount: 0,
      taxCollected: 0,
      taxRate: 0,
    },
  ],
};

// ─── COLUMN CONFIG ────────────────────────────────────────────────────────────
const REPORTS = [
  {
    key: "payment-method",
    label: "Payment Method Usage (COD, Card, UPI, etc.)",
    icon: "🏦",
    columns: [
      { header: "Payment Method", field: "paymentMethod" },
      { header: "Order Count",    field: "orderCount" },
      { header: "Total Revenue",  field: "totalRevenue",  currency: true },
      { header: "Avg. Order Value",field: "avgOrderValue", currency: true },
      { header: "Usage (%)",      field: "usagePercent" },
    ],
    stats: [
      { label: "Total Orders",   value: "26",      sub: "Apr 8 – Apr 24" },
      { label: "Total Revenue",  value: "₹15,743", sub: "All methods" },
      { label: "Success Rate",   value: "92.3%",   sub: "Credit card" },
      { label: "Methods Used",   value: "2",       sub: "Card, COD" },
    ],
  },
  {
    key: "failed-payment",
    label: "Failed Payment Report",
    icon: "⊗",
    columns: [
      { header: "Order ID",       field: "orderId" },
      { header: "Customer",       field: "customerName" },
      { header: "Amount",         field: "amount",        currency: true },
      { header: "Payment Method", field: "paymentMethod" },
      { header: "Failure Reason", field: "failureReason" },
      { header: "Date",           field: "date",          date: true },
    ],
    stats: [
      { label: "Failed Attempts",  value: "2",    sub: "Apr 8 only" },
      { label: "Amount at Risk",   value: "₹749", sub: "Per attempt" },
      { label: "Unique Reasons",   value: "1",    sub: "Invalid mobile" },
      { label: "Orders Affected",  value: "1",    sub: "ORD14" },
    ],
  },
  {
    key: "refunds-disputes",
    label: "Refunds and Disputes",
    icon: "↩",
    columns: [
      { header: "Order ID",      field: "orderId" },
      { header: "Customer",      field: "customerName" },
      { header: "Refund Amount", field: "refundAmount", currency: true },
      { header: "Reason",        field: "reason" },
      { header: "Status",        field: "status",       badge: true },
      { header: "Date",          field: "date",         date: true },
    ],
    stats: [
      { label: "Total Refunds",  value: "4",       sub: "Completed" },
      { label: "Amount Refunded",value: "₹5,442",  sub: "Gross" },
      { label: "Avg. Refund",    value: "₹1,360",  sub: "Per order" },
      { label: "Orders Affected",value: "4",       sub: "Unique" },
    ],
  },
  {
    key: "tax-region",
    label: "Tax Collected by Region",
    icon: "🏛",
    columns: [
      { header: "Region",          field: "region" },
      { header: "Total Orders",    field: "totalOrders" },
      { header: "Taxable Amount",  field: "taxableAmount",  currency: true },
      { header: "Tax Collected",   field: "taxCollected",   currency: true },
      { header: "Tax Rate (%)",    field: "taxRate" },
    ],
    stats: [
      { label: "Total Orders",    value: "26",      sub: "Taxable" },
      { label: "Taxable Amount",  value: "₹14,745", sub: "Revenue base" },
      { label: "Tax Collected",   value: "₹2,654",  sub: "GST 18%" },
      { label: "Regions",         value: "1",       sub: "Telangana" },
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtCell(col, val) {
  if (val == null || val === "") return "—";
  if (col.currency)
    return "₹" + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (col.date) {
    try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(val); }
  }
  return String(val);
}

const BADGE_STYLES = {
  Refunded:   { background: "#FAEEDA", color: "#854F0B" },
  Approved:   { background: "#EAF3DE", color: "#3B6D11" },
  Confirmed:  { background: "#E6F1FB", color: "#185FA5" },
  Processing: { background: "#EEEDFE", color: "#534AB7" },
  Failed:     { background: "#FCEBEB", color: "#A32D2D" },
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Badge({ value }) {
  const style = BADGE_STYLES[value] || { background: "#eee", color: "#444" };
  return (
    <span style={{
      ...style,
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 500,
    }}>
      {value}
    </span>
  );
}

function StatCards({ stats }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 22,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          background: B_LIGHT,
          borderRadius: 10,
          padding: "14px 16px",
          border: `1px solid ${B_MID}`,
        }}>
          <div style={{ fontSize: 11, color: TEXT_MID, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: TEXT }}>{s.value}</div>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }) {
  const [hover, setHover] = useState(null);

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${B_MID}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} style={{
                padding: "13px 16px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 600,
                color: WHITE,
                background: B,
                fontFamily: "inherit",
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
              }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                background: hover === i ? B_HOVER : i % 2 === 0 ? WHITE : B_LIGHT,
                borderBottom: `1px solid ${B_MID}`,
                transition: "background 0.12s",
              }}
            >
              {columns.map((col, j) => {
                const val = row[col.field];
                return (
                  <td key={j} style={{
                    padding: "11px 16px",
                    fontSize: 13,
                    color: TEXT,
                    fontWeight: j === 0 ? 500 : 400,
                    verticalAlign: "middle",
                    whiteSpace: j === 0 ? "nowrap" : "normal",
                  }}>
                    {col.badge ? <Badge value={String(val)} /> : fmtCell(col, val)}
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

function EmptyState({ text }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "56px 0", color: TEXT_SUB, fontFamily: "inherit",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%", background: "#F0E8EC",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="14" cy="14" r="9" stroke={B_MID} strokeWidth="2.5"/>
          <path d="M21 21l7 7" stroke={B_MID} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <span style={{ fontSize: 14 }}>{text}</span>
    </div>
  );
}

// ─── REPORT PANEL ─────────────────────────────────────────────────────────────
function ReportPanel({ config }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [hasRun, setHasRun]       = useState(false);

  const rows = MOCK_DATA[config.key] || [];

  function handleRun() { setHasRun(true); }
  function handleClear() { setHasRun(false); setStartDate(""); setEndDate(""); }

  const btnBase = {
    border: "none", borderRadius: 20, padding: "9px 22px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", transition: "opacity 0.15s",
  };

  return (
    <div style={{
      background: WHITE, borderRadius: 16, padding: "28px 32px",
      boxShadow: "0 2px 16px rgba(106,1,42,0.06)", border: `1px solid ${B_MID}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.3px" }}>
          {config.label}
        </h2>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={handleRun}   style={{ ...btnBase, background: B, color: WHITE }}>Run</button>
          <button onClick={handleClear} style={{ ...btnBase, background: B_MID, color: B }}>Clear All</button>
        </div>
      </div>

      {/* Date inputs */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Start Date", val: startDate, set: setStartDate },
          { label: "End Date",   val: endDate,   set: setEndDate },
        ].map(({ label, val, set }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: TEXT_MID, fontWeight: 500 }}>{label}</label>
            <input
              type="date"
              value={val}
              onChange={e => set(e.target.value)}
              style={{
                border: "none",
                borderBottom: `1.5px solid ${B_MID}`,
                background: B_LIGHT,
                padding: "9px 12px",
                fontSize: 13,
                color: TEXT,
                outline: "none",
                fontFamily: "inherit",
                minWidth: 170,
                cursor: "pointer",
              }}
            />
          </div>
        ))}
      </div>

      {/* Results */}
      {hasRun ? (
        <>
          {/* Export buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
            <button style={{ ...btnBase, background: B, color: WHITE, padding: "8px 18px", fontSize: 12.5 }}>
              Excel Download
            </button>
            <button style={{ ...btnBase, background: B, color: WHITE, padding: "8px 18px", fontSize: 12.5 }}>
              PDF Download
            </button>
          </div>

          <StatCards stats={config.stats} />

          {rows.length === 0
            ? <EmptyState text="No data found for the selected date range." />
            : <DataTable columns={config.columns} rows={rows} />
          }
        </>
      ) : (
        <EmptyState text={`Select a date range and click Run to load the ${config.label}.`} />
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PaymentFinancialReports() {
  const [activeKey, setActiveKey] = useState(REPORTS[0].key);
  const activeReport = REPORTS.find(r => r.key === activeKey);

  const pillStyle = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 20px",
    border: `1.5px solid ${active ? B : B_MID}`,
    borderRadius: 30,
    background: active ? B_LIGHT : WHITE,
    color: active ? B : TEXT_MID,
    fontWeight: active ? 600 : 400,
    fontSize: 13.5,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.18s",
    whiteSpace: "nowrap",
    userSelect: "none",
  });

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "#F9F4F6",
      minHeight: "100vh",
      padding: "28px 32px",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, position: "relative",
      }}>
        <button
          onClick={() => window.history.back()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: B, fontSize: 14, fontWeight: 500, fontFamily: "inherit",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke={B} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          ← inventory
        </button>

        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 700, color: TEXT,
          letterSpacing: "-0.3px", fontFamily: "inherit",
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        }}>
          💰 Payment &amp; Financial Reports
        </h1>

        <div /> {/* spacer */}
      </div>

      {/* Tab Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        {REPORTS.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveKey(r.key)}
            style={pillStyle(activeKey === r.key)}
          >
            <span style={{ fontSize: 15 }}>{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>

      {/* Active Report Panel */}
      <ReportPanel key={activeKey} config={activeReport} />
    </div>
  );
}