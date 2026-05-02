export default function MetricCard({ label, value, delta, format, icon, invertDelta }) {
  const formatted = formatValue(value, format);
  const isUp = delta > 0;
  const isDown = delta < 0;

  // For bounce rate, lower is better (invertDelta)
  const positive = invertDelta ? isDown : isUp;
  const negative = invertDelta ? isUp : isDown;

  return (
    <div style={styles.card}>
      <div style={styles.top}>
        <span style={styles.icon}>{icon}</span>
        <span style={styles.label}>{label}</span>
      </div>
      <div style={styles.value}>{formatted}</div>
      {delta !== undefined && delta !== 0 && (
        <div
          style={{
            ...styles.delta,
            color: positive ? "#7cb87c" : negative ? "#c87070" : "#666",
          }}
        >
          {isUp ? "↑" : "↓"} {Math.abs(delta)}%
        </div>
      )}
    </div>
  );
}

function formatValue(value, format) {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "number":
      return Number(value).toLocaleString("en-IN");
    case "currency":
      return "₹" + Number(value).toLocaleString("en-IN");
    case "percent":
      return value + "%";
    case "decimal":
      return Number(value).toFixed(1);
    case "duration":
      return value; // already formatted string
    default:
      return value;
  }
}

const styles = {
  card: {
    background: "#1a1a1a",
    border: "1px solid #222",
    borderRadius: 10,
    padding: "14px 16px",
  },
  top: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  icon: { fontSize: 14 },
  label: { fontSize: 11, color: "#666", fontWeight: 500, letterSpacing: "0.02em" },
  value: { fontSize: 24, fontWeight: 600, color: "#f0ede8", letterSpacing: "-0.03em" },
  delta: { fontSize: 12, marginTop: 3 },
};
