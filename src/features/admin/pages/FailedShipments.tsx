/**
 * FailedShipments.tsx  —  Admin page
 * ────────────────────────────────────
 * Lists orders where payment succeeded but Ekart shipment creation failed.
 *
 * Features:
 *  • Active tab  — orders still needing a shipment (no TrackingId)
 *  • Resolved tab — orders that were fixed (TrackingId present, state=Processing/Shipped)
 *  • Dropdown per order showing full consignment details (same fields used for
 *    automatic Ekart creation) so staff can manually create on the Ekart portal
 *  • Retry button — calls same auto-create API; on success → moves to Resolved
 *  • Manual tracking input — enter AWB from Ekart portal → backend saves tracking,
 *    sends tracking email to user + CC to customer support, updates order state
 *  • Live count badge is driven by AdminLayout polling (no extra work here)
 *
 * Files to change:
 *  1. THIS FILE → src/features/admin/pages/FailedShipments.tsx  (new file)
 *  2. AdminLayout.tsx                                            (badge + nav entry)
 *  3. App.tsx                                                    (route)
 *  4. src/features/account/pages/OrdersList.tsx                 (Track Order button)
 *
 * Backend endpoints:
 *  GET  /api/Ekart/FailedShipments          → active failed list
 *  GET  /api/Ekart/ResolvedShipments        → resolved list (add to ekart/router.py)
 *  POST /api/Ekart/CreateShipment           → retry auto OR manual tracking entry
 */

import { useState, useEffect, useCallback } from "react";
import api from "@/shared/api/axiosInstance";

// ── Types ──────────────────────────────────────────────────────────────────

interface ShipmentItem {
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  hsnCode: string | null;
}

interface Consignee {
  name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  state: string;
}

interface FailedShipment {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  state: string;
  paymentMethod: string | null;
  createdDate: string;
  failureNotes: string | null;
  consignee: Consignee;
  email: string | null;
  items: ShipmentItem[];
  // resolved-only fields
  trackingId?: string;
  trackingUrl?: string;
  resolvedAt?: string;
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      padding: "12px 18px", borderRadius: 8, maxWidth: 380,
      background: type === "ok" ? "#e6f7ed" : "#fde8e8",
      color: type === "ok" ? "#1e7e42" : "#c0392b",
      border: `1px solid ${type === "ok" ? "#a3e0bb" : "#f5b7b7"}`,
      boxShadow: "0 4px 12px rgba(0,0,0,.12)",
      fontSize: 14,
    }}>
      {msg}
    </div>
  );
}

// ── Order row ──────────────────────────────────────────────────────────────

function ShipmentRow({
  s,
  resolved,
  onSuccess,
}: {
  s: FailedShipment;
  resolved: boolean;
  onSuccess: (orderId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const trackingPreview = tracking.trim()
    ? `https://app.elite.ekartlogistics.in/track/${tracking.trim()}`
    : "";

  const callCreate = async (payload: object) => {
    setBusy(true);
    setRowError(null);
    try {
      const res = await api.post("/Ekart/CreateShipment", payload);
      if (res.data?.success) {
        onSuccess(s.orderId);
      } else {
        setRowError(res.data?.error || "Failed — try again");
      }
    } catch (err: any) {
      setRowError(err?.response?.data?.detail || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRetry   = () => callCreate({ order_id: s.orderId });
  const handleManual  = () => {
    if (!tracking.trim()) { setRowError("Enter a tracking ID first"); return; }
    callCreate({ order_id: s.orderId, manual_tracking_id: tracking.trim() });
  };

  const fmt = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, background: "#fff", overflow: "hidden", marginBottom: 10 }}>
      {/* ── Header row ── */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 18px", cursor: "pointer",
          background: open ? "#f9f9f9" : "#fcfcfc",
        }}
      >
        <div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>#{s.orderNumber}</span>
          <span style={{ color: "#999", fontSize: 13, marginLeft: 8 }}>Order {s.orderId}</span>
          <div style={{ fontSize: 13, color: "#555", marginTop: 3 }}>
            {s.consignee.name || "—"} · {s.email || "no email"} · {s.consignee.city || "—"} · ₹{s.totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{fmt(s.createdDate)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {resolved ? (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "#e6f7ed", color: "#1e7e42", fontWeight: 600 }}>
              ✓ Resolved — {s.trackingId || "AWB saved"}
            </span>
          ) : (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "#fde8e8", color: "#c0392b", fontWeight: 600 }}>
              No tracking ID
            </span>
          )}
          <span style={{ color: "#bbb", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {open && (
        <div style={{ padding: 18, borderTop: "1px solid #eee" }}>
          {rowError && (
            <div style={{ padding: "8px 12px", background: "#fde8e8", color: "#c0392b", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              {rowError}
            </div>
          )}
          {s.failureNotes && !resolved && (
            <div style={{ padding: "8px 12px", background: "#fff8e1", color: "#7d5a00", borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {s.failureNotes}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 18 }}>
            {/* Consignee */}
            <div>
              <p style={{ fontSize: 12, color: "#999", textTransform: "uppercase", fontWeight: 600, margin: "0 0 8px" }}>Consignee (for Ekart portal)</p>
              <table style={{ fontSize: 13, width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Name",     s.consignee.name || "—"],
                    ["Phone",    s.consignee.phone || "—"],
                    ["Email",    s.email || "—"],
                    ["Address",  s.consignee.address || "—"],
                    ["City",     s.consignee.city || "—"],
                    ["State",    s.consignee.state || "—"],
                    ["Pincode",  s.consignee.pincode || "—"],
                    ["Pay Mode", s.paymentMethod || "Prepaid"],
                    ["Total",    `₹${s.totalAmount.toFixed(2)}`],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td style={{ color: "#888", paddingRight: 12, paddingBottom: 4, whiteSpace: "nowrap" }}>{label}</td>
                      <td style={{ paddingBottom: 4, wordBreak: "break-word" }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Items */}
            <div>
              <p style={{ fontSize: 12, color: "#999", textTransform: "uppercase", fontWeight: 600, margin: "0 0 8px" }}>Items</p>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#aaa", textAlign: "left" }}>
                    {["SKU", "Name", "Qty", "Price", "HSN"].map((h) => (
                      <th key={h} style={{ paddingBottom: 6, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((it, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "5px 0", color: "#666" }}>{it.sku || "—"}</td>
                      <td style={{ padding: "5px 0" }}>{it.name}</td>
                      <td style={{ padding: "5px 0" }}>{it.quantity}</td>
                      <td style={{ padding: "5px 0" }}>₹{it.price.toFixed(0)}</td>
                      <td style={{ padding: "5px 0", color: "#666" }}>{it.hsnCode || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resolved — just show tracking info */}
          {resolved && s.trackingUrl && (
            <a
              href={s.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#1e7e42", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              🚚 {s.trackingUrl}
            </a>
          )}

          {/* Active — retry + manual entry */}
          {!resolved && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
              <button
                onClick={handleRetry}
                disabled={busy}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd",
                  background: "#fff", cursor: busy ? "not-allowed" : "pointer",
                  fontSize: 13, whiteSpace: "nowrap",
                }}
              >
                {busy ? "Retrying…" : "↻ Retry Auto-Create"}
              </button>

              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Or enter AWB from Ekart portal
                </label>
                <input
                  type="text"
                  placeholder="e.g. LUAP0001179225"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}
                />
                {trackingPreview && (
                  <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>
                    Link: {trackingPreview}
                  </div>
                )}
              </div>

              <button
                onClick={handleManual}
                disabled={busy || !tracking.trim()}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: !tracking.trim() ? "#ccc" : "#1e3a5f",
                  color: "#fff", cursor: busy || !tracking.trim() ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                }}
              >
                {busy ? "Saving…" : "Save AWB & Notify Customer"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function FailedShipments() {
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const [active, setActive] = useState<FailedShipment[]>([]);
  const [resolved, setResolved] = useState<FailedShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const fetchBoth = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        api.get("/Ekart/FailedShipments"),
        api.get("/Ekart/ResolvedShipments"),
      ]);
      setActive(a.data?.failedShipments ?? []);
      setResolved(r.data?.resolvedShipments ?? []);
    } catch {
      // silently ignore — badge will show 0
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBoth(); }, [fetchBoth]);

  const handleSuccess = (orderId: number) => {
    // Move from active → resolved locally (backend already updated)
    const found = active.find((s) => s.orderId === orderId);
    setActive((prev) => prev.filter((s) => s.orderId !== orderId));
    if (found) setResolved((prev) => [{ ...found, resolvedAt: new Date().toISOString() }, ...prev]);
    setToast({ msg: `Order #${found?.orderNumber || orderId} resolved — tracking email sent`, type: "ok" });
  };

  const tabStyle = (t: "active" | "resolved") => ({
    padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
    background: tab === t ? (t === "active" ? "#c0392b" : "#1e7e42") : "#f0f0f0",
    color: tab === t ? "#fff" : "#555",
  });

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Failed Shipments</h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            Orders where payment succeeded but Ekart shipment creation needs attention.
          </p>
        </div>
        <button
          onClick={fetchBoth}
          disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={tabStyle("active")} onClick={() => setTab("active")}>
          Needs Attention
          {active.length > 0 && (
            <span style={{ marginLeft: 8, background: "#fff", color: "#c0392b", borderRadius: 10, padding: "1px 7px", fontSize: 12 }}>
              {active.length}
            </span>
          )}
        </button>
        <button style={tabStyle("resolved")} onClick={() => setTab("resolved")}>
          Resolved
          {resolved.length > 0 && (
            <span style={{ marginLeft: 8, background: "#fff", color: "#1e7e42", borderRadius: 10, padding: "1px 7px", fontSize: 12 }}>
              {resolved.length}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Loading…</div>
      ) : tab === "active" ? (
        active.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa", background: "#fafafa", borderRadius: 8 }}>
            No failed shipments right now — all confirmed orders have tracking IDs ✓
          </div>
        ) : (
          active.map((s) => (
            <ShipmentRow key={s.orderId} s={s} resolved={false} onSuccess={handleSuccess} />
          ))
        )
      ) : (
        resolved.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa", background: "#fafafa", borderRadius: 8 }}>
            No resolved shipments yet.
          </div>
        ) : (
          resolved.map((s) => (
            <ShipmentRow key={s.orderId} s={s} resolved onSuccess={handleSuccess} />
          ))
        )
      )}
    </div>
  );
}