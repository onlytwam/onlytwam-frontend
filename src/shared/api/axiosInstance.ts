// src/shared/api/axiosInstance.ts
// FIX: On auth error, call useAuthStore.getState().logout() BEFORE redirect
//      so Zustand in-memory state is cleared (not just localStorage).
//      Lazy import avoids circular dependency.

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Request: attach JWT ────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: global auth error handling ──────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || "";

    const isAuthError =
      status === 401 ||
      (status === 403 &&
        (detail.includes("Authentication required") ||
          detail.includes("session has expired") ||
          detail.includes("Invalid authentication") ||
          detail.includes("Please log in")));

    if (isAuthError) {
      const publicPaths = [
        "/login",
        "/register",
        "/verify-otp",
        "/reset-password",
        "/",
      ];
      const currentPath = window.location.pathname;
      const isPublicPage = publicPaths.some(
        (p) => currentPath === p || currentPath.startsWith(p + "?"),
      );

      if (!isPublicPage) {
        // FIX: clear Zustand store state (not just localStorage)
        try {
          const { useAuthStore } =
            await import("@/features/auth/store/authStore");
          useAuthStore.getState().logout();
        } catch {
          // Fallback: manually clear storage if store import fails
          localStorage.removeItem("access_token");
          localStorage.removeItem("twam_user");
          localStorage.removeItem("twam_role_id");
        }

        sessionStorage.setItem(
          "redirect_after_login",
          window.location.pathname + window.location.search,
        );
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
