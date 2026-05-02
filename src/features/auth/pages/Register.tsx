// src/features/auth/pages/Register.tsx
// Dedicated Sign Up page at /register
// Matches Login.tsx visual design — same layout, same classes
// Adds mandatory Date of Birth field (calendar picker)

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerUser, encryptPassword } from "@/features/auth/api/auth.api";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}
function isEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

// ── Validation schema ─────────────────────────────────────────────────────────
const signupSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required").max(500),
    middleName: z.string().max(500).optional(),
    lastName: z.string().min(1, "Last Name is required").max(500),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    dateOfBirth: z
      .string()
      .min(1, "Date of birth is required")
      .refine((val) => {
        const d = new Date(val);
        return !isNaN(d.getTime()) && d < new Date();
      }, "Enter a valid date of birth (must be in the past)"),
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

type SignupForm = z.infer<typeof signupSchema>;

export default function Register() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [hidePass, setHidePass] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
    },
  });

  // ── Sign Up handler ───────────────────────────────────────────────────────
  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      await registerUser({
        firstName: data.firstName,
        middleName: data.middleName || "",
        lastName: data.lastName,
        emailId: data.email || undefined,
        password: encryptPassword(data.password),
        phoneNumber: data.phoneNumber || undefined,
        dateOfBirth: data.dateOfBirth,
      } as any);
      toast.success("Account created! Please sign in.");
      reset();
      navigate("/login");
    } catch (err: any) {
      const apiErrors =
        err?.response?.data?.errors || err?.response?.data?.detail?.errors;
      if (Array.isArray(apiErrors)) {
        toast.error(
          apiErrors
            .map((e: any) =>
              e.code === "DuplicateUserName"
                ? "Email or phone already registered"
                : e.description,
            )
            .join(", "),
        );
      } else {
        toast.error(
          err?.response?.data?.detail?.message ||
            err?.response?.data?.message ||
            "Registration failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  });

  const inputCls = (err?: any) => `form-control${err ? " is-invalid" : ""}`;
  const errMsg = (msg?: string) =>
    msg ? <div className="invalid-feedback s-login-78f9a3">{msg}</div> : null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      {isMobile && <MobileBackHeader title="Create Account" />}

      <div className="s-login-2bb036">
        {/* Left decorative panel */}
        <div className="d-none d-md-flex s-login-2da0c0">
          <img
            src="/assets/images/signup-bg.jpg"
            className="s-userdashboar-4ebae2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            alt=""
          />
          <div className="s-login-da6116">
            <p className="s-login-f18190">
              "Every body deserves a perfect fit."
            </p>
            <p className="s-login-6854c0">Only TWAM — Crafted with love.</p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="s-login-5c2ebc">
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

            {!isMobile && <h5 className="s-login-b4f13d">Sign Up</h5>}
            <p className="s-login-7a79e7">
              "Every body deserves a perfect fit."
            </p>

            <form onSubmit={onSubmit}>
              {/* First / Middle / Last name row */}
              <div className="s-login-9f425c">
                {(["firstName", "middleName", "lastName"] as const).map(
                  (key, i) => (
                    <div key={key}>
                      <label className="s-login-4d06e1">
                        {["First Name *", "Middle", "Last Name *"][i]}
                      </label>
                      <input
                        {...register(key)}
                        className={inputCls((errors as any)[key])}
                      />
                      {errMsg((errors as any)[key]?.message)}
                    </div>
                  ),
                )}
              </div>

              <div className="s-login-863afe">
                {/* Email */}
                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Email</label>
                  <input
                    {...register("email")}
                    className={inputCls(errors.email)}
                    type="email"
                    placeholder="you@example.com (optional if phone given)"
                  />
                  {errMsg(errors.email?.message)}
                </div>

                {/* Phone */}
                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Phone Number</label>
                  <input
                    {...register("phoneNumber")}
                    className={inputCls(errors.phoneNumber)}
                    type="tel"
                    placeholder="10-digit (optional if email given)"
                    maxLength={10}
                  />
                  {errMsg(errors.phoneNumber?.message)}
                </div>

                {/* Hint */}
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

                {/* ── Date of Birth — mandatory, full row ── */}
                <div
                  className="s-adminproduct-02d219"
                  style={{ gridColumn: "1/-1" }}
                >
                  <label className="s-login-4d06e1">Date of Birth *</label>
                  <input
                    {...register("dateOfBirth")}
                    className={inputCls(errors.dateOfBirth)}
                    type="date"
                    max={today}
                    style={{ cursor: "pointer" }}
                  />
                  {errMsg(errors.dateOfBirth?.message)}
                </div>

                {/* Password */}
                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Password *</label>
                  <div className="s-updateprofil-1d5e50">
                    <input
                      {...register("password")}
                      className={`${inputCls(errors.password)} s-login-51c683`}
                      type={hidePass ? "password" : "text"}
                      placeholder="Min. 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setHidePass((v) => !v)}
                      className="s-login-af8e0d"
                    >
                      <i
                        className={`bi ${hidePass ? "bi-eye-slash" : "bi-eye"}`}
                      />
                    </button>
                  </div>
                  {errMsg(errors.password?.message)}
                </div>

                {/* Confirm Password */}
                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Confirm Pass *</label>
                  <input
                    {...register("confirmPassword")}
                    className={inputCls(errors.confirmPassword)}
                    type="password"
                  />
                  {errMsg(errors.confirmPassword?.message)}
                </div>
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
                onClick={() => navigate("/login")}
                className="s-login-182bea"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
