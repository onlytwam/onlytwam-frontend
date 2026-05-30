// src/features/account/pages/AddressList.tsx — Fixed
// Fixes:
//   1. useQuery enabled only when userId is present
//   2. listAddress returns array directly (normalised in orders.api.ts)
//   3. Proper empty state
//   4. Form fields match backend schema

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  listAddress,
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/features/orders/api/orders.api";
import api from "@/shared/api/axiosInstance";
import {
  getRememberedAddressState,
  lookupPincode,
  rememberAddressState,
  resolveStateId,
} from "@/shared/utils/addressLocation";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import MapPicker from "@/shared/components/MapPicker";
import type { MapPickerResult } from "@/shared/components/MapPicker";

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

  const addressLineValue = [lineParts[0] ?? "", lineParts.slice(1).join(", ")]
    .filter(Boolean)
    .join(", ");

  return {
    addressLine: addressLineValue,
    locality: inferredLocality,
    displayLine: [addressLineValue, inferredLocality]
      .filter(Boolean)
      .join(", "),
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

function TypeIcon({ typeId }: { typeId?: number }) {
  return typeId === 2 ? (
    <i className="bi bi-briefcase me-1" />
  ) : (
    <i className="bi bi-house-door me-1" />
  );
}

export default function AddressList() {
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { getUserId } = useAuthStore();
  const userId = getUserId();
  const isMobile = useIsMobile();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
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

  // Fetch addresses — backend auto-scopes to authenticated user
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => listAddress({ userProfileId: userId }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    api
      .get("/MDM/state", { params: { "Page.Size": 100 } })
      .then((r) => setStates(r.data?.list ?? r.data ?? []))
      .catch(() => {
        /* states are optional */
      });
  }, []);

  useEffect(() => {
    if (editItem) return;
    setForm((f) => mergeContactIntoForm(f, user));
  }, [editItem, user]);

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

  // ── Map confirm — fills form from dragged pin position ─────────────────────
  const handleMapConfirm = (result: MapPickerResult) => {
    const matchedStateId = resolveStateId(states, result.state);
    setMapCoords({ lat: result.latitude, lng: result.longitude });
    const combinedAddress = [result.building, result.street]
      .filter(Boolean)
      .join(", ");
    setForm((f) => ({
      ...f,
      ...(combinedAddress && { addressLine: combinedAddress }),
      ...(result.area && { locality: result.area }),
      ...(result.city && { city: result.city }),
      ...(result.pinCode && { pinCode: result.pinCode }),
      ...(matchedStateId != null && { stateId: matchedStateId }),
    }));
    setErrors({});
    toast.success(
      "📍 Location pinned! Verify and complete any missing details.",
    );
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editItem
        ? updateAddress(editItem.addressId, { ...data, userProfileId: userId })
        : createAddress({ ...data, userProfileId: userId }),
    onSuccess: (saved: any, variables: any) => {
      const savedAddressId = Number(
        saved?.addressId ?? saved?.data?.addressId ?? editItem?.addressId,
      );
      const cacheKey =
        Number.isFinite(savedAddressId) && savedAddressId > 0
          ? savedAddressId
          : variables?.pinCode ?? form.pinCode ?? null;
      rememberAddressState(cacheKey, {
        state:
          getStateLabelById(states, variables?.stateId ?? form.stateId) ||
          undefined,
        stateId: variables?.stateId ?? form.stateId ?? null,
        pinCode: variables?.pinCode ?? form.pinCode ?? null,
      });
      toast.success(editItem ? "Address updated!" : "Address saved!");
      qc.invalidateQueries({ queryKey: ["addresses", userId] });
      handleClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save address"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAddress(id),
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: ["addresses", userId] });
    },
    onError: () => toast.error("Failed to delete address"),
  });

  const handleEdit = (addr: any) => {
    setEditItem(addr);
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
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditItem(null);
    setForm(createDraftForm(user));
    setErrors({});
    setPinStatus("idle");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone.trim()))
      e.phone = "10-digit number required";
    if (!form.addressLine.trim()) e.addressLine = "Address is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.pinCode.trim()) e.pinCode = "Pincode is required";
    else if (!/^\d{6}$/.test(form.pinCode.trim()))
      e.pinCode = "6-digit pincode required";
    if (states.length > 0 && !form.stateId) e.stateId = "State is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (field: string, val: any) =>
    setForm((f) => ({ ...f, [field]: val }));

  if (!userId) {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted">Please log in to manage your addresses.</p>
      </div>
    );
  }

  return (
    <div
      className="s-addresslist-page container py-4"
      style={{ maxWidth: 720 }}
    >
      <div
        className={`d-flex align-items-center mb-4 ${
          isMobile ? "justify-content-end" : "justify-content-between"
        }`}
      >
        {!isMobile && (
          <h5
            className="mb-0"
            style={{ fontFamily: "Palatino, serif", color: "#6B0F2A" }}
          >
            Saved Addresses
          </h5>
        )}
        <button
          className="btn btn-sm"
          style={{ background: "#6B0F2A", color: "#fff", borderRadius: 8 }}
          onClick={() => {
            handleClose();
            setShowForm(true);
          }}
        >
          + Add Address
        </button>
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div
          className="card mb-4 shadow-sm"
          style={{ borderRadius: 12, border: "1.5px solid #e5c9d0" }}
        >
          <div className="card-body">
            <h6 className="mb-3" style={{ color: "#6B0F2A" }}>
              {editItem ? "Edit Address" : "New Address"}
            </h6>
            <div className="s-paymentaddre-12ca4c mb-3">
              <span className="s-paymentaddre-786faa s-paymentaddre-ffd8281d">
                <i className="bi bi-geo-alt s-paymentaddre-21c065" />
                Auto-fill your city, state and area from your current location
              </span>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="s-paymentaddre-8db409"
                style={{
                  background: "var(--brand)",
                  color: "#fff",
                  fontFamily: "Trebuchet MS, Arial, sans-serif",
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

            <div className="row g-3">
              {[
                { field: "name", label: "Full Name", type: "text", col: 6 },
                { field: "phone", label: "Phone", type: "tel", col: 6 },
                {
                  field: "addressLine",
                  label: "Address Line",
                  type: "text",
                  col: 12,
                },
                {
                  field: "locality",
                  label: "Locality / Area",
                  type: "text",
                  col: 6,
                },
                { field: "city", label: "City", type: "text", col: 6 },
                { field: "pinCode", label: "Pincode", type: "text", col: 6 },
              ].map(({ field, label, type, col }) => (
                <div key={field} className={`col-${col}`}>
                  <label
                    className="form-label"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#6B0F2A",
                    }}
                  >
                    {label}{" "}
                    {[
                      "name",
                      "phone",
                      "addressLine",
                      "city",
                      "pinCode",
                    ].includes(field) && (
                      <span style={{ color: "red" }}>*</span>
                    )}
                    {field === "pinCode" && pinStatus === "loading" && (
                      <span className="s-paymentaddre-2afd25">
                        <span className="s-paymentaddre-981cc0" />
                        Verifying...
                      </span>
                    )}
                    {field === "pinCode" && pinStatus === "ok" && (
                      <span className="s-paymentaddre-b0868f">
                        <i className="bi bi-check-circle-fill" /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type={type}
                    className={`form-control form-control-sm ${
                      errors[field] ? "is-invalid" : ""
                    }`}
                    value={(form as any)[field]}
                    onChange={(e) => {
                      const value =
                        field === "pinCode"
                          ? e.target.value.replace(/\D/g, "").slice(0, 6)
                          : e.target.value;
                      set(field, value);
                      if (field === "pinCode" && value.length < 6)
                        setPinStatus("idle");
                      if (
                        field === "pinCode" ||
                        field === "city" ||
                        field === "addressLine"
                      ) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next[field];
                          return next;
                        });
                      }
                    }}
                    style={{
                      borderRadius: 8,
                      borderColor:
                        field === "pinCode"
                          ? pinStatus === "ok" || pinStatus === "error"
                            ? "var(--brand)"
                            : "#ced4da"
                          : undefined,
                    }}
                    inputMode={field === "pinCode" ? "numeric" : undefined}
                    maxLength={field === "pinCode" ? 6 : undefined}
                  />
                  {errors[field] &&
                    !(field === "pinCode" && pinStatus !== "error") && (
                      <div className="invalid-feedback">{errors[field]}</div>
                    )}
                </div>
              ))}

              {states.length > 0 && (
                <div className="col-6">
                  <label
                    className="form-label"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#6B0F2A",
                    }}
                  >
                    State <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    className={`form-select form-select-sm ${
                      errors.stateId ? "is-invalid" : ""
                    }`}
                    value={form.stateId ?? ""}
                    onChange={(e) => {
                      set(
                        "stateId",
                        e.target.value ? Number(e.target.value) : null,
                      );
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.stateId;
                        return next;
                      });
                    }}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="">Select State</option>
                    {states.map((s: any) => (
                      <option key={s.stateId} value={s.stateId}>
                        {s.stateName || s.name}
                      </option>
                    ))}
                  </select>
                  {errors.stateId && (
                    <div className="invalid-feedback">{errors.stateId}</div>
                  )}
                </div>
              )}

              <div className="col-6">
                <label
                  className="form-label"
                  style={{ fontSize: 12.5, fontWeight: 600, color: "#6B0F2A" }}
                >
                  Type
                </label>
                <select
                  className="form-select form-select-sm"
                  value={form.addressType}
                  onChange={(e) => set("addressType", e.target.value)}
                  style={{ borderRadius: 8 }}
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                </select>
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={(e) => set("isDefault", e.target.checked)}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="isDefault"
                    style={{ fontSize: 13 }}
                  >
                    Set as default address
                  </label>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                className="btn btn-sm"
                style={{
                  background: "#6B0F2A",
                  color: "#fff",
                  borderRadius: 8,
                  minWidth: 100,
                }}
                disabled={saveMutation.isPending || pinStatus === "loading"}
                onClick={() => {
                  if (validate()) saveMutation.mutate(form);
                }}
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update"
                  : "Save"}
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ borderRadius: 8 }}
                onClick={handleClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Cards */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                border: "1.5px solid var(--ivory)",
                borderRadius: 14,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                <div
                  className="twam-skel"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    marginTop: 2,
                    flexShrink: 0,
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
      ) : addresses.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i
            className="bi bi-geo-alt"
            style={{ fontSize: 40, display: "block", marginBottom: 12 }}
          />
          No saved addresses yet. Add one to get started.
        </div>
      ) : (
        <div className="row g-3">
          {addresses.map((addr: any) => (
            <div key={addr.addressId} className="col-12 col-md-6">
              <div
                className="card h-100"
                style={{
                  borderRadius: 12,
                  border: addr.isDefault
                    ? "2px solid #6B0F2A"
                    : "1px solid #e5e7eb",
                  position: "relative",
                }}
              >
                {addr.isDefault && (
                  <span
                    style={{
                      position: "absolute",
                      top: -1,
                      right: 12,
                      background: "#6B0F2A",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: "0 0 8px 8px",
                    }}
                  >
                    DEFAULT
                  </span>
                )}
                <div className="card-body pb-3">
                  <div className="fw-bold mb-1" style={{ color: "#1f2937" }}>
                    <TypeIcon typeId={addr.typeId} />
                    {addr.name}
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}
                  >
                    {addr.addressLine && <div>{addr.addressLine}</div>}
                    {addr.locality && <div>{addr.locality}</div>}
                    {getAddressStateLabel(addr, states) && (
                      <div>{getAddressStateLabel(addr, states)}</div>
                    )}
                    <div>
                      {[addr.city, addr.pinCode].filter(Boolean).join(" - ")}
                    </div>
                    {addr.phone && (
                      <div style={{ marginTop: 4, color: "#6b7280" }}>
                        📞 {addr.phone}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: 12, borderRadius: 6 }}
                      onClick={() => handleEdit(addr)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      style={{ fontSize: 12, borderRadius: 6 }}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this address?"))
                          deleteMutation.mutate(addr.addressId);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
