import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  registerUser,
  encryptPassword,
  loginWithPassword,
  getUserInfo,
  normalizeUserInfo,
  getCategories,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import AuthBackdrop from "@/features/auth/components/AuthBackdrop";
import { usePageImage, IMAGE_KEYS } from "@/features/images";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useMenuStore } from "@/shared/store/menuStore";
import toast from "react-hot-toast";

function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}

function isEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

const signupSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required").max(500),
    middleName: z.string().max(500).optional(),
    lastName: z.string().min(1, "Last Name is required").max(500),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .refine(isEmail, "Invalid email address"),
    phoneNumber: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .refine(isPhone, "10-digit phone number required"),
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
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const bgImage = usePageImage(IMAGE_KEYS.LOGIN_BACKGROUND);
  const { login } = useAuthStore();
  const { setMenus } = useMenuStore();
  const [loading, setLoading] = useState(false);
  const [hidePass, setHidePass] = useState(true);
  const redirectFromQuery = searchParams.get("redirect") || "";
  const checkoutReturnPath =
    redirectFromQuery.startsWith("/") && redirectFromQuery.includes("cart")
      ? redirectFromQuery
      : (location.state as any)?.from?.includes("cart")
      ? (location.state as any).from
      : "";
  const isCheckoutRegister =
    searchParams.get("checkout") === "1" || Boolean(checkoutReturnPath);

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

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      await registerUser({
        firstName: data.firstName,
        middleName: data.middleName || "",
        lastName: data.lastName,
        emailId: data.email,
        password: encryptPassword(data.password),
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
      });
      const returnPath = checkoutReturnPath || "/user-products/cart";

      if (isCheckoutRegister) {
        try {
          const tokenData = await loginWithPassword(data.email, data.password);
          const rawInfo = await getUserInfo(tokenData.access_token);
          const userInfo = normalizeUserInfo(rawInfo);
          const menus = await getCategories({ roleId: userInfo.roleId });
          sessionStorage.setItem("menus", JSON.stringify(menus));
          setMenus(menus);
          await login(userInfo as any, tokenData.access_token);
          toast.success("Account created. Your cart is ready.");
          reset();
          navigate(returnPath, { replace: true });
          return;
        } catch {
          toast.success("Account created! Please sign in to continue checkout.");
          reset();
          navigate(`/login?redirect=${encodeURIComponent(returnPath)}`, {
            replace: true,
          });
          return;
        }
      }

      toast.success("Account created! Please sign in.");
      reset();
      navigate("/login");
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors || err?.response?.data?.detail?.errors;
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

            {!isMobile && <h5 className="s-login-b4f13d">Sign Up</h5>}
            <p className="s-login-7a79e7">Create your TWAM account to shop faster and keep your orders in one place.</p>

            <form onSubmit={onSubmit}>
              <div className="s-login-9f425c">
                {(["firstName", "middleName", "lastName"] as const).map((key, i) => (
                  <div key={key}>
                    <label className="s-login-4d06e1">
                      {["First Name *", "Middle", "Last Name *"][i]}
                    </label>
                    <input {...register(key)} className={inputCls((errors as any)[key])} />
                    {errMsg((errors as any)[key]?.message)}
                  </div>
                ))}
              </div>

              <div className="s-login-863afe">
                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Email *</label>
                  <input
                    {...register("email")}
                    className={inputCls(errors.email)}
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                  {errMsg(errors.email?.message)}
                </div>

                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Phone Number *</label>
                  <input
                    {...register("phoneNumber")}
                    className={inputCls(errors.phoneNumber)}
                    type="tel"
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    required
                  />
                  {errMsg(errors.phoneNumber?.message)}
                </div>

                <div className="s-adminproduct-02d219" style={{ gridColumn: "1/-1" }}>
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
                      <i className={`bi ${hidePass ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>
                  {errMsg(errors.password?.message)}
                </div>

                <div className="s-adminproduct-02d219">
                  <label className="s-login-4d06e1">Confirm Pass *</label>
                  <input {...register("confirmPassword")} className={inputCls(errors.confirmPassword)} type="password" />
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
              <button onClick={() => navigate("/login")} className="s-login-182bea">
                Sign In
              </button>
            </p>
          </div>
        </div>
      </AuthBackdrop>
    </>
  );
}
