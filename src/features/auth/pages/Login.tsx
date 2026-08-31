import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  loginWithPassword,
  checkForgotPasswordChannels,
  sendForgotPasswordOtpToChannel,
  getCategories,
  normalizeUserInfo,
  getUserInfo,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import AuthBackdrop from "@/features/auth/components/AuthBackdrop";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useMenuStore } from "@/shared/store/menuStore";
import toast from "react-hot-toast";
import { usePageImage, IMAGE_KEYS } from "@/features/images";

function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}

function isEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

const ADMIN_ROLES = new Set([1, 3, 4, 5, 6, 7]);

function getPostLoginPath(
  roleId: number,
  isRandomPassword: boolean | undefined,
  redirectTo: string,
) {
  if (isRandomPassword) return "/account/change-password";
  if (ADMIN_ROLES.has(roleId)) return "/admin/admin-dashboard";
  return redirectTo;
}

function safeRedirectPath(value: string | null | undefined) {
  const path = (value || "").trim();
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "";
  return path;
}

function normalizeCheckoutRedirect(value: string | null | undefined) {
  const path = safeRedirectPath(value);
  if (!path) return "";
  if (path.includes("/user-products/payment-address")) {
    return `/user-products/cart${path.includes("buyNow=1") ? "?buyNow=1" : ""}`;
  }
  return path;
}

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

const forgotSchema = z
  .object({
    identifier: z.string().min(1, "Email or phone is required"),
  })
  .refine((d) => isEmail(d.identifier) || isPhone(d.identifier), {
    message: "Enter a valid email or 10-digit phone number",
    path: ["identifier"],
  });

type Mode = "signin" | "forgot" | "channelPicker";

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) return "";
  if (data.detail && typeof data.detail === "object") {
    return (
      data.detail.message ||
      data.detail.error_description ||
      data.detail.error ||
      JSON.stringify(data.detail)
    );
  }
  if (typeof data.detail === "string") return data.detail;
  if (data.error_description) return data.error_description;
  if (data.error) return data.error;
  return "";
}

function extractFailedCount(err: any): number | null {
  const detail = err?.response?.data?.detail;
  if (
    detail &&
    typeof detail === "object" &&
    typeof detail.failed_count === "number"
  ) {
    return detail.failed_count;
  }
  return null;
}

function extractErrorCode(err: any): string {
  const detail = err?.response?.data?.detail;
  if (detail && typeof detail === "object") return detail.error || "";
  return "";
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isSyncing, user } = useAuthStore();
  const { setMenus } = useMenuStore();
  const isMobile = useIsMobile();
  const bgImage = usePageImage(IMAGE_KEYS.LOGIN_BACKGROUND);

  const redirectTo =
    normalizeCheckoutRedirect(searchParams.get("redirect")) ||
    normalizeCheckoutRedirect(sessionStorage.getItem("redirect_after_login")) ||
    "/";
  const isCartRedirect =
    redirectTo.includes("/cart") || redirectTo.includes("payment-address");
  const registerRedirectPath = isCartRedirect
    ? `/register?checkout=1&redirect=${encodeURIComponent(redirectTo)}`
    : "/register";
  const [mode, setMode] = useState<Mode>("signin");
  const [hidePass, setHidePass] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [fpIdentifier, setFpIdentifier] = useState("");
  const [fpChannels, setFpChannels] = useState<{
    hasEmail: boolean;
    hasPhone: boolean;
    maskedEmail: string | null;
    maskedPhone: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isSyncing || !user) return;
    sessionStorage.removeItem("redirect_after_login");
    navigate(
      getPostLoginPath(user?.roleId ?? 0, user?.isRandomPassword, redirectTo),
      { replace: true },
    );
  }, [
    isAuthenticated,
    isSyncing,
    navigate,
    redirectTo,
    user?.isRandomPassword,
    user?.roleId,
  ]);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const forgotForm = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: "" },
  });

  const mobileHeaderTitle =
    mode === "forgot" || mode === "channelPicker"
      ? "Forgot Password"
      : "Sign In";

  const handleLogin = loginForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      const tokenData = await loginWithPassword(
        data.identifier.trim(),
        data.password,
      );
      if (!tokenData.access_token) {
        toast.error("Login failed. Please try again.");
        return;
      }

      const rawInfo = await getUserInfo(tokenData.access_token);
      const userInfo = normalizeUserInfo(rawInfo);
      const cats = await getCategories({ roleId: userInfo.roleId });
      sessionStorage.setItem("menus", JSON.stringify(cats));
      setMenus(cats);

      if (
        localStorage.getItem("guestCart") ||
        localStorage.getItem("guestWishlist")
      ) {
        toast.success("Syncing your cart and wishlist...", { duration: 2000 });
      }

      // Reset failed attempts on successful login
      setFailedAttempts(0);
      await login(userInfo as any, tokenData.access_token);
      toast.success(
        userInfo.firstName
          ? `Welcome back, ${userInfo.firstName}!`
          : "Signed in successfully.",
      );
      sessionStorage.removeItem("redirect_after_login");
      navigate(
        getPostLoginPath(
          userInfo.roleId,
          userInfo.isRandomPassword,
          redirectTo,
        ),
        { replace: true },
      );
    } catch (err: any) {
      const msg = extractErrorMessage(err).toLowerCase();
      const errorCode = extractErrorCode(err);
      const backendCount = extractFailedCount(err);

      if (
        errorCode === "locked_out" ||
        msg.includes("locked") ||
        msg.includes("temporarily")
      ) {
        // Account is locked — use max count from backend so reset message shows
        setFailedAttempts(backendCount ?? 5);
        toast.error(
          extractErrorMessage(err) ||
            "Too many failed attempts. Please reset your password.",
        );
      } else if (
        errorCode === "invalid_credentials" ||
        msg.includes("invalid") ||
        err?.response?.status === 400
      ) {
        // Use the count the backend just committed — stays accurate even after page reload
        if (backendCount !== null) {
          setFailedAttempts(backendCount);
        } else {
          setFailedAttempts((prev) => Math.min(prev + 1, 5));
        }
        toast.error("Invalid email/phone or password. Please try again.");
      } else if (msg.includes("not found") || msg.includes("not_allowed")) {
        toast.error("No account found. Please sign up first.");
      } else {
        toast.error(
          "Login failed. Please check your credentials and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  });

  const handleForgot = forgotForm.handleSubmit(async (data) => {
    setLoading(true);
    const id = data.identifier.trim();
    try {
      const channels = await checkForgotPasswordChannels(id);
      setFpIdentifier(id);
      setFpChannels(channels);

      if (!channels.registered || (!channels.hasEmail && !channels.hasPhone)) {
        toast.error(
          "This email/phone is not registered. Please sign up first.",
        );
        return;
      }

      if (channels.hasEmail && !channels.hasPhone) {
        await sendForgotPasswordOtpToChannel(id, "email");
        toast.success(`OTP sent to ${channels.maskedEmail || "your email"}.`);
        navigate(
          `/verify-otp?identifier=${encodeURIComponent(
            id,
          )}&channel=email&purpose=forgot_password&display=${encodeURIComponent(
            channels.maskedEmail || "",
          )}`,
        );
        forgotForm.reset();
      } else {
        setMode("channelPicker");
      }
    } catch {
      toast.error("Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  const handleChannelChoice = async (channel: "email" | "whatsapp" | "sms") => {
    setLoading(true);
    try {
      await sendForgotPasswordOtpToChannel(fpIdentifier, channel);
      const maskedDisplay =
        channel === "email" ? fpChannels?.maskedEmail : fpChannels?.maskedPhone;
      const channelName =
        channel === "whatsapp"
          ? "WhatsApp"
          : channel === "sms"
          ? "SMS"
          : "email";
      toast.success(`OTP sent to ${maskedDisplay || `your ${channelName}`}.`);
      navigate(
        `/verify-otp?identifier=${encodeURIComponent(
          fpIdentifier,
        )}&channel=${channel}&purpose=forgot_password&display=${encodeURIComponent(
          maskedDisplay || "",
        )}`,
      );
    } catch {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (err?: any) => `form-control${err ? " is-invalid" : ""}`;
  const errMsg = (msg?: string) =>
    msg ? <div className="invalid-feedback s-login-78f9a3">{msg}</div> : null;

  return (
    <>
      {isMobile && <MobileBackHeader title={mobileHeaderTitle} />}

      {isSyncing && (
        <div className="s-login-a10a06">
          <div className="s-login-21c8cb" />
          <div className="s-login-044594">
            Syncing your cart and wishlist...
            <br />
            <span className="s-login-1c4695">This will only take a moment</span>
          </div>
        </div>
      )}

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
              <Link to="/" className="s-login-0aef96">
                <i className="bi bi-arrow-left" /> Back to Home
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

            {isCartRedirect && (
              <div className="s-login-3b11d9">
                <i className="bi bi-bag me-2" />
                Sign in to continue checkout. Your cart items are saved.
              </div>
            )}

            {mode === "signin" && (
              <>
                {!isMobile && <h5 className="s-login-b4f13d">Sign In</h5>}
                <p className="s-login-7a79e7">
                  Welcome Back, Beautiful. Let's get you back to feeling
                  fabulous.
                </p>
                <form onSubmit={handleLogin}>
                  <div className="s-adminblog-22a617">
                    <label className="s-login-b4e387">
                      Email or Mobile Number
                    </label>
                    <input
                      {...loginForm.register("identifier")}
                      className={inputCls(
                        loginForm.formState.errors.identifier,
                      )}
                      type="text"
                      placeholder="Email or 10-digit phone"
                    />
                    {errMsg(loginForm.formState.errors.identifier?.message)}
                  </div>
                  <div className="s-login-e50f28">
                    <label className="s-login-b4e387">Password</label>
                    <div className="s-updateprofil-1d5e50">
                      <input
                        {...loginForm.register("password")}
                        className={`${inputCls(
                          loginForm.formState.errors.password,
                        )} s-login-51c683`}
                        type={hidePass ? "password" : "text"}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setHidePass(!hidePass)}
                        className="s-login-af8e0d"
                      >
                        <i
                          className={`bi ${
                            hidePass ? "bi-eye-slash" : "bi-eye"
                          }`}
                        />
                      </button>
                    </div>
                    {errMsg(loginForm.formState.errors.password?.message)}
                    {failedAttempts > 0 && failedAttempts < 5 && (
                      <p
                        style={{
                          marginTop: 6,
                          marginBottom: 0,
                          fontSize: 12,
                          color: "#b45309",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <i className="bi bi-exclamation-triangle-fill" />
                        {failedAttempts} of 5 incorrect attempt
                        {failedAttempts > 1 ? "s" : ""}. {5 - failedAttempts}{" "}
                        more and your account will be temporarily locked.
                      </p>
                    )}
                    {failedAttempts >= 5 && (
                      <p
                        style={{
                          marginTop: 6,
                          marginBottom: 0,
                          fontSize: 12,
                          color: "#dc2626",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <i className="bi bi-lock-fill" />
                        Account locked due to too many failed attempts.{" "}
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#dc2626",
                            fontWeight: 700,
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Reset your password
                        </button>{" "}
                        to unlock.
                      </p>
                    )}
                  </div>
                  <div className="s-login-8007bc">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="s-login-aef348"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="s-login-c6af62"
                    style={{
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </button>
                </form>
                <p className="s-login-89ef73">
                  Don't have an account?{" "}
                  <button
                    onClick={() => navigate(registerRedirectPath)}
                    className="s-login-182bea"
                  >
                    Sign Up
                  </button>
                </p>
              </>
            )}

            {mode === "forgot" && (
              <>
                {!isMobile && (
                  <h5 className="s-login-b4f13d">Forgot Password?</h5>
                )}
                <p className="s-login-7a79e7">
                  Enter your registered email or phone number. We'll send you a
                  one-time verification code.
                </p>
                <form onSubmit={handleForgot}>
                  <div className="s-adminblog-19fd7a">
                    <label className="s-login-b4e387">
                      Email or Phone Number
                    </label>
                    <input
                      {...forgotForm.register("identifier")}
                      className={inputCls(
                        forgotForm.formState.errors.identifier,
                      )}
                      type="text"
                      placeholder="Email or 10-digit phone"
                    />
                    {errMsg(forgotForm.formState.errors.identifier?.message)}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="s-login-c6af62"
                    style={{
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? "Checking…" : "Continue"}
                  </button>
                </form>
                <p className="s-login-c80d80">
                  <button
                    onClick={() => setMode("signin")}
                    className="s-login-182bea"
                  >
                    ← Back to Sign In
                  </button>
                </p>
              </>
            )}

            {mode === "channelPicker" && fpChannels && (
              <>
                {!isMobile && (
                  <h5 className="s-login-b4f13d">Choose OTP Destination</h5>
                )}
                <p className="s-login-7a79e7">
                  Choose how you'd like to receive your one-time verification
                  code.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    margin: "24px 0",
                  }}
                >
                  {fpChannels.hasEmail && (
                    <button
                      onClick={() => handleChannelChoice("email")}
                      disabled={loading}
                      className="s-login-c6af62"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      <i
                        className="bi bi-envelope-fill"
                        style={{ fontSize: 18 }}
                      />
                      <span>
                        Send to Email
                        <br />
                        <small style={{ fontWeight: 400, opacity: 0.8 }}>
                          {fpChannels.maskedEmail}
                        </small>
                      </span>
                    </button>
                  )}
                  {fpChannels.hasPhone && (
                    <>
                      <button
                        onClick={() => handleChannelChoice("whatsapp")}
                        disabled={loading}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 20px",
                          borderRadius: 8,
                          background: "#25D366",
                          color: "#fff",
                          border: "none",
                          fontWeight: 600,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.7 : 1,
                        }}
                      >
                        <i
                          className="bi bi-whatsapp"
                          style={{ fontSize: 18 }}
                        />
                        <span>
                          Send via WhatsApp
                          <br />
                          <small style={{ fontWeight: 400, opacity: 0.8 }}>
                            {fpChannels.maskedPhone}
                          </small>
                        </span>
                      </button>
                      <button
                        onClick={() => handleChannelChoice("sms")}
                        disabled={loading}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 20px",
                          borderRadius: 8,
                          background: "#6b0f2a",
                          color: "#fff",
                          border: "none",
                          fontWeight: 600,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.7 : 1,
                        }}
                      >
                        <i
                          className="bi bi-chat-dots-fill"
                          style={{ fontSize: 18 }}
                        />
                        <span>
                          Send via SMS
                          <br />
                          <small style={{ fontWeight: 400, opacity: 0.8 }}>
                            {fpChannels.maskedPhone}
                          </small>
                        </span>
                      </button>
                    </>
                  )}
                </div>
                <p className="s-login-c80d80">
                  <button
                    onClick={() => setMode("forgot")}
                    className="s-login-182bea"
                  >
                    ← Back
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </AuthBackdrop>
    </>
  );
}
