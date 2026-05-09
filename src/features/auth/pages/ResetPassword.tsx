// src/features/auth/pages/ResetPassword.tsx
//
// Step 3 of the forgot-password flow.
// Receives identifier + otp from VerifyOtp.tsx via URL params.
// Calls verifyForgotPasswordOtpAndReset(identifier, otp, newPassword) which
// verifies the OTP AND resets the password in ONE combined backend call.

import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  verifyForgotPasswordOtpAndReset,
  resetPasswordWithToken,
} from "@/features/auth/api/auth.api";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import toast from "react-hot-toast";

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function getStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#c0392b", "#f5a623", "#2e86c1", "#2e7d32"];
  return { score, label: labels[score] || "", color: colors[score] || "" };
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ── URL params ─────────────────────────────────────────────────────────────
  const identifier = searchParams.get("identifier") || searchParams.get("email") || "";
  const otp        = searchParams.get("otp") || "";           // from VerifyOtp (new flow)
  const legacyToken = searchParams.get("token") || "";        // old email-link flow
  const channel    = searchParams.get("channel") || "email";
  const displayIdentifier = searchParams.get("display") || identifier;

  // Determine which flow we're in
  const isLegacy = !!legacyToken && !otp;                     // old token-link flow
  const isValid  = isLegacy ? !!legacyToken : (!!identifier && !!otp);

  // ── form state ─────────────────────────────────────────────────────────────
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]               = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [success, setSuccess]               = useState(false);

  const strength = getStrength(newPassword);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!newPassword)
      e.newPassword = "New password is required";
    else if (newPassword.length < 6)
      e.newPassword = "Password must be at least 6 characters";
    else if (newPassword.length > 100)
      e.newPassword = "Password is too long";
    if (!confirmPassword)
      e.confirmPassword = "Please confirm your password";
    else if (newPassword !== confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!isValid) {
      toast.error("Invalid reset link. Please restart the process.");
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      if (isLegacy) {
        // Old token-based reset (email link)
        await resetPasswordWithToken({
          emailId: identifier,
          token: legacyToken,
          newPassword,
        });
      } else {
        // New OTP flow — verify OTP + set new password in one call
        await verifyForgotPasswordOtpAndReset({ identifier, otp, newPassword });
      }
      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err: any) {
      const data   = err?.response?.data;
      const detail = data?.detail;
      const msg    = typeof detail === "string" ? detail : data?.message;

      if (msg?.toLowerCase().includes("otp") ||
          msg?.toLowerCase().includes("invalid") ||
          msg?.toLowerCase().includes("expired")) {
        toast.error("OTP is invalid or expired. Please restart the forgot-password process.");
        // Send user back to start the flow again
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.error(typeof msg === "string" ? msg : "Reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const channelLabel = channel === "sms" ? "SMS" : channel === "whatsapp" ? "WhatsApp" : "email";

  return (
    <>
      {isMobile && <MobileBackHeader title="Reset Password" />}
      <div className="s-login-2bb036">

        {/* Left image */}
        <div className="d-none d-md-flex s-login-2da0c0">
          <img
            src="/assets/images/forgot-bg.jpg"
            className="s-userdashboar-4ebae2"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            alt=""
          />
          <div className="s-resetpasswor-095dc6">
            <p className="s-resetpasswor-c867a1">Almost there — set a strong new password.</p>
            <p className="s-resetpasswor-48d152">Only TWAM — Crafted with love.</p>
          </div>
        </div>

        {/* Right form */}
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
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>

            {/* ── Success state ─────────────────────────────────────────── */}
            {success ? (
              <div className="s-adminnewslet-e2e1e0">
                <div className="s-resetpasswor-5b4961">
                  <i className="bi bi-check-lg s-resetpasswor-404657" />
                </div>
                <h5 className="s-resetpasswor-215432">Password Updated!</h5>
                <p className="s-resetpasswor-cf8215">
                  Your password has been reset. You can now sign in with your new password.
                </p>
                <Link to="/login" className="s-resetpasswor-de7839">
                  Sign In
                </Link>
              </div>

            /* ── Invalid / missing otp state ──────────────────────────── */
            ) : !isValid ? (
              <div className="s-adminnewslet-e2e1e0">
                <div className="s-resetpasswor-036700">
                  <i className="bi bi-exclamation-triangle s-resetpasswor-dfecbd" />
                </div>
                <p className="s-resetpasswor-01d023">
                  This reset link is invalid or has expired. Please restart the forgot-password process.
                </p>
                <Link to="/login" className="s-resetpasswor-bfc8a5">
                  Back to Login
                </Link>
              </div>

            /* ── Password form ────────────────────────────────────────── */
            ) : (
              <>
                <div className="s-adminnewslet-70cb1d">
                  {!isMobile && <h5 className="s-login-b4f13d">Set New Password</h5>}
                  <p className="s-resetpasswor-4c0ccf">
                    OTP verified via{" "}
                    <span className="s-register-51a817">
                      {displayIdentifier} ({channelLabel})
                    </span>
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* New password */}
                  <div className="s-updateprofil-246fef">
                    <label className="s-addressform-f1fb64">
                      New Password <span className="s-resetpasswor-ddc1b2">*</span>
                    </label>
                    <div className="s-updateprofil-1d5e50">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setErrors((er) => ({ ...er, newPassword: "" }));
                        }}
                        className="inp-field"
                        style={{
                          border: `1px solid ${errors.newPassword ? "var(--brand)" : "var(--ivory)"}`,
                        }}
                        placeholder="Minimum 6 characters"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        className="s-resetpasswor-2632a8"
                      >
                        <i className={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="auth-err-text">{errors.newPassword}</p>
                    )}
                    {newPassword.length > 0 && (
                      <div className="s-resetpasswor-15d9cd">
                        <div className="s-resetpasswor-6f872d">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="s-resetpasswor-6a5b5e"
                              style={{
                                background: i <= strength.score ? strength.color : "var(--ivory)",
                              }}
                            />
                          ))}
                        </div>
                        <p className="s-resetpasswor-dcdb14 s-resetpasswor-34edbd">
                          {strength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="s-login-e50f28">
                    <label className="s-addressform-f1fb64">
                      Confirm Password <span className="s-resetpasswor-ddc1b2">*</span>
                    </label>
                    <div className="s-updateprofil-1d5e50">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setErrors((er) => ({ ...er, confirmPassword: "" }));
                        }}
                        className="inp-field"
                        style={{
                          border: `1px solid ${errors.confirmPassword ? "var(--brand)" : "var(--ivory)"}`,
                        }}
                        placeholder="Repeat your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="s-resetpasswor-2632a8"
                      >
                        <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="auth-err-text">{errors.confirmPassword}</p>
                    )}
                    {confirmPassword && !errors.confirmPassword && newPassword === confirmPassword && (
                      <p className="s-resetpasswor-aed927">
                        <i className="bi bi-check-circle me-1" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  {/* Requirements */}
                  <div className="s-resetpasswor-9fded5">
                    <p className="s-resetpasswor-d5a599">Password requirements:</p>
                    {[
                      { label: "At least 6 characters",      met: newPassword.length >= 6 },
                      { label: "At least one uppercase letter", met: /[A-Z]/.test(newPassword) },
                      { label: "At least one number",         met: /[0-9]/.test(newPassword) },
                    ].map(({ label, met }) => (
                      <p
                        key={label}
                        className="s-resetpasswor-7b597a"
                        style={{ color: met ? "var(--brand)" : "var(--heirloom)" }}
                      >
                        <i className={`bi ${met ? "bi-check-circle-fill" : "bi-circle"} me-1`} />
                        {label}
                      </p>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="s-resetpasswor-33ec0d"
                    style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Resetting…
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </form>

                {/* Progress steps */}
                <div className="s-resetpasswor-cb112e">
                  {["Enter Contact", "Verify OTP", "New Password"].map((step, i) => (
                    <div key={step} className="s-resetpasswor-6e6177">
                      <div
                        className="s-resetpasswor-2b303d"
                        style={{ background: i < 2 ? "var(--heirloom)" : "var(--brand)" }}
                      >
                        {i < 2
                          ? <i className="bi bi-check s-addresslist-9eec06" />
                          : 3}
                      </div>
                      <span
                        className="s-resetpasswor-22579e"
                        style={{
                          color: i === 2 ? "var(--brand)" : "var(--heirloom)",
                          fontWeight: i === 2 ? 600 : 400,
                        }}
                      >
                        {step}
                      </span>
                      {i < 2 && <div className="s-resetpasswor-8f54ef" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}