import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import MobileBackHeader from "@/shared/components/MobileBackHeader";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import AdminBar from "@/features/admin/components/AdminBar";
import Breadcrumb from "@/shared/components/Breadcrumb";
import { useBreadcrumbStore } from "@/shared/store/breadcrumbStore";
import { ProfileLeaveGuardProvider } from "@/shared/components/profileLeaveGuard";

// ── Platform detection ────────────────────────────────────────────────────────
const IS_NATIVE = Capacitor.isNativePlatform();

// Set true for 600ms when app returns from Android background so
// RouteTransitionOverlay doesn't fire a spinner over an already-rendered page.
let _isCapacitorResume = false;

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

type MobileBackHeaderRoute = {
  path: string;
  title: string;
};

const MOBILE_BACK_HEADER_ROUTES: MobileBackHeaderRoute[] = [
  { path: "/about", title: "About Us" },
  { path: "/contact-us", title: "Contact Us" },
  { path: "/unsubscribe", title: "Unsubscribe" },
  { path: "/our-stores", title: "Our Stores" },
  { path: "/our-blog", title: "Our Blog" },
  { path: "/blog-1", title: "Blog" },
  { path: "/help-center", title: "Help Center" },
  { path: "/privacy-policy", title: "Privacy Policy" },
  { path: "/terms-conditions", title: "Terms & Conditions" },
  { path: "/shipping-info", title: "Shipping Info" },
  { path: "/returns-exchanges", title: "Returns & Exchanges" },
  {
    path: "/delivery-shipping-policy",
    title: "Delivery & Shipping Policy",
  },
  { path: "/return-refund-policy", title: "Return & Refund Policy" },
  { path: "/news-privacy-policy", title: "Newsletter Privacy" },
  { path: "/only-twam", title: "Only TWAM" },
  { path: "/shop-by-size", title: "Shop by Size" },
  { path: "/size-guide", title: "Size Guide" },
  { path: "/twam-brands", title: "TWAM Brands" },
  { path: "/your-fit-founder", title: "Your Fit Finder" },
  { path: "/take-quiz", title: "Take Quiz" },
  { path: "/new-arrivals", title: "New Arrivals" },
  { path: "/best-sellers", title: "Best Sellers" },
  { path: "/user-products/cart", title: "Cart" },
  { path: "/cart", title: "Cart" },
  { path: "/user-products/payment-address", title: "Delivery Address" },
  { path: "/user-products/shipping-option", title: "Choose Shipping Method" },
  { path: "/user-products/payment", title: "Payment" },
  { path: "/wishlist", title: "My Wishlist" },
  { path: "/notifications", title: "Notifications" },
  { path: "/register", title: "Create Account" },
  { path: "/reset-password", title: "Reset Password" },
  { path: "/verify-otp", title: "Verify OTP" },
  { path: "/user-products/guest-signup", title: "Checkout" },
  { path: "/order-details", title: "Order Details" },
  { path: "/user-products/order-confirm", title: "Order Confirmed" },
  { path: "/user-products/payment-callback", title: "Payment Failed" },
  { path: "/user-products/invoice-details", title: "Invoice" },
  { path: "/user-products/return-order", title: "Return / Exchange" },
  { path: "/user-products/return-reason", title: "Reason for Return" },
  { path: "/user-products/delivery-option", title: "Delivery Option" },
  { path: "/user-products/refund-choice", title: "Refund Choice" },
  { path: "/user-products/return-confirm", title: "Confirm Return" },
];

function matchesMobileBackHeaderRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function getMobileBackHeaderTitle(pathname: string) {
  const match = MOBILE_BACK_HEADER_ROUTES.find((route) =>
    matchesMobileBackHeaderRoute(pathname, route.path),
  );
  return match?.title ?? null;
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
const AdminProductBulkUpload = lazy(() => import("@/features/admin/pages/AdminProductBulkUpload"));

// ── Breadcrumb ────────────────────────────────────────────────────────────────

const NO_BREADCRUMB_ROUTES = ["/", "/home"];
const NO_BREADCRUMB_PREFIXES = [
  "/login",
  "/register",
  "/verify-otp",
  "/reset-password",
  "/admin",
];

type StaticCrumbs = { label: string; path?: string }[];
const STATIC_ROUTE_CRUMBS: Record<string, StaticCrumbs> = {
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
  "/shipping-info": [{ label: "Shipping Info" }],
  "/returns-exchanges": [{ label: "Returns & Exchanges" }],
  "/order-details": [{ label: "Order Details" }],
  "/only-twam": [{ label: "Only TWAM" }],
  "/shop-by-size": [{ label: "Shop by Size" }],
  "/size-guide": [{ label: "Size Guide" }],
  "/twam-brands": [{ label: "TWAM Brands" }],
  "/your-fit-founder": [{ label: "Your Fit Finder" }],
  "/take-quiz": [{ label: "Take Quiz" }],
  "/new-arrivals": [{ label: "New Arrivals" }],
  "/best-sellers": [{ label: "Best Sellers" }],
  "/cart": [{ label: "Cart" }],
  "/user-products/cart": [{ label: "Cart" }],
  "/user-products/product-list": [{ label: "All Products" }],
  "/wishlist": [{ label: "My Wishlist" }],
  "/notifications": [{ label: "Notifications" }],
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

const BUY_NOW_QUERY_VALUE = "1";
const BUY_NOW_CART_PATH = "/user-products/cart?buyNow=1";
const BUY_NOW_BREADCRUMB_PATHS = new Set([
  "/cart",
  "/user-products/cart",
  "/user-products/payment-address",
  "/user-products/shipping-option",
  "/user-products/payment",
]);

function isBuyNowCheckout(search: string) {
  return new URLSearchParams(search).get("buyNow") === BUY_NOW_QUERY_VALUE;
}

function withBuyNowQuery(path: string) {
  if (path === "/cart" || path === "/user-products/cart") {
    return BUY_NOW_CART_PATH;
  }

  if (
    path === "/user-products/payment-address" ||
    path === "/user-products/shipping-option" ||
    path === "/user-products/payment"
  ) {
    return `${path}?buyNow=1`;
  }

  return path;
}

function rewriteBuyNowBreadcrumbs(items: StaticCrumbs, search: string) {
  if (!isBuyNowCheckout(search)) return items;

  return items.map((item) =>
    item.path ? { ...item, path: withBuyNowQuery(item.path) } : item,
  );
}

function shouldShowBuyNowLabel(pathname: string, search: string) {
  return isBuyNowCheckout(search) && BUY_NOW_BREADCRUMB_PATHS.has(pathname);
}

function getCheckoutBackTarget(pathname: string, search: string) {
  if (!isBuyNowCheckout(search)) return null;

  if (pathname === "/user-products/payment-address") {
    return BUY_NOW_CART_PATH;
  }

  if (pathname === "/user-products/shipping-option") {
    return "/user-products/payment-address?buyNow=1";
  }

  if (pathname === "/user-products/payment") {
    return "/user-products/shipping-option?buyNow=1";
  }

  return null;
}

function AutoBreadcrumb() {
  const { pathname, search } = useLocation();
  const { crumbs: storeCrumbs, clearCrumbs } = useBreadcrumbStore();
  const buyNowLabel = shouldShowBuyNowLabel(pathname, search)
    ? "Buy Now"
    : undefined;

  useEffect(() => {
    clearCrumbs();
  }, [pathname]);

  if (
    NO_BREADCRUMB_ROUTES.includes(pathname) ||
    NO_BREADCRUMB_PREFIXES.some((p) => pathname.startsWith(p))
  )
    return null;

  if (storeCrumbs && storeCrumbs.length > 0) {
    return (
      <Breadcrumb
        items={rewriteBuyNowBreadcrumbs(storeCrumbs, search)}
        contextLabel={buyNowLabel}
      />
    );
  }

  let trail = STATIC_ROUTE_CRUMBS[pathname];

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
  return (
    <Breadcrumb
      items={rewriteBuyNowBreadcrumbs(items, search)}
      contextLabel={buyNowLabel}
    />
  );
}

function MainLayout() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const mobileBackHeaderTitle = isMobile
    ? getMobileBackHeaderTitle(pathname)
    : null;
  const mobileBackTarget = isMobile
    ? getCheckoutBackTarget(pathname, search)
    : null;

  return (
    <div className="s-app-22e1be">
      <AdminBar />
      <Navbar />
      <main className="s-app-52dcac">
        {mobileBackHeaderTitle && (
          <MobileBackHeader
            title={mobileBackHeaderTitle}
            onBack={
              mobileBackTarget ? () => navigate(mobileBackTarget) : undefined
            }
          />
        )}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

// ── Greeting texts ────────────────────────────────────────────────────────────
const SPLASH_TEXTS = [
  "Hello, Beautiful.",
  "Welcome, Gorgeous.",
  "You Are That.",
  "Step In, Shine On.",
  "Confidence Looks Good On You.",
  "Ready to Find Your Perfect Fit?",
  "Hello, Radiance.",
  "Welcome to Comfort, Welcome to Confidence.",
  "You Belong Here.",
  "Your Journey to Comfort Starts Now.",
  "Celebrate Yourself Today.",
  "Uncover the Real You.",
  "Find What Makes You Feel Amazing.",
  "Beauty Begins Here.",
  "Embrace Your Everyday Magic.",
  "Welcome to TWAM, Where You Are That.",
  "Only TWAM — Confidence Starts Here.",
  "Step Into Comfort, Step Into TWAM.",
  "You Are TWAM. You Are Enough.",
  "Be Bold. Be Beautiful. Be TWAM.",
  "TWAM: The Real You, Unfiltered.",
];

// ── Logo with fallback chain ──────────────────────────────────────────────────
function SplashLogo({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const srcs = [
    "/assets/Twam-Logo-Burgundy.png",
    "/assets/TWAM.png",
    "/assets/twam-logo.png",
  ];
  return (
    <img
      src={srcs[idx]}
      alt="TWAM"
      className={className}
      onError={() => setIdx((i) => Math.min(i + 1, srcs.length - 1))}
    />
  );
}

// ── Home page splash — full branded overlay ──────────────────────────────────
// Stays visible until Home.tsx fires "twam-home-ready" (APIs + banner loaded).
// MIN_SHOW is shorter on native because the native splash already ran for 2s
// before React mounted, so the user has already waited enough.
function HomeSplash({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  const text = useRef(
    SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)],
  ).current;

  useEffect(() => {
    const startTime = Date.now();
    const MIN_SHOW = IS_NATIVE ? 600 : 1800;

    const dismiss = () => {
      const wait = Math.max(0, MIN_SHOW - (Date.now() - startTime));
      setTimeout(() => {
        setExiting(true);
        setTimeout(onDone, 400);
      }, wait);
    };

    if ((window as any).__twamHomeReady) {
      dismiss();
    } else {
      window.addEventListener("twam-home-ready", dismiss, { once: true });
    }

    const safetyTimer = setTimeout(dismiss, IS_NATIVE ? 12000 : 9000);

    return () => {
      window.removeEventListener("twam-home-ready", dismiss);
      clearTimeout(safetyTimer);
      delete (window as any).__twamHomeReady;
    };
  }, [onDone]);

  return (
    <div className={`twam-overlay${exiting ? " twam-overlay--exit" : ""}`}>
      <div className="twam-overlay__content">
        <div className="twam-overlay__spinner" />
        <SplashLogo className="twam-overlay__logo" />
        <p className="twam-overlay__text">{text}</p>
      </div>
    </div>
  );
}

// ── Route transition overlay — all non-home pages ────────────────────────────
// Shows a transparent full-screen overlay with a spinner on every route change.
// Hides when:
//   (a) the page fires window.dispatchEvent(new Event("page-content-ready")), OR
//   (b) auto-dismiss timeout elapses (longer on native for mobile network).
//   (c) app resumes from background — skip entirely, nothing new is loading.
function RouteTransitionOverlay() {
  const { pathname } = useLocation();

  const isHomePath = (p: string) => p === "/" || p === "/home";

  const [visible, setVisible] = useState(() => !isHomePath(pathname));
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHomePath(pathname)) {
      setVisible(false);
      setExiting(false);
      return;
    }

    // Skip spinner when user returns from Android background —
    // the page is already rendered, nothing new is loading.
    if (_isCapacitorResume) {
      setVisible(false);
      setExiting(false);
      return;
    }

    setExiting(false);
    setVisible(true);

    // Native gets 5s — mobile networks are slower than desktop.
    // Web gets 2.5s — covers most API response times on broadband.
    const autoTimer = setTimeout(dismiss, IS_NATIVE ? 5000 : 2500);

    const handler = () => {
      clearTimeout(autoTimer);
      dismiss();
    };
    window.addEventListener("page-content-ready", handler, { once: true });

    return () => {
      clearTimeout(autoTimer);
      window.removeEventListener("page-content-ready", handler);
    };
  }, [pathname, dismiss]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`twam-overlay${exiting ? " twam-overlay--exit" : ""}`}>
      <div className="twam-overlay__content twam-overlay__content--simple">
        <div className="twam-overlay__spinner" />
      </div>
    </div>
  );
}

// ── Suspense fallback — shown while lazy chunks are downloading ───────────────
// RouteTransitionOverlay (inside Suspense) handles the data-loading phase.
// This covers the code-splitting phase before RouteTransitionOverlay mounts.
const PageLoader = () => {
  const isHome =
    window.location.pathname === "/" || window.location.pathname === "/home";
  if (isHome) return null;
  return (
    <div className="twam-overlay">
      <div className="twam-overlay__content twam-overlay__content--simple">
        <div className="twam-overlay__spinner" />
      </div>
    </div>
  );
};

export default function App() {
  useWishlistLoader();
  useCartLoader();

  const isHome =
    window.location.pathname === "/" || window.location.pathname === "/home";
  const [showSplash, setShowSplash] = useState(isHome);

  const handleSplashDone = () => setShowSplash(false);

  // ── Capacitor background/foreground detection ─────────────────────────────
  // No @capacitor/app needed — both "resume" and visibilitychange fire inside
  // the Capacitor WebView using standard Web APIs.
  // Marks _isCapacitorResume=true for 600ms so RouteTransitionOverlay skips
  // showing a spinner when the user just brings the app back from background.
  useEffect(() => {
    if (!IS_NATIVE) return;

    let t: ReturnType<typeof setTimeout> | null = null;

    const markResume = () => {
      _isCapacitorResume = true;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        _isCapacitorResume = false;
      }, 600);
    };

    document.addEventListener("resume", markResume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") markResume();
    });

    return () => {
      document.removeEventListener("resume", markResume);
      if (t) clearTimeout(t);
      _isCapacitorResume = false;
    };
  }, []);

  return (
    <>
      {showSplash && <HomeSplash onDone={handleSplashDone} />}
      <Suspense fallback={<PageLoader />}>
        <ScrollToTop />
        <RouteMemory />
        {/* RouteTransitionOverlay lives inside Suspense so it has access to
            useLocation() and only renders after lazy chunks have resolved. */}
        <RouteTransitionOverlay />
        <Routes>
          {/* ── Main layout (Navbar + Footer) ─────────────────────────────── */}
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
            <Route
              path="/news-privacy-policy"
              element={<NewsPrivacyPolicy />}
            />
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
            <Route
              path="/user-products/guest-signup"
              element={<GuestSignup />}
            />

            {/* ── Returns ── */}
            <Route
              path="/user-products/return-order"
              element={<ReturnOrder />}
            />
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

            <Route path="/wishlist" element={<Wishlist />} />

            {/* ── Protected account pages ── */}
            <Route element={<ProtectedRoute />}>
              <Route path="/notifications" element={<Notifications />} />
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

          {/* ── Auth pages (no layout) ────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Admin panel ──────────────────────────────────────────────── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route
              index
              element={<Navigate to="/admin/admin-dashboard" replace />}
            />
            <Route path="admin-dashboard" element={<AdminDashboard />} />
            <Route path="bulk-import" element={<AdminBulkUpload />} />
            <Route path="orders" element={<AdminOrders />} />
            { <Route path="product-bulk-upload" element={<AdminProductBulkUpload />} /> }
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

          {/* ── Fallback ─────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
