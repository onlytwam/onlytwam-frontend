// ─── User / Auth Types ────────────────────────────────────────────────────────

export interface User {
  userId: string;
  id?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  roleId: number;
}

export interface AuthenticationModel {
  firstName: string;
  middleName: string;
  lastName: string;
  emailId: string;
  password: string;
  phoneNumber: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Address {
  addressId: number;
  name: string | null;
  addressLine: string | null;
  locality: string | null;
  city: string | null;
  pinCode: string | null;
  countryId: number | null;
  stateId: number | null;
  phone: string | null;
  isDefault: boolean | null;
  userProfileId: string | null;
  typeId?: number | null;
  isBillingAddress?: boolean | null;
}

export interface Country {
  countryId: number;
  countryName: string;
}

export interface State {
  stateId: number;
  stateName: string;
}

export interface WishlistItem {
  productId: number;
  productVariantId: number;
  wishlistId?: number;
}