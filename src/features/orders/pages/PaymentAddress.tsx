/**
 * PaymentAddress.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Checkout step 1 — Delivery Address
 *
 * Features:
 *  • Pincode verification via India Post API (real-time city / state / country)
 *  • Geolocation auto-fill (country, state, city, locality via Nominatim)
 *  • 10-digit phone validation with +91 prefix
 *  • Guest: email → OTP verify → address form
 *  • Auth: saved-address list + add / edit
 *  • Matches brand palette: Burgundy #6B0F2A · Heirloom #9E6070 · Ivory #F5F0E6
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  checkForgotPasswordChannels,
  getUserInfo,
  normalizeUserInfo,
} from "@/features/auth/api/auth.api";
import { useCartStore } from "@/features/cart/store/cartStore";
import { readCheckoutSession } from "@/features/cart/utils/checkoutSession";
import { getBuyNowSession } from "@/shared/utils/checkoutSession";
import {
  listAddress,
  createAddress,
  updateAddress,
} from "@/features/orders/api/orders.api";
import {
  resolveStateId,
  resolveStateMatch,
  getRememberedAddressState,
  rememberAddressState,
} from "@/shared/utils/addressLocation";
import api from "@/shared/api/axiosInstance";
import MapPicker from "@/shared/components/MapPicker";
import type { MapPickerResult } from "@/shared/components/MapPicker";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const IVORY_DK = "var(--ivory)";
const FONT_UI = '"Trebuchet MS", Arial, sans-serif';
const GUEST_OTP_LENGTH = 6;

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = {
  name: "",
  phone: "",
  houseNo: "", // house / flat / building — user fills
  addressLine: "", // street / colony / road  — geo auto-fill
  locality: "", // area / neighbourhood    — geo auto-fill
  city: "", // pincode / geo auto-fill
  state: "", // pincode / geo auto-fill
  stateId: null as number | null,
  country: "India", // geo auto-fill
  pinCode: "",
  addressType: "Home",
  isDefault: false,
};
type FormState = typeof emptyForm;

const getProfileContact = (
  user?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    phone?: string;
  } | null,
) => {
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.name?.trim() ||
    "";
  const phone = (user?.phoneNumber ?? user?.phone ?? "").trim();
  return { name, phone };
};

const createDraftForm = (user?: Parameters<typeof getProfileContact>[0]) => ({
  ...emptyForm,
  ...getProfileContact(user),
});

const mergeContactIntoForm = (
  form: FormState,
  user?: Parameters<typeof getProfileContact>[0],
): FormState => {
  const contact = getProfileContact(user);
  return {
    ...form,
    name: form.name.trim() ? form.name : contact.name,
    phone: form.phone.trim() ? form.phone : contact.phone,
  };
};

// ── Pincode lookup — India Post API ──────────────────────────────────────────
const splitAddressParts = (value: unknown): string[] =>
  String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, part) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.toLowerCase() === part.toLowerCase()) return acc;
      acc.push(part);
      return acc;
    }, []);

const getStateLabelById = (states: any[], stateId: unknown): string => {
  const numericId = Number(stateId);
  if (!Number.isFinite(numericId)) return "";

  const match = states.find(
    (state: any) => Number(state?.stateId ?? state?.id) === numericId,
  );
  return String(match?.stateName ?? match?.name ?? match?.state ?? "").trim();
};

const getAddressStateLabel = (addr: any, states: any[]): string => {
  const remembered = getRememberedAddressState(addr?.addressId, addr?.pinCode);
  const direct = String(
    addr?.stateName ?? addr?.state ?? remembered?.state ?? "",
  ).trim();
  if (direct) return direct;
  if (remembered?.stateId != null) {
    return getStateLabelById(states, remembered.stateId);
  }
  return getStateLabelById(states, addr?.stateId);
};

const extractAddressParts = (addressLine: unknown, locality?: unknown) => {
  const parts = splitAddressParts(addressLine);
  const localityText = String(locality ?? "").trim();
  const inferredLocality =
    localityText || (parts.length > 2 ? parts[parts.length - 1] : "");

  const lineParts =
    inferredLocality && parts.length > 1
      ? parts[parts.length - 1].toLowerCase() === inferredLocality.toLowerCase()
        ? parts.slice(0, -1)
        : parts
      : parts;

  const houseNo = lineParts[0] ?? "";
  const street = lineParts.slice(1).join(", ");

  return {
    houseNo,
    street,
    locality: inferredLocality,
    displayLine: [houseNo, street, inferredLocality].filter(Boolean).join(", "),
    lineWithoutLocality: [houseNo, street].filter(Boolean).join(", "),
  };
};

interface PinData {
  city: string;
  state: string;
  country: string;
}

async function lookupPincode(pin: string): Promise<PinData | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (!Array.isArray(data) || data[0]?.Status !== "Success") return null;
    const po = data[0]?.PostOffice?.[0];
    if (!po) return null;
    return {
      city: po.Block || po.Taluk || po.District || "",
      state: po.State || "",
      country: po.Country || "India",
    };
  } catch {
    return null;
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inpStyle = (err?: boolean, disabled?: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "13px 15px",
  boxSizing: "border-box",
  border: `1.5px solid ${err ? "var(--brand)" : "var(--ivory)"}`,
  borderRadius: 8,
  fontSize: 15,
  fontFamily: FONT_UI,
  outline: "none",
  background: disabled ? "var(--ivory)" : "#fff",
  color: disabled ? "var(--heirloom)" : "#000000",
  transition: "border-color .2s",
});

const labelSt: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  display: "block",
  marginBottom: 5,
  color: "var(--heirloom)",
  fontFamily: FONT_UI,
};

const errSt: React.CSSProperties = {
  color: "var(--brand)",
  fontSize: 12.5,
  marginTop: 4,
  display: "flex",
  alignItems: "center",
  gap: 4,
  margin: "4px 0 0",
};

// ── Checkout breadcrumb steps ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Reusable Address Form Panel
// ─────────────────────────────────────────────────────────────────────────────
interface FormPanelProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  states: any[];
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  onCancel?: () => void;
  showDefault?: boolean;
}

function AddressFormPanel({
  form,
  setForm,
  errors,
  setErrors,
  states,
  onSubmit,
  submitLabel,
  submitting,
  onCancel,
  showDefault,
}: FormPanelProps) {
  const [pinStatus, setPinStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCoords, setMapCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upd =
    (key: keyof FormState) => (val: string | boolean | number | null) =>
      setForm((f) => ({ ...f, [key]: val }));

  const clearErr = (...keys: string[]) =>
    setErrors((e) => {
      const n = { ...e };
      keys.forEach((k) => delete n[k]);
      return n;
    });

  // ── Pincode live lookup (debounced 600 ms) ─────────────────────────────
  useEffect(() => {
    if (pinTimer.current) clearTimeout(pinTimer.current);
    const pin = form.pinCode.trim();
    if (pin.length < 6) {
      if (pin.length > 0) setPinStatus("idle");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setPinStatus("error");
      return;
    }

    setPinStatus("loading");
    pinTimer.current = setTimeout(async () => {
      const data = await lookupPincode(pin);
      if (!data) {
        setPinStatus("error");
        setErrors((e) => ({ ...e, pinCode: "Please enter a valid pincode" }));
      } else {
        setPinStatus("ok");
        clearErr("pinCode");
        const matchedState = resolveStateMatch(states, data.state);
        setForm((f) => ({
          ...f,
          city: f.city.trim() ? f.city : data.city || f.city,
          state: f.state.trim()
            ? f.state
            : matchedState?.stateName ?? data.state ?? f.state,
          stateId:
            f.stateId ??
            matchedState?.stateId ??
            resolveStateId(states, data.state) ??
            null,
          country: data.country || f.country,
        }));
      }
    }, 600);
    return () => {
      if (pinTimer.current) clearTimeout(pinTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pinCode]);

  // ── Map pin-point handler ─────────────────────────────────────────────────
  // Exact field mapping — clears old values and fills fresh from map:
  //   result.building → houseNo      (House / Flat / Building input)
  //   result.street   → addressLine  (Street / Colony / Road input)
  //   result.area     → locality     (Area / Locality input)
  //   result.city     → city
  //   result.state    → state + stateId
  //   result.country  → country
  //   result.pinCode  → pinCode
  //   name / phone    → kept as-is (personal info)
  const handleMapConfirm = (result: MapPickerResult) => {
    const matchedState = resolveStateMatch(states, result.state);
    setMapCoords({ lat: result.latitude, lng: result.longitude });
    setForm((f) => ({
      ...f, // always keep name, phone, addressType, isDefault
      // Only overwrite a field if map returned a value — leave blank fields for user to fill
      ...(result.building && { houseNo: result.building }), // building name → House/Flat/Building
      ...(result.street && { addressLine: result.street }), // road/street  → Street/Colony/Road
      ...(result.area && { locality: result.area }), // ward/colony  → Area/Locality
      ...(result.city && { city: result.city }),
      ...(result.pinCode && { pinCode: result.pinCode }),
      ...(result.country && { country: result.country }),
      ...(result.state && {
        state: matchedState?.stateName ?? result.state,
        stateId:
          matchedState?.stateId ?? resolveStateId(states, result.state) ?? null,
      }),
    }));
    setErrors({});
    toast.success(
      result.building
        ? `📍 "${result.building}" pinned! Add your flat/unit number if needed.`
        : "📍 Location pinned! Fill in your building name and flat number.",
      { duration: 4000 },
    );
  };
  // ──────────────────────────────────────────────────────────────────────────

  const pinBorder =
    pinStatus === "ok"
      ? "var(--brand)"
      : pinStatus === "error"
      ? "var(--brand)"
      : "var(--ivory)";

  return (
    <div>
      {/* ── Geo-fill row ──────────────────────────────────────────────────── */}
      <div className="s-paymentaddre-12ca4c">
        <span className="s-paymentaddre-786faa s-paymentaddre-ffd8281d">
          <i className="bi bi-geo-alt s-paymentaddre-21c065" />
          Auto-fill your city, state &amp; area from your current location
        </span>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="s-paymentaddre-8db409"
          style={{
            background: "var(--brand)",
            color: "#fff",
            fontFamily: FONT_UI,
            cursor: "pointer",
          }}
        >
          <i className="bi bi-map s-couponslist-030edf" /> Pin on Map
        </button>
      </div>

      {/* ── MapPicker modal ── */}
      <MapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={handleMapConfirm}
        initialLat={mapCoords?.lat}
        initialLng={mapCoords?.lng}
      />

      {/* ── Field grid ────────────────────────────────────────────────────── */}
      <div className="s-paymentaddre-50ded3">
        {/* Full Name */}
        <div>
          <label style={labelSt}>
            Full Name <span className="s-resetpasswor-ddc1b2">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => {
              upd("name")(e.target.value);
              clearErr("name");
            }}
            placeholder="As on ID"
            style={inpStyle(!!errors.name)}
          />
          {errors.name && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label style={labelSt}>
            Mobile Number <span className="s-resetpasswor-ddc1b2">*</span>
          </label>
          <div className="s-paymentaddre-f701c4">
            <span
              className="s-paymentaddre-6d49e8"
              style={{
                border: `1.5px solid ${
                  errors.phone ? "var(--brand)" : "var(--ivory)"
                }`,
                fontFamily: FONT_UI,
              }}
            >
              +91
            </span>
            <input
              value={form.phone}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                upd("phone")(v);
                clearErr("phone");
              }}
              placeholder="10-digit number"
              inputMode="numeric"
              maxLength={10}
              style={{
                ...inpStyle(!!errors.phone),
                borderRadius: "0 8px 8px 0",
                flex: 1,
              }}
            />
          </div>
          {errors.phone && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.phone}
            </p>
          )}
        </div>

        {/* Pincode — col 1 */}
        <div>
          <label style={labelSt}>
            Pincode <span className="s-resetpasswor-ddc1b2">*</span>
            {pinStatus === "loading" && (
              <span className="s-paymentaddre-2afd25">
                <span className="s-paymentaddre-981cc0" />
                Verifying…
              </span>
            )}
            {pinStatus === "ok" && (
              <span className="s-paymentaddre-b0868f">
                <i className="bi bi-check-circle-fill" /> Valid
              </span>
            )}
          </label>
          <input
            value={form.pinCode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              upd("pinCode")(v);
              if (v.length < 6) setPinStatus("idle");
              clearErr("pinCode");
            }}
            placeholder="6-digit pincode"
            inputMode="numeric"
            maxLength={6}
            style={{ ...inpStyle(!!errors.pinCode), borderColor: pinBorder }}
          />
          {errors.pinCode && pinStatus === "error" && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.pinCode}
            </p>
          )}
        </div>

        {/* House / Flat — col 2 */}
        <div>
          <label style={labelSt}>
            House / Flat / Building{" "}
            <span className="s-resetpasswor-ddc1b2">*</span>
          </label>
          <input
            value={form.houseNo}
            onChange={(e) => {
              upd("houseNo")(e.target.value);
              clearErr("houseNo");
            }}
            placeholder="Flat no., floor, building name"
            style={inpStyle(!!errors.houseNo)}
          />
          {errors.houseNo && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.houseNo}
            </p>
          )}
        </div>

        {/* Street / Colony / Road — full width */}
        <div className="s-paymentaddre-97e59d">
          <label style={labelSt}>
            Street / Colony / Road{" "}
            <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-2afd25">
              (auto-fills from location)
            </span>
          </label>
          <input
            value={form.addressLine}
            onChange={(e) => {
              upd("addressLine")(e.target.value);
              clearErr("addressLine");
            }}
            placeholder="Street name, road, colony"
            style={inpStyle(!!errors.addressLine)}
          />
          {errors.addressLine && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.addressLine}
            </p>
          )}
        </div>

        {/* Locality — full width */}
        <div className="s-paymentaddre-97e59d">
          <label style={labelSt}>
            Area / Locality
            <span className="s-paymentaddre-2afd25">
              (auto-fills from location)
            </span>
          </label>
          <input
            value={form.locality}
            onChange={(e) => upd("locality")(e.target.value)}
            placeholder="Neighbourhood, area, village"
            style={inpStyle()}
          />
        </div>

        {/* City */}
        <div>
          <label style={labelSt}>
            City <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
          </label>
          <input
            value={form.city}
            onChange={(e) => {
              upd("city")(e.target.value);
              clearErr("city");
            }}
            placeholder="City"
            style={inpStyle(!!errors.city)}
          />
          {errors.city && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.city}
            </p>
          )}
        </div>

        {/* State */}
        <div>
          <label style={labelSt}>
            State <span className="s-resetpasswor-ddc1b2">*</span>
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
          </label>
          <input
            value={form.state}
            onChange={(e) => {
              const value = e.target.value;
              upd("state")(value);
              upd("stateId")(resolveStateId(states, value));
              clearErr("state");
            }}
            placeholder="State"
            style={inpStyle(!!errors.state)}
          />
          {errors.state && (
            <p style={errSt}>
              <i className="bi bi-exclamation-circle" />
              {errors.state}
            </p>
          )}
        </div>

        {/* Country */}
        <div>
          <label style={labelSt}>
            Country
            <span className="s-paymentaddre-b366b5">(auto-fills)</span>
          </label>
          <input
            value={form.country}
            onChange={(e) => upd("country")(e.target.value)}
            placeholder="Country"
            style={inpStyle()}
          />
        </div>

        {/* Address Type */}
        <div>
          <label style={labelSt}>Address Type</label>
          <div className="s-adminbrands-bccf37">
            {(["Home", "Work"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => upd("addressType")(t)}
                className="s-paymentaddre-dedd1d"
                style={{
                  border: `1.5px solid ${
                    form.addressType === t ? "var(--brand)" : "var(--ivory)"
                  }`,
                  background:
                    form.addressType === t ? `var(--brand)10` : "#fff",
                  color:
                    form.addressType === t ? "var(--brand)" : "var(--heirloom)",
                  fontWeight: form.addressType === t ? 700 : 400,
                  fontFamily: FONT_UI,
                }}
              >
                <i
                  className={`bi bi-${
                    t === "Home" ? "house" : "briefcase"
                  } s-addresslist-9eec06`}
                />
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Set as default */}
      {showDefault && (
        <label className="s-paymentaddre-132f98 s-paymentaddre-ffd8281d">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => upd("isDefault")(e.target.checked)}
            className="s-paymentaddre-b7cf92 s-paymentaddre-288743"
          />
          Set as default address
        </label>
      )}

      {/* Submit */}
      <div className="s-paymentaddre-7c6003">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || pinStatus === "loading"}
          className="s-paymentaddre-7578d9"
          style={{
            cursor: submitting || pinStatus === "loading" ? "wait" : "pointer",
            fontFamily: FONT_UI,
            opacity: submitting ? 0.85 : 1,
          }}
        >
          {submitting ? (
            <>
              <span className="s-paymentaddre-ba4d02" /> Saving…
            </>
          ) : (
            <>
              {submitLabel} <i className="bi bi-arrow-right" />
            </>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="s-paymentaddre-7d36f7 s-paymentaddre-ffd8281d"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentAddress() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBuyNow = searchParams.get("buyNow") === "1";
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { getUserId, hasValidToken } = useAuthStore();
  const userId = getUserId();
  const isAuth = hasValidToken();
  useEffect(() => {
    const session = isBuyNow ? getBuyNowSession() : readCheckoutSession();
    if (!session?.items?.length) return;

    const store = useCartStore.getState();
    store.setSelectedItems?.(session.items as any);
    store.setSubTotal?.(session.subTotal);
    if (!isBuyNow && session.shipping) {
      store.setShipping?.(session.shipping as any);
    }
  }, [isBuyNow]);

  // Auth
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<FormState>(() => createDraftForm(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [states, setStates] = useState<any[]>([]);

  // Guest
  const [guestEmail, setGuestEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [showSignInBanner, setShowSignInBanner] = useState(true);
  const [emailRegistered, setEmailRegistered] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Guest address form state
  const [guestForm, setGuestForm] = useState<FormState>(() =>
    createDraftForm(user),
  );
  const [guestErrors, setGuestErrors] = useState<Record<string, string>>({});

  // Fetch saved addresses
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    enabled: isAuth && !!userId,
    select: (d: any) => d?.list ?? d ?? [],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    api
      .get("/MDM/state", { params: { "Page.Size": 100 } })
      .then((r) => setStates(r.data?.list ?? r.data ?? []))
      .catch(() => {
        setStates([]);
      });
  }, []);

  useEffect(() => {
    const addrs = addresses as any[];
    if (addrs.length > 0 && !selectedAddressId) {
      const def = addrs.find((a: any) => a.isDefault) ?? addrs[0];
      setSelectedAddressId(def.addressId);
    }
  }, [addresses]);

  useEffect(() => {
    setGuestForm((f) => mergeContactIntoForm(f, user));
  }, [user]);

  useEffect(() => {
    if (!showForm || editItem) return;
    setForm((f) => mergeContactIntoForm(f, user));
  }, [showForm, editItem, user]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    const hydrateState = (f: FormState): FormState => {
      const match = resolveStateMatch(states, f.state);
      if (
        match &&
        (f.stateId !== match.stateId || f.state !== match.stateName)
      ) {
        return { ...f, stateId: match.stateId, state: match.stateName };
      }

      if (!f.state.trim() && f.stateId != null) {
        const label = getStateLabelById(states, f.stateId);
        if (label) return { ...f, state: label };
      }

      return f;
    };

    setForm(hydrateState);
    setGuestForm(hydrateState);
  }, [states]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editItem
        ? updateAddress(editItem.addressId, { ...data, userProfileId: userId })
        : createAddress({ ...data, userProfileId: userId }),
    onSuccess: (saved: any, variables: any) => {
      const savedPayload = saved?.data ?? saved ?? {};
      const savedAddressId = Number(
        savedPayload?.addressId ??
          saved?.addressId ??
          editItem?.addressId ??
          variables?.addressId,
      );
      const rememberedState = String(variables?.state ?? "").trim();
      const cacheKey =
        Number.isFinite(savedAddressId) && savedAddressId > 0
          ? savedAddressId
          : variables?.pinCode ?? null;
      rememberAddressState(cacheKey, {
        state: rememberedState,
        stateId: variables?.stateId ?? null,
        pinCode: variables?.pinCode ?? null,
      });

      const nextAddress = {
        ...(variables ?? {}),
        ...savedPayload,
        addressId:
          Number.isFinite(savedAddressId) && savedAddressId > 0
            ? savedAddressId
            : editItem?.addressId ?? savedPayload?.addressId ?? null,
        userProfileId: userId || variables?.userProfileId || "",
      };

      qc.setQueryData(["addresses", userId], (current: any[] = []) => {
        const list = Array.isArray(current) ? current : [];
        if (editItem?.addressId) {
          return list.map((addr: any) =>
            addr.addressId === editItem.addressId
              ? { ...addr, ...nextAddress }
              : addr,
          );
        }

        if (
          savedAddressId > 0 &&
          list.some((addr: any) => addr.addressId === savedAddressId)
        ) {
          return list.map((addr: any) =>
            addr.addressId === savedAddressId
              ? { ...addr, ...nextAddress }
              : addr,
          );
        }

        return [nextAddress, ...list];
      });

      toast.success(editItem ? "Address updated!" : "Address saved!");
      qc.invalidateQueries({ queryKey: ["addresses", userId] });
      if (Number.isFinite(savedAddressId) && savedAddressId > 0) {
        setSelectedAddressId(savedAddressId);
      }
      setShowForm(false);
      setEditItem(null);
      setForm(createDraftForm(user));
      setErrors({});
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save address"),
  });

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = (
    f: FormState,
    setE: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  ): boolean => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Full name is required";
    if (!f.phone.trim()) e.phone = "Mobile number is required";
    else if (!/^\d{10}$/.test(f.phone))
      e.phone = "Please enter a valid 10-digit mobile number";
    if (!f.houseNo.trim()) e.houseNo = "House / flat details are required";
    if (!f.addressLine.trim()) e.addressLine = "Street / road is required";
    if (!f.city.trim()) e.city = "City is required";
    if (!f.state.trim()) e.state = "State is required";
    if (!f.pinCode.trim()) e.pinCode = "Pincode is required";
    else if (!/^\d{6}$/.test(f.pinCode))
      e.pinCode = "Please enter a valid 6-digit pincode";
    setE(e);
    return Object.keys(e).length === 0;
  };

  // ── OTP flow ────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const email = guestEmail.trim().toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setOtpError("Enter a valid email address");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    setEmailRegistered(false);
    try {
      const registration = await checkForgotPasswordChannels(email);
      if (registration.registered) {
        setEmailRegistered(true);
        setOtpSent(false);
        setOtpValue("");
        setResendTimer(0);
        toast.error(
          "This email is already registered. Please sign in. If you forgot your password, please reset it.",
        );
        return;
      }
    } catch {
      setOtpError(
        "Unable to verify whether this email is registered. Please try again.",
      );
      return;
    }
    try {
      await api.post("/auth/send-otp", {
        email,
        purpose: "guest_checkout",
      });
      setOtpSent(true);
      setResendTimer(120);
      toast.success("OTP sent to " + guestEmail);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const message = String(
        err?.response?.data?.message ??
          (typeof detail === "string" ? detail : "") ??
          "",
      ).trim();
      const isRegistered =
        status === 409 ||
        (typeof detail === "object" && detail?.exists) ||
        /already registered|already exists|exists/i.test(message);

      if (isRegistered) {
        setEmailRegistered(true);
        setOtpSent(false);
        setOtpValue("");
        setResendTimer(0);
        toast.error(
          "This email is already registered. Please sign in. If you forgot your password, please reset it.",
        );
      } else if (status === 400)
        setOtpError(typeof detail === "string" ? detail : "Invalid email.");
      else setOtpError("Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.length < GUEST_OTP_LENGTH) {
      setOtpError(`Enter all ${GUEST_OTP_LENGTH} digits of the OTP`);
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        email: guestEmail.toLowerCase(),
        otp: otpValue.replace(/\s/g, "").trim(),
        purpose: "guest_checkout",
      });
      if (res.data?.access_token) {
        const { login } = useAuthStore.getState();
        let userInfo: any = {
          userId: "",
          email: guestEmail,
          roleId: 2,
          firstName: "",
        };

        try {
          const rawInfo = await getUserInfo(res.data.access_token);
          userInfo = normalizeUserInfo(rawInfo);
        } catch {
          // Best-effort only. The address can still be saved immediately via cache update.
        }

        login(userInfo as any, res.data.access_token);
      }
      setOtpVerified(true);
      setResendTimer(0);
      toast.success("Email verified! Now fill in your delivery address.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setOtpError(
        typeof detail === "string"
          ? detail
          : typeof detail === "object"
          ? detail?.message ?? "Invalid OTP"
          : "Invalid OTP. Try again.",
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Continue handlers ───────────────────────────────────────────────────
  const handleGuestContinue = () => {
    if (!validate(guestForm, setGuestErrors)) {
      toast.error("Please fix the highlighted errors");
      return;
    }
    const state =
      guestForm.state.trim() || getStateLabelById(states, guestForm.stateId);
    const stateId = resolveStateId(states, state) ?? guestForm.stateId ?? null;
    sessionStorage.setItem(
      "guestAddress",
      JSON.stringify({
        ...guestForm,
        state,
        stateId,
        addressLine: [guestForm.houseNo, guestForm.addressLine]
          .filter(Boolean)
          .join(", "),
        email: guestEmail,
      }),
    );
    navigate("/user-products/shipping-option?buyNow=" + (isBuyNow ? "1" : "0"));
  };

  const handleAuthContinue = () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address");
      return;
    }
    sessionStorage.setItem("selectedAddressId", String(selectedAddressId));
    navigate("/user-products/shipping-option" + (isBuyNow ? "?buyNow=1" : ""));
  };

  const handleSaveAddress = () => {
    if (!validate(form, setErrors)) return;
    const state = form.state.trim() || getStateLabelById(states, form.stateId);
    const stateId = resolveStateId(states, state) ?? form.stateId ?? null;
    // Backend has no separate houseNo field — combine houseNo + addressLine into one
    const combinedAddress = [form.houseNo, form.addressLine]
      .filter(Boolean)
      .join(", ");
    saveMutation.mutate({
      ...form,
      addressLine: combinedAddress,
      state,
      stateId,
    });
  };

  const mobileFooterAction = !isAuth
    ? otpVerified
      ? {
          label: "Continue to Shipping",
          onClick: handleGuestContinue,
          disabled: false,
          busy: false,
        }
      : null
    : showForm
    ? {
        label: editItem ? "Update Address" : "Save Address",
        onClick: handleSaveAddress,
        disabled: false,
        busy: saveMutation.isPending,
      }
    : {
        label: "Continue to Shipping",
        onClick: handleAuthContinue,
        disabled: !selectedAddressId,
        busy: false,
      };

  const mobileFooterBadge = !isAuth
    ? "Delivery address"
    : showForm
    ? editItem
      ? "Edit address"
      : "New address"
    : selectedAddressId
    ? "Address selected"
    : "Select address";

  const editAddress = (addr: any) => {
    setEditItem(addr);
    const remembered = getRememberedAddressState(
      addr?.addressId,
      addr?.pinCode,
    );
    const state = getAddressStateLabel(addr, states);
    const resolvedStateMatch = resolveStateMatch(
      states,
      addr.state ?? addr.stateName ?? remembered?.state ?? "",
    );
    // Backend stores houseNo + addressLine combined in addressLine.
    // extractAddressParts splits: first segment → houseNo, rest → street
    const parsed = extractAddressParts(addr.addressLine, addr.locality);
    setForm({
      name: addr.name ?? "",
      phone: addr.phone ?? "",
      houseNo: parsed.houseNo, // first segment = house/flat/building
      addressLine: parsed.street, // rest = street/colony/road
      locality: parsed.locality || addr.locality || "",
      city: addr.city ?? "",
      state,
      stateId:
        addr.stateId ??
        remembered?.stateId ??
        resolvedStateMatch?.stateId ??
        resolveStateId(states, state) ??
        null,
      country: addr.country ?? "India",
      pinCode: addr.pinCode ?? "",
      addressType: addr.typeId === 2 ? "Work" : "Home",
      isDefault: addr.isDefault ?? false,
    });
    setErrors({});
    setShowForm(true);
  };

  const getFullAddr = (a: any) => {
    const parsed = extractAddressParts(a.addressLine, a.locality);
    const state = getAddressStateLabel(a, states);
    return [parsed.displayLine, a.city, state, a.pinCode]
      .filter(Boolean)
      .join(", ");
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="s-paymentaddre-2e2509 s-paymentaddre-ffd8281d checkout-shell checkout-shell--address">
      {/* ════════════════ GUEST FLOW ════════════════ */}
      {!isAuth && (
        <>
          {/* Sign-in nudge */}
          {showSignInBanner && (
            <div className="s-paymentaddre-8d9363">
              <span className="s-quickcart-08341f s-paymentaddre-ffd8281d">
                <i className="bi bi-person-circle s-paymentaddre-dffb97" />
                Have an account?{" "}
                <Link to="/login" className="s-paymentaddre-8b8b2d">
                  Sign in
                </Link>{" "}
                to use saved addresses &amp; track orders.
              </span>
              <button
                onClick={() => setShowSignInBanner(false)}
                className="s-paymentaddre-d488bf"
              >
                ×
              </button>
            </div>
          )}

          {/* Step 1 — Email verify */}
          {!otpVerified && (
            <div className="s-paymentaddre-81c77f">
              <div className="s-paymentaddre-083bcb">
                <div className="s-paymentaddre-39fefb">1</div>
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">
                  Verify your email
                </h6>
              </div>

              <div className="s-paymentaddre-392b28">
                <div className="s-userdashboar-6d7d28">
                  <label style={labelSt}>
                    Email Address{" "}
                    <span className="s-resetpasswor-ddc1b2">*</span>
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      setOtpError("");
                      setOtpSent(false);
                      setOtpValue("");
                      setEmailRegistered(false);
                    }}
                    placeholder="you@example.com"
                    disabled={otpSent}
                    style={inpStyle(false, otpSent)}
                  />
                </div>
                <button
                  type="button"
                  onClick={
                    otpSent
                      ? () => {
                          setOtpSent(false);
                          setOtpValue("");
                          setEmailRegistered(false);
                        }
                      : handleSendOtp
                  }
                  disabled={otpLoading || emailRegistered}
                  className="s-paymentaddre-a7c6a4"
                  style={{
                    background: otpSent ? "#fff" : "var(--brand)",
                    color: otpSent ? "var(--brand)" : "#fff",
                    fontFamily: FONT_UI,
                  }}
                >
                  {otpLoading
                    ? "Sending…"
                    : otpSent
                    ? "Change email"
                    : "Send OTP"}
                </button>
              </div>

              {otpSent && (
                <div className="s-paymentaddre-10efad">
                  <label style={labelSt}>
                    OTP sent to <strong>{guestEmail}</strong>
                  </label>
                  <div className="s-adminproduct-0f6417">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otpValue}
                      onChange={(e) => {
                        setOtpValue(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, GUEST_OTP_LENGTH),
                        );
                        setOtpError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                      placeholder="• • • • • •"
                      maxLength={GUEST_OTP_LENGTH}
                      autoComplete="one-time-code"
                      className="s-paymentaddre-66b84d s-paymentaddre-ffd8281d"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={
                        otpLoading || otpValue.length < GUEST_OTP_LENGTH
                      }
                      className="s-paymentaddre-24677c"
                      style={{
                        background:
                          otpValue.length >= GUEST_OTP_LENGTH
                            ? "var(--brand)"
                            : "var(--ivory)",
                        cursor:
                          otpValue.length >= GUEST_OTP_LENGTH
                            ? "pointer"
                            : "not-allowed",
                        fontFamily: FONT_UI,
                      }}
                    >
                      {otpLoading ? "Verifying…" : "Verify OTP"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (resendTimer > 0) return;
                      setOtpValue("");
                      setOtpError("");
                      handleSendOtp();
                    }}
                    disabled={resendTimer > 0}
                    className="s-paymentaddre-3e995d"
                    style={{
                      border: `1.5px solid ${
                        resendTimer > 0 ? "var(--ivory)" : "var(--brand)"
                      }`,
                      color:
                        resendTimer > 0 ? "var(--heirloom)" : "var(--brand)",
                      fontFamily: FONT_UI,
                      cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    {resendTimer > 0 ? (
                      `Resend in ${Math.floor(resendTimer / 60)}:${String(
                        resendTimer % 60,
                      ).padStart(2, "0")}`
                    ) : (
                      <>
                        <i className="bi bi-arrow-clockwise" /> Resend OTP
                      </>
                    )}
                  </button>
                </div>
              )}

              {emailRegistered && (
                <div className="s-paymentaddre-e5a6a2">
                  <span className="s-quickcart-08341f">
                    <i className="bi bi-info-circle s-paymentaddre-827b5f" />
                    <strong>{guestEmail}</strong> is already registered.
                  </span>
                  <div className="s-adminbrands-ac734d">
                    <Link to="/login" className="s-paymentaddre-e47eab">
                      Sign In
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailRegistered(false);
                        setGuestEmail("");
                        setOtpError("");
                      }}
                      className="s-paymentaddre-99313b s-paymentaddre-ffd8281d"
                    >
                      Use different email
                    </button>
                  </div>
                </div>
              )}

              {otpError && !emailRegistered && (
                <p style={{ ...errSt, marginTop: 10, fontSize: 13 }}>
                  <i className="bi bi-exclamation-circle" /> {otpError}
                </p>
              )}
            </div>
          )}

          {/* Step 2 — Delivery Address form */}
          {otpVerified && (
            <div className="s-ourstores-5cd98f">
              <div className="s-paymentaddre-3618cd">
                <i className="bi bi-check-circle-fill s-paymentaddre-d3e729" />
                <span className="s-cart-1c5a85">{guestEmail} verified</span>
              </div>
              <div className="s-paymentaddre-b28ef4">
                <div className="s-paymentaddre-39fefb">2</div>
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">
                  Delivery Address
                </h6>
              </div>
              <AddressFormPanel
                form={guestForm}
                setForm={setGuestForm}
                errors={guestErrors}
                setErrors={setGuestErrors}
                states={states}
                onSubmit={handleGuestContinue}
                submitLabel="Continue to Shipping"
                showDefault={false}
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════ AUTH FLOW ════════════════ */}
      {isAuth && (
        <>
          {/* Header */}
          <div className="s-paymentaddre-0d4697">
            <span className="s-paymentaddre-1ba117">
              Select a delivery address
            </span>
            {!showForm && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setEditItem(null);
                  setForm(createDraftForm(user));
                  setErrors({});
                }}
                className="s-paymentaddre-4edcea s-paymentaddre-ffd8281d"
              >
                <i className="bi bi-plus-circle" /> Add New Address
              </button>
            )}
          </div>

          {/* Address list */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingTop: 8,
              }}
            >
              {[1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    border: "2px solid var(--ivory)",
                    borderRadius: 14,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      className="twam-skel"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="twam-skel"
                        style={{
                          height: 14,
                          width: "50%",
                          borderRadius: 5,
                          marginBottom: 8,
                        }}
                      />
                      <div
                        className="twam-skel"
                        style={{
                          height: 12,
                          width: "80%",
                          borderRadius: 5,
                          marginBottom: 6,
                        }}
                      />
                      <div
                        className="twam-skel"
                        style={{ height: 12, width: "60%", borderRadius: 5 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            (addresses as any[]).map((addr: any) => (
              <div
                key={addr.addressId}
                className="pa-addr-card s-paymentaddre-2e14df"
                onClick={() => setSelectedAddressId(addr.addressId)}
                style={{
                  border: `2px solid ${
                    selectedAddressId === addr.addressId
                      ? "var(--brand)"
                      : "var(--ivory)"
                  }`,
                  background:
                    selectedAddressId === addr.addressId
                      ? `var(--brand)05`
                      : "#fff",
                }}
              >
                <div className="s-paymentaddre-9998cf">
                  {/* Custom radio */}
                  <div
                    className="s-paymentaddre-4e0051"
                    style={{
                      border: `2px solid ${
                        selectedAddressId === addr.addressId
                          ? "var(--brand)"
                          : "var(--ivory)"
                      }`,
                      background:
                        selectedAddressId === addr.addressId
                          ? "var(--brand)"
                          : "#fff",
                    }}
                  >
                    {selectedAddressId === addr.addressId && (
                      <div className="s-payment-108f10" />
                    )}
                  </div>

                  <div className="s-paymentaddre-card-body">
                    <div className="s-paymentaddre-87be9d">
                      <span className="s-adminsizes-5de088 s-paymentaddre-ffd02986">
                        {addr.name}
                      </span>
                      <span className="s-paymentaddre-5dd002">
                        <i
                          className={`bi bi-${
                            addr.typeId === 2 ? "briefcase" : "house"
                          } s-paymentaddre-0bc507`}
                        />
                        {addr.typeId === 2 ? "Work" : "Home"}
                      </span>
                      {addr.isDefault && (
                        <span className="s-paymentaddre-0f4f48">Default</span>
                      )}
                    </div>
                    <p className="s-paymentaddre-73515b">{getFullAddr(addr)}</p>
                    <p className="s-paymentaddre-9168e1">
                      <i className="bi bi-telephone s-paymentaddre-6b8f40" />
                      {addr.phone}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editAddress(addr);
                    }}
                    className="s-paymentaddre-737dbe s-paymentaddre-ffd8281d"
                  >
                    <i className="bi bi-pencil s-addresslist-2c42ad" /> Edit
                  </button>
                </div>
              </div>
            ))
          )}

          {(addresses as any[]).length === 0 && !showForm && (
            <div className="s-paymentaddre-db9c9f">
              <i className="bi bi-geo-alt s-paymentaddre-47f187" />
              <p className="s-addresslist-92985e">
                No saved addresses. Add one to continue.
              </p>
            </div>
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div
              className="s-paymentaddre-01ed0c"
              style={{ border: `1px solid ${IVORY_DK}` }}
            >
              <div className="s-adminproduct-a1f2ef">
                <h6 className="s-paymentaddre-bf268a s-paymentaddre-ffd02986">
                  {editItem ? "Edit Address" : "Add New Address"}
                </h6>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditItem(null);
                    setForm(createDraftForm(user));
                    setErrors({});
                  }}
                  className="s-paymentaddre-2a22b3"
                >
                  ×
                </button>
              </div>
              <AddressFormPanel
                form={form}
                setForm={setForm}
                errors={errors}
                setErrors={setErrors}
                states={states}
                onSubmit={handleSaveAddress}
                submitLabel={editItem ? "Update Address" : "Save Address"}
                submitting={saveMutation.isPending}
                onCancel={() => {
                  setShowForm(false);
                  setEditItem(null);
                  setForm(createDraftForm(user));
                  setErrors({});
                }}
                showDefault
              />
            </div>
          )}

          {/* Continue CTA */}
          <button
            type="button"
            onClick={handleAuthContinue}
            disabled={!selectedAddressId}
            className="s-paymentaddre-cbec3d"
            style={{
              cursor: selectedAddressId ? "pointer" : "not-allowed",
              opacity: selectedAddressId ? 1 : 0.45,
              fontFamily: FONT_UI,
            }}
          >
            Continue to Shipping <i className="bi bi-arrow-right" />
          </button>
        </>
      )}

      {mobileFooterAction && (
        <div
          className="checkout-mobile-action-bar checkout-mobile-action-bar--address"
          style={{ display: "none" }}
        >
          <div className="checkout-mobile-action-bar__meta">
            <span className="checkout-mobile-action-bar__badge">
              {mobileFooterBadge}
            </span>
          </div>
          <button
            type="button"
            onClick={mobileFooterAction.onClick}
            disabled={mobileFooterAction.disabled || mobileFooterAction.busy}
            className="checkout-mobile-action-bar__primary"
          >
            {mobileFooterAction.busy ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : (
              mobileFooterAction.label
            )}
          </button>
        </div>
      )}
    </div>
  );
}
