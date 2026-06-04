export default function TermsConditions() {
  return (
    <div
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        background: "#fafaf8",
        minHeight: "100vh",
      }}
    >
      {/* Hero Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #6A012A 0%, #8B0136 50%, #6A012A 100%)",
          padding: "60px 24px 50px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
  radial-gradient(circle at 20% 50%, rgba(246,238,225,0.10) 1px, transparent 1px),
  radial-gradient(circle at 80% 20%, rgba(246,238,225,0.06) 1px, transparent 1px),
  radial-gradient(circle at 60% 80%, rgba(106,1,42,0.15) 1px, transparent 1px)
`,
            backgroundSize: "40px 40px, 40px 40px, 60px 60px",
          }}
        />
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.5px",
            position: "relative",
          }}
        >
          Terms &amp; Conditions
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "16px",
            margin: 0,
            fontStyle: "italic",
            position: "relative",
          }}
        >
          Rules for using our website and services.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "20px",
            position: "relative",
          }}
        >
          {[
            "Part A – Terms Of Use",
            "Part B – Terms Of Sale",
            "Part C – Legal",
          ].map((part, i) => (
            <span
              key={i}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {part}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        {/* Part A */}
        <PartHeader label="Part A" title="Terms Of Use" />

        <Section title="General Information">
          <BulletList
            items={[
              `Tulasi Twam Private Limited, having its registered office at Plot No. 4, Flat No. 402, Sy. No. 184-189, Yalavarthi Placid, Srinivas Nagar Colony, Nizampet, Bachupally, Hyderabad, Telangana – 500090, India ("OnlyTWAM", "we", "us" or "our") operates the website www.onlytwam.com ("Platform").`,
              `These Terms govern your use of the Platform and our sale of Products. By accessing or using the Platform, you agree to these Terms. If you do not agree, please discontinue use.`,
            ]}
          />
        </Section>

        <Section title="Eligibility">
          <BulletList
            items={[
              "You must be 18 years or older to use or buy from the Platform. If under 18, you may use the Platform only with parent/guardian supervision.",
            ]}
          />
        </Section>

        <Section title="Account Registration">
          <BulletList
            items={[
              "Registration may require accurate details and OTP verification. You are responsible for your account security. Any misuse or unauthorized use is your responsibility.",
            ]}
          />
        </Section>

        <Section title="User Obligations & Misuse">
          <p style={paraStyle}>You agree not to:</p>
          <BulletList
            items={[
              "Create fake accounts or provide false information.",
              "Introduce malware, hacking, viruses, or attempt unauthorized access.",
              "Copy, resell, or misuse content.",
              "Engage in fraudulent transactions.",
            ]}
          />
          <p style={paraStyle}>
            We may suspend or terminate accounts in case of misuse.
          </p>
        </Section>

        <Section title="Communications">
          <p style={paraStyle}>
            By registering, you consent to receive transactional and promotional
            messages (SMS, email, WhatsApp). You may opt out of promotional
            communication anytime.
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p style={paraStyle}>
            All content, trademarks, and materials belong to OnlyTWAM. You may
            not copy, reproduce, or redistribute without permission.
          </p>
        </Section>

        <Section title="User Content">
          <p style={paraStyle}>
            You may post reviews or comments. By posting, you grant us the right
            to use and display them for business purposes.
          </p>
        </Section>

        <Section title="Disclaimer">
          <p style={paraStyle}>
            The Platform and Products are provided "as is." We make no warranty
            of accuracy or uninterrupted service.
          </p>
        </Section>

        {/* Part B */}
        <PartHeader label="Part B" title="Terms Of Sale" />

        <Section title="Contract Of Sale">
          <p style={paraStyle}>
            Product listings are invitations to offer. Orders placed are your
            offers. A contract is concluded only when shipment is confirmed.
          </p>
        </Section>

        <Section title="Product Availability">
          <p style={paraStyle}>
            Availability is subject to stock. We may cancel orders if Products
            are unavailable.
          </p>
        </Section>

        <Section title="Pricing & Payment">
          <p style={paraStyle}>
            Prices are in INR and inclusive of applicable taxes. Payment methods
            include UPI, cards, net banking, wallets. We do not store financial
            information.
          </p>
        </Section>

        <Section title="Shipping & Delivery">
          <BulletList
            items={[
              "Free shipping on orders above ₹5000.",
              "Standard charges may apply otherwise.",
              "Delivery timelines are indicative; delays may occur due to logistics or external factors.",
            ]}
          />
        </Section>

        <Section title="Refunds & Exchanges">
          <BulletList
            items={[
              "Bras may be exchanged within 7 days if unused and tags intact.",
              "Panties are not eligible for return or exchange for hygiene reasons.",
              "Refunds only for defective, damaged, or wrong items delivered.",
              "Refunds will be processed via original payment mode.",
            ]}
          />
        </Section>

        <Section title="Limitation Of Liability">
          <p style={paraStyle}>
            Our liability is limited to the purchase price of the Product in
            question. We are not liable for indirect or consequential losses.
          </p>
        </Section>

        <Section title="Force Majeure">
          <p style={paraStyle}>
            We are not responsible for delays or failures due to events beyond
            control (natural calamities, strikes, system failures, pandemics,
            government actions).
          </p>
        </Section>

        {/* Part C */}
        <PartHeader label="Part C" title="Legal" />

        <Section title="Governing Law & Jurisdiction">
          <p style={paraStyle}>
            These Terms are governed by Indian law. Courts in Hyderabad,
            Telangana shall have exclusive jurisdiction.
          </p>
        </Section>

        <Section title="Severability">
          <p style={paraStyle}>
            If any provision is held invalid, the remaining provisions continue
            in force.
          </p>
        </Section>

        <Section title="Amendments">
          <p style={paraStyle}>
            We may amend these Terms at any time. Updated Terms will be posted
            on the Platform.
          </p>
        </Section>

        {/* Footer note */}
        <div
          style={{
            marginTop: "48px",
            padding: "20px 24px",
            background: "#fff",
            borderRadius: "10px",
            border: "1px solid #e8e4dc",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>
            For queries, contact us at{" "}
            <a
              href="/contact-us"
              style={{
                color: "#0f3460",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Contact Us
            </a>{" "}
          </p>
        </div>
      </div>
    </div>
  );
}

const paraStyle: React.CSSProperties = {
  color: "#555",
  fontSize: "15px",
  lineHeight: "1.75",
  margin: "0 0 10px",
};

function PartHeader({ label, title }: { label: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        margin: "48px 0 28px",
        paddingBottom: "16px",
        borderBottom: "2px solid #1a1a2e",
      }}
    >
      <span
        style={{
          background: "#1a1a2e",
          color: "#fff",
          padding: "4px 14px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase",
          fontFamily: "sans-serif",
        }}
      >
        {label}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: "22px",
          color: "#1a1a2e",
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h3
        style={{
          fontSize: "17px",
          fontWeight: 700,
          color: "#1a1a2e",
          margin: "0 0 10px",
          paddingLeft: "12px",
          borderLeft: "3px solid #0f3460",
        }}
      >
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
        <li
          key={i}
          style={{
            color: "#555",
            fontSize: "15px",
            lineHeight: "1.75",
            marginBottom: "6px",
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
