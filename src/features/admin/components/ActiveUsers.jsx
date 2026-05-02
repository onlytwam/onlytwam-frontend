export default function ActiveUsers({ count }) {
  return (
    <div style={styles.badge}>
      <span style={styles.pulse} />
      <span style={styles.label}>
        {count === null ? "—" : count} active now
      </span>
    </div>
  );
}

const styles = {
  badge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    color: "#aaa",
  },
  pulse: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#7cb87c",
    boxShadow: "0 0 0 0 rgba(124,184,124,0.4)",
    animation: "pulse 1.5s ease-out infinite",
    display: "inline-block",
  },
  label: { fontVariantNumeric: "tabular-nums" },
};
