export default function TopPages({ pages }) {
  if (!pages?.length) return <div style={{ color: "#444", fontSize: 13 }}>No page data</div>;

  const maxViews = pages[0]?.views || 1;

  return (
    <div>
      {pages.map((page, i) => (
        <div key={i} style={styles.row}>
          <div style={styles.left}>
            <span style={styles.rank}>#{i + 1}</span>
            <div>
              <div style={styles.path}>{page.path}</div>
              <div style={styles.bar}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${Math.round((page.views / maxViews) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div style={styles.right}>
            <span style={styles.views}>{page.views.toLocaleString("en-IN")}</span>
            <span style={styles.bounce}>{page.bounceRate}% bounce</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "9px 0",
    borderBottom: "1px solid #1e1e1e",
    gap: 12,
  },
  left: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  rank: { fontSize: 10, color: "#444", width: 18, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  path: { fontSize: 13, color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 },
  bar: { height: 2, background: "#222", borderRadius: 1, marginTop: 4, maxWidth: 260 },
  barFill: { height: "100%", background: "#e8a598", borderRadius: 1, transition: "width 0.4s" },
  right: { display: "flex", gap: 14, fontSize: 12, flexShrink: 0 },
  views: { color: "#f0ede8", fontVariantNumeric: "tabular-nums" },
  bounce: { color: "#555" },
};
