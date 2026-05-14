/**
 * Canonical page-image keys — must match the keys in
 * app/images/repository.py  PAGE_IMAGE_DEFAULTS.
 *
 * Use these constants everywhere in the frontend instead of raw strings
 * so a key rename is a one-place change.
 */
export const IMAGE_KEYS = {
  /** Login page background */
  LOGIN_BACKGROUND: "login_background",

  /** Home page hero banner — mobile */
  HOME_HERO_MOBILE: "home_hero_mobile",

  /** Home page hero — desktop (image or video, auto-detected by extension) */
  HOME_HERO_DESKTOP: "home_hero_desktop",

  /** Home page "TWAM" featured-section background */
  HOME_SECTION_TWAM: "home_section_twam",

  /** Home page "Best Sellers" section background */
  HOME_SECTION_BESTSELLERS: "home_section_bestsellers",

  /** Home page "New Arrivals" section background */
  HOME_SECTION_NEWARRIVALS: "home_section_newarrivals",

  /** Shop by Category — "All Products" banner image */
  HOME_SHOP_ALL_PRODUCTS: "home_shop_all_products",
} as const;

export type ImageKey = (typeof IMAGE_KEYS)[keyof typeof IMAGE_KEYS];

/**
 * No static fallbacks — all images must be uploaded via the admin panel.
 * Returning an empty string lets each component decide how to handle the
 * absence of an image (hide the element, show a placeholder, etc.).
 */
export const IMAGE_FALLBACKS: Record<ImageKey, string> = {
  login_background: "",
  home_hero_mobile: "",
  home_hero_desktop: "",
  home_section_twam: "",
  home_section_bestsellers: "",
  home_section_newarrivals: "",
  home_shop_all_products: "",
};
