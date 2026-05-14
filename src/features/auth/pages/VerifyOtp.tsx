import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { sendForgotPasswordOtpToChannel } from "@/features/auth/api/auth.api";
import AuthBackdrop from "@/features/auth/components/AuthBackdrop";
import { usePageImage, IMAGE_KEYS } from "@/features/images";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function channelLabel(channel: string) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "sms") return "SMS";
  return "Email";
}
function channelIcon(channel: string) {
  if (channel === "whatsapp") return "bi-whatsapp";
  if (channel === "sms") return "bi-chat-dots-fill";
  return "bi-envelope-fill";
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const bgImage = usePageImage(IMAGE_KEYS.LOGIN_BACKGROUND);

  const identifier = searchParams.get("identifier") || "";
  const channel = (searchParams.get("channel") || "email") as "email" | "sms" | "whatsapp";
  const display = searchParams.get("display") || identifier;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(OTP_LENGTH).fill(null));
  const [otpError, setOtpError] = useState("");
  const [resendCd, setResendCd] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCd <= 0) return;
    const t = setTimeout(() => setResendCd((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCd]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!identifier) {
      toast.error("Session expired. Please start again.");
      navigate("/login", { replace: true });
    }
  }, [identifier, navigate]);

  const handleDigitChange = (idx: number, val: string) => {
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      setOtpError("");
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setOtpError("");
    if (val && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft" && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleContinue = useCallback(() => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setOtpError("Please enter the complete 6-digit OTP.");
      inputRefs.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }

    navigate(
      `/reset-password?identifier=${encodeURIComponent(identifier)}&otp=${encodeURIComponent(otp)}&channel=${encodeURIComponent(channel)}&display=${encodeURIComponent(display)}`,
      { replace: true },
    );
  }, [digits, identifier, channel, display, navigate]);

  const handleLastKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleContinue();
    handleKeyDown(OTP_LENGTH - 1, e);
  };

  const handleResend = async () => {
    if (resendCd > 0 || resending || !identifier) return;
    setResending(true);
    setOtpError("");
    setDigits(Array(OTP_LENGTH).fill(""));
    try {
      await sendForgotPasswordOtpToChannel(identifier, channel);
      toast.success(`OTP resent to ${display || channelLabel(channel)}.`);
      setResendCd(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const otpFilled = digits.every((d) => d !== "");

  return (
    <>
      {isMobile && <MobileBackHeader title="Verify OTP" />}

      <AuthBackdrop backgroundImage={bgImage}>
        <div
          className="s-login-5c2ebc"
          style={{
            width: "100%",
            maxWidth: 520,
            marginLeft: "auto",
            background: "transparent",
            padding: 0,
            boxShadow: "none",
          }}
        >
          <div className="s-login-d3c5f3">
            {!isMobile && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="s-login-0aef96"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <i className="bi bi-arrow-left" /> Back to Sign In
              </button>
            )}

            <div className="s-login-9aad3d">
              <img
                src="/assets/images/Twam-Logo-Black.png"
                alt="TWAM"
                className="s-login-cd2062"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            {!isMobile && <h5 className="s-login-b4f13d">Enter Verification Code</h5>}

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f8f5f0",
                borderRadius: 8,
                padding: "8px 14px",
                marginBottom: 12,
                fontSize: 14,
                color: "#8b7355",
                flexWrap: "wrap",
              }}
            >
              <i className={`bi ${channelIcon(channel)}`} style={{ fontSize: 16 }} />
              <span>
                Code sent via <strong>{channelLabel(channel)}</strong>
                {display ? ` to ${display}` : ""}
              </span>
            </div>

            <p className="s-login-7a79e7" style={{ marginBottom: 24 }}>
              Enter the 6-digit code below. It expires in 10 minutes.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 8 }}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={idx === OTP_LENGTH - 1 ? handleLastKeyDown : (e) => handleKeyDown(idx, e)}
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: 46,
                    height: 54,
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: otpError ? "2px solid #c0392b" : digit ? "2px solid #8b7355" : "2px solid #ddd",
                    outline: "none",
                    color: "#333",
                    background: "#fff",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>

            {otpError && (
              <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <i className="bi bi-exclamation-circle-fill" />
                {otpError}
              </div>
            )}

            <button
              type="button"
              onClick={handleContinue}
              disabled={!otpFilled}
              className="s-login-c6af62"
              style={{
                marginTop: 8,
                cursor: !otpFilled ? "not-allowed" : "pointer",
                opacity: !otpFilled ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Continue
            </button>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "#666" }}>
              {resendCd > 0 ? (
                <span>
                  Resend code in <strong style={{ color: "#8b7355" }}>{resendCd}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="s-login-182bea"
                  style={{ fontSize: 14 }}
                >
                  {resending ? "Resending…" : "Resend OTP"}
                </button>
              )}
            </div>

            <p className="s-login-c80d80" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => navigate("/login")} className="s-login-182bea">
                ← Back to Sign In
              </button>
            </p>
          </div>
        </div>
      </AuthBackdrop>
    </>
  );
}
