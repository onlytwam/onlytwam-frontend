// Customer Reports Dashboard — Real API Integration (no mock data)
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from '@/shared/api/axiosInstance';

// ─── Config ───────────────────────────────────────────────────────────────────
const RED     = "#6A012A";
const LIGHT   = "#FFF0F1";
const PALETTE = ["#6A012A", "#FF6B6B", "#6A012A", "#FF9F9F", "#780000", "#FFA69E"];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt    = (n: any) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtCur = (n: any) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n: any) => `${(parseFloat(n) || 0).toFixed(2)}%`;

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(endpoint: string, filters: Record<string, any> = {}) {
  const params: Record<string, any> = {
    "Page.Index": 1,
    "Page.Size":  200,
    ...filters,
  };

  const res  = await api.get(`/Report/${endpoint}`, { params });
  const data = res.data;

  return Array.isArray(data)
    ? { list: data, count: data.length, params: {} }
    : {
        list:   data?.list   ?? data?.data  ?? data?.items  ?? data?.result ?? [],
        count:  data?.count  ?? data?.total ?? 0,
        params: data?.parameters ?? {},
      };
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: any) {
  return (
    <div style={{
      background: accent ? RED : "#fff",
      color: accent ? "#fff" : "#1a1a1a",
      border: `1.5px solid ${accent ? RED : "#f0d0d0"}`,
      borderRadius: 14, padding: "18px 22px", minWidth: 130, flex: "0 0 auto",
    }}>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: 1 }}>
        {String(label).toUpperCase()}
      </p>
      <p style={{ margin: "6px 0 2px", fontSize: 24, fontWeight: 800 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>{sub}</p>}
    </div>
  );
}

function PillBtn({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 16px", borderRadius: 20, cursor: "pointer",
      fontWeight: 700, fontSize: 13, border: `1.5px solid ${RED}`, transition: "all 0.15s",
      background: active ? RED : "transparent", color: active ? "#fff" : RED,
    }}>{label}</button>
  );
}

function SectionTitle({ icon, title }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>{title}</h2>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "#bbb" }}>
      <div className="cr-spinner" />
      <p style={{ marginTop: 12 }}>Loading report…</p>
    </div>
  );
}

function ErrBox({ msg }: any) {
  return (
    <div style={{ padding: 20, background: LIGHT, border: `1px solid ${RED}`, borderRadius: 12, color: RED }}>
      ⚠️ {msg}
    </div>
  );
}

function EmptyBox() {
  return <div style={{ padding: 32, textAlign: "center", color: "#bbb" }}>No data available.</div>;
}

function ReportTable({ headers, rows, renderRow }: any) {
  if (!rows?.length) return <EmptyBox />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: LIGHT }}>
            {headers.map((h: string) => (
              <th key={h} style={{
                padding: "10px 14px", textAlign: "left", color: RED,
                fontWeight: 700, whiteSpace: "nowrap", borderBottom: `2px solid #f0d0d0`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fdfafa", borderBottom: "1px solid #f5e8e8" }}>
              {renderRow(row, i)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TD({ children, bold, muted, red }: any) {
  return (
    <td style={{
      padding: "10px 14px",
      fontWeight: bold ? 700 : 400,
      color: red ? RED : muted ? "#888" : "inherit",
    }}>{children ?? "—"}</td>
  );
}

const dateInputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8,
  border: "1.5px solid #f0d0d0", fontSize: 13, color: "#333", outline: "none",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Customer Acquisition Report
// ─────────────────────────────────────────────────────────────────────────────
function AcquisitionPanel() {
  const [list,    setList]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("month");

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiFetch("CustomerAcquisitionReport", { group_by: groupBy })
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [groupBy]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error)   return <ErrBox msg={error} />;
  if (!list.length) return <EmptyBox />;

  const grandTotal = list[0]?.TotalNewCustomers
    ?? list.reduce((s, r) => s + (r.NewCustomers ?? 0), 0);

  const chartData = list.map((r) => ({
    name:     String(r.Period ?? "").slice(0, 7),
    New:      r.NewCustomers      ?? 0,
    Verified: r.VerifiedCustomers ?? 0,
  }));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total New Customers" value={fmt(grandTotal)} accent />
        <StatCard label="Periods" value={list.length} sub={`grouped by ${groupBy}`} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["day", "week", "month", "year"].map((g) => (
          <PillBtn key={g} label={g.charAt(0).toUpperCase() + g.slice(1)}
            active={groupBy === g} onClick={() => setGroupBy(g)} />
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="New"      fill={RED}     radius={[4,4,0,0]} name="New Customers" />
          <Bar dataKey="Verified" fill="#FF9F9F" radius={[4,4,0,0]} name="Verified" />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 24 }}>
        <ReportTable
          headers={["Period", "New Customers", "Verified Customers"]}
          rows={list}
          renderRow={(r: any) => (
            <>
              <TD>{String(r.Period ?? "").slice(0, 10)}</TD>
              <TD bold>{fmt(r.NewCustomers)}</TD>
              <TD>{fmt(r.VerifiedCustomers)}</TD>
            </>
          )}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Repeat vs. New Customers
// ─────────────────────────────────────────────────────────────────────────────
function RepeatVsNewPanel() {
  const [list,      setList]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const filters: Record<string, any> = {};
    if (dateRange.start) filters.start_date = dateRange.start;
    if (dateRange.end)   filters.end_date   = dateRange.end;
    apiFetch("RepeatVsNewCustomers", filters)
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error)   return <ErrBox msg={error} />;
  if (!list.length) return <EmptyBox />;

  const total     = list[0]?.TotalCustomers ?? 0;
  const newRow    = list.find((r) => r.CustomerType === "New");
  const repeatRow = list.find((r) => r.CustomerType === "Repeat");
  const pieData   = list.map((r) => ({ name: r.CustomerType, value: r.CustomerCount ?? 0 }));

  return (
    <div>
      {/* Date filter */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: "#888" }}>Date range:</span>
        <input type="date" value={dateRange.start} style={dateInputStyle}
          onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
        <span style={{ color: "#aaa" }}>→</span>
        <input type="date" value={dateRange.end} style={dateInputStyle}
          onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total Customers" value={fmt(total)} accent />
        <StatCard label="New"    value={fmtPct(newRow?.Percentage)}
          sub={`${fmt(newRow?.CustomerCount)} customers`} />
        <StatCard label="Repeat" value={fmtPct(repeatRow?.Percentage)}
          sub={`${fmt(repeatRow?.CustomerCount)} customers`} />
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 260px" }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: "1 1 260px" }}>
          <ReportTable
            headers={["Customer Type", "Count", "Percentage"]}
            rows={list}
            renderRow={(r: any) => (
              <>
                <TD bold>{r.CustomerType}</TD>
                <TD>{fmt(r.CustomerCount)}</TD>
                <TD red>{fmtPct(r.Percentage)}</TD>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Customer Lifetime Value
// ─────────────────────────────────────────────────────────────────────────────
function CLVPanel() {
  const [list,    setList]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [topN,    setTopN]    = useState(20);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiFetch("CustomerLifetimeValue", { top_n: topN, min_orders: 1 })
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [topN]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error)   return <ErrBox msg={error} />;
  if (!list.length) return <EmptyBox />;

  const maxRev = Math.max(...list.map((r) => r.TotalRevenue ?? 0), 1);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        <StatCard label="Showing Top" value={list.length} sub="customers by CLV" accent />
        <div style={{ display: "flex", gap: 8 }}>
          {[10, 20, 50].map((n) => (
            <PillBtn key={n} label={`Top ${n}`} active={topN === n} onClick={() => setTopN(n)} />
          ))}
        </div>
      </div>

      <ReportTable
        headers={["#", "Customer", "Email", "Phone", "Orders", "Total Revenue", "Avg Order", "Days Active", "Last Order"]}
        rows={list}
        renderRow={(r: any, i: number) => (
          <>
            <TD muted>{i + 1}</TD>
            <TD bold>{r.CustomerName}</TD>
            <TD muted>{r.Email}</TD>
            <TD muted>{r.Phone}</TD>
            <td style={{ padding: "10px 14px" }}>
              <span style={{ background: LIGHT, color: RED, borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>
                {r.OrderCount}
              </span>
            </td>
            <td style={{ padding: "10px 14px" }}>
              <div style={{ fontWeight: 700, color: RED }}>{fmtCur(r.TotalRevenue)}</div>
              <div style={{ marginTop: 4, height: 4, background: "#f0e0e0", borderRadius: 2 }}>
                <div style={{
                  width: `${((r.TotalRevenue ?? 0) / maxRev) * 100}%`,
                  height: "100%", background: RED, borderRadius: 2,
                }} />
              </div>
            </td>
            <TD>{fmtCur(r.AvgOrderValue)}</TD>
            <TD>{r.DaysAsCustomer != null ? `${Math.round(r.DaysAsCustomer)}d` : "—"}</TD>
            <TD muted>{r.LastOrderDate ? String(r.LastOrderDate).slice(0, 10) : "—"}</TD>
          </>
        )}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Customer Segmentation
// ─────────────────────────────────────────────────────────────────────────────
function SegmentationPanel() {
  const [tab,     setTab]     = useState("location");
  const [list,    setList]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiFetch("CustomerSegmentation", { segment_by: tab })
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const nameKey: Record<string, string> = {
    location: "Location", spending: "SpendingTier", frequency: "FrequencySegment",
  };
  const chartData = list.map((r) => ({
    name: r[nameKey[tab]] ?? "—", value: r.CustomerCount ?? 0,
  }));

  const tableHeaders: Record<string, string[]> = {
    location:  ["Location", "Customers", "Total Revenue", "Total Orders"],
    spending:  ["Spending Tier", "Customers"],
    frequency: ["Frequency Segment", "Customers"],
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["location", "spending", "frequency"].map((t) => (
          <PillBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)}
            active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {loading ? <Loader /> : error ? <ErrBox msg={error} /> : !list.length ? <EmptyBox /> : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5e0e0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={155} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="value" fill={RED} radius={[0,4,4,0]} name="Customers" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 24 }}>
            <ReportTable
              headers={tableHeaders[tab]}
              rows={list}
              renderRow={(r: any) => (
                tab === "location" ? (
                  <>
                    <TD bold>{r.Location}</TD>
                    <TD>{fmt(r.CustomerCount)}</TD>
                    <TD red>{fmtCur(r.TotalRevenue)}</TD>
                    <TD>{fmt(r.TotalOrders)}</TD>
                  </>
                ) : tab === "spending" ? (
                  <>
                    <TD bold>{r.SpendingTier}</TD>
                    <TD>{fmt(r.CustomerCount)}</TD>
                  </>
                ) : (
                  <>
                    <TD bold>{r.FrequencySegment}</TD>
                    <TD>{fmt(r.CustomerCount)}</TD>
                  </>
                )
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Customer Churn Rate
// ─────────────────────────────────────────────────────────────────────────────
function ChurnPanel() {
  const [list,         setList]         = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [inactiveDays, setInactiveDays] = useState(90);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiFetch("CustomerChurnRate", { inactive_days: inactiveDays, period_months: 12 })
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [inactiveDays]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error)   return <ErrBox msg={error} />;
  if (!list.length) return <EmptyBox />;

  const totalActive  = list[0]?.TotalActiveCustomers ?? 0;
  const churnRatePct = parseFloat(list[0]?.ChurnRatePct ?? 0);
  const totalChurned = list.reduce((s, r) => s + (r.ChurnedCustomers ?? 0), 0);

  const lineData = list.map((r) => ({
    name:    `${r.Year}-${String(r.Month).padStart(2, "0")}`,
    Churned: r.ChurnedCustomers ?? 0,
    Rate:    parseFloat(r.ChurnRatePct ?? 0),
  }));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <StatCard label="Churn Rate"       value={fmtPct(churnRatePct)} accent />
        <StatCard label="Retention Rate"   value={fmtPct(100 - churnRatePct)} />
        <StatCard label="Active Customers" value={fmt(totalActive)} />
        <StatCard label="Total Churned"    value={fmt(totalChurned)} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#888" }}>Inactive threshold:</span>
        {[30, 60, 90, 180].map((d) => (
          <PillBtn key={d} label={`${d}d`} active={inactiveDays === d} onClick={() => setInactiveDays(d)} />
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={lineData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left"  type="monotone" dataKey="Churned"
            stroke={RED} strokeWidth={2.5} dot={{ fill: RED, r: 4 }} name="Churned Customers" />
          <Line yAxisId="right" type="monotone" dataKey="Rate"
            stroke={RED} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Churn Rate %" />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 24 }}>
        <ReportTable
          headers={["Year", "Month", "Churned Customers", "Active Customers", "Churn Rate %"]}
          rows={list}
          renderRow={(r: any) => (
            <>
              <TD>{r.Year}</TD>
              <TD>{r.Month}</TD>
              <TD bold red>{fmt(r.ChurnedCustomers)}</TD>
              <TD>{fmt(r.TotalActiveCustomers)}</TD>
              <TD>{fmtPct(r.ChurnRatePct)}</TD>
            </>
          )}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Top Customers by Revenue
// ─────────────────────────────────────────────────────────────────────────────
function TopCustomersPanel() {
  const [list,      setList]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [topN,      setTopN]      = useState(10);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const filters: Record<string, any> = { top_n: topN };
    if (dateRange.start) filters.start_date = dateRange.start;
    if (dateRange.end)   filters.end_date   = dateRange.end;
    apiFetch("TopCustomersByRevenue", filters)
      .then((r) => setList(r.list))
      .catch((e) => setError(e?.response?.data?.message ?? e.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [topN, dateRange]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error)   return <ErrBox msg={error} />;
  if (!list.length) return <EmptyBox />;

  const grandTotal = list[0]?.GrandTotalRevenue ?? 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[10, 25, 50].map((n) => (
            <PillBtn key={n} label={`Top ${n}`} active={topN === n} onClick={() => setTopN(n)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={dateRange.start} style={dateInputStyle}
            onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
          <span style={{ color: "#aaa" }}>→</span>
          <input type="date" value={dateRange.end} style={dateInputStyle}
            onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Grand Total Revenue" value={fmtCur(grandTotal)} accent />
        <StatCard label="Customers Shown" value={list.length} />
      </div>

      <ReportTable
        headers={["Rank", "Customer", "Email", "Phone", "Orders", "Revenue", "Share", "Last Order"]}
        rows={list}
        renderRow={(r: any, i: number) => (
          <>
            <td style={{ padding: "10px 14px" }}>
              <span style={{
                background: i < 3 ? RED : "#f0e0e0",
                color: i < 3 ? "#fff" : "#555",
                borderRadius: 20, padding: "2px 9px", fontWeight: 800, fontSize: 12,
              }}>#{r.Rank ?? i + 1}</span>
            </td>
            <TD bold>{r.CustomerName}</TD>
            <TD muted>{r.Email}</TD>
            <TD muted>{r.Phone}</TD>
            <TD>{r.OrderCount}</TD>
            <TD red bold>{fmtCur(r.TotalRevenue)}</TD>
            <td style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 56, height: 6, background: "#f0e0e0", borderRadius: 3 }}>
                  <div style={{
                    width: `${Math.min(r.RevenueSharePct ?? 0, 100)}%`,
                    height: "100%", background: RED, borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12 }}>{fmtPct(r.RevenueSharePct)}</span>
              </div>
            </td>
            <TD muted>{r.LastOrderDate ? String(r.LastOrderDate).slice(0, 10) : "—"}</TD>
          </>
        )}
      />
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const REPORTS = [
  { id: "acquisition",  icon: "📈", label: "Customer Acquisition Report",   Panel: AcquisitionPanel  },
  { id: "repeat",       icon: "🔄", label: "Repeat vs. New Customers",      Panel: RepeatVsNewPanel  },
  { id: "clv",          icon: "💎", label: "Customer Lifetime Value (CLV)",  Panel: CLVPanel          },
  { id: "segmentation", icon: "🗺️", label: "Customer Segmentation",         Panel: SegmentationPanel },
  { id: "churn",        icon: "📉", label: "Customer Churn Rate",           Panel: ChurnPanel        },
  { id: "top",          icon: "🏆", label: "Top Customers by Revenue",      Panel: TopCustomersPanel },
];

export default function CustomerReportsDashboard() {
  const [active, setActive] = useState("acquisition");
  const ActivePanel = REPORTS.find((r) => r.id === active)?.Panel;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f2f2", fontFamily: "Segoe UI, sans-serif" }}>
      <div style={{ background: RED, padding: "20px 32px", color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>📊</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Customer Reports</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.8 }}>
            Acquisition · Retention · Lifetime Value · Revenue
          </p>
        </div>
      </div>

      <div style={{ padding: "20px 32px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
          {REPORTS.map((r) => (
            <button key={r.id} onClick={() => setActive(r.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 20px", borderRadius: 50,
              border: `1.5px solid ${RED}`,
              background: active === r.id ? RED : "#fff",
              color: active === r.id ? "#fff" : RED,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: active === r.id ? "0 4px 16px rgba(106,1,42,0.25)" : "none",
            }}>
              <span>{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 32 }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: 32,
          boxShadow: "0 2px 24px rgba(0,0,0,0.07)", border: "1px solid #f0d8d8",
        }}>
          <SectionTitle
            icon={REPORTS.find((r) => r.id === active)?.icon}
            title={REPORTS.find((r) => r.id === active)?.label}
          />
          {ActivePanel && <ActivePanel />}
        </div>
      </div>

      <style>{`
        .cr-spinner {
          width: 32px; height: 32px; margin: 0 auto;
          border: 3px solid #f0d0d0; border-top-color: ${RED};
          border-radius: 50%; animation: cr-spin 0.8s linear infinite;
        }
        @keyframes cr-spin { to { transform: rotate(360deg); } }
        button:hover { opacity: 0.88; }
        input[type="date"]:focus { border-color: ${RED} !important; }
      `}</style>
    </div>
  );
}