// src/shared/seo/staticSeo.ts
//
// Unique title + meta description for every public page that is not a product
// or category. Titles: aim for 60 characters or fewer. Descriptions: 140-160.
// REVIEW ALL TEXT with the brand team before publishing: it is written from the
// copy that is already on the site (About page, footer: free shipping over
// Rs 5000, free returns within 15 days, sizes XS to 5XL).

export type StaticSeoPage = {
  title: string;
  description: string;
  /** Set when the canonical URL should be a different page (duplicate content). */
  canonicalPath?: string;
  noindex?: boolean;
};

export const STATIC_SEO: Record<string, StaticSeoPage> = {
  "/": {
    title: "TWAM | Bras, Panties & Activewear for Every Body",
    description:
      "Shop comfortable bras, panties, essentials and activewear at TWAM. Inclusive sizes from XS to 5XL, free 15-day returns and free shipping over ₹5000.",
  },
  "/about": {
    title: "About TWAM | Comfort Meets Confidence",
    description:
      "Learn the story behind TWAM: inclusive lingerie made for real bodies, with premium fabrics, comfort-first design and sizes from XS to 5XL for every woman.",
  },
  "/contact-us": {
    title: "Contact Us | TWAM",
    description:
      "Contact the TWAM support team for help with orders, returns, sizing or any other question. We are here to help you find your perfect fit and shop with ease.",
  },
  "/our-stores": {
    title: "Our Stores | TWAM",
    description:
      "Find a TWAM store near you. Visit us to try our bras, panties and activewear in person and get fit advice from our friendly in-store team before you buy.",
  },
  "/our-blog": {
    title: "TWAM Blog | Fit Tips, Style & Comfort Guides",
    description:
      "Read the TWAM blog for bra fitting tips, comfort guides, style ideas and lingerie care advice to help every woman feel confident in what she wears every day.",
  },
  "/only-twam": {
    title: "Only TWAM | Where Every Body Finds Its Perfect Fit",
    description:
      "Discover Only TWAM, the collection where every body finds its perfect fit. Explore bras, panties and essentials designed for all-day comfort and confidence.",
  },
  "/shop-by-size": {
    title: "Shop Bras by Size | TWAM",
    description:
      "Shop bras by size at TWAM. Pick your band and cup size to see styles that fit, with inclusive sizing from XS to 5XL and easy returns within 15 days of delivery.",
  },
  "/size-guide": {
    title: "Bra & Panty Size Guide | TWAM",
    description:
      "Use the TWAM size guide to measure yourself at home and find your right bra and panty size. Simple steps, size charts and fit tips for a comfortable fit.",
  },
  "/twam-brands": {
    title: "TWAM Brands | Lingerie & Activewear",
    description:
      "Explore the brands at TWAM. Shop trusted lingerie and activewear labels in one place, with inclusive sizes, comfortable fabrics and easy 15-day returns.",
  },
  "/your-fit-founder": {
    title: "Your Fit Finder | Find Your Perfect Bra | TWAM",
    description:
      "Find your perfect fit with the TWAM fit finder. Answer a few quick questions about your size and shape and get bra recommendations made for your own body.",
  },
  "/take-quiz": {
    title: "Bra Quiz | Find Your Best Style | TWAM",
    description:
      "Take the TWAM quiz to discover the bra style that suits you best. Answer a few simple questions and get comfortable, supportive picks matched to your needs.",
  },
  "/best-sellers": {
    title: "Best Selling Bras, Panties & Activewear | TWAM",
    description:
      "Shop TWAM best sellers: the bras, panties and activewear our customers love most. Comfortable fits, inclusive sizes, easy returns and free shipping over ₹5000.",
  },
  "/all-products": {
    title: "All Products | Bras, Panties & Activewear | TWAM",
    description:
      "Browse all TWAM products: bras, panties, essentials and activewear for every body. Filter by size, colour and price, with free shipping over ₹5000 on orders.",
  },
  // Overlaps with /all-products: canonical points at /all-products.
  "/user-products/product-list": {
    title: "Shop the Full Collection | TWAM",
    description:
      "Shop the full TWAM collection of bras, panties, essentials and activewear. Compare styles, sizes and colours and find comfortable fits for every day.",
    canonicalPath: "/all-products", // ADDED
  },
  "/new-arrivals": {
    title: "New Arrivals | Bras, Panties & Activewear | TWAM",
    description:
      "Shop the latest TWAM new arrivals. Fresh bras, panties and activewear in soft fabrics and inclusive sizes, with easy returns and free shipping over ₹5000.",
  },
  "/privacy-policy": {
    title: "Privacy Policy | TWAM",
    description:
      "Read the TWAM privacy policy to see how we collect, use and protect your personal information when you shop on onlytwam.com or contact our support team.",
  },
  "/terms-conditions": {
    title: "Terms & Conditions | TWAM",
    description:
      "Read the TWAM terms and conditions for using onlytwam.com, including orders, payments, pricing, shipping, returns and your rights and duties as a customer.",
  },
  "/shipping-info": {
    title: "Shipping Information | TWAM",
    description:
      "Get TWAM shipping details: delivery times, charges and tracking across India. Enjoy free shipping on orders over ₹5000, with easy exchanges and returns on top.",
  },
  "/return-refund-policy": {
    title: "Return & Refund Policy | TWAM",
    description:
      "Read the TWAM return and refund policy. Return or exchange within 15 days, learn how refunds work and which items are eligible, explained in simple clear steps.",
  },
  // Same topic as /privacy-policy: its canonical points at the main policy page.
  "/news-privacy-policy": {
    title: "Newsletter Privacy Policy | TWAM",
    description:
      "See how TWAM handles your email address and preferences when you subscribe to our newsletter, and how to unsubscribe at any time using the link in every email.",
    canonicalPath: "/privacy-policy",
  },
  "/unsubscribe": {
    title: "Unsubscribe | TWAM",
    description:
      "Unsubscribe from TWAM newsletter emails and offers. Update your preferences in a few seconds and stop receiving our messages whenever you choose to do so.",
    noindex: true,
  },
};

// Private or transactional pages: a useful tab title for the visitor, and noindex.
export const PRIVATE_PAGES: { path: string; title: string }[] = [
  { path: "/cart", title: "Your Cart | TWAM" },
  { path: "/user-products/cart", title: "Your Cart | TWAM" },
  { path: "/wishlist", title: "My Wishlist | TWAM" },
  { path: "/notifications", title: "Notifications | TWAM" },
  { path: "/login", title: "Sign In | TWAM" },
  { path: "/register", title: "Create Account | TWAM" },
  { path: "/verify-otp", title: "Verify OTP | TWAM" },
  { path: "/reset-password", title: "Reset Password | TWAM" },
  { path: "/account", title: "My Account | TWAM" },
  { path: "/admin", title: "Admin | TWAM" },
  { path: "/global-search", title: "Search | TWAM" },
  { path: "/order-details", title: "Order Details | TWAM" },
  { path: "/user-products/payment-address", title: "Delivery Address | TWAM" },
  { path: "/user-products/shipping-option", title: "Shipping Method | TWAM" },
  { path: "/user-products/payment", title: "Payment | TWAM" },
  { path: "/user-products/order-confirm", title: "Order Confirmed | TWAM" },
  { path: "/user-products/invoice-details", title: "Invoice | TWAM" },
  { path: "/user-products/return", title: "Returns | TWAM" },
  { path: "/user-products/delivery-option", title: "Returns | TWAM" },
  { path: "/user-products/refund-choice", title: "Returns | TWAM" },
  // ADDED: routes that exist in App.tsx but were missing here
  { path: "/user-products/payment-callback", title: "Payment Status | TWAM" },
  { path: "/user-products/return-order", title: "Returns | TWAM" },
  { path: "/user-products/return-reason", title: "Returns | TWAM" },
  { path: "/user-products/return-confirm", title: "Returns | TWAM" },
];

export const PRIVATE_DESCRIPTION =
  "Manage your TWAM account, cart, orders and returns securely on onlytwam.com.";
  