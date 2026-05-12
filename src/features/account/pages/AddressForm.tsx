// Address form with Rapido-style MapPicker integration.
// Clicking "Set Location on Map" opens the full-screen map — it auto-GPS centres,
// user drags map / moves pin, then confirms to fill all address fields.
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  createAddress,
  updateAddress,
  listAddress,
} from "@/features/orders/api/orders.api";
import api from "@/shared/api/axiosInstance";
import {
  lookupPincode,
  getRememberedAddressState,
  rememberAddressState,
  resolveStateId,
} from "@/shared/utils/addressLocation";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MapPicker from "@/shared/components/MapPicker";
import type { MapPickerResult } from "@/shared/components/MapPicker";

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

  return {
    addressLine: [lineParts[0] ?? "", lineParts.slice(1).join(", ")]
      .filter(Boolean)
      .join(", "),
    locality: inferredLocality,
  };
};

const getStateLabelById = (states: any[], stateId: unknown): string => {
  const numericId = Number(stateId);
  if (!Number.isFinite(numericId)) return "";

  const match = states.find(
    (state: any) => Number(state?.stateId ?? state?.id) === numericId,
  );
  return String(match?.stateName ?? match?.name ?? match?.state ?? "").trim();
};

const emptyForm = {
  name: "",
  phone: "",
  addressLine: "",
  locality: "",
  city: "",
  pinCode: "",
  stateId: null as number | null,
  addressType: "Home",
  isDefault: false,
};

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
  form: typeof emptyForm,
  user?: Parameters<typeof getProfileContact>[0],
): typeof emptyForm => {
  const contact = getProfileContact(user);
  return {
    ...form,
    name: form.name.trim() ? form.name : contact.name,
    phone: form.phone.trim() ? form.phone : contact.phone,
  };
};

export default function AddressForm() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { getUserId } = useAuthStore();
  const userId = getUserId();
  const isEdit = !!id;

  const [form, setForm] = useState(() => createDraftForm(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [states, setStates] = useState<any[]>([]);
  const [pinStatus, setPinStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCoords, setMapCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get("/MDM/state", { params: { "Page.Size": 100 } })
      .then((r) => setStates(r.data?.list ?? r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) return;
    setForm((f) => mergeContactIntoForm(f, user));
  }, [isEdit, user]);

  useEffect(() => {
    if (!isEdit) return;
    listAddress({ userProfileId: userId }).then((d: any) => {
      const addr = (d?.list ?? d ?? []).find(
        (a: any) => String(a.addressId) === id,
      );
      if (addr) {
        const parsed = extractAddressParts(addr.addressLine, addr.locality);
        const remembered = getRememberedAddressState(
          addr?.addressId,
          addr?.pinCode,
        );
        setForm({
          name: addr.name ?? "",
          phone: addr.phone ?? "",
          addressLine: parsed.addressLine || addr.addressLine || "",
          locality: parsed.locality || addr.locality || "",
          city: addr.city ?? "",
          pinCode: addr.pinCode ?? "",
          stateId:
            addr.stateId ??
            remembered?.stateId ??
            resolveStateId(
              states,
              addr.state ?? addr.stateName ?? remembered?.state ?? "",
            ) ??
            null,
          addressType: addr.typeId === 2 ? "Work" : "Home",
          isDefault: addr.isDefault ?? false,
        });
      }
    });
  }, [id, isEdit, userId]);

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
        return;
      }
      setPinStatus("ok");
      setErrors((e) => {
        const next = { ...e };
        delete next.pinCode;
        return next;
      });
      const matchedStateId = resolveStateId(states, data.state);
      setForm((f) => ({
        ...f,
        city: f.city.trim() ? f.city : data.city || f.city,
        stateId: f.stateId ?? matchedStateId ?? null,
      }));
    }, 600);
    return () => {
      if (pinTimer.current) clearTimeout(pinTimer.current);
    };
  }, [form.pinCode, states]);

  // ── Map pin-point handler ──────────────────────────────────────────────────
  // AddressForm has no separate houseNo field — addressLine holds building+street.
  // Clears old values completely and fills fresh from map pin.
  //   building + street → addressLine  (House no., building, street, area)
  //   area              → locality     (Near landmark or area name)
  //   city              → city
  //   pinCode           → pinCode
  //   state             → stateId (resolved via state dropdown)
  //   name / phone      → kept as-is
  const handleMapConfirm = (result: MapPickerResult) => {
    const matchedStateId = resolveStateId(states, result.state);
    setMapCoords({ lat: result.latitude, lng: result.longitude });
    const combinedAddress = [result.building, result.street]
      .filter(Boolean)
      .join(", ");
    setForm((f) => ({
      ...f, // always keep name, phone, addressType, isDefault
      // Only overwrite a field if map returned a value — leave blank for user to fill
      ...(combinedAddress && { addressLine: combinedAddress }), // building + road → Address Line
      ...(result.area && { locality: result.area }), // ward/colony     → Locality
      ...(result.city && { city: result.city }),
      ...(result.pinCode && { pinCode: result.pinCode }),
      ...(matchedStateId != null && { stateId: matchedStateId }),
    }));
    setErrors({});
    toast.success(
      "📍 Location pinned! Verify and complete any missing details.",
    );
  };
  // ───────────────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateAddress(Number(id), { ...form, userProfileId: userId })
        : createAddress({ ...form, userProfileId: userId }),
    onSuccess: (saved: any) => {
      const savedAddressId = Number(
        saved?.addressId ?? saved?.data?.addressId ?? id,
      );
      const cacheKey =
        Number.isFinite(savedAddressId) && savedAddressId > 0
          ? savedAddressId
          : form.pinCode || null;
      rememberAddressState(cacheKey, {
        state: getStateLabelById(states, form.stateId) || undefined,
        stateId: form.stateId ?? null,
        pinCode: form.pinCode ?? null,
      });
      toast.success(isEdit ? "Address updated!" : "Address added!");
      qc.invalidateQueries({ queryKey: ["addresses"] });
      navigate("/account/address-list");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save address"),
  });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter 10-digit number";
    if (!form.addressLine.trim()) e.addressLine = "Address line is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.pinCode.trim()) e.pinCode = "Pincode is required";
    else if (!/^\d{6}$/.test(form.pinCode))
      e.pinCode = "6-digit pincode required";
    if (states.length > 0 && !form.stateId) e.stateId = "State is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (field: string, val: any) =>
    setForm((f) => ({ ...f, [field]: val }));

  const clearError = (...keys: string[]) =>
    setErrors((e) => {
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const pinBorder =
    pinStatus === "ok" || pinStatus === "error"
      ? "var(--brand)"
      : "var(--ivory)";

  return (
    <>
      <div>
        {!isMobile && (
          <div className="s-addressform-bafc04">
            <button
              onClick={() => navigate("/account/address-list")}
              className="s-addressform-be2487"
            >
              <i className="bi bi-arrow-left" />
            </button>
            <h2 className="s-addressform-638cea">
              {isEdit ? "Edit Address" : "Add New Address"}
            </h2>
          </div>
        )}

        <div className="s-addressform-b04dc9">
          {/* ── Set Location on Map — opens Rapido-style MapPicker (auto-GPS + drag pin) ── */}
          <div className="s-paymentaddre-12ca4c" style={{ marginBottom: 18 }}>
            <span className="s-paymentaddre-786faa s-paymentaddre-ffd8281d">
              <i className="bi bi-geo-alt s-paymentaddre-21c065" />
              Open map to pin your exact delivery location
            </span>
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="s-paymentaddre-8db409"
              style={{
                background: "var(--brand)",
                color: "#fff",
                fontFamily: '"Trebuchet MS", Arial, sans-serif',
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <i className="bi bi-geo-alt-fill s-couponslist-030edf" /> Set
              Location on Map
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

          <div>
            <label className="s-addressform-f1fb64">Full Name *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="inp-field"
              placeholder="Full name"
            />
            {errors.name && <p className="auth-err-text">{errors.name}</p>}
          </div>

          <div>
            <label className="s-addressform-f1fb64">Mobile Number *</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="inp-field"
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            {errors.phone && <p className="auth-err-text">{errors.phone}</p>}
          </div>

          <div>
            <label className="s-addressform-f1fb64">Address Line *</label>
            <input
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
              className="inp-field"
              placeholder="House no., building, street, area"
            />
            {errors.addressLine && (
              <p className="auth-err-text">{errors.addressLine}</p>
            )}
          </div>

          <div>
            <label className="s-addressform-f1fb64">Locality / Landmark</label>
            <input
              value={form.locality}
              onChange={(e) => set("locality", e.target.value)}
              className="inp-field"
              placeholder="Near landmark or area name"
            />
          </div>

          <div className="s-addressform-cdfbe9">
            <div>
              <label className="s-addressform-f1fb64">City *</label>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="inp-field"
                placeholder="City"
              />
              {errors.city && <p className="auth-err-text">{errors.city}</p>}
            </div>
            <div>
              <label className="s-addressform-f1fb64">
                Pincode *
                {pinStatus === "loading" && (
                  <span className="s-paymentaddre-2afd25">
                    <span className="s-paymentaddre-981cc0" /> Verifying...
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
                  set("pinCode", v);
                  if (v.length < 6) setPinStatus("idle");
                  clearError("pinCode");
                }}
                className="inp-field"
                placeholder="6-digit pincode"
                maxLength={6}
                style={{ borderColor: pinBorder }}
              />
              {errors.pinCode && pinStatus === "error" && (
                <p className="auth-err-text">{errors.pinCode}</p>
              )}
            </div>
          </div>

          {states.length > 0 && (
            <div>
              <label className="s-addressform-f1fb64">State *</label>
              <select
                value={form.stateId ?? ""}
                onChange={(e) => {
                  set(
                    "stateId",
                    e.target.value ? Number(e.target.value) : null,
                  );
                  clearError("stateId");
                }}
                className="inp-field s-addressform-ebd15a"
              >
                <option value="">Select State</option>
                {states.map((s: any) => (
                  <option key={s.stateId} value={s.stateId}>
                    {s.stateName || s.name}
                  </option>
                ))}
              </select>
              {errors.stateId && (
                <p className="auth-err-text">{errors.stateId}</p>
              )}
            </div>
          )}

          <div>
            <label className="s-addressform-dd104a">Address Type</label>
            <div className="s-addressform-be0342">
              {["Home", "Work"].map((t) => (
                <label
                  key={t}
                  className="s-addressform-e997cd"
                  style={{
                    border: `2px solid ${
                      form.addressType === t ? "var(--brand)" : "var(--ivory)"
                    }`,
                    background:
                      form.addressType === t ? "var(--ivory)" : "#fff",
                    color:
                      form.addressType === t
                        ? "var(--brand)"
                        : "var(--heirloom)",
                  }}
                >
                  <input
                    type="radio"
                    name="addressType"
                    value={t}
                    checked={form.addressType === t}
                    onChange={() => set("addressType", t)}
                    className="s-addressform-8251cb"
                  />
                  <i
                    className={`bi ${
                      t === "Home" ? "bi-house-door" : "bi-briefcase"
                    }`}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <label className="s-addressform-b28077">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
              className="s-addressform-040894"
            />
            Set as default address
          </label>

          <div className="s-addressform-4a7f76">
            <button
              onClick={() => navigate("/account/address-list")}
              className="s-addressform-3fedb2"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (validate()) saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || pinStatus === "loading"}
              className="s-addressform-54d247"
              style={{ opacity: saveMutation.isPending ? 0.7 : 1 }}
            >
              {saveMutation.isPending
                ? "Saving…"
                : isEdit
                ? "Update Address"
                : "Save Address"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
