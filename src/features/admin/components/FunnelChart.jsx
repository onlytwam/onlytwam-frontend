export default function FunnelChart({ steps }) {
  if (!steps?.length) return null;
  const max = steps[0]?.count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((step, i) => (
        <div key={i}>
          <div style={styles.row}>
            <div
              style={{
                ...styles.bar,
                width: `${step.pct}%`,
                opacity: 1 - i * 0.12,
              }}
            >
              <span style={styles.pct}>{step.pct}%</span>
            </div>
          </div>
          <div style={styles.meta}>
            <span style={styles.stepLabel}>{step.label}</span>
            <span style={styles.count}>{step.count.toLocaleString("en-IN")}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={styles.dropLine}>
              ↓ {Math.round((1 - steps[i + 1].count / Math.max(step.count, 1)) * 100)}% drop-off
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  row: { display: "flex", alignItems: "center" },
  bar: {
    height: 28,
    background: "linear-gradient(90deg, #c87070 0%, #e8a598 100%)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    minWidth: 40,
    transition: "width 0.4s ease",
  },
  pct: { fontSize: 11, fontWeight: 600, color: "#fff", paddingLeft: 8 },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 3,
    fontSize: 11,
    color: "#666",
  },
  stepLabel: {},
  count: { fontVariantNumeric: "tabular-nums" },
  dropLine: {
    fontSize: 10,
    color: "#444",
    paddingLeft: 4,
    marginBottom: 2,
  },
};
