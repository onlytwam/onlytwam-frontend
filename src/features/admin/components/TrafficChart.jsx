import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

export default function TrafficChart({ data }) {
  if (!data?.length) return <Empty />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#666" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#666" }}
          axisLine={false}
          tickLine={false}
          width={45}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
        />
        <Tooltip
          contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#aaa" }}
          itemStyle={{ color: "#ddd" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#666", paddingTop: 8 }}
          formatter={(value) => value === "views" ? "Page views" : "Visitors"}
        />
        <Line
          type="monotone"
          dataKey="views"
          stroke="#e8a598"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#e8a598" }}
        />
        <Line
          type="monotone"
          dataKey="visitors"
          stroke="#7cb87c"
          strokeWidth={2}
          dot={false}
          strokeDasharray="4 3"
          activeDot={{ r: 4, fill: "#7cb87c" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 13 }}>No traffic data</div>;
}
