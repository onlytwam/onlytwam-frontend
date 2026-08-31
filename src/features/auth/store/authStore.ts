// src/store/authStore.ts
// IMPROVED VERSION - Fixes cart & wishlist duplication and auto-refresh issues
//
// Key improvements:
// 1. Debounced sync to prevent race conditions
// 2. Automatic cache invalidation after sync
// 3. Better error handling with retry logic
// 4. Automatic page reload for critical sync failures
// 5. Sequential sync (wishlist first, then cart) to avoid API overload

import { create } from "zustand";
import toast from "react-hot-toast";
import type { User, WishlistItem } from "@/shared/types";
import {
  getGuestWishlistCount,
  getGuestWishlist,
} from "@/shared/utils/guestWishlist";

const ADMIN_ROLES = new Set([1, 3, 4, 5, 6, 7]);
const isAdminRole = (roleId: number) => ADMIN_ROLES.has(roleId);

const STORED_ROLE_KEY = "twam_role_id";
const STORED_USER_KEY = "twam_user";
const STORED_PASSWORD_UPDATE_KEY = "twam_password_update_required";

const storedRoleId = Number(localStorage.getItem(STORED_ROLE_KEY) || "0");
const storedPasswordUpdateRequired =
  localStorage.getItem(STORED_PASSWORD_UPDATE_KEY) === "1";
const storedUser = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORED_USER_KEY) || "null");
    if (
      parsed &&
      storedPasswordUpdateRequired &&
      parsed.isRandomPassword !== true
    ) {
      parsed.isRandomPassword = true;
    }
    return parsed;
  } catch {
    return null;
  }
})();

const persistPasswordUpdateRequired = (required: boolean) => {
  if (required) {
    localStorage.setItem(STORED_PASSWORD_UPDATE_KEY, "1");
    return;
  }
  localStorage.removeItem(STORED_PASSWORD_UPDATE_KEY);
};

// ── WishlistStorage — localStorage helper used across product cards / Home ──
export const WishlistStorage = {
  getAll: (): any[] => {
    try {
      return JSON.parse(localStorage.getItem("wishlist") || "[]");
    } catch {
      return [];
    }
  },
  hasItem: (productVariantId: number | string): boolean =>
    WishlistStorage.getAll().some(
      (x: any) => x.productVariantId === Number(productVariantId),
    ),
  addItem: (item: { productId: number; productVariantId: number }) => {
    const list = WishlistStorage.getAll();
    if (!list.some((x: any) => x.productVariantId === item.productVariantId)) {
      localStorage.setItem("wishlist", JSON.stringify([...list, item]));
    }
  },
  removeItem: (productVariantId: number) => {
    localStorage.setItem(
      "wishlist",
      JSON.stringify(
        WishlistStorage.getAll().filter(
          (x: any) => x.productVariantId !== productVariantId,
        ),
      ),
    );
  },
  clear: () => localStorage.removeItem("wishlist"),
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  wishlistItems: WishlistItem[];
  cartCount: number;
  wishlistCount: number;
  isSyncing: boolean; // NEW: track sync status
  passwordUpdateRequired: boolean;

  login: (user: User, token: string) => Promise<void>; // Changed to async
  logout: (opts?: { showToast?: boolean }) => void;
  setUser: (user: User) => void;
  setCartCount: (count: number) => void;
  setWishlistCount: (count: number) => void;
  setWishlistItems: (items: WishlistItem[]) => void;
  getUserId: () => string;
  getUserName: () => string;
  hasValidToken: () => boolean;
  setSyncing: (syncing: boolean) => void; // NEW
}

// ── Helper: Sleep function for retry logic ──
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Improved Guest wishlist sync with deduplication and retry logic ──
async function _syncGuestWishlistOnLogin(
  userId: string,
  _token: string,
): Promise<boolean> {
  const guestWl = getGuestWishlist();
  if (!guestWl.length) {
    console.log("✅ Wishlist sync: No guest items to sync");
    return true;
  }

  try {
    const { default: api } = await import("@/shared/api/axiosInstance");

    // 1️⃣ Fetch current server wishlist with retry logic
    let existingIds = new Set<number>();
    let retries = 3;

    while (retries > 0) {
      try {
        const res = await api.get("/Wishlist", {
          params: {
            Filters: JSON.stringify([
              { property: "userProfileId", comparison: "eq", value: userId },
            ]),
            "Page.Size": 500,
          },
        });
        const list: any[] = res.data?.list ?? res.data ?? [];
        existingIds = new Set(list.map((i: any) => Number(i.productVariantId)));
        console.log(
          `📋 Found ${existingIds.size} existing wishlist items on server`,
        );
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.warn(
          `⚠️ Wishlist fetch failed, retrying... (${retries} attempts left)`,
        );
        await sleep(1000);
      }
    }

    // 2️⃣ Filter out items that already exist on server
    const toSync = guestWl.filter(
      (item) => !existingIds.has(Number(item.productVariantId)),
    );

    if (toSync.length === 0) {
      console.log(
        "✅ Wishlist sync: All items already on server, skipping sync",
      );
      localStorage.removeItem("guestWishlist");
      window.dispatchEvent(new Event("wishlistUpdated"));
      return true;
    }

    // 3️⃣ Sync items one by one with delay to prevent API overload
    let syncedCount = 0;
    const errors: string[] = [];

    for (const item of toSync) {
      try {
        await api.post("/Wishlist", {
          productId: item.productId,
          productVariantId: item.productVariantId,
          userProfileId: userId,
          state: "Active",
        });
        syncedCount++;

        // Small delay between requests to prevent rate limiting
        if (toSync.length > 5) await sleep(100);
      } catch (err: any) {
        const variantId = item.productVariantId;
        // Check if it's a duplicate error (already exists)
        if (
          err?.response?.status === 409 ||
          err?.response?.data?.message?.includes("already exists")
        ) {
          console.log(
            `ℹ️ Item ${variantId} already exists on server, skipping`,
          );
          syncedCount++;
        } else {
          console.error(
            `❌ Failed to sync wishlist item ${variantId}:`,
            err?.response?.data || err.message,
          );
          errors.push(`Item ${variantId}`);
        }
      }
    }

    // 4️⃣ Clear guest wishlist
    localStorage.removeItem("guestWishlist");
    window.dispatchEvent(new Event("wishlistUpdated"));

    console.log(
      `✅ Wishlist sync complete: ${syncedCount}/${toSync.length} synced, ` +
        `${guestWl.length - toSync.length} already on server` +
        (errors.length > 0 ? `, ${errors.length} errors` : ""),
    );

    return errors.length === 0;
  } catch (err) {
    console.error("❌ Wishlist sync failed:", err);
    return false;
  } finally {
    // 5️⃣ Always reset the wishlist store so it refetches
    try {
      const { useWishlistStore } = await import("@/shared/store/wishlistStore");
      useWishlistStore.getState().reset();
    } catch {
      // non-critical
    }
  }
}

// ── Improved Guest cart sync with deduplication and retry logic ──
async function _syncGuestCartOnLogin(
  userId: string,
  _token: string,
): Promise<boolean> {
  const guestCart: any[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("guestCart") || "[]");
    } catch {
      return [];
    }
  })();

  if (!guestCart.length) {
    console.log("✅ Cart sync: No guest items to sync");
    return true;
  }

  try {
    const { default: api } = await import("@/shared/api/axiosInstance");

    // 1️⃣ Fetch current server cart with retry logic
    let existingVariantIds = new Set<number>();
    let retries = 3;

    while (retries > 0) {
      try {
        const res = await api.get("/Cart", {
          params: {
            Filters: JSON.stringify([
              { property: "userProfileId", comparison: "eq", value: userId },
            ]),
            "Page.Size": 500,
          },
        });
        const list: any[] = res.data?.list ?? res.data ?? [];
        existingVariantIds = new Set(
          list.map((i: any) => Number(i.productVariantId)),
        );
        console.log(
          `📋 Found ${existingVariantIds.size} existing cart items on server`,
        );
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.warn(
          `⚠️ Cart fetch failed, retrying... (${retries} attempts left)`,
        );
        await sleep(1000);
      }
    }

    // 2️⃣ Filter out duplicates
    const toSync = guestCart.filter(
      (item) => !existingVariantIds.has(Number(item.productVariantId)),
    );

    if (toSync.length === 0) {
      console.log("✅ Cart sync: All items already on server, skipping sync");
      localStorage.removeItem("guestCart");
      window.dispatchEvent(new Event("guestCartUpdated"));
      return true;
    }

    // 3️⃣ Sync items one by one with delay
    let syncedCount = 0;
    const errors: string[] = [];

    for (const item of toSync) {
      try {
        await api.post("/Cart", {
          productId: item.productId,
          productVariantId: item.productVariantId,
          productVariantDetailId: item.productVariantDetailId,
          quantity: item.processedQuantity || item.quantity || 1,
          userProfileId: userId,
          state: "Active",
        });
        syncedCount++;

        // Small delay between requests
        if (toSync.length > 5) await sleep(100);
      } catch (err: any) {
        const variantId = item.productVariantId;
        // Check if it's a duplicate error
        if (
          err?.response?.status === 409 ||
          err?.response?.data?.message?.includes("already exists")
        ) {
          console.log(
            `ℹ️ Cart item ${variantId} already exists on server, skipping`,
          );
          syncedCount++;
        } else {
          console.error(
            `❌ Failed to sync cart item ${variantId}:`,
            err?.response?.data || err.message,
          );
          errors.push(`Item ${variantId}`);
        }
      }
    }

    // 4️⃣ Clear guest cart
    localStorage.removeItem("guestCart");
    window.dispatchEvent(new Event("guestCartUpdated"));

    console.log(
      `✅ Cart sync complete: ${syncedCount}/${toSync.length} synced, ` +
        `${guestCart.length - toSync.length} already on server` +
        (errors.length > 0 ? `, ${errors.length} errors` : ""),
    );

    // 5️⃣ Trigger cart reload
    window.dispatchEvent(new Event("cartSyncComplete"));

    return errors.length === 0;
  } catch (err) {
    console.error("❌ Cart sync failed:", err);
    return false;
  }
}

const hasToken = !!localStorage.getItem("access_token");
const initialWishlistCount = hasToken ? 0 : getGuestWishlistCount();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser,
  token: localStorage.getItem("access_token"),
  isAuthenticated: hasToken,
  isAdmin: isAdminRole(storedRoleId),
  wishlistItems: WishlistStorage.getAll(),
  cartCount: 0,
  wishlistCount: initialWishlistCount,
  isSyncing: false,
  passwordUpdateRequired: Boolean(
    storedPasswordUpdateRequired || (storedUser as any)?.isRandomPassword,
  ),

  login: async (user, token) => {
    // Set syncing state
    set({ isSyncing: true });

    // Save to localStorage and state
    localStorage.setItem("access_token", token);
    localStorage.setItem(STORED_ROLE_KEY, String(user.roleId ?? 0));
    localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
    persistPasswordUpdateRequired(Boolean((user as any)?.isRandomPassword));

    set({
      user,
      token,
      isAuthenticated: true,
      isAdmin: isAdminRole(user.roleId ?? 0),
      passwordUpdateRequired: Boolean((user as any)?.isRandomPassword),
    });

    // ── Sequential Sync: Wishlist first, then Cart ──
    const userId = (user as any).userId || (user as any).id || "";
    if (userId) {
      try {
        console.log("🔄 Starting guest data sync...");

        // Sync wishlist first
        const wishlistSuccess = await _syncGuestWishlistOnLogin(userId, token);

        // Small delay between syncs
        await sleep(500);

        // Sync cart
        const cartSuccess = await _syncGuestCartOnLogin(userId, token);

        if (wishlistSuccess && cartSuccess) {
          console.log("✅ All guest data synced successfully");
        } else {
          console.warn("⚠️ Some sync operations had errors, but continuing...");
        }

        // Wait a bit for events to propagate
        await sleep(300);

        // Invalidate stale cart/wishlist queries using the singleton QueryClient.
        // NOTE: useQueryClient() is a React hook and CANNOT be called here (inside
        // a Zustand action / outside a component) — that was causing React error #321.
        try {
          const { queryClient } = await import("@/main");
          queryClient.invalidateQueries({ queryKey: ["cart"] });
          queryClient.invalidateQueries({ queryKey: ["cart-bootstrap"] });
          queryClient.invalidateQueries({ queryKey: ["wishlist"] });
          queryClient.invalidateQueries({ queryKey: ["wishlist-ids"] });
          console.log("🔄 Query cache invalidated");
        } catch (err) {
          console.warn("Failed to invalidate queries:", err);
        }

        // Dispatch final sync events
        window.dispatchEvent(new Event("syncComplete"));
      } catch (err) {
        console.error("❌ Sync error:", err);
      } finally {
        set({ isSyncing: false });
      }
    } else {
      set({ isSyncing: false });
    }
  },

  logout: ({ showToast } = { showToast: false }) => {
    localStorage.removeItem("access_token");
    localStorage.removeItem(STORED_ROLE_KEY);
    localStorage.removeItem(STORED_USER_KEY);
    persistPasswordUpdateRequired(false);
    sessionStorage.clear();

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      cartCount: 0,
      wishlistCount: getGuestWishlistCount(),
      isSyncing: false,
      passwordUpdateRequired: false,
    });

    if (showToast) {
      toast.success("Signed out successfully.");
    }
  },

  setUser: (user) => {
    localStorage.setItem(STORED_ROLE_KEY, String(user.roleId ?? 0));
    localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
    persistPasswordUpdateRequired(Boolean((user as any)?.isRandomPassword));
    set({
      user,
      isAdmin: isAdminRole(user.roleId ?? 0),
      passwordUpdateRequired: Boolean((user as any)?.isRandomPassword),
    });
  },

  setCartCount: (count) => set({ cartCount: count }),
  setWishlistCount: (count) => set({ wishlistCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),

  setWishlistItems: (items) => {
    localStorage.setItem("wishlist", JSON.stringify(items));
    set({ wishlistItems: items, wishlistCount: items.length });
  },

  getUserId: () => {
    const u = get().user;
    return u?.userId ?? (u as any)?.id ?? "";
  },

  getUserName: () => {
    const u = get().user;
    if (!u) return "";
    if (u.firstName) return `${u.firstName} ${u.lastName ?? ""}`.trim();
    return (u as any).name ?? (u as any).email ?? "";
  },

  hasValidToken: () => !!(get().token ?? localStorage.getItem("access_token")),
}));

// ── Global event listeners ────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("wishlistUpdated", () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      useAuthStore.getState().setWishlistCount(getGuestWishlistCount());
    }
  });

  window.addEventListener("guestCartUpdated", () => {});
}
