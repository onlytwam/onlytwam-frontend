// Admin Sales Revenue Reports Page
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
    OrderStatus: string;
    OrderId: string;
    OrderNumber?: string;
    customerName: string;
    ProductName: string;
    OrderDate: string;
    Quantity: number;
    TotalAmount: number;
    State: string;
    TotalRevenue?: number;
    TotalOrders?: number;
}

interface Order {
    OrderId: string;
    OrderNumber: string;
    ProductName: string;
    OrderDate: string;
    Quantity: number;
    TotalAmount: number;
    State: string;
}

interface ReportResult {
    label: string;
    data: Order[];
    total: number;
    orders: number;
    avg: number;
    completed: number;
    stateBreakdown: { state: string; count: number; total: number }[];
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
    GrossRevenue?: number;
    grossRevenue?: number;
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

const STATUS_COLOR_MAP: Record<string, { background: string; color: string }> = {
    completed: { background: "#ebfbee", color: "#2f9e44" },
    complete: { background: "#ebfbee", color: "#2f9e44" },
    delivered: { background: "#ebfbee", color: "#2f9e44" },
    paid: { background: "#ebfbee", color: "#2f9e44" },
    success: { background: "#ebfbee", color: "#2f9e44" },
    pending: { background: "#fff9db", color: "#e67700" },
    cancelled: { background: "#fff5f5", color: "#e03131" },
    canceled: { background: "#fff5f5", color: "#e03131" },
    rejected: { background: "#fff5f5", color: "#e03131" },
    failed: { background: "#ffe3e3", color: "#c92a2a" },
    processing: { background: "#e7f5ff", color: "#1971c2" },
    confirmed: { background: "#f3f0ff", color: "#6741d9" },
    shipped: { background: "#e8f4f8", color: "#0c8599" },
    dispatched: { background: "#e8f4f8", color: "#0c8599" },
    refunded: { background: "#fff4e6", color: "#d9480f" },
};

function generateStatusColor(status: string): { background: string; color: string } {
    const palette = [
        { background: "#f3f0ff", color: "#6741d9" },
        { background: "#e7f5ff", color: "#1971c2" },
        { background: "#e8f4f8", color: "#0c8599" },
        { background: "#fff4e6", color: "#d9480f" },
        { background: "#f8f0fc", color: "#9c36b5" },
        { background: "#e6fcf5", color: "#0ca678" },
        { background: "#fff9db", color: "#e67700" },
    ];
    const hash = status.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
}

function mapApiOrder(raw: ApiOrder): Order {
    return {
        OrderId: raw.OrderId ?? "—",
        ProductName: raw.ProductName ?? "-",
        OrderNumber: raw.OrderNumber ?? raw.OrderId ?? "—",
        OrderDate: raw.OrderDate ?? "",
        Quantity: Number(raw.Quantity ?? 0),
        TotalAmount: Number(raw.TotalAmount ?? 0),
        State: raw.State || raw.OrderStatus || "Unknown",
    };
}

function getVal(row: RegionRow, ...keys: (keyof RegionRow)[]): number | null {
    for (const k of keys) {
        const v = row[k];
        if (v != null && v !== "") return Number(v);
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

// ─── Validate date range — both must be selected ──────────────────────────────
function validateDateRange(dateRange: DateRange): string | null {
    if (dateRange.start && !dateRange.end) return "Please select an end date for the range.";
    if (!dateRange.start && dateRange.end) return "Please select a start date for the range.";
    return null;
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

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const key = status.toLowerCase().trim();
    const style = STATUS_COLOR_MAP[key] ?? generateStatusColor(key);
    return (
        <span style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10.5,
            fontWeight: 700, whiteSpace: "nowrap", ...style,
        }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
    <div style={{ padding: 40, textAlign: "center", color: "#adb5bd" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
        <div style={{ fontWeight: 700, color: "#495057", marginBottom: 6, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13 }}>Report coming soon.</div>
    </div>
);

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

// ─── Range Warning Banner ─────────────────────────────────────────────────────

const RangeWarning: React.FC<{ message: string }> = ({ message }) => (
    <div style={{
        padding: "10px 16px", background: "#fff9db",
        border: "1px solid #ffe066", borderRadius: 10,
        color: "#e67700", fontSize: 13, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
    }}>
        ⚠️ {message}
    </div>
);

// ─── Download Helpers ─────────────────────────────────────────────────────────

function downloadOrdersExcel(data: Order[], label: string) {
    const rows = data.map((r, i) => ({
        "#": i + 1,
        "Order ID": r.OrderId,
        "Order Number": r.OrderNumber || r.OrderId,
        "Product": r.ProductName,
        "Date": fmtDate(r.OrderDate),
        "Qty": r.Quantity,
        "Amount": r.TotalAmount,
        "Status": r.State,
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
        head: [["#", "Order ID", "Product", "Date", "Qty", "Amount", "Status"]],
        body: data.map((r, i) => [i + 1, r.OrderId, r.ProductName, fmtDate(r.OrderDate), r.Quantity, fmtINR(r.TotalAmount), r.State]),
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
            if (!mwStart || !mwEnd) {
                setError("Please select both start and end dates.");
                return null;
            }
            if (mwStart > mwEnd) {
                setError("Start date must be before or equal to end date.");
                return null;
            }
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

    const FAILED_STATES = new Set(["cancelled", "canceled", "failed", "rejected"]);

    const runReport = async () => {
        setError(null);
        const range = buildRange();
        if (!range) return;
        setLoading(true);
        setReport(null);
        try {
            const res = await api.get("/Report/OrderList", {
                params: { type: range.type, fromDate: range.from, toDate: range.to },
            });
            const json = res.data;
            const rawList: ApiOrder[] = Array.isArray(json) ? json : (json.data ?? json.orders ?? json.result ?? json.list ?? []);
            const data = rawList.map(mapApiOrder);
            const firstRaw = rawList[0] ?? {};
            const total = Number((firstRaw as ApiOrder).TotalRevenue ?? 0);
            const orders = Number((firstRaw as ApiOrder).TotalOrders ?? 0);
            const avg = orders ? Math.round(total / orders) : 0;

            const stateMap: Record<string, { count: number; total: number }> = {};
            data.forEach(r => {
                const key = (r.State ?? "Unknown").trim();
                if (!stateMap[key]) stateMap[key] = { count: 0, total: 0 };
                stateMap[key].count += 1;
                stateMap[key].total += Number(r.TotalAmount);
            });
            const stateBreakdown = Object.entries(stateMap).map(([state, v]) => ({
                state, count: v.count, total: v.total,
            }));

            const completed = data.filter(r =>
                !FAILED_STATES.has((r.State ?? "").toLowerCase().trim())
            ).length;

            setReport({ label: range.label, data, total, orders, avg, completed, stateBreakdown });
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

    // Validate month-week range inline
    const mwRangeError = pickerType === "month-week" && mwStart && mwEnd && mwStart > mwEnd
        ? "Start date must be before end date."
        : null;

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
                        <div style={{ flex: 1, minWidth: 300 }}>
                            <label style={labelSt}>Date Range (Start → End)</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    type="date"
                                    style={{ ...inputBase, width: "auto", flex: 1, borderColor: mwRangeError ? "#e03131" : "#dee2e6" }}
                                    value={mwStart}
                                    onChange={e => { setMwStart(e.target.value); setError(null); }}
                                />
                                <span style={{ color: "#6A012A", fontWeight: 700, fontSize: 18 }}>→</span>
                                <input
                                    type="date"
                                    style={{ ...inputBase, width: "auto", flex: 1, borderColor: mwRangeError ? "#e03131" : "#dee2e6" }}
                                    value={mwEnd}
                                    min={mwStart}
                                    onChange={e => { setMwEnd(e.target.value); setError(null); }}
                                />
                            </div>
                            {mwRangeError && (
                                <div style={{ fontSize: 11, color: "#e03131", marginTop: 4, fontWeight: 600 }}>
                                    ⚠️ {mwRangeError}
                                </div>
                            )}
                            {mwStart && mwEnd && !mwRangeError && (
                                <div style={{ fontSize: 11, color: "#2f9e44", marginTop: 4, fontWeight: 600 }}>
                                    ✓ Range: {fmtDate(mwStart)} → {fmtDate(mwEnd)}
                                </div>
                            )}
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
                        <button
                            onClick={runReport}
                            disabled={loading || !!mwRangeError}
                            style={{
                                padding: "10px 28px",
                                background: (loading || !!mwRangeError) ? "#adb5bd" : "#6A012A",
                                color: "#fff", border: "none", borderRadius: 10, fontSize: 13,
                                fontWeight: 700, cursor: (loading || !!mwRangeError) ? "not-allowed" : "pointer",
                                fontFamily: "inherit", whiteSpace: "nowrap",
                                boxShadow: (loading || !!mwRangeError) ? "none" : "0 4px 14px rgba(224,49,49,0.3)",
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

                {loading && <Spinner />}

                {!loading && report && report.orders === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "#adb5bd", fontSize: 14 }}>
                        📭 No orders found for the selected period.
                    </div>
                )}

                {!loading && report && report.orders > 0 && (
                    <div>
                        {/* Range label */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            marginBottom: 16, flexWrap: "wrap", gap: 10,
                        }}>
                            <div style={{
                                background: "#6A012A10", border: "1px solid #6A012A30",
                                borderRadius: 8, padding: "6px 14px",
                                fontSize: 12, fontWeight: 700, color: "#6A012A",
                            }}>
                                📅 {report.label}
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    onClick={() => downloadOrdersExcel(report.data, report.label)}
                                    style={{
                                        padding: "10px 22px", background: "#2f9e44", color: "#fff",
                                        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                                        cursor: "pointer", fontFamily: "inherit",
                                        boxShadow: "0 4px 14px rgba(47,158,68,0.3)",
                                    }}>📥 Excel</button>
                                <button
                                    onClick={() => downloadOrdersPDF(report.data, report.label, { total: report.total, orders: report.orders, avg: report.avg, completed: report.completed })}
                                    style={{
                                        padding: "10px 22px", background: "#6A012A", color: "#fff",
                                        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                                        cursor: "pointer", fontFamily: "inherit",
                                        boxShadow: "0 4px 14px rgba(224,49,49,0.3)",
                                    }}>📄 PDF</button>
                            </div>
                        </div>

                        {/* Summary Row */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
                            {[
                                { label: "Total Revenue", value: fmtINR(report.total), sub: "All orders combined", icon: "₹", color: "#6A012A" },
                                { label: "Total Orders", value: report.orders, sub: "Across all states", icon: "#", color: "#1971c2" },
                                { label: "Avg Order Value", value: fmtINR(report.avg), sub: "Total ÷ all orders", icon: "~", color: "#0ca678" },
                            ].map(({ label, value, sub, icon, color }) => (
                                <div key={label} style={{
                                    background: "#fff", border: "0.5px solid #f0e0e0", borderRadius: 14,
                                    padding: "18px 20px", display: "flex", alignItems: "center", gap: 16,
                                }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12,
                                        background: `${color}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 20, fontWeight: 700, color, flexShrink: 0,
                                    }}>{icon}</div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#868e96", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.2 }}>{value}</div>
                                        <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 3 }}>{sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* State Breakdown */}
                        <div style={{ background: "#fff", border: "0.5px solid #f0e0e0", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#495057", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>
                                Orders by Status
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                                {report.stateBreakdown.map(({ state, count, total }) => {
                                    const key = state.toLowerCase().trim();
                                    const style = STATUS_COLOR_MAP[key] ?? generateStatusColor(key);
                                    const pct = report.orders ? Math.round((count / report.orders) * 100) : 0;
                                    return (
                                        <div key={state} style={{
                                            background: `${style.color}08`, border: `1px solid ${style.color}25`,
                                            borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden",
                                        }}>
                                            <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, width: `${pct}%`, background: style.color, borderRadius: "0 2px 0 0", transition: "width 0.4s ease" }} />
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: style.color }}>{state}</span>
                                                <span style={{ fontSize: 10, fontWeight: 700, background: `${style.color}18`, color: style.color, padding: "2px 7px", borderRadius: 20 }}>{pct}%</span>
                                            </div>
                                            <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a2e", lineHeight: 1 }}>{count}</div>
                                            <div style={{ fontSize: 10, color: "#868e96", marginTop: 2, marginBottom: 8 }}>orders</div>
                                            <div style={{ borderTop: `1px dashed ${style.color}30`, paddingTop: 8 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{fmtINR(total)}</div>
                                                <div style={{ fontSize: 10, color: "#adb5bd", marginTop: 1 }}>Avg {fmtINR(count ? total / count : 0)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid #f0e0e0" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                                <thead>
                                    <tr style={{ background: "#6A012A" }}>
                                        {["#", "Order ID", "Product", "Date", "Qty", "Amount", "Status"].map(h => (
                                            <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.data.map((row, i) => (
                                        <tr key={row.OrderId} style={{ borderBottom: "0.5px solid #f8f0f0", background: i % 2 === 0 ? "#fff" : "#fff9f9" }}>
                                            <td style={{ padding: "11px 14px", color: "#adb5bd", fontSize: 11 }}>{i + 1}</td>
                                            <td style={{ padding: "11px 14px", fontWeight: 600, color: "#4361ee" }}>#{row.OrderNumber || row.OrderId}</td>
                                            <td style={{ padding: "11px 14px" }}>{row.ProductName}</td>
                                            <td style={{ padding: "11px 14px", color: "#868e96" }}>{fmtDate(row.OrderDate)}</td>
                                            <td style={{ padding: "11px 14px", textAlign: "center" }}>{row.Quantity}</td>
                                            <td style={{ padding: "11px 14px", fontWeight: 700 }}>{fmtINR(row.TotalAmount)}</td>
                                            <td style={{ padding: "11px 14px" }}><StatusBadge status={row.State} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: "#6A012A10", borderTop: "2px solid #6A012A" }}>
                                        <td colSpan={5} style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: "#6A012A", textAlign: "right" }}>Total Revenue</td>
                                        <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 14, color: "#6A012A" }}>
                                            {fmtINR(report.data.reduce((a, r) => a + Number(r.TotalAmount), 0))}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
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

            {/* Instruction */}
            <div style={{ fontSize: 11, color: "#6A012A", fontWeight: 600, textAlign: "center", marginBottom: 10, background: "#6A012A10", borderRadius: 6, padding: "4px 8px" }}>
                {selecting === "start" ? "① Select start month" : "② Select end month"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {MONTHS.map((mo, m) => {
                    const key = cellKey(viewYear, m);
                    const isStart = key === startKey;
                    const isEnd = key === endKey;
                    const active = isStart || isEnd;
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
                                position: "relative",
                            }}
                        >
                            {mo}
                            {isStart && <span style={{ position: "absolute", top: -4, right: -2, fontSize: 8, background: "#2f9e44", color: "#fff", borderRadius: 4, padding: "1px 3px" }}>S</span>}
                            {isEnd && <span style={{ position: "absolute", top: -4, right: -2, fontSize: 8, background: "#1971c2", color: "#fff", borderRadius: 4, padding: "1px 3px" }}>E</span>}
                        </div>
                    );
                })}
            </div>

            {/* Status line */}
            <div style={{ marginTop: 12, fontSize: 12, textAlign: "center" }}>
                {!value.start && <span style={{ color: "#adb5bd" }}>Click a month to set the start</span>}
                {value.start && !value.end && (
                    <span style={{ color: "#e67700", fontWeight: 600 }}>
                        Start: {format(value.start, "MMM yyyy")} — now select end month
                    </span>
                )}
                {value.start && value.end && (
                    <span style={{ color: "#2f9e44", fontWeight: 600 }}>
                        ✓ {format(value.start, "MMM yyyy")} → {format(value.end, "MMM yyyy")}
                    </span>
                )}
            </div>
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
        <div style={{ padding: "16px", maxHeight: 320, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <button onClick={() => setViewYear(y => y - 1)} style={navBtnStyle}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>{viewYear}</span>
                <button onClick={() => setViewYear(y => y + 1)} style={navBtnStyle}>›</button>
            </div>

            {/* Instruction */}
            <div style={{ fontSize: 11, color: "#6A012A", fontWeight: 600, textAlign: "center", marginBottom: 8, background: "#6A012A10", borderRadius: 6, padding: "4px 8px" }}>
                {selecting === "start" ? "① Select start week" : "② Select end week"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
                {weeks.map((w, idx) => {
                    const active = isActive(idx);
                    const range = inRange(idx);
                    const isStartWeek = startTime === w.start.getTime();
                    const isEndWeek = endTime === w.start.getTime();
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
                                display: "flex", alignItems: "center", gap: 4,
                            }}
                        >
                            {w.label}
                            {isStartWeek && <span style={{ fontSize: 8, background: "#2f9e44", color: "#fff", borderRadius: 3, padding: "1px 3px", flexShrink: 0 }}>S</span>}
                            {isEndWeek && <span style={{ fontSize: 8, background: "#1971c2", color: "#fff", borderRadius: 3, padding: "1px 3px", flexShrink: 0 }}>E</span>}
                        </div>
                    );
                })}
            </div>

            {/* Status line */}
            <div style={{ marginTop: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
                {!value.start && <span style={{ color: "#adb5bd" }}>Click a week to set the start</span>}
                {value.start && !value.end && (
                    <span style={{ color: "#e67700", fontWeight: 600 }}>
                        Start: {format(value.start, "d MMM yyyy")} — now select end week
                    </span>
                )}
                {value.start && value.end && (
                    <span style={{ color: "#2f9e44", fontWeight: 600 }}>
                        ✓ {format(value.start, "d MMM yyyy")} → {format(value.end, "d MMM yyyy")}
                    </span>
                )}
            </div>
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

    useEffect(() => { if (loading) setOpen(false); }, [loading]);

    const selected = options.find(o => o.value === value);
    const displayLabel = loading ? "Loading..." : error ? "Failed to load options" : selected ? selected.label : value ? value : placeholder;

    return (
        <div ref={ref} style={{ position: "relative", flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6A012A", fontFamily: "'DM Sans', sans-serif", marginBottom: 4, fontWeight: 500 }}>{label}</div>
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
                        <div style={{ padding: "12px 14px", fontSize: 13, color: "#AAA" }}>No options available</div>
                    ) : (
                        options.map(o => (
                            <div
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                style={{
                                    padding: "10px 14px", fontSize: 13,
                                    cursor: "pointer",
                                    background: o.value === value ? "#FFF0F0" : "transparent",
                                    color: o.value === value ? "#6A012A" : "#2D1A1A",
                                    fontWeight: o.value === value ? 600 : 400,
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
// KEY FIX: Apply button is disabled until BOTH start and end are selected.
// A warning is shown when only start is picked. The parent handleRun also
// guards against incomplete ranges before sending the API request.

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

    const bothSelected = !!(dateRange.start && dateRange.end);
    const onlyStartSelected = !!(dateRange.start && !dateRange.end);

    function formatDisplay(): string | null {
        if (!dateRange.start) return null;
        const s = format(dateRange.start, dateMode === "Month Range" ? "MMM yyyy" : "d MMM yyyy");
        const e = dateRange.end ? format(dateRange.end, dateMode === "Month Range" ? "MMM yyyy" : "d MMM yyyy") : null;
        return e ? `${s} → ${e}` : `${s} → ?`;
    }

    const display = formatDisplay();

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    border: `1.5px solid ${open ? "#6A012A" : onlyStartSelected ? "#e67700" : "#E8C5C5"}`,
                    borderRadius: open ? "10px 10px 0 0" : 10,
                    background: "#FFF8F8", cursor: "pointer", minHeight: 44,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    color: display ? (onlyStartSelected ? "#e67700" : "#2D1A1A") : "#999",
                    userSelect: "none", transition: "border 0.15s",
                }}
            >
                <span>{display || "Select Month & Week Range"}</span>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4" width="14" height="14" rx="2" stroke="#6A012A" strokeWidth="1.5" />
                    <path d="M7 2v4M13 2v4M3 9h14" stroke="#6A012A" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>

            {/* Incomplete range hint below the field */}
            {onlyStartSelected && !open && (
                <div style={{ fontSize: 11, color: "#e67700", fontWeight: 600, marginTop: 4 }}>
                    ⚠️ Open picker and select an end {dateMode === "Month Range" ? "month" : "week"}
                </div>
            )}
            {bothSelected && !open && (
                <div style={{ fontSize: 11, color: "#2f9e44", fontWeight: 600, marginTop: 4 }}>
                    ✓ Range confirmed
                </div>
            )}

            {open && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    background: "#fff", border: "1.5px solid #E8C5C5",
                    borderTop: "none", borderRadius: "0 0 10px 10px",
                    zIndex: 999, boxShadow: "0 4px 20px rgba(192,57,43,0.12)",
                }}>
                    {/* Mode tabs */}
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

                    {/* Footer */}
                    <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #F0E0E0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {/* Status message */}
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {!dateRange.start && (
                                <span style={{ color: "#adb5bd" }}>Select a start {dateMode === "Month Range" ? "month" : "week"}</span>
                            )}
                            {dateRange.start && !dateRange.end && (
                                <span style={{ color: "#e67700" }}>⚠️ Select an end {dateMode === "Month Range" ? "month" : "week"} to continue</span>
                            )}
                            {bothSelected && (
                                <span style={{ color: "#2f9e44" }}>✓ Range ready — click Apply</span>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => { setDateRange({ start: null, end: null }); }}
                                style={{
                                    background: "transparent", color: "#6A012A",
                                    border: "1px solid #6A012A", borderRadius: 8,
                                    padding: "7px 14px", fontSize: 12,
                                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                Clear
                            </button>
                            {/* Apply is DISABLED until both dates are selected */}
                            <button
                                onClick={() => { if (bothSelected) setOpen(false); }}
                                disabled={!bothSelected}
                                style={{
                                    background: bothSelected ? "#6A012A" : "#E8C5C5",
                                    color: "#fff", border: "none", borderRadius: 8,
                                    padding: "7px 20px", fontSize: 13,
                                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                                    cursor: bothSelected ? "pointer" : "not-allowed",
                                    transition: "background 0.2s",
                                }}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────

function ChartPanel({ data }: { data: ReportRow[] }) {
    if (!data || data.length === 0) return null;
    const chartData = data.map(row => ({
        name: (row.name ?? "").slice(0, 20),
        Revenue: row.grossRevenue ?? 0,
        Taxable: row.taxableValue ?? 0,
        GST: row.gstAmount ?? 0,
    }));
    return (
        <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1A0A0A", marginBottom: 16 }}>Revenue Breakdown</div>
            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0E0E0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: number) => `₹${val.toLocaleString("en-IN")}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
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
    const [rangeError, setRangeError] = useState<string | null>(null);

    const typeConfig = TYPE_OPTIONS.find(t => t.value === selectType)!;

    const { data: subData, isLoading: subLoading, isError: subError } = useQuery<SubOption[]>({
        queryKey: ["subOptions", selectType],
        queryFn: async () => {
            const res = await api.get(typeConfig.api);
            const raw = res.data;
            let items: Record<string, unknown>[] = [];
            if (Array.isArray(raw)) { items = raw; }
            else if (raw && typeof raw === "object") {
                const wrapper = raw.data ?? raw.items ?? raw.result ?? raw.list ?? raw.products ?? raw.categories ?? raw.brands ?? raw.Data ?? raw.Items ?? raw.Result ?? raw.List;
                if (Array.isArray(wrapper)) items = wrapper;
            }
            return items.map((i) => {
                const val = i.id ?? i.Id ?? i.ID ?? i.productId ?? i.categoryId ?? i.brandId ?? i.ProductId ?? i.CategoryId ?? i.BrandId ?? i.value ?? i.Value ?? "";
                const lbl = i.name ?? i.Name ?? i.productName ?? i.categoryName ?? i.brandName ?? i.ProductName ?? i.CategoryName ?? i.BrandName ?? i.title ?? i.Title ?? val;
                return { value: String(val), label: String(lbl) };
            }).filter(o => o.value !== "" && o.label !== "");
        },
        staleTime: 5 * 60 * 1000, retry: 2,
    });

    const subOptions: SubOption[] = subData ?? [];
    const prevSelectType = useRef<SelectType>(selectType);
    useEffect(() => {
        if (prevSelectType.current !== selectType) {
            prevSelectType.current = selectType;
            setSubValue(""); setRunParams(null); setRangeError(null);
        }
    }, [selectType]);

    const { data: reportData, isLoading: running, isError: hasError } = useQuery<ReportRow[]>({
        queryKey: ["salesReport", runParams],
        queryFn: async () => {
            if (!runParams) return [];
            const res = await api.get("/Report/ProductsCategoryReport", { params: runParams });
            const raw = res.data;
            const list = raw?.data ?? raw?.items ?? raw?.result ?? raw?.list ?? raw?.Data ?? raw?.Items ?? raw;
            return Array.isArray(list) ? list : [];
        },
        enabled: !!runParams, retry: false,
    });

    const TYPE_MAP: Record<SelectType, string> = { Product: "P", Category: "C", Brand: "B" };

    function handleRun() {
        setRangeError(null);
        if (!subValue) return;

        // ✅ Validate: if start is selected, end must also be selected
        if (dateRange.start && !dateRange.end) {
            setRangeError("Please select an end date in the Month & Week Range picker before running.");
            return;
        }
        if (!dateRange.start && dateRange.end) {
            setRangeError("Please select a start date in the Month & Week Range picker before running.");
            return;
        }

        const params: Record<string, string> = {
            "page.index": "1", "page.size": "100",
            "order.property": "ModifiedDate", "order.ascending": "false",
            "filters[0].property": "Type", "filters[0].comparison": "", "filters[0].value": TYPE_MAP[selectType],
            "filters[1].property": "Id", "filters[1].comparison": "", "filters[1].value": subValue,
        };

        // Only append date filters when BOTH are present
        if (dateRange.start && dateRange.end) {
            params["filters[2].property"] = "FromDate";
            params["filters[2].comparison"] = "";
            params["filters[2].value"] = format(dateRange.start, "yyyy-MM-dd");
            params["filters[3].property"] = "ToDate";
            params["filters[3].comparison"] = "";
            params["filters[3].value"] = format(dateRange.end, "yyyy-MM-dd");
        }

        setRunParams(params);
    }

    function handleClearAll() {
        setSubValue(""); setSelectType("Product");
        setDateRange({ start: null, end: null }); setDateMode("Month Range");
        setRunParams(null); setShowChart(false); setRangeError(null);
    }

    function handleDownloadExcel() {
        if (!reportData || reportData.length === 0) return;
        const sheetData = [
            ["ProductName", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"],
            ...reportData.map(r => [r.productName ?? "—", r.unitsSold ?? 0, r.totalOrders ?? 0, r.grossRevenue ?? 0, r.taxableValue ?? 0, r.gstAmount ?? 0]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
        XLSX.writeFile(wb, `sales_report_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    }

    function handleDownloadPDF() {
        if (!reportData || reportData.length === 0) return;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14); doc.setTextColor(192, 57, 43);
        doc.text("Sales by Product / Category / Brand", 14, 16);
        autoTable(doc, {
            startY: 28,
            head: [["ProductName", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"]],
            body: reportData.map(r => [getRowName(r), r.unitsSold ?? "—", r.totalOrders ?? "—", fmtINR(r.grossRevenue ?? 0), fmtINR(r.taxableValue ?? 0), fmtINR(r.gstAmount ?? 0)]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 }, alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`sales_report_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const hasRun = !!runParams;
    const rows = reportData ?? [];

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#fff", minHeight: "100vh", padding: "32px 36px" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A0A0A", margin: "0 0 28px", letterSpacing: "-0.3px" }}>
                Sales by Product / Category / Brand
            </h1>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 220px" }}>
                    <CustomSelect label="Select Type" value={selectType} options={TYPE_OPTIONS.map(t => ({ value: t.value, label: t.label }))} onChange={v => setSelectType(v as SelectType)} placeholder="Select Type" loading={false} />
                </div>
                <div style={{ flex: 1, minWidth: 260 }}>
                    <CustomSelect key={selectType} label={selectType} value={subValue} options={subOptions} onChange={setSubValue} placeholder={`Select ${selectType}...`} loading={subLoading} error={subError} />
                </div>
                <button onClick={handleRun} disabled={!subValue || running} style={{
                    background: subValue && !running ? "#6A012A" : "#E8C5C5", color: "#fff", border: "none", borderRadius: 24,
                    padding: "11px 28px", fontSize: 14, fontWeight: 600,
                    cursor: subValue && !running ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}>
                    {running ? "Running…" : "Run"}
                </button>
                <button onClick={handleClearAll} style={{
                    background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                    padding: "11px 28px", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}>Clear All</button>
            </div>

            <div style={{ maxWidth: 560, marginBottom: 8 }}>
                <DatePickerField dateMode={dateMode} setDateMode={setDateMode} dateRange={dateRange} setDateRange={v => { setDateRange(v); setRangeError(null); }} />
            </div>

            {rangeError && <RangeWarning message={rangeError} />}

            <div style={{ marginBottom: 28 }} />

            {hasRun && (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <button onClick={() => setShowChart(c => !c)} style={{
                            background: "transparent", color: "#6A012A", border: "1.5px solid #6A012A",
                            borderRadius: 24, padding: "7px 18px", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>
                            {showChart ? "Hide Chart" : "Show Chart"}
                        </button>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={handleDownloadExcel} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Excel Download</button>
                            <button onClick={handleDownloadPDF} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>PDF Download</button>
                        </div>
                    </div>

                    {running ? <Spinner /> : (
                        <>
                            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                    <colgroup>
                                        <col style={{ width: "6%" }} /><col style={{ width: "26%" }} />
                                        <col style={{ width: "11%" }} /><col style={{ width: "13%" }} />
                                        <col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "12%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: "#6A012A" }}>
                                            {["Type", "Name", "Units Sold", "Total Orders", "Gross Revenue", "Taxable Value", "GST Amount"].map(h => (
                                                <th key={h} style={{ padding: "13px 14px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#AAA", fontSize: 14 }}>
                                                {hasError ? "Failed to load data." : "No data found for the selected filters."}
                                            </td></tr>
                                        ) : rows.map((row, i) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FFF8F8", borderBottom: "1px solid #F5E8E8" }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF0F0"; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#fff" : "#FFF8F8"; }}>
                                                <td style={cellStyle}>{row.type || row.Type || "P"}</td>
                                                <td style={{ ...cellStyle, fontWeight: 500 }}>{getRowName(row)}</td>
                                                <td style={cellStyle}>{row.unitsSold ?? "—"}</td>
                                                <td style={cellStyle}>{row.totalOrders ?? "—"}</td>
                                                <td style={cellStyle}>{fmtINR(row.grossRevenue ?? 0)}</td>
                                                <td style={cellStyle}>{fmtINR(row.taxableValue ?? 0)}</td>
                                                <td style={cellStyle}>{fmtINR(row.gstAmount ?? 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {showChart && rows.length > 0 && <ChartPanel data={rows} />}
                        </>
                    )}
                </>
            )}

            {!hasRun && !running && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14 }}>
                    Select filters and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
                </div>
            )}
        </div>
    );
};

// ─── Panel 2 : Sales by Region / Location ────────────────────────────────────

interface RegionRow {
    state?: string;
    Region?: string;
    TotalOrders?: number;
    unitsSold?: number;
    Customers?: number;
    GrossRevenue?: number | string;
    TaxableValue?: number | string;
    GSTAmount?: number | string;
    TotalRevenue?: number | string;
}

function getRegionName(row: RegionRow): string { return row.Region ?? "—"; }

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
    const [rangeError, setRangeError] = useState<string | null>(null);

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
        enabled: !!runParams, retry: false,
    });

    function handleRun() {
        setRangeError(null);
        // ✅ Validate range completeness
        if (dateRange.start && !dateRange.end) {
            setRangeError("Please select an end date in the Month & Week Range picker before running.");
            return;
        }
        if (!dateRange.start && dateRange.end) {
            setRangeError("Please select a start date in the Month & Week Range picker before running.");
            return;
        }
        const params: Record<string, string> = {};
        if (state && state !== "All States") params.state = state;
        // Only send both dates together
        if (dateRange.start && dateRange.end) {
            params.fromDate = format(dateRange.start, "yyyy-MM-dd");
            params.toDate = format(dateRange.end, "yyyy-MM-dd");
        }
        setRunParams(params);
    }

    function handleClearAll() {
        setState("All States"); setDateRange({ start: null, end: null });
        setDateMode("Month Range"); setRunParams(null); setRangeError(null);
    }

    function handleExcel() {
        if (!reportData?.length) return;
        const sheetData = [
            ["Region / State", "Total Orders", "Customers", "Units Sold", "Gross Revenue", "Taxable Value", "GST Amount"],
            ...reportData.map(r => [getRegionName(r), r.TotalOrders ?? "—", r.Customers ?? "—", r.unitsSold ?? "—", r.GrossRevenue ?? 0, r.TaxableValue ?? 0, r.GSTAmount ?? 0]),
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
            body: reportData.map(r => [getRegionName(r), String(r.TotalOrders ?? "—"), String(r.Customers ?? "—"), String(r.unitsSold ?? "—"), fmtINR(Number(r.GrossRevenue ?? 0)), fmtINR(Number(r.TaxableValue ?? 0)), fmtINR(Number(r.GSTAmount ?? 0))]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 }, alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`sales_by_region_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const rows = reportData ?? [];
    const hasRun = !!runParams;
    const thStyle: React.CSSProperties = { padding: "13px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" };

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "28px 32px", minHeight: 400 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A0A0A", margin: "0 0 24px" }}>Sales by Region / Location</h2>

            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
                <div style={{ flex: "0 0 320px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4 }}>State</div>
                    <div style={{ position: "relative" }}>
                        <select value={state} onChange={e => setState(e.target.value)} style={{
                            width: "100%", padding: "10px 36px 10px 14px", border: "none",
                            borderBottom: "1.5px solid #6A012A", background: "#FFF8F8",
                            fontSize: 15, fontWeight: 600, color: "#1A0A0A", outline: "none",
                            cursor: "pointer", appearance: "none", fontFamily: "'DM Sans', sans-serif", borderRadius: 0,
                        }}>
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6A012A", pointerEvents: "none" }}>▾</span>
                    </div>
                </div>

                <div style={{ flex: "0 0 340px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4 }}>Month &amp; Week Range</div>
                    <DatePickerField dateMode={dateMode} setDateMode={setDateMode} dateRange={dateRange} setDateRange={v => { setDateRange(v); setRangeError(null); }} />
                </div>

                <button onClick={handleRun} style={{
                    background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                    padding: "11px 32px", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 4px 14px rgba(192,57,43,0.3)", whiteSpace: "nowrap",
                }}>Run</button>
                <button onClick={handleClearAll} style={{
                    background: "#6A012A", color: "#fff", border: "none", borderRadius: 24,
                    padding: "11px 32px", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}>ClearAll</button>
            </div>

            {rangeError && <RangeWarning message={rangeError} />}
            <div style={{ marginBottom: 24 }} />

            {hasRun && (
                <>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                        <button onClick={handleExcel} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Excel Download</button>
                        <button onClick={handlePDF} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Pdf Download</button>
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
                                        <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#AAA", fontSize: 14 }}>
                                            {hasError ? "Failed to load data." : "No data found for selected filters."}
                                        </td></tr>
                                    ) : rows.map((row, i) => (
                                        <tr key={i} style={{ background: "#fff", borderBottom: "1px solid #EEE" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF5F5"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fff"; }}>
                                            <td style={{ ...cellStyle, fontWeight: 500 }}>{getRegionName(row)}</td>
                                            <td style={cellStyle}>{row.TotalOrders ?? "—"}</td>
                                            <td style={cellStyle}>{row.Customers ?? "—"}</td>
                                            <td style={cellStyle}>{row.unitsSold ?? "—"}</td>
                                            <td style={cellStyle}>{fmtINR(Number(row.GrossRevenue ?? 0))}</td>
                                            <td style={cellStyle}>{fmtINR(Number(row.TaxableValue ?? 0))}</td>
                                            <td style={cellStyle}>{fmtINR(Number(row.GSTAmount ?? 0))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {!hasRun && !running && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14 }}>
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
function getTopLowName(row: TopLowRow): string { return row.productName || row.ProductName || row.name || row.Name || "—"; }
function getTopLowCategory(row: TopLowRow): string { return row.category || row.Category || row.categoryName || "—"; }
function getTopLowBrand(row: TopLowRow): string { return row.brand || row.Brand || row.brandName || "—"; }

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
            const wrapper = raw?.data ?? raw?.items ?? raw?.result ?? raw?.list ?? raw?.Data ?? raw?.Items ?? raw?.Result ?? [];
            return Array.isArray(wrapper) ? wrapper : [];
        },
        enabled: !!runParams, retry: false,
    });

    function handleRun() { setRunParams({ reportType: mode, topN: String(rank) }); }
    function handleClearAll() { setRank(1); setRunParams(null); }

    function handleExcel() {
        if (!reportData?.length) return;
        const sheetData = [
            ["Rank", "Product Name", "Units Sold", "Total Orders", "Gross Revenue", "Category", "Brand"],
            ...reportData.map((r, i) => [getTopLowVal(r, "rank", "Rank") ?? i + 1, getTopLowName(r), getTopLowVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—", getTopLowVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—", getTopLowVal(r, "grossRevenue", "GrossRevenue", "gross_revenue") ?? 0, getTopLowCategory(r), getTopLowBrand(r)]),
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
            body: reportData.map((r, i) => [String(getTopLowVal(r, "rank", "Rank") ?? i + 1), getTopLowName(r), String(getTopLowVal(r, "unitsSold", "UnitsSold", "units_sold") ?? "—"), String(getTopLowVal(r, "totalOrders", "TotalOrders", "total_orders") ?? "—"), fmtINR(getTopLowVal(r, "grossRevenue", "GrossRevenue", "gross_revenue")), getTopLowCategory(r), getTopLowBrand(r)]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 }, alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`${mode}_selling_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const rows = reportData ?? [];
    const hasRun = !!runParams;
    const thStyle: React.CSSProperties = { padding: "13px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" };

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "28px 32px", minHeight: 400 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A0A0A", margin: "0 0 24px" }}>{title}</h2>

            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
                <div style={{ flex: "0 0 280px" }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4 }}>Rank</div>
                    <input type="number" min={1} value={rank} onChange={e => setRank(Math.max(1, Number(e.target.value)))} style={{
                        width: "100%", padding: "10px 14px", border: "none",
                        borderBottom: "1.5px solid #6A012A", background: "#FFF8F8",
                        fontSize: 15, fontWeight: 600, color: "#1A0A0A", outline: "none",
                        fontFamily: "'DM Sans', sans-serif", borderRadius: 0, boxSizing: "border-box",
                    }} />
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={handleRun} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "11px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(192,57,43,0.3)", whiteSpace: "nowrap" }}>Run</button>
                <button onClick={handleClearAll} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "11px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>ClearAll</button>
            </div>

            {hasRun && (
                <>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                        <button onClick={handleExcel} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Excel Download</button>
                        <button onClick={handlePDF} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Pdf Download</button>
                    </div>
                    {running ? <Spinner /> : (
                        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#C0968A" }}>
                                        <th style={thStyle}>Rank</th>
                                        <th style={thStyle}>Product Name</th>
                                        <th style={thStyle}>Units Sold</th>
                                        <th style={thStyle}>{isTop ? "Total Orders" : "Orders"}</th>
                                        <th style={thStyle}>{isTop ? "Gross Revenue" : "Revenue"}</th>
                                        <th style={thStyle}>Category</th>
                                        <th style={thStyle}>Brand</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#AAA", fontSize: 14 }}>
                                            {hasError ? "Failed to load data." : "No data found."}
                                        </td></tr>
                                    ) : rows.map((row, i) => (
                                        <tr key={i} style={{ background: "#fff", borderBottom: "1px solid #EEE" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF5F5"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fff"; }}>
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
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14 }}>
                    Enter a rank and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
                </div>
            )}
        </div>
    );
};

// ─── Panel 5 : Gross Revenue vs. Net Revenue ─────────────────────────────────

interface GrossNetRow {
    ProductName?: string;
    Category?: string;
    Brand?: string;
    GrossRevenue?: number | string;
    NetRevenue?: number | string;
    TaxAmount?: number | string;
    Discount?: number | string;
    TotalOrders?: number | string;
    UnitsSold?: number | string;
}

const GrossNetRevenuePanel: React.FC = () => {
    const [category, setCategory] = useState<string>("");
    const [brand, setBrand] = useState<string>("");
    const [dateMode, setDateMode] = useState<DateMode>("Month Range");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [runParams, setRunParams] = useState<Record<string, string> | null>(null);
    const [rangeError, setRangeError] = useState<string | null>(null);

    const { data: catOptions = [], isLoading: catLoading } = useQuery<SubOption[]>({
        queryKey: ["gnCategories"],
        queryFn: async () => {
            const res = await api.get("/Category/");
            const raw = res.data;
            const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? raw?.list ?? raw?.Data ?? []);
            return items.map(i => ({ value: String(i.CategoryId ?? i.categoryId ?? i.id ?? ""), label: String(i.Name ?? i.name ?? i.categoryName ?? "") })).filter(o => o.value && o.label);
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: brandOptions = [], isLoading: brandLoading } = useQuery<SubOption[]>({
        queryKey: ["gnBrands"],
        queryFn: async () => {
            const res = await api.get("/Brand/");
            const raw = res.data;
            const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? raw?.list ?? raw?.Data ?? []);
            return items.map(i => ({ value: String(i.brandId ?? i.BrandId ?? i.id ?? ""), label: String(i.brandName ?? i.BrandName ?? i.name ?? "") })).filter(o => o.value && o.label);
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: reportData, isLoading: running, isError: hasError } = useQuery<GrossNetRow[]>({
        queryKey: ["grossNetReport", runParams],
        queryFn: async () => {
            if (!runParams) return [];
            const res = await api.get("/Report/NetVsRevenueReport", { params: runParams });
            const raw = res.data;
            if (Array.isArray(raw)) return raw;
            const wrapper = raw?.list ?? raw?.data ?? raw?.items ?? raw?.result ?? raw?.Data ?? [];
            return Array.isArray(wrapper) ? wrapper : [];
        },
        enabled: !!runParams, retry: false,
    });

    function handleRun() {
        setRangeError(null);
        // ✅ Validate range completeness
        if (dateRange.start && !dateRange.end) {
            setRangeError("Please select an end date in the Month & Week Range picker before running.");
            return;
        }
        if (!dateRange.start && dateRange.end) {
            setRangeError("Please select a start date in the Month & Week Range picker before running.");
            return;
        }
        const params: Record<string, string> = {};
        if (category) params.categoryId = category;
        if (brand) params.brandId = brand;
        // Only send both dates together
        if (dateRange.start && dateRange.end) {
            params.fromDate = format(dateRange.start, "yyyy-MM-dd");
            params.toDate = format(dateRange.end, "yyyy-MM-dd");
        }
        setRunParams(params);
    }

    function handleClearAll() {
        setCategory(""); setBrand(""); setDateRange({ start: null, end: null });
        setDateMode("Month Range"); setRunParams(null); setRangeError(null);
    }

    function handleExcel() {
        if (!reportData?.length) return;
        const sheetData = [
            ["Product Name", "Category", "Brand", "Gross Revenue", "Net Revenue", "Tax Amount", "Discount", "Total Orders", "Units Sold"],
            ...reportData.map(r => [r.ProductName ?? "—", r.Category ?? "—", r.Brand ?? "—", Number(r.GrossRevenue ?? 0), Number(r.NetRevenue ?? 0), Number(r.TaxAmount ?? 0), Number(r.Discount ?? 0), r.TotalOrders ?? "—", r.UnitsSold ?? "—"]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [28, 18, 16, 16, 14, 14, 12, 14, 12].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, "Gross vs Net Revenue");
        XLSX.writeFile(wb, `gross_net_revenue_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    }

    function handlePDF() {
        if (!reportData?.length) return;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14); doc.setTextColor(192, 57, 43);
        doc.text("Gross Revenue vs. Net Revenue", 14, 16);
        if (dateRange.start && dateRange.end) {
            doc.setFontSize(9); doc.setTextColor(120);
            doc.text(`Period: ${format(dateRange.start, "dd MMM yyyy")} → ${format(dateRange.end, "dd MMM yyyy")}`, 14, 23);
        }
        autoTable(doc, {
            startY: 28,
            head: [["Product Name", "Category", "Brand", "Gross Revenue", "Net Revenue", "Tax Amount", "Discount"]],
            body: reportData.map(r => [r.ProductName ?? "—", r.Category ?? "—", r.Brand ?? "—", fmtINR(Number(r.GrossRevenue ?? 0)), fmtINR(Number(r.NetRevenue ?? 0)), fmtINR(Number(r.TaxAmount ?? 0)), fmtINR(Number(r.Discount ?? 0))]),
            headStyles: { fillColor: [192, 57, 43], textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 }, alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        doc.save(`gross_net_revenue_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    }

    const rows = reportData ?? [];
    const hasRun = !!runParams;
    const thStyle: React.CSSProperties = { padding: "13px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" };
    const dropLabel: React.CSSProperties = { fontSize: 11, color: "#888", fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" };
    const selectStyle: React.CSSProperties = { width: "100%", padding: "10px 32px 10px 0", border: "none", borderBottom: "1.5px solid #6A012A", background: "#FFF8F8", fontSize: 15, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", fontFamily: "'DM Sans', sans-serif", borderRadius: 0 };

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", padding: "28px 32px", minHeight: 400 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A0A0A", margin: "0 0 24px" }}>Gross Revenue vs. Net Revenue</h2>

            <div style={{ display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
                <div style={{ flex: "0 0 260px" }}>
                    <div style={dropLabel}>Parent Category</div>
                    <div style={{ position: "relative" }}>
                        <select value={category} onChange={e => setCategory(e.target.value)} disabled={catLoading} style={{ ...selectStyle, color: category ? "#1A0A0A" : "#AAA" }}>
                            <option value="">{catLoading ? "Loading..." : "All Categories"}</option>
                            {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#6A012A", pointerEvents: "none" }}>▾</span>
                    </div>
                </div>

                <div style={{ flex: "0 0 260px" }}>
                    <div style={dropLabel}>Brand</div>
                    <div style={{ position: "relative" }}>
                        <select value={brand} onChange={e => setBrand(e.target.value)} disabled={brandLoading} style={{ ...selectStyle, color: brand ? "#1A0A0A" : "#AAA" }}>
                            <option value="">{brandLoading ? "Loading..." : "All Brands"}</option>
                            {brandOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#6A012A", pointerEvents: "none" }}>▾</span>
                    </div>
                </div>

                <div style={{ flex: "0 0 320px" }}>
                    <div style={dropLabel}>Month &amp; Week Range</div>
                    <DatePickerField dateMode={dateMode} setDateMode={setDateMode} dateRange={dateRange} setDateRange={v => { setDateRange(v); setRangeError(null); }} />
                </div>

                <div style={{ flex: 1 }} />
                <button onClick={handleRun} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "11px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(192,57,43,0.3)" }}>Run</button>
                <button onClick={handleClearAll} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "11px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>ClearAll</button>
            </div>

            {rangeError && <RangeWarning message={rangeError} />}
            <div style={{ marginBottom: 24 }} />

            {hasRun && running && <Spinner />}
            {hasRun && !running && rows.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#999", fontSize: 14 }}>
                    {hasError ? "Failed to load data." : "No data found for selected filters."}
                </div>
            )}

            {hasRun && !running && rows.length > 0 && (
                <>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 16 }}>
                        <button onClick={handleExcel} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Excel Download</button>
                        <button onClick={handlePDF} style={{ background: "#6A012A", color: "#fff", border: "none", borderRadius: 24, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Pdf Download</button>
                    </div>
                    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #F0E0E0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#C0968A" }}>
                                    <th style={thStyle}>Product Name</th>
                                    <th style={thStyle}>Category</th>
                                    <th style={thStyle}>Brand</th>
                                    <th style={thStyle}>Gross Revenue</th>
                                    <th style={thStyle}>Net Revenue</th>
                                    <th style={thStyle}>Tax Amount</th>
                                    <th style={thStyle}>Discount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} style={{ background: "#fff", borderBottom: "1px solid #EEE" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FFF5F5"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fff"; }}>
                                        <td style={{ ...cellStyle, fontWeight: 500 }}>{row.ProductName ?? "—"}</td>
                                        <td style={cellStyle}>{row.Category ?? "—"}</td>
                                        <td style={cellStyle}>{row.Brand ?? "—"}</td>
                                        <td style={cellStyle}>{fmtINR(Number(row.GrossRevenue ?? 0))}</td>
                                        <td style={cellStyle}>{fmtINR(Number(row.NetRevenue ?? 0))}</td>
                                        <td style={cellStyle}>{fmtINR(Number(row.TaxAmount ?? 0))}</td>
                                        <td style={cellStyle}>{fmtINR(Number(row.Discount ?? 0))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!hasRun && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "#C0AAAA", fontSize: 14 }}>
                    Select filters and click <strong style={{ color: "#6A012A" }}>Run</strong> to generate the report.
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
        <GrossNetRevenuePanel />,
        <ComingSoon title="Sales by Device / Platform" />,
        <ComingSoon title="Coupon/Discount Usage Report" />,
    ];

    return (
        <div style={{ background: "#fafafa", minHeight: "100vh", paddingBottom: 40, fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "22px 24px 16px", position: "relative", borderBottom: "0.5px solid #f0e0e0", background: "#fff" }}>
                <button onClick={() => navigate("/admin/inventory")} style={{ position: "absolute", left: 24, display: "flex", alignItems: "center", gap: 6, color: "#6A012A", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "none", fontFamily: "inherit" }}>
                    ← inventory
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
                    🛍️ Sales &amp; Revenue Reports
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "24px 24px 0" }}>
                {REPORT_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActive(tab.id)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
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