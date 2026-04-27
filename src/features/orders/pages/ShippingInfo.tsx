export default function ShippingInfo() {
  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#fafaf8", minHeight: "100vh" }}>
      {/* Hero Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        padding: "60px 24px 50px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.5px", position: "relative" }}>
          Shipping Information
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: 0, fontStyle: "italic", position: "relative" }}>
          Our policy for returns and swaps.
        </p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", marginTop: "20px", position: "relative" }}>
          {["Free Shipping", "Standard", "Express", "Same Day"].map((tag, i) => (
            <span key={i} style={{
              background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
              padding: "4px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.15)"
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Highlights */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          {[
            { emoji: "🚚", title: "Free Shipping", desc: "On all orders above ₹5,000" },
            { emoji: "📦", title: "Pan India", desc: "We ship to all major cities and towns" },
            { emoji: "🔒", title: "Safe Packaging", desc: "Discreet and secure packaging always" },
            { emoji: "📍", title: "Order Tracking", desc: "Track via SMS, email or My Account" },
          ].map((f) => (
            <div key={f.title} style={{
              background: "#fff", border: "1px solid #e8e4dc", borderRadius: "12px",
              padding: "20px 16px", textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>{f.emoji}</div>
              <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#1a1a2e", fontFamily: "sans-serif" }}>{f.title}</h4>
              <p style={{ margin: 0, fontSize: "12px", color: "#888", lineHeight: "1.5", fontFamily: "sans-serif" }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Delivery Options */}
        <Section title="Delivery Options">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            <DeliveryCard
              badge="FREE"
              title="Free Shipping"
              timeline="7–10 business days"
              cost="₹0"
              condition="For orders above ₹5,000"
              highlight
            />
            <DeliveryCard
              badge="STANDARD"
              title="Standard Delivery"
              timeline="5–7 business days"
              cost="₹99"
              condition="For orders under ₹5,000"
            />
            <DeliveryCard
              badge="EXPRESS"
              title="Express Delivery"
              timeline="2–3 business days"
              cost="₹199"
              condition="For orders under ₹5,000"
            />
            <DeliveryCard
              badge="SAME DAY"
              title="Same Day Delivery"
              timeline="Within 24 hours"
              cost="₹299"
              condition="For orders under ₹5,000"
            />
          </div>
        </Section>

        {/* Order Tracking */}
        <Section title="Order Tracking">
          <p style={paraStyle}>
            Once your order is shipped, you'll receive an SMS and email with your tracking number.
            You can also track your order from <strong>My Account → Orders</strong>.
          </p>
        </Section>

        {/* Important Notes */}
        <Section title="Important Notes">
          <BulletList items={[
            "Delivery timelines are estimates and may vary during peak periods, public holidays, or unforeseen circumstances.",
            "We currently do not ship internationally.",
            "For remote locations, additional 2–3 days may apply.",
            "Orders placed after 12 PM are processed the next business day."
          ]} />
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: "48px", padding: "20px 24px", background: "#fff",
          borderRadius: "10px", border: "1px solid #e8e4dc", textAlign: "center"
        }}>
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>
            For shipping queries, email{" "}
            <a href="mailto:customersupport@onlytwam.com" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              customersupport@onlytwam.com
            </a>
            {" "}| <span style={{ fontWeight: 600 }}>+91 7036534449</span>
          </p>
        </div>

      </div>
    </div>
  );
}

const paraStyle: React.CSSProperties = {
  color: "#555", fontSize: "15px", lineHeight: "1.75", margin: "0 0 10px"
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "36px" }}>
      <h3 style={{
        fontSize: "17px", fontWeight: 700, color: "#1a1a2e",
        margin: "0 0 14px", paddingLeft: "12px",
        borderLeft: "3px solid #0f3460"
      }}>{title}</h3>
      <div style={{ paddingLeft: "12px" }}>{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "0 0 10px", paddingLeft: "20px" }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: "#555", fontSize: "15px", lineHeight: "1.75", marginBottom: "6px" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function DeliveryCard({ badge, title, timeline, cost, condition, highlight }: {
  badge: string; title: string; timeline: string; cost: string; condition: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? "#1a1a2e" : "#fff",
      border: `1px solid ${highlight ? "#1a1a2e" : "#e8e4dc"}`,
      borderRadius: "12px", padding: "20px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: "12px"
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{
          background: highlight ? "rgba(255,255,255,0.15)" : "#f0f4ff",
          color: highlight ? "#fff" : "#0f3460",
          padding: "3px 10px", borderRadius: "4px",
          fontSize: "10px", fontWeight: 700, letterSpacing: "1px",
          fontFamily: "sans-serif"
        }}>{badge}</span>
        <div>
          <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "15px", color: highlight ? "#fff" : "#1a1a2e" }}>
            {title}
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: highlight ? "rgba(255,255,255,0.55)" : "#888", fontFamily: "sans-serif" }}>
            {timeline}
          </p>
        </div>
      </div>
      {/* Right */}
      <div style={{ textAlign: "right" }}>
        <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "20px", color: highlight ? "#fff" : "#1a1a2e" }}>
          {cost}
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: highlight ? "rgba(255,255,255,0.5)" : "#aaa", fontFamily: "sans-serif" }}>
          {condition}
        </p>
      </div>
    </div>
  );
}