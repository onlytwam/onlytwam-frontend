import { Link } from 'react-router-dom';

export default function ReturnRefundPolicy() {
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
          Cancellation, Return &amp; Refund Policy
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: 0, fontStyle: "italic", position: "relative" }}>
          Easy cancellations, exchanges, and refunds — explained clearly.
        </p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", marginTop: "20px", position: "relative" }}>
          {["Cancellation", "Returns", "Exchanges", "Refunds", "Support"].map((tag, i) => (
            <span key={i} style={{
              background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
              padding: "4px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.15)"
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Intro */}
        <p style={{ ...paraStyle, marginBottom: "36px", fontSize: "15px", lineHeight: "1.8", color: "#555" }}>
          Tulasi Twam Private Limited ("OnlyTWAM", "we", "us" or "our") operates the website{" "}
          <strong>www.onlytwam.com</strong>. We want your shopping journey with OnlyTWAM to be seamless and worry-free.
          This Cancellation, Return &amp; Refund Policy, read with our Terms &amp; Conditions, explains how you can cancel
          orders, exchange products, or request refunds.
        </p>

        {/* Cancellation */}
        <Section title="Cancellation Of Orders">
          <BulletList items={[
            "You may cancel your order before it has been shipped by contacting us at our Contact Us page.",
            "Once the order has been shipped, cancellation is not possible. You may instead request an exchange or refund (where eligible) after delivery.",
            "For prepaid orders that are cancelled before shipment, refunds will be processed to the original payment method within 7–10 business days.",
            "For Cash on Delivery (COD) orders, there is no refund since no payment was made; you may simply refuse delivery."
          ]} />
        </Section>

        {/* Return & Exchange */}
        <Section title="Return & Exchange Policy">
          <InfoBox>
            Because of the intimate nature of our products, returns and exchanges are limited to protect hygiene and safety.
          </InfoBox>

          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Bras */}
            <ProductCard
              emoji="👙"
              title="Bras"
              highlight
              items={[
                "Eligible for exchange only within 7 days of delivery.",
                "Product must be unused, unwashed, with tags and packaging intact.",
                "Exchange allowed only for size or fit issues."
              ]}
            />

            {/* Panties etc */}
            <ProductCard
              emoji="🚫"
              title="Panties, Stick-On Bras, Pasties & Intimate Accessories"
              items={[
                "Not eligible for return or exchange for hygiene reasons."
              ]}
              warning
            />

            {/* Defective */}
            <ProductCard
              emoji="⚠️"
              title="Defective / Wrong Product"
              items={[
                "If you receive a damaged, defective, or incorrect product, please raise a request within 48 hours of delivery with supporting images.",
                "Upon verification, we will arrange a replacement or process a refund."
              ]}
            />
          </div>

          {/* Conditions */}
          <div style={{ marginTop: "24px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 10px" }}>
              Conditions for Acceptance of Return / Exchange:
            </h4>
            <BulletList items={[
              "Item must be in original condition (unused, unwashed, undamaged).",
              "Tags, labels, packaging, invoice, and accessories must be intact.",
              "If purchased as a set, the complete set must be returned/exchanged.",
              "Products showing signs of wear, stains, odour, or alteration will not be accepted."
            ]} />
          </div>
        </Section>

        {/* Refunds */}
        <Section title="Refunds">
          <p style={paraStyle}>Refunds are issued only for:</p>
          <BulletList items={[
            "Cancelled prepaid orders (before shipment).",
            "Defective/damaged/wrong products returned and approved after quality check."
          ]} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", margin: "20px 0" }}>
            {[
              { label: "Refund Timeline", value: "7–10 Business Days", sub: "After approval" },
              { label: "Refund Method", value: "Original Payment", sub: "Card / UPI / Net Banking" },
              { label: "COD Refunds", value: "Bank Transfer", sub: "Or store credit" },
            ].map((card) => (
              <div key={card.label} style={{
                background: "#fff", border: "1px solid #e8e4dc", borderRadius: "10px",
                padding: "18px", textAlign: "center"
              }}>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#888", fontFamily: "sans-serif" }}>{card.label}</p>
                <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#1a1a2e" }}>{card.value}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#aaa", fontFamily: "sans-serif" }}>{card.sub}</p>
              </div>
            ))}
          </div>

          <BulletList items={[
            "Shipping charges (if any) are non-refundable, unless the return is due to our error (defective/damaged/wrong item).",
            "No cash refunds will be provided."
          ]} />
        </Section>

        {/* Customer Support */}
        <Section title="Customer Support">
          <p style={paraStyle}>For any cancellations, returns, or refund requests, please contact:</p>
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

        {/* General */}
        <Section title="General">
          <BulletList items={[
            "OnlyTWAM reserves the right to reject cancellation/return/exchange requests if the conditions outlined above are not met.",
            "This Policy may be updated from time to time. Any changes will be published on the Platform, and continued use will be considered acceptance of the updated Policy."
          ]} />
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: "48px", padding: "20px 24px", background: "#fff",
          borderRadius: "10px", border: "1px solid #e8e4dc", textAlign: "center"
        }}>
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>
            Still have questions?{" "}
            <Link to="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Support
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#f0f4ff", border: "1px solid #c7d4f0", borderRadius: "8px",
      padding: "14px 18px", color: "#2a3a6e", fontSize: "14px", lineHeight: "1.7"
    }}>
      ℹ️ {children}
    </div>
  );
}

function ProductCard({ emoji, title, items, highlight, warning }: {
  emoji: string; title: string; items: string[]; highlight?: boolean; warning?: boolean;
}) {
  const borderColor = warning ? "#e8c4c4" : highlight ? "#0f3460" : "#e8e4dc";
  const bgColor = warning ? "#fff8f8" : highlight ? "#f0f4ff" : "#fff";
  const titleColor = warning ? "#8b2020" : "#1a1a2e";

  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: "10px", padding: "18px 20px",
      borderLeft: `4px solid ${borderColor}`
    }}>
      <h4 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 700, color: titleColor, display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{emoji}</span> {title}
      </h4>
      <ul style={{ margin: 0, paddingLeft: "18px" }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: "#555", fontSize: "14px", lineHeight: "1.7", marginBottom: "4px" }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}