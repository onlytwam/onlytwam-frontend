import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function UserTypeChart({ newPct, returnPct }) {
  const data = [
    { name: "New", value: newPct },
    { name: "Returning", value: returnPct },
  ];
  const COLORS = ["#e8a598", "#7cb87c"];

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: "#888" }}>
        {data.map((d, i) => (
          <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS[i], display: "inline-block" }} />
            {d.name} {d.value}%
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v}%`]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
