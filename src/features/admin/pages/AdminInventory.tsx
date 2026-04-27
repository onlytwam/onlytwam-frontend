import { useState } from "react";
import { Route, useNavigate } from "react-router-dom";

const reports = [
  {
    name: "Sales & Revenue Reports",
    desc: "Track revenue trends, conversion rates, and sales performance.",
    route: "/admin/sales-reports",
    icon: "💹",
    badge: "Core",
    badgeBg: "#E6F1FB", badgeColor: "#185FA5",
    bg: "#F0F7FF",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <rect x="10" y="55" width="14" height="30" rx="3" fill="#378ADD" opacity="0.8" />
        <rect x="30" y="40" width="14" height="45" rx="3" fill="#378ADD" opacity="0.9" />
        <rect x="50" y="28" width="14" height="57" rx="3" fill="#378ADD" />
        <rect x="70" y="18" width="14" height="67" rx="3" fill="#185FA5" />
        <rect x="90" y="8" width="14" height="77" rx="3" fill="#0C447C" />
        <polyline points="17,55 37,40 57,28 77,18 97,8" stroke="#FAC775" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17" cy="55" r="3.5" fill="#FAC775" />
        <circle cx="37" cy="40" r="3.5" fill="#FAC775" />
        <circle cx="57" cy="28" r="3.5" fill="#FAC775" />
        <circle cx="77" cy="18" r="3.5" fill="#FAC775" />
        <circle cx="97" cy="8" r="3.5" fill="#FAC775" />
      </svg>
    ),
  },
  {
    name: "Customer Reports",
    desc: "Analyze customer behavior, retention, and lifetime value.",
    route: "/admin/customer-reports",
    icon: "👥",
    badge: "CRM",
    badgeBg: "#FBEAF0", badgeColor: "#993556",
    bg: "#FDF0F5",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <circle cx="42" cy="32" r="16" fill="#F4C0D1" />
        <circle cx="78" cy="32" r="16" fill="#ED93B1" />
        <circle cx="60" cy="26" r="18" fill="#D4537E" />
        <path d="M20 82 Q20 62 42 62 Q60 58 60 58 Q60 58 78 62 Q100 62 100 82" fill="#993556" opacity="0.6" />
        <path d="M30 82 Q30 65 60 62 Q90 65 90 82" fill="#D4537E" opacity="0.8" />
        <circle cx="60" cy="26" r="10" fill="#FBEAF0" />
        <text x="60" y="30" textAnchor="middle" fill="#993556" fontSize="10" fontWeight="600">★ 4.8</text>
      </svg>
    ),
  },
  {
    name: "Order & Fulfillment Reports",
    desc: "Monitor order status, delivery times, and logistics efficiency.",
    route: "/admin/order-fulfillment-reports",
    icon: "📦",
    badge: "Ops",
    badgeBg: "#FAEEDA", badgeColor: "#854F0B",
    bg: "#FFF8EE",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <rect x="15" y="40" width="40" height="38" rx="4" fill="#FAC775" />
        <rect x="20" y="35" width="30" height="10" rx="3" fill="#EF9F27" />
        <rect x="25" y="30" width="20" height="8" rx="2" fill="#BA7517" />
        <circle cx="85" cy="55" r="20" fill="#E1F5EE" />
        <path d="M75 55 L82 63 L97 47" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    name: "Payment & Financial Reports",
    desc: "Review transactions, refunds, and financial summaries.",
    route: "/admin/payment-checkout-reports",
    icon: "💰",
    badge: "Finance",
    badgeBg: "#EAF3DE", badgeColor: "#3B6D11",
    bg: "#F2FAE8",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <rect x="15" y="20" width="90" height="55" rx="8" fill="#C0DD97" />
        <rect x="15" y="30" width="90" height="15" fill="#97C459" />
        <circle cx="38" cy="57" r="12" fill="#639922" />
        <circle cx="38" cy="57" r="7" fill="#97C459" />
        <rect x="65" y="50" width="30" height="5" rx="2" fill="#3B6D11" opacity="0.5" />
        <rect x="70" y="60" width="20" height="5" rx="2" fill="#3B6D11" opacity="0.3" />
      </svg>
    ),
  },
  {
    name: "Marketing & Campaign Reports",
    desc: "Measure campaign ROI, reach, and conversion funnels.",
    route: "/admin/marketing-campaign-reports",
    icon: "📣",
    badge: "Growth",
    badgeBg: "#EEEDFE", badgeColor: "#534AB7",
    bg: "#F2F1FF",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <circle cx="60" cy="45" r="32" fill="#CECBF6" opacity="0.5" />
        <circle cx="60" cy="45" r="22" fill="#AFA9EC" opacity="0.6" />
        <circle cx="60" cy="45" r="13" fill="#7F77DD" />
        <path d="M60 13 L60 45" stroke="#534AB7" strokeWidth="2" />
        <path d="M60 45 L87 28" stroke="#534AB7" strokeWidth="2" />
        <path d="M60 45 L85 63" stroke="#534AB7" strokeWidth="2" />
        <circle cx="60" cy="13" r="4" fill="#3C3489" />
        <circle cx="87" cy="28" r="4" fill="#3C3489" />
        <circle cx="85" cy="63" r="4" fill="#3C3489" />
      </svg>
    ),
  },
  {
    name: "Inventory & Product Reports",
    desc: "Track stock levels, product performance, and reorder alerts.",
    route: "/admin/inventory-product-reports",
    icon: "🗂️",
    badge: "Stock",
    badgeBg: "#FAEEDA", badgeColor: "#854F0B",
    bg: "#FFF8EE",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <rect x="20" y="55" width="80" height="28" rx="4" fill="#FAC775" />
        <rect x="20" y="32" width="80" height="22" rx="4" fill="#EF9F27" />
        <rect x="20" y="12" width="80" height="18" rx="4" fill="#BA7517" />
        <rect x="28" y="17" width="30" height="4" rx="2" fill="#FAC775" opacity="0.6" />
        <rect x="28" y="37" width="45" height="4" rx="2" fill="#FAC775" opacity="0.6" />
        <rect x="28" y="61" width="50" height="4" rx="2" fill="#854F0B" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Site Analytics & User Behavior",
    desc: "Understand traffic sources, bounce rates, and user journeys.",
    icon: "🔍",
    badge: "Analytics",
    badgeBg: "#E6F1FB", badgeColor: "#185FA5",
    bg: "#EDF5FF",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <circle cx="50" cy="42" r="28" fill="#B5D4F4" opacity="0.5" />
        <circle cx="50" cy="42" r="20" fill="#85B7EB" opacity="0.5" />
        <circle cx="50" cy="42" r="12" fill="#378ADD" opacity="0.7" />
        <line x1="65" y1="57" x2="95" y2="80" stroke="#185FA5" strokeWidth="5" strokeLinecap="round" />
        <circle cx="50" cy="42" r="5" fill="#0C447C" />
      </svg>
    ),
  },
  {
    name: "Operational & Support Reports",
    desc: "Evaluate support tickets, resolution times, and team output.",
    icon: "⚙️",
    badge: "Support",
    badgeBg: "#F1EFE8", badgeColor: "#444441",
    bg: "#F5F4F0",
    svg: (
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        <circle cx="60" cy="45" r="28" fill="#D3D1C7" opacity="0.4" />
        <circle cx="60" cy="45" r="18" fill="#B4B2A9" opacity="0.5" />
        <circle cx="60" cy="45" r="9" fill="#888780" />
        <rect x="58" y="10" width="4" height="16" rx="2" fill="#5F5E5A" />
        <rect x="58" y="64" width="4" height="16" rx="2" fill="#5F5E5A" />
        <rect x="10" y="43" width="16" height="4" rx="2" fill="#5F5E5A" />
        <rect x="94" y="43" width="16" height="4" rx="2" fill="#5F5E5A" />
      </svg>
    ),
  },
];

interface ReportCard {
  route?: string;
  name: string;
  desc: string;
  icon: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  bg: string;
  svg: React.ReactNode;
}

function ReportCard({ report, onView }: { report: ReportCard; onView: () => void }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: `0.5px solid ${hovered ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.08)"}`,
        overflow: "hidden",
        cursor: "pointer",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 0.18s ease, border-color 0.18s ease",
      }}
    >
      {/* Illustration area */}
      <div
        style={{
          height: 150,
          background: report.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {report.svg}
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 20,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: report.badgeBg,
            color: report.badgeColor,
          }}
        >
          {report.badge}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "16px 18px 18px",
          borderTop: "0.5px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span>{report.icon}</span>
          {report.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#888",
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          {report.desc}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (report.route) navigate(report.route);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "#C0285A",
            display: "inline-flex",
            alignItems: "center",
            gap: hovered ? 8 : 5,
            transition: "gap 0.18s ease",
            fontFamily: "inherit",
          }}
        >
          VIEW <span style={{ transition: "transform 0.18s ease", transform: hovered ? "translateX(3px)" : "none" }}>→</span>
        </button>
      </div>
    </div>
  );
}

export default function ReportsDashboard() {
  const handleView = (reportName: string) => {
    console.log("Navigate to:", reportName);
    // Replace with your router: navigate(`/reports/${slug}`)
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#F7F7F5",
        minHeight: "100vh",
        padding: "28px 24px 48px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#111",
            margin: 0,
            letterSpacing: "-0.3px",
          }}
        >
          Reports & Analytics
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          Explore insights across all business areas
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {reports.map((report) => (
          <ReportCard
            key={report.name}
            report={report}
            onView={() => handleView(report.name)}
          />
        ))}
      </div>
    </div>
  );
}