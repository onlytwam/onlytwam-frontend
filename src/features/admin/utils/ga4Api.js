/**
 * Google Analytics 4 Data API v1
 * Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
 *
 * Setup steps:
 * 1. Go to https://console.cloud.google.com → Enable "Google Analytics Data API"
 * 2. Create OAuth2 credentials (Web App) or a Service Account
 * 3. Grant the service account "Viewer" access in your GA4 property
 * 4. Pass propertyId (e.g. "123456789") and accessToken to these functions
 */

const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";

async function runReport(propertyId, accessToken, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "GA4 API error");
  }
  return res.json();
}

async function runRealtimeReport(propertyId, accessToken, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runRealtimeReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Realtime API error");
  return res.json();
}

// Parse GA4 row → object
function parseRows(report, metricKeys, dimensionKeys = []) {
  if (!report.rows) return [];
  return report.rows.map((row) => {
    const obj = {};
    (dimensionKeys || []).forEach((k, i) => {
      obj[k] = row.dimensionValues?.[i]?.value ?? "";
    });
    (metricKeys || []).forEach((k, i) => {
      obj[k] = parseFloat(row.metricValues?.[i]?.value ?? 0);
    });
    return obj;
  });
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round(((a - b) / b) * 1000) / 10;
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export async function fetchAnalyticsData(propertyId, accessToken, startDate) {
  // Parallel requests
  const [summaryRep, trafficRep, pagesRep, revenueRep, funnelRep] = await Promise.all([
    // Summary metrics
    runReport(propertyId, accessToken, {
      dateRanges: [
        { startDate, endDate: "today" },
        // Previous period for delta
        { startDate: "60daysAgo", endDate: startDate },
      ],
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "purchaseRevenue" },
        { name: "transactions" },
        { name: "ecommercePurchases" },
      ],
    }),

    // Traffic over time
    runReport(propertyId, accessToken, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),

    // Top pages
    runReport(propertyId, accessToken, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 8,
    }),

    // Revenue by day
    runReport(propertyId, accessToken, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "purchaseRevenue" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),

    // Funnel events
    runReport(propertyId, accessToken, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: ["session_start", "view_item", "add_to_cart", "begin_checkout", "purchase"],
          },
        },
      },
    }),
  ]);

  // --- Parse summary ---
  const cur = summaryRep.rows?.[0];
  const prev = summaryRep.rows?.[0]; // GA4 returns both date ranges in metricValues[0] and [1]
  // Note: GA4 date range comparisons use metricValues[0] = current, [1] = previous
  const getMetric = (row, idx, rangeIdx = 0) =>
    parseFloat(row?.metricValues?.[idx]?.value ?? 0);

  const pageviews = getMetric(cur, 0);
  const pageviewsPrev = getMetric(cur, 0, 1);
  const users = getMetric(cur, 1);
  const avgSession = getMetric(cur, 2);
  const bounceRate = Math.round(getMetric(cur, 3) * 1000) / 10;
  const newUsers = getMetric(cur, 4);
  const sessions = getMetric(cur, 5);
  const totalRevenue = getMetric(cur, 6);
  const transactions = getMetric(cur, 7);

  const newUsersPct = sessions > 0 ? Math.round((newUsers / users) * 100) : 0;
  const returningPct = 100 - newUsersPct;
  const convRate = sessions > 0 ? Math.round((transactions / sessions) * 1000) / 10 : 0;
  const revenuePerUser = users > 0 ? Math.round(totalRevenue / users) : 0;
  const aov = transactions > 0 ? Math.round(totalRevenue / transactions) : 0;
  const dau = Math.round(users / (startDate === "7daysAgo" ? 7 : startDate === "30daysAgo" ? 30 : 90));

  // --- Parse traffic ---
  const trafficRows = parseRows(trafficRep, ["views", "visitors"], ["date"]);
  const traffic = trafficRows.map((r) => ({
    label: formatDate(r.date),
    views: r.views,
    visitors: r.visitors,
  }));

  // --- Parse pages ---
  const topPages = parseRows(pagesRep, ["views", "bounceRate"], ["path"]).map((r) => ({
    path: r.path || "/",
    views: Math.round(r.views),
    bounceRate: Math.round(r.bounceRate * 10) / 10,
  }));

  // --- Parse revenue ---
  const revenueRows = parseRows(revenueRep, ["amount"], ["date"]);
  const revenue = revenueRows.map((r) => ({
    label: formatDate(r.date),
    amount: Math.round(r.amount),
  }));

  // --- Parse funnel ---
  const funnelMap = {};
  (funnelRep.rows || []).forEach((row) => {
    funnelMap[row.dimensionValues[0].value] = parseFloat(row.metricValues[0].value);
  });

  const sessionCount = funnelMap["session_start"] || users;
  const funnel = [
    { label: "Visited site", count: Math.round(sessionCount), pct: 100 },
    { label: "Viewed product", count: Math.round(funnelMap["view_item"] || 0), pct: pct100(funnelMap["view_item"], sessionCount) },
    { label: "Added to cart", count: Math.round(funnelMap["add_to_cart"] || 0), pct: pct100(funnelMap["add_to_cart"], sessionCount) },
    { label: "Began checkout", count: Math.round(funnelMap["begin_checkout"] || 0), pct: pct100(funnelMap["begin_checkout"], sessionCount) },
    { label: "Purchased", count: Math.round(funnelMap["purchase"] || transactions), pct: pct100(funnelMap["purchase"] || transactions, sessionCount) },
  ];

  return {
    metrics: {
      pageviews,
      pageviewsDelta: 0, // requires true comparison period
      users: Math.round(users),
      usersDelta: 0,
      avgSession: fmtDuration(avgSession),
      avgSessionDelta: 0,
      bounceRate,
      bounceRateDelta: 0,
      dau,
      dauDelta: 0,
      newUsersPct,
      returningPct,
      clicksPerSession: sessions > 0 ? Math.round((pageviews / sessions) * 10) / 10 : 0,
      clicksDelta: 0,
      convRate,
      convDelta: 0,
      revenuePerUser,
      rpuDelta: 0,
      totalRevenue: Math.round(totalRevenue),
      revDelta: 0,
      aov,
      aovDelta: 0,
    },
    traffic,
    topPages,
    revenue,
    funnel,
  };
}

export async function fetchRealtimeUsers(propertyId, accessToken) {
  const rep = await runRealtimeReport(propertyId, accessToken, {
    metrics: [{ name: "activeUsers" }],
  });
  return parseInt(rep.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

function pct100(a, total) {
  if (!total) return 0;
  return Math.round((a / total) * 1000) / 10;
}

function formatDate(dateStr) {
  // GA4 date format: YYYYMMDD
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return `${d}/${m}`;
}
