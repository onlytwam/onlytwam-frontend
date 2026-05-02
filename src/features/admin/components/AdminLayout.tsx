import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";

// Role label map — Record<number,string> avoids ts(7053) implicit-any index error
const ROLE_LABELS: Record<number, string> = {
  1: "Super Admin",
  3: "Inventory Manager",
  4: "Product Manager",
  5: "Order Manager",
  6: "Customer Support",
  7: 'Store Manager'
};

// Full nav pool — each item carries the roles allowed to see it
const ALL_NAV = [
  {
    path: "/admin/admin-dashboard",
    icon: "bi-speedometer2",
    label: "Dashboard",
    roles: [1, 4, 5, 6],
  },
  {
    path: "/admin/orders",
    icon: "bi-bag-check",
    label: "Orders",
    roles: [1, 5, 6],
  },
  {
    path: "/admin/products",
    icon: "bi-box-seam",
    label: "Products",
    roles: [1, 3, 4],
  },
  {
    path: "/admin/bulk-import",
    icon: "bi-upload",
    label: "Bulk Upload",
    roles: [1, 4],
  },
  {
    path: "/admin/product-bulk-upload",
    icon: "bi-upload",
    label: "Product Bulk Upload",
    roles: [1, 3, 4, 7],
  },
  {
    path: "/admin/categories",
    icon: "bi-folder",
    label: "Categories",
    roles: [1, 4],
  },
  {
    path: "/admin/store-settings",
    icon: "bi-folder",
    label: "Store Settings",
    roles: [1, 4],
  },
  {
    path: "/admin/Billing",
    icon: "bi-folder",
    label: "Billing",
    roles: [1,3, 4,7],
  },
  // { path: '/admin/brands',          icon: 'bi-bookmark-star',    label: 'Brands',           roles: [1,4] },
  // { path: '/admin/sizes',           icon: 'bi-rulers',           label: 'Sizes',            roles: [1,3] },
  { path: "/admin/MDM", icon: "bi-diagram-3", label: "MDM", roles: [1, 3, 4] },
  {
    path: "/admin/inventory",
    icon: "bi-clipboard-data",
    label: "Inventory",
    roles: [1, 3],
  },
  {
    path: "/admin/coupons",
    icon: "bi-ticket-perforated",
    label: "Coupons",
    roles: [1, 5],
  },
  {
    path: "/admin/surprise-gifts",
    icon: "bi-gift-fill",
    label: "Surprise Gifts",
    roles: [1, 5],
  },
  {
    path: "/admin/support",
    icon: "bi-headset",
    label: "Support Requests",
    roles: [1, 6],
  },
  { path: '/admin/sales-channels', icon:'bi-folder', label:'Sales Channels', roles:[1] },
  { path: "/admin/users", icon: "bi-people", label: "Users", roles: [1] },
  { path: "/admin/blog", icon: "bi-newspaper", label: "Blog", roles: [1] },
  {
    path: "/admin/reports",
    icon: "bi-bar-chart-line",
    label: "Reports",
    roles: [1, 5],
  },
  {
    path: "/admin/api-tester",
    icon: "bi-bug",
    label: "API Tester",
    roles: [1],
  },
];

export default function AdminLayout() {
  const { isAuthenticated, isAdmin, getUserName, logout, user } =
    useAuthStore();
  const navigate = useNavigate();
  const roleId: number = (user as any)?.roleId ?? 0;

  // Redirect if not authenticated or not a staff role
  if (!isAuthenticated || !isAdmin) return <Navigate to="/login" replace />;

  // Filter nav items to only those the current role can see
  const NAV = ALL_NAV.filter((item) => item.roles.includes(roleId));
  const roleLabel = ROLE_LABELS[roleId] ?? "Admin";

  const goToStore = () => {
    sessionStorage.setItem("adminViewingStore", "true");
    navigate("/");
  };

  return (
    <div className="s-adminlayout-474885">
      {/* ── Sidebar ── */}
      <aside className="s-adminlayout-358067">
        {/* Logo */}
        <div className="s-adminlayout-418b89">
          <img
            src="/assets/Twam-Logo-Black.png"
            alt="TWAM"
            className="s-adminlayout-563ef2"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.style.display = "none";
              const span = document.createElement("span");
              span.textContent = "TWAM Admin";
              span.style.cssText =
                "color:#fff;font-weight:800;font-size:16px;letter-spacing:2px";
              t.parentNode?.insertBefore(span, t);
            }}
          />
          <p className="s-adminlayout-94ca0e">{roleLabel}</p>
        </div>

        {/* Role-filtered navigation */}
        <nav className="s-adminlayout-482ea2">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 20px",
                textDecoration: "none",
                color: isActive ? "#fff" : "var(--heirloom)",
                background: isActive ? "rgba(106,1,42,.6)" : "transparent",
                borderLeft: isActive
                  ? "3px solid #6b0f2a"
                  : "3px solid transparent",
                fontSize: 13,
                transition: "all .15s",
              })}
            >
              <i className={`bi ${item.icon} s-adminlayout-c758b0`} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="s-adminlayout-0b2dc0">
          <p className="s-adminlayout-185312">Signed in as</p>
          <p className="s-adminlayout-700e11">{getUserName()}</p>
          <button onClick={goToStore} className="s-adminlayout-c2ed36">
            <i className="bi bi-shop" /> View Store
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="s-adminlayout-e5f366"
          >
            <i className="bi bi-box-arrow-right" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="s-adminlayout-5679e3">
        <div className="s-adminlayout-5527a1">
          <h1 className="s-adminlayout-6a1182">TWAM Admin</h1>
          <span className="s-adminlayout-217eb8">{roleLabel}</span>
        </div>
        <div className="s-adminlayout-52a355">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
