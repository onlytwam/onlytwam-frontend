/**
 * features/auth/hooks/useAuth.ts
 * ───────────────────────────────
 * TanStack Query mutations for login, register, and password reset flows.
 * Wraps the auth API calls with proper error handling and
 * store updates so components don't need to do it manually.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import {
  loginWithPassword,
  getUserInfo,
  normalizeUserInfo,
  registerUser,
  resetPassword,
} from '../api/auth.api';

const qcKey = ['user'] as const;

// ── Login ─────────────────────────────────────────────────────────────────────
export function useLogin() {
  const { login } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const tokenData = await loginWithPassword(email, password);
      const token = tokenData.access_token;
      const raw = await getUserInfo(token);
      return { user: normalizeUserInfo(raw) as any, token };
    },
    onSuccess: ({ user, token }) => {
      login(user, token);
      qc.invalidateQueries({ queryKey: qcKey });
      toast.success(`Welcome back, ${user.firstName || 'there'}!`);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error_description ||
        err?.response?.data?.message ||
        'Login failed. Check your credentials.';
      toast.error(msg);
    },
  });
}

// ── Register ──────────────────────────────────────────────────────────────────
export function useRegister() {
  return useMutation({
    mutationFn: (data: Parameters<typeof registerUser>[0]) => registerUser(data),
    onSuccess: () => {
      toast.success('Account created! Please sign in.');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Registration failed. Please try again.';
      toast.error(msg);
    },
  });
}

// ── Reset Password ────────────────────────────────────────────────────────────
export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      resetPassword(data.token, data.newPassword),
    onSuccess: () => {
      toast.success('Password reset successfully. You can now log in.');
    },
    onError: () => {
      toast.error('Password reset failed. The link may have expired.');
    },
  });
}
