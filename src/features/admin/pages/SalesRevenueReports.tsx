import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from '@/shared/api/axiosInstance';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { addWeeks, endOfWeek, format, startOfWeek, startOfYear } from "date-fns";
import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePickerType = "date" | "month-week" | "month" | "year";
type SelectType = "Product" | "Category" | "Brand";
type DateMode = "Month Range" | "Week Range";

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

interface SubOption {
    value: string;
    label: string;
}

interface DateRange {
    start: Date | null;
    end: Date | null;
}

interface ReportRow {
    type?: string;
    Type?: string;
    name?: string;
    Name?: string;
    productName?: string;
    categoryName?: string;
    brandName?: string;
    unitsSold?: number;
    UnitsSold?: number;
    units_sold?: number;
    totalOrders?: number;
    TotalOrders?: number;
    total_orders?: number;
    grossRevenue?: number;
    GrossRevenue?: number;
    gross_revenue?: number;
    taxableValue?: number;
    TaxableValue?: number;
    taxable_value?: number;
    gstAmount?: number;
    GstAmount?: number;
    gst_amount?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TABS = [
    { id: 0, label: "Daily/Weekly/Monthly Sales Report", icon: "📅" },
    { id: 1, label: "Sales by Product / Category / Brand", icon: "🏷️" },
    { id: 2, label: "Sales by Region / Location", icon: "🏠" },
    { id: 3, label: "Top-Selling Products", icon: "⭐" },
    { id: 4, label: "Low-Performing Products", icon: "📉" },
    { id: 5, label: "Gross Revenue vs. Net Revenue", icon: "💵" },
    { id: 6, label: "Sales by Device / Platform", icon: "📱" },
    { id: 7, label: "Coupon/Discount Usage Report", icon: "🎟️" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_OPTIONS: { label: string; value: SelectType; api: string }[] = [
    { label: "Product", value: "Product", api: "/Products" },
    { label: "Category", value: "Category", api: "/Category" },
    { label: "Brand", value: "Brand", api: "/Brand" },
];

const DATE_MODES: DateMode[] = ["Month Range", "Week Range"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const fmtINR = (n: number | null | undefined) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function getVal(row: ReportRow, ...keys: (keyof ReportRow)[]): number | null {
    for (const k of keys) {
        const v = row[k];
        if (v != null) return v as number;
    }
    return null;
}

function getRowName(row: ReportRow): string {
    return row.name || row.Name || row.productName || row.categoryName || row.brandName || "—";
}

function getWeeks(year: number): { label: string; start: Date; end: Date }[] {
    const weeks: { label: string; start: Date; end: Date }[] = [];
    const yearStart = startOfYear(new Date(year, 0, 1));
    for (let w = 0; w < 52; w++) {
        const wStart = startOfWeek(addWeeks(yearStart, w), { weekStartsOn: 1 });
        const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
        weeks.push({
            label: `W${w + 1}: ${format(wStart, "d MMM")} – ${format(wEnd, "d MMM")}`,
            start: wStart,
            end: wEnd,
        });
    }
    return weeks;
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
    padding: "10px 14px", border: "1.5px solid #dee2e6", borderRadius: 10,
    fontSize: 13, color: "#1a1a2e", fontFamily: "inherit",
    outline: "none", background: "#fff", width: "100%",
};

const labelSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#495057",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block",
};

const navBtnStyle: React.CSSProperties = {
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 20, color: "#6A012A", lineHeight: 1, padding: "0 8px",
};

const cellStyle: React.CSSProperties = {
    padding: "13px 14px", fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    color: "#2D1A1A", verticalAlign: "middle", whiteSpace: "normal",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: Order["status"] }> = ({ status }) => {
    const styles: Record<Order["status"], React.CSSProperties> = {
        completed: { background: "#ebfbee", color: "#2f9e44" },
        pending: { background: "#fff9db", color: "#e67700" },
        cancelled: { background: "#fff5f5", color: "#e03131" },
    };
    return (
        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, ...(styles[status] ?? styles.pending) }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const StatCard: React.FC<{ label: string; value: string | number; note: string; noteUp?: boolean }> =
    ({ label, value, note, noteUp = true }) => (
        <div style={{ background: "#fff", border: "0.5px solid #f0e0e0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#868e96", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
            <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: noteUp ? "#2f9e44" : "#e03131" }}>{note}</div>
        </div>
    );

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
    <div style={{ padding: 40, textAlign: "center", color: "#adb5bd" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
        <div style={{ fontWeight: 700, color: "#495057", marginBottom: 6, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13 }}>Report coming soon.</div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#fff", border: "1px solid #ffd0d0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>{label}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {p.dataKey === "revenue" ? fmtINR(p.value) : p.value}
                </div>
            ))}
        </div>
    );
};

function Spinner() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
            <div style={{
                width: 36, height: 36,
                border: "3px solid #F0E0E0",
                borderTop: "3px solid #6A012A",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Download Helpers ─────────────────────────────────────────────────────────

function downloadOrdersExcel(data: Order[], label: string) {
    const rows = data.map((r, i) => ({
        "#": i + 1,
        "Order ID": r.id,
        "Customer": r.customer,
        "Product": r.product,
        "Date": fmtDate(r.date),
        "Qty": r.qty,
        "Amount": r.amount,
        "Status": r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Report_${label.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
}

function downloadOrdersPDF(
    data: Order[],
    label: string,
    stats: { total: number; orders: number; avg: number; completed: number }
) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(224, 49, 49);
    doc.text(`Sales Report — ${label}`, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
        `Total Revenue: ${fmtINR(stats.total)}   Orders: ${stats.orders}   Avg: ${fmtINR(stats.avg)}   Completed: ${stats.completed}`,
        14, 28
    );
    autoTable(doc, {
        startY: 34,
        head: [["#", "Order ID", "Customer", "Product", "Date", "Qty", "Amount", "Status"]],
        body: data.map((r, i) => [i + 1, r.id, r.customer, r.product, fmtDate(r.date), r.qty, fmtINR(r.amount), r.status]),
        headStyles: { fillColor: [224, 49, 49], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [255, 245, 245] },
    });
    doc.save(`Sales_Report_${label.replace(/[^a-z0-9]/gi, "_")}.pdf`);
}

// ─── Panel 0 : Daily / Weekly / Monthly / Yearly ─────────────────────────────

const DailySalesPanel: React.FC = () => {
    const today = new Date().toISOString().split("T")[0];
    const ym = today.slice(0, 7);
    const curYear = new Date().getFullYear().toString();

    const [pickerType, setPickerType] = useState<DatePickerType>("month-week");
    const [singleDate, setSingleDate] = useState(today);
    const [monthVal, setMonthVal] = useState(ym);
    const [yearVal, setYearVal] = useState(curYear);
    const [mwStart, setMwStart] = useState(() => `${ym}-01`);
    const [mwEnd, setMwEnd] = useState(today);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<ReportResult | null>(null);

    const buildRange = (): { from: string; to: string; label: string; type: string } | null => {
        if (pickerType === "date") {
            return { from: singleDate, to: singleDate, label: "Daily — " + fmtDate(singleDate), type: "daily" };
        }
        if (pickerType === "month-week") {
            if (!mwStart || !mwEnd) { alert("Please select both start and end dates"); return null; }
            return { from: mwStart, to: mwEnd, label: fmtDate(mwStart) + " – " + fmtDate(mwEnd), type: "weekly" };
        }
        if (pickerType === "month") {
            const [y, m] = monthVal.split("-");
            const from = `${monthVal}-01`;
            const to = new Date(Number(y), Number(m), 0).toISOString().split("T")[0];
            return { from, to, label: "Monthly — " + new Date(from).toLocaleDateString("en-IN", { month: "long", year: "numeric" }), type: "monthly" };
        }
        if (pickerType === "year") {
            return { from: `${yearVal}-01-01`, to: `${yearVal}-12-31`, label: "Yearly — " + yearVal, type: "yearly" };
        }
        return null;
    };

    const runReport = async () => {
        const range = buildRange();
        if (!range) return;
        setLoading(true); setReport(null); setError(null);
        try {
            const res = await api.get("/Report/OrderList", {
                params: { type: range.type, fromDate: range.from, toDate: range.to },
            });
            const json = res.data;
            const rawList: ApiOrder[] = Array.isArray(json)
                ? json
                : (json.data ?? json.orders ?? json.result ?? json.list ?? []);
            const data = rawList.map(mapApiOrder);
            const total = data.reduce((a, r) => a + r.amount, 0);
            const orders = data.length;
            const avg = orders ? Math.round(total / orders) : 0;
            const completed = data.filter(r => r.status === "completed").length;
            setReport({ label: range.label, data, total, orders, avg, completed });
        } catch (err: any) {
            setError(err?.response?.data?.detail || err.message || "Failed to load report.");
        } finally {
            setLoading(false);
        }
    };

    const clearAll = () => { setReport(null); setError(null); };

    const pickerOptions: { value: DatePickerType; label: string }[] = [
        { value: "date", label: "Single Date" },
        { value: "month-week", label: "Month & Week Range" },
        { value: "month", label: "Month" },
        { value: "year", label: "Year" },
    ];

    return (
        <div>
            <div style={{ background: "linear-gradient(135deg,#6A012A,#fff)", padding: "18px 24px", borderBottom: "0.5px solid #6A012A" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Daily/Weekly/Monthly Sales Report</div>
                <div style={{ fontSize: 12, color: "#fff", marginTop: 3 }}>Select date range and generate your sales report</div>
            </div>

            <div style={{ padding: "20px 24px" }}>
                {/* Filter Row */}
                <div style={{
                    display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap",
                    background: "#fff", border: "0.5px solid #f0e0e0", borderRadius: 14,
                    padding: "18px 20px", marginBottom: 20,
                    boxShadow: "0 2px 10px rgba(224,49,49,0.05)",
                }}>
                    <div style={{ minWidth: 200 }}>
                        <label style={labelSt}>Select Date Picker Type</label>
                        <select style={inputBase} value={pickerType}
                            onChange={e => { setPickerType(e.target.value as DatePickerType); setReport(null); setError(null); }}>
                            {pickerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {pickerType === "date" && (
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={labelSt}>Select Date</label>
                            <input type="date" style={inputBase} value={singleDate} onChange={e => setSingleDate(e.target.value)} />
                        </div>
                    )}

                    {pickerType === "month-week" && (
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={labelSt}>Month &amp; Week Range</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input type="date" style={{ ...inputBase, width: "auto", flex: 1 }} value={mwStart} onChange={e => setMwStart(e.target.value)} />
                                <span style={{ color: "#868e96", fontWeight: 700 }}>–</span>
                                <input type="date" style={{ ...inputBase, width: "auto", flex: 1 }} value={mwEnd} onChange={e => setMwEnd(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {pickerType === "month" && (
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={labelSt}>Select Month</label>
                            <input type="month" style={inputBase} value={monthVal} onChange={e => setMonthVal(e.target.value)} />
                        </div>
                    )}

                    {pickerType === "year" && (
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={labelSt}>Select Year</label>
                            <select style={inputBase} value={yearVal} onChange={e => setYearVal(e.target.value)}>
                                {Array.from({ length: 10 }, (_, i) => {
                                    const y = new Date().getFullYear() - i;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
                            </select>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        <button onClick={runReport} disabled={loading} style={{
                            padding: "10px 28px", background: loading ? "#adb5bd" : "#6A012A",
                            color: "#fff", border: "none", borderRadius: 10, fontSize: 13,
                            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                            fontFamily: "inherit", whiteSpace: "nowrap",
                            boxShadow: loading ? "none" : "0 4px 14px rgba(224,49,49,0.3)",
                        }}>
                            {loading ? "⏳ Running..." : "▶ Run"}
                        </button>
                        <button onClick={clearAll} style={{
                            padding: "10px 20px", background: "#fff", color: "#6A012A",
                            border: "1.5px solid #6A012A", borderRadius: 10, fontSize: 13,
                            fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                        }}>
                            ✕ ClearAll
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #ffd0d0", borderRadius: 10, color: "#e03131", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                        ⚠️ {error}
                    </div>
                )}

                {!loading && report && report.orders === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "#adb5bd", fontSize: 14 }}>
                        📭 No orders found for the selected period.
                    </div>
                )}

                {report && report.orders > 0 && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                            <button
                                onClick={() => downloadOrdersExcel(report.data, report.label)}
                                style={{
                                    padding: "10px 22px", background: "#2f9e44", color: "#fff",
                                    border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                                    boxShadow: "0 4px 14px rgba(47,158,68,0.3)",
                                }}>📥 Excel Download</button>
                            <button
                                onClick={() => downloadOrdersPDF(report.data, report.label, { total: report.total, orders: report.orders, avg: report.avg, completed: report.completed })}
                                style={{
                                    padding: "10px 22px", background: "#6A012A", color: "#fff",
                                    border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                                    boxShadow: "0 4px 14px rgba(224,49,49,0.3)",
                                }}>📄 PDF Download</button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
                            <StatCard label="Total Revenue" value={fmtINR(report.total)} note="↑ from last period" noteUp />
                            <StatCard label="Total Orders" value={report.orders} note="↑ active" noteUp />
                            <StatCard label="Avg Order Value" value={fmtINR(report.avg)} note="per order" noteUp />
                            <StatCard label="Completed" value={report.completed}
                                note={`${Math.round((report.completed / report.orders) * 100)}% success rate`}
                                noteUp={report.completed === report.orders} />
                        </div>

                        <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid #f0e0e0" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                                <thead>
                                    <tr style={{ background: "#6A012A" }}>
                                        {["#", "Order ID", "Customer", "Product", "Date", "Qty", "Amount", "Status"].map(h => (
                                            <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.data.map((row, i) => (
                                        <tr key={row.id} style={{ borderBottom: "0.5px solid #f8f0f0", background: i % 2 === 0 ? "#fff" : "#fff9f9" }}>
                                            <td style={{ padding: "11px 14px", color: "#adb5bd", fontSize: 11 }}>{i + 1}</td>
                                            <td style={{ padding: "11px 14px", fontWeight: 600, color: "#4361ee" }}>{row.id}</td>
                                            <td style={{ padding: "11px 14px" }}>{row.customer}</td>
                                            <td style={{ padding: "11px 14px" }}>{row.product}</td>
                                            <td style={{ padding: "11px 14px", color: "#868e96" }}>{fmtDate(row.date)}</td>
                                            <td style={{ padding: "11px 14px", textAlign: "center" }}>{row.qty}</td>
                                            <td style={{ padding: "11px 14px", fontWeight: 700 }}>{fmtINR(row.amount)}</td>
                                            <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Month Range Picker ───────────────────────────────────────────────────────

interface MonthRangePickerProps {
    value: DateRange;
    onChange: (v: DateRange) => void;
}

function MonthRangePicker({ value, onChange }: MonthRangePickerProps) {
    const now = new Date();
    const [viewYear, setViewYear] = useState<number>(now.getFullYear());
    const [selecting, setSelecting] = useState<"start" | "end">("start");
    const [hovered, setHovered] = useState<string | null>(null);

    const startKey = value.start ? format(value.start, "yyyy-MM") : null;
    const endKey = value.end ? format(value.end, "yyyy-MM") : null;

    function cellKey(y: number, m: number) {
        return `${y}-${String(m + 1).padStart(2, "0")}`;
    }

    function handleClick(y: number, m: number) {
        const clicked = new Date(y, m, 1);
        if (selecting === "start") {
            onChange({ start: clicked, end: null });
            setSelecting("end");
        } else {
            if (value.start && clicked < value.start) {
                onChange({ start: clicked, end: value.start });
            } else {
                onChange({ start: value.start, end: clicked });
            }
            setSelecting("start");
        }
    }

    function inRange(key: string): boolean {
        if (!startKey) return false;
        const eKey = endKey || hovered;
        if (!eKey) return false;
        const lo = startKey < eKey ? startKey : eKey;
        const hi = startKey < eKey ? eKey : startKey;
        return key > lo && key < hi;
    }

    return (
        <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => setViewYear(y => y - 1)} style={navBtnStyle}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>{viewYear}</span>
                <button onClick={() => setViewYear(y => y + 1)} style={navBtnStyle}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {MONTHS.map((mo, m) => {
                    const key = cellKey(viewYear, m);
                    const active = key === startKey || key === endKey;
                    const range = inRange(key);
                    return (
                        <div
                            key={m}
                            onClick={() => handleClick(viewYear, m)}
                            onMouseEnter={() => setHovered(key)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                padding: "8px 4px", textAlign: "center", borderRadius: 8, cursor: "pointer",
                                fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                                fontWeight: active ? 600 : 400,
                                background: active ? "#6A012A" : range ? "#FBEAEA" : "transparent",
                                color: active ? "#fff" : range ? "#6A012A" : "#333",
                                transition: "background 0.15s",
                            }}
                        >
                            {mo}
                        </div>
                    );
                })}
            </div>
            {value.start && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#888", textAlign: "center" }}>
                    {format(value.start, "MMM yyyy")}
                    {value.end ? ` → ${format(value.end, "MMM yyyy")}` : " → select end month"}
                </div>
            )}
        </div>
    );
}

// ─── Week Range Picker ────────────────────────────────────────────────────────

interface WeekRangePickerProps {
    value: DateRange;
    onChange: (v: DateRange) => void;
}

function WeekRangePicker({ value, onChange }: WeekRangePickerProps) {
    const now = new Date();
    const [viewYear, setViewYear] = useState<number>(now.getFullYear());
    const [selecting, setSelecting] = useState<"start" | "end">("start");
    const [hovered, setHovered] = useState<number | null>(null);

    const weeks = getWeeks(viewYear);
    const startTime = value.start?.getTime() ?? null;
    const endTime = value.end?.getTime() ?? null;

    function isActive(idx: number) {
        const t = weeks[idx].start.getTime();
        return t === startTime || t === endTime;
    }

    function inRange(idx: number): boolean {
        const t = weeks[idx].start.getTime();
        const lo = startTime ?? Infinity;
        const hi = endTime ?? (hovered != null ? weeks[hovered].start.getTime() : -Infinity);
        if (!startTime) return false;
        return t > Math.min(lo, hi) && t < Math.max(lo, hi);
    }

    function handleClick(idx: number) {
        const { start: wStart, end: wEnd } = weeks[idx];
        if (selecting === "start") {
            onChange({ start: wStart, end: null });
            setSelecting("end");
        } else {
            if (value.start && wStart < value.start) {
                onChange({ start: wStart, end: value.start });
            } else {
                onChange({ start: value.start, end: wEnd });
            }
            setSelecting("start");
        }
    }

    return (
        <div style={{ padding: "16px", maxHeight: 300, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => setViewYear(y => y - 1)} style={navBtnStyle}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>{viewYear}</span>
                <button onClick={() => setViewYear(y => y + 1)} style={navBtnStyle}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
                {weeks.map((w, idx) => {
                    const active = isActive(idx);
                    const range = inRange(idx);
                    return (
                        <div
                            key={idx}
                            onClick={() => handleClick(idx)}
                            onMouseEnter={() => setHovered(idx)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                padding: "5px 8px", borderRadius: 6, cursor: "pointer",
                                fontSize: 11.5, fontFamily: "'DM Sans', sans-serif",
                                fontWeight: active ? 600 : 400,
                                background: active ? "#6A012A" : range ? "#FBEAEA" : "transparent",
                                color: active ? "#fff" : range ? "#6A012A" : "#444",
                                transition: "background 0.15s",
                            }}
                        >
                            {w.label}
                        </div>
                    );
                })}
            </div>
            {value.start && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
                    {format(value.start, "d MMM yyyy")}
                    {value.end ? ` → ${format(value.end, "d MMM yyyy")}` : " → select end week"}
                </div>
            )}
        </div>
    );
}

// ─── Custom Select ────────────────────────────────────────────────────────────

interface CustomSelectProps {
    label: string;
    value: string;
    options: SubOption[];
    onChange: (v: string) => void;
    placeholder: string;
    loading: boolean;
    error?: boolean;
}

function CustomSelect({ label, value, options, onChange, placeholder, loading, error }: CustomSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Close dropdown when loading starts (type switched)
    useEffect(() => { if (loading) setOpen(false); }, [loading]);

    const selected = options.find(o => o.value === value);
    // While options are still loading but we have a value, show a placeholder label
    const displayLabel = loading
        ? "Loading..."
        : error
            ? "Failed to load options"
            : selected
                ? selected.label
                : value
                    ? value
                    : placeholder;

    return (
        <div ref={ref} style={{ position: "relative", flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6A012A", fontFamily: "'DM Sans', sans-serif", marginBottom: 4, fontWeight: 500 }}>
                {label}
            </div>
            <div
                onClick={() => { if (!loading) setOpen(o => !o); }}
                style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", border: "1.5px solid #E8C5C5", borderRadius: 10,
                    background: "#FFF8F8", cursor: loading ? "not-allowed" : "pointer",
                    minHeight: 44, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    color: "#2D1A1A", userSelect: "none",
                }}
            >
                <span style={{ color: selected || loading ? "#2D1A1A" : "#AAA" }}>{displayLabel}</span>
                <span style={{ fontSize: 12, color: "#6A012A", marginLeft: 8 }}>▾</span>
            </div>
            {open && !loading && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    background: "#fff", border: "1.5px solid #E8C5C5", borderRadius: 10,
                    zIndex: 1000, maxHeight: 240, overflowY: "auto",
                    boxShadow: "0 4px 20px rgba(192,57,43,0.12)", marginTop: 4,
                }}>
                    {options.length === 0 ? (
                        <div style={{ padding: "12px 14px", fontSize: 13, color: "#AAA", fontFamily: "'DM Sans', sans-serif" }}>
                            No options available
                        </div>
                    ) : (
                        options.map(o => (
                            <div
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                onMouseEnter={e => { if (o.value !== value) (e.currentTarget as HTMLDivElement).style.background = "#FFF8F8"; }}
                                onMouseLeave={e => { if (o.value !== value) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                                style={{
                                    padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                                    cursor: "pointer",
                                    background: o.value === value ? "#FFF0F0" : "transparent",
                                    color: o.value === value ? "#6A012A" : "#2D1A1A",
                                    fontWeight: o.value === value ? 600 : 400,
                                    transition: "background 0.1s",
                                }}
                            >
                                {o.label}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Date Picker Field ────────────────────────────────────────────────────────

interface DatePickerFieldProps {
    dateMode: DateMode;
    setDateMode: (m: DateMode) => void;
    dateRange: DateRange;
    setDateRange: (v: DateRange) => void;
}

function DatePickerField({ dateMode, setDateMode, dateRange, setDateRange }: DatePickerFieldProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function formatDisplay(): string | null {
        if (!dateRange.start) return null;
        const s = format(dateRange.start, dateMode === "Month Range" ? "MMM yyyy" : "d MMM yyyy");
        const e = dateRange.end ? format(dateRange.end, dateMode === "Month Range" ? "MMM yyyy" : "d MMM yyyy") : null;
        return e ? `${s} → ${e}` : s;
    }

    const display = formatDisplay();

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    border: `1.5px solid ${open ? "#6A012A" : "#E8C5C5"}`,
                    borderRadius: open ? "10px 10px 0 0" : 10,
                    background: "#FFF8F8", cursor: "pointer", minHeight: 44,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    color: display ? "#2D1A1A" : "#999", userSelect: "none",
                    transition: "border 0.15s",
                }}
            >
                <span>{display || "Month & Week Range"}</span>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4" width="14" height="14" rx="2" stroke="#6A012A" strokeWidth="1.5" />
                    <path d="M7 2v4M13 2v4M3 9h14" stroke="#6A012A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>

            {open && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    background: "#fff", border: "1.5px solid #E8C5C5",
                    borderTop: "none", borderRadius: "0 0 10px 10px",
                    zIndex: 999, boxShadow: "0 4px 20px rgba(192,57,43,0.12)",
                }}>
                    <div style={{ display: "flex", borderBottom: "1px solid #F0E0E0" }}>
                        {DATE_MODES.map(m => (
                            <button
                                key={m}
                                onClick={() => { setDateMode(m); setDateRange({ start: null, end: null }); }}
                                style={{
                                    flex: 1, padding: "10px", border: "none",
                                    background: dateMode === m ? "#FFF0F0" : "transparent",
                                    color: dateMode === m ? "#6A012A" : "#888",
                                    fontWeight: dateMode === m ? 600 : 400,
                                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
                                    borderBottom: dateMode === m ? "2px solid #6A012A" : "2px solid transparent",
                                }}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {dateMode === "Month Range"
                        ? <MonthRangePicker value={dateRange} onChange={setDateRange} />
                        : <WeekRangePicker value={dateRange} onChange={setDateRange} />
                    }

                    {dateRange.start && dateRange.end && (
                        <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setOpen(false)}
                                style={{
                                    background: "#6A012A", color: "#fff", border: "none",
                                    borderRadius: 8, padding: "8px 20px", fontSize: 13,
                                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────

function ChartPanel({ data }: { data: ReportRow[] }) {
    if (!data || data.length === 0) return null;

    const chartData = data.map(row => ({
        name: getRowName(row).slice(0, 20),
        Revenue: getVal(row, "grossRevenue", "GrossRevenue", "gross_revenue") ?? 0,
        Taxable: getVal(row, "taxableValue", "TaxableValue", "taxable_value") ?? 0,
        GST: getVal(row, "gstAmount", "GstAmount", "gst_amount") ?? 0,
    }));

    return (
        <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1A0A0A", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
                Revenue Breakdown
            </div>
            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0E0E0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
                    <Tooltip
                        formatter={(val: any) => `₹${val.toLocaleString("en-IN")}`}
                        contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif" }} />
                    <Bar dataKey="Revenue" fill="#6A012A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Taxable" fill="#E57368" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="GST" fill="#F09C94" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Panel 1 : Sales by Product / Category / Brand ───────────────────────────

const SalesByCategoryReport: React.FC = () => {
    const [selectType, setSelectType] = useState<SelectType>("Product");
    const [subValue, setSubValue] = useState<string>("");
    const [dateMode, setDateMode] = useState<DateMode>("Month Range");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [runParams, setRunParams] = useState<Record<string, string> | null>(null);
    const [showChart, setShowChart] = useState(false);

    const typeConfig = TYPE_OPTIONS.find(t => t.value === selectType)!;

    const { data: subData, isLoading: subLoading, isError: subError } = useQuery<SubOption[]>({
        queryKey: ["subOptions", selectType],
        queryFn: async () => {
            const res = await api.get(typeConfig.api);
            const raw = res.data;

            // Extract array from any common API response wrapper
            let items: Record<string, unknown>[] = [];
            if (Array.isArray(raw)) {
                items = raw;
            } else if (raw && typeof raw === "object") {
                const wrapper =
                    raw.data ?? raw.items ?? raw.result ?? raw.list ??
                    raw.products ?? raw.categories ?? raw.brands ??
                    raw.Data ?? raw.Items ?? raw.Result ?? raw.List;
                if (Array.isArray(wrapper)) items = wrapper;
            }

            return items.map((i) => {
                const val = i.id ?? i.Id ?? i.ID ??
                    i.productId ?? i.categoryId ?? i.brandId ??
                    i.ProductId ?? i.CategoryId ?? i.BrandId ??
                    i.value ?? i.Value ?? "";
                const lbl = i.name ?? i.Name ??
                    i.productName ?? i.categoryName ?? i.brandName ??
                    i.ProductName ?? i.CategoryName ?? i.BrandName ??
                    i.title ?? i.Title ?? val;
                return { value: String(val), label: String(lbl) };
            }).filter(o => o.value !== "" && o.label !== "");
        },
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    const subOptions: SubOption[] = subData ?? [];

    // Log API response shape in dev to help debug field mapping
    if (import.meta.env.NODE_ENV !== "production" && subData) {
        console.log(`[subOptions:${selectType}]`, subData.slice(0, 2));
    }

    // Reset subValue only when selectType changes, but track the *previous* type
    // so we don't wipe a value that was just set after options loaded.
    const prevSelectType = useRef<SelectType>(selectType);
    useEffect(() => {
        if (prevSelectType.current !== selectType) {
            prevSelectType.current = selectType;
            setSubValue("");
            setRunParams(null);
        }
    }, [selectType]);

    const { data: reportData, isLoading: running, isError: hasError } = useQuery<ReportRow[]>({
        queryKey: ["salesReport", runParams],
        queryFn: async () => {
            if (!runParams) return [];
            const res = await api.get("/api/Report/ProductsCategoryReport", { params: runParams });
            return Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
        },
        enabled: !!runParams,
        retry: false,
    });

    function handleRun() {
        if (!subValue) return;
        const params: Record<string, string> = { type: selectType, id: subValue, dateMode };
        if (dateRange.start) params.startDate = format(dateRange.start, "yyyy-MM-dd");
        if (dateRange.end) params.endDate = format(dateRange.end, "yyyy-MM-dd");
        setRunParams(params);
    }

    function handleClearAll() {
        setSubValue(""); setSelectType("Product");
        setDateRange({ start: null, end: null });
        setDateMode("Month Range"); setRunParams(null); setShowChart(false);
    }

    function handleDownloadExcel() {
        if (!reportData || reportData.length === 0) return;
        const sheetData = [
            ["Type", "Name", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"],
            ...reportData.map(r => [
                r.type || r.Type || "P",
                getRowName(r),
                getVal(r, "unitsSold", "UnitsSold", "units_sold"),
                getVal(r, "totalOrders", "TotalOrders", "total_orders"),
                getVal(r, "grossRevenue", "GrossRevenue", "gross_revenue"),
                getVal(r, "taxableValue", "TaxableValue", "taxable_value"),
                getVal(r, "gstAmount", "GstAmount", "gst_amount"),
            ]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [8, 40, 12, 14, 18, 16, 14].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
        XLSX.writeFile(wb, `sales_report_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    }

    function handleDownloadPDF() {
        if (!reportData || reportData.length === 0) return;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.setTextColor(192, 57, 43);
        doc.text("Sales by Product / Category / Brand", 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(120);
        if (dateRange.start && dateRange.end) {
            doc.text(`Period: ${format(dateRange.start, "dd MMM yyyy")} → ${format(dateRange.end, "dd MMM yyyy")}`, 14, 23);
        }
        autoTable(doc, {
            startY: 28,
            head: [["Type", "Name", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"]],
            body: reportData.map(r => [
                r.type || r.Type || "P",
                getRowName(r),
                String(getVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—"),
                String(getVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—"),
                fmtINR(getVal(r, "grossRevenue", "GrossRevenue", "gross_revenue")),
                fmtINR(getVal(r, "taxableValue", "TaxableValue", "taxable_value")),
                fmtINR(getVal(r, "gstAmount", "GstAmount", "gst_amount")),
            ]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [255, 248, 248] },
            columnStyles: { 1: { cellWidth: 60 } },
        });
        doc.save(`sales_report_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const hasRun = !!runParams;
    const rows = reportData ?? [];

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#fff", minHeight: "100vh", padding: "32px 36px" }}>


            {/* <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A0A0A", margin: "0 0 28px", letterSpacing: "-0.3px" }}>
                Sales by Product / Category / Brand
            </h1> */}
            <div style={{ background: "linear-gradient(135deg,#6A012A,#fff)", padding: "18px 24px", borderBottom: "0.5px solid #6A012A" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Sales by Product / Category / Brand</div>
                <div style={{ fontSize: 12, color: "#fff", marginTop: 3 }}>Select date range and generate your sales report</div>
            </div>

            {/* Filter Row */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 220px" }}>
                    <CustomSelect
                        label="Select Type"
                        value={selectType}
                        options={TYPE_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
                        onChange={v => setSelectType(v as SelectType)}
                        placeholder="Select Type"
                        loading={false}
                    />
                </div>
                <div style={{ flex: 1, minWidth: 260 }}>
                    <CustomSelect
                        key={selectType}
                        label={selectType}
                        value={subValue}
                        options={subOptions}
                        onChange={setSubValue}
                        placeholder={`Select ${selectType}...`}
                        loading={subLoading}
                        error={subError}
                    />
                </div>
                <button
                    onClick={handleRun}
                    disabled={!subValue || running}
                    style={{
                        background: subValue && !running ? "#6A012A" : "#E8C5C5",
                        color: "#fff", border: "none", borderRadius: 24,
                        padding: "11px 28px", fontSize: 14, fontWeight: 600,
                        cursor: subValue && !running ? "pointer" : "not-allowed",
                        fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s", whiteSpace: "nowrap",
                    }}
                >
                    {running ? "Running…" : "Run"}
                </button>
                <button
                    onClick={handleClearAll}
                    style={{
                        background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                        padding: "11px 28px", fontSize: 14, fontWeight: 600,
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                    }}
                >
                    Clear All
                </button>
            </div>

            {/* Date Picker */}
            <div style={{ maxWidth: 560, marginBottom: 28 }}>
                <DatePickerField
                    dateMode={dateMode} setDateMode={setDateMode}
                    dateRange={dateRange} setDateRange={setDateRange}
                />
            </div>

            {/* Results */}
            {hasRun && (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <button
                            onClick={() => setShowChart(c => !c)}
                            style={{
                                background: "transparent", color: "#6A012A",
                                border: "1.5px solid #6A012A", borderRadius: 24,
                                padding: "7px 18px", fontSize: 13, fontWeight: 600,
                                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            {showChart ? "Hide Chart" : "Show Chart"}
                        </button>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={handleDownloadExcel} style={{
                                background: "#6A012A", color: "#fff", border: "none",
                                borderRadius: 24, padding: "9px 22px", fontSize: 13,
                                fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                            }}>
                                Excel Download
                            </button>
                            <button onClick={handleDownloadPDF} style={{
                                background: "#6A012A", color: "#fff", border: "none",
                                borderRadius: 24, padding: "9px 22px", fontSize: 13,
                                fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                            }}>
                                PDF Download
                            </button>
                        </div>
                    </div>

                    {running ? (
                        <Spinner />
                    ) : (
                        <>
                            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                    <colgroup>
                                        <col style={{ width: "6%" }} />
                                        <col style={{ width: "26%" }} />
                                        <col style={{ width: "11%" }} />
                                        <col style={{ width: "13%" }} />
                                        <col style={{ width: "16%" }} />
                                        <col style={{ width: "16%" }} />
                                        <col style={{ width: "12%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: "#6A012A" }}>
                                            {["Type", "Name", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"].map(h => (
                                                <th key={h} style={{
                                                    padding: "13px 14px", textAlign: "left", fontSize: 13,
                                                    fontWeight: 600, color: "#fff",
                                                    fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.2,
                                                }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#AAA", fontSize: 14 }}>
                                                    {hasError ? "Failed to load data. Please try again." : "No data found for the selected filters."}
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map((row, i) => (
                                                <tr
                                                    key={i}
                                                    style={{ background: i % 2 === 0 ? "#fff" : "#FFF8F8", borderBottom: "1px solid #F5E8E8", transition: "background 0.12s" }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF0F0"; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#fff" : "#FFF8F8"; }}
                                                >
                                                    <td style={cellStyle}>{row.type || row.Type || "P"}</td>
                                                    <td style={{ ...cellStyle, fontWeight: 500 }}>{getRowName(row)}</td>
                                                    <td style={cellStyle}>{getVal(row, "unitsSold", "UnitsSold", "units_sold") ?? "—"}</td>
                                                    <td style={cellStyle}>{getVal(row, "totalOrders", "TotalOrders", "total_orders") ?? "—"}</td>
                                                    <td style={cellStyle}>{fmtINR(getVal(row, "grossRevenue", "GrossRevenue", "gross_revenue"))}</td>
                                                    <td style={cellStyle}>{fmtINR(getVal(row, "taxableValue", "TaxableValue", "taxable_value"))}</td>
                                                    <td style={cellStyle}>{fmtINR(getVal(row, "gstAmount", "GstAmount", "gst_amount"))}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {showChart && rows.length > 0 && <ChartPanel data={rows} />}
                        </>
                    )}
                </>
            )}

            {!hasRun && !running && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                    Select filters and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
                </div>
            )}
        </div>
    );
};


// ─── Panel 2 : Sales by Region / Location ────────────────────────────────────

interface RegionRow {
    region?: string; Region?: string; state?: string; State?: string;
    totalOrders?: number; TotalOrders?: number; total_orders?: number;
    customers?: number; Customers?: number;
    unitsSold?: number; UnitsSold?: number; units_sold?: number;
    grossRevenue?: number; GrossRevenue?: number; gross_revenue?: number;
    taxableValue?: number; TaxableValue?: number; taxable_value?: number;
    gstAmount?: number; GstAmount?: number; gst_amount?: number;
}

function getRegionVal(row: RegionRow, ...keys: (keyof RegionRow)[]): number | null {
    for (const k of keys) { const v = row[k]; if (v != null) return v as number; }
    return null;
}

function getRegionName(row: RegionRow): string {
    return row.region || row.Region || row.state || row.State || "—";
}

const INDIAN_STATES = [
    "All States", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry",
];

const SalesByRegionReport: React.FC = () => {
    const [state, setState] = useState<string>("All States");
    const [dateMode, setDateMode] = useState<DateMode>("Month Range");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [runParams, setRunParams] = useState<Record<string, string> | null>(null);

    const { data: reportData, isLoading: running, isError: hasError } = useQuery<RegionRow[]>({
        queryKey: ["regionReport", runParams],
        queryFn: async () => {
            if (!runParams) return [];
            const res = await api.get("/Report/SalesByRegionReport", { params: runParams });
            const raw = res.data;
            if (Array.isArray(raw)) return raw;
            const wrapper = raw?.data ?? raw?.items ?? raw?.result ?? raw?.list ?? raw?.Data ?? raw?.Items ?? [];
            return Array.isArray(wrapper) ? wrapper : [];
        },
        enabled: !!runParams,
        retry: false,
    });

    function handleRun() {
        const params: Record<string, string> = {};
        if (state && state !== "All States") params.state = state;
        if (dateRange.start) params.startDate = format(dateRange.start, "yyyy-MM-dd");
        if (dateRange.end) params.endDate = format(dateRange.end, "yyyy-MM-dd");
        params.dateMode = dateMode;
        setRunParams(params);
    }

    function handleClearAll() {
        setState("All States");
        setDateRange({ start: null, end: null });
        setDateMode("Month Range");
        setRunParams(null);
    }

    function handleExcel() {
        if (!reportData?.length) return;
        const sheetData = [
            ["Region / State", "Total Orders", "Customers", "Units Sold", "Gross Revenue", "Taxable Value", "GST Amount"],
            ...reportData.map(r => [
                getRegionName(r),
                getRegionVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—",
                getRegionVal(r, "customers", "Customers") ?? "—",
                getRegionVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—",
                getRegionVal(r, "grossRevenue", "GrossRevenue", "gross_revenue") ?? 0,
                getRegionVal(r, "taxableValue", "TaxableValue", "taxable_value") ?? 0,
                getRegionVal(r, "gstAmount", "GstAmount", "gst_amount") ?? 0,
            ]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [22, 14, 12, 12, 18, 16, 14].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, "Region Report");
        XLSX.writeFile(wb, `sales_by_region_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    }

    function handlePDF() {
        if (!reportData?.length) return;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14); doc.setTextColor(192, 57, 43);
        doc.text("Sales by Region / Location", 14, 16);
        if (dateRange.start && dateRange.end) {
            doc.setFontSize(9); doc.setTextColor(120);
            doc.text(`Period: ${format(dateRange.start, "dd MMM yyyy")} → ${format(dateRange.end, "dd MMM yyyy")}`, 14, 23);
        }
        autoTable(doc, {
            startY: 28,
            head: [["Region / State", "Total Orders", "Customers", "Units Sold", "Gross Revenue", "Taxable Value", "GST Amount"]],
            body: reportData.map(r => [
                getRegionName(r),
                String(getRegionVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—"),
                String(getRegionVal(r, "customers", "Customers") ?? "—"),
                String(getRegionVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—"),
                fmtINR(getRegionVal(r, "grossRevenue", "GrossRevenue", "gross_revenue")),
                fmtINR(getRegionVal(r, "taxableValue", "TaxableValue", "taxable_value")),
                fmtINR(getRegionVal(r, "gstAmount", "GstAmount", "gst_amount")),
            ]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`sales_by_region_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const rows = reportData ?? [];
    const hasRun = !!runParams;

    const thStyle: React.CSSProperties = {
        padding: "13px 16px", textAlign: "left", fontSize: 13,
        fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif",
        letterSpacing: 0.2, whiteSpace: "nowrap",
    };

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "28px 32px", minHeight: 400 }}>
            {/* <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A0A0A", margin: "0 0 24px", letterSpacing: "-0.3px" }}>
                Sales by Region / Location
            </h2> */}
            <div style={{ background: "linear-gradient(135deg,#6A012A,#fff)", padding: "18px 24px", borderBottom: "0.5px solid #6A012A" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}> Sales by Region / Location</div>
                <div style={{ fontSize: 12, color: "#fff", marginTop: 3 }}>Select Region Location and generate your sales report</div>
            </div>

            {/* Filter Row */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
                {/* State Dropdown */}
                <div style={{ flex: "0 0 320px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>State</div>
                    <div style={{ position: "relative" }}>
                        <select
                            value={state}
                            onChange={e => setState(e.target.value)}
                            style={{
                                width: "100%", padding: "10px 36px 10px 14px",
                                border: "none", borderBottom: "1.5px solid #6A012A",
                                background: "#FFF8F8", fontSize: 15, fontWeight: 600,
                                color: "#1A0A0A", outline: "none", cursor: "pointer",
                                appearance: "none", fontFamily: "'DM Sans', sans-serif",
                                borderRadius: 0,
                            }}
                        >
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6A012A", pointerEvents: "none", fontSize: 14 }}>▾</span>
                    </div>
                </div>

                {/* Date Range Picker */}
                <div style={{ flex: "0 0 340px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Month &amp; Week Range</div>
                    <DatePickerField
                        dateMode={dateMode} setDateMode={setDateMode}
                        dateRange={dateRange} setDateRange={setDateRange}
                    />
                </div>

                {/* Buttons */}
                <button
                    onClick={handleRun}
                    style={{
                        background: "#6A012A", color: "#fff", border: "none",
                        borderRadius: 24, padding: "11px 32px", fontSize: 14,
                        fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        boxShadow: "0 4px 14px rgba(192,57,43,0.3)", whiteSpace: "nowrap",
                    }}
                >
                    Run
                </button>
                <button
                    onClick={handleClearAll}
                    style={{
                        background: "#6A012A", color: "#fff", border: "none",
                        borderRadius: 24, padding: "11px 32px", fontSize: 14,
                        fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        whiteSpace: "nowrap",
                    }}
                >
                    ClearAll
                </button>
            </div>

            {/* Results */}
            {hasRun && (
                <>
                    {/* Download buttons */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                        <button onClick={handleExcel} style={{
                            background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                            padding: "9px 24px", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>Excel Download</button>
                        <button onClick={handlePDF} style={{
                            background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                            padding: "9px 24px", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>Pdf Download</button>
                    </div>

                    {running ? <Spinner /> : (
                        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#C0968A" }}>
                                        <th style={thStyle}>Region / State</th>
                                        <th style={thStyle}>Total Orders</th>
                                        <th style={thStyle}>Customers</th>
                                        <th style={thStyle}>Units Sold</th>
                                        <th style={thStyle}>Gross Revenue</th>
                                        <th style={thStyle}>Taxable Value</th>
                                        <th style={thStyle}>GST Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#AAA", fontSize: 14 }}>
                                                {hasError ? "Failed to load data. Please try again." : "No data found for the selected filters."}
                                            </td>
                                        </tr>
                                    ) : rows.map((row, i) => (
                                        <tr
                                            key={i}
                                            style={{ background: "#fff", borderBottom: "1px solid #EEE", transition: "background 0.12s" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF5F5"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fff"; }}
                                        >
                                            <td style={{ ...cellStyle, fontWeight: 500 }}>{getRegionName(row)}</td>
                                            <td style={cellStyle}>{getRegionVal(row, "totalOrders", "TotalOrders", "total_orders") ?? "—"}</td>
                                            <td style={cellStyle}>{getRegionVal(row, "customers", "Customers") ?? "—"}</td>
                                            <td style={cellStyle}>{getRegionVal(row, "unitsSold", "UnitsSold", "units_sold") ?? "—"}</td>
                                            <td style={cellStyle}>{fmtINR(getRegionVal(row, "grossRevenue", "GrossRevenue", "gross_revenue"))}</td>
                                            <td style={cellStyle}>{fmtINR(getRegionVal(row, "taxableValue", "TaxableValue", "taxable_value"))}</td>
                                            <td style={cellStyle}>{fmtINR(getRegionVal(row, "gstAmount", "GstAmount", "gst_amount"))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {!hasRun && !running && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                    Select filters and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
                </div>
            )}
        </div>
    );
};


// ─── Panel 3 & 4 : Top-Selling / Low-Performing Products ─────────────────────

interface TopLowRow {
    rank?: number; Rank?: number;
    productName?: string; ProductName?: string; name?: string; Name?: string;
    unitsSold?: number; UnitsSold?: number; units_sold?: number;
    totalOrders?: number; TotalOrders?: number; total_orders?: number;
    grossRevenue?: number; GrossRevenue?: number; gross_revenue?: number;
    category?: string; Category?: string; categoryName?: string;
    brand?: string; Brand?: string; brandName?: string;
}

function getTopLowVal(row: TopLowRow, ...keys: (keyof TopLowRow)[]): number | null {
    for (const k of keys) { const v = row[k]; if (v != null) return v as number; }
    return null;
}

function getTopLowName(row: TopLowRow): string {
    return row.productName || row.ProductName || row.name || row.Name || "—";
}
function getTopLowCategory(row: TopLowRow): string {
    return row.category || row.Category || row.categoryName || "—";
}
function getTopLowBrand(row: TopLowRow): string {
    return row.brand || row.Brand || row.brandName || "—";
}

interface TopLowPanelProps { mode: "top" | "low"; }

const TopLowSellingPanel: React.FC<TopLowPanelProps> = ({ mode }) => {
    const isTop = mode === "top";
    const title = isTop ? "Top-Selling Products" : "Low-Performing Products";

    const [rank, setRank] = useState<number>(1);
    const [runParams, setRunParams] = useState<Record<string, string> | null>(null);

    const { data: reportData, isLoading: running, isError: hasError } = useQuery<TopLowRow[]>({
        queryKey: ["topLowReport", mode, runParams],
        queryFn: async () => {
            if (!runParams) return [];
            const res = await api.get("/Report/TopLowSellingReport", { params: runParams });
            const raw = res.data;
            if (Array.isArray(raw)) return raw;
            const wrapper = raw?.data ?? raw?.items ?? raw?.result ?? raw?.list
                ?? raw?.Data ?? raw?.Items ?? raw?.Result ?? [];
            return Array.isArray(wrapper) ? wrapper : [];
        },
        enabled: !!runParams,
        retry: false,
    });

    function handleRun() {
        setRunParams({ type: mode, rank: String(rank) });
    }

    function handleClearAll() {
        setRank(1);
        setRunParams(null);
    }

    function handleExcel() {
        if (!reportData?.length) return;
        const sheetData = [
            ["Rank", "Product Name", "Units Sold", "Total Orders", "Gross Revenue", "Category", "Brand"],
            ...reportData.map((r, i) => [
                getTopLowVal(r, "rank", "Rank") ?? i + 1,
                getTopLowName(r),
                getTopLowVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—",
                getTopLowVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—",
                getTopLowVal(r, "grossRevenue", "GrossRevenue", "gross_revenue") ?? 0,
                getTopLowCategory(r),
                getTopLowBrand(r),
            ]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [8, 30, 12, 14, 18, 18, 16].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${mode}_selling_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    }

    function handlePDF() {
        if (!reportData?.length) return;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14); doc.setTextColor(192, 57, 43);
        doc.text(title, 14, 16);
        autoTable(doc, {
            startY: 24,
            head: [["Rank", "Product Name", "Units Sold", "Total Orders", "Gross Revenue", "Category", "Brand"]],
            body: reportData.map((r, i) => [
                String(getTopLowVal(r, "rank", "Rank") ?? i + 1),
                getTopLowName(r),
                String(getTopLowVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—"),
                String(getTopLowVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—"),
                fmtINR(getTopLowVal(r, "grossRevenue", "GrossRevenue", "gross_revenue")),
                getTopLowCategory(r),
                getTopLowBrand(r),
            ]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`${mode}_selling_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const rows = reportData ?? [];
    const hasRun = !!runParams;

    const thStyle: React.CSSProperties = {
        padding: "13px 16px", textAlign: "left", fontSize: 13,
        fontWeight: 600, color: "#fff",
        fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
    };

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "28px 32px", minHeight: 400 }}>
         
            <div style={{ background: "linear-gradient(135deg,#6A012A,#fff)", padding: "18px 24px", borderBottom: "0.5px solid #6A012A" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}> {title} </div>
                <div style={{ fontSize: 12, color: "#fff", marginTop: 3 }}>Enter Rank to generate your sales report</div>
            </div>
            {/* Filter Row */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
                {/* Rank input */}
                <div style={{ flex: "0 0 280px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Rank</div>
                    <div style={{ position: "relative" }}>
                        <input
                            type="number"
                            min={1}
                            value={rank}
                            onChange={e => setRank(Math.max(1, Number(e.target.value)))}
                            style={{
                                width: "100%", padding: "10px 14px",
                                border: "none", borderBottom: "1.5px solid #6A012A",
                                background: "#FFF8F8", fontSize: 15, fontWeight: 600,
                                color: "#1A0A0A", outline: "none",
                                fontFamily: "'DM Sans', sans-serif", borderRadius: 0,
                                boxSizing: "border-box",
                            }}
                        />
                    </div>
                </div>

                {/* Spacer pushes buttons to the right */}
                <div style={{ flex: 1 }} />

                <button
                    onClick={handleRun}
                    style={{
                        background: "#6A012A", color: "#fff", border: "none",
                        borderRadius: 24, padding: "11px 32px", fontSize: 14,
                        fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        boxShadow: "0 4px 14px rgba(192,57,43,0.3)", whiteSpace: "nowrap",
                    }}
                >Run</button>
                <button
                    onClick={handleClearAll}
                    style={{
                        background: "#6A012A", color: "#fff", border: "none",
                        borderRadius: 24, padding: "11px 32px", fontSize: 14,
                        fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        whiteSpace: "nowrap",
                    }}
                >ClearAll</button>
            </div>

            {/* Results */}
            {hasRun && (
                <>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                        <button onClick={handleExcel} style={{
                            background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                            padding: "9px 24px", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>Excel Download</button>
                        <button onClick={handlePDF} style={{
                            background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                            padding: "9px 24px", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>Pdf Download</button>
                    </div>

                    {running ? <Spinner /> : (
                        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#C0968A" }}>
                                        <th style={thStyle}>Rank</th>
                                        <th style={thStyle}>Product Name</th>
                                        <th style={thStyle}>Units Sold</th>
                                        <th style={thStyle}>Total Orders</th>
                                        <th style={thStyle}>Gross Revenue</th>
                                        <th style={thStyle}>Category</th>
                                        <th style={thStyle}>Brand</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#AAA", fontSize: 14 }}>
                                                {hasError ? "Failed to load data. Please try again." : "No data found."}
                                            </td>
                                        </tr>
                                    ) : rows.map((row, i) => (
                                        <tr
                                            key={i}
                                            style={{ background: "#fff", borderBottom: "1px solid #EEE", transition: "background 0.12s" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF5F5"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fff"; }}
                                        >
                                            <td style={cellStyle}>{getTopLowVal(row, "rank", "Rank") ?? i + 1}</td>
                                            <td style={{ ...cellStyle, fontWeight: 500 }}>{getTopLowName(row)}</td>
                                            <td style={cellStyle}>{getTopLowVal(row, "unitsSold", "UnitsSold", "units_sold") ?? "—"}</td>
                                            <td style={cellStyle}>{getTopLowVal(row, "totalOrders", "TotalOrders", "total_orders") ?? "—"}</td>
                                            <td style={cellStyle}>{fmtINR(getTopLowVal(row, "grossRevenue", "GrossRevenue", "gross_revenue"))}</td>
                                            <td style={cellStyle}>{getTopLowCategory(row)}</td>
                                            <td style={cellStyle}>{getTopLowBrand(row)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {!hasRun && !running && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                    Enter a rank and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
                </div>
            )}
        </div>
    );
};

// ─── Root Page ────────────────────────────────────────────────────────────────

const Sales_RevenueReports: React.FC = () => {
    const [active, setActive] = useState<number>(0);
    const navigate = useNavigate();

    const panels: React.ReactNode[] = [
        <DailySalesPanel />,
        <SalesByCategoryReport />,
        <SalesByRegionReport />,
        <TopLowSellingPanel mode="top" />,
        <TopLowSellingPanel mode="low" />,
        <ComingSoon title="Gross Revenue vs. Net Revenue" />,
        <ComingSoon title="Sales by Device / Platform" />,
        <ComingSoon title="Coupon/Discount Usage Report" />,
    ];

    return (
        <div style={{ background: "#fafafa", minHeight: "100vh", paddingBottom: 40, fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "22px 24px 16px", position: "relative", borderBottom: "0.5px solid #f0e0e0", background: "#fff" }}>
                <button
                    onClick={() => navigate("/admin/reports")}
                    style={{ position: "absolute", left: 24, display: "flex", alignItems: "center", gap: 6, color: "#6A012A", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "none", fontFamily: "inherit" }}
                >
                    ← Reports
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
                    🛍️ Sales &amp; Revenue Reports
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "24px 24px 0" }}>
                {REPORT_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActive(tab.id)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "14px 16px",
                        border: `1.5px solid ${active === tab.id ? "transparent" : "#6A012A"}`,
                        borderRadius: 40,
                        background: active === tab.id ? "#6A012A" : "#fff",
                        color: active === tab.id ? "#fff" : "#6A012A",
                        fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit", textAlign: "left", transition: "all .22s ease",
                        boxShadow: active === tab.id ? "0 4px 20px rgba(106,1,42,0.3)" : "none",
                    }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ padding: "20px 24px 0" }}>
                <div style={{ background: "#fff", borderRadius: 16, border: "0.5px solid #ffd0d0", overflow: "hidden", boxShadow: "0 2px 16px rgba(106,1,42,0.07)" }}>
                    {panels[active]}
                </div>
            </div>
        </div>
    );
};

export default Sales_RevenueReports;