// main.tsx — startup rehydration + guest menu loading
// Toasts are configured to appear CENTERED (not top-right corner)

// Validate required env vars at startup — throws in dev if .env is missing
import "@/lib/env";

// Global styles (consolidated from index.css + component CSS files)
import "./twam.css";
import "./mobile.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./app/App";
import { Toaster, ToastBar, toast } from "react-hot-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

async function bootstrap() {
  const { useMenuStore } = await import("@/shared/store/menuStore");
  const { getCategories } = await import("@/features/auth/api/auth.api");

  const cached = sessionStorage.getItem("menus");
  if (cached) {
    try {
      const menus = JSON.parse(cached);
      if (menus.length > 0) {
        useMenuStore.getState().setMenus(menus);
      } else {
        throw new Error("empty cache");
      }
    } catch {
      try {
        const cats = await getCategories({ roleId: 2 });
        if (cats.length > 0) {
          sessionStorage.setItem("menus", JSON.stringify(cats));
          useMenuStore.getState().setMenus(cats);
        }
      } catch {
        /* network error */
      }
    }
  } else {
    try {
      const cats = await getCategories({ roleId: 2 });
      if (cats.length > 0) {
        sessionStorage.setItem("menus", JSON.stringify(cats));
        useMenuStore.getState().setMenus(cats);
      }
    } catch {
      /* network error */
    }
  }

  const token = localStorage.getItem("access_token");
  if (!token) return;

  try {
    const { useAuthStore } = await import("@/features/auth/store/authStore");
    const { getUserInfo, normalizeUserInfo } =
      await import("@/features/auth/api/auth.api");

    const raw = await getUserInfo(token);
    const userInfo = normalizeUserInfo(raw);
    useAuthStore.getState().login(userInfo as any, token);

    if (userInfo.roleId !== 2) {
      const roleCats = await getCategories({ roleId: userInfo.roleId });
      if (roleCats.length > 0) {
        sessionStorage.setItem("menus", JSON.stringify(roleCats));
        useMenuStore.getState().setMenus(roleCats);
      }
    }

    try {
      const { getUserDashboard } =
        await import("@/features/products/api/products.api");
      const dash = await getUserDashboard({ userProfileId: userInfo.userId });
      if (dash?.cartCount !== undefined)
        useAuthStore.getState().setCartCount(dash.cartCount);
      if (dash?.wishlistCount !== undefined)
        useAuthStore.getState().setWishlistCount(dash.wishlistCount);
    } catch {
      /* counts not critical */
    }
  } catch {
    localStorage.removeItem("access_token");
  }
}

bootstrap().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
          {/*
            Toast configuration:
            position="top-center" combined with the CSS override in index.css
            centres all notification popups on screen.
          */}
          <Toaster
            position="top-center"
            containerStyle={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 99999,
            }}
            toastOptions={{
              duration: 1600,
              style: {
                fontFamily: "var(--font-heading)",
                background: "var(--ivory)",
                color: "var(--brand)",
                border: "1.5px solid #9E6070",
                borderRadius: "12px",
                padding: "13px 20px",
                boxShadow: "0 12px 36px rgba(107,15,42,.18)",
                fontSize: "14px",
                fontWeight: "600",
                maxWidth: "360px",
              },
              success: {
                style: {
                  background: "var(--brand)",
                  color: "var(--ivory)",
                  border: "1.5px solid #9E6070",
                },
                iconTheme: {
                  primary: "var(--ivory)",
                  secondary: "var(--brand)",
                },
              },
              error: {
                style: {
                  background: "var(--blush)",
                  color: "#fff",
                  border: "1.5px solid #6B0F2A",
                },
                iconTheme: { primary: "#fff", secondary: "var(--blush)" },
              },
            }}
          >
            {(t) => (
              <ToastBar toast={t}>
                {({ icon, message }) => (
                  <>
                    {icon}
                    {message}
                    {t.type !== "loading" && t.type !== "custom" && (
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        aria-label="Close"
                        className="s-main-935245"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </>
                )}
              </ToastBar>
            )}
          </Toaster>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
});
