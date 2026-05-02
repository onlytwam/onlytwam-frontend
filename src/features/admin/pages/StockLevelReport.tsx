// inventory-reports.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/shared/api/axiosInstance";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { categoryId: number; name: string; }

interface StockLevelItem {
    ProductVariantDetailId: number;
    StockId: string | null;
    ProductName: string | null;
    VariantName: string | null;
    CategoryName: string | null;
    StockQuantity: number | null;
    AvailableQuantity: number | null;
    ProcessedQuantity: number | null;
    MRPPrice: number | null;
    FinalPrice: number | null;
    DiscountPercent: number | null;
    IsLowStock: boolean | null;
    IsOutOfStock: boolean | null;
}

interface StockLevelResponse {
    TotalCount: number; Page: number; PageSize: number; Data: StockLevelItem[];
}

interface StockFilters {
    categoryId?: number | null;
    search?: string;
    isLowStock?: boolean | null;
    isOutOfStock?: boolean | null;
}

interface InventoryAgingItem {
    ProductVariantDetailId: number;
    StockId: string | null;
    ProductName: string | null;
    VariantName: string | null;
    CategoryName: string | null;
    ReceivedDate: string | null;
    DaysInStock: number | null;
    AgingBucket: string | null;
    Quantity: number | null;
    StockQuantity: number | null;
    MRPPrice: number | null;
    FinalPrice: number | null;
}

interface InventoryAgingResponse {
    TotalCount: number; Page: number; PageSize: number; Data: InventoryAgingItem[];
}

interface AgingFilters {
    categoryId?: number | null;
    search?: string;
    agingBucket?: string;
}

type ReportTab = "StockLevel" | "InventoryAging" | "FastSlowMoving" | "StockReorder" | "ProductReturn";

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TABS: { id: ReportTab; label: string; icon: string }[] = [
    { id: "StockLevel", label: "Stock Level Report", icon: "⚖️" },
    { id: "InventoryAging", label: "Inventory Aging Report", icon: "📦" },
    { id: "FastSlowMoving", label: "Fast vs. Slow-Moving Inventory", icon: "📊" },
    { id: "StockReorder", label: "Stock Reorder Alerts", icon: "🛒" },
    { id: "ProductReturn", label: "Product Return Rate", icon: "⭐" },
];

const PAGE_SIZE = 20;

const AGING_BUCKET_COLORS: Record<string, { bg: string; color: string }> = {
    "0-30": { bg: "#f0fdf4", color: "#166534" },
    "31-90": { bg: "#fffbeb", color: "#92400e" },
    "91-180": { bg: "#fff7ed", color: "#9a3412" },
    "180+": { bg: "#fef2f2", color: "#b91c1c" },
};

const AGING_BUCKET_LABELS: Record<string, string> = {
    "0-30": "Fresh", "31-90": "Moderate", "91-180": "Old", "180+": "Dead stock",
};

// Chart palette
const CHART_COLORS = {
    fresh: "#166534",
    moderate: "#92400e",
    old: "#9a3412",
    dead: "#b91c1c",
    inStock: "#166534",
    lowStock: "#d97706",
    outOfStock: "#b91c1c",
    available: "#1d4ed8",
    mrp: "#6b7280",
};

const BUCKET_FILL: Record<string, string> = {
    "0-30": CHART_COLORS.fresh,
    "31-90": CHART_COLORS.moderate,
    "91-180": CHART_COLORS.old,
    "180+": CHART_COLORS.dead,
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={cs.tooltip}>
            {label && <p style={cs.tooltipTitle}>{label}</p>}
            {payload.map((entry: any, i: number) => (
                <div key={i} style={cs.tooltipRow}>
                    <span style={{ ...cs.tooltipDot, background: entry.color ?? entry.fill }} />
                    <span style={cs.tooltipName}>{entry.name}:</span>
                    <span style={cs.tooltipVal}>
                        {typeof entry.value === "number"
                            ? entry.name?.includes("₹")
                                ? `₹${Number(entry.value).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`
                                : entry.value.toLocaleString()
                            : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

function PieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const total = d.payload.total ?? 1;
    const pct = ((d.value / total) * 100).toFixed(1);
    return (
        <div style={cs.tooltip}>
            <p style={cs.tooltipTitle}>{d.name}</p>
            <div style={cs.tooltipRow}>
                <span style={{ ...cs.tooltipDot, background: d.payload.fill }} />
                <span style={cs.tooltipName}>Count:</span>
                <span style={cs.tooltipVal}>{d.value.toLocaleString()}</span>
            </div>
            <div style={cs.tooltipRow}>
                <span style={cs.tooltipName}>Share:</span>
                <span style={cs.tooltipVal}>{pct}%</span>
            </div>
        </div>
    );
}

// ─── Chart Label ─────────────────────────────────────────────────────────────

const renderDonutLabel = ({ cx, cy, total }: any) => (
    <>
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#1f2937" fontSize={24} fontWeight={700}>
            {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7280" fontSize={12}>
            Total Items
        </text>
    </>
);

// ─── Chart Section Components ─────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={cs.card}>
            <p style={cs.cardTitle}>{title}</p>
            {children}
        </div>
    );
}

// ── Aging Charts ──────────────────────────────────────────────────────────────

function AgingCharts({ data }: { data: InventoryAgingItem[] }) {

    // Build bucket aggregates
    const buckets = useMemo(() => {
        const map: Record<string, { count: number; qty: number; value: number; days: number[] }> = {
            "0-30": { count: 0, qty: 0, value: 0, days: [] },
            "31-90": { count: 0, qty: 0, value: 0, days: [] },
            "91-180": { count: 0, qty: 0, value: 0, days: [] },
            "180+": { count: 0, qty: 0, value: 0, days: [] },
        };
        data.forEach((r) => {
            const b = r.AgingBucket ?? "0-30";
            if (!map[b]) return;
            map[b].count++;
            map[b].qty += r.Quantity ?? 0;
            map[b].value += (r.FinalPrice ?? 0) * (r.Quantity ?? 0);
            if (r.DaysInStock != null) map[b].days.push(r.DaysInStock);
        });
        return Object.entries(map).map(([bucket, v]) => ({
            bucket,
            label: AGING_BUCKET_LABELS[bucket],
            count: v.count,
            qty: v.qty,
            value: Math.round(v.value),
            avgDays: v.days.length ? Math.round(v.days.reduce((a, b) => a + b, 0) / v.days.length) : 0,
            fill: BUCKET_FILL[bucket],
            bg: AGING_BUCKET_COLORS[bucket]?.bg,
            total: data.length,
        }));
    }, [data]);

    // Stacked: available vs processed per bucket
    const stackedData = useMemo(() => {
        const map: Record<string, { available: number; stockQty: number }> = {
            "0-30": { available: 0, stockQty: 0 },
            "31-90": { available: 0, stockQty: 0 },
            "91-180": { available: 0, stockQty: 0 },
            "180+": { available: 0, stockQty: 0 },
        };
        data.forEach((r) => {
            const b = r.AgingBucket ?? "0-30";
            if (!map[b]) return;
            map[b].available += r.Quantity ?? 0;
            map[b].stockQty += r.StockQuantity ?? 0;
        });
        return Object.entries(map).map(([bucket, v]) => ({
            name: AGING_BUCKET_LABELS[bucket],
            "Qty In": v.available,
            "Stock": v.stockQty,
        }));
    }, [data]);

    const total = data.length;

    return (
        <div style={cs.grid}>

            {/* 1. Bar Chart — Items per Bucket */}
            <ChartCard title="Items per Aging Bucket">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barSize={44}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Items" radius={[6, 6, 0, 0]}>
                            {buckets.map((b) => <Cell key={b.bucket} fill={b.fill} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 2. Pie Chart — Count share */}
            <ChartCard title="Bucket Distribution (Count)">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={buckets}
                            dataKey="count"
                            nameKey="label"
                            cx="50%" cy="50%"
                            outerRadius={90}
                            paddingAngle={3}
                            label={({ name, percent }) =>
                                percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                            }
                            labelLine={false}
                        >
                            {buckets.map((b) => (
                                <Cell key={b.bucket} fill={b.fill} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 3. Stacked Column — Qty In vs Stock per Bucket */}
            <ChartCard title="Quantity vs Stock by Bucket (Stacked)">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stackedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barSize={36}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                            iconType="square"
                            iconSize={10}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                        <Bar dataKey="Qty In" stackId="a" fill="#1d4ed8" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Stock" stackId="a" fill="#6b7280" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 4. Donut Chart — Inventory value share */}
            <ChartCard title="Inventory Value by Bucket (Donut)">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={buckets}
                            dataKey="value"
                            nameKey="label"
                            cx="50%" cy="50%"
                            innerRadius={65}
                            outerRadius={100}
                            paddingAngle={3}
                        >
                            {buckets.map((b) => (
                                <Cell key={b.bucket} fill={b.fill} stroke="#fff" strokeWidth={2} />
                            ))}
                            {/* Center label via custom label prop */}
                            <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                                fill="#1f2937" fontSize={18} fontWeight={700}>
                                ₹{buckets.reduce((s, b) => s + b.value, 0).toLocaleString("en-IN")}
                            </text>
                            <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle"
                                fill="#6b7280" fontSize={11}>
                                Total Value
                            </text>
                        </Pie>
                        <Tooltip
                            content={({ active, payload }: any) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0];
                                const totalVal = buckets.reduce((s, b) => s + b.value, 0);
                                return (
                                    <div style={cs.tooltip}>
                                        <p style={cs.tooltipTitle}>{d.name}</p>
                                        <div style={cs.tooltipRow}>
                                            <span style={{ ...cs.tooltipDot, background: d.payload.fill }} />
                                            <span style={cs.tooltipName}>Value:</span>
                                            <span style={cs.tooltipVal}>₹{Number(d.value).toLocaleString("en-IN")}</span>
                                        </div>
                                        <div style={cs.tooltipRow}>
                                            <span style={cs.tooltipName}>Share:</span>
                                            <span style={cs.tooltipVal}>
                                                {totalVal > 0 ? ((d.value / totalVal) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Legend
                            iconType="circle" iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

        </div>
    );
}

// ── Stock Level Charts ────────────────────────────────────────────────────────

function StockCharts({ data }: { data: StockLevelItem[] }) {

    // By category
    const categoryData = useMemo(() => {
        const map: Record<string, { inStock: number; lowStock: number; outOfStock: number; value: number }> = {};
        data.forEach((r) => {
            const cat = r.CategoryName ?? "Uncategorized";
            if (!map[cat]) map[cat] = { inStock: 0, lowStock: 0, outOfStock: 0, value: 0 };
            if (r.IsOutOfStock) map[cat].outOfStock++;
            else if (r.IsLowStock) map[cat].lowStock++;
            else map[cat].inStock++;
            map[cat].value += r.FinalPrice ?? 0;
        });
        return Object.entries(map)
            .map(([name, v]) => ({ name, ...v, value: Math.round(v.value) }))
            .sort((a, b) => (b.inStock + b.lowStock + b.outOfStock) - (a.inStock + a.lowStock + a.outOfStock))
            .slice(0, 8);
    }, [data]);

    // Status counts for pie + donut
    const statusCounts = useMemo(() => {
        let inStock = 0, lowStock = 0, outOfStock = 0;
        data.forEach((r) => {
            if (r.IsOutOfStock) outOfStock++;
            else if (r.IsLowStock) lowStock++;
            else inStock++;
        });
        const total = data.length;
        return [
            { name: "In Stock", value: inStock, fill: CHART_COLORS.inStock, total },
            { name: "Low Stock", value: lowStock, fill: CHART_COLORS.lowStock, total },
            { name: "Out of Stock", value: outOfStock, fill: CHART_COLORS.outOfStock, total },
        ].filter((d) => d.value > 0);
    }, [data]);

    const totalItems = data.length;

    return (
        <div style={cs.grid}>

            {/* 1. Bar Chart — Stock qty per category */}
            <ChartCard title="Stock Quantity by Category">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                        data={categoryData}
                        layout="vertical"
                        margin={{ top: 4, right: 24, left: 60, bottom: 0 }}
                        barSize={18}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis
                            type="category" dataKey="name"
                            tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
                            width={56}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="inStock" name="In Stock" fill={CHART_COLORS.inStock} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 2. Pie Chart — Status share */}
            <ChartCard title="Stock Status Distribution (Pie)">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={statusCounts}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            outerRadius={90}
                            paddingAngle={3}
                            label={({ name, percent }) =>
                                percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                            }
                            labelLine={false}
                        >
                            {statusCounts.map((d, i) => (
                                <Cell key={i} fill={d.fill} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                            iconType="circle" iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 3. Stacked Column — In / Low / Out per category */}
            <ChartCard title="Status Breakdown by Category (Stacked)">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                        data={categoryData}
                        margin={{ top: 8, right: 16, left: 0, bottom: 28 }}
                        barSize={28}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            axisLine={false} tickLine={false}
                            angle={-30} textAnchor="end" interval={0}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                            iconType="square" iconSize={10}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                        <Bar dataKey="inStock" name="In Stock" stackId="s" fill={CHART_COLORS.inStock} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="lowStock" name="Low Stock" stackId="s" fill={CHART_COLORS.lowStock} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="outOfStock" name="Out of Stock" stackId="s" fill={CHART_COLORS.outOfStock} radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 4. Donut — Total item status */}
            <ChartCard title="Overall Stock Health (Donut)">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={statusCounts}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={65}
                            outerRadius={100}
                            paddingAngle={3}
                        >
                            {statusCounts.map((d, i) => (
                                <Cell key={i} fill={d.fill} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        {/* Center label */}
                        <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
                            fill="#1f2937" fontSize={22} fontWeight={700}>
                            {totalItems}
                        </text>
                        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle"
                            fill="#6b7280" fontSize={11}>
                            Total Items
                        </text>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                            iconType="circle" iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ isOutOfStock, isLowStock }: { isOutOfStock: boolean | null; isLowStock: boolean | null }) {
    if (isOutOfStock) return <span style={styles.badgeDanger}>Out of Stock</span>;
    if (isLowStock) return <span style={styles.badgeWarning}>Low Stock</span>;
    return <span style={styles.badgeSuccess}>In Stock</span>;
}

function AgingBucketBadge({ bucket }: { bucket: string | null }) {
    if (!bucket) return <span style={styles.badgeNeutral}>—</span>;
    const c = AGING_BUCKET_COLORS[bucket] ?? { bg: "#f3f4f6", color: "#374151" };
    const label: Record<string, string> = {
        "0-30": "0–30 days", "31-90": "31–90 days", "91-180": "91–180 days", "180+": "180+ days",
    };
    return (
        <span style={{ ...styles.badgeBase, background: c.bg, color: c.color }}>
            {label[bucket] ?? bucket}
        </span>
    );
}

function Pagination({ page, totalCount, pageSize, onChange }: {
    page: number; totalCount: number; pageSize: number; onChange: (p: number) => void;
}) {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;
    return (
        <div style={styles.pagination}>
            <button style={{ ...styles.pageBtn, opacity: page === 1 ? 0.4 : 1 }}
                disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
            <span style={styles.pageInfo}>
                Page {page} of {totalPages} &nbsp;·&nbsp; {totalCount} records
            </span>
            <button style={{ ...styles.pageBtn, opacity: page === totalPages ? 0.4 : 1 }}
                disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InventoryReports() {
    const [activeTab, setActiveTab] = useState<ReportTab>("StockLevel");
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [stockFilters, setStockFilters] = useState<StockFilters>({});
    const [stockData, setStockData] = useState<StockLevelResponse | null>(null);
    const [stockPage, setStockPage] = useState(1);
    const [stockHasRun, setStockHasRun] = useState(false);

    const [agingFilters, setAgingFilters] = useState<AgingFilters>({});
    const [agingData, setAgingData] = useState<InventoryAgingResponse | null>(null);
    const [agingPage, setAgingPage] = useState(1);
    const [agingHasRun, setAgingHasRun] = useState(false);

    useEffect(() => {
        api.get("/Category")
            .then((res) => {
                const d = res.data;
                const list: Category[] =
                    Array.isArray(d) ? d :
                        Array.isArray(d?.list) ? d.list :
                            Array.isArray(d?.data) ? d.data :
                                Array.isArray(d?.items) ? d.items : [];
                setCategories(list);
            })
            .catch(() => setCategories([]));
    }, []);

    const runStockLevel = useCallback(async (currentPage = 1) => {
        setLoading(true); setError(null);
        try {
            const filtersJson = JSON.stringify({
                ...(stockFilters.categoryId != null ? { categoryId: stockFilters.categoryId } : {}),
                ...(stockFilters.search ? { search: stockFilters.search } : {}),
                ...(stockFilters.isLowStock != null ? { isLowStock: stockFilters.isLowStock } : {}),
                ...(stockFilters.isOutOfStock != null ? { isOutOfStock: stockFilters.isOutOfStock } : {}),
            });
            const res = await api.get<StockLevelResponse>("/Report/StockLevelReport", {
                params: {
                    Filters: Object.keys(JSON.parse(filtersJson)).length ? filtersJson : undefined,
                    "Page.Index": currentPage, "Page.Size": PAGE_SIZE,
                },
            });
            setStockData(res.data); setStockPage(currentPage); setStockHasRun(true);
        } catch { setError("Failed to load Stock Level report. Please try again."); }
        finally { setLoading(false); }
    }, [stockFilters]);

    const runAgingReport = useCallback(async (currentPage = 1) => {
        setLoading(true); setError(null);
        try {
            const filtersJson = JSON.stringify({
                ...(agingFilters.categoryId != null ? { categoryId: agingFilters.categoryId } : {}),
                ...(agingFilters.search ? { search: agingFilters.search } : {}),
                ...(agingFilters.agingBucket ? { agingBucket: agingFilters.agingBucket } : {}),
            });
            const res = await api.get<InventoryAgingResponse>("/Report/InventoryAgingReport", {
                params: {
                    Filters: Object.keys(JSON.parse(filtersJson)).length ? filtersJson : undefined,
                    "Page.Index": currentPage, "Page.Size": PAGE_SIZE,
                },
            });
            setAgingData(res.data); setAgingPage(currentPage); setAgingHasRun(true);
        } catch { setError("Failed to load Inventory Aging report. Please try again."); }
        finally { setLoading(false); }
    }, [agingFilters]);

    const handleRun = () => {
        if (activeTab === "StockLevel") runStockLevel(1);
        if (activeTab === "InventoryAging") runAgingReport(1);
    };

    const handleClear = () => {
        setError(null);
        if (activeTab === "StockLevel") {
            setStockFilters({}); setStockData(null); setStockHasRun(false); setStockPage(1);
        }
        if (activeTab === "InventoryAging") {
            setAgingFilters({}); setAgingData(null); setAgingHasRun(false); setAgingPage(1);
        }
    };

    const handleTabChange = (tab: ReportTab) => { setActiveTab(tab); setError(null); };
    const isRunnable = activeTab === "StockLevel" || activeTab === "InventoryAging";

    return (
        <div style={styles.page}>

            {/* ── Header ── */}
            <div style={styles.header}>
                <button style={styles.backBtn} onClick={() => history.back()}>← inventory</button>
                <h1 style={styles.title}>🏢 Inventory &amp; Product Reports</h1>
            </div>

            {/* ── Tabs ── */}
            <div style={styles.tabRow}>
                {REPORT_TABS.slice(0, 3).map((tab) => (
                    <button key={tab.id} style={activeTab === tab.id ? styles.tabActive : styles.tab}
                        onClick={() => handleTabChange(tab.id)}>
                        <span style={styles.tabIcon}>{tab.icon}</span>{tab.label}
                    </button>
                ))}
            </div>
            <div style={{ ...styles.tabRow, marginTop: 10 }}>
                {REPORT_TABS.slice(3).map((tab) => (
                    <button key={tab.id} style={activeTab === tab.id ? styles.tabActive : styles.tab}
                        onClick={() => handleTabChange(tab.id)}>
                        <span style={styles.tabIcon}>{tab.icon}</span>{tab.label}
                    </button>
                ))}
            </div>

            {/* ── Filter Panel ── */}
            <div style={styles.filterCard}>
                <div style={styles.filterHeader}>
                    <h2 style={styles.filterTitle}>{REPORT_TABS.find((t) => t.id === activeTab)?.label}</h2>
                    <div style={styles.actionBtns}>
                        <button style={{ ...styles.btnRun, opacity: (!isRunnable || loading) ? 0.5 : 1 }}
                            onClick={handleRun} disabled={!isRunnable || loading}>
                            {loading ? "Running…" : "Run"}
                        </button>
                        <button style={styles.btnClear} onClick={handleClear}>Clear All</button>
                    </div>
                </div>

                {activeTab === "StockLevel" && (
                    <div style={styles.filtersRow}>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Parent Category</label>
                            <select style={styles.select} value={stockFilters.categoryId ?? ""}
                                onChange={(e) => setStockFilters((f) => ({
                                    ...f, categoryId: e.target.value ? Number(e.target.value) : null,
                                }))}>
                                <option value="">All Categories</option>
                                {categories.filter((c) => c.name).map((c) => (
                                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Search</label>
                            <input style={styles.input} placeholder="Product name / Stock ID"
                                value={stockFilters.search ?? ""}
                                onChange={(e) => setStockFilters((f) => ({ ...f, search: e.target.value || undefined }))} />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Stock Status</label>
                            <select style={styles.select}
                                value={stockFilters.isOutOfStock ? "out" : stockFilters.isLowStock ? "low" : ""}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setStockFilters((f) => ({
                                        ...f,
                                        isOutOfStock: v === "out" ? true : null,
                                        isLowStock: v === "low" ? true : null,
                                    }));
                                }}>
                                <option value="">All</option>
                                <option value="low">Low Stock</option>
                                <option value="out">Out of Stock</option>
                            </select>
                        </div>
                    </div>
                )}

                {activeTab === "InventoryAging" && (
                    <div style={styles.filtersRow}>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Category</label>
                            <select style={styles.select} value={agingFilters.categoryId ?? ""}
                                onChange={(e) => setAgingFilters((f) => ({
                                    ...f, categoryId: e.target.value ? Number(e.target.value) : null,
                                }))}>
                                <option value="">All Categories</option>
                                {categories.filter((c) => c.name).map((c) => (
                                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Search</label>
                            <input style={styles.input} placeholder="Product name / Stock ID"
                                value={agingFilters.search ?? ""}
                                onChange={(e) => setAgingFilters((f) => ({ ...f, search: e.target.value || undefined }))} />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.fieldLabel}>Aging Bucket</label>
                            <select style={styles.select} value={agingFilters.agingBucket ?? ""}
                                onChange={(e) => setAgingFilters((f) => ({ ...f, agingBucket: e.target.value || undefined }))}>
                                <option value="">All Ages</option>
                                <option value="0-30">0–30 days (Fresh)</option>
                                <option value="31-90">31–90 days (Moderate)</option>
                                <option value="91-180">91–180 days (Old)</option>
                                <option value="180+">180+ days (Dead stock)</option>
                            </select>
                        </div>
                    </div>
                )}

                {activeTab !== "StockLevel" && activeTab !== "InventoryAging" && (
                    <p style={styles.comingSoon}>
                        This report is coming soon. Select <strong>Stock Level Report</strong> to get started.
                    </p>
                )}
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── Stock Level ───────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "StockLevel" && stockHasRun && stockData && (
                <>
                    {/* Charts */}
                    {stockData.Data.length > 0 && (
                        <div style={styles.sectionBlock}>
                            <p style={styles.sectionTitle}>📊 Visual Analytics</p>
                            <StockCharts data={stockData.Data} />
                        </div>
                    )}

                    {/* Table */}
                    <div style={styles.resultCard}>
                        <div style={styles.resultMeta}>
                            <span style={styles.resultCount}>
                                {stockData.TotalCount} record{stockData.TotalCount !== 1 ? "s" : ""} found
                            </span>
                        </div>
                        <div style={styles.tableWrapper}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        {["#", "Stock ID", "Product", "Variant", "Category",
                                            "Stock Qty", "Available", "MRP (₹)", "Price (₹)", "Disc %", "Status"]
                                            .map((h) => <th key={h} style={styles.th}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockData.Data.length === 0 ? (
                                        <tr><td colSpan={11} style={styles.emptyCell}>No records match your filters.</td></tr>
                                    ) : stockData.Data.map((row, i) => (
                                        <tr key={row.ProductVariantDetailId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                            <td style={styles.td}>{(stockPage - 1) * PAGE_SIZE + i + 1}</td>
                                            <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>{row.StockId ?? "—"}</td>
                                            <td style={{ ...styles.td, fontWeight: 500 }}>{row.ProductName ?? "—"}</td>
                                            <td style={styles.td}>{row.VariantName ?? "—"}</td>
                                            <td style={styles.td}>{row.CategoryName ?? "—"}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>{row.StockQuantity ?? 0}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>{row.AvailableQuantity ?? 0}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>
                                                {row.MRPPrice != null ? `₹${Number(row.MRPPrice).toFixed(2)}` : "—"}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: "right", color: RED, fontWeight: 500 }}>
                                                {row.FinalPrice != null ? `₹${Number(row.FinalPrice).toFixed(2)}` : "—"}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>
                                                {row.DiscountPercent != null ? `${row.DiscountPercent}%` : "—"}
                                            </td>
                                            <td style={styles.td}>
                                                <StatusBadge isOutOfStock={row.IsOutOfStock} isLowStock={row.IsLowStock} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={stockPage} totalCount={stockData.TotalCount}
                            pageSize={PAGE_SIZE} onChange={(p) => runStockLevel(p)} />
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── Inventory Aging ───────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "InventoryAging" && agingHasRun && agingData && (
                <>
                    {/* Charts */}
                    {agingData.Data.length > 0 && (
                        <div style={styles.sectionBlock}>
                            <p style={styles.sectionTitle}>📊 Visual Analytics</p>
                            <AgingCharts data={agingData.Data} />
                        </div>
                    )}

                    {/* Table */}
                    <div style={styles.resultCard}>
                        {/* Summary strip */}
                        <div style={styles.agingSummaryRow}>
                            {(["0-30", "31-90", "91-180", "180+"] as const).map((bucket) => {
                                const count = agingData.Data.filter((r) => r.AgingBucket === bucket).length;
                                const c = AGING_BUCKET_COLORS[bucket];
                                return (
                                    <div key={bucket} style={{ ...styles.agingSummaryCard, background: c.bg, borderColor: c.color + "33" }}>
                                        <span style={{ ...styles.agingSummaryCount, color: c.color }}>{count}</span>
                                        <span style={{ ...styles.agingSummaryLabel, color: c.color }}>{AGING_BUCKET_LABELS[bucket]}</span>
                                        <span style={{ ...styles.agingSummaryBucket, color: c.color }}>
                                            {bucket === "180+" ? "180+ days" : `${bucket} days`}
                                        </span>
                                    </div>
                                );
                            })}
                            <div style={styles.agingSummaryCardTotal}>
                                <span style={styles.agingSummaryCount}>{agingData.TotalCount}</span>
                                <span style={styles.agingSummaryLabel}>Total records</span>
                            </div>
                        </div>

                        <div style={styles.resultMeta}>
                            <span style={styles.resultCount}>
                                {agingData.TotalCount} record{agingData.TotalCount !== 1 ? "s" : ""} found
                            </span>
                        </div>

                        <div style={styles.tableWrapper}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        {["#", "Stock ID", "Product", "Variant", "Category",
                                            "Received Date", "Days in Stock", "Qty", "Stock Qty",
                                            "MRP (₹)", "Price (₹)", "Age Bucket"]
                                            .map((h) => <th key={h} style={styles.th}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {agingData.Data.length === 0 ? (
                                        <tr><td colSpan={12} style={styles.emptyCell}>No records match your filters.</td></tr>
                                    ) : agingData.Data.map((row, i) => (
                                        <tr key={`${row.ProductVariantDetailId}-${i}`} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                            <td style={styles.td}>{(agingPage - 1) * PAGE_SIZE + i + 1}</td>
                                            <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>{row.StockId ?? "—"}</td>
                                            <td style={{ ...styles.td, fontWeight: 500 }}>{row.ProductName ?? "—"}</td>
                                            <td style={styles.td}>{row.VariantName ?? "—"}</td>
                                            <td style={styles.td}>{row.CategoryName ?? "—"}</td>
                                            <td style={styles.td}>
                                                {row.ReceivedDate
                                                    ? new Date(row.ReceivedDate).toLocaleDateString("en-IN", {
                                                        day: "2-digit", month: "short", year: "numeric",
                                                    })
                                                    : "—"}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: "right", fontWeight: 500 }}>{row.DaysInStock ?? "—"}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>{row.Quantity ?? 0}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>{row.StockQuantity ?? 0}</td>
                                            <td style={{ ...styles.td, textAlign: "right" }}>
                                                {row.MRPPrice != null ? `₹${Number(row.MRPPrice).toFixed(2)}` : "—"}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: "right", color: RED, fontWeight: 500 }}>
                                                {row.FinalPrice != null ? `₹${Number(row.FinalPrice).toFixed(2)}` : "—"}
                                            </td>
                                            <td style={styles.td}><AgingBucketBadge bucket={row.AgingBucket} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={agingPage} totalCount={agingData.TotalCount}
                            pageSize={PAGE_SIZE} onChange={(p) => runAgingReport(p)} />
                    </div>
                </>
            )}

            {/* ── Empty States ── */}
            {activeTab === "StockLevel" && !stockHasRun && !loading && (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>⚖️</div>
                    <p style={styles.emptyText}>Set your filters and click <strong>Run</strong> to generate the report.</p>
                </div>
            )}
            {activeTab === "InventoryAging" && !agingHasRun && !loading && (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📦</div>
                    <p style={styles.emptyText}>Set your filters and click <strong>Run</strong> to see aging stock.</p>
                </div>
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RED = "#b91c1c";
const RED_LIGHT = "#fef2f2";
const RED_BORDER = "#6A012A";

const styles: Record<string, React.CSSProperties> = {
    page: { fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "24px 32px", maxWidth: 1400, margin: "0 auto", color: "#1a1a1a" },
    header: { position: "relative", textAlign: "center", marginBottom: 24 },
    backBtn: { position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "#6A012A", color: "#6A012A", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: 0 },
    title: { fontSize: 22, fontWeight: 600, margin: 0, color: "#1a1a1a" },
    tabRow: { display: "flex", gap: 12, marginBottom: 0 },
    tab: { flex: 1, padding: "12px 20px", borderRadius: 40, border: `1.5px solid ${RED_BORDER}`, background: "#fff", color: "#1a1a1a", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s, color 0.15s" },
    tabActive: { flex: 1, padding: "12px 20px", borderRadius: 40, border: `1.5px solid ${RED_BORDER}`, background: "#6A012A", color:  "#F6EEE1", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
    tabIcon: { fontSize: 14 },
    filterCard: { marginTop: 20, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    filterHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    filterTitle: { fontSize: 18, fontWeight: 600, margin: 0 },
    actionBtns: { display: "flex", gap: 10 },
    btnRun: { padding: "9px 26px", borderRadius: 40, background: "#6A012A", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    btnClear: { padding: "9px 26px", borderRadius: 40, background: "#6A012A", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    filtersRow: { display: "flex", gap: 16, flexWrap: "wrap" as const, alignItems: "flex-end" },
    fieldGroup: { display: "flex", flexDirection: "column" as const, gap: 4, minWidth: 220 },
    fieldLabel: { fontSize: 11, color: "#6A012A", fontWeight: 500, letterSpacing: "0.03em" },
    select: { padding: "9px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, background: "#fff", cursor: "pointer", minWidth: 220, color: "#1a1a1a" },
    input: { padding: "9px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, background: "#fff", minWidth: 220, color: "#1a1a1a", outline: "none" },
    comingSoon: { color: "#6A012A", fontSize: 14, margin: "4px 0 0" },
    errorBox: { marginTop: 16, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: RED, fontSize: 14 },
    sectionBlock: { marginTop: 20 },
    sectionTitle: { fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 12px" },
    resultCard: { marginTop: 20, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    resultMeta: { padding: "12px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center" },
    resultCount: { fontSize: 13, color: "#6A012A" },
    tableWrapper: { overflowX: "auto" as const },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
    th: { padding: "10px 14px", textAlign: "left" as const, background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 12, color: "#374151", whiteSpace: "nowrap" as const },
    td: { padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" as const, color: "#1f2937" },
    trEven: { background: "#fff" },
    trOdd: { background: "#fafafa" },
    emptyCell: { padding: "40px", textAlign: "center" as const, color: "#9ca3af", fontSize: 14 },
    agingSummaryRow: { display: "flex", gap: 12, padding: "16px 20px", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap" as const },
    agingSummaryCard: { display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "10px 20px", borderRadius: 10, border: "1px solid", minWidth: 100, gap: 2 },
    agingSummaryCardTotal: { display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "10px 20px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", minWidth: 100, gap: 2 },
    agingSummaryCount: { fontSize: 22, fontWeight: 700, lineHeight: 1.2 },
    agingSummaryLabel: { fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    agingSummaryBucket: { fontSize: 11, opacity: 0.75 },
    badgeBase: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
    badgeDanger: { padding: "3px 10px", borderRadius: 20, background: "#fef2f2", color: RED, fontSize: 11, fontWeight: 600 },
    badgeWarning: { padding: "3px 10px", borderRadius: 20, background: "#fffbeb", color: "#92400e", fontSize: 11, fontWeight: 600 },
    badgeSuccess: { padding: "3px 10px", borderRadius: 20, background: "#f0fdf4", color: "#166534", fontSize: 11, fontWeight: 600 },
    badgeNeutral: { padding: "3px 10px", borderRadius: 20, background: "#f3f4f6", color: "#6A012A", fontSize: 11, fontWeight: 600 },
    pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 20px", borderTop: "1px solid #f3f4f6" },
    pageBtn: { padding: "7px 18px", borderRadius: 8, border: `1px solid ${RED_BORDER}`, background: "#fff", color: RED, fontSize: 13, fontWeight: 500, cursor: "pointer" },
    pageInfo: { fontSize: 13, color: "#6A012A" },
    emptyState: { marginTop: 40, textAlign: "center" as const, color: "#9ca3af" },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 14, margin: 0 },
};

// ─── Chart styles ─────────────────────────────────────────────────────────────

const cs: Record<string, React.CSSProperties> = {
    grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
    cardTitle: { fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 12px" },
    tooltip: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
    tooltipTitle: { fontWeight: 600, color: "#1f2937", margin: "0 0 6px", fontSize: 12 },
    tooltipRow: { display: "flex", alignItems: "center", gap: 6, margin: "2px 0" },
    tooltipDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
    tooltipName: { color: "#6b7280", minWidth: 70 },
    tooltipVal: { color: "#1f2937", fontWeight: 600 },
};