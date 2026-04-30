import { useState } from "react";

const faqs = [
  {
    question: "How do I track my order?",
    answer:
      "Go to My Orders in your account to see real-time tracking updates.",
  },
  {
    question: "What is your return policy?",
    answer:
      "We accept returns within 7 days of delivery for unused, unwashed items with tags intact. Visit our Return & Refund Policy page for details.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Standard delivery takes 4–7 business days. Express options may be available at checkout.",
  },
  {
    question: "How do I find my correct size?",
    answer:
      "Use our Size Guide and Fit Finder tool to determine your perfect size. Our customer care team is also happy to help.",
  },
  {
    question: "Can I exchange a product?",
    answer:
      "Yes! Visit your order and initiate a return with the Exchange option selected.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit/debit cards, UPI, net banking, and select wallets at checkout.",
  },
  {
    question: "How can I change my password?",
    answer:
      "Go to My Account → Profile and select Change Password. You'll receive an OTP on your registered email or phone to confirm.",
  },
];

export default function HelpCenter() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="hc-page">
      {/* Hero banner */}
      <div className="hc-hero">
        <h2 className="hc-hero-title">Help Center</h2>
      </div>

      {/* FAQ section */}
      <div className="hc-content">
        <h3 className="hc-faq-heading">Frequently Asked Questions</h3>

        <div className="hc-faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className="hc-faq-item">
              <button
                className="hc-faq-trigger"
                onClick={() => toggle(i)}
                aria-expanded={openIndex === i}
              >
                <span className="hc-faq-question">{faq.question}</span>
                <span
                  className={`hc-faq-arrow ${openIndex === i ? "open" : ""}`}
                >
                  ›
                </span>
              </button>
              {openIndex === i && (
                <div className="hc-faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="hc-contact-cta">
          <p className="hc-contact-text">
            For more queries,{" "}
            <a href="/contact-us" className="hc-contact-link">
              contact our customer support
            </a>{" "}
            — we're here Mon–Sat, 9 AM–6 PM IST.
          </p>
        </div>
      </div>
    </div>
  );
}
