// src/features/auth/pages/GuestSignup.tsx
// Redesigned with 3-step OTP flow:
//   Step 1 (contact)  — Enter name + email and/or phone
//                       Check if already registered
//                       Send OTP to chosen channel
//   Step 2 (otp)      — Verify OTP → get access token + account created
//   Step 3 (address)  — Fill address → place order
// If phone-only used: backend sends temp password via SMS automatically.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "@/shared/api/axiosInstance";
import { sendOtp, verifyOtpUniversal } from "@/features/auth/api/auth.api";

const TAX_RATE = 0.05;

const GuestCart = {
  get: (): any[] => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]");
    } catch {
      return [];
    }
  },
  clear: () => {
    localStorage.removeItem("guestCart");
    window.dispatchEvent(new Event("guestCartUpdated"));
  },
};

type Step = "contact" | "otp" | "address";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}
function isEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

export default function GuestSignup() {
  const navigate = useNavigate();

  // ── Step state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("contact");

  // Contact step
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);

  // OTP step
  const [sentChannel, setSentChannel] = useState<"email" | "phone">("email");
  const [showPicker, setShowPicker] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [resendSec, setResendSec] = useState(RESEND_SECONDS);
  const [otpLoading, setOtpLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Address step
  const [form, setForm] = useState({
    addressLine: "",
    locality: "",
    city: "",
    pinCode: "",
    stateId: "",
    countryId: "",
  });
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});

  // Derived
  const guestItems = GuestCart.get();
  const subTotal = guestItems.reduce(
    (s: number, i: any) =>
      s + (i.finalPrice || 0) * (i.processedQuantity || i.quantity || 1),
    0,
  );
  const taxAmount = Math.round(subTotal * TAX_RATE);
  const delivery = 99;
  const total = subTotal + taxAmount + delivery;
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  // Resend timer
  useEffect(() => {
    if (step !== "otp" || resendSec <= 0) return;
    const id = setInterval(() => setResendSec((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [step, resendSec]);

  useEffect(() => {
    if (step === "otp") inputRefs.current[0]?.focus();
  }, [step]);

  // Countries + States
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const res = await api.get("/Country", {
        params: {
          "Page.Size": 300,
          "Order.Property": "CountryName",
          "Order.Ascending": true,
        },
      });
      return res.data?.list ?? [];
    },
  });
  const { data: states = [] } = useQuery({
    queryKey: ["states", form.countryId],
    queryFn: async () => {
      if (!form.countryId) return [];
      const res = await api.get("/State", {
        params: {
          Filters: JSON.stringify([
            {
              property: "countryId",
              comparison: "eq",
              value: Number(form.countryId),
            },
          ]),
          "Page.Size": 100,
          "Order.Property": "StateName",
          "Order.Ascending": true,
        },
      });
      return res.data?.list ?? [];
    },
    enabled: !!form.countryId,
  });

  // ── Step 1: Contact validation & OTP dispatch ─────────────────────────────
  const validateContact = () => {
    const e: Record<string, string> = {};
    if (!contact.firstName.trim()) e.firstName = "First name is required";
    if (!contact.lastName.trim()) e.lastName = "Last name is required";
    if (!contact.email.trim() && !contact.phone.trim())
      e.email = "Email or phone number is required";
    if (contact.email.trim() && !isEmail(contact.email))
      e.email = "Invalid email address";
    if (contact.phone.trim() && !isPhone(contact.phone))
      e.phone = "10-digit number required";
    setContactErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContactNext = async () => {
    if (!validateContact()) return;
    setLoading(true);
    try {
      const hasEmail = !!contact.email.trim();
      const hasPhone = !!contact.phone.trim();

      // Send OTP — backend returns 409 if identifier already registered
      const sendParams = {
        email: hasEmail ? contact.email.trim() : undefined,
        phone: hasPhone ? contact.phone.trim() : undefined,
        purpose: "guest_checkout",
      };

      // If both given, show picker first
      if (hasEmail && hasPhone) {
        setShowPicker(true);
        setLoading(false);
        return;
      }

      // Only one given — send directly
      const channel: "email" | "phone" = hasEmail ? "email" : "phone";
      await sendOtp(sendParams);
      setSentChannel(channel);
      setResendSec(RESEND_SECONDS);
      setStep("otp");
      toast.success(
        `OTP sent to your ${channel === "email" ? "email" : "phone"}.`,
      );
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const msg = err.response.data?.message || "";
        toast.error(
          msg || "This contact is already registered. Please sign in.",
        );
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.error("Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickerChoice = async (channel: "email" | "phone") => {
    setShowPicker(false);
    setLoading(true);
    try {
      const sendParams = {
        email: channel === "email" ? contact.email.trim() : undefined,
        phone: channel === "phone" ? contact.phone.trim() : undefined,
        purpose: "guest_checkout",
      };
      await sendOtp(sendParams);
      setSentChannel(channel);
      setResendSec(RESEND_SECONDS);
      setStep("otp");
      toast.success(
        `OTP sent to your ${channel === "email" ? "email" : "phone"}.`,
      );
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("This contact is already registered. Please sign in.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.error("Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: OTP verification ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setOtpError("");
    if (char && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const n = [...digits];
        n[index] = "";
        setDigits(n);
      } else if (index > 0) inputRefs.current[index - 1]?.focus();
    }
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = useCallback(async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setOtpError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    setOtpLoading(true);
    try {
      const identifier =
        sentChannel === "email" ? contact.email.trim() : contact.phone.trim();
      const result = await verifyOtpUniversal({
        identifier,
        otp,
        purpose: "guest_checkout",
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email.trim() || undefined,
        phone: contact.phone.trim() || undefined,
      });

      if (result?.access_token) {
        // Store token so place-order call can use it
        localStorage.setItem("guest_token", result.access_token);
        toast.success("Identity verified! Please complete your address.");
        setStep("address");
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "";
      if (
        detail.toLowerCase().includes("invalid") ||
        detail.toLowerCase().includes("expired")
      ) {
        setOtpError("Invalid or expired OTP. Please try again or resend.");
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  }, [digits, sentChannel, contact]);

  useEffect(() => {
    if (step !== "otp") return;
    const onEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleVerifyOtp();
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [step, handleVerifyOtp]);

  const handleResendOtp = async () => {
    if (resendSec > 0) return;
    try {
      const sendParams = {
        email: sentChannel === "email" ? contact.email.trim() : undefined,
        phone: sentChannel === "phone" ? contact.phone.trim() : undefined,
        purpose: "guest_checkout",
      };
      await sendOtp(sendParams);
      toast.success(
        `OTP resent to your ${sentChannel === "email" ? "email" : "phone"}.`,
      );
      setResendSec(RESEND_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend OTP.");
    }
  };

  // ── Step 3: Address validation & order placement ─────────────────────────
  const validateAddress = () => {
    const e: Record<string, string> = {};
    if (!form.addressLine.trim()) e.addressLine = "Address is required";
    if (!form.countryId) e.countryId = "Country is required";
    if (!form.stateId) e.stateId = "State is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.pinCode.trim()) e.pinCode = "Pincode is required";
    setAddrErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (whatsapp: boolean) => {
      const guestToken = localStorage.getItem("guest_token");
      const payload = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || undefined,
        phoneNumber: contact.phone || undefined,
        addressLine: form.addressLine,
        locality: form.locality,
        city: form.city,
        stateId: Number(form.stateId) || undefined,
        countryId: Number(form.countryId) || undefined,
        pinCode: form.pinCode,
        subTotal,
        taxAmount,
        deliveryCharge: delivery,
        totalAmount: total,
        isWhatsappNotification: whatsapp,
        orderItems: guestItems.map((i: any) => ({
          productId: i.productId,
          productVariantId: i.productVariantId,
          productVariantDetailId: i.productVariantDetailId,
          quantity: i.processedQuantity || i.quantity || 1,
          price: i.finalPrice,
        })),
      };
      // Use guest token if available (authenticated guest), else fall back to GuestOrder endpoint
      const headers = guestToken
        ? { Authorization: `Bearer ${guestToken}` }
        : {};
      const endpoint = guestToken ? "/Orders/PlaceOrder" : "/Orders/GuestOrder";
      const res = await api.post(endpoint, payload, { headers });
      return res.data;
    },
    onSuccess: (data: any) => {
      GuestCart.clear();
      localStorage.removeItem("guest_token");
      toast.success("Order placed successfully! 🎉");
      navigate(`/user-products/order-confirm/${data?.orderId ?? "new"}`);
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.detail ||
          "Failed to place order",
      );
    },
  });

  const handleAddressSubmit = () => {
    if (!validateAddress()) {
      toast.error("Please correct the errors.");
      return;
    }
    setShowWhatsapp(true);
  };

  const confirmOrder = (whatsapp: boolean) => {
    setShowWhatsapp(false);
    placeOrderMutation.mutate(whatsapp);
  };

  const channelDisplay =
    sentChannel === "phone" ? contact.phone : contact.email;
  const channelIcon = sentChannel === "phone" ? "bi-phone" : "bi-envelope";

  const errEl = (key: string, bag: Record<string, string>) =>
    bag[key] ? <span className="s-guestsignup-fcc3ca">{bag[key]}</span> : null;

  // ── Step indicators ───────────────────────────────────────────────────────
  const steps = ["Contact & OTP", "Verify OTP", "Address & Order"];
  const stepIdx = step === "contact" ? 0 : step === "otp" ? 1 : 2;

  return (
    <div className="container s-guestsignup-f06052">
      {/* Progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 32,
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                background:
                  i < stepIdx
                    ? "var(--heirloom)"
                    : i === stepIdx
                      ? "var(--brand)"
                      : "var(--ivory)",
                color: i <= stepIdx ? "#fff" : "var(--heirloom)",
                border: `2px solid ${i <= stepIdx ? "transparent" : "var(--ivory)"}`,
              }}
            >
              {i < stepIdx ? <i className="bi bi-check" /> : i + 1}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: i === stepIdx ? 600 : 400,
                color: i === stepIdx ? "var(--brand)" : "var(--heirloom)",
              }}
            >
              {s}
            </span>
            {i < 2 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: i < stepIdx ? "var(--heirloom)" : "var(--ivory)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Contact ─────────────────────────────────────────────────── */}
      {step === "contact" && (
        <div className="row g-4">
          <div className="col-lg-8">
            <h5 className="s-guestsignup-194917">
              Guest Checkout — Your Details
            </h5>
            <div className="s-guestsignup-735701">
              {/* Name */}
              <div className="s-guestsignup-c4282d">
                {(
                  [
                    { key: "firstName", ph: "First Name *" },
                    { key: "lastName", ph: "Last Name *" },
                  ] as const
                ).map(({ key, ph }) => (
                  <div key={key}>
                    <input
                      placeholder={ph}
                      className="inp-field"
                      style={{
                        border: `1px solid ${contactErrors[key] ? "var(--brand)" : "var(--ivory)"}`,
                      }}
                      value={contact[key]}
                      onChange={(e) =>
                        setContact((c) => ({ ...c, [key]: e.target.value }))
                      }
                    />
                    {errEl(key, contactErrors)}
                  </div>
                ))}
              </div>

              {/* Contact hint */}
              <p
                style={{
                  fontSize: 13,
                  color: "var(--heirloom)",
                  margin: "4px 0 8px",
                }}
              >
                Enter your email, phone number, or both. At least one is
                required.
              </p>

              <div className="s-guestsignup-c4282d">
                <div>
                  <input
                    placeholder="Email (optional if phone given)"
                    type="email"
                    className="inp-field"
                    style={{
                      border: `1px solid ${contactErrors.email ? "var(--brand)" : "var(--ivory)"}`,
                    }}
                    value={contact.email}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                  {errEl("email", contactErrors)}
                </div>
                <div>
                  <input
                    placeholder="Phone (optional if email given)"
                    type="tel"
                    className="inp-field"
                    style={{
                      border: `1px solid ${contactErrors.phone ? "var(--brand)" : "var(--ivory)"}`,
                    }}
                    maxLength={10}
                    value={contact.phone}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, phone: e.target.value }))
                    }
                  />
                  {errEl("phone", contactErrors)}
                </div>
              </div>

              {contact.phone && !contact.email && (
                <div
                  style={{
                    background: "#e8f5e9",
                    border: "1px solid #a5d6a7",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 8,
                    fontSize: 13,
                  }}
                >
                  <i
                    className="bi bi-info-circle me-2"
                    style={{ color: "#2e7d32" }}
                  />
                  Since you're using phone only, your temporary login password
                  will be sent via SMS after checkout.
                </div>
              )}
            </div>
          </div>

          {/* Order summary */}
          <div className="col-lg-4">
            <div className="s-guestsignup-7e0b46">
              <h6 className="s-guestsignup-52aebe">Order Summary</h6>
              {[
                {
                  label: `Price (${guestItems.length} items)`,
                  value: `₹${subTotal.toLocaleString("en-IN")}`,
                },
                { label: "Delivery Charges", value: `₹${delivery}` },
              ].map(({ label, value }) => (
                <div key={label} className="s-guestsignup-b9d6bf">
                  <span className="s-adminbrands-95b451">{label}</span>
                  <span className="s-adminorders-0728c5">{value}</span>
                </div>
              ))}
              <hr className="s-guestsignup-05c54b" />
              <div className="s-guestsignup-6c45ad">
                <span>Total Amount</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <button
                onClick={handleContactNext}
                disabled={loading}
                className="s-guestsignup-cca6e0"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Sending OTP…" : "Continue →"}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="s-guestsignup-4b8e02"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1b: Channel picker (shown when both email + phone given) ─────── */}
      {step === "contact" && showPicker && (
        <div className="s-guestsignup-15a445">
          <div className="s-guestsignup-b3ccb6">
            <h5 className="s-guestsignup-9590c2">
              Where should we send the OTP?
            </h5>
            <p className="s-guestsignup-e9a4ea">
              You provided both email and phone. Choose how to receive your
              verification code.
            </p>
            <div className="s-addressform-be0342">
              <button
                onClick={() => handlePickerChoice("email")}
                className="s-guestsignup-979ae0"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <i className="bi bi-envelope-fill" /> Email
                <br />
                <small style={{ fontWeight: 400, opacity: 0.8 }}>
                  {contact.email}
                </small>
              </button>
              <button
                onClick={() => handlePickerChoice("phone")}
                className="s-guestsignup-ddaad3"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <i className="bi bi-phone-fill" /> SMS (Phone)
                <br />
                <small style={{ fontWeight: 400, opacity: 0.8 }}>
                  {contact.phone}
                </small>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: OTP ──────────────────────────────────────────────────────── */}
      {step === "otp" && (
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div
              className="s-guestsignup-7e0b46"
              style={{ textAlign: "center" }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                <i
                  className={`bi ${channelIcon}`}
                  style={{ color: "var(--brand)" }}
                />
              </div>
              <h5 className="s-guestsignup-52aebe">Enter Verification Code</h5>
              <p
                style={{
                  color: "var(--heirloom)",
                  fontSize: 14,
                  marginBottom: 20,
                }}
              >
                We sent a {OTP_LENGTH}-digit code to your{" "}
                {sentChannel === "phone" ? "phone" : "email"}
                <br />
                <strong>{channelDisplay}</strong>
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  margin: "16px 0",
                }}
                onPaste={handleOtpPaste}
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: 48,
                      height: 56,
                      border: `2px solid ${otpError ? "var(--brand)" : digit ? "var(--brand)" : "var(--ivory)"}`,
                      borderRadius: 8,
                      fontSize: 22,
                      fontWeight: 700,
                      textAlign: "center",
                      outline: "none",
                      background: "var(--ivory)",
                      color: "#000",
                    }}
                  />
                ))}
              </div>

              {otpError && (
                <p
                  style={{
                    color: "var(--brand)",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  <i className="bi bi-exclamation-circle me-1" />
                  {otpError}
                </p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={otpLoading}
                className="s-guestsignup-cca6e0"
                style={{ opacity: otpLoading ? 0.7 : 1 }}
              >
                {otpLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Verifying…
                  </>
                ) : (
                  "Verify OTP"
                )}
              </button>

              <p
                style={{
                  fontSize: 13,
                  marginTop: 16,
                  color: "var(--heirloom)",
                }}
              >
                Didn't receive the code?{" "}
                {resendSec > 0 ? (
                  <span>Resend in {resendSec}s</span>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    style={{
                      color: "var(--brand)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Resend OTP
                  </button>
                )}
              </p>

              <button
                onClick={() => setStep("contact")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--heirloom)",
                  cursor: "pointer",
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Address ───────────────────────────────────────────────────── */}
      {step === "address" && (
        <div className="row g-4">
          <div className="col-lg-8">
            <h5 className="s-guestsignup-194917">Delivery Address</h5>
            <div className="s-guestsignup-735701">
              <div className="s-updateprofil-246fef">
                <textarea
                  placeholder="Address (House No, Building, Street, Area)*"
                  className="inp-field s-guestsignup-8ea872"
                  style={{
                    border: `1px solid ${addrErrors.addressLine ? "var(--brand)" : "var(--ivory)"}`,
                  }}
                  value={form.addressLine}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressLine: e.target.value }))
                  }
                />
                {errEl("addressLine", addrErrors)}
              </div>
              <div className="s-guestsignup-c4282d">
                <div>
                  <select
                    className="inp-field"
                    style={{
                      border: `1px solid ${addrErrors.countryId ? "var(--brand)" : "var(--ivory)"}`,
                    }}
                    value={form.countryId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        countryId: e.target.value,
                        stateId: "",
                      }))
                    }
                  >
                    <option value="">Country*</option>
                    {(countries as any[]).map((c: any) => (
                      <option key={c.countryId} value={c.countryId}>
                        {c.countryName}
                      </option>
                    ))}
                  </select>
                  {errEl("countryId", addrErrors)}
                </div>
                <div>
                  <select
                    className="inp-field"
                    style={{
                      border: `1px solid ${addrErrors.stateId ? "var(--brand)" : "var(--ivory)"}`,
                    }}
                    value={form.stateId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stateId: e.target.value }))
                    }
                  >
                    <option value="">State*</option>
                    {(states as any[]).map((s: any) => (
                      <option key={s.stateId} value={s.stateId}>
                        {s.stateName}
                      </option>
                    ))}
                  </select>
                  {errEl("stateId", addrErrors)}
                </div>
                <div>
                  <input
                    placeholder="Locality / Town"
                    className="inp-field"
                    value={form.locality}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, locality: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="s-guestsignup-0891e3">
                {(
                  [
                    { key: "city", ph: "City*" },
                    { key: "pinCode", ph: "Pincode*" },
                  ] as const
                ).map(({ key, ph }) => (
                  <div key={key}>
                    <input
                      placeholder={ph}
                      className="inp-field"
                      style={{
                        border: `1px solid ${addrErrors[key] ? "var(--brand)" : "var(--ivory)"}`,
                      }}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                    {errEl(key, addrErrors)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="s-guestsignup-7e0b46">
              <h6 className="s-guestsignup-52aebe">Order Summary</h6>
              {[
                {
                  label: `Price (${guestItems.length} items)`,
                  value: `₹${subTotal.toLocaleString("en-IN")}`,
                },
                { label: "Delivery Charges", value: `₹${delivery}` },
              ].map(({ label, value }) => (
                <div key={label} className="s-guestsignup-b9d6bf">
                  <span className="s-adminbrands-95b451">{label}</span>
                  <span className="s-adminorders-0728c5">{value}</span>
                </div>
              ))}
              <hr className="s-guestsignup-05c54b" />
              <div className="s-guestsignup-6c45ad">
                <span>Total Amount</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <button
                onClick={handleAddressSubmit}
                disabled={placeOrderMutation.isPending}
                className="s-guestsignup-cca6e0"
                style={{ opacity: placeOrderMutation.isPending ? 0.7 : 1 }}
              >
                {placeOrderMutation.isPending
                  ? "Placing Order…"
                  : "Place Order"}
              </button>
              <button
                onClick={() => setStep("otp")}
                className="s-guestsignup-4b8e02"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp popup */}
      {showWhatsapp && (
        <div className="s-guestsignup-15a445">
          <div className="s-guestsignup-b3ccb6">
            <h5 className="s-guestsignup-9590c2">
              Receive order updates on WhatsApp?
            </h5>
            <p className="s-guestsignup-e9a4ea">
              We'll send you notifications about your order status, shipping
              updates, and delivery details.
            </p>
            <div className="s-addressform-be0342">
              <button
                onClick={() => confirmOrder(false)}
                className="s-guestsignup-979ae0"
              >
                No Thanks
              </button>
              <button
                onClick={() => confirmOrder(true)}
                className="s-guestsignup-ddaad3"
              >
                <i className="bi bi-whatsapp me-2" />
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
