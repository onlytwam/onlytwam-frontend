import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import AdminBar from "@/features/admin/components/AdminBar";
import Breadcrumb from "@/shared/components/Breadcrumb";
import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { ProfileLeaveGuardProvider } from "@/shared/components/profileLeaveGuard";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RouteMemory() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const excludedPrefixes = [
      "/wishlist",
      "/account",
      "/login",
      "/register",
      "/verify-otp",
      "/reset-password",
      "/cart",
      "/user-products/cart",
      "/user-products/payment-address",
      "/user-products/shipping-option",
      "/user-products/payment",
      "/user-products/order-confirm",
      "/user-products/payment-callback",
    ];

    if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }

    sessionStorage.setItem("lastPage", `${pathname}${search}`);
  }, [pathname, search]);

  return null;
}

// ── Public pages ──────────────────────────────────────────────────────────────
const Home = lazy(() => import("@/features/content/pages/Home"));
const Login = lazy(() => import("@/features/auth/pages/Login"));
const Register = lazy(() => import("@/features/auth/pages/Register"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const VerifyOtp = lazy(() => import("@/features/auth/pages/VerifyOtp"));
const About = lazy(() => import("@/features/content/pages/About"));
const ContactUs = lazy(() => import("@/features/content/pages/ContactUs"));
const Unsubscribe = lazy(() => import("@/features/content/pages/Unsubscribe"));
const OurStores = lazy(() => import("@/features/content/pages/OurStores"));
const OurBlog = lazy(() => import("@/features/content/pages/OurBlog"));
const Blog1 = lazy(() => import("@/features/content/pages/Blog1"));
const HelpCenter = lazy(() => import("@/features/content/pages/HelpCenter"));
const PrivacyPolicy = lazy(
  () => import("@/features/content/pages/PrivacyPolicy"),
);
const TermsConditions = lazy(
  () => import("@/features/content/pages/TermsConditions"),
);
const ShippingInfo = lazy(() => import("@/features/orders/pages/ShippingInfo"));
const ReturnsExchanges = lazy(
  () => import("@/features/orders/pages/ReturnsExchanges"),
);
const DeliveryShippingPolicy = lazy(
  () => import("@/features/content/pages/DeliveryShippingPolicy"),
);
const ReturnRefundPolicy = lazy(
  () => import("@/features/orders/pages/ReturnRefundPolicy"),
);
const NewsPrivacyPolicy = lazy(
  () => import("@/features/content/pages/NewsPrivacyPolicy"),
);
const OnlyTwam = lazy(() => import("@/features/products/pages/OnlyTwam"));
const ShopBySize = lazy(() => import("@/features/products/pages/ShopBySize"));
const SizeGuide = lazy(() => import("@/features/products/pages/SizeGuide"));
const TwamBrands = lazy(() => import("@/features/products/pages/TwamBrands"));
const YourFitFinder = lazy(
  () => import("@/features/products/pages/YourFitFinder"),
);
const TakeQuiz = lazy(() => import("@/features/products/pages/TakeQuiz"));
const GlobalSearch = lazy(() => import("@/features/search/pages/GlobalSearch"));
const OrderDetails = lazy(() => import("@/features/orders/pages/OrderDetails"));
const ProductList = lazy(() => import("@/features/products/pages/ProductList"));
const NewArrivals = lazy(() => import("@/features/products/pages/NewArrivals"));
const BestSellers = lazy(() => import("@/features/products/pages/BestSellers"));

function ProductListWithKey() {
  const { categoryId } = useParams<{ categoryId: string }>();
  return <ProductList key={categoryId ?? "all"} />;
}

function AccountLayoutWithGuard() {
  return (
    <ProfileLeaveGuardProvider>
      <ProfileLayout />
    </ProfileLeaveGuardProvider>
  );
}

const ProductDetail = lazy(
  () => import("@/features/products/pages/ProductDetail"),
);
const Cart = lazy(() => import("@/features/cart/pages/Cart"));
const Payment = lazy(() => import("@/features/orders/pages/Payment"));
const PaymentAddress = lazy(
  () => import("@/features/orders/pages/PaymentAddress"),
);
const OrderConfirm = lazy(() => import("@/features/orders/pages/OrderConfirm"));
const PaymentCallback = lazy(
  () => import("@/features/orders/pages/PaymentCallback"),
);
const GuestSignup = lazy(() => import("@/features/auth/pages/GuestSignup"));
const ShippingOption = lazy(
  () => import("@/features/orders/pages/ShippingOption"),
);
const Invoice = lazy(() => import("@/features/orders/pages/Invoice"));
const ReturnOrder = lazy(
  () => import("@/features/orders/pages/returns/ReturnOrder"),
);
const ReturnReason = lazy(
  () => import("@/features/orders/pages/returns/ReturnReason"),
);
const DeliveryOption = lazy(
  () => import("@/features/orders/pages/returns/DeliveryOption"),
);
const RefundChoice = lazy(
  () => import("@/features/orders/pages/returns/RefundChoice"),
);
const ReturnConfirm = lazy(
  () => import("@/features/orders/pages/returns/ReturnConfirm"),
);

// ── Account pages ─────────────────────────────────────────────────────────────
const ProfileLayout = lazy(() => import("@/shared/components/ProfileLayout"));
const AccountHome = lazy(() => import("@/features/account/pages/AccountHome"));
const UserDashboard = lazy(
  () => import("@/features/account/pages/Userdashboard"),
);
const UpdateProfile = lazy(
  () => import("@/features/account/pages/UpdateProfile"),
);
const AddressList = lazy(() => import("@/features/account/pages/AddressList"));
const AddressForm = lazy(() => import("@/features/account/pages/AddressForm"));
const CouponsList = lazy(() => import("@/features/account/pages/CouponsList"));
const OrdersList = lazy(() => import("@/features/account/pages/OrdersList"));
const Notifications = lazy(
  () => import("@/features/account/pages/Notifications"),
);
// Wishlist is imported SEPARATELY — used in both the protected account route
// AND the public /wishlist route so guests can access it without logging in.
const Wishlist = lazy(() => import("@/features/account/pages/Wishlist"));
import { useWishlistLoader } from "@/features/account/hooks/useWishlist";
import { useCartLoader } from "@/features/cart/hooks/useCart";

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminLayout = lazy(
  () => import("@/features/admin/components/AdminLayout"),
);
const AdminDashboard = lazy(
  () => import("@/features/admin/pages/AdminDashboard"),
);
const AdminOrders = lazy(() => import("@/features/admin/pages/AdminOrders"));
const AdminProducts = lazy(
  () => import("@/features/admin/pages/AdminProducts"),
);
const AdminInventory = lazy(
  () => import("@/features/admin/pages/AdminInventory"),
);
const AdminReports = lazy(() => import("@/features/admin/pages/AdminReports"));
const AdminProductForm = lazy(
  () => import("@/features/admin/pages/AdminProductForm"),
);
const AdminCategories = lazy(
  () => import("@/features/admin/pages/AdminCategories"),
);
const AdminBrands = lazy(() => import("@/features/admin/pages/AdminBrands"));
const AdminSizes = lazy(() => import("@/features/admin/pages/AdminSizes"));
const AdminUsers = lazy(() => import("@/features/admin/pages/AdminUsers"));
const AdminCoupons = lazy(() => import("@/features/admin/pages/AdminCoupons"));
const AdminSupportRequests = lazy(
  () => import("@/features/admin/pages/AdminSupportRequests"),
);
const AdminBlog = lazy(() => import("@/features/admin/pages/AdminBlog"));
const AdminBulkUpload = lazy(
  () => import("@/features/admin/pages/AdminBulkUpload"),
);
// ── Layouts ───────────────────────────────────────────────────────────────────

// Routes that never get a breadcrumb (home, auth pages, admin, etc.)
const NO_BREADCRUMB_ROUTES = ["/", "/home"];
const NO_BREADCRUMB_PREFIXES = [
  "/login",
  "/register",
  "/verify-otp",
  "/reset-password",
  "/admin",
];

// Static breadcrumb definitions — [intermediate crumbs, final label]
// Home is always prepended automatically.
type StaticCrumbs = { label: string; path?: string }[];
const STATIC_ROUTE_CRUMBS: Record<string, StaticCrumbs> = {
  // ── Content
  "/about": [{ label: "About Us" }],
  "/contact-us": [{ label: "Contact Us" }],
  "/our-stores": [{ label: "Our Stores" }],
  "/our-blog": [{ label: "Our Blog" }],
  "/help-center": [{ label: "Help Center" }],
  "/privacy-policy": [{ label: "Privacy Policy" }],
  "/terms-conditions": [{ label: "Terms & Conditions" }],
  "/delivery-shipping-policy": [{ label: "Delivery & Shipping Policy" }],
  "/return-refund-policy": [{ label: "Return & Refund Policy" }],
  "/news-privacy-policy": [{ label: "Newsletter Privacy" }],
  "/unsubscribe": [{ label: "Unsubscribe" }],
  // ── Orders / shipping
  "/shipping-info": [{ label: "Shipping Info" }],
  "/returns-exchanges": [{ label: "Returns & Exchanges" }],
  "/order-details": [{ label: "Order Details" }],
  // ── Products (static section pages)
  "/only-twam": [{ label: "Only TWAM" }],
  "/shop-by-size": [{ label: "Shop by Size" }],
  "/size-guide": [{ label: "Size Guide" }],
  "/twam-brands": [{ label: "TWAM Brands" }],
  "/your-fit-founder": [{ label: "Your Fit Finder" }],
  "/take-quiz": [{ label: "Take Quiz" }],
  "/new-arrivals": [{ label: "New Arrivals" }],
  "/best-sellers": [{ label: "Best Sellers" }],
  // ── Products (list / detail / cart) — dynamic crumbs pushed via store
  "/user-products/product-list": [{ label: "All Products" }],
  "/user-products/cart": [{ label: "Cart" }],
  "/cart": [{ label: "Cart" }],
  "/wishlist": [{ label: "My Wishlist" }],
  // ── Checkout flow
  "/user-products/payment-address": [
    { label: "Cart", path: "/cart" },
    { label: "Address" },
  ],
  "/user-products/shipping-option": [
    { label: "Cart", path: "/cart" },
    { label: "Address", path: "/user-products/payment-address" },
    { label: "Shipping" },
  ],
  "/user-products/payment": [
    { label: "Cart", path: "/cart" },
    { label: "Address", path: "/user-products/payment-address" },
    { label: "Shipping", path: "/user-products/shipping-option" },
    { label: "Payment" },
  ],
  "/user-products/guest-signup": [
    { label: "Checkout" },
    { label: "Guest Sign Up" },
  ],
  // ── Returns
  "/user-products/return-order": [
    { label: "Returns" },
    { label: "Select Item" },
  ],
  "/user-products/return-reason": [{ label: "Returns" }, { label: "Reason" }],
  "/user-products/delivery-option": [
    { label: "Returns" },
    { label: "Delivery" },
  ],
  "/user-products/refund-choice": [{ label: "Returns" }, { label: "Refund" }],
  "/user-products/return-confirm": [{ label: "Returns" }, { label: "Confirm" }],
  // ── Account
  "/account/dashboard": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Dashboard" },
  ],
  "/account/update-profile": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "My Profile" },
  ],
  "/account/change-password": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Change Password" },
  ],
  "/account/address-list": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Addresses" },
  ],
  "/account/address-form": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Addresses", path: "/account/address-list" },
    { label: "Edit Address" },
  ],
  "/account/coupons-list": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Coupons" },
  ],
  "/account/orders-list": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "My Orders" },
  ],
  "/account/wishlist": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Wishlist" },
  ],
  "/account/notifications": [
    { label: "My Account", path: "/account/dashboard" },
    { label: "Notifications" },
  ],
};

function AutoBreadcrumb() {
  const { pathname } = useLocation();
  const { crumbs: storeCrumbs, clearCrumbs } = useBreadcrumbStore();

  // Clear any page-pushed crumbs when the route changes
  useEffect(() => {
    clearCrumbs();
  }, [pathname]);

  // Never show on home / auth / admin
  if (
    NO_BREADCRUMB_ROUTES.includes(pathname) ||
    NO_BREADCRUMB_PREFIXES.some((p) => pathname.startsWith(p))
  )
    return null;

  // Dynamic crumbs pushed by the page (ProductList category, ProductDetail name, etc.)
  if (storeCrumbs && storeCrumbs.length > 0) {
    return <Breadcrumb items={storeCrumbs} />;
  }

  // Exact-match static crumbs
  let trail = STATIC_ROUTE_CRUMBS[pathname];

  // Prefix match for parameterised routes (e.g. /order-details/123)
  if (!trail) {
    for (const [route, crumbs] of Object.entries(STATIC_ROUTE_CRUMBS)) {
      if (pathname.startsWith(route + "/") || pathname.startsWith(route)) {
        trail = crumbs;
        break;
      }
    }
  }

  if (!trail) return null;

  const items = [{ label: "Home", path: "/" }, ...trail];
  return <Breadcrumb items={items} />;
}

const MainLayout = () => (
  <div className="s-app-22e1be">
    <AdminBar />
    <Navbar />
    <AutoBreadcrumb />
    <main className="s-app-52dcac">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const PageLoader = () => (
  <div className="s-app-6f11a1">
    <div className="s-app-090d50" />
  </div>
);

export default function App() {
  useWishlistLoader(); // Load server wishlist IDs once so all cards show correct heart state
  useCartLoader(); // Load server cart count once so Navbar badge is correct for auth users
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <RouteMemory />
      <Routes>
        {/* ── Main layout (Navbar + Footer) ───────────────────────────────── */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/our-stores" element={<OurStores />} />
          <Route path="/our-blog" element={<OurBlog />} />
          <Route path="/blog-1/:id" element={<Blog1 />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/shipping-info" element={<ShippingInfo />} />
          <Route path="/returns-exchanges" element={<ReturnsExchanges />} />
          <Route
            path="/delivery-shipping-policy"
            element={<DeliveryShippingPolicy />}
          />
          <Route
            path="/return-refund-policy"
            element={<ReturnRefundPolicy />}
          />
          <Route path="/news-privacy-policy" element={<NewsPrivacyPolicy />} />
          <Route path="/only-twam" element={<OnlyTwam />} />
          <Route path="/shop-by-size" element={<ShopBySize />} />
          <Route path="/size-guide" element={<SizeGuide />} />
          <Route path="/twam-brands" element={<TwamBrands />} />
          <Route path="/your-fit-founder" element={<YourFitFinder />} />
          <Route path="/take-quiz" element={<TakeQuiz />} />
          <Route path="/global-search" element={<GlobalSearch />} />
          <Route path="/order-details/:id" element={<OrderDetails />} />

          {/* ── Products ── */}
          <Route
            path="/user-products/product-list"
            element={<ProductList key="all" />}
          />
          <Route
            path="/user-products/product-list/:categoryId"
            element={<ProductListWithKey />}
          />
          <Route path="/new-arrivals" element={<NewArrivals />} />
          <Route path="/best-sellers" element={<BestSellers />} />
          <Route
            path="/user-products/product-detail/:id/:name"
            element={<ProductDetail />}
          />
          <Route path="/user-products/cart" element={<Cart />} />
          <Route path="/cart" element={<Cart />} />
          <Route
            path="/user-products/payment-address"
            element={<PaymentAddress />}
          />
          <Route path="/user-products/payment" element={<Payment />} />
          <Route
            path="/user-products/order-confirm/:id"
            element={<OrderConfirm />}
          />
          <Route
            path="/user-products/payment-callback"
            element={<PaymentCallback />}
          />
          <Route
            path="/user-products/shipping-option"
            element={<ShippingOption />}
          />
          <Route
            path="/user-products/invoice-details/:id"
            element={<Invoice />}
          />
          <Route path="/user-products/guest-signup" element={<GuestSignup />} />

          {/* ── Returns ── */}
          <Route path="/user-products/return-order" element={<ReturnOrder />} />
          <Route
            path="/user-products/return-reason"
            element={<ReturnReason />}
          />
          <Route
            path="/user-products/delivery-option"
            element={<DeliveryOption />}
          />
          <Route
            path="/user-products/refund-choice"
            element={<RefundChoice />}
          />
          <Route
            path="/user-products/return-confirm"
            element={<ReturnConfirm />}
          />

          {/* ══════════════════════════════════════════════════════════════════
              PUBLIC WISHLIST — accessible to ALL users, no login required.
              Guests see their localStorage wishlist; logged-in users see
              the server wishlist (and a sync button if they have guest items).
              ════════════════════════════════════════════════════════════════ */}
          <Route path="/wishlist" element={<Wishlist />} />

          {/* ── Protected account pages ── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountLayoutWithGuard />}>
              <Route index element={<AccountHome />} />
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="update-profile" element={<UpdateProfile />} />
              <Route path="change-password" element={<UpdateProfile />} />
              <Route path="address-list" element={<AddressList />} />
              <Route path="address-form" element={<AddressForm />} />
              <Route path="address-form/:id" element={<AddressForm />} />
              <Route path="coupons-list" element={<CouponsList />} />
              <Route path="orders-list" element={<OrdersList />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="wishlist" element={<Wishlist />} />
            </Route>
          </Route>
        </Route>

        {/* ── Auth pages (no layout) ───────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Admin panel ─────────────────────────────────────────────────── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route
            index
            element={<Navigate to="/admin/admin-dashboard" replace />}
          />
          <Route path="admin-dashboard" element={<AdminDashboard />} />
          <Route path="bulk-import" element={<AdminBulkUpload />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id" element={<AdminProductForm />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="sizes" element={<AdminSizes />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="support" element={<AdminSupportRequests />} />
          <Route path="blog" element={<AdminBlog />} />
        </Route>

        {/* ── Fallback ────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
