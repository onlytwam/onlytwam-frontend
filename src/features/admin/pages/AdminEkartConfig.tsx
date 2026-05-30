// src/features/admin/pages/AdminEkartConfig.tsx
//
// Admin page to view and update ShipmentConfigurations from the UI.
// Route: /admin/ekart-config
//
// Sections:
//  1. Credentials (ClientId, token URL, create/cancel/track URLs, username, password)
//  2. Warehouse Return Address
//  3. Readiness check panel

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getEkartConfig,
  updateEkartConfig,
  getEkartReadiness,
} from "@/features/orders/api/orders.api";

export default function AdminEkartConfig() {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["ekart-config"],
    queryFn: getEkartConfig,
    select: (d: any) => (Array.isArray(d) ? d : []),
  });

  const { data: readiness } = useQuery({
    queryKey: ["ekart-readiness"],
    queryFn: getEkartReadiness,
    retry: false,
  });

  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showPass, setShowPass] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateEkartConfig(id, data),
    onSuccess: () => {
      toast.success("Configuration updated");
      qc.invalidateQueries({ queryKey: ["ekart-config"] });
      qc.invalidateQueries({ queryKey: ["ekart-readiness"] });
      setEditId(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Update failed"),
  });

  const handleEdit = (cfg: any) => {
    setEditId(cfg.id);
    setFormData({
      clientId: cfg.clientId ?? "",
      accessTokenURL: cfg.accessTokenURL ?? "",
      createShipmentURL: cfg.createShipmentURL ?? "",
      cancelShipmentURL: cfg.cancelShipmentURL ?? "",
      trackShipmentURL: cfg.trackShipmentURL ?? "",
      wayBillURL: cfg.wayBillURL ?? "",
      userName: cfg.userName ?? "",
      password: "", // never pre-fill password
      returnName: cfg.returnName ?? "",
      returnPhone: cfg.returnPhone ?? "",
      returnAddressLine1: cfg.returnAddressLine1 ?? "",
      returnAddressLine2: cfg.returnAddressLine2 ?? "",
      returnCity: cfg.returnCity ?? "",
      returnState: cfg.returnState ?? "",
      returnPinCode: cfg.returnPinCode ?? "",
      returnCountry: cfg.returnCountry ?? "India",
    });
    setShowPass(false);
  };

  const handleSave = () => {
    if (!editId) return;
    // Only send password if it was filled in
    const payload = { ...formData };
    if (!payload.password) delete payload.password;
    updateMutation.mutate({ id: editId, data: payload });
  };

  const inp = (key: string, type = "text", placeholder = "") => (
    <input
      type={type}
      className="form-control form-control-sm"
      placeholder={placeholder}
      value={formData[key] ?? ""}
      onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
    />
  );

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-4 fw-bold">Ekart Logistics Configuration</h4>

      {/* ── Readiness Banner ── */}
      {readiness && (
        <div
          className={`alert ${
            readiness.ready_for_live
              ? "alert-success"
              : readiness.mock_mode
              ? "alert-warning"
              : "alert-danger"
          } mb-4`}
        >
          <strong>
            {readiness.ready_for_live
              ? "✅ Live Mode — Ekart API fully configured"
              : readiness.mock_mode
              ? "⚠️ Mock Mode — Shipments use fake AWB numbers"
              : "❌ Configuration Incomplete"}
          </strong>
          {(readiness.missing_required ?? []).length > 0 && (
            <ul className="mb-0 mt-2">
              {(readiness.missing_required as string[]).map((m: string) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {(readiness.notes ?? []).map((n: string, i: number) => (
            <p key={i} className="mb-0 mt-1 small">
              {n}
            </p>
          ))}
        </div>
      )}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: "8px 0",
          }}
        >
          {[1, 2].map((i) => (
            <div key={i} className="card mb-4" style={{ padding: 20 }}>
              <div
                className="twam-skel"
                style={{
                  height: 16,
                  width: "40%",
                  borderRadius: 5,
                  marginBottom: 12,
                }}
              />
              <div
                className="twam-skel"
                style={{
                  height: 12,
                  width: "70%",
                  borderRadius: 5,
                  marginBottom: 8,
                }}
              />
              <div
                className="twam-skel"
                style={{ height: 12, width: "55%", borderRadius: 5 }}
              />
            </div>
          ))}
        </div>
      ) : configs.length === 0 ? (
        <div className="alert alert-info">
          No ShipmentConfigurations found. Run the SQL migration to seed the
          table.
        </div>
      ) : (
        configs.map((cfg: any) => (
          <div key={cfg.id} className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>
                <strong>{cfg.deliveryAgent || "Unknown Agent"}</strong>
                <span
                  className={`badge ms-2 ${
                    cfg.stateId === "Active" ? "bg-success" : "bg-secondary"
                  }`}
                >
                  {cfg.stateId}
                </span>
              </span>
              {editId !== cfg.id ? (
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => handleEdit(cfg)}
                >
                  Edit
                </button>
              ) : (
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-dark"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setEditId(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="card-body">
              {editId !== cfg.id ? (
                // ── Read View ──
                <div className="row g-3">
                  <div className="col-md-6">
                    <h6 className="text-muted small text-uppercase mb-2">
                      API Credentials
                    </h6>
                    <table className="table table-sm table-borderless small mb-0">
                      <tbody>
                        {[
                          ["Client ID", cfg.clientId],
                          ["Token URL", cfg.accessTokenURL],
                          ["Create URL", cfg.createShipmentURL],
                          ["Cancel URL", cfg.cancelShipmentURL],
                          ["Track URL", cfg.trackShipmentURL],
                          ["Username", cfg.userName],
                          ["Password", cfg.password],
                        ].map(([label, val]) => (
                          <tr key={label as string}>
                            <td className="text-muted" style={{ width: 120 }}>
                              {label}
                            </td>
                            <td style={{ wordBreak: "break-all" }}>
                              {val as string}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted small text-uppercase mb-2">
                      Warehouse Return Address
                    </h6>
                    {cfg.returnAddressLine1 ? (
                      <address className="small mb-0">
                        <strong>{cfg.returnName}</strong>
                        <br />
                        {cfg.returnAddressLine1}
                        <br />
                        {cfg.returnAddressLine2 && (
                          <>
                            {cfg.returnAddressLine2}
                            <br />
                          </>
                        )}
                        {cfg.returnCity}, {cfg.returnState} —{" "}
                        {cfg.returnPinCode}
                        <br />
                        {cfg.returnCountry}
                        <br />
                        📞 {cfg.returnPhone}
                      </address>
                    ) : (
                      <span className="text-danger small">
                        ⚠️ Return address not configured
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                // ── Edit Form ──
                <div className="row g-3">
                  <div className="col-md-6">
                    <h6 className="text-muted small text-uppercase mb-3">
                      API Credentials
                    </h6>
                    {[
                      ["Client ID", "clientId", "EKART_XXXXXX"],
                      [
                        "Access Token URL",
                        "accessTokenURL",
                        "https://app.elite.ekartlogistics.in/...",
                      ],
                      ["Create URL", "createShipmentURL", "https://..."],
                      ["Cancel URL", "cancelShipmentURL", "https://..."],
                      ["Track URL", "trackShipmentURL", "https://..."],
                      ["WayBill URL", "wayBillURL", "https://..."],
                      ["Username", "userName", "email@example.com"],
                    ].map(([label, key, ph]) => (
                      <div className="mb-2" key={key as string}>
                        <label className="form-label small fw-semibold">
                          {label}
                        </label>
                        {inp(key as string, "text", ph as string)}
                      </div>
                    ))}
                    <div className="mb-2">
                      <label className="form-label small fw-semibold">
                        Password
                        <span className="text-muted fw-normal ms-1">
                          (leave blank to keep current)
                        </span>
                      </label>
                      <div className="input-group input-group-sm">
                        {inp(
                          "password",
                          showPass ? "text" : "password",
                          "New password",
                        )}
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPass((s) => !s)}
                          type="button"
                        >
                          <i
                            className={`bi bi-eye${showPass ? "-slash" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <h6 className="text-muted small text-uppercase mb-3">
                      Warehouse Return Address
                    </h6>
                    {[
                      ["Contact Name", "returnName", "Warehouse Manager"],
                      ["Phone", "returnPhone", "+91XXXXXXXXXX"],
                      [
                        "Address Line 1",
                        "returnAddressLine1",
                        "123, Industrial Area",
                      ],
                      [
                        "Address Line 2",
                        "returnAddressLine2",
                        "Phase 2 (optional)",
                      ],
                      ["City", "returnCity", "Hyderabad"],
                      ["State", "returnState", "Telangana"],
                      ["Pincode", "returnPinCode", "500001"],
                      ["Country", "returnCountry", "India"],
                    ].map(([label, key, ph]) => (
                      <div className="mb-2" key={key as string}>
                        <label className="form-label small fw-semibold">
                          {label}
                        </label>
                        {inp(key as string, "text", ph as string)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
