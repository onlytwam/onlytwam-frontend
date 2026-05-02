// src/features/admin/pages/AdminSmsConfig.tsx
// Manage sms.SmsCredential and sms.SmsMessageTemplate
// Route: /admin/sms-config

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/shared/api/axiosInstance";

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchCredentials = () =>
  api.get("/SmsCredential").then((r) => r.data as any[]);
const fetchTemplates = () =>
  api.get("/MessageTemplate").then((r) => r.data?.list ?? (r.data as any[]));
const updateCredential = (id: number, data: any) =>
  api.put(`/SmsCredential/${id}`, data).then((r) => r.data);
const createCredential = (data: any) =>
  api.post("/SmsCredential", data).then((r) => r.data);
const updateTemplate = (id: number, data: any) =>
  api.put(`/MessageTemplate/${id}`, data).then((r) => r.data);

export default function AdminSmsConfig() {
  const qc = useQueryClient();

  // ── Credentials ─────────────────────────────────────────────────────────────
  const { data: credentials = [], isLoading: credLoading } = useQuery({
    queryKey: ["sms-credentials"],
    queryFn: fetchCredentials,
  });

  const [editCredId, setEditCredId] = useState<number | null>(null);
  const [credForm, setCredForm] = useState<Record<string, any>>({});
  const [showPass, setShowPass] = useState(false);
  const [showNewCred, setShowNewCred] = useState(false);
  const [newCred, setNewCred] = useState({
    apiUrl: "",
    apiMultiUrl: "",
    username: "",
    password: "",
    senderId: "",
    unicode: "false",
  });

  const updateCredMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateCredential(id, data),
    onSuccess: () => {
      toast.success("SMS credential updated.");
      qc.invalidateQueries({ queryKey: ["sms-credentials"] });
      setEditCredId(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Update failed"),
  });

  const createCredMutation = useMutation({
    mutationFn: (data: any) => createCredential(data),
    onSuccess: () => {
      toast.success("SMS credential created.");
      qc.invalidateQueries({ queryKey: ["sms-credentials"] });
      setShowNewCred(false);
      setNewCred({
        apiUrl: "",
        apiMultiUrl: "",
        username: "",
        password: "",
        senderId: "",
        unicode: "false",
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Create failed"),
  });

  // ── Templates ────────────────────────────────────────────────────────────────
  const { data: templates = [], isLoading: tmplLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: fetchTemplates,
  });

  const [editTmplId, setEditTmplId] = useState<number | null>(null);
  const [tmplForm, setTmplForm] = useState<Record<string, any>>({});

  const updateTmplMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateTemplate(id, data),
    onSuccess: () => {
      toast.success("Template updated.");
      qc.invalidateQueries({ queryKey: ["sms-templates"] });
      setEditTmplId(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Update failed"),
  });

  const credFields = [
    { key: "apiUrl", label: "API URL (single send)", type: "text" },
    { key: "apiMultiUrl", label: "API Multi URL (bulk send)", type: "text" },
    { key: "username", label: "Username", type: "text" },
    {
      key: "password",
      label: "Password",
      type: showPass ? "text" : "password",
    },
    { key: "senderId", label: "Sender ID (DLT Header)", type: "text" },
    { key: "unicode", label: "Unicode (true/false)", type: "text" },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
      <h4 style={{ color: "var(--brand)", marginBottom: 24 }}>
        <i className="bi bi-phone-fill me-2" />
        SMS Configuration
      </h4>

      {/* ── SMS Credentials ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h5 style={{ margin: 0 }}>API Credentials</h5>
          <button
            onClick={() => setShowNewCred((v) => !v)}
            className="btn btn-sm"
            style={{
              background: "var(--brand)",
              color: "#fff",
              borderRadius: 6,
            }}
          >
            <i className="bi bi-plus me-1" />
            {showNewCred ? "Cancel" : "Add Credential"}
          </button>
        </div>

        {/* Add new credential form */}
        {showNewCred && (
          <div
            style={{
              background: "#f9f9f9",
              borderRadius: 10,
              padding: 20,
              marginBottom: 20,
              border: "1px solid var(--ivory)",
            }}
          >
            <h6>New Credential</h6>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {credFields.map(({ key, label, type }) => (
                <div key={key}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--heirloom)",
                      marginBottom: 4,
                      display: "block",
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(newCred as any)[key] || ""}
                    onChange={(e) =>
                      setNewCred((c) => ({ ...c, [key]: e.target.value }))
                    }
                    className="inp-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={() => createCredMutation.mutate(newCred)}
                disabled={createCredMutation.isPending}
                className="btn btn-sm"
                style={{
                  background: "var(--brand)",
                  color: "#fff",
                  borderRadius: 6,
                }}
              >
                {createCredMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {credLoading ? (
          <p>Loading…</p>
        ) : (
          (credentials as any[]).map((cred: any) => (
            <div
              key={cred.smsCredentialId}
              style={{
                border: "1px solid var(--ivory)",
                borderRadius: 10,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 600,
                      color: cred.isActive ? "var(--brand)" : "var(--heirloom)",
                    }}
                  >
                    {cred.isActive ? "● Active" : "○ Inactive"}
                  </span>
                  <span
                    style={{
                      marginLeft: 12,
                      fontSize: 13,
                      color: "var(--heirloom)",
                    }}
                  >
                    Sender: <strong>{cred.senderId}</strong> | Username:{" "}
                    <strong>{cred.username}</strong>
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditCredId(cred.smsCredentialId);
                    setCredForm({ ...cred });
                  }}
                  className="btn btn-sm"
                  style={{ borderRadius: 6, border: "1px solid var(--ivory)" }}
                >
                  <i className="bi bi-pencil me-1" />
                  Edit
                </button>
              </div>

              {editCredId === cred.smsCredentialId && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: 8,
                    }}
                  >
                    <button
                      onClick={() => setShowPass((v) => !v)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--heirloom)",
                      }}
                    >
                      <i
                        className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"} me-1`}
                      />
                      {showPass ? "Hide" : "Show"} password
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    {credFields.map(({ key, label, type }) => (
                      <div key={key}>
                        <label
                          style={{
                            fontSize: 12,
                            color: "var(--heirloom)",
                            marginBottom: 4,
                            display: "block",
                          }}
                        >
                          {label}
                        </label>
                        <input
                          type={type}
                          value={credForm[key] ?? ""}
                          onChange={(e) =>
                            setCredForm((f) => ({
                              ...f,
                              [key]: e.target.value,
                            }))
                          }
                          className="inp-field"
                          style={{ fontSize: 13 }}
                        />
                      </div>
                    ))}
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--heirloom)",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Active
                      </label>
                      <select
                        value={credForm.isActive ? "true" : "false"}
                        onChange={(e) =>
                          setCredForm((f) => ({
                            ...f,
                            isActive: e.target.value === "true",
                          }))
                        }
                        className="inp-field"
                        style={{ fontSize: 13 }}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        updateCredMutation.mutate({
                          id: cred.smsCredentialId,
                          data: credForm,
                        })
                      }
                      disabled={updateCredMutation.isPending}
                      className="btn btn-sm"
                      style={{
                        background: "var(--brand)",
                        color: "#fff",
                        borderRadius: 6,
                      }}
                    >
                      {updateCredMutation.isPending
                        ? "Saving…"
                        : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setEditCredId(null)}
                      className="btn btn-sm"
                      style={{
                        borderRadius: 6,
                        border: "1px solid var(--ivory)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {!credLoading && (credentials as any[]).length === 0 && (
          <p style={{ color: "var(--heirloom)", fontStyle: "italic" }}>
            No credentials found. Add one above or run the seed SQL.
          </p>
        )}
      </section>

      {/* ── SMS Templates ───────────────────────────────────────────────────── */}
      <section>
        <h5 style={{ marginBottom: 16 }}>Message Templates</h5>
        <p style={{ fontSize: 13, color: "var(--heirloom)", marginBottom: 16 }}>
          <i className="bi bi-info-circle me-1" />
          Templates are DLT-approved. Edit content or state here. Set state to{" "}
          <strong>Inactive</strong> to disable SMS for that type.
        </p>
        {tmplLoading ? (
          <p>Loading…</p>
        ) : (
          (templates as any[]).map((tmpl: any) => (
            <div
              key={tmpl.messageTemplateId}
              style={{
                border: "1px solid var(--ivory)",
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{tmpl.messageType}</span>
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background:
                        tmpl.state?.toLowerCase() === "active"
                          ? "#e8f5e9"
                          : "#fce4ec",
                      color:
                        tmpl.state?.toLowerCase() === "active"
                          ? "#2e7d32"
                          : "var(--brand)",
                    }}
                  >
                    {tmpl.state}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditTmplId(tmpl.messageTemplateId);
                    setTmplForm({ ...tmpl });
                  }}
                  className="btn btn-sm"
                  style={{ borderRadius: 6, border: "1px solid var(--ivory)" }}
                >
                  <i className="bi bi-pencil me-1" />
                  Edit
                </button>
              </div>

              {editTmplId !== tmpl.messageTemplateId && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--heirloom)",
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  {tmpl.messageContent}
                </p>
              )}

              {editTmplId === tmpl.messageTemplateId && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--heirloom)",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Message Type
                      </label>
                      <input
                        value={tmplForm.messageType || ""}
                        onChange={(e) =>
                          setTmplForm((f) => ({
                            ...f,
                            messageType: e.target.value,
                          }))
                        }
                        className="inp-field"
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--heirloom)",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        DLT ID (Principal Entity ID)
                      </label>
                      <input
                        value={tmplForm.dltId || ""}
                        onChange={(e) =>
                          setTmplForm((f) => ({ ...f, dltId: e.target.value }))
                        }
                        className="inp-field"
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--heirloom)",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Template ID (DLT Content ID)
                      </label>
                      <input
                        value={tmplForm.templateId || ""}
                        onChange={(e) =>
                          setTmplForm((f) => ({
                            ...f,
                            templateId: e.target.value,
                          }))
                        }
                        className="inp-field"
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label
                      style={{
                        fontSize: 12,
                        color: "var(--heirloom)",
                        marginBottom: 4,
                        display: "block",
                      }}
                    >
                      Message Content
                    </label>
                    <textarea
                      value={tmplForm.messageContent || ""}
                      onChange={(e) =>
                        setTmplForm((f) => ({
                          ...f,
                          messageContent: e.target.value,
                        }))
                      }
                      className="inp-field"
                      rows={3}
                      style={{ fontSize: 13, width: "100%" }}
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label
                      style={{
                        fontSize: 12,
                        color: "var(--heirloom)",
                        marginBottom: 4,
                        display: "block",
                      }}
                    >
                      State
                    </label>
                    <select
                      value={tmplForm.state || "Active"}
                      onChange={(e) =>
                        setTmplForm((f) => ({ ...f, state: e.target.value }))
                      }
                      className="inp-field"
                      style={{ fontSize: 13, width: 160 }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        updateTmplMutation.mutate({
                          id: tmpl.messageTemplateId,
                          data: tmplForm,
                        })
                      }
                      disabled={updateTmplMutation.isPending}
                      className="btn btn-sm"
                      style={{
                        background: "var(--brand)",
                        color: "#fff",
                        borderRadius: 6,
                      }}
                    >
                      {updateTmplMutation.isPending
                        ? "Saving…"
                        : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setEditTmplId(null)}
                      className="btn btn-sm"
                      style={{
                        borderRadius: 6,
                        border: "1px solid var(--ivory)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
