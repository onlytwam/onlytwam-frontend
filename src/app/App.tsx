import { Routes, Route, Navigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Navbar from '@/shared/components/Navbar';
import Footer from '@/shared/components/Footer';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import AdminBar from '@/features/admin/components/AdminBar';
import Breadcrumb from '@/shared/components/Breadcrumb';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ── Public pages ──────────────────────────────────────────────────────────────
const Home                   = lazy(() => import('@/features/content/pages/Home'));
const Login                  = lazy(() => import('@/features/auth/pages/Login'));
const Register               = lazy(() => import('@/features/auth/pages/Register'));
const ResetPassword          = lazy(() => import('@/features/auth/pages/ResetPassword'));
const VerifyOtp              = lazy(() => import('@/features/auth/pages/VerifyOtp'));
const About                  = lazy(() => import('@/features/content/pages/About'));
const ContactUs              = lazy(() => import('@/features/content/pages/ContactUs'));
const Unsubscribe             = lazy(() => import('@/features/content/pages/Unsubscribe'));
const OurStores              = lazy(() => import('@/features/content/pages/OurStores'));
const OurBlog                = lazy(() => import('@/features/content/pages/OurBlog'));
const Blog1                  = lazy(() => import('@/features/content/pages/Blog1'));
const HelpCenter             = lazy(() => import('@/features/content/pages/HelpCenter'));
const PrivacyPolicy          = lazy(() => import('@/features/content/pages/PrivacyPolicy'));
const TermsConditions        = lazy(() => import('@/features/content/pages/TermsConditions'));
const ShippingInfo           = lazy(() => import('@/features/orders/pages/ShippingInfo'));
const ReturnsExchanges       = lazy(() => import('@/features/orders/pages/ReturnsExchanges'));
const DeliveryShippingPolicy = lazy(() => import('@/features/content/pages/DeliveryShippingPolicy'));
const ReturnRefundPolicy     = lazy(() => import('@/features/orders/pages/ReturnRefundPolicy'));
const NewsPrivacyPolicy      = lazy(() => import('@/features/content/pages/NewsPrivacyPolicy'));
const OnlyTwam               = lazy(() => import('@/features/products/pages/OnlyTwam'));
const ShopBySize             = lazy(() => import('@/features/products/pages/ShopBySize'));
const SizeGuide              = lazy(() => import('@/features/products/pages/SizeGuide'));
const TwamBrands             = lazy(() => import('@/features/products/pages/TwamBrands'));
const YourFitFinder          = lazy(() => import('@/features/products/pages/YourFitFinder'));
const TakeQuiz               = lazy(() => import('@/features/products/pages/TakeQuiz'));
const GlobalSearch           = lazy(() => import('@/features/search/pages/GlobalSearch'));
const OrderDetails           = lazy(() => import('@/features/orders/pages/OrderDetails'));
const ProductList            = lazy(() => import('@/features/products/pages/ProductList'));

function ProductListWithKey() {
  const { categoryId } = useParams<{ categoryId: string }>();
  return <ProductList key={categoryId ?? 'all'} />;
}

const ProductDetail          = lazy(() => import('@/features/products/pages/ProductDetail'));
const Cart                   = lazy(() => import('@/features/cart/pages/Cart'));
const Payment                = lazy(() => import('@/features/orders/pages/Payment'));
const PaymentAddress         = lazy(() => import('@/features/orders/pages/PaymentAddress'));
const OrderConfirm           = lazy(() => import('@/features/orders/pages/OrderConfirm'));
const GuestSignup            = lazy(() => import('@/features/auth/pages/GuestSignup'));
const ShippingOption         = lazy(() => import('@/features/orders/pages/ShippingOption'));
const Invoice                = lazy(() => import('@/features/orders/pages/Invoice'));
const ReturnOrder            = lazy(() => import('@/features/orders/pages/returns/ReturnOrder'));
const ReturnReason           = lazy(() => import('@/features/orders/pages/returns/ReturnReason'));
const DeliveryOption         = lazy(() => import('@/features/orders/pages/returns/DeliveryOption'));
const RefundChoice           = lazy(() => import('@/features/orders/pages/returns/RefundChoice'));
const ReturnConfirm          = lazy(() => import('@/features/orders/pages/returns/ReturnConfirm'));

// ── Account pages ─────────────────────────────────────────────────────────────
const ProfileLayout          = lazy(() => import('@/shared/components/ProfileLayout'));
const UserDashboard          = lazy(() => import('@/features/account/pages/Userdashboard'));
const UpdateProfile          = lazy(() => import('@/features/account/pages/UpdateProfile'));
const AddressList            = lazy(() => import('@/features/account/pages/AddressList'));
const AddressForm            = lazy(() => import('@/features/account/pages/AddressForm'));
const CouponsList            = lazy(() => import('@/features/account/pages/CouponsList'));
const OrdersList             = lazy(() => import('@/features/account/pages/OrdersList'));
const Notifications          = lazy(() => import('@/features/account/pages/Notifications'));
// Wishlist is imported SEPARATELY — used in both the protected account route
// AND the public /wishlist route so guests can access it without logging in.
const Wishlist               = lazy(() => import('@/features/account/pages/Wishlist'));
import { useWishlistLoader } from '@/features/account/hooks/useWishlist';
import { useCartLoader } from '@/features/cart/hooks/useCart';

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminLayout            = lazy(() => import('@/features/admin/components/AdminLayout'));
const AdminDashboard         = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const AdminOrders            = lazy(() => import('@/features/admin/pages/AdminOrders'));
const AdminProducts          = lazy(() => import('@/features/admin/pages/AdminProducts'));
const AdminInventory         = lazy(() => import('@/features/admin/pages/AdminInventory'));
const AdminReports           = lazy(() => import('@/features/admin/pages/AdminReports'));
const ApiTester              = lazy(() => import('@/features/admin/pages/ApiTester'));
const AdminProductForm       = lazy(() => import('@/features/admin/pages/AdminProductForm'));
const AdminCategories        = lazy(() => import('@/features/admin/pages/AdminCategories'));
const AdminBrands            = lazy(() => import('@/features/admin/pages/AdminBrands'));
const AdminSizes             = lazy(() => import('@/features/admin/pages/AdminSizes'));
const AdminUsers             = lazy(() => import('@/features/admin/pages/AdminUsers'));
const AdminCoupons           = lazy(() => import('@/features/admin/pages/AdminCoupons'));
const AdminSupportRequests   = lazy(() => import('@/features/admin/pages/AdminSupportRequests'));
const AdminBlog              = lazy(() => import('@/features/admin/pages/AdminBlog'));

// ── Layouts ───────────────────────────────────────────────────────────────────

// Pages that already render their own <Breadcrumb /> — skip auto-breadcrumb for these
const SELF_BREADCRUMB_ROUTES = [
  '/', '/home',
  '/user-products/product-list', '/user-products/product-detail',
  '/user-products/cart', '/cart', '/wishlist', '/global-search',
  '/account',
];

function AutoBreadcrumb() {
  const { pathname } = useLocation();
  // Skip pages that manage their own breadcrumbs, plus Home
  const skip = SELF_BREADCRUMB_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  if (skip) return null;

  const ROUTE_LABELS: Record<string, string> = {
    '/about': 'About Us',
    '/contact-us': 'Contact Us',
    '/our-stores': 'Our Stores',
    '/our-blog': 'Our Blog',
    '/help-center': 'Help Center',
    '/privacy-policy': 'Privacy Policy',
    '/terms-conditions': 'Terms & Conditions',
    '/shipping-info': 'Shipping Info',
    '/returns-exchanges': 'Returns & Exchanges',
    '/delivery-shipping-policy': 'Delivery & Shipping Policy',
    '/return-refund-policy': 'Return & Refund Policy',
    '/news-privacy-policy': 'Newsletter Privacy',
    '/only-twam': 'Only TWAM',
    '/shop-by-size': 'Shop by Size',
    '/size-guide': 'Size Guide',
    '/twam-brands': 'TWAM Brands',
    '/your-fit-founder': 'Your Fit Finder',
    '/take-quiz': 'Take Quiz',
    '/order-details': 'Order Details',
    '/unsubscribe': 'Unsubscribe',
  };

  // Try exact match first, then prefix match for parameterized routes
  let label = ROUTE_LABELS[pathname];
  if (!label) {
    for (const [route, lbl] of Object.entries(ROUTE_LABELS)) {
      if (pathname.startsWith(route)) { label = lbl; break; }
    }
  }
  if (!label) return null;

  const items = [{ label: 'Home', path: '/' }, { label }];
  return <Breadcrumb items={items} />;
}

const MainLayout = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <AdminBar />
    <Navbar />
    <AutoBreadcrumb />
    <main style={{ flex: 1 }}><Outlet /></main>
    <Footer />
  </div>
);

// Simple layout wrapper for standalone pages that need Navbar/Footer but not ProfileLayout
const SimpleLayout = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <AdminBar />
    <Navbar />
    <main style={{ flex: 1, padding: '24px 0' }}><Outlet /></main>
    <Footer />
  </div>
);

const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 40, height: 40, border: '4px solid #f0f0f0', borderTopColor: '#111', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function App() {
  useWishlistLoader(); // Load server wishlist IDs once so all cards show correct heart state
  useCartLoader();     // Load server cart count once so Navbar badge is correct for auth users
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Routes>

        {/* ── Main layout (Navbar + Footer) ───────────────────────────────── */}
        <Route element={<MainLayout />}>
          <Route path="/"                              element={<Home />} />
          <Route path="/home"                          element={<Navigate to="/" replace />} />
          <Route path="/about"                         element={<About />} />
          <Route path="/contact-us"                    element={<ContactUs />} />
          <Route path="/unsubscribe"             element={<Unsubscribe />} />
          <Route path="/our-stores"                    element={<OurStores />} />
          <Route path="/our-blog"                      element={<OurBlog />} />
          <Route path="/blog-1/:id"                    element={<Blog1 />} />
          <Route path="/help-center"                   element={<HelpCenter />} />
          <Route path="/privacy-policy"                element={<PrivacyPolicy />} />
          <Route path="/terms-conditions"              element={<TermsConditions />} />
          <Route path="/shipping-info"                 element={<ShippingInfo />} />
          <Route path="/returns-exchanges"             element={<ReturnsExchanges />} />
          <Route path="/delivery-shipping-policy"      element={<DeliveryShippingPolicy />} />
          <Route path="/return-refund-policy"          element={<ReturnRefundPolicy />} />
          <Route path="/news-privacy-policy"           element={<NewsPrivacyPolicy />} />
          <Route path="/only-twam"                     element={<OnlyTwam />} />
          <Route path="/shop-by-size"                  element={<ShopBySize />} />
          <Route path="/size-guide"                    element={<SizeGuide />} />
          <Route path="/twam-brands"                   element={<TwamBrands />} />
          <Route path="/your-fit-founder"              element={<YourFitFinder />} />
          <Route path="/take-quiz"                     element={<TakeQuiz />} />
          <Route path="/global-search"                 element={<GlobalSearch />} />
          <Route path="/order-details/:id"             element={<OrderDetails />} />

          {/* ── Products ── */}
          <Route path="/user-products/product-list"             element={<ProductList key="all" />} />
          <Route path="/user-products/product-list/:categoryId" element={<ProductListWithKey />} />
          <Route path="/user-products/product-detail/:id/:name" element={<ProductDetail />} />
          <Route path="/user-products/cart"                     element={<Cart />} />
          <Route path="/cart"                                    element={<Cart />} />
          <Route path="/user-products/payment-address"          element={<PaymentAddress />} />
          <Route path="/user-products/payment"                  element={<Payment />} />
          <Route path="/user-products/order-confirm/:id"        element={<OrderConfirm />} />
          <Route path="/user-products/shipping-option"          element={<ShippingOption />} />
          <Route path="/user-products/invoice-details/:id"      element={<Invoice />} />
          <Route path="/user-products/guest-signup"             element={<GuestSignup />} />

          {/* ── Returns ── */}
          <Route path="/user-products/return-order"    element={<ReturnOrder />} />
          <Route path="/user-products/return-reason"   element={<ReturnReason />} />
          <Route path="/user-products/delivery-option" element={<DeliveryOption />} />
          <Route path="/user-products/refund-choice"   element={<RefundChoice />} />
          <Route path="/user-products/return-confirm"  element={<ReturnConfirm />} />

          {/* ══════════════════════════════════════════════════════════════════
              PUBLIC WISHLIST — accessible to ALL users, no login required.
              Guests see their localStorage wishlist; logged-in users see
              the server wishlist (and a sync button if they have guest items).
              ════════════════════════════════════════════════════════════════ */}
          <Route path="/wishlist" element={<Wishlist />} />

          {/* ── Protected account pages ── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<ProfileLayout />}>
              <Route index                    element={<Navigate to="/account/dashboard" replace />} />
              <Route path="dashboard"         element={<UserDashboard />} />
              <Route path="update-profile"    element={<UpdateProfile />} />
              <Route path="change-password"   element={<UpdateProfile />} />
              <Route path="address-list"      element={<AddressList />} />
              <Route path="address-form"      element={<AddressForm />} />
              <Route path="address-form/:id"  element={<AddressForm />} />
              <Route path="coupons-list"      element={<CouponsList />} />
              <Route path="orders-list"       element={<OrdersList />} />
              <Route path="notifications"     element={<Notifications />} />
              {/* /account/wishlist redirects to the public /wishlist route */}
              <Route path="wishlist"          element={<Navigate to="/wishlist" replace />} />
            </Route>
          </Route>
        </Route>

        {/* ── Auth pages (no layout) ───────────────────────────────────────── */}
        <Route path="/login"           element={<Login />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/verify-otp"      element={<VerifyOtp />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* ── Admin panel ─────────────────────────────────────────────────── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index                              element={<Navigate to="/admin/admin-dashboard" replace />} />
          <Route path="admin-dashboard"             element={<AdminDashboard />} />
          <Route path="orders"                      element={<AdminOrders />} />
          <Route path="products"                    element={<AdminProducts />} />
          <Route path="products/new"                element={<AdminProductForm />} />
          <Route path="products/:id"                element={<AdminProductForm />} />
          <Route path="inventory"                   element={<AdminInventory />} />
          <Route path="reports"                     element={<AdminReports />} />
          <Route path="categories"                  element={<AdminCategories />} />
          <Route path="brands"                      element={<AdminBrands />} />
          <Route path="sizes"                       element={<AdminSizes />} />
          <Route path="users"                       element={<AdminUsers />} />
          <Route path="coupons"                     element={<AdminCoupons />} />
          <Route path="support"                     element={<AdminSupportRequests />} />
          <Route path="blog"                        element={<AdminBlog />} />
          <Route path="api-tester"                  element={<ApiTester />} />
        </Route>

        {/* ── Fallback ────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Suspense>
  );
}