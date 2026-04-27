import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function HelpCenter() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const helpTopics = [
    {
      emoji: "💳",
      title: "Payment & Billings",
      desc: "Payment methods, invoices, refunds",
      link: "/help/payment"
    },
    {
      emoji: "📦",
      title: "Orders & Shipping",
      desc: "Track orders, shipping info, returns",
      link: "/help/orders"
    },
    {
      emoji: "👤",
      title: "Account Help",
      desc: "Login issues, profile settings",
      link: "/help/account"
    },
    {
      emoji: "🛍️",
      title: "Products & Services",
      desc: "Product information, Specifications, guides",
      link: "/help/products"
    },
  ];

  const quickLinks = [
    {
      emoji: "📍",
      title: "Track Your Order",
      desc: "View live status of your placed orders in one click.",
      link: "/my-orders"
    },
    {
      emoji: "🔄",
      title: "Return Policy",
      desc: "Initiate a return or exchange with ease.",
      link: "/return-refund-policy"
    },
    {
      emoji: "🔐",
      title: "Account Security",
      desc: "Update your details and secure your TWAM account.",
      link: "/account"
    },
    {
      emoji: "💰",
      title: "Payment Method",
      desc: "All you need to know about payments and checkout flow.",
      link: "/help/payment"
    },
  ];

  const faqs = [
    {
      q: "How do I track my order?",
      a: "Go to My Orders in your account to see real-time tracking updates. Once your order is shipped, you will also receive an SMS and email with your tracking number."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit/debit cards, UPI, net banking, and popular wallets. All transactions are processed securely through approved payment gateways."
    },
    {
      q: "How can I change my password?",
      a: "Go to My Account → Profile Settings → Change Password. Enter your current password and set a new one. If you've forgotten your password, use the 'Forgot Password' option on the login page."
    },
    {
      q: "What is your return policy?",
      a: "Bras may be exchanged within 7 days of delivery if unused and tags intact. Panties are not eligible for return or exchange for hygiene reasons. Refunds are issued only for defective, damaged, or wrong items delivered."
    },
    {
      q: "How long does delivery take?",
      a: "Standard delivery takes 5–10 business days. Express options are available at checkout. Free shipping applies on all orders above ₹5,000."
    },
    {
      q: "Can I exchange a product?",
      a: "Yes! Visit My Orders, select the order, and initiate an exchange. Bras are eligible for exchange within 7 days if unused and in original packaging."
    },
  ];

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
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "0 0 10px", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "sans-serif", position: "relative" }}>
          TWAM Support
        </p>
        <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.5px", position: "relative" }}>
          Help Center
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", margin: "0 0 28px", fontStyle: "italic", position: "relative" }}>
          Browse through our help topics
        </p>
      </div>

      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Help Topics Grid */}
        <div style={{ marginBottom: "48px" }}>
          <SectionHeading title="Browse Help Topics" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {helpTopics.map((topic) => (
              <Link
                key={topic.title}
                to={topic.link}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  background: "#fff", border: "1px solid #e8e4dc", borderRadius: "12px",
                  padding: "24px 20px", textAlign: "center", cursor: "pointer",
                  transition: "box-shadow 0.2s",
                  height: "100%", boxSizing: "border-box"
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(15,52,96,0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>{topic.emoji}</div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#1a1a2e", fontFamily: "sans-serif" }}>
                    {topic.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#888", lineHeight: "1.5", fontFamily: "sans-serif" }}>
                    {topic.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ marginBottom: "48px" }}>
          <SectionHeading title="Quick Links" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                to={item.link}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  background: "#fff", border: "1px solid #e8e4dc", borderRadius: "12px",
                  padding: "20px", cursor: "pointer",
                  borderLeft: "4px solid #0f3460",
                  transition: "box-shadow 0.2s",
                  height: "100%", boxSizing: "border-box"
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(15,52,96,0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ fontSize: "28px", marginBottom: "10px" }}>{item.emoji}</div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#1a1a2e", fontFamily: "sans-serif" }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#777", lineHeight: "1.5", fontFamily: "sans-serif" }}>
                    {item.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Need More Help + Business Hours */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "48px" }}>

          {/* Need More Help */}
          <div style={{
            background: "linear-gradient(135deg, #6A012A 0%, #8B0136 50%, #6A012A 100%)",
            borderRadius: "14px", padding: "32px 28px", color: "#fff"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "14px" }}>🎧</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700 }}>Need More Help?</h3>
            <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: "1.6", fontFamily: "sans-serif" }}>
              Our support team is available 24/7 to assist you.
            </p>
            <Link to="/contact-us" style={{
              display: "inline-block", background: "#fff", color: "#1a1a2e",
              padding: "10px 22px", borderRadius: "6px", textDecoration: "none",
              fontWeight: 700, fontSize: "13px", fontFamily: "sans-serif"
            }}>
              Contact Support →
            </Link>
          </div>

          {/* Business Hours */}
          <div style={{
            background: "#fff", border: "1px solid #e8e4dc",
            borderRadius: "14px", padding: "32px 28px"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "14px" }}>🕐</div>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#1a1a2e" }}>
              Business Hours
            </h3>
            {[
              { day: "Monday – Friday", hours: "09:00 AM – 08:00 PM" },
              { day: "Saturday", hours: "10:00 AM – 06:00 PM" },
              { day: "Sunday", hours: "Closed", closed: true },
            ].map((row) => (
              <div key={row.day} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid #f0ece4",
                fontFamily: "sans-serif"
              }}>
                <span style={{ fontSize: "13px", color: "#555" }}>{row.day}</span>
                <span style={{
                  fontSize: "13px", fontWeight: 600,
                  color: row.closed ? "#c0392b" : "#0f3460"
                }}>{row.hours}</span>
              </div>
            ))}
            <p style={{ margin: "14px 0 0", fontSize: "12px", color: "#aaa", fontFamily: "sans-serif" }}>
              📧 customersupport@onlytwam.com
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: "40px" }}>
          <SectionHeading title="Frequently Asked Questions" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: "#fff", border: "1px solid #e8e4dc",
                  borderRadius: "10px", overflow: "hidden"
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "18px 20px",
                    background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", gap: "12px"
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "15px", color: "#1a1a2e", fontFamily: "sans-serif" }}>
                    {faq.q}
                  </span>
                  <span style={{
                    flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%",
                    background: openFaq === i ? "#1a1a2e" : "#f0f4ff",
                    color: openFaq === i ? "#fff" : "#0f3460",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", fontWeight: 700, transition: "all 0.2s"
                  }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 20px 18px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#666", lineHeight: "1.75", fontFamily: "sans-serif" }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: "40px", padding: "20px 24px", background: "#fff",
          borderRadius: "10px", border: "1px solid #e8e4dc", textAlign: "center"
        }}>
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>
            Still need help?{" "}
            <Link to="/contact-us" style={{ color: "#0f3460", textDecoration: "none", fontWeight: 600 }}>
              Contact Us
            </Link>
            {" "}or email{" "}
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

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 style={{
      fontSize: "17px", fontWeight: 700, color: "#1a1a2e",
      margin: "0 0 16px", paddingLeft: "12px",
      borderLeft: "3px solid #0f3460"
    }}>{title}</h3>
  );
}