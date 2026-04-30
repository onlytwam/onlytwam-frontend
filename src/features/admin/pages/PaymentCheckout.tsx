import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/shared/api/axiosInstance";
// Remove: import * as XLSX from 'xlsx';
// Remove: import jsPDF from 'jspdf';
// Remove: import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePickerType = "date" | "month-week" | "month" | "year";
type SelectType = "Product" | "Category" | "Brand"; // ✅ single declaration

interface ApiOrder {
  orderId: string;
  customerName: string;
  productName: string;
  orderDate: string;
  quantity: number;
  totalAmount: number;
  orderStatus: string;
}

interface Order {
  id: string;
  customer: string;
  product: string;
  date: string;
  qty: number;
  amount: number;
  status: "completed" | "pending" | "cancelled";
}

interface ReportResult {
  label: string;
  data: Order[];
  total: number;
  orders: number;
  avg: number;
  completed: number;
}

interface FilterState {
  selectType: SelectType;
  categoryId: number | null;
  brandId: number | null;
  fromDate: Date;
  toDate: Date;
}

interface ReportRow {
  type: string;
  name: string;
  unitsSold: number;
  totalOrders: number;
  grossRevenue: number;
  taxableValue: number;
  gstAmount: number;
  netRevenue?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TABS = [
  { id: 0, label: "Payment Method Usage (COD, Card, UPI, etc.)", icon: "📅" },
  { id: 1, label: "Failed Payment Report", icon: "🏷️" },
  { id: 2, label: "Refunds and Disputes", icon: "🏠" },
  { id: 3, label: "Tax Collected by Region", icon: "⭐" },
  {
    id: 4,
    label: "Payment Gateway Performance (Success vs. Failure Rates)",
    icon: "📉",
  },
];

const COLORS = [
  "#e03131",
  "#4361ee",
  "#2f9e44",
  "#f76707",
  "#7c3aed",
  "#0ea5e9",
  "#db2777",
  "#059669",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtINR = (n: number) => "₹" + n.toLocaleString("en-IN");

const fmt = (n: number) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function mapApiOrder(raw: ApiOrder): Order {
  return {
    id: raw.orderId,
    customer: raw.customerName ?? "-",
    product: raw.productName ?? "-",
    date: raw.orderDate ?? "",
    qty: raw.quantity ?? 0,
    amount: raw.totalAmount ?? 0,
    status: (raw.orderStatus?.toLowerCase() as Order["status"]) ?? "pending",
  };
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  padding: "10px 14px",
  border: "1.5px solid #dee2e6",
  borderRadius: 10,
  fontSize: 13,
  color: "#1a1a2e",
  fontFamily: "inherit",
  outline: "none",
  background: "#fff",
  width: "100%",
};

const labelSt: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#495057",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 6,
  display: "block",
};

// ─── Shared styles for Panel 1 ────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#fff9f9",
  border: "1px solid #f0dede",
  borderRadius: 10,
  padding: "16px 20px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#999",
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
  letterSpacing: "0.03em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  fontSize: 15,
  fontWeight: 600,
  color: "#1a1a1a",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  fontFamily: "inherit",
};

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 24,
  padding: "10px 24px",
  fontFamily: "inherit",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 7,
  transition: "opacity .15s, transform .1s",
};

const primaryBtn: React.CSSProperties = {
  ...btnBase,
  background: "#9b1c1c",
  color: "#fff",
};
const outlineBtn: React.CSSProperties = {
  ...btnBase,
  background: "#fff",
  color: "#9b1c1c",
  border: "1.5px solid #9b1c1c",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: Order["status"] }> = ({ status }) => {
  const styles: Record<Order["status"], React.CSSProperties> = {
    completed: { background: "#ebfbee", color: "#2f9e44" },
    pending: { background: "#fff9db", color: "#e67700" },
    cancelled: { background: "#fff5f5", color: "#e03131" },
  };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 700,
        ...(styles[status] ?? styles.pending),
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  note: string;
  noteUp?: boolean;
}> = ({ label, value, note, noteUp = true }) => (
  <div
    style={{
      background: "#fff",
      border: "0.5px solid #f0e0e0",
      borderRadius: 12,
      padding: "14px 16px",
    }}
  >
    <div
      style={{
        fontSize: 11,
        color: "#868e96",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>
      {value}
    </div>
    <div
      style={{
        fontSize: 11,
        marginTop: 3,
        fontWeight: 600,
        color: noteUp ? "#2f9e44" : "#e03131",
      }}
    >
      {note}
    </div>
  </div>
);

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 40, textAlign: "center", color: "#adb5bd" }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
    <div
      style={{
        fontWeight: 700,
        color: "#495057",
        marginBottom: 6,
        fontSize: 15,
      }}
    >
      {title}
    </div>
    <div style={{ fontSize: 13 }}>Report coming soon.</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ffd0d0",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.dataKey === "revenue" ? fmtINR(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── Download Helpers ─────────────────────────────────────────────────────────

function downloadPDF(
  data: Order[],
  label: string,
  stats: { total: number; orders: number; avg: number; completed: number },
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(224, 49, 49);
  doc.text(`Sales Report — ${label}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Total Revenue: ${fmtINR(stats.total)}   Orders: ${
      stats.orders
    }   Avg: ${fmtINR(stats.avg)}   Completed: ${stats.completed}`,
    14,
    28,
  );
  autoTable(doc, {
    startY: 34,
    head: [
      [
        "#",
        "Order ID",
        "Customer",
        "Product",
        "Date",
        "Qty",
        "Amount",
        "Status",
      ],
    ],
    body: data.map((r, i) => [
      i + 1,
      r.id,
      r.customer,
      r.product,
      fmtDate(r.date),
      r.qty,
      fmtINR(r.amount),
      r.status,
    ]),
    headStyles: { fillColor: [224, 49, 49], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [255, 245, 245] },
  });
  doc.save(`Sales_Report_${label.replace(/[^a-z0-9]/gi, "_")}.pdf`);
}

// ─── Panel 0 : Daily / Weekly / Monthly / Yearly ─────────────────────────────

// ─── Panel 1 : Sales by Product / Category / Brand ───────────────────────────

// ─── Root Page ────────────────────────────────────────────────────────────────

const PaymentCheckout: React.FC = () => {
  const [active, setActive] = useState<number>(0);
  const navigate = useNavigate();

  // ✅ Fixed: ProductCategoryReport now defined above — no more undefined reference
  const panels: React.ReactNode[] = [
    <ComingSoon title="Payment Method Usage (COD, Card, UPI, etc.)" />,
    <ComingSoon title="Failed Payment Report" />,
    <ComingSoon title="Refunds and Disputes" />,
    <ComingSoon title="Tax Collected by Region" />,
    <ComingSoon title="Payment Gateway Performance (Success vs. Failure Rates)" />,
  ];

  return (
    <div
      style={{
        background: "#fafafa",
        minHeight: "100vh",
        paddingBottom: 40,
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "22px 24px 16px",
          position: "relative",
          borderBottom: "0.5px solid #f0e0e0",
          background: "#fff",
        }}
      >
        <button
          onClick={() => navigate("/admin/reports")}
          style={{
            position: "absolute",
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#6A012A",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            background: "none",
            fontFamily: "inherit",
          }}
        >
          ← Reports
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 22,
            fontWeight: 700,
            color: "#1a1a2e",
          }}
        >
          🛍️ Payment & Checkout Reports
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          padding: "24px 24px 0",
        }}
      >
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              border: `1.5px solid ${
                active === tab.id ? "transparent" : "#6A012A"
              }`,
              borderRadius: 40,
              background: active === tab.id ? "#6A012A" : "#fff",
              color: active === tab.id ? "#fff" : "#6A012A",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "all .22s ease",
              boxShadow:
                active === tab.id ? "0 4px 20px rgba(106,1,42,0.3)" : "none",
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "0.5px solid #ffd0d0",
            overflow: "hidden",
            boxShadow: "0 2px 16px rgba(106,1,42,0.07)",
          }}
        >
          {panels[active]}
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
