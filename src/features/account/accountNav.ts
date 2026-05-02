export interface AccountNavItem {
  path: string;
  label: string;
  icon: string;
}

export const accountNavItems: AccountNavItem[] = [
  { path: "/account/dashboard", label: "Dashboard", icon: "bi-grid-1x2" },
  { path: "/account/update-profile", label: "My Profile", icon: "bi-person" },
  { path: "/account/orders-list", label: "My Orders", icon: "bi-bag" },
  { path: "/account/wishlist", label: "Wishlist", icon: "bi-heart" },
  { path: "/account/address-list", label: "Addresses", icon: "bi-geo-alt" },
  { path: "/account/coupons-list", label: "Coupons", icon: "bi-ticket-perforated" },
  { path: "/account/notifications", label: "Notifications", icon: "bi-bell" },
  {
    path: "/account/change-password",
    label: "Change Password",
    icon: "bi-lock",
  },
];

export const getAccountPageTitle = (pathname: string): string => {
  if (pathname === "/account") return "My Account";
  if (pathname.startsWith("/account/address-form")) return "Address Form";
  if (pathname.startsWith("/account/change-password")) return "Change Password";

  const match = accountNavItems.find(
    (item) =>
      pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  return match?.label ?? "My Account";
};
