import { Link } from "react-router-dom";

const overviewCards = [
  {
    icon: "bi-truck",
    title: "Free Shipping",
    text: "On all orders above Rs. 5,000",
  },
  {
    icon: "bi-clock",
    title: "Delivery Time",
    text: "4-7 business days standard",
  },
  {
    icon: "bi-geo-alt",
    title: "Across India Delivery",
    text: "We ship to all major cities and towns",
  },
  {
    icon: "bi-shield-check",
    title: "Safe Packaging",
    text: "Discreet and secure packaging always",
  },
];

const deliveryOptions = [
  ["Standard Delivery", "5-7 business days", "Rs. 99 (Free above Rs. 5,000)"],
  ["Express Delivery", "2-3 business days", "Rs. 199"],
  ["Same Day (Select Cities)", "Order before 12 PM", "Rs. 299"],
];

export default function ShippingInfo() {
  return (
    <div
      style={{
        background: "var(--brand-light)",
        minHeight: "100vh",
        color: "#2f2a28",
        fontFamily: "var(--font-body)",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, #7f1537 100%)",
          color: "#fff",
          padding: "72px 24px 64px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.85,
              fontWeight: 700,
            }}
          >
            Shipping Info
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(30px, 5vw, 48px)",
              lineHeight: 1.1,
            }}
          >
            Shipping &amp; Delivery
          </h1>
          <p
            style={{
              margin: "14px auto 0",
              maxWidth: 760,
              fontSize: 16,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            Everything you need to know about shipping, delivery, tracking, and
            policy details.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 22,
            }}
          >
            {["Coverage", "Timeline", "Charges", "Tracking", "Support"].map(
              (tag) => (
                <span
                  key={tag}
                  style={{
                    border: "1px solid rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                  }}
                >
                  {tag}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "44px 24px 84px" }}>
        <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {overviewCards.map((card) => (
            <article
              key={card.title}
              style={{
                background: "#fff",
                border: "1px solid rgba(107,15,42,0.12)",
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  marginBottom: 14,
                  fontSize: 22,
                }}
              >
                <i className={`bi ${card.icon}`} />
              </div>
              <h2
                style={{
                  margin: "0 0 8px",
                  fontFamily: "var(--font-heading)",
                  fontSize: 20,
                  color: "var(--brand)",
                }}
              >
                {card.title}
              </h2>
              <p style={{ margin: 0, color: "#5f5550", lineHeight: 1.7 }}>
                {card.text}
              </p>
            </article>
          ))}
        </section>

        <Section title="Delivery Options" number="01">
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                background: "#fff",
                border: "1px solid rgba(107,15,42,0.12)",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--brand)" }}>
                  {["Option", "Timeline", "Cost"].map((head) => (
                    <th
                      key={head}
                      style={{
                        textAlign: "left",
                        padding: "16px 18px",
                        color: "#fff",
                        fontSize: 14,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveryOptions.map((row, idx) => (
                  <tr
                    key={row[0]}
                    style={{
                      background: idx % 2 === 0 ? "#fff" : "rgba(245,240,230,0.55)",
                    }}
                  >
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        style={{
                          padding: "16px 18px",
                          borderTop: "1px solid rgba(107,15,42,0.08)",
                          color: i === 0 ? "#2f2a28" : "#5f5550",
                          fontWeight: i === 0 ? 600 : 400,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Policy Details" number="02">
          <InfoGroup
            title="General"
            items={[
              'Tulasi Twam Private Limited ("OnlyTWAM", "we", "us", or "our") operates the website www.onlytwam.com.',
              "This Delivery & Shipping Policy explains how we handle shipping of products purchased on the OnlyTWAM Platform.",
              "By placing an order, you agree to the terms of this Policy. Please read it carefully before purchasing.",
            ]}
          />
          <InfoGroup
            title="Shipping Coverage"
            items={[
              "We currently deliver across most locations in India through our trusted logistics partners.",
              "At checkout, you will be informed if your pin code is serviceable.",
            ]}
          />
          <InfoGroup
            title="Dispatch & Delivery Timeline"
            items={[
              "Orders are usually dispatched within 2-5 business days.",
              "Delivery times vary by location but typically range between 5-10 business days.",
              "Estimated delivery timelines will be shown at checkout and shared via email/SMS once your order is confirmed.",
              "Delays may occur due to logistics issues, weather, strikes, natural events, or other factors beyond our control.",
            ]}
          />
        </Section>

        <Section title="Shipping Charges" number="03">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <ChargeCard
              label="Free Shipping"
              value="Rs. 0"
              condition="Orders above Rs. 5,000"
              highlight
            />
            <ChargeCard
              label="Standard Shipping"
              value="Shown at checkout"
              condition="Orders below Rs. 5,000"
            />
          </div>
          <p style={{ ...bodyText, marginTop: 14 }}>
            Shipping charges are non-refundable once an order is processed,
            except in cases of defective or wrong products delivered.
          </p>
        </Section>

        <Section title="After Dispatch" number="04">
          <InfoGroup
            title="Delivery Attempts"
            items={[
              "Our delivery partners will make up to 3 attempts to deliver your order.",
              "If you remain unavailable, the order may be cancelled and returned to us.",
              "In such cases, shipping charges will be deducted from any refund (if applicable).",
            ]}
          />
          <InfoGroup
            title="Risk & Title"
            items={[
              "Ownership and risk of the products pass to you upon delivery at your provided address.",
              "Please ensure your shipping details are accurate to avoid delays or failed deliveries.",
            ]}
          />
          <InfoGroup
            title="Order Tracking"
            items={[
              "Once your order is dispatched, a tracking number will be shared with you.",
              "You can use this number on our website or the courier partner's site/app to check the delivery status.",
              "You can also track your order from My Account -> Orders.",
            ]}
          />
          <InfoGroup
            title="Important Notes"
            items={[
              "Delivery timelines are estimates and may vary during peak periods.",
              "We currently do not ship internationally.",
              "For remote locations, additional 2-3 days may apply.",
            ]}
          />
        </Section>

        <Section title="Customer Support" number="05">
          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(107,15,42,0.12)",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
            }}
          >
            <p style={{ ...bodyText, margin: 0 }}>
              For any shipping-related queries, please contact our support team.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link
                to="/contact-us"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--brand)",
                  color: "#fff",
                  padding: "12px 18px",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                }}
              >
                <i className="bi bi-headset" />
                Customer Support
              </Link>
            </div>
          </div>
        </Section>

        <div
          style={{
            marginTop: 48,
            textAlign: "center",
            padding: "18px 20px",
            borderTop: "1px solid rgba(107,15,42,0.12)",
            color: "#6d5d61",
          }}
        >
          <p style={{ margin: 0 }}>
            Still have questions?{" "}
            <Link
              to="/contact-us"
              style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 700 }}
            >
              Customer Support
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const bodyText: React.CSSProperties = {
  color: "#5f5550",
  fontSize: 15,
  lineHeight: 1.8,
};

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <span
          style={{
            background: "var(--brand)",
            color: "#fff",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {number}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontSize: 22,
            color: "var(--brand)",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function InfoGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(107,15,42,0.12)",
        borderRadius: 18,
        padding: 22,
        boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
        marginBottom: 16,
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontFamily: "var(--font-heading)",
          fontSize: 18,
          color: "var(--brand)",
        }}
      >
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((item) => (
          <li key={item} style={{ ...bodyText, marginBottom: 8 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChargeCard({
  label,
  value,
  condition,
  highlight,
}: {
  label: string;
  value: string;
  condition: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "var(--brand)" : "#fff",
        border: `1px solid ${highlight ? "var(--brand)" : "rgba(107,15,42,0.12)"}`,
        borderRadius: 18,
        padding: 22,
        boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
      }}
    >
      <p
        style={{
          margin: 0,
          color: highlight ? "rgba(255,255,255,0.72)" : "var(--heirloom)",
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "10px 0 6px",
          color: highlight ? "#fff" : "var(--brand)",
          fontFamily: "var(--font-heading)",
          fontSize: 24,
        }}
      >
        {value}
      </p>
      <p style={{ margin: 0, color: highlight ? "rgba(255,255,255,0.72)" : "#6d5d61" }}>
        {condition}
      </p>
    </div>
  );
}
