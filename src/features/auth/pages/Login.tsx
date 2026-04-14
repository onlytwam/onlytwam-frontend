// src/features/auth/pages/Login.tsx
// Updated:
//  • Sign-in: accepts email OR 10-digit phone number
//  • Sign-up: email optional, phone optional — at least one required
//  • Forgot password: multi-channel OTP flow
//      Step 1: enter email or phone → check channels
//      Step 2: if both channels exist, show picker; if only one, send immediately
//      Navigate to /verify-otp with identifier + channel info

import { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  loginWithPassword,
  registerUser,
  checkForgotPasswordChannels,
  sendForgotPasswordOtpToChannel,
  getCategories,
  normalizeUserInfo,
  getUserInfo,
  encryptPassword,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMenuStore } from "@/shared/store/menuStore";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}
function isEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required").max(500),
    middleName: z.string().max(500).optional(),
    lastName: z.string().min(1, "Last Name is required").max(500),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.email?.trim() || d.phoneNumber?.trim(), {
    message: "Email or phone number is required",
    path: ["email"],
  })
  .refine((d) => !d.email || isEmail(d.email), {
    message: "Invalid email address",
    path: ["email"],
  })
  .refine((d) => !d.phoneNumber || isPhone(d.phoneNumber), {
    message: "10-digit phone number required",
    path: ["phoneNumber"],
  });

const forgotSchema = z
  .object({
    identifier: z.string().min(1, "Email or phone is required"),
  })
  .refine((d) => isEmail(d.identifier) || isPhone(d.identifier), {
    message: "Enter a valid email or 10-digit phone number",
    path: ["identifier"],
  });

type Mode = "signin" | "signup" | "forgot" | "channelPicker";

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) return "";
  if (data.detail && typeof data.detail === "object")
    return (
      data.detail.error_description ||
      data.detail.error ||
      JSON.stringify(data.detail)
    );
  if (typeof data.detail === "string") return data.detail;
  if (data.error_description) return data.error_description;
  if (data.error) return data.error;
  return "";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isSyncing } = useAuthStore();
  const { setMenus } = useMenuStore();

  const redirectTo = searchParams.get("redirect") || "/";
  const initialMode: Mode =
    (location.state as any)?.mode === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [hidePass, setHidePass] = useState(true);
  const [loading, setLoading] = useState(false);

  // Channel picker state (forgot password step 2)
  const [fpIdentifier, setFpIdentifier] = useState("");
  const [fpChannels, setFpChannels] = useState<{
    hasEmail: boolean;
    hasPhone: boolean;
    maskedEmail: string | null;
    maskedPhone: string | null;
  } | null>(null);

  useEffect(() => {
    if (isAuthenticated && !isSyncing) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, isSyncing]);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
  });
  const forgotForm = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: "" },
  });

  // ── Sign In ───────────────────────────────────────────────────────────────
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

      const ADMIN_ROLES = new Set([1, 3, 4, 5, 6]);
      const guestCartExists = !!localStorage.getItem("guestCart");
      const guestWishlistExists = !!localStorage.getItem("guestWishlist");
      if (guestCartExists || guestWishlistExists)
        toast.success("Syncing your cart and wishlist...", { duration: 2000 });

      await login(userInfo as any, tokenData.access_token);
      if (ADMIN_ROLES.has(userInfo.roleId))
        navigate("/admin/admin-dashboard", { replace: true });
      else navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const msg = extractErrorMessage(err).toLowerCase();
      if (msg.includes("invalid") || err?.response?.status === 400)
        toast.error("Invalid email/phone or password. Please try again.");
      else if (msg.includes("locked"))
        toast.error("Your account is locked. Please contact support.");
      else if (msg.includes("not found") || msg.includes("not_allowed"))
        toast.error("No account found. Please sign up first.");
      else
        toast.error(
          "Login failed. Please check your credentials and try again.",
        );
    } finally {
      setLoading(false);
    }
  });

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const handleSignup = signupForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      await registerUser({
        firstName: data.firstName,
        middleName: data.middleName || "",
        lastName: data.lastName,
        emailId: data.email || undefined,
        password: encryptPassword(data.password),
        phoneNumber: data.phoneNumber || undefined,
      } as any);
      toast.success("Account created! Please sign in.");
      setMode("signin");
      signupForm.reset();
    } catch (err: any) {
      const errors =
        err?.response?.data?.errors || err?.response?.data?.detail?.errors;
      if (Array.isArray(errors)) {
        toast.error(
          errors
            .map((e: any) =>
              e.code === "DuplicateUserName"
                ? "Email or phone already registered"
                : e.description,
            )
            .join(", "),
        );
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  });

  // ── Forgot Password — Step 1: check channels ──────────────────────────────
  const handleForgot = forgotForm.handleSubmit(async (data) => {
    setLoading(true);
    const id = data.identifier.trim();
    try {
      const channels = await checkForgotPasswordChannels(id);
      setFpIdentifier(id);
      setFpChannels(channels);

      if (!channels.registered || (!channels.hasEmail && !channels.hasPhone)) {
        // Account not found — show helpful message
        toast.error(
          "This email/phone is not registered. Please sign up first.",
        );
        return;
      }

      if (channels.hasEmail && channels.hasPhone) {
        // Both channels — show picker
        setMode("channelPicker");
      } else {
        // Only one channel — send immediately
        const channel = channels.hasEmail ? "email" : "phone";
        const maskedDisplay =
          channel === "email" ? channels.maskedEmail : channels.maskedPhone;
        await sendForgotPasswordOtpToChannel(id, channel);
        toast.success(
          `OTP sent to ${maskedDisplay || (channel === "email" ? "your email" : "your phone")}.`,
        );
        navigate(
          `/verify-otp?identifier=${encodeURIComponent(id)}&channel=${channel}&purpose=forgot_password&display=${encodeURIComponent(maskedDisplay || "")}`,
        );
        forgotForm.reset();
      }
    } catch {
      toast.error("Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  // ── Forgot Password — Step 2: channel picker ──────────────────────────────
  const handleChannelChoice = async (channel: "email" | "phone") => {
    setLoading(true);
    try {
      await sendForgotPasswordOtpToChannel(fpIdentifier, channel);
      const maskedDisplay =
        channel === "email" ? fpChannels?.maskedEmail : fpChannels?.maskedPhone;
      toast.success(
        `OTP sent to ${maskedDisplay || (channel === "email" ? "your email" : "your phone")}.`,
      );
      navigate(
        `/verify-otp?identifier=${encodeURIComponent(fpIdentifier)}&channel=${channel}&purpose=forgot_password&display=${encodeURIComponent(maskedDisplay || "")}`,
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

  const bgImage =
    mode === "signup"
      ? "/assets/images/signup-bg.jpg"
      : "/assets/images/forgot-bg.jpg";

  return (
    <>
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

      <div className="s-login-2bb036">
        {/* Left image */}
        <div className="d-none d-md-flex s-login-2da0c0">
          <img
            src={bgImage}
            className="s-userdashboar-4ebae2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            alt=""
          />
          <div className="s-login-da6116">
            <p className="s-login-f18190">
              {mode === "signup"
                ? '"Every body deserves a perfect fit."'
                : mode === "forgot" || mode === "channelPicker"
                  ? "No worries — we'll get you back in."
                  : "Welcome Back, Beautiful."}
            </p>
            <p className="s-login-6854c0">Only TWAM — Crafted with love.</p>
          </div>
        </div>

        {/* Right form */}
        <div className="s-login-5c2ebc">
          <div className="s-login-d3c5f3">
            <Link to="/" className="s-login-0aef96">
              <i className="bi bi-arrow-left" /> Back to Home
            </Link>
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

            {redirectTo.includes("payment-address") && (
              <div className="s-login-3b11d9">
                <i className="bi bi-bag me-2" />
                Sign in to complete your order. Your cart items are saved.
              </div>
            )}

            {/* ── SIGN IN */}
            {mode === "signin" && (
              <>
                <h5 className="s-login-b4f13d">Sign In</h5>
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
                        className={`${inputCls(loginForm.formState.errors.password)} s-login-51c683`}
                        type={hidePass ? "password" : "text"}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setHidePass(!hidePass)}
                        className="s-login-af8e0d"
                      >
                        <i
                          className={`bi ${hidePass ? "bi-eye-slash" : "bi-eye"}`}
                        />
                      </button>
                    </div>
                    {errMsg(loginForm.formState.errors.password?.message)}
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
                    onClick={() => setMode("signup")}
                    className="s-login-182bea"
                  >
                    Sign Up
                  </button>
                </p>
              </>
            )}

            {/* ── SIGN UP */}
            {mode === "signup" && (
              <>
                <h5 className="s-login-b4f13d">Sign Up</h5>
                <p className="s-login-7a79e7">
                  "Every body deserves a perfect fit."
                </p>
                <form onSubmit={handleSignup}>
                  <div className="s-login-9f425c">
                    {(["firstName", "middleName", "lastName"] as const).map(
                      (key, i) => (
                        <div key={key}>
                          <label className="s-login-4d06e1">
                            {["First Name *", "Middle", "Last Name *"][i]}
                          </label>
                          <input
                            {...signupForm.register(key)}
                            className={inputCls(
                              (signupForm.formState.errors as any)[key],
                            )}
                          />
                          {errMsg(
                            (signupForm.formState.errors as any)[key]?.message,
                          )}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="s-login-863afe">
                    {/* Email — optional if phone given */}
                    <div className="s-adminproduct-02d219">
                      <label className="s-login-4d06e1">Email</label>
                      <input
                        {...signupForm.register("email")}
                        className={inputCls(signupForm.formState.errors.email)}
                        type="email"
                        placeholder="you@example.com (optional if phone given)"
                      />
                      {errMsg(signupForm.formState.errors.email?.message)}
                    </div>
                    {/* Phone — optional if email given */}
                    <div className="s-adminproduct-02d219">
                      <label className="s-login-4d06e1">Phone Number</label>
                      <input
                        {...signupForm.register("phoneNumber")}
                        className={inputCls(
                          signupForm.formState.errors.phoneNumber,
                        )}
                        type="tel"
                        placeholder="10-digit (optional if email given)"
                        maxLength={10}
                      />
                      {errMsg(signupForm.formState.errors.phoneNumber?.message)}
                    </div>
                    <div
                      className="s-adminproduct-02d219"
                      style={{ gridColumn: "1/-1" }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--heirloom)",
                          marginBottom: 4,
                        }}
                      >
                        * At least one of email or phone number is required.
                      </p>
                    </div>
                    {/* Password fields */}
                    {(
                      [
                        {
                          key: "password",
                          label: "Password *",
                          type: hidePass ? "password" : "text",
                        },
                        {
                          key: "confirmPassword",
                          label: "Confirm Pass *",
                          type: "password",
                        },
                      ] as const
                    ).map(({ key, label, type }) => (
                      <div
                        key={key as string}
                        className="s-adminproduct-02d219"
                      >
                        <label className="s-login-4d06e1">{label}</label>
                        <input
                          {...signupForm.register(key as any)}
                          className={inputCls(
                            (signupForm.formState.errors as any)[key],
                          )}
                          type={type}
                        />
                        {errMsg(
                          (signupForm.formState.errors as any)[key as string]
                            ?.message,
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="s-login-8c5379"
                    style={{
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? "Creating account…" : "Sign Up"}
                  </button>
                </form>
                <p className="s-login-5d4ce1">
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("signin")}
                    className="s-login-182bea"
                  >
                    Sign In
                  </button>
                </p>
              </>
            )}

            {/* ── FORGOT PASSWORD — Step 1: enter identifier */}
            {mode === "forgot" && (
              <>
                <h5 className="s-login-b4f13d">Forgot Password?</h5>
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

            {/* ── FORGOT PASSWORD — Step 2: channel picker */}
            {mode === "channelPicker" && fpChannels && (
              <>
                <h5 className="s-login-b4f13d">Choose OTP Destination</h5>
                <p className="s-login-7a79e7">
                  Your account has both email and phone registered. Where would
                  you like to receive the OTP?
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
                    <button
                      onClick={() => handleChannelChoice("phone")}
                      disabled={loading}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 20px",
                        borderRadius: 8,
                        background: "#2ecc71",
                        color: "#fff",
                        border: "none",
                        fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      <i
                        className="bi bi-phone-fill"
                        style={{ fontSize: 18 }}
                      />
                      <span>
                        Send to Phone (SMS)
                        <br />
                        <small style={{ fontWeight: 400, opacity: 0.8 }}>
                          {fpChannels.maskedPhone}
                        </small>
                      </span>
                    </button>
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
      </div>
    </>
  );
}
