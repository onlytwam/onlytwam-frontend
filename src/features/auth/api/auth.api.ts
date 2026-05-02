// src/features/auth/api/auth.api.ts
// Updated to support:
//  • Phone or email sign-in / sign-up
//  • Multi-channel forgot-password OTP (check → channel picker → send → verify+reset)
//  • Guest checkout OTP via phone or email

import axios from "axios";
import CryptoJS from "crypto-js";
import api from "@/shared/api/axiosInstance";
import type { AuthenticationModel } from "@/shared/types";

const AUTH_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"
).replace("/api", "");

export function encryptPassword(plain: string): string {
  const key = CryptoJS.enc.Utf8.parse("8080808080808080");
  const iv = CryptoJS.enc.Utf8.parse("8080808080808080");
  const encrypted = CryptoJS.AES.encrypt(plain, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}




// ── Login — accepts email OR phone number ─────────────────────────────────────
export const loginWithPassword = async (
  identifier: string,
  password: string,
) => {
  const encrypted = encryptPassword(password);
  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("username", identifier); // email or 10-digit phone
  params.append("password", encrypted);
  params.append("client_id", "twam-web-portal");
  params.append("client_secret", "twamsecret");
  params.append("scope", "openid email profile read write");
  const response = await axios.post(`${AUTH_BASE}/connect/token`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
};

export const getUserInfo = async (token?: string) => {
  const t = token || localStorage.getItem("access_token");
  const response = await axios.get(`${AUTH_BASE}/connect/userinfo`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return response.data;
};

// export const normalizeUserInfo = (raw: any) => ({
//   userId: raw.sub || raw.UserId || "",
//   email: raw.email_id || raw.email || "",
//   roleId: Number(raw.RoleId || raw.roleId || 0),
//   firstName: raw.FirstName || raw.first_name || "",
//   middleName: raw.MiddleName || raw.middle_name || "",
//   lastName: raw.LastName || raw.last_name || "",
//   name: raw.name || `${raw.FirstName || ""} ${raw.LastName || ""}`.trim(),
//   phoneNumber: raw.PhoneNumber || raw.phone_number || "",
//   profileImageUrl:
//     raw.ProfileImageUrl || raw.profileImageUrl || raw.profile_image_url || "",
//   isActive: raw.is_active !== undefined ? raw.is_active : true,
//   isRandomPassword: (() => {
//     const value =
//       raw.IsRandomPassword ??
//       raw.is_random_password ??
//       raw.isRandomPassword ??
//       false;
//     if (typeof value === "boolean") return value;
//     if (typeof value === "number") return value !== 0;
//     if (typeof value === "string") {
//       const normalized = value.trim().toLowerCase();
//       return ["1", "true", "yes", "on"].includes(normalized);
//     }
//     return Boolean(value);
//   })(),
// });





export const normalizeUserInfo = (raw: any) => ({
  userId:          raw.sub || raw.UserId || "",
  email:           raw.email_id || raw.email || "",
  roleId:          Number(raw.RoleId || raw.roleId || 0),
  firstName:       raw.FirstName || raw.first_name || "",
  middleName:      raw.MiddleName || raw.middle_name || "",
  lastName:        raw.LastName || raw.last_name || "",
  name:            raw.name || `${raw.FirstName || ""} ${raw.LastName || ""}`.trim(),
  phoneNumber:     raw.PhoneNumber || raw.phone_number || "",
  profileImageUrl: raw.ProfileImageUrl || raw.profileImageUrl || raw.profile_image_url || "",
  isActive:        raw.is_active !== undefined ? raw.is_active : true,
  
  // ── ADD THESE TWO ──────────────────────────────────────────────
  storeId:       raw.storeId       ?? raw.StoreId       ?? raw.store_id       ?? null,
  warehouseId:   raw.warehouseId   ?? raw.WarehouseId   ?? raw.warehouse_id   ?? null,
  warehouseName: raw.warehouseName ?? raw.WarehouseName ?? raw.warehouse_name ?? "",
  storeName:     raw.storeName     ?? raw.StoreName     ?? raw.store_name     ?? "",
  // ───────────────────────────────────────────────────────────────

  isRandomPassword: (() => {
    const value = raw.IsRandomPassword ?? raw.is_random_password ?? raw.isRandomPassword ?? false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    }
    return Boolean(value);
  })(),
});

export const registerUser = async (user: AuthenticationModel) => {
  const response = await api.post("/auth/signup", user);
  return response.data;
};

// ── OTP — universal (email and/or phone) ─────────────────────────────────────

/** Send OTP to email and/or phone. purpose: guest_checkout | login | verify
 *  channel: 'whatsapp' | 'sms' — only used when phone is given; backend defaults to 'whatsapp'
 */
export const sendOtp = async (params: {
  email?: string;
  phone?: string;
  purpose?: string;
  channel?: "whatsapp" | "sms";
}) => {
  const response = await api.post("/auth/send-otp", {
    email: params.email || undefined,
    phone: params.phone || undefined,
    purpose: params.purpose || "guest_checkout",
    ...(params.channel ? { channel: params.channel } : {}),
  });
  return response.data; // { success, channels: ['email'|'phone'|'whatsapp'|'sms'], message }
};

/** Verify OTP. identifier = email or phone */
export const verifyOtpUniversal = async (params: {
  identifier: string;
  otp: string;
  purpose?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  newPassword?: string;
}) => {
  const response = await api.post("/auth/verify-otp", {
    identifier: params.identifier,
    otp: params.otp,
    purpose: params.purpose || "guest_checkout",
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    phone: params.phone,
    newPassword: params.newPassword,
  });
  return response.data; // { success, access_token?, token_type?, message }
};

// ── Forgot Password — 3-step multi-channel flow ───────────────────────────────

/**
 * Step 1: check what channels this account has.
 * Returns { hasEmail, hasPhone, maskedEmail?, maskedPhone? }
 * Always returns 200, even for unknown accounts.
 */
export const checkForgotPasswordChannels = async (identifier: string) => {
  const response = await api.post("/auth/forgot-password/check", {
    identifier,
  });
  return response.data as {
    registered: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    maskedEmail: string | null;
    maskedPhone: string | null;
  };
};

/**
 * Step 2: send OTP to the chosen channel.
 * channel: 'email' | 'whatsapp' | 'sms'
 */
export const sendForgotPasswordOtpToChannel = async (
  identifier: string,
  channel: "email" | "whatsapp" | "sms",
) => {
  const response = await api.post("/auth/forgot-password/send-otp", {
    identifier,
    channel,
  });
  return response.data;
};

/**
 * Step 3: verify OTP + reset password in one call.
 */
export const verifyForgotPasswordOtpAndReset = async (params: {
  identifier: string;
  otp: string;
  newPassword: string;
}) => {
  const response = await api.post("/auth/forgot-password/verify-otp", {
    identifier: params.identifier,
    otp: params.otp,
    newPassword: encryptPassword(params.newPassword),
    purpose: "forgot_password",
  });
  return response.data;
};

// ── Legacy aliases (kept so any existing callers don't break) ─────────────────
export const sendForgotPasswordOtp = (emailId: string) =>
  checkForgotPasswordChannels(emailId); // old code expected this shape — callers updated below
export const verifyForgotPasswordOtp = (emailId: string, otp: string) =>
  verifyOtpUniversal({ identifier: emailId, otp, purpose: "forgot_password" });
export const sendOtpEmail = sendForgotPasswordOtp;
export const verifyOtp = verifyForgotPasswordOtp;

export const resetPasswordWithToken = async (params: {
  emailId: string;
  token: string;
  newPassword: string;
}) => {
  const response = await api.post("/auth/ResetPassword", {
    EmailId: params.emailId,
    Token: params.token,
    NewPassword: encryptPassword(params.newPassword),
  });
  return response.data;
};

export const resetPassword = async (
  token: string,
  newPassword: string,
  emailId = "",
) => resetPasswordWithToken({ emailId, token, newPassword });

export const forgotPassword = async (params: {
  emailId: string;
  subject?: string;
}) => {
  const response = await api.post("/auth/SendResetPasswordLink", {
    EmailId: params.emailId,
    Subject: params.subject || "Reset Your Password",
  });
  return response.data;
};

export const changePassword = async (params: {
  newPassword: string;
}) => {
  const response = await api.post("/auth/ChangePassword", {
    NewPassword: encryptPassword(params.newPassword),
  });
  return response.data;
};

export const updateProfile = async (params: {
  emailId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber: string;
  profileImage?: File | null;
  profileImageData?: string | null;
  removeProfileImage?: boolean;
}) => {
  const formData = new FormData();
  formData.append("emailId", params.emailId);
  formData.append("firstName", params.firstName);
  formData.append("middleName", params.middleName || "");
  formData.append("lastName", params.lastName);
  formData.append("phoneNumber", params.phoneNumber);
  if (params.removeProfileImage) formData.append("removeProfileImage", "true");
  if (params.profileImage) formData.append("profileImage", params.profileImage);
  if (params.profileImageData)
    formData.append("profileImageData", params.profileImageData);
  const response = await api.post("/auth/update", formData);
  return response.data;
};

export const getCategories = async (params: any) => {
  const response = await api.post("/Category/GetCategory", params);
  return response.data?.categories || [];
};

export const getMenuList = async (params: any) => {
  const response = await api.post("/Menu/GetMenu", params);
  return response.data?.menus || [];
};