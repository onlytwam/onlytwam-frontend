import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/features/auth/store/authStore";

const faqs = [
  {
    question: "How do I track my order?",
    answer:
      "Log in to your account and open My Orders to view the latest courier tracking updates.",
  },
  {
    question: "What is your return policy?",
    answer:
      "Eligible returns can be initiated within 7 days of delivery for unused, unwashed items with tags intact. Please review our Return & Refund Policy for full details.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Standard delivery typically takes 4-7 business days. Express options may be available at checkout, depending on your location.",
  },
  {
    question: "How do I find my correct size?",
    answer:
      "Use our Size Guide and Fit Finder to find your best fit. Our support team is also available if you need further assistance.",
  },
  {
    question: "Can I exchange a product?",
    answer:
      "Yes. Open the relevant order in My Orders and choose the Exchange option to begin the process.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept major credit and debit cards, UPI, net banking, and select wallets at checkout.",
  },
  {
    question: "How can I change my password?",
    answer:
      "Go to My Account > Profile and select Change Password. You will receive a verification OTP on your registered email or phone.",
  },
];

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/FileUpload/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.url ?? res.data?.fileUrl ?? "";
}

export default function ContactUs() {
  const { isAuthenticated } = useAuthStore();
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.dispatchEvent(new Event("page-content-ready"));
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl: string | undefined;
      if (file) {
        setUploading(true);
        try {
          attachmentUrl = await uploadFile(file);
        } finally {
          setUploading(false);
        }
      }
      return api.post("/UserQuery", { message, attachmentUrl });
    },
    onSuccess: () => {
      toast.success(
        "Your message has been sent! Our support team will get back to you shortly.",
      );
      setMessage("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: () => toast.error("Failed to send. Please try again."),
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast.error("Please enter a message before submitting.");
      return;
    }
    mutation.mutate();
  };

  const revealForm = () => {
    setShowContactForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <section
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, #7f1537 100%)",
          color: "#fff",
          padding: "68px 24px 56px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.82,
              fontWeight: 700,
            }}
          >
            Customer Care
          </p>
          <h1
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(30px, 5vw, 48px)",
              lineHeight: 1.1,
            }}
          >
            We're Here to Help
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
            Browse quick answers about orders, delivery, returns, sizing, and
            payments. For anything else, our support team is here to help.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 84px" }}>
        <div style={{ marginBottom: 18 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-heading)",
              fontSize: 24,
              color: "var(--brand)",
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ margin: "8px 0 0", color: "#5f5550", lineHeight: 1.75 }}>
            Quick answers to the most common questions about shopping with TWAM.
          </p>
        </div>

        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <article
                key={faq.question}
                style={{
                  background: "var(--brand-light)",
                  border: "1px solid rgba(107,15,42,0.12)",
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
                  alignSelf: "start",
                  height: "fit-content",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  style={{
                    width: "100%",
                    padding: "18px 20px",
                    border: "none",
                    background: open ? "var(--brand-soft)" : "var(--brand-light)",
                    color: "var(--brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>
                    {faq.question}
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      transform: open ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      color: "var(--heirloom)",
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </span>
                </button>
                {open && (
                  <div
                    style={{
                      padding: "0 20px 18px",
                      color: "#5f5550",
                      lineHeight: 1.75,
                      fontSize: 15,
                    }}
                  >
                    {faq.answer}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
            color: "#5f5550",
            fontSize: 15,
            lineHeight: 1.8,
          }}
        >
          <span>Have more queries? Please contact our customer support team.</span>
          <button
            type="button"
            onClick={revealForm}
            style={{
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              padding: "12px 22px",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              boxShadow: "0 10px 18px rgba(107,15,42,0.18)",
              flexShrink: 0,
            }}
          >
            Customer Support
          </button>
        </div>

        <div
          ref={formRef}
          style={{
            marginTop: 28,
            display: showContactForm ? "block" : "none",
            transition: "all 0.25s ease",
          }}
        >
          <section
            style={{
              background: "#fff",
              border: "1px solid rgba(107,15,42,0.12)",
              borderRadius: 18,
              padding: 28,
              boxShadow: "0 10px 30px rgba(107,15,42,0.06)",
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 28,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  color: "var(--brand)",
                }}
              >
                Contact Us
              </h2>
              <p style={{ color: "#666", margin: 0, fontSize: 15, lineHeight: 1.75 }}>
                Use the form below for order support, account assistance, or
                product-related queries. Our team will respond as soon as
                possible.
              </p>
            </div>

            {!isAuthenticated ? (
              <div
                style={{
                  background: "#fff9f5",
                  border: "1.5px solid #f0d9c8",
                  borderRadius: 14,
                  padding: "38px 30px",
                  textAlign: "center",
                }}
              >
                <i
                  className="bi bi-lock"
                  style={{
                    fontSize: 40,
                    color: "var(--brand)",
                    marginBottom: 16,
                    display: "block",
                  }}
                />
                <h3
                  style={{
                    fontWeight: 700,
                    margin: "0 0 10px",
                    color: "var(--heirloom)",
                    fontSize: 20,
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Login required
                </h3>
                <p style={{ color: "#777", margin: "0 0 24px", fontSize: 14, lineHeight: 1.7 }}>
                  Please log in to submit a request linked to your account so
                  we can assist you more efficiently.
                </p>
                <Link
                  to="/login"
                  style={{
                    background: "var(--brand)",
                    color: "#fff",
                    padding: "11px 32px",
                    borderRadius: 10,
                    fontWeight: 700,
                    textDecoration: "none",
                    fontSize: 15,
                    display: "inline-block",
                  }}
                >
                  Log In to Continue
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 700,
                      marginBottom: 8,
                      fontSize: 14,
                      color: "var(--heirloom)",
                    }}
                  >
                    Your Message <span style={{ color: "var(--brand)" }}>*</span>
                  </label>
                  <textarea
                    rows={7}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your query, issue, or question in detail..."
                    style={{
                      width: "100%",
                      border: "1.5px solid rgba(107,15,42,0.18)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 14,
                      resize: "vertical",
                      fontFamily: "var(--font-body)",
                      outline: "none",
                      boxSizing: "border-box",
                      color: "#222",
                      lineHeight: 1.6,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 26 }}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 700,
                      marginBottom: 8,
                      fontSize: 14,
                      color: "var(--heirloom)",
                    }}
                  >
                    Attachment{" "}
                    <span style={{ fontWeight: 400, color: "#888" }}>
                      (optional - image or PDF)
                    </span>
                  </label>
                  <div
                    style={{
                      border: "1.5px dashed rgba(107,15,42,0.28)",
                      borderRadius: 12,
                      padding: "18px 20px",
                      cursor: "pointer",
                      background: "var(--brand-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <i
                      className="bi bi-paperclip"
                      style={{ fontSize: 20, color: "var(--heirloom)" }}
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: file ? "var(--brand)" : "#666",
                          fontWeight: file ? 700 : 400,
                        }}
                      >
                        {file ? file.name : "Click to attach a file"}
                      </p>
                      {file && (
                        <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      )}
                    </div>
                    {file && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#999",
                          fontSize: 18,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={mutation.isPending || uploading}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background:
                      mutation.isPending || uploading
                        ? "color-mix(in srgb, var(--brand) 45%, #fff)"
                        : "var(--brand)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor:
                      mutation.isPending || uploading
                        ? "not-allowed"
                        : "pointer",
                    letterSpacing: 0.3,
                    transition: "background .2s",
                  }}
                >
                  {uploading ? "Uploading file..." : mutation.isPending ? "Sending..." : "Send Message"}
                </button>

                <p
                  style={{
                    marginTop: 14,
                    fontSize: 12,
                    color: "#999",
                    textAlign: "center",
                  }}
                >
                  We typically respond within 24 hours on business days.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
