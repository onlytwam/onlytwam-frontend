import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import api from "@/shared/api/axiosInstance";

export interface AdminLayoutOutletContext {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

// Role label map â€” Record<number,string> avoids ts(7053) implicit-any index error
const ROLE_LABELS: Record<number, string> = {
  1: "Super Admin",
  3: "Inventory Manager",
  4: "Store Manager", // updated by colleague (was Product Manager)
  5: "Order Manager",
  6: "Customer Support",
  7: "Warehouse Manager",
};

// Full nav pool â€” merged from both versions; union of roles so no access is lost
const ALL_NAV = [
  // Core Inventory Roles Order
  { path: "/admin/admin-dashboard", icon: "bi-speedometer2", label: "Dashboard", roles: [1, 3, 4, 5, 6] },
  { path: "/admin/products", icon: "bi-box-seam", label: "Products", roles: [1, 3, 4, 7] },
  { path: "/admin/product-bulk-upload", icon: "bi-upload", label: "Product Bulk Upload", roles: [1, 3] },
  { path: "/admin/categories", icon: "bi-folder", label: "Categories", roles: [1, 3] },
  { path: "/admin/brands", icon: "bi-bookmark-star", label: "Brands", roles: [1, 3] },
  { path: "/admin/MDM", icon: "bi-diagram-3", label: "MDM", roles: [1, 3] },
  { path: "/admin/bulk-import", icon: "bi-upload", label: "Bulk Upload", roles: [1, 3] },
  { path: "/admin/stores", icon: "bi-shop", label: "Stores", roles: [1, 3] },
  { path: "/admin/warehouses", icon: "bi-building", label: "Warehouses", roles: [1, 3] },
  { path: "/admin/assign-stock", icon: "bi-arrow-left-right", label: "Assign Stock", roles: [1, 3] },
  { path: "/admin/inventory", icon: "bi-clipboard-data", label: "Reports", roles: [1, 3] },

  // Other pages
  { path: "/admin/orders", icon: "bi-bag-check", label: "Orders", roles: [1, 5, 6] },
  { path: "/admin/store-settings", icon: "bi-folder", label: "Store Settings", roles: [1] },
  { path: "/admin/page-images", icon: "bi-image", label: "Page Images", roles: [1] },
  { path: "/admin/Billing", icon: "bi-folder", label: "Billing", roles: [1] },
  { path: "/admin/stock", icon: "bi-boxes", label: "Stock", roles: [1] }, 
  { path: "/admin/my-stock", icon: "bi-box-seam", label: "My Stock", roles: [4, 7] },
  { path: "/admin/coupons", icon: "bi-ticket-perforated", label: "Coupons", roles: [1, 5] },
  { path: "/admin/coupon-list", icon: "bi-list-ul", label: "Coupon List", roles: [1, 5] },
  { path: "/admin/surprise-gifts", icon: "bi-gift-fill", label: "Surprise Gifts", roles: [1, 5] },
  { path: "/admin/support", icon: "bi-headset", label: "Support Requests", roles: [1, 6] },
  { path: "/admin/sales-channels", icon: "bi-folder", label: "Sales Channels", roles: [1] },
  { path: "/admin/users", icon: "bi-people", label: "Users", roles: [1] },
  { path: "/admin/blog", icon: "bi-newspaper", label: "Blog", roles: [1] },
  { path: "/admin/api-tester", icon: "bi-bug", label: "API Tester", roles: [1] },
  { path: "/admin/failed-shipments", icon: "bi-exclamation-triangle-fill", label: "Failed Shipments", roles: [1, 5, 6], badge: true },
];

export default function AdminLayout() {
  const { isAuthenticated, isAdmin, getUserName, logout, user } =
    useAuthStore();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const roleId: number = (user as any)?.roleId ?? 0;
  const [failedShipmentsCount, setFailedShipmentsCount] = useState(0);

  // Poll failed shipments count every 60s to keep badge fresh
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    const fetch = () =>
      api.get("/Ekart/FailedShipments")
        .then((r) => setFailedShipmentsCount(r.data?.count ?? 0))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isAdmin]);

  // Redirect if not authenticated or not a staff role
  if (!isAuthenticated || !isAdmin) return <Navigate to="/login" replace />;

  // Filter nav items to only those the current role can see
  const NAV = ALL_NAV.filter((item) => item.roles.includes(roleId));
  const roleLabel = ROLE_LABELS[roleId] ?? "Admin";

  const defaultPath =
    roleId === 6 ? "/admin/support" : "/admin/admin-dashboard";

  const goToStore = () => {
    sessionStorage.setItem("adminViewingStore", "true");
    navigate("/");
  };

  return (
    <div
      className={`s-adminlayout-474885${
        isSidebarCollapsed ? " s-adminlayout-474885--collapsed" : ""
      }`}
    >
      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="s-adminlayout-358067">
        {/* Sidebar collapse control */}
        <div className="s-adminlayout-418b89">
          <h1 className="s-adminlayout-side-title">{roleId === 3 ? "Inventory Manager" : roleId === 4 ? "Store Manager" : roleId === 7 ? "Warehouse Manager" : "TWAM Admin"}</h1>
          <button
            type="button"
            className="s-adminlayout-collapse-btn"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={
              isSidebarCollapsed
                ? "Expand admin sidebar"
                : "Collapse admin sidebar"
            }
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <i
              className={`bi ${
                isSidebarCollapsed ? "bi-chevron-right" : "bi-chevron-left"
              }`}
            />
          </button>
        </div>

        {/* Role-filtered navigation */}
        <nav className="s-adminlayout-482ea2">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `s-adminlayout-navlink${isActive ? " is-active" : ""}`
              }
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <i className={`bi ${item.icon} s-adminlayout-c758b0`} />
              <span className="s-adminlayout-navlabel">{item.label}</span>
              {(item as any).badge && failedShipmentsCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#c0392b",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  textAlign: "center",
                }}>
                  {failedShipmentsCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="s-adminlayout-0b2dc0">
          <p className="s-adminlayout-185312">Signed in as</p>
          <p className="s-adminlayout-700e11">{getUserName()}</p>
          <button onClick={goToStore} className="s-adminlayout-c2ed36">
            <i className="bi bi-shop" />
            <span className="s-adminlayout-action-label">View Store</span>
          </button>
          <button
            onClick={() => {
              logout({ showToast: true });
              navigate("/login");
            }}
            className="s-adminlayout-e5f366"
          >
            <i className="bi bi-box-arrow-right" />
            <span className="s-adminlayout-action-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
      <main className="s-adminlayout-5679e3">
        <div className="s-adminlayout-5527a1">
          <div className="s-adminlayout-header-brand">
            <img
              src="/assets/Twam-Logo-White.png"
              alt="TWAM"
              className="s-adminlayout-header-logo"
            />
          </div>
          <span className="s-adminlayout-217eb8">{roleLabel}</span>
        </div>
        <div className="s-adminlayout-52a355">
          <Outlet
            context={{
              isSidebarCollapsed,
              setSidebarCollapsed: setIsSidebarCollapsed,
            }}
          />
        </div>
      </main>
    </div>
  );
}


