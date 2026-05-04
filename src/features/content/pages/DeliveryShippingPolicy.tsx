import { Link } from 'react-router-dom';

export default function DeliveryShippingPolicy() {
  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#fafaf8", minHeight: "100vh" }}>
      {/* Hero Header */}
      <div style={{
        background: "linear-gradient(135deg, #6A012A 0%, #8B0136 50%, #6A012A 100%)",
        padding: "60px 24px 50px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
  radial-gradient(circle at 20% 50%, rgba(246,238,225,0.10) 1px, transparent 1px),
  radial-gradient(circle at 80% 20%, rgba(246,238,225,0.06) 1px, transparent 1px),
  radial-gradient(circle at 60% 80%, rgba(106,1,42,0.15) 1px, transparent 1px)
`,
          backgroundSize: "40px 40px, 40px 40px, 60px 60px"
        }} />
        <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.5px", position: "relative" }}>
          Delivery &amp; Shipping Policy
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: 0, fontStyle: "italic", position: "relative" }}>
          Our policy for deliveries and shipments.
        </p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", marginTop: "20px", position: "relative" }}>
          {["Coverage", "Timeline", "Charges", "Tracking", "Support"].map((tag, i) => (
            <span key={i} style={{
              background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
              padding: "4px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.15)"
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px" }}>

        <Section number="1" title="General">
          <BulletList items={[
            `Tulasi Twam Private Limited ("OnlyTWAM", "we", "us", or "our") operates the website www.onlytwam.com.`,
            "This Delivery & Shipping Policy explains how we handle shipping of products purchased on the OnlyTWAM Platform.",
            "By placing an order, you agree to the terms of this Policy. Please read it carefully before purchasing."
          ]} />
        </Section>

        <Section number="2" title="Shipping Coverage">
          <BulletList items={[
            "We currently deliver across most locations in India through our trusted logistics partners.",
            "At checkout, you will be informed if your pin code is serviceable."
          ]} />
        </Section>

        <Section number="3" title="Dispatch & Delivery Timeline">
          <BulletList items={[
            "Orders are usually dispatched within 2–5 business days.",
            "Delivery times vary by location but typically range between 5–10 business days.",
            "Estimated delivery timelines will be shown at checkout and shared via email/SMS once your order is confirmed.",
            "Delays may occur due to logistics issues, weather, strikes, natural events, or other factors beyond our control."
          ]} />
        </Section>

        <Section number="4" title="Shipping Charges">
          {/* Charges Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <ChargeCard
              label="Free Shipping"
              value="₹0"
              condition="Orders above ₹5,000"
              highlight
            />
            <ChargeCard
              label="Standard Shipping"
              value="Shown at checkout"
              condition="Orders below ₹5,000"
            />
          </div>
          <InfoBox>
            Shipping charges are non-refundable once an order is processed, except in cases of defective or wrong products delivered.
          </InfoBox>
        </Section>

        <Section number="5" title="Delivery Attempts">
          <p style={paraStyle}>
            Our delivery partners will make up to <strong>3 attempts</strong> to deliver your order. If you remain unavailable, the order may be cancelled and returned to us. In such cases, shipping charges will be deducted from any refund (if applicable).
          </p>
        </Section>

        <Section number="6" title="Risk & Title">
          <BulletList items={[
            "Ownership and risk of the products pass to you upon delivery at your provided address.",
            "Please ensure your shipping details are accurate to avoid delays or failed deliveries."
          ]} />
        </Section>

        <Section number="7" title="Order Tracking">
          <p style={paraStyle}>
            Once your order is dispatched, a tracking number will be shared with you. You can use this number on our website or the courier partner's site/app to check the delivery status.
          </p>
        </Section>

        <Section number="8" title="Customer Support">
          <p style={paraStyle}>For any shipping-related queries, please contact:</p>
          <div style={{
            background: "#fff", border: "1px solid #e8e4dc", borderRadius: "10px",
            padding: "20px 24px", marginTop: "12px", borderLeft: "4px solid #0f3460"
          }}>
            {[
              ["Contact", "/contact-us"]
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "16px", padding: "8px 0", borderBottom: "1px solid #f0ece4", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "#0f3460", minWidth: "80px", fontSize: "14px" }}>{label}</span>
                <span style={{ color: "#444", fontSize: "14px" }}>{value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: "48px", padding: "20px 24px", background: "#fff",
          borderRadius: "10px", border: "1px solid #e8e4dc", textAlign: "center"
        }}>
          <p style={{ margin: "0 0 6px", color: "#888", fontSize: "13px" }}>
            Still have questions?{" "}
            <Link to="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Us
            </Link>
            {" "}or email{" "}
            <a href="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Us
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}

const paraStyle: React.CSSProperties = {
  color: "#555", fontSize: "15px", lineHeight: "1.75", margin: "0 0 10px"
};

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h3 style={{
        fontSize: "17px", fontWeight: 700, color: "#1a1a2e",
        margin: "0 0 12px", paddingLeft: "12px",
        borderLeft: "3px solid #0f3460",
        display: "flex", alignItems: "center", gap: "8px"
      }}>
        <span style={{
          background: "#1a1a2e", color: "#fff", fontSize: "11px",
          padding: "2px 8px", borderRadius: "4px", fontFamily: "sans-serif", fontWeight: 700
        }}>{number}</span>
        {title}
      </h3>
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#f0f4ff", border: "1px solid #c7d4f0", borderRadius: "8px",
      padding: "14px 18px", marginTop: "8px", color: "#2a3a6e", fontSize: "14px", lineHeight: "1.7"
    }}>
      ℹ️ {children}
    </div>
  );
}

function ChargeCard({ label, value, condition, highlight }: {
  label: string; value: string; condition: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? "#1a1a2e" : "#fff",
      border: `1px solid ${highlight ? "#1a1a2e" : "#e8e4dc"}`,
      borderRadius: "10px", padding: "20px",
      textAlign: "center"
    }}>
      <p style={{ margin: "0 0 6px", fontSize: "13px", color: highlight ? "rgba(255,255,255,0.6)" : "#888", fontFamily: "sans-serif" }}>
        {label}
      </p>
      <p style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 700, color: highlight ? "#fff" : "#1a1a2e" }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: "12px", color: highlight ? "rgba(255,255,255,0.5)" : "#aaa", fontFamily: "sans-serif" }}>
        {condition}
      </p>
    </div>
  );
}