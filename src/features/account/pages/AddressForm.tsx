// Fixed: Capacitor Geolocation replaces navigator.geolocation for Android APK support
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
  reverseGeocode,
  resolveStateId,
} from "@/shared/utils/addressLocation";

// ── Capacitor-aware geolocation ───────────────────────────────────────────────
// Uses @capacitor/geolocation on Android (shows native permission dialog).
// Falls back to browser navigator.geolocation in web/dev mode.
async function getPosition(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted") throw new Error("PERMISSION_DENIED");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (err: any) {
    if (
      err?.message === "PERMISSION_DENIED" ||
      err?.message?.includes("denied") ||
      err?.code === 1
    ) {
      throw new Error("PERMISSION_DENIED");
    }
    // Capacitor not available — fall back to browser API (web dev mode)
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("NOT_SUPPORTED"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (e) =>
          reject(
            e.code === 1
              ? new Error("PERMISSION_DENIED")
              : new Error("GEO_ERROR"),
          ),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const [geoLoading, setGeoLoading] = useState(false);
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
        setForm({
          name: addr.name ?? "",
          phone: addr.phone ?? "",
          addressLine: addr.addressLine ?? "",
          locality: addr.locality ?? "",
          city: addr.city ?? "",
          pinCode: addr.pinCode ?? "",
          stateId: addr.stateId ?? null,
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
        city: data.city || f.city,
        stateId: matchedStateId ?? f.stateId,
      }));
    }, 600);
    return () => {
      if (pinTimer.current) clearTimeout(pinTimer.current);
    };
  }, [form.pinCode, states]);

  // ── FIXED: Capacitor Geolocation — works on Android APK ──────────────────
  const handleGeoFill = async () => {
    setGeoLoading(true);
    try {
      const { latitude, longitude } = await getPosition();
      const geo = await reverseGeocode(latitude, longitude);
      if (!geo) {
        toast.error("Could not fetch location details. Please fill manually.");
        return;
      }
      const matchedStateId = resolveStateId(states, geo.state);
      setForm((f) => ({
        ...f,
        addressLine: f.addressLine || geo.road,
        locality: geo.suburb || f.locality,
        city: geo.city || f.city,
        stateId: matchedStateId ?? f.stateId,
        pinCode: geo.postcode || f.pinCode,
      }));
      toast.success("Location auto-filled. Please verify the details.");
    } catch (err: any) {
      if (err?.message === "PERMISSION_DENIED") {
        toast.error(
          "Location permission denied. Go to Settings → Apps → TWAM → Permissions → Location → Allow.",
        );
      } else if (err?.message === "NOT_SUPPORTED") {
        toast.error("Geolocation is not supported on this device.");
      } else {
        toast.error("Could not detect location. Please fill manually.");
      }
    } finally {
      setGeoLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateAddress(Number(id), { ...form, userProfileId: userId })
        : createAddress({ ...form, userProfileId: userId }),
    onSuccess: () => {
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

        <div className="s-addressform-b04dc9">
          <div className="s-paymentaddre-12ca4c" style={{ marginBottom: 18 }}>
            <span className="s-paymentaddre-786faa s-paymentaddre-ffd8281d">
              <i className="bi bi-geo-alt s-paymentaddre-21c065" />
              Auto-fill your city, state and area from your current location
            </span>
            <button
              type="button"
              onClick={handleGeoFill}
              disabled={geoLoading}
              className="s-paymentaddre-8db409"
              style={{
                background: geoLoading ? "var(--ivory)" : "var(--brand)",
                color: geoLoading ? "var(--brand)" : "#fff",
                fontFamily: '"Trebuchet MS", Arial, sans-serif',
                cursor: geoLoading ? "wait" : "pointer",
              }}
            >
              {geoLoading ? (
                <>
                  <span className="s-paymentaddre-eb8efd" /> Detecting...
                </>
              ) : (
                <>
                  <i className="bi bi-geo-alt-fill s-couponslist-030edf" /> Use
                  My Location
                </>
              )}
            </button>
          </div>

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
