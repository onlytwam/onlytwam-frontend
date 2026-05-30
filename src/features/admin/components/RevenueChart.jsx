import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell
} from "recharts";

export default function RevenueChart({ data }) {
  if (!data?.length) return <Empty />;

  const max = Math.max(...data.map((d) => d.amount));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#666" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#666" }}
          axisLine={false}
          tickLine={false}
          width={50}
          tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
        />
        <Tooltip
          contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#aaa" }}
          formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.amount === max ? "#e8a598" : "#3a2828"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 13 }}>No revenue data</div>;
}
