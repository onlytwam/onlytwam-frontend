// main.tsx — startup rehydration + guest menu loading
// Toasts are configured to appear CENTERED (not top-right corner)

// Validate required env vars at startup — throws in dev if .env is missing
import "leaflet/dist/leaflet.css";
import "@/lib/env";

// Global styles (consolidated from index.css + component CSS files)
import "./twam.css";
import "./mobile.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./app/App";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { useMenuStore } from "@/shared/store/menuStore";
import {
  getCategories,
  getUserInfo,
  normalizeUserInfo,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { getUserDashboard } from "@/features/products/api/products.api";

// Exported so non-component code (e.g. authStore) can call invalidateQueries
// directly without violating Rules of Hooks (useQueryClient is a hook).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AppToaster() {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768,
  );

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mobileBaseStyle = {
    fontFamily: "var(--font-body)",
    background: "#ffffff",
    color: "var(--brand)",
    border: "1px solid rgba(107, 15, 42, 0.12)",
    borderRadius: "14px",
    padding: "10px 12px",
    boxShadow: "0 8px 18px rgba(107, 15, 42, 0.08)",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: "1.4",
    width: "100%",
    maxWidth: "100%",
  } as const;

  const desktopBaseStyle = {
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
  } as const;

  return (
    <Toaster
      position="top-center"
      containerStyle={
        isMobile
          ? {
              position: "fixed",
              top: "calc(env(safe-area-inset-top) + 72px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 99999,
              width: "min(calc(100vw - 20px), 336px)",
            }
          : {
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 99999,
            }
      }
      toastOptions={{
        duration: isMobile ? 2200 : 1600,
        style: isMobile ? mobileBaseStyle : desktopBaseStyle,
        success: {
          style: isMobile
            ? {
                ...mobileBaseStyle,
                background: "var(--ivory)",
                border: "1px solid rgba(107, 15, 42, 0.14)",
              }
            : {
                background: "var(--brand)",
                color: "var(--ivory)",
                border: "1.5px solid #9E6070",
              },
          iconTheme: {
            primary: isMobile ? "var(--brand)" : "var(--ivory)",
            secondary: isMobile ? "var(--ivory)" : "var(--brand)",
          },
        },
        error: {
          style: isMobile
            ? {
                ...mobileBaseStyle,
                background: "#fff7f8",
                border: "1px solid rgba(168, 76, 107, 0.18)",
                color: "var(--brand)",
              }
            : {
                background: "var(--blush)",
                color: "#fff",
                border: "1.5px solid #6B0F2A",
              },
          iconTheme: {
            primary: isMobile ? "var(--brand)" : "#fff",
            secondary: isMobile ? "#fff7f8" : "var(--blush)",
          },
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                gap: isMobile ? 10 : 8,
                width: "100%",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {icon}
                <div style={{ minWidth: 0, flex: 1 }}>{message}</div>
              </div>
              {t.type !== "loading" && t.type !== "custom" && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Close"
                  className="s-main-935245"
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}

// Fetch menus for a role and cache them. Returns true if menus were applied.
async function loadMenus(roleId: number): Promise<boolean> {
  try {
    const cats = await getCategories({ roleId });
    if (cats.length > 0) {
      sessionStorage.setItem("menus", JSON.stringify(cats));
      useMenuStore.getState().setMenus(cats);
      return true;
    }
  } catch {
    /* network error */
  }
  return false;
}

async function bootstrap() {
  // ── Guest menu: use the session cache, fall back to the network ──────────
  const cached = sessionStorage.getItem("menus");
  let usedCache = false;

  if (cached) {
    try {
      const menus = JSON.parse(cached);
      if (menus.length > 0) {
        useMenuStore.getState().setMenus(menus);
        usedCache = true;
      }
    } catch {
      /* corrupt cache — fall through to network */
    }
  }

  if (!usedCache) {
    await loadMenus(2);
  }

  // ── Logged-in user: rehydrate session ────────────────────────────────────
  const token = localStorage.getItem("access_token");
  if (!token) return;

  try {
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <AppToaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

void bootstrap().catch((error) => {
  console.error("Bootstrap failed:", error);
});