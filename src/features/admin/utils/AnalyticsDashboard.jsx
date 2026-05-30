import { useState, useEffect, useCallback } from "react";
import { fetchAnalyticsData } from "./ga4Api";
import MetricCard from "../components/MetricCard";
import TrafficChart from "../components/TrafficChart";
import FunnelChart from "../components/FunnelChart";
import TopPages from "../components/TopPages";
import RevenueChart from "../components/RevenueChart";
import UserTypeChart from "../components/UserTypeChart";
import ActiveUsers from "../components/ActiveUsers";
import useRealtime from "../hooks/useRealtime";

const RANGES = [
  { label: "7 days", value: "7daysAgo" },
  { label: "30 days", value: "30daysAgo" },
  { label: "90 days", value: "90daysAgo" },
];

export default function AnalyticsDashboard({ propertyId, accessToken, onLogout }) {
  const [range, setRange] = useState("7daysAgo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Realtime active users (polls every 30s)
  const realtimeUsers = useRealtime(propertyId, accessToken);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAnalyticsData(propertyId, accessToken, range);
      setData(result);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [propertyId, accessToken, range]);

  useEffect(() => {
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>
            <span style={styles.brandDot} />
            OnlyTWAM Analytics
          </div>
          <div style={styles.subtitle}>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Loading..."}
          </div>
        </div>
        <div style={styles.headerRight}>
          <ActiveUsers count={realtimeUsers} />
          <div style={styles.tabs}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                style={{ ...styles.tab, ...(range === r.value ? styles.tabActive : {}) }}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button style={styles.refreshBtn} onClick={load} title="Refresh data">↻</button>
          {onLogout && (
            <button
              style={{ ...styles.refreshBtn, fontSize: 11, width: "auto", padding: "0 10px", color: "#fff" }}
              onClick={onLogout}
              title="Disconnect / change credentials"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          ⚠ {error} — Check your GA4 credentials or network.
        </div>
      )}

      {loading && !data ? (
        <div style={styles.loader}>
          <div style={styles.spinner} />
          <p style={{ color: "#888", fontSize: 14 }}>Fetching analytics…</p>
        </div>
      ) : data ? (
        <>
          {/* Behavior Metrics */}
          <div style={styles.sectionLabel}>User Behavior</div>
          <div style={styles.metricGrid}>
            <MetricCard label="Page Views" value={data.metrics.pageviews} delta={data.metrics.pageviewsDelta} format="number" icon="👁" />
            <MetricCard label="Unique Visitors" value={data.metrics.users} delta={data.metrics.usersDelta} format="number" icon="👤" />
            <MetricCard label="Avg Session" value={data.metrics.avgSession} delta={data.metrics.avgSessionDelta} format="duration" icon="⏱" />
            <MetricCard label="Bounce Rate" value={data.metrics.bounceRate} delta={data.metrics.bounceRateDelta} format="percent" icon="↩" invertDelta />
          </div>

          {/* Engagement Metrics */}
          <div style={styles.sectionLabel}>Engagement</div>
          <div style={styles.metricGrid}>
            <MetricCard label="Daily Active" value={data.metrics.dau} delta={data.metrics.dauDelta} format="number" icon="🔥" />
            <MetricCard label="New Users" value={data.metrics.newUsersPct} format="percent" icon="✨" />
            <MetricCard label="Returning" value={data.metrics.returningPct} format="percent" icon="🔄" />
            <MetricCard label="Clicks / Session" value={data.metrics.clicksPerSession} delta={data.metrics.clicksDelta} format="decimal" icon="🖱" />
          </div>

          {/* Business Metrics */}
          <div style={styles.sectionLabel}>Revenue & Conversions</div>
          <div style={styles.metricGrid}>
            <MetricCard label="Conversion Rate" value={data.metrics.convRate} delta={data.metrics.convDelta} format="percent" icon="✅" />
            <MetricCard label="Revenue / User" value={data.metrics.revenuePerUser} delta={data.metrics.rpuDelta} format="currency" icon="💰" />
            <MetricCard label="Total Revenue" value={data.metrics.totalRevenue} delta={data.metrics.revDelta} format="currency" icon="📈" />
            <MetricCard label="Avg Order Value" value={data.metrics.aov} delta={data.metrics.aovDelta} format="currency" icon="🛒" />
          </div>

          {/* Charts Row 1 */}
          <div style={styles.chartsRow}>
            <div style={{ ...styles.chartCard, flex: 2 }}>
              <div style={styles.chartTitle}>Traffic over time</div>
              <TrafficChart data={data.traffic} />
            </div>
            <div style={{ ...styles.chartCard, flex: 1 }}>
              <div style={styles.chartTitle}>New vs returning</div>
              <UserTypeChart newPct={data.metrics.newUsersPct} returnPct={data.metrics.returningPct} />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={styles.chartsRow}>
            <div style={{ ...styles.chartCard, flex: 1 }}>
              <div style={styles.chartTitle}>Purchase funnel</div>
              <FunnelChart steps={data.funnel} />
            </div>
            <div style={{ ...styles.chartCard, flex: 1 }}>
              <div style={styles.chartTitle}>Revenue by day</div>
              <RevenueChart data={data.revenue} />
            </div>
          </div>

          {/* Top Pages */}
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Top pages</div>
            <TopPages pages={data.topPages} />
          </div>
        </>
      ) : null}
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    // background: "#0f0f0f",
    minHeight: "100vh",
    padding: "24px",
    color: "#6A012A",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 12,
  },
  brand: {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#6A012A",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#e8a598",
    display: "inline-block",
  },
  subtitle: { fontSize: 12, color: "#666", marginTop: 4 },
  headerRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  tabs: {
    display: "flex",
    background: "#6A012A",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  tab: {
    padding: "5px 14px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    background: "#6A012A",
    color: "#fff",
    transition: "all 0.15s",
  },
  tabActive: {
    background: "#6A012A",
    color: "#fff",
  },
  refreshBtn: {
    width: 32,
    height: 32,
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    background: "#6A012A",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#fff",
    marginBottom: 10,
    marginTop: 24,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginBottom: 4,
  },
  chartsRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  chartCard: {
    background: "#6A012A",
    border: "1px solid #222",
    borderRadius: 12,
    padding: "16px 18px",
    marginTop: 10,
    minWidth: 0,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#aaa",
    marginBottom: 14,
    letterSpacing: "-0.01em",
  },
  error: {
    background: "#6A012A",
    border: "1px solid #4a2020",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#F6EEE1",
    marginBottom: 16,
  },
  loader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: "2px solid #2a2a2a",
    borderTop: "2px solid #e8a598",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
