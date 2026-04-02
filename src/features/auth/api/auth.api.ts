// src/api/auth.api.ts — Login fix
// Fix 1: Use crypto-js for AES encryption (matches Angular exactly, no Web Crypto edge cases)
// Fix 2: OTP-based forgot password flow added

import axios from 'axios';
import CryptoJS from 'crypto-js';
import api from '@/shared/api/axiosInstance';
import type { AuthenticationModel } from '@/shared/types';

const AUTH_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace('/api', '');

function encryptPassword(plain: string): string {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv  = CryptoJS.enc.Utf8.parse('8080808080808080');
  const encrypted = CryptoJS.AES.encrypt(plain, key, {
    iv,
    mode:    CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

export const loginWithPassword = async (email: string, password: string) => {
  const encrypted = encryptPassword(password);
  const params = new URLSearchParams();
  params.append('grant_type',    'password');
  params.append('username',      email);
  params.append('password',      encrypted);
  params.append('client_id',     'twam-web-portal');
  params.append('client_secret', 'twamsecret');
  params.append('scope',         'openid email profile read write');
  const response = await axios.post(`${AUTH_BASE}/connect/token`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
};

export const getUserInfo = async (token?: string) => {
  const t = token || localStorage.getItem('access_token');
  const response = await axios.get(`${AUTH_BASE}/connect/userinfo`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return response.data;
};

export const normalizeUserInfo = (raw: any) => ({
  userId:      raw.sub          || raw.UserId        || '',
  email:       raw.email_id     || raw.email         || '',
  roleId:      Number(raw.RoleId     || raw.roleId        || 0),
  firstName:   raw.FirstName    || raw.first_name    || '',
  middleName:  raw.MiddleName   || raw.middle_name   || '',
  lastName:    raw.LastName     || raw.last_name     || '',
  name:        raw.name         || `${raw.FirstName || ''} ${raw.LastName || ''}`.trim(),
  phoneNumber: raw.PhoneNumber  || raw.phone_number  || '',
  isActive:    raw.is_active !== undefined ? raw.is_active : true,
});

export const registerUser = async (user: AuthenticationModel) => {
  const response = await api.post('/register/signup', user);
  return response.data;
};

// ── Forgot password — Send OTP to email
export const sendForgotPasswordOtp = async (emailId: string) => {
  const response = await api.post('/register/SendForgotPasswordOtp', { EmailId: emailId });
  return response.data;
};

// ── Verify OTP — returns reset token on success
export const verifyForgotPasswordOtp = async (emailId: string, otp: string) => {
  const response = await api.post('/register/VerifyForgotPasswordOtp', {
    EmailId: emailId,
    Otp:     otp,
  });
  return response.data; // expected: { token: string } or { Token: string }
};

// ── Reset password using verified token
export const resetPasswordWithToken = async (params: {
  emailId:     string;
  token:       string;
  newPassword: string;
}) => {
  const response = await api.post('/register/ResetPassword', {
    EmailId:     params.emailId,
    Token:       params.token,
    NewPassword: encryptPassword(params.newPassword),
  });
  return response.data;
};

// ── Legacy reset (link-based) — kept for backward compat
export const forgotPassword = async (params: { emailId: string; subject?: string }) => {
  const response = await api.post('/register/SendResetPasswordLink', {
    EmailId: params.emailId,
    Subject: params.subject || 'Reset Your Password',
  });
  return response.data;
};

export const changePassword = async (params: {
  emailId:         string;
  currentPassword: string;
  newPassword:     string;
}) => {
  const response = await api.post('/register/ChangePassword', {
    EmailId:         params.emailId,
    CurrentPassword: encryptPassword(params.currentPassword),
    NewPassword:     encryptPassword(params.newPassword),
  });
  return response.data;
};

export const updateProfile = async (params: {
  emailId:     string;
  firstName:   string;
  middleName?: string;
  lastName:    string;
  phoneNumber: string;
}) => {
  const response = await api.post('/register/update', {
    EmailId:     params.emailId,
    FirstName:   params.firstName,
    MiddleName:  params.middleName || '',
    LastName:    params.lastName,
    PhoneNumber: params.phoneNumber,
  });
  return response.data;
};

export const getCategories = async (params: any) => {
  const response = await api.post('/Category/GetCategory', params);
  return response.data?.categories || [];
};

export const getMenuList = async (params: any) => {
  const response = await api.post('/Menu/GetMenu', params);
  return response.data?.menus || [];
};
