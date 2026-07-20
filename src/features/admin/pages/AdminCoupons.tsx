import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

// ── types ─────────────────────────────────────────────────────────────────────
const COUPON_TYPES = [
  { value: "generic", label: "Generic (all users)" },
  { value: "user_specific", label: "User Specific" },
  { value: "product_specific", label: "Product Specific" },
] as const;
type CouponType = (typeof COUPON_TYPES)[number]["value"];
type Tab = "digital" | "physical" | "bulk_user" | "brand_coupon";

interface Segment {
  key: string;
  label: string;
  description: string;
  icon: string;
  supportsBoth: boolean;
}
interface PreviewUser {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  metricLabel: string | null;
}

// ── blank form defaults ───────────────────────────────────────────────────────
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

const emptyCouponFields = {
  couponCode: "",
  couponName: "",
  description: "",
  discount: "",
  startDate: "",
  endDate: "",
};

// ── helpers ───────────────────────────────────────────────────────────────────
const typeLabel = (t?: string) =>
  t === "user_specific"
    ? "User"
    : t === "product_specific"
    ? "Product"
    : "Generic";

const typeBadgeStyle = (t?: string): React.CSSProperties =>
  t === "user_specific"
    ? { background: "#e0f0ff", color: "#0066cc" }
    : t === "product_specific"
    ? { background: "#fff3cd", color: "#856404" }
    : { background: "#e8f5e9", color: "#2e7d32" };

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN") : "—";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminCoupons() {
  const qc = useQueryClient();

  // ── tab state ──
  const [tab, setTab] = useState<Tab>("digital");

  // ── digital state ──
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  // ── physical state ──
  const [physPage, setPhysPage] = useState(1);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── bulk-user state ──
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [direction, setDirection] = useState<"top" | "bottom">("top");
  const [count, setCount] = useState<number>(50);
  const [previewUsers, setPreviewUsers] = useState<PreviewUser[] | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [couponFields, setCouponFields] = useState({ ...emptyCouponFields });
  const [batchPage, setBatchPage] = useState(1);
  const [bulkUploadStatus, setBulkUploadStatus] = useState<string | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<any>(null);

  // ── brand coupon state ──
  const [brandModal, setBrandModal]         = useState<"single" | "bulk" | null>(null);
  const [brandPage, setBrandPage]           = useState(1);
  const [brandFilterId, setBrandFilterId]   = useState<number | "">("");
  const brandFileRef                        = useRef<HTMLInputElement>(null);
  const [brandUploadStatus, setBrandUploadStatus] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({
    couponCode: "", couponName: "", brandId: "" as number | "",
    discount: "" as number | "", startDate: "", endDate: "",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════════════════════════════════════════

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

  const { data: segmentsData, isLoading: segmentsLoading } = useQuery({
    queryKey: ["coupon-segments"],
    enabled: tab === "bulk_user",
    queryFn: () => api.get("/Coupons/UserSegments").then((r) => r.data),
  });

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ["coupon-batches", batchPage],
    enabled: tab === "bulk_user",
    queryFn: () =>
      api
        .get("/Coupons/UserSpecific/Batches", {
          params: { "Page.Index": batchPage, "Page.Size": PAGE_SIZE },
        })
        .then((r) => r.data),
  });

  const segments: Segment[] = segmentsData?.segments ?? [];
  const activeSeg = segments.find((s) => s.key === selectedSegment);

  const { data: brandsData } = useQuery({
    queryKey: ["brands-list"],
    queryFn: () =>
      api.get("/MDM/Brand", {
        params: {
          "Page.Size":       500,
          "Order.Property":  "brandName",
          "Order.Ascending": true,
        },
      }).then((r) => r.data),
  });
  const allBrands: { brandId: number; brandName: string }[] = brandsData?.list ?? [];

  const { data: brandCouponsData, isLoading: brandCouponsLoading, refetch: refetchBrandCoupons } = useQuery({
    queryKey: ["brand-coupons", brandPage, brandFilterId],
    enabled: tab === "brand_coupon",
    queryFn: () =>
      api.get("/Coupons/Brand", {
        params: {
          ...(brandFilterId ? { brand_id: brandFilterId } : {}),
          "Page.Index": brandPage,
          "Page.Size": PAGE_SIZE,
        },
      }).then((r) => r.data),
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ══════════════════════════════════════════════════════════════════════════

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

  const assignFromSegmentMutation = useMutation({
    mutationFn: () =>
      api
        .post("/Coupons/UserSpecific/AssignFromSegment", {
          segmentKey: selectedSegment,
          direction,
          count,
          couponCode: couponFields.couponCode,
          couponName: couponFields.couponName,
          description: couponFields.description || null,
          discount: Number(couponFields.discount),
          startDate: couponFields.startDate || null,
          endDate: couponFields.endDate || null,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["coupon-batches"] });
      setPreviewUsers(null);
      setCouponFields({ ...emptyCouponFields });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Assignment failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (batchId: number) =>
      api
        .put(`/Coupons/UserSpecific/Batches/${batchId}/Deactivate`)
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["coupon-batches"] });
      setDeactivateConfirm(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Deactivation failed"),
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handlePhysicalUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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

  const handleBulkUserUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBulkUploadStatus("Uploading…");
    try {
      const { data } = await api.post("/Coupons/UserSpecific/Upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkUploadStatus(data.message);
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["coupon-batches"] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Upload failed";
      setBulkUploadStatus(msg);
      toast.error(msg);
    }
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  };

  const handlePreview = async () => {
    if (!selectedSegment) {
      toast.error("Select a segment first");
      return;
    }
    setPreviewLoading(true);
    setPreviewUsers(null);
    try {
      const { data } = await api.post("/Coupons/UserSegments/Preview", {
        segmentKey: selectedSegment,
        direction,
        count,
      });
      setPreviewUsers(data.users);
      setPreviewLabel(
        `${data.segmentLabel} — ${direction === "top" ? "Top" : "Bottom"} ${
          data.count
        }`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateExcel = async () => {
    if (!selectedSegment) {
      toast.error("Select a segment first");
      return;
    }
    try {
      const response = await api.post(
        "/Coupons/UserSegments/GenerateExcel",
        { segmentKey: selectedSegment, direction, count },
        { responseType: "blob" },
      );
      downloadBlob(
        response.data,
        `segment_${selectedSegment}_${direction}${count}_users.xlsx`,
      );
    } catch {
      toast.error("Failed to generate Excel");
    }
  };

  const canAssign =
    selectedSegment &&
    previewUsers &&
    previewUsers.length > 0 &&
    couponFields.couponCode.trim() &&
    couponFields.couponName.trim() &&
    Number(couponFields.discount) > 0;

  // ══════════════════════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ══════════════════════════════════════════════════════════════════════════

  const coupons = digitalData?.list ?? [];
  const total = digitalData?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const physCoupons = physicalData?.list ?? [];
  const physTotal = physicalData?.count ?? 0;
  const physPages = Math.ceil(physTotal / PAGE_SIZE);

  const batches = batchesData?.list ?? [];
  const batchTotal = batchesData?.count ?? 0;
  const batchPages = Math.ceil(batchTotal / PAGE_SIZE);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* ── Page header ── */}
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Coupons</h2>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
      >
        {(
          [
            { key: "digital",      label: "Digital Coupons" },
            { key: "physical",     label: "Physical Coupons" },
            { key: "bulk_user",    label: "👥 User-Specific Bulk" },
            { key: "brand_coupon", label: "🏷️ Brand Coupons" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid var(--brand)",
              background: tab === t.key ? "var(--brand)" : "#fff",
              color: tab === t.key ? "#fff" : "var(--brand)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          DIGITAL TAB (unchanged)
      ════════════════════════════════════════════════════════ */}
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
                        {fmtDate(c.startDate)}
                      </td>
                      <td className="s-admincategor-ec7211">
                        {fmtDate(c.endDate)}
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

      {/* ════════════════════════════════════════════════════════
          PHYSICAL TAB (unchanged)
      ════════════════════════════════════════════════════════ */}
      {tab === "physical" && (
        <>
          <div className="s-adminblog-fe4afb" style={{ marginBottom: 16 }}>
            <div>
              <p className="s-adminblog-1c2c10">
                {physTotal} physical codes loaded
              </p>
              <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                Upload an Excel file with a <strong>CouponCode</strong> column
                (optional: <strong>Discount</strong>,{" "}
                <strong>Description</strong>). Each code is single-use globally.
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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={async () => {
                    try {
                      const r = await api.get("/Coupons/Physical/Template", {
                        responseType: "blob",
                      });
                      downloadBlob(r.data, "physical_coupons_template.xlsx");
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
                  }}
                >
                  📥 Download Template
                </button>
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
                    onChange={handlePhysicalUpload}
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
                        {fmtDate(c.usedAt)}
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

      {/* ════════════════════════════════════════════════════════
          BULK USER-SPECIFIC TAB  (NEW)
      ════════════════════════════════════════════════════════ */}
      {tab === "bulk_user" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* ── Section 1: Assign from Segment ──────────────────────────── */}
          <div style={sectionCard}>
            <h3 style={sectionTitle}>
              📊 Assign Coupons from Customer Segment
            </h3>
            <p style={sectionDesc}>
              Pick a customer segment, preview who's in it, then assign a coupon
              to all of them in one click.
            </p>

            {/* Step 1: Segment picker */}
            <div style={stepBlock}>
              <div style={stepLabel}>Step 1 — Choose a Segment</div>
              {segmentsLoading ? (
                <p style={{ color: "#888", fontSize: 13 }}>Loading segments…</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  {segments.map((seg) => (
                    <div
                      key={seg.key}
                      onClick={() => {
                        setSelectedSegment(seg.key);
                        setPreviewUsers(null);
                      }}
                      style={{
                        border: `2px solid ${
                          selectedSegment === seg.key
                            ? "var(--brand)"
                            : "#e0e0e0"
                        }`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        cursor: "pointer",
                        background:
                          selectedSegment === seg.key ? "#fdf0f3" : "#fff",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {seg.icon} {seg.label}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#666", marginTop: 3 }}
                      >
                        {seg.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Direction + Count */}
            {selectedSegment && (
              <div style={stepBlock}>
                <div style={stepLabel}>Step 2 — Select Count & Direction</div>
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {/* Direction */}
                  <div style={{ display: "flex", gap: 12 }}>
                    {(["top", "bottom"] as const)
                      .filter((d) => d === "top" || activeSeg?.supportsBoth)
                      .map((d) => (
                        <label
                          key={d}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          <input
                            type="radio"
                            name="direction"
                            value={d}
                            checked={direction === d}
                            onChange={() => {
                              setDirection(d);
                              setPreviewUsers(null);
                            }}
                          />
                          {d === "top" ? "⬆ Top" : "⬇ Bottom"}
                        </label>
                      ))}
                  </div>

                  {/* Count quick picks + custom */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {[25, 50, 100, 200].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setCount(n);
                          setPreviewUsers(null);
                        }}
                        style={{
                          padding: "5px 14px",
                          borderRadius: 6,
                          border: "1px solid var(--brand)",
                          background: count === n ? "var(--brand)" : "#fff",
                          color: count === n ? "#fff" : "var(--brand)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span style={{ fontSize: 13, color: "#555" }}>
                        Custom:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={count}
                        onChange={(e) => {
                          setCount(Number(e.target.value));
                          setPreviewUsers(null);
                        }}
                        style={{
                          width: 80,
                          padding: "5px 8px",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading}
                    style={{
                      ...btnSecondary,
                      opacity: previewLoading ? 0.6 : 1,
                    }}
                  >
                    {previewLoading ? "Loading…" : "👁 Preview Users"}
                  </button>
                  <button onClick={handleGenerateExcel} style={btnOutline}>
                    📥 Download User IDs as Excel
                  </button>
                </div>
              </div>
            )}

            {/* Preview table */}
            {previewUsers !== null && (
              <div style={stepBlock}>
                <div style={stepLabel}>
                  Preview — {previewLabel}
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 400,
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    ({previewUsers.length} users)
                  </span>
                </div>

                {previewUsers.length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13 }}>
                    No users found for this segment.
                  </p>
                ) : (
                  <div
                    style={{
                      overflowX: "auto",
                      maxHeight: 320,
                      overflowY: "auto",
                      border: "1px solid #eee",
                      borderRadius: 6,
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f5f5f5",
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          {["#", "Name", "Email", "Phone", "Metric"].map(
                            (h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "left",
                                  borderBottom: "1px solid #e0e0e0",
                                  fontWeight: 700,
                                }}
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewUsers.map((u, i) => (
                          <tr
                            key={u.userId}
                            style={{
                              background: i % 2 === 0 ? "#fff" : "#fafafa",
                            }}
                          >
                            <td style={tdStyle}>{i + 1}</td>
                            <td style={tdStyle}>{u.name || "—"}</td>
                            <td style={tdStyle}>{u.email || "—"}</td>
                            <td style={tdStyle}>{u.phone || "—"}</td>
                            <td
                              style={{
                                ...tdStyle,
                                fontWeight: 600,
                                color: "var(--brand)",
                              }}
                            >
                              {u.metricLabel || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Coupon details → assign */}
            {previewUsers !== null && previewUsers.length > 0 && (
              <div style={stepBlock}>
                <div style={stepLabel}>
                  Step 3 — Set Coupon Details & Assign
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div>
                    <label style={fieldLabel}>Coupon Code *</label>
                    <input
                      value={couponFields.couponCode}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          couponCode: e.target.value.toUpperCase(),
                        }))
                      }
                      className="inp-field"
                      placeholder="e.g. LOYAL20"
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Coupon Name *</label>
                    <input
                      value={couponFields.couponName}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          couponName: e.target.value,
                        }))
                      }
                      className="inp-field"
                      placeholder="e.g. Loyalty Reward"
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Discount (%) *</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={couponFields.discount}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          discount: e.target.value,
                        }))
                      }
                      className="inp-field"
                      placeholder="e.g. 20"
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Description</label>
                    <input
                      value={couponFields.description}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      className="inp-field"
                      placeholder="Optional short note"
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Start Date</label>
                    <input
                      type="date"
                      value={couponFields.startDate}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          startDate: e.target.value,
                        }))
                      }
                      className="inp-field"
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>End Date</label>
                    <input
                      type="date"
                      value={couponFields.endDate}
                      onChange={(e) =>
                        setCouponFields((f) => ({
                          ...f,
                          endDate: e.target.value,
                        }))
                      }
                      className="inp-field"
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    background: "#fdf0f3",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#555",
                    border: "1px solid #f0d0d8",
                  }}
                >
                  <strong>Ready to assign:</strong> "
                  {couponFields.couponName || "—"}" (
                  {couponFields.discount || 0}% off) to{" "}
                  <strong>{previewUsers.length} users</strong> from segment "
                  {activeSeg?.label}". Each user gets their own personal coupon
                  — not shared.
                </div>

                <button
                  onClick={() => assignFromSegmentMutation.mutate()}
                  disabled={!canAssign || assignFromSegmentMutation.isPending}
                  style={{
                    ...btnPrimary,
                    marginTop: 12,
                    opacity:
                      !canAssign || assignFromSegmentMutation.isPending
                        ? 0.5
                        : 1,
                  }}
                >
                  {assignFromSegmentMutation.isPending
                    ? "Assigning…"
                    : `✅ Assign to ${previewUsers.length} Users`}
                </button>
              </div>
            )}
          </div>

          {/* ── Section 2: Upload Excel manually ────────────────────────── */}
          <div style={sectionCard}>
            <h3 style={sectionTitle}>
              📤 Upload User-Specific Coupons via Excel
            </h3>
            <p style={sectionDesc}>
              Manually fill a list of User IDs with coupon details and upload.
              Use this when you want full control over exactly who gets what.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={async () => {
                  try {
                    const r = await api.get("/Coupons/UserSpecific/Template", {
                      responseType: "blob",
                    });
                    downloadBlob(r.data, "user_specific_coupons_template.xlsx");
                  } catch {
                    toast.error("Failed to download template");
                  }
                }}
                style={btnOutline}
              >
                📥 Download Template
              </button>

              <label style={btnPrimary as React.CSSProperties}>
                📤 Upload Filled Excel
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={handleBulkUserUpload}
                />
              </label>
            </div>

            {bulkUploadStatus && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "#f0faf5",
                  border: "1px solid #b2dfdb",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#2e7d32",
                }}
              >
                {bulkUploadStatus}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                padding: "12px 16px",
                background: "#f9f9f9",
                borderRadius: 8,
                fontSize: 12,
                color: "#666",
                border: "1px solid #eee",
              }}
            >
              <strong>Excel columns required:</strong> UserId, CouponCode,
              CouponName, Discount &nbsp;|&nbsp;
              <strong>Optional:</strong> Description, StartDate (YYYY-MM-DD),
              EndDate (YYYY-MM-DD)
            </div>
          </div>

          {/* ── Section 3: Batch history ──────────────────────────────── */}
          <div style={sectionCard}>
            <h3 style={sectionTitle}>🗂 Batch Assignment History</h3>
            <p style={sectionDesc}>
              All bulk coupon assignments made by admins. You can deactivate a
              batch to cancel all its coupons.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table className="s-admincoupons-bbc29c">
                <thead>
                  <tr className="s-adminbrands-1ba202">
                    {[
                      "Batch",
                      "Coupon",
                      "Discount",
                      "Source",
                      "Segment",
                      "Users",
                      "Dates",
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
                  {batchesLoading ? (
                    <tr>
                      <td colSpan={9} className="s-adminbrands-3e0634">
                        Loading…
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="s-adminbrands-3e0634">
                        No batch assignments yet.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b: any) => (
                      <tr key={b.batchId} className="s-adminbrands-59d787">
                        <td className="s-admincategor-46dbfc">#{b.batchId}</td>
                        <td className="s-admincoupons-9db09c">
                          {b.couponCode}
                          <br />
                          <span style={{ fontSize: 11, color: "#888" }}>
                            {b.couponName}
                          </span>
                        </td>
                        <td className="s-admincategor-46dbfc">
                          {b.discount ? `${b.discount}%` : "—"}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontWeight: 600,
                              background:
                                b.sourceType === "segment_generate"
                                  ? "#e8f5e9"
                                  : "#e3f2fd",
                              color:
                                b.sourceType === "segment_generate"
                                  ? "#2e7d32"
                                  : "#1565c0",
                            }}
                          >
                            {b.sourceType === "segment_generate"
                              ? "Segment"
                              : "Excel Upload"}
                          </span>
                        </td>
                        <td
                          className="s-admincategor-ec7211"
                          style={{ fontSize: 12 }}
                        >
                          {b.segmentKey
                            ? `${b.segmentDirection === "top" ? "⬆" : "⬇"} ${
                                b.segmentKey
                              }`
                            : "—"}
                        </td>
                        <td
                          className="s-admincategor-46dbfc"
                          style={{ fontWeight: 700 }}
                        >
                          {b.userCount ?? "—"}
                        </td>
                        <td
                          className="s-admincategor-ec7211"
                          style={{ fontSize: 12 }}
                        >
                          {b.startDate ? fmtDate(b.startDate) : "Now"} →{" "}
                          {b.endDate ? fmtDate(b.endDate) : "∞"}
                        </td>
                        <td>
                          {b.isActive ? (
                            <span style={{ color: "green", fontWeight: 600 }}>
                              Active
                            </span>
                          ) : (
                            <span style={{ color: "#aaa", fontWeight: 600 }}>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="s-admincategor-19b711">
                          {b.isActive && (
                            <button
                              onClick={() => setDeactivateConfirm(b)}
                              className="s-adminbrands-6ea383"
                              style={{ color: "#c62828" }}
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {batchPages > 1 && (
              <div className="s-adminblog-213a15">
                {Array.from({ length: Math.min(batchPages, 10) }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setBatchPage(i + 1)}
                    className="s-admincoupons-174989"
                    style={{
                      borderColor:
                        batchPage === i + 1 ? "var(--brand)" : "var(--ivory)",
                      background: batchPage === i + 1 ? "var(--brand)" : "#fff",
                      color: batchPage === i + 1 ? "#fff" : "#000",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          BRAND COUPON TAB
      ════════════════════════════════════════════════════════ */}
      {tab === "brand_coupon" && (
        <div style={sectionCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={sectionTitle}>Brand Coupons</p>
              <p style={sectionDesc}>Single-use coupon codes valid for all products of a specific brand. Once used by anyone, the code cannot be used again.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnSecondary} onClick={() => { setBrandModal("bulk"); setBrandForm({ couponCode: "", couponName: "", brandId: "", discount: "", startDate: "", endDate: "" }); }}>
                ⬆ Bulk Upload Excel
              </button>
              <button style={btnPrimary} onClick={() => { setBrandModal("single"); setBrandForm({ couponCode: "", couponName: "", brandId: "", discount: "", startDate: "", endDate: "" }); }}>
                + Add Single Code
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <select
              value={brandFilterId}
              onChange={(e) => { setBrandFilterId(e.target.value ? Number(e.target.value) : ""); setBrandPage(1); }}
              style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, minWidth: 200 }}
            >
              <option value="">All Brands</option>
              {allBrands.map((b) => (
                <option key={b.brandId} value={b.brandId}>{b.brandName}</option>
              ))}
            </select>
            <a href="/api/Coupons/Brand/Template" style={{ fontSize: 13, color: "var(--brand)", marginLeft: "auto" }}>
              ⬇ Download Excel Template
            </a>
          </div>

          {/* Coupon codes table */}
          {brandCouponsLoading ? (
            <p style={{ color: "#999", fontSize: 13 }}>Loading…</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9f9f9" }}>
                  {["Code", "Name", "Brand", "Discount", "Valid From", "Valid Until", "Status", ""].map((h) => (
                    <th key={h} style={{ ...tdStyle, fontWeight: 700, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(brandCouponsData?.list ?? []).map((c: any) => {
                  const brand = allBrands.find((b) => b.brandId === c.brandId);
                  return (
                    <tr key={c.couponId}>
                      <td style={tdStyle}><code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>{c.couponCode}</code></td>
                      <td style={tdStyle}>{c.couponName || "—"}</td>
                      <td style={tdStyle}>{brand?.brandName ?? `Brand ${c.brandId}`}</td>
                      <td style={tdStyle}><b>{c.discount}%</b></td>
                      <td style={tdStyle}>{fmtDate(c.startDate)}</td>
                      <td style={tdStyle}>{fmtDate(c.endDate)}</td>
                      <td style={tdStyle}>
                        {c.isUsed ? (
                          <span style={{ background: "#f5e6e6", color: "#c0392b", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Used</span>
                        ) : c.isActive ? (
                          <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Active</span>
                        ) : (
                          <span style={{ background: "#f5f5f5", color: "#888", padding: "2px 8px", borderRadius: 10, fontSize: 12 }}>Inactive</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete coupon ${c.couponCode}?`)) return;
                            await api.delete(`/Coupons/Brand/${c.couponId}`);
                            refetchBrandCoupons();
                            toast.success("Deleted");
                          }}
                          style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 13 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(brandCouponsData?.list ?? []).length === 0 && (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#aaa", padding: 32 }}>No brand coupons yet</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {(brandCouponsData?.count ?? 0) > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button style={btnOutline} disabled={brandPage === 1} onClick={() => setBrandPage((p) => p - 1)}>← Prev</button>
              <span style={{ padding: "8px 12px", fontSize: 13 }}>{brandPage} / {Math.ceil((brandCouponsData?.count ?? 0) / PAGE_SIZE)}</span>
              <button style={btnOutline} disabled={brandPage * PAGE_SIZE >= (brandCouponsData?.count ?? 0)} onClick={() => setBrandPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ══ Brand coupon — Add Single modal ══ */}
      {brandModal === "single" && (
        <div className="s-admincoupons-d93fb3">
          <div className="s-admincoupons-5920ba">
            <h3 className="s-adminblog-e6371f">Add Brand Coupon</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={fieldLabel}>Coupon Code *</label>
                <input className="inp-field" placeholder="e.g. BRAND50OFF"
                  value={brandForm.couponCode}
                  onChange={(e) => setBrandForm({ ...brandForm, couponCode: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label style={fieldLabel}>Coupon Name</label>
                <input className="inp-field" placeholder="e.g. Summer Brand Sale"
                  value={brandForm.couponName}
                  onChange={(e) => setBrandForm({ ...brandForm, couponName: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Brand *</label>
                <select className="inp-field" value={brandForm.brandId}
                  onChange={(e) => setBrandForm({ ...brandForm, brandId: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">Select brand…</option>
                  {allBrands.map((b) => <option key={b.brandId} value={b.brandId}>{b.brandName}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Discount (%) *</label>
                <input className="inp-field" type="number" min={1} max={100} placeholder="e.g. 20"
                  value={brandForm.discount}
                  onChange={(e) => setBrandForm({ ...brandForm, discount: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <div>
                <label style={fieldLabel}>Valid From</label>
                <input className="inp-field" type="date" value={brandForm.startDate}
                  onChange={(e) => setBrandForm({ ...brandForm, startDate: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Valid Until</label>
                <input className="inp-field" type="date" value={brandForm.endDate}
                  onChange={(e) => setBrandForm({ ...brandForm, endDate: e.target.value })} />
              </div>
            </div>
            <div className="s-admincoupons-45d476">
              <button className="s-admincoupons-db4fcf" onClick={() => setBrandModal(null)}>Cancel</button>
              <button className="s-admincoupons-2798d5"
                disabled={!brandForm.couponCode || !brandForm.brandId || !brandForm.discount}
                style={{ opacity: !brandForm.couponCode || !brandForm.brandId || !brandForm.discount ? 0.5 : 1 }}
                onClick={async () => {
                  try {
                    await api.post("/Coupons/Brand/Single", {
                      couponCode: brandForm.couponCode, couponName: brandForm.couponName,
                      brandId: brandForm.brandId, discount: brandForm.discount,
                      startDate: brandForm.startDate || null, endDate: brandForm.endDate || null,
                    });
                    toast.success("Brand coupon created!");
                    setBrandModal(null);
                    refetchBrandCoupons();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || "Failed to create coupon");
                  }
                }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Brand coupon — Bulk Upload modal ══ */}
      {brandModal === "bulk" && (
        <div className="s-admincoupons-d93fb3">
          <div className="s-admincoupons-5920ba">
            <h3 className="s-adminblog-e6371f">Bulk Upload Brand Coupons</h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              Upload an Excel file with a single column of coupon codes.{" "}
              <a href="/api/Coupons/Brand/Template" style={{ color: "var(--brand)" }}>Download template</a>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={fieldLabel}>Coupon Name</label>
                <input className="inp-field" placeholder="e.g. Summer Brand Sale"
                  value={brandForm.couponName}
                  onChange={(e) => setBrandForm({ ...brandForm, couponName: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Brand *</label>
                <select className="inp-field" value={brandForm.brandId}
                  onChange={(e) => setBrandForm({ ...brandForm, brandId: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">Select brand…</option>
                  {allBrands.map((b) => <option key={b.brandId} value={b.brandId}>{b.brandName}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Discount (%) *</label>
                <input className="inp-field" type="number" min={1} max={100}
                  value={brandForm.discount}
                  onChange={(e) => setBrandForm({ ...brandForm, discount: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <div />
              <div>
                <label style={fieldLabel}>Valid From</label>
                <input className="inp-field" type="date" value={brandForm.startDate}
                  onChange={(e) => setBrandForm({ ...brandForm, startDate: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Valid Until</label>
                <input className="inp-field" type="date" value={brandForm.endDate}
                  onChange={(e) => setBrandForm({ ...brandForm, endDate: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Excel File *</label>
              <input ref={brandFileRef} type="file" accept=".xlsx,.xls" style={{ fontSize: 13 }} />
            </div>
            {brandUploadStatus && (
              <p style={{ fontSize: 13, color: brandUploadStatus.startsWith("✅") ? "#2e7d32" : "#c0392b", marginBottom: 12 }}>
                {brandUploadStatus}
              </p>
            )}
            <div className="s-admincoupons-45d476">
              <button className="s-admincoupons-db4fcf" onClick={() => { setBrandModal(null); setBrandUploadStatus(null); }}>Cancel</button>
              <button className="s-admincoupons-2798d5"
                disabled={!brandForm.brandId || !brandForm.discount}
                style={{ opacity: !brandForm.brandId || !brandForm.discount ? 0.5 : 1 }}
                onClick={async () => {
                  const file = brandFileRef.current?.files?.[0];
                  if (!file) { toast.error("Select an Excel file first"); return; }
                  const fd = new FormData();
                  fd.append("file", file);
                  setBrandUploadStatus("Uploading…");
                  try {
                    const params = new URLSearchParams({
                      couponName: brandForm.couponName,
                      brandId:    String(brandForm.brandId),
                      discount:   String(brandForm.discount),
                      ...(brandForm.startDate ? { startDate: brandForm.startDate } : {}),
                      ...(brandForm.endDate   ? { endDate:   brandForm.endDate }   : {}),
                    });
                    const res = await api.post(`/Coupons/Brand/BulkUpload?${params}`, fd, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                    setBrandUploadStatus(`✅ ${res.data.inserted} created, ${res.data.skipped} skipped`);
                    refetchBrandCoupons();
                  } catch (e: any) {
                    setBrandUploadStatus(`❌ ${e?.response?.data?.detail || "Upload failed"}`);
                  }
                }}>
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Digital coupon modal (unchanged) ══ */}
      {modal && (
        <div className="s-admincoupons-d93fb3">
          <div className="s-admincoupons-5920ba">
            <h3 className="s-adminblog-e6371f">
              {modal.couponId ? "Edit Coupon" : "New Coupon"}
            </h3>
            <div className="s-admincoupons-ad5066">
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
                    placeholder="Product ID"
                  />
                </div>
              )}
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
                  opacity: !modal.couponCode || !modal.discount ? 0.5 : 1,
                }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete confirm (unchanged) ══ */}
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

      {/* ══ Deactivate batch confirm (NEW) ══ */}
      {deactivateConfirm && (
        <div className="s-admincoupons-f1fb3c">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Deactivate Batch #{deactivateConfirm.batchId}?
            </h3>
            <p style={{ fontSize: 13, color: "#555", margin: "8px 0 16px" }}>
              This will deactivate all {deactivateConfirm.userCount} coupons in
              this batch. Users who already used their coupon are not affected.
            </p>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setDeactivateConfirm(null)}
                className="s-admincoupons-99e32e"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deactivateMutation.mutate(deactivateConfirm.batchId)
                }
                className="s-admincoupons-2253c0"
              >
                {deactivateMutation.isPending
                  ? "Deactivating…"
                  : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline style constants ────────────────────────────────────────────────────
const sectionCard: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: 10,
  padding: 20,
  background: "#fff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};
const sectionTitle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: 16,
  fontWeight: 700,
  color: "#1a1a1a",
};
const sectionDesc: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  color: "#666",
};
const stepBlock: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px dashed #e0e0e0",
};
const stepLabel: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  color: "var(--brand)",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const fieldLabel: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
  color: "#333",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  background: "var(--brand)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 16px",
  background: "#fff",
  color: "var(--brand)",
  border: "1.5px solid var(--brand)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
const btnOutline: React.CSSProperties = {
  padding: "8px 16px",
  background: "#fff",
  color: "#555",
  border: "1.5px solid #ccc",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};