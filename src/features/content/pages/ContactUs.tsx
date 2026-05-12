import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/features/auth/store/authStore";

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
  const fileRef = useRef<HTMLInputElement>(null);

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
        "Your message has been sent! Our support team will get back to you shortly."
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

  return (
    <div>
      {/* Hero banner */}
      <img
        src="/assets/images/contact-hero.jpg"
        alt="Contact Us"
        style={{ width: "100%", display: "block" }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      <div
        style={{
          maxWidth: 600,
          margin: "48px auto",
          padding: "0 20px 60px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading, serif)",
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--heirloom, #1a1a2e)",
          }}
        >
          Contact Us
        </h2>
        <p style={{ color: "#666", marginBottom: 32, fontSize: 15 }}>
          Have a question or need help with your order? Send us a message and
          our support team will respond promptly.
        </p>

        {/* ── Not logged in ─────────────────────────────────────────────── */}
        {!isAuthenticated ? (
          <div
            style={{
              background: "#fff9f5",
              border: "1.5px solid #f0d9c8",
              borderRadius: 12,
              padding: "40px 32px",
              textAlign: "center",
            }}
          >
            <i
              className="bi bi-lock"
              style={{
                fontSize: 40,
                color: "var(--brand, #6a012a)",
                marginBottom: 16,
                display: "block",
              }}
            />
            <h4
              style={{
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--heirloom, #1a1a2e)",
              }}
            >
              Login required
            </h4>
            <p style={{ color: "#777", marginBottom: 24, fontSize: 14 }}>
              Please log in to send us a message. This helps us identify your
              account and resolve your query faster.
            </p>
            <Link
              to="/login"
              style={{
                background: "var(--brand, #6a012a)",
                color: "#fff",
                padding: "11px 32px",
                borderRadius: 6,
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Log In to Continue
            </Link>
          </div>
        ) : (
          /* ── Logged in: message form ──────────────────────────────────── */
          <div
            style={{
              background: "#fff",
              border: "1.5px solid #e8e0d8",
              borderRadius: 12,
              padding: "32px",
              boxShadow: "0 2px 16px rgba(0,0,0,.06)",
            }}
          >
            {/* Message */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 14,
                  color: "var(--heirloom, #1a1a2e)",
                }}
              >
                Your Message <span style={{ color: "red" }}>*</span>
              </label>
              <textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your query, issue, or question in detail…"
                style={{
                  width: "100%",
                  border: "1.5px solid #d4c5b5",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  color: "#222",
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* File attachment */}
            <div style={{ marginBottom: 28 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 14,
                  color: "var(--heirloom, #1a1a2e)",
                }}
              >
                Attachment{" "}
                <span style={{ fontWeight: 400, color: "#888" }}>
                  (optional – image or PDF)
                </span>
              </label>
              <div
                style={{
                  border: "1.5px dashed #c5b4a4",
                  borderRadius: 8,
                  padding: "18px 20px",
                  cursor: "pointer",
                  background: "#faf8f6",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <i
                  className="bi bi-paperclip"
                  style={{ fontSize: 20, color: "#888" }}
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: file ? "var(--brand,#6a012a)" : "#666",
                      fontWeight: file ? 600 : 400,
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

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending || uploading}
              style={{
                width: "100%",
                padding: "13px",
                background:
                  mutation.isPending || uploading
                    ? "#c5a9b4"
                    : "var(--brand, #6a012a)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                cursor:
                  mutation.isPending || uploading ? "not-allowed" : "pointer",
                letterSpacing: 0.3,
                transition: "background .2s",
              }}
            >
              {uploading
                ? "Uploading file…"
                : mutation.isPending
                  ? "Sending…"
                  : "Send Message"}
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
      </div>
    </div>
  );
}
