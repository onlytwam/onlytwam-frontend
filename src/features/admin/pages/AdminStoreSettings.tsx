import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────
   TWAM Brand Tokens
   Burgundy      #6B0F2A
   Heirloom Rose #9E6070
   Blush Pink    #A84C6B
   Warm Ivory    #F5F0E6
───────────────────────────────────────────── */

const PAGE_SIZE = 20;

const emptySettings = {
  storeId: null,
  storeName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  country: null,
  mapLink: "",
  isActive: true,
  isPickUpAvailable: false,
  userProfileId: "",
};

interface PinData {
  city: string;
  state: string;
  country: string;
}

// ✅ Pincode API
async function lookupPincode(pin: string): Promise<PinData | null> {
  if (!/^\d{6}$/.test(pin)) return null;
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

// ─── Validate ────────────────────────────────
function validate(form: any) {
  const errors: Record<string, string> = {};
  if (!form.storeName?.trim()) errors.storeName = "Store name is required";
  if (!form.email?.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "Enter a valid email address";
  if (!form.phone?.trim()) errors.phone = "Phone number is required";
  if (!form.address?.trim()) errors.address = "Address is required";
  if (!form.pinCode?.trim()) errors.pinCode = "Pincode is required";
  else if (!/^\d{6}$/.test(form.pinCode))
    errors.pinCode = "Enter a valid 6-digit pincode";
  if (!form.city?.trim()) errors.city = "City is required";
  if (!form.state?.trim()) errors.state = "State is required";
  if (!form.country) errors.country = "Country is required";
  return errors;
}

// ─── Tiny UI helpers ─────────────────────────

function Spinner({ size = 16, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg
      style={{ width: size, height: size, color: light ? "#F5F0E6" : "#6B0F2A" }}
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span style={{ background: "#f0e8ec", color: "#6B0F2A", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6B0F2A", flexShrink: 0 }} />
      Active
    </span>
  ) : (
    <span style={{ background: "#f3f0ee", color: "#9e8f8f", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c4b4b4", flexShrink: 0 }} />
      Inactive
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#9E6070", whiteSpace: "nowrap" as const }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, #e8ddd5, transparent)" }} />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#9E6070" }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#A84C6B", marginTop: 2 }}>
          <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const getInputStyle = (hasError?: string, readonly?: boolean): React.CSSProperties => ({
  width: "100%",
  boxSizing: "border-box" as const,
  borderRadius: 8,
  border: `1.5px solid ${hasError ? "#A84C6B" : "#ddd0c8"}`,
  background: readonly ? "#faf6f2" : "#fff",
  padding: "0.6rem 0.875rem",
  fontSize: "0.875rem",
  color: readonly ? "#8a6070" : "#3b1c25",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxShadow: "0 1px 2px rgba(107,15,42,0.04)",
  fontFamily: "inherit",
});

function TextInput({ value, onChange, onBlur, placeholder, type = "text", readOnly = false, error, maxLength, suffix }: {
  value: string; onChange?: (v: string) => void; onBlur?: () => void;
  placeholder?: string; type?: string; readOnly?: boolean; error?: string;
  maxLength?: number; suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const style: React.CSSProperties = {
    ...getInputStyle(error, readOnly),
    ...(focused && !readOnly ? { borderColor: "#6B0F2A", boxShadow: "0 0 0 3px rgba(107,15,42,0.10)" } : {}),
    paddingRight: suffix ? "2.25rem" : "0.875rem",
  };
  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        style={style}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
      />
      {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>{suffix}</span>}
    </div>
  );
}

function SelectInput({ value, onChange, onBlur, error, children }: {
  value: string | number; onChange: (v: number) => void; onBlur?: () => void;
  error?: string; children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const style: React.CSSProperties = {
    ...getInputStyle(error),
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    paddingRight: "2.25rem",
    cursor: "pointer",
    ...(focused ? { borderColor: "#6B0F2A", boxShadow: "0 0 0 3px rgba(107,15,42,0.10)" } : {}),
  };
  return (
    <div style={{ position: "relative" }}>
      <select
        style={style}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
      >
        {children}
      </select>
      <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9E6070", pointerEvents: "none" }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" as const }}>
      <div
        onClick={() => onChange(!checked)}
        style={{ width: 40, height: 22, borderRadius: 999, background: checked ? "#6B0F2A" : "#ddd0c8", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
      >
        <span style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#3b1c25" }}>{label}</span>
    </label>
  );
}

// ─── Main Component ───────────────────────────
export default function StoreSettings() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modal, setModal] = useState<any>(emptySettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pinLoading, setPinLoading] = useState(false);

  const { data: countriesData } = useQuery({
    queryKey: ["countries"],
    queryFn: () => api.get("/MDM/country").then((r) => r.data),
  });
  const countries: any[] = countriesData ?? [];
  const india = countries.find((c: any) => c.countryCode === "IN");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stores", page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim()) filters.push({ property: "QuickSearch", comparison: "contains", value: search.trim() });
      return api.get("/Stores", {
        params: {
          ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
          "Page.Index": page,
          "Page.Size": PAGE_SIZE,
          "Order.Property": "CreatedDate",
          "Order.Ascending": false,
        },
      }).then((r) => r.data);
    },
  });

  const openCreate = () => {
    setModal({ ...emptySettings, country: india?.countryId || null });
    setErrors({}); setTouched({}); setModalOpen(true);
  };
  const openEdit = (store: any) => {
    setModal({ ...emptySettings, ...store });
    setErrors({}); setTouched({}); setModalOpen(true);
  };

  const handlePincodeChange = async (pin: string) => {
    const value = pin.replace(/\D/g, "");
    setModal((prev: any) => ({ ...prev, pinCode: value }));
    setTouched((prev) => ({ ...prev, pinCode: true }));
    if (value.length !== 6) return;
    setPinLoading(true);
    const result = await lookupPincode(value);
    setPinLoading(false);
    if (!result) { toast.error("Invalid pincode — please check and try again"); return; }
    const countryMatch = countries.find((c: any) => c.countryName?.toLowerCase() === result.country.toLowerCase() || c.countryCode === "IN");
    setModal((prev: any) => ({ ...prev, city: result.city, state: result.state, country: countryMatch?.countryId || prev.country }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate({ ...modal }));
  };
  const fieldError = (field: string) => (touched[field] ? errors[field] : undefined);

  const saveMutation = useMutation({
    mutationFn: (form: any) => {
      const payload = {
        storeId: form.storeId, storeName: form.storeName,
        country: Number(form.country), city: form.city, pinCode: form.pinCode,
        address: form.address, phone: form.phone, email: form.email,
        isPickUpAvailable: form.isPickUpAvailable, mapLink: form.mapLink,
        state: form.state, isActive: form.isActive, userProfileId: form.userProfileId,
      };
      return form.storeId ? api.put(`/Stores/${form.storeId}`, payload) : api.post(`/Stores`, payload);
    },
    onSuccess: () => { toast.success("Store saved successfully!"); qc.invalidateQueries({ queryKey: ["admin-stores"] }); setModalOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed to save. Please try again."),
  });

  const handleSave = () => {
    const allTouched = Object.keys(emptySettings).reduce((a, k) => ({ ...a, [k]: true }), {});
    setTouched(allTouched);
    const errs = validate(modal);
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Please fix the highlighted errors before saving"); return; }
    saveMutation.mutate(modal);
  };

  const stores = data?.list ?? [];
  const isSubmitting = saveMutation.isPending;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        .twam-root * { box-sizing: border-box; }
        .twam-root { font-family: 'DM Sans', sans-serif; background: #F5F0E6; min-height: 100vh; }
        .twam-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .store-card { background: #fff; border: 1.5px solid #e8ddd5; border-radius: 14px; padding: 1.25rem; transition: box-shadow 0.2s, border-color 0.2s, transform 0.15s; }
        .store-card:hover { box-shadow: 0 8px 28px rgba(107,15,42,0.11); border-color: #9E6070; transform: translateY(-2px); }
        .btn-primary { display: inline-flex; align-items: center; gap: 7px; background: #6B0F2A; color: #F5F0E6; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 0.875rem; letter-spacing: 0.02em; border: none; border-radius: 9px; padding: 0.65rem 1.375rem; cursor: pointer; box-shadow: 0 2px 10px rgba(107,15,42,0.28); transition: background 0.15s, box-shadow 0.15s, transform 0.1s; }
        .btn-primary:hover { background: #8a1235; box-shadow: 0 4px 16px rgba(107,15,42,0.36); transform: translateY(-1px); }
        .btn-primary:active { background: #5a0b22; transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: #6B0F2A; font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 0.8125rem; border: 1.5px solid #ddd0c8; border-radius: 8px; padding: 0.575rem 1.125rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .btn-ghost:hover { border-color: #9E6070; background: #fdf4f7; }
        .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-edit { width: 100%; background: #fdf4f7; color: #6B0F2A; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.07em; text-transform: uppercase; border: 1.5px solid #edd8e2; border-radius: 8px; padding: 0.45rem 1rem; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .btn-edit:hover { background: #f5e0ea; border-color: #9E6070; }
        .twam-search { font-family: 'DM Sans', sans-serif; border: 1.5px solid #ddd0c8; border-radius: 10px; background: #fff; padding: 0.625rem 0.875rem 0.625rem 2.5rem; font-size: 0.875rem; color: #3b1c25; outline: none; width: 100%; max-width: 300px; box-shadow: 0 1px 4px rgba(107,15,42,0.06); transition: border-color 0.15s, box-shadow 0.15s; }
        .twam-search::placeholder { color: #b89aa6; }
        .twam-search:focus { border-color: #6B0F2A; box-shadow: 0 0 0 3px rgba(107,15,42,0.10); }
        .modal-backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(59,28,37,0.48); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal-box { background: #fff; border-radius: 20px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; box-shadow: 0 28px 80px rgba(107,15,42,0.24), 0 0 0 1.5px #e8ddd5; animation: modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .pickup-tag { display: inline-flex; align-items: center; gap: 5px; background: #fdf0f5; color: #A84C6B; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid #f0d5e2; border-radius: 999px; padding: 2px 9px; }
        @media (max-width: 768px) { .store-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 520px) { .store-grid { grid-template-columns: 1fr !important; } .form-grid { grid-template-columns: 1fr !important; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .opacity-25 { opacity: 0.25; } .opacity-75 { opacity: 0.75; }
      `}</style>

      <div className="twam-root">

        {/* ── Page Header ── */}
        <div style={{ background: "#fff", borderBottom: "1.5px solid #ece5df", padding: "1.25rem 2rem", boxShadow: "0 2px 10px rgba(107,15,42,0.06)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 className="twam-serif" style={{ fontSize: "2rem", fontWeight: 700, color: "#6B0F2A", lineHeight: 1, margin: 0 }}>
                Store Management
              </h1>
              <p style={{ fontSize: "0.8rem", color: "#9E6070", marginTop: 5, fontWeight: 400 }}>
                {data?.totalCount ? `${data.totalCount} locations configured` : "Manage your store locations and settings"}
              </p>
            </div>
            <button className="btn-primary" onClick={openCreate}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Store
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 2rem" }}>

          {/* Search */}
          <div style={{ marginBottom: "1.5rem", position: "relative", display: "inline-block" }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9E6070", pointerEvents: "none" }} width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              className="twam-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search stores…"
            />
          </div>

          {/* Store Grid / States */}
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 0", gap: 14, color: "#9E6070" }}>
              <Spinner size={30} />
              <span style={{ fontSize: "0.875rem" }}>Loading stores…</span>
            </div>
          ) : stores.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 0", gap: 12, textAlign: "center" }}>
              <svg width="48" height="48" fill="none" stroke="#c4aab2" strokeWidth={1.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              </svg>
              <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#9E6070" }}>No stores found</p>
              <p style={{ fontSize: "0.8rem", color: "#b89aa6" }}>Try a different search or add a new store</p>
            </div>
          ) : (
            <div className="store-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {stores.map((s: any) => (
                <div key={s.storeId} className="store-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="twam-serif" style={{ fontWeight: 700, fontSize: "1.05rem", color: "#3b1c25", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.storeName}
                      </p>
                      {s.city && (
                        <p style={{ fontSize: "0.77rem", color: "#9E6070", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {s.city}{s.state ? `, ${s.state}` : ""}
                        </p>
                      )}
                    </div>
                    <StatusBadge active={s.isActive} />
                  </div>
                  {s.isPickUpAvailable && (
                    <div style={{ marginBottom: 12 }}>
                      <span className="pickup-tag">
                        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                        </svg>
                        Pickup
                      </span>
                    </div>
                  )}
                  <button className="btn-edit" onClick={() => openEdit(s)}>Edit Store</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Modal ── */}
        {modalOpen && (
          <div
            className="modal-backdrop"
            onClick={(e) => e.target === e.currentTarget && !isSubmitting && setModalOpen(false)}
          >
            <div className="modal-box">

              {/* Modal Header */}
              <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1.5px solid #f0e8e4", padding: "1.25rem 1.625rem", borderRadius: "20px 20px 0 0" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h2 className="twam-serif" style={{ fontSize: "1.625rem", fontWeight: 700, color: "#6B0F2A", margin: 0, lineHeight: 1.1 }}>
                      {modal.storeId ? "Edit Store" : "Add New Store"}
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "#9E6070", marginTop: 4 }}>
                      {modal.storeId ? "Update your store details below" : "Fill in the details to create a new store location"}
                    </p>
                  </div>
                  <button
                    onClick={() => !isSubmitting && setModalOpen(false)}
                    disabled={isSubmitting}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#b89aa6", padding: 7, borderRadius: 8, lineHeight: 0, transition: "background 0.15s, color 0.15s" }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "#fdf4f7"; (e.currentTarget as HTMLElement).style.color = "#6B0F2A"; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#b89aa6"; }}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "1.5rem 1.625rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* Basic Info */}
                <section>
                  <SectionHeading>Basic Information</SectionHeading>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Store Name *" error={fieldError("storeName")}>
                        <TextInput value={modal.storeName || ""} onChange={(v) => setModal({ ...modal, storeName: v })} onBlur={() => handleBlur("storeName")} placeholder="e.g. Downtown Flagship" error={fieldError("storeName")} />
                      </Field>
                    </div>
                    <Field label="Email Address *" error={fieldError("email")}>
                      <TextInput type="email" value={modal.email || ""} onChange={(v) => setModal({ ...modal, email: v })} onBlur={() => handleBlur("email")} placeholder="store@example.com" error={fieldError("email")} />
                    </Field>
                    <Field label="Phone Number *" error={fieldError("phone")}>
                      <TextInput type="tel" value={modal.phone || ""} onChange={(v) => setModal({ ...modal, phone: v })} onBlur={() => handleBlur("phone")} placeholder="+91 98765 43210" error={fieldError("phone")} />
                    </Field>
                  </div>
                </section>

                <div style={{ height: 1, background: "#f0e8e4" }} />

                {/* Address */}
                <section>
                  <SectionHeading>Location &amp; Address</SectionHeading>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Street Address *" error={fieldError("address")}>
                        <TextInput value={modal.address || ""} onChange={(v) => setModal({ ...modal, address: v })} onBlur={() => handleBlur("address")} placeholder="Building, street, area" error={fieldError("address")} />
                      </Field>
                    </div>
                    <Field label="Pincode *" error={fieldError("pinCode")}>
                      <TextInput
                        value={modal.pinCode || ""}
                        onChange={(v) => handlePincodeChange(v)}
                        onBlur={() => handleBlur("pinCode")}
                        placeholder="6-digit pincode"
                        maxLength={6}
                        error={fieldError("pinCode")}
                        suffix={pinLoading ? <Spinner size={13} /> : undefined}
                      />
                    </Field>
                    <Field label="City *" error={fieldError("city")}>
                      <TextInput
                        value={modal.city || ""}
                        placeholder="Auto-filled from pincode"
                        readOnly
                        error={fieldError("city")}
                        suffix={modal.city ? (
                          <svg width="15" height="15" fill="none" stroke="#6B0F2A" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : undefined}
                      />
                    </Field>
                    <Field label="State *" error={fieldError("state")}>
                      <TextInput value={modal.state || ""} placeholder="Auto-filled from pincode" readOnly error={fieldError("state")} />
                    </Field>
                    <Field label="Country *" error={fieldError("country")}>
                      <SelectInput
                        value={modal.country ?? ""}
                        onChange={(v) => { setModal({ ...modal, country: v }); setTouched((p) => ({ ...p, country: true })); }}
                        onBlur={() => handleBlur("country")}
                        error={fieldError("country")}
                      >
                        <option value="">Select country</option>
                        {countries.map((c: any) => <option key={c.countryId} value={c.countryId}>{c.countryName}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                </section>

                <div style={{ height: 1, background: "#f0e8e4" }} />

                {/* Additional */}
                <section>
                  <SectionHeading>Additional Details</SectionHeading>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <Field label="Google Maps Link">
                      <TextInput value={modal.mapLink || ""} onChange={(v) => setModal({ ...modal, mapLink: v })} placeholder="https://maps.google.com/…" />
                    </Field>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", background: "#fdf8f4", border: "1.5px solid #ede5df", borderRadius: 12, padding: "1rem 1.125rem" }}>
                      <Toggle label="Store is Active" checked={modal.isActive ?? true} onChange={(v) => setModal({ ...modal, isActive: v })} />
                      <div style={{ width: 1, background: "#e8ddd5", alignSelf: "stretch" }} />
                      <Toggle label="Pickup Available" checked={modal.isPickUpAvailable ?? false} onChange={(v) => setModal({ ...modal, isPickUpAvailable: v })} />
                    </div>
                  </div>
                </section>

              </div>

              {/* Modal Footer */}
              <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fdf8f4", borderTop: "1.5px solid #f0e8e4", padding: "1rem 1.625rem", borderRadius: "0 0 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ fontSize: "0.72rem", color: "#b89aa6", fontStyle: "italic" }}>* Required fields</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="btn-ghost" onClick={() => !isSubmitting && setModalOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <><Spinner size={14} light /> Saving…</>
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {modal.storeId ? "Save Changes" : "Create Store"}
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}