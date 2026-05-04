export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: 0, fontStyle: "italic", position: "relative" }}>
          How we handle your personal data.
        </p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", marginTop: "20px", position: "relative" }}>
          {["General", "Data Collection", "Security", "User Rights", "Legal"].map((part, i) => (
            <span key={i} style={{
              background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
              padding: "4px 12px", borderRadius: "20px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.15)"
            }}>{part}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px" }}>

        <Section title="General">
          <p style={paraStyle}>
            Tulasi Twam Private Limited, having its registered office at Plot No. 4, Flat No. 402, Sy. No. 184-189, Yalavarthi Placid, Srinivas Nagar Colony, Nizampet, Bachupally, Hyderabad, Medchal-Malkajgiri, Telangana – 500090, India ("OnlyTWAM", "we", "us" or "our") is managing and operating the mobile application/website <strong>www.onlytwam.com</strong> (collectively referred to as the "OnlyTWAM Platform") through which it facilitates the sale and purchase of women's intimate wear including bras, panties, sleepwear, activewear, shapewear and related products ("Products") to the users of the OnlyTWAM Platform ("User" or "Users" or "you" or "your").
          </p>
          <p style={paraStyle}>
            This Privacy Policy, together with the Terms &amp; Conditions, governs your use of the OnlyTWAM Platform and describes our policies and procedures on the collection, use, disclosure, processing, transfer, and storage of the information provided to us by you. By using, browsing, accessing, or purchasing from the OnlyTWAM Platform, you agree to the terms of this Privacy Policy and consent to the collection, storage, processing, handling, sharing, and disclosure of your information as described herein.
          </p>
          <p style={paraStyle}>
            This document is an electronic record governed by the Information Technology Act, 2000 and the rules thereunder, and does not require physical or digital signatures.
          </p>
          <p style={paraStyle}>
            This Privacy Policy sets out the type of information collected from Users, including Sensitive Personal Data or Information (as defined below), the purpose and manner of usage of such information, and how and to whom we shall disclose or transfer such information. You may at any time withdraw your consent for collection and use of your information. However, if you withdraw consent, we may not be able to provide you the services linked to such data.
          </p>
          <InfoBox>
            If you do not agree with any provisions of this Privacy Policy, please do not use or access the OnlyTWAM Platform.
          </InfoBox>
        </Section>

        <Section title="Type Of Information Collected">
          <p style={paraStyle}>You may be asked to provide information when you visit, access, or purchase from the OnlyTWAM Platform. This information may include:</p>
          <BulletList items={[
            "Name, age, gender, and date of birth",
            "Mailing/billing address",
            "Phone number",
            "Email address",
            "Login ID and password",
            "Preferences and communication settings"
          ]} />
          <p style={{ ...paraStyle, marginTop: "16px", fontWeight: 600, color: "#1a1a2e" }}>
            Sensitive Personal Data or Information (SPDI) as per Indian law may include:
          </p>
          <BulletList items={[
            "Passwords",
            "Financial information (credit/debit card details, UPI, bank account)",
            "Physical, physiological, and mental health condition (if voluntarily shared for fit/sizing)",
            "Any of the above provided to us for service provision"
          ]} />
          <InfoBox>
            OnlyTWAM is not directed towards minors. We do not knowingly collect information from anyone under 18 years of age. If it comes to our notice that information has been collected from a minor, we will delete it within a reasonable timeframe.
          </InfoBox>
        </Section>

        <Section title="Use Of Information">
          <p style={paraStyle}>We may use your Personal Information and SPDI for:</p>
          <BulletList items={[
            "Creating and giving access to your registered account",
            "Processing and completing orders, deliveries, and payments",
            "Customer support, exchanges, refunds, and dispute resolution",
            "Communication regarding orders, services, offers, updates, and events",
            "Internal analytics and research",
            "Compliance with legal and regulatory requirements",
            "Fraud detection and prevention"
          ]} />
        </Section>

        <Section title="Disclosure Of Information">
          <p style={paraStyle}>We may share your information with:</p>
          <BulletList items={[
            "Third-party service providers (delivery, payment gateways, IT support)",
            "Affiliates and business partners (for order fulfillment and promotions)",
            "Government authorities where required by law",
            "In case of mergers, acquisitions, or restructuring"
          ]} />
          <p style={paraStyle}>
            All financial transactions are routed securely through approved payment gateways. OnlyTWAM does not store sensitive financial details.
          </p>
        </Section>

        <Section title="Security">
          <p style={paraStyle}>
            We have implemented security measures including encryption, firewalls, and secure servers to protect your data.
          </p>
          <p style={paraStyle}>
            While we take all precautions, no system is completely secure. Users are advised to exercise caution when providing sensitive data online. We shall not be liable for breaches beyond our reasonable control.
          </p>
        </Section>

        <Section title="Cookies">
          <p style={paraStyle}>
            We use cookies and similar technologies to improve user experience, analyze usage, and personalize services.
          </p>
          <p style={paraStyle}>
            You may disable cookies in your browser, but this may impact some features of the Platform.
          </p>
        </Section>

        <Section title="Opt-Out">
          <p style={paraStyle}>
            Users may opt out of receiving promotional or marketing communications at any time by clicking "unsubscribe" in emails or contacting us at{" "}
            <a href="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Us
            </a>.
          </p>
        </Section>

        <Section title="Data Storage & Transfer">
          <p style={paraStyle}>
            All data will be stored and processed within India. We do not transfer user data outside India.
          </p>
        </Section>

        <Section title="User Rights">
          <p style={paraStyle}>
            You may review, update, or request deletion of your personal information by writing to us.
          </p>
        </Section>

        <Section title="Grievance Redressal">
          <p style={paraStyle}>In accordance with IT Rules, our Grievance Officer is:</p>
          <div style={{
            background: "#fff", border: "1px solid #e8e4dc", borderRadius: "10px",
            padding: "20px 24px", marginTop: "12px", borderLeft: "4px solid #0f3460"
          }}>
            {[
              ["Name", "Sandhya Prasad"],
              ["Designation", "Grievance Officer"],
              ["Contact", "/contact-us"]
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "16px", padding: "8px 0", borderBottom: "1px solid #f0ece4", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: "#0f3460", minWidth: "110px", fontSize: "14px" }}>{label}</span>
                <span style={{ color: "#444", fontSize: "14px" }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ ...paraStyle, marginTop: "14px" }}>
            Any concerns, complaints, or grievances relating to this Privacy Policy should be directed to the above contact.
          </p>
        </Section>

        <Section title="Governing Law & Jurisdiction">
          <p style={paraStyle}>
            This Privacy Policy shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the competent courts in Hyderabad, Telangana.
          </p>
        </Section>

        <Section title="Severability">
          <p style={paraStyle}>
            If any provision of this Privacy Policy is held invalid under applicable law, the remaining provisions shall remain in effect.
          </p>
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: "48px", padding: "20px 24px", background: "#fff",
          borderRadius: "10px", border: "1px solid #e8e4dc", textAlign: "center"
        }}>
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>
            For queries, contact us at{" "}
            <a href="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Us
            </a>{" "}
            
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
    <div style={{ marginBottom: "32px" }}>
      <h3 style={{
        fontSize: "17px", fontWeight: 700, color: "#1a1a2e",
        margin: "0 0 12px", paddingLeft: "12px",
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
      padding: "14px 18px", marginTop: "14px", color: "#2a3a6e", fontSize: "14px", lineHeight: "1.7"
    }}>
      ℹ️ {children}
    </div>
  );
}