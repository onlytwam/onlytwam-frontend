import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

// ── coupon type options ──────────────────────────────────────────────────────
const COUPON_TYPES = [
  { value: "generic", label: "Generic (all users)" },
  { value: "user_specific", label: "User Specific" },
  { value: "product_specific", label: "Product Specific" },
] as const;

type CouponType = (typeof COUPON_TYPES)[number]["value"];

const emptyDigital = {
  couponCode: "",
  couponName: "",
  description: "",
  discount: "",
  startDate: "",
  endDate: "",
  isActive: true,
  couponType: "generic" as CouponType,
  toUserProfileId: "",
  productId: "",
};

// ── helpers ──────────────────────────────────────────────────────────────────
const typeLabel = (t?: string) => {
  if (t === "user_specific") return "User";
  if (t === "product_specific") return "Product";
  return "Generic";
};

const typeBadgeStyle = (t?: string): React.CSSProperties => {
  if (t === "user_specific") return { background: "#e0f0ff", color: "#0066cc" };
  if (t === "product_specific")
    return { background: "#fff3cd", color: "#856404" };
  return { background: "#e8f5e9", color: "#2e7d32" };
};

// ── main component ───────────────────────────────────────────────────────────
export default function AdminCoupons() {
  const qc = useQueryClient();

  // active tab
  const [tab, setTab] = useState<"digital" | "physical">("digital");

  // digital state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  // physical state
  const [physPage, setPhysPage] = useState(1);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── digital coupons query ──
  const { data: digitalData, isLoading: digitalLoading } = useQuery({
    queryKey: ["admin-coupons", page, search],
    enabled: tab === "digital",
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim())
        filters.push({
          property: "QuickSearch",
          comparison: "contains",
          value: search.trim(),
        });
      return api
        .get("/Coupons/", {
          params: {
            ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
            "Page.Index": page,
            "Page.Size": PAGE_SIZE,
            "Order.Property": "CreatedDate",
            "Order.Ascending": false,
          },
        })
        .then((r) => r.data);
    },
  });

  // ── physical coupons query ──
  const { data: physicalData, isLoading: physicalLoading } = useQuery({
    queryKey: ["admin-physical-coupons", physPage],
    enabled: tab === "physical",
    queryFn: () =>
      api
        .get("/Coupons/Physical", {
          params: { "Page.Index": physPage, "Page.Size": PAGE_SIZE },
        })
        .then((r) => r.data),
  });

  // ── save digital coupon ──
  const saveMutation = useMutation({
    mutationFn: (form: any) => {
      const payload = {
        couponCode: form.couponCode,
        couponName: form.couponName,
        description: form.description,
        discount: form.discount,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isActive: form.isActive,
        couponType: form.couponType,
        // generic → isCommon true; otherwise false
        isCommon: form.couponType === "generic",
        toUserProfileId:
          form.couponType === "user_specific" ? form.toUserProfileId : null,
        productId:
          form.couponType === "product_specific"
            ? Number(form.productId) || null
            : null,
        state: "Approved",
      };
      return form.couponId
        ? api.put(`/Coupons/${form.couponId}`, payload)
        : api.post(`/Coupons/`, payload);
    },
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setModal(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Coupons/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  // ── upload physical coupons ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploadStatus("Uploading…");
    try {
      const { data } = await api.post("/Coupons/Physical/Upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus(data.message);
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["admin-physical-coupons"] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Upload failed";
      setUploadStatus(msg);
      toast.error(msg);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── render ───────────────────────────────────────────────────────────────
  const coupons = digitalData?.list ?? [];
  const total = digitalData?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const physCoupons = physicalData?.list ?? [];
  const physTotal = physicalData?.count ?? 0;
  const physPages = Math.ceil(physTotal / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Coupons</h2>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["digital", "physical"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid var(--brand)",
              background: tab === t ? "var(--brand)" : "#fff",
              color: tab === t ? "#fff" : "var(--brand)",
              cursor: "pointer",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {t === "digital" ? "Digital Coupons" : "Physical Coupons"}
          </button>
        ))}
      </div>

      {/* ══════════════ DIGITAL TAB ══════════════ */}
      {tab === "digital" && (
        <>
          <div className="s-adminblog-fe4afb">
            <p className="s-adminblog-1c2c10">{total} total</p>
            <div className="s-adminbrands-bccf37">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search coupons…"
                className="inp-field s-admincoupons-2b5f69"
              />
              <button
                onClick={() => setModal({ ...emptyDigital })}
                className="s-admincoupons-2798d5"
              >
                + New Coupon
              </button>
            </div>
          </div>

          <div className="s-admincoupons-b0d5b2">
            <table className="s-admincoupons-bbc29c">
              <thead>
                <tr className="s-adminbrands-1ba202">
                  {[
                    "Code",
                    "Name",
                    "Type",
                    "Discount",
                    "Start Date",
                    "End Date",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="s-adminbrands-84e069">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {digitalLoading ? (
                  <tr>
                    <td colSpan={8} className="s-adminbrands-3e0634">
                      Loading…
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="s-adminbrands-3e0634">
                      No coupons found.
                    </td>
                  </tr>
                ) : (
                  coupons.map((c: any) => (
                    <tr key={c.couponId} className="s-adminbrands-59d787">
                      <td className="s-admincoupons-9db09c">{c.couponCode}</td>
                      <td className="s-admincategor-ec7211">
                        {c.couponName || "—"}
                      </td>
                      <td>
                        <span
                          style={{
                            ...typeBadgeStyle(c.couponType),
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {typeLabel(c.couponType)}
                        </span>
                      </td>
                      <td className="s-admincategor-46dbfc">
                        {c.discount ? `${c.discount}%` : "—"}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {c.startDate
                          ? new Date(c.startDate).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {c.endDate
                          ? new Date(c.endDate).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                      <td>
                        {c.isActive ? (
                          <span style={{ color: "green" }}>Active</span>
                        ) : (
                          <span>Inactive</span>
                        )}
                      </td>
                      <td className="s-admincategor-19b711">
                        <div className="s-adminbrands-ac734d">
                          <button
                            onClick={() =>
                              setModal({
                                ...c,
                                couponType: c.couponType || "generic",
                              })
                            }
                            className="s-adminbrands-6ea383"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirm(c)}
                            className="s-adminbrands-6ea383"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="s-adminblog-213a15">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className="s-admincoupons-174989"
                  style={{
                    borderColor:
                      page === i + 1 ? "var(--brand)" : "var(--ivory)",
                    background: page === i + 1 ? "var(--brand)" : "#fff",
                    color: page === i + 1 ? "#fff" : "#000",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════ PHYSICAL TAB ══════════════ */}
      {tab === "physical" && (
        <>
          <div className="s-adminblog-fe4afb" style={{ marginBottom: 16 }}>
            <div>
              <p className="s-adminblog-1c2c10">
                {physTotal} physical codes loaded
              </p>
              <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                Physical coupons are issued by the store. Upload an Excel file
                with a <strong>CouponCode</strong> column (optional:{" "}
                <strong>Discount</strong>, <strong>Description</strong>). Each
                code is single-use globally.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* Download template — goes through the axios instance so auth headers are sent */}
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get("/Coupons/Physical/Template", {
                        responseType: "blob",
                      });
                      const url = URL.createObjectURL(response.data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "physical_coupons_template.xlsx";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error("Failed to download template");
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "#fff",
                    color: "var(--brand)",
                    border: "1.5px solid var(--brand)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📥 Download Template
                </button>

                {/* Upload Excel */}
                <label
                  style={{
                    padding: "8px 16px",
                    background: "var(--brand)",
                    color: "#fff",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📤 Upload Excel
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                  />
                </label>
              </div>
              {uploadStatus && (
                <span style={{ fontSize: 13, color: "#555" }}>
                  {uploadStatus}
                </span>
              )}
            </div>
          </div>

          <div className="s-admincoupons-b0d5b2">
            <table className="s-admincoupons-bbc29c">
              <thead>
                <tr className="s-adminbrands-1ba202">
                  {[
                    "Code",
                    "Discount",
                    "Description",
                    "Status",
                    "Used By",
                    "Used At",
                  ].map((h) => (
                    <th key={h} className="s-adminbrands-84e069">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {physicalLoading ? (
                  <tr>
                    <td colSpan={6} className="s-adminbrands-3e0634">
                      Loading…
                    </td>
                  </tr>
                ) : physCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="s-adminbrands-3e0634">
                      No physical coupons loaded yet.
                    </td>
                  </tr>
                ) : (
                  physCoupons.map((c: any) => (
                    <tr
                      key={c.physicalCouponId}
                      className="s-adminbrands-59d787"
                    >
                      <td
                        className="s-admincoupons-9db09c"
                        style={{ fontFamily: "monospace" }}
                      >
                        {c.couponCode}
                      </td>
                      <td className="s-admincategor-46dbfc">
                        {c.discount != null ? `${c.discount}%` : "—"}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {c.description || "—"}
                      </td>
                      <td>
                        {c.isUsed ? (
                          <span style={{ color: "red", fontWeight: 600 }}>
                            Used
                          </span>
                        ) : (
                          <span style={{ color: "green", fontWeight: 600 }}>
                            Available
                          </span>
                        )}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {c.usedByUserProfileId || "—"}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {c.usedAt
                          ? new Date(c.usedAt).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {physPages > 1 && (
            <div className="s-adminblog-213a15">
              {Array.from({ length: Math.min(physPages, 10) }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPhysPage(i + 1)}
                  className="s-admincoupons-174989"
                  style={{
                    borderColor:
                      physPage === i + 1 ? "var(--brand)" : "var(--ivory)",
                    background: physPage === i + 1 ? "var(--brand)" : "#fff",
                    color: physPage === i + 1 ? "#fff" : "#000",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ Digital coupon modal ══ */}
      {modal && (
        <div className="s-admincoupons-d93fb3">
          <div className="s-admincoupons-5920ba">
            <h3 className="s-adminblog-e6371f">
              {modal.couponId ? "Edit Coupon" : "New Coupon"}
            </h3>

            <div className="s-admincoupons-ad5066">
              {/* Coupon Type */}
              <div>
                <label style={{ fontWeight: 600 }}>Coupon Type *</label>
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {COUPON_TYPES.map((ct) => (
                    <label
                      key={ct.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="couponType"
                        value={ct.value}
                        checked={modal.couponType === ct.value}
                        onChange={() =>
                          setModal({ ...modal, couponType: ct.value })
                        }
                      />
                      {ct.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Code */}
              <div>
                <label>Coupon Code *</label>
                <input
                  value={modal.couponCode || ""}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      couponCode: e.target.value.toUpperCase(),
                    })
                  }
                  className="inp-field"
                  placeholder="e.g. SAVE20"
                />
              </div>

              {/* Name */}
              <div>
                <label>Coupon Name *</label>
                <input
                  value={modal.couponName || ""}
                  onChange={(e) =>
                    setModal({ ...modal, couponName: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Description */}
              <div>
                <label>Description</label>
                <input
                  value={modal.description || ""}
                  onChange={(e) =>
                    setModal({ ...modal, description: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Discount */}
              <div>
                <label>Discount (%) *</label>
                <input
                  type="number"
                  value={modal.discount || ""}
                  onChange={(e) =>
                    setModal({ ...modal, discount: Number(e.target.value) })
                  }
                  className="inp-field"
                  min={1}
                  max={100}
                />
              </div>

              {/* Start / End Date */}
              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={(modal.startDate || "").split("T")[0]}
                  onChange={(e) =>
                    setModal({ ...modal, startDate: e.target.value })
                  }
                  className="inp-field"
                />
              </div>
              <div>
                <label>End Date</label>
                <input
                  type="date"
                  value={(modal.endDate || "").split("T")[0]}
                  onChange={(e) =>
                    setModal({ ...modal, endDate: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Conditional: User Profile ID (user_specific) */}
              {modal.couponType === "user_specific" && (
                <div>
                  <label>Assign to User Profile ID *</label>
                  <input
                    value={modal.toUserProfileId || ""}
                    onChange={(e) =>
                      setModal({ ...modal, toUserProfileId: e.target.value })
                    }
                    className="inp-field"
                    placeholder="User's profile ID"
                  />
                </div>
              )}

              {/* Conditional: Product ID (product_specific) */}
              {modal.couponType === "product_specific" && (
                <div>
                  <label>Product ID *</label>
                  <input
                    type="number"
                    value={modal.productId || ""}
                    onChange={(e) =>
                      setModal({ ...modal, productId: e.target.value })
                    }
                    className="inp-field"
                    placeholder="Product ID this coupon applies to"
                  />
                </div>
              )}

              {/* Active */}
              <div>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={modal.isActive ?? true}
                    onChange={(e) =>
                      setModal({ ...modal, isActive: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="s-admincoupons-45d476">
              <button
                onClick={() => setModal(null)}
                className="s-admincoupons-db4fcf"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(modal)}
                disabled={
                  !modal.couponCode ||
                  !modal.discount ||
                  (modal.couponType === "user_specific" &&
                    !modal.toUserProfileId) ||
                  (modal.couponType === "product_specific" && !modal.productId)
                }
                className="s-admincoupons-2798d5"
                style={{
                  opacity:
                    !modal.couponCode ||
                    !modal.discount ||
                    (modal.couponType === "user_specific" &&
                      !modal.toUserProfileId) ||
                    (modal.couponType === "product_specific" &&
                      !modal.productId)
                      ? 0.5
                      : 1,
                }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete confirm ══ */}
      {confirm && (
        <div className="s-admincoupons-f1fb3c">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Delete coupon "{confirm.couponCode}"?
            </h3>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                className="s-admincoupons-99e32e"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirm.couponId)}
                className="s-admincoupons-2253c0"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
