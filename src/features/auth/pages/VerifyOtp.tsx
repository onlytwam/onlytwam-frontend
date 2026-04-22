// src/features/auth/pages/VerifyOtp.tsx
// Updated:
//  • Reads identifier + channel + purpose from URL params
//  • Shows "sent to email" or "sent to phone" depending on channel
//  • On verify success, passes identifier + otp to ResetPassword (no separate token needed)
//  • Resend calls new forgot-password/send-otp endpoint

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sendForgotPasswordOtpToChannel } from "@/features/auth/api/auth.api";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import toast from "react-hot-toast";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Params from Login.tsx navigation
  const identifier =
    searchParams.get("identifier") || searchParams.get("email") || "";
  const channel = (searchParams.get("channel") || "email") as "email" | "phone";
  // displayIdentifier shows the masked value (e.g. vi***@gmail.com) not the raw phone/email
  const displayIdentifier = searchParams.get("display") || identifier;

  // Display label
  const isPhone = channel === "phone";
  const channelLabel = isPhone ? "phone (SMS)" : "email";
  const channelIcon = isPhone ? "bi-phone" : "bi-envelope";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendSec, setResendSec] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendSec <= 0) return;
    const id = setInterval(() => setResendSec((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendSec]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const n = [...digits];
        n[index] = "";
        setDigits(n);
      } else if (index > 0) inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0)
      inputRefs.current[index - 1]?.focus();
    else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1)
      inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  // On "Verify OTP" — pass otp + identifier to ResetPassword
  // The actual OTP check + password reset happens in one call on ResetPassword page
  const handleVerify = useCallback(async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    if (!identifier) {
      toast.error("Identifier not found. Please restart.");
      navigate("/login");
      return;
    }

    setLoading(true);
    // We pass the OTP forward; the actual verification + reset happens on ResetPassword page
    // in one combined API call (forgot-password/verify-otp)
    setTimeout(() => {
      setLoading(false);
      toast.success("OTP entered! Please set your new password.");
      navigate(
        `/reset-password?identifier=${encodeURIComponent(identifier)}&otp=${encodeURIComponent(otp)}&channel=${channel}`,
      );
    }, 300);
  }, [digits, identifier, navigate, channel]);

  useEffect(() => {
    const onEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleVerify();
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [handleVerify]);

  const handleResend = async () => {
    if (resendSec > 0) return;
    try {
      await sendForgotPasswordOtpToChannel(identifier, channel);
      toast.success(`A new OTP has been sent to your ${channelLabel}.`);
      setResendSec(RESEND_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(""));
      setError("");
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend OTP. Please try again.");
    }
  };

  const boxStyle = (
    filled: boolean,
    hasError: boolean,
  ): React.CSSProperties => ({
    width: 52,
    height: 60,
    border: `2px solid ${hasError || filled ? "var(--brand)" : "var(--ivory)"}`,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
    background: "var(--ivory)",
    color: "#000000",
    transition: "border-color 0.15s",
    caretColor: "var(--brand)",
  });

  return (
    <>
      {isMobile && <MobileBackHeader title="Verify OTP" />}
      <div className="s-login-2bb036">
      <div className="d-none d-md-flex s-login-2da0c0">
        <img
          src="/assets/images/forgot-bg.jpg"
          className="s-userdashboar-4ebae2"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
          alt=""
        />
        <div className="s-verifyotp-c6d041">
          <p className="s-verifyotp-d4225b">
            Check your {channelLabel} — your code is waiting.
          </p>
          <p className="s-verifyotp-8b64e1">Only TWAM — Crafted with love.</p>
        </div>
      </div>

      <div className="s-login-5c2ebc">
        <div className="s-resetpasswor-4c6092">
          {!isMobile && (
            <Link to="/login" className="s-login-0aef96">
              <i className="bi bi-arrow-left" /> Back to Sign In
            </Link>
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

          <div className="s-login-9aad3d">
            <div className="s-verifyotp-f5c8cb">
              <i className={`bi ${channelIcon} s-verifyotp-0f59f9`} />
            </div>
            {!isMobile && (
              <h5 className="s-login-b4f13d">
                {isPhone ? "Verify Your Phone" : "Verify Your Email"}
              </h5>
            )}
            <p className="s-resetpasswor-4c0ccf">
              We sent a {OTP_LENGTH}-digit code to your {channelLabel}
            </p>
            <p className="s-verifyotp-c35bd3">
              {displayIdentifier || (isPhone ? "your phone" : "your email")}
            </p>
          </div>

          <div className="s-verifyotp-482e19" onPaste={handlePaste}>
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
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={boxStyle(!!digit, !!error)}
              />
            ))}
          </div>

          {error && (
            <p className="s-verifyotp-7770fc">
              <i className="bi bi-exclamation-circle me-1" />
              {error}
            </p>
          )}

          <button
            onClick={handleVerify}
            disabled={loading}
            className="s-verifyotp-0ec883"
            style={{
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Verifying…
              </>
            ) : (
              "Verify OTP"
            )}
          </button>

          <p className="s-verifyotp-5ec9a3">
            Didn't receive the code?{" "}
            {resendSec > 0 ? (
              <span className="s-adminbrands-95b451">
                Resend in {resendSec}s
              </span>
            ) : (
              <button onClick={handleResend} className="s-verifyotp-85105f">
                Resend OTP
              </button>
            )}
          </p>

          <div className="s-resetpasswor-cb112e">
            {["Enter Contact", "Verify OTP", "New Password"].map((step, i) => (
              <div key={step} className="s-resetpasswor-6e6177">
                <div
                  className="s-verifyotp-366f20"
                  style={{
                    background:
                      i === 1
                        ? "var(--brand)"
                        : i === 0
                          ? "var(--heirloom)"
                          : "var(--ivory)",
                    color: i <= 1 ? "#fff" : "var(--heirloom)",
                  }}
                >
                  {i === 0 ? (
                    <i className="bi bi-check s-addresslist-9eec06" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className="s-verifyotp-202412"
                  style={{
                    color: i === 1 ? "var(--brand)" : "var(--heirloom)",
                    fontWeight: i === 1 ? 600 : 400,
                  }}
                >
                  {step}
                </span>
                {i < 2 && <div className="s-resetpasswor-8f54ef" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
