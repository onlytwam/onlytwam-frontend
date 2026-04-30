// adminmdm.tsx
import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";
import AdminBrands from "./AdminBrands";
import AdminSizes from "./AdminSizes";

// ─── Shared Styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
};
const lbl: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#444",
  display: "block",
  marginBottom: 5,
};
const errSt: React.CSSProperties = {
  color: "#e53935",
  fontSize: 12,
  marginTop: 3,
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
      {error && <p style={errSt}>{error}</p>}
    </div>
  );
}

// ─── Fabric Section ───────────────────────────────────────────────────────────
const fabricSchema = z.object({
  name: z.string().min(1, "Fabric name is required"),
  fabricCode: z.string().min(1, "Fabric code is required"),
  description: z.string().optional().nullable(),
  texture: z.string().optional().nullable(),
});
type FabricForm = z.infer<typeof fabricSchema>;

function AdminFabric() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["fabrics"],
    queryFn: () =>
      api
        .get("/Fabric/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const fabrics: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FabricForm>({ resolver: zodResolver(fabricSchema) });

  const openCreate = () => {
    setEditItem(null);
    reset({ name: "", fabricCode: "", description: "", texture: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("name", item.name);
    setValue("fabricCode", item.fabricCode);
    setValue("description", item.description || "");
    setValue("texture", item.texture || "");
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("fabric-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveFabric = useMutation({
    mutationFn: (formData: FabricForm) => {
      const current = editItemRef.current;
      return current
        ? api.put(`/Fabric/${current.fabricId}/`, formData).then((r) => r.data)
        : api.post("/Fabric/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current ? "Fabric updated!" : "Fabric created!",
      );
      qc.invalidateQueries({ queryKey: ["fabrics"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save fabric"),
  });

  const deleteFabric = useMutation({
    mutationFn: (id: number) => api.delete(`/Fabric/${id}/`),
    onSuccess: () => {
      toast.success("Fabric deleted");
      qc.invalidateQueries({ queryKey: ["fabrics"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete fabric"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Fabrics</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage fabric types used across products
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Fabric
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="fabric-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-stack"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit Fabric" : "Create New Fabric"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.name}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => saveFabric.mutate(data))}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field label="Fabric Name *" error={errors.name?.message}>
                <input
                  {...register("name")}
                  style={inp}
                  placeholder="e.g. Cotton, Polyester, Silk"
                  autoFocus
                />
              </Field>
              <Field label="Fabric Code *" error={errors.fabricCode?.message}>
                <input
                  {...register("fabricCode")}
                  style={inp}
                  placeholder="e.g. COT-001"
                />
              </Field>
              <Field label="Texture">
                <input
                  {...register("texture")}
                  style={inp}
                  placeholder="e.g. Smooth, Rough, Knit"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                {...register("description")}
                style={{ ...inp, minHeight: 90, resize: "vertical" }}
                placeholder="Optional notes about this fabric…"
              />
            </Field>
            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveFabric.isPending}
                style={{
                  background: saveFabric.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveFabric.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveFabric.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveFabric.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Fabric"
                  : "Create Fabric"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Fabrics
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {fabrics.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading fabrics…
            </p>
          </div>
        ) : fabrics.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-stack"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No fabrics added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first fabric
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {[
                    "#",
                    "Fabric Name",
                    "Fabric Code",
                    "Texture",
                    "Description",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fabrics.map((f: any, idx: number) => (
                  <tr
                    key={f.fabricId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-stack"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {f.name}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {f.fabricCode || "—"}
                      </code>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {f.texture ? (
                        <span
                          style={{
                            background: "#e8f4fd",
                            color: "#1565c0",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {f.texture}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#777",
                        maxWidth: 260,
                      }}
                    >
                      {f.description ? (
                        <span
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {f.description}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(f)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(f.fabricId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Fabric?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The fabric will be permanently
                removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFabric.mutate(deleteId)}
                disabled={deleteFabric.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteFabric.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tax HSN Code Section ─────────────────────────────────────────────────────
const hsnSchema = z.object({
  hsnCode: z.string().min(1, "HSN Code is required"),
  hsnDescription: z.string().min(1, "HSN Description is required"),
  cgst: z.coerce.number().min(0, "Minimum 0").max(100, "Maximum 100"),
  sgst: z.coerce.number().min(0, "Minimum 0").max(100, "Maximum 100"),
});
type HSNForm = z.infer<typeof hsnSchema>;

function AdminTaxHSNCode() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  const { data, isLoading } = useQuery({
    queryKey: ["taxHSNCodes"],
    queryFn: () =>
      api
        .get("/MDM/TaxHSNCode/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const hsnCodes: any[] = data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<HSNForm>({
    resolver: zodResolver(hsnSchema) as Resolver<HSNForm>,
  });

  const cgst = watch("cgst") || 0;
  const sgst = watch("sgst") || 0;
  const totalGST = (Number(cgst) + Number(sgst)).toFixed(2);

  const openCreate = () => {
    setEditItem(null);
    reset({ hsnCode: "", hsnDescription: "", cgst: 0, sgst: 0 });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    reset({
      hsnCode: item.hsnCode ?? "",
      hsnDescription: item.hsnDescription ?? "",
      cgst: Number(item.cgst) || 0,
      sgst: Number(item.sgst) || 0,
    });
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("hsn-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  const saveHSN = useMutation({
    mutationFn: (formData: HSNForm) => {
      const current = editItemRef.current;
      const payload = {
        taxHSNCodeId: current?.taxHSNCodeId,
        hsnCode: formData.hsnCode,
        hsnDescription: formData.hsnDescription,
        cgst: Number(formData.cgst),
        sgst: Number(formData.sgst),
      };
      console.log(
        "Saving HSN — editItem:",
        current,
        "id:",
        current?.taxHSNCodeId,
      );
      return current
        ? api
            .put(`/TaxHSNCode/${current.taxHSNCodeId}/`, payload)
            .then((r) => r.data)
        : api.post("/TaxHSNCode/", payload).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current ? "HSN Code updated!" : "HSN Code created!",
      );
      qc.invalidateQueries({ queryKey: ["taxHSNCodes"] });
      cancelForm();
    },
    onError: (e: any) => {
      console.error("Save error:", e?.response?.data);
      toast.error(
        e?.response?.data?.detail ||
          JSON.stringify(e?.response?.data) ||
          "Failed to save",
      );
    },
  });

  const deleteHSN = useMutation({
    mutationFn: (id: number) => api.delete(`/TaxHSNCode/${id}/`),
    onSuccess: () => {
      toast.success("HSN Code deleted");
      qc.invalidateQueries({ queryKey: ["taxHSNCodes"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      console.error("Delete error:", e?.response?.data);
      toast.error(e?.response?.data?.detail || "Failed to delete HSN Code");
    },
  });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Tax HSN Codes
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage HSN codes with CGST, SGST and Total GST rates
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add HSN Code
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="hsn-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-receipt"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit HSN Code" : "Create New HSN Code"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.hsnCode}`
                    : "Fill in the tax details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data: HSNForm) => saveHSN.mutate(data))}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field label="HSN Code *" error={errors.hsnCode?.message}>
                <input
                  {...register("hsnCode")}
                  style={inp}
                  placeholder="e.g. 5208, 6101"
                  autoFocus
                />
              </Field>
              <Field label="CGST (%) *" error={errors.cgst?.message}>
                <input
                  {...register("cgst", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  style={inp}
                  placeholder="e.g. 9"
                />
              </Field>
              <Field label="SGST (%) *" error={errors.sgst?.message}>
                <input
                  {...register("sgst", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  style={inp}
                  placeholder="e.g. 9"
                />
              </Field>
            </div>

            {/* Live GST preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                padding: "12px 16px",
                background: "#f8f9fa",
                borderRadius: 8,
                border: "1px solid #e8e8e8",
              }}
            >
              <i
                className="bi bi-calculator"
                style={{ color: "#888", fontSize: 15 }}
              />
              <span style={{ fontSize: 13, color: "#555" }}>Total GST:</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                {totalGST}%
              </span>
              <span style={{ fontSize: 12, color: "#aaa", marginLeft: 4 }}>
                (CGST {Number(cgst).toFixed(2)}% + SGST{" "}
                {Number(sgst).toFixed(2)}%)
              </span>
            </div>

            <Field
              label="HSN Description *"
              error={errors.hsnDescription?.message}
            >
              <textarea
                {...register("hsnDescription")}
                style={{ ...inp, minHeight: 80, resize: "vertical" }}
                placeholder="e.g. Woven fabrics of cotton — plain weave, bleached"
              />
            </Field>
            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveHSN.isPending}
                style={{
                  background: saveHSN.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveHSN.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveHSN.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveHSN.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update HSN Code"
                  : "Create HSN Code"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All HSN Codes
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {hsnCodes.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading HSN Codes…
            </p>
          </div>
        ) : hsnCodes.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-receipt"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No HSN Codes added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first HSN Code
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {[
                    "#",
                    "HSN Code",
                    "Description",
                    "CGST",
                    "SGST",
                    "Total GST",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hsnCodes.map((h: any, idx: number) => {
                  const total = (
                    Number(h.cgst || 0) + Number(h.sgst || 0)
                  ).toFixed(2);
                  return (
                    <tr
                      key={h.taxHSNCodeId ?? idx}
                      className="tbl-row"
                      style={{ borderBottom: "1px solid #f5f5f5" }}
                    >
                      <td
                        style={{
                          padding: "13px 16px",
                          color: "#bbb",
                          fontWeight: 500,
                          fontSize: 12,
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <i
                              className="bi bi-receipt"
                              style={{ color: "#999", fontSize: 14 }}
                            />
                          </div>
                          <code
                            style={{
                              background: "#f5f5f5",
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              color: "#555",
                              fontFamily: "monospace",
                              fontWeight: 700,
                            }}
                          >
                            {h.hsnCode || "—"}
                          </code>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "13px 16px",
                          color: "#777",
                          maxWidth: 260,
                        }}
                      >
                        {h.hsnDescription ? (
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {h.hsnDescription}
                          </span>
                        ) : (
                          <span style={{ color: "#ccc" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span
                          style={{
                            background: "#1565c018",
                            color: "#1565c0",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {Number(h.cgst || 0)}%
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span
                          style={{
                            background: "#6a1f7a18",
                            color: "#6a1f7a",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {Number(h.sgst || 0)}%
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span
                          style={{
                            background: "#e8f5e9",
                            color: "#2e7d32",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {total}%
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="action-btn"
                            onClick={() => openEdit(h)}
                            style={{
                              background: "#f0f0f0",
                              border: "none",
                              padding: "7px 12px",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 12,
                              fontFamily: "inherit",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              color: "#333",
                            }}
                          >
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => setDeleteId(h.taxHSNCodeId)} // ← fixed field name
                            style={{
                              background: "#ffebee",
                              color: "#c62828",
                              border: "none",
                              padding: "7px 10px",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete HSN Code?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The HSN Code will be permanently
                removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteHSN.mutate(deleteId)}
                disabled={deleteHSN.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteHSN.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Supplier Info Section ─────────────────────────────────────────────────────
const supplierInfoSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  supplierAddress: z.string().min(1, "Supplier address is required"),
  supplierGSTAmount: z.coerce.number().min(0, "GST amount is required"),
  supplierGSTNumber: z.string().optional().nullable(),
});
type SupplierInfoForm = z.infer<typeof supplierInfoSchema>;
function AdminSupplierInfo() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  const { data, isLoading } = useQuery({
    queryKey: ["supplierInfo"],
    queryFn: () =>
      api
        .get("/SupplierInfo/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const supplierInfo: any[] = data || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SupplierInfoForm>({
    resolver: zodResolver(supplierInfoSchema) as Resolver<SupplierInfoForm>,
  });

  const openCreate = () => {
    setEditItem(null);
    reset({
      supplierName: "",
      supplierAddress: "",
      supplierGSTAmount: 0,
      supplierGSTNumber: "",
    });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("supplierName", item.supplierName ?? "");
    setValue("supplierAddress", item.supplierAddress ?? "");
    setValue("supplierGSTAmount", parseFloat(item.supplierGSTAmount) || 0);
    setValue("supplierGSTNumber", item.supplierGSTNumber ?? "");
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("supplier-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  const SaveSupplier = useMutation({
    mutationFn: (formData: SupplierInfoForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/SupplierInfo/${current.supplierInfoId}/`, formData)
            .then((r) => r.data)
        : api.post("/SupplierInfo/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current ? "Supplier updated!" : "Supplier created!",
      );
      qc.invalidateQueries({ queryKey: ["supplierInfo"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save supplier"),
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: number) => api.delete(`/SupplierInfo/${id}/`),
    onSuccess: () => {
      toast.success("Supplier deleted");
      qc.invalidateQueries({ queryKey: ["supplierInfo"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete supplier"),
  });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Supplier Info
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage supplier information across products
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Supplier
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="supplier-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-building"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit Supplier" : "Create New Supplier"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.supplierName}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data: SupplierInfoForm) =>
              SaveSupplier.mutate(data),
            )}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field
                label="Supplier Name *"
                error={errors.supplierName?.message}
              >
                <input
                  {...register("supplierName")}
                  style={inp}
                  placeholder="e.g. Eshwaran Textiles"
                  autoFocus
                />
              </Field>
              <Field
                label="Supplier Address *"
                error={errors.supplierAddress?.message}
              >
                <input
                  {...register("supplierAddress")}
                  style={inp}
                  placeholder="e.g. 12, GST Road, Chennai"
                />
              </Field>
              <Field
                label="Supplier GST Amount *"
                error={errors.supplierGSTAmount?.message}
              >
                <input
                  {...register("supplierGSTAmount")}
                  type="number"
                  step="any"
                  min="0"
                  style={inp}
                  placeholder="e.g. 18.00"
                />
              </Field>
            </div>
            <Field
              label="Supplier GST Number"
              error={errors.supplierGSTNumber?.message}
            >
              <input
                {...register("supplierGSTNumber")}
                style={inp}
                placeholder="e.g. 29ABCDE1234F1Z5"
              />
            </Field>
            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={SaveSupplier.isPending}
                style={{
                  background: SaveSupplier.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: SaveSupplier.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {SaveSupplier.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {SaveSupplier.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Supplier"
                  : "Create Supplier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Suppliers
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {supplierInfo.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading suppliers…
            </p>
          </div>
        ) : supplierInfo.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-building"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No suppliers added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first Supplier
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {[
                    "#",
                    "Supplier Name",
                    "Address",
                    "GST Amount",
                    "GST Number",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierInfo.map((s: any, idx: number) => (
                  <tr
                    key={s.supplierInfoId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-building"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {s.supplierName}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {s.supplierAddress || "—"}
                      </code>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {s.supplierGSTAmount != null ? (
                        <span
                          style={{
                            background: "#e8f4fd",
                            color: "#1565c0",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {parseFloat(s.supplierGSTAmount).toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", color: "#777" }}>
                      {s.supplierGSTNumber ? (
                        <span>{s.supplierGSTNumber}</span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(s)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(s.supplierInfoId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Supplier?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The supplier will be permanently
                removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSupplier.mutate(deleteId!)}
                disabled={deleteSupplier.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteSupplier.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shipping Type Section ─────────────────────────────────────────────────────
const shippingTypeSchema = z.object({
  shippingTypeName: z.string().min(1, "Shipping type name is required"),
});
type ShippingTypeForm = z.infer<typeof shippingTypeSchema>;

function AdminShippingType() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["shippingType"],
    queryFn: () =>
      api
        .get("/ShippingType/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const shippingTypes: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ShippingTypeForm>({ resolver: zodResolver(shippingTypeSchema) });

  const openCreate = () => {
    setEditItem(null);
    reset({ shippingTypeName: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("shippingTypeName", item.shippingTypeName ?? ""); // ✅ Fix 4
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("shipping-type-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveShippingType = useMutation({
    mutationFn: (formData: ShippingTypeForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/ShippingType/${current.shippingTypeId}/`, formData)
            .then((r) => r.data) // ✅ Fix 1
        : api.post("/ShippingType/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current
          ? "Shipping type updated!"
          : "Shipping type created!",
      );
      qc.invalidateQueries({ queryKey: ["shippingType"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save shipping type"),
  });

  const deleteShippingType = useMutation({
    mutationFn: (id: number) => api.delete(`/ShippingType/${id}/`),
    onSuccess: () => {
      toast.success("Shipping type deleted");
      qc.invalidateQueries({ queryKey: ["shippingType"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete shipping type"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Shipping Types
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage shipping types across products
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Shipping Type
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="shipping-type-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-truck"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit Shipping Type" : "Create New Shipping Type"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.shippingTypeName}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data) => saveShippingType.mutate(data))}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field
                label="Shipping Type Name *"
                error={errors.shippingTypeName?.message}
              >
                <input
                  {...register("shippingTypeName")}
                  style={inp}
                  placeholder="e.g. Express, Standard, Overnight"
                  autoFocus
                />
              </Field>
            </div>
            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveShippingType.isPending}
                style={{
                  background: saveShippingType.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveShippingType.isPending
                    ? "not-allowed"
                    : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveShippingType.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveShippingType.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Shipping Type"
                  : "Create Shipping Type"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Shipping Types
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {shippingTypes.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading shipping types…
            </p>
          </div>
        ) : shippingTypes.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-truck"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No shipping types added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first Shipping Type
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {["#", "Shipping Type Name", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shippingTypes.map((s: any, idx: number) => (
                  <tr
                    key={s.shippingTypeId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-truck"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {s.shippingTypeName} {/* ✅ Fix 2 */}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(s)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(s.shippingTypeId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Shipping Type?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The shipping type will be
                permanently removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteShippingType.mutate(deleteId!)}
                disabled={deleteShippingType.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteShippingType.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Packaging Template Section ─────────────────────────────────────────────────────
const packagingTemplateSchema = z.object({
  packageName: z.string().min(1, "Package template name is required"),
});
type PackagingTemplateForm = z.infer<typeof packagingTemplateSchema>;

function AdminPackagingTemplates() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["packagingTemplates"],
    queryFn: () =>
      api
        .get("/PackagingTemplates/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const packagingTemplates: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PackagingTemplateForm>({
    resolver: zodResolver(packagingTemplateSchema),
  });

  const openCreate = () => {
    setEditItem(null);
    reset({ packageName: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("packageName", item.packageName ?? "");
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("packaging-template-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const savePackagingTemplate = useMutation({
    mutationFn: (formData: PackagingTemplateForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/PackagingTemplates/${current.packageId}/`, {
              ...formData,
              packageId: current.packageId, // ← add this
            })
            .then((r) => r.data)
        : api.post("/PackagingTemplates/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current
          ? "Packaging template updated!"
          : "Packaging template created!",
      );
      qc.invalidateQueries({ queryKey: ["packagingTemplates"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail || "Failed to save packaging template",
      ),
  });

  const deletePackagingTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/PackagingTemplates/${id}/`),
    onSuccess: () => {
      toast.success("Packaging template deleted");
      qc.invalidateQueries({ queryKey: ["packagingTemplates"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete packaging template"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Packaging Templates
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage packaging templates across products
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Packaging Template
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="packaging-template-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-box-seam"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem
                    ? "Edit Packaging Template"
                    : "Create New Packaging Template"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.packageName}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data) =>
              savePackagingTemplate.mutate(data),
            )}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field
                label="Package Template Name *"
                error={errors.packageName?.message}
              >
                <input
                  {...register("packageName")}
                  style={inp}
                  placeholder="e.g. Small Box, Bubble Wrap, Pallet"
                  autoFocus
                />
              </Field>
            </div>
            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savePackagingTemplate.isPending}
                style={{
                  background: savePackagingTemplate.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: savePackagingTemplate.isPending
                    ? "not-allowed"
                    : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {savePackagingTemplate.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {savePackagingTemplate.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Template"
                  : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Packaging Templates
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {packagingTemplates.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading packaging templates…
            </p>
          </div>
        ) : packagingTemplates.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-box-seam"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No packaging templates added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first Packaging Template
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {["#", "Package Template Name", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packagingTemplates.map((p: any, idx: number) => (
                  <tr
                    key={p.packageId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-box-seam"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {p.packageName}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(p)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(p.packageId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Packaging Template?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The packaging template will be
                permanently removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deletePackagingTemplate.mutate(deleteId!)}
                disabled={deletePackagingTemplate.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deletePackagingTemplate.isPending
                  ? "Deleting…"
                  : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Country Section ─────────────────────────────────────────────────────────────
const countrySchema = z.object({
  countryName: z.string().min(1, "Country name is required"),
  countryCode: z.string().min(1, "Country code is required"),
});
type countryInfoForm = z.infer<typeof countrySchema>;

function AdminCountry() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["countryInfo"],
    queryFn: () =>
      api
        .get("/Country/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const countryInfo: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<countryInfoForm>({ resolver: zodResolver(countrySchema) });

  const openCreate = () => {
    setEditItem(null);
    reset({ countryName: "", countryCode: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("countryName", item.countryName);
    setValue("countryCode", item.countryCode);
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("fabric-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveFabric = useMutation({
    mutationFn: (formData: countryInfoForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/Country/${current.countryId}/`, formData)
            .then((r) => r.data)
        : api.post("/Country/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current ? "Country updated!" : "Country created!",
      );
      qc.invalidateQueries({ queryKey: ["countryInfo"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save country"),
  });

  const deleteCountry = useMutation({
    mutationFn: (id: number) => api.delete(`/Country/${id}/`),
    onSuccess: () => {
      toast.success("Country deleted");
      qc.invalidateQueries({ queryKey: ["countryInfo"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete country"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Countries
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage country information
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Country
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="country-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-stack"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit Country" : "Create New Country"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.name}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => saveFabric.mutate(data))}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field label="Country Name *" error={errors.countryName?.message}>
                <input
                  {...register("countryName")}
                  style={inp}
                  placeholder="e.g. United States, Canada, Mexico"
                  autoFocus
                />
              </Field>
              <Field label="Country Code *" error={errors.countryCode?.message}>
                <input
                  {...register("countryCode")}
                  style={inp}
                  placeholder="e.g. US, CA, MX"
                />
              </Field>
            </div>

            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveFabric.isPending}
                style={{
                  background: saveFabric.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveFabric.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveFabric.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveFabric.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Fabric"
                  : "Create Fabric"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Countries
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {countryInfo.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading countries…
            </p>
          </div>
        ) : countryInfo.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-stack"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No countries added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first country
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {["#", "Country Name", "Country Code", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countryInfo.map((c: any, idx: number) => (
                  <tr
                    key={c.countryId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-flag"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {c.countryName}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {c.countryCode || "—"}
                      </code>
                    </td>

                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(c)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(c.countryId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Fabric?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The fabric will be permanently
                removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCountry.mutate(deleteId!)}
                disabled={deleteCountry.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteCountry.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//---------------------------end-Country----------------------------

//---------------------State------------------------------------

const StateSchema = z.object({
  stateName: z.string().min(1, "State name is required"),
  stateCode: z.string().min(1, "State code is required"),
});
type stateForm = z.infer<typeof StateSchema>;

function AdminState() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["stateInfo"],
    queryFn: () =>
      api
        .get("/State/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const stateInfo: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<stateForm>({ resolver: zodResolver(StateSchema) });

  const openCreate = () => {
    setEditItem(null);
    reset({ stateName: "", stateCode: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("stateName", item.stateName);
    setValue("stateCode", item.stateCode);
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("state-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveState = useMutation({
    mutationFn: (formData: stateForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/State/${current.stateId}/`, {
              ...formData,
              stateId: current.stateId, // ← add if schema requires it
            })
            .then((r) => r.data)
        : api.post("/State/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(editItemRef.current ? "State updated!" : "State created!");
      qc.invalidateQueries({ queryKey: ["stateInfo"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to save state"),
  });

  const deleteState = useMutation({
    mutationFn: (id: number) => api.delete(`/State/${id}/`),
    onSuccess: () => {
      toast.success("State deleted");
      qc.invalidateQueries({ queryKey: ["stateInfo"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete state"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>States</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage state information
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add State
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="state-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-stack"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem ? "Edit State" : "Create New State"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.stateName}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit((data) => saveState.mutate(data))}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field label="State Name *" error={errors.stateName?.message}>
                <input
                  {...register("stateName")}
                  style={inp}
                  placeholder="e.g. California, Texas, Florida"
                  autoFocus
                />
              </Field>
              <Field label="State Code *" error={errors.stateCode?.message}>
                <input
                  {...register("stateCode")}
                  style={inp}
                  placeholder="e.g. US, CA, MX"
                />
              </Field>
            </div>

            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveState.isPending}
                style={{
                  background: saveState.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveState.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveState.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveState.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update State"
                  : "Create State"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All States
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {stateInfo.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading states…
            </p>
          </div>
        ) : stateInfo.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-stack"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No states added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first state
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {["#", "State Name", "State Code", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stateInfo.map((s: any, idx: number) => (
                  <tr
                    key={s.state_Id ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-stack"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {s.stateName}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {s.stateCode || "—"}
                      </code>
                    </td>

                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(s)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(s.stateId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Fabric?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The fabric will be permanently
                removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteState.mutate(deleteId!)}
                disabled={deleteState.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteState.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//---------------------------end-State----------------------------

//------------------------Message Templates----------------------------
const messageTemplateSchema = z.object({
  messageType: z.string().min(1, "Message type is required"),
  messageContent: z.string().min(1, "Message content is required"),
  dltId: z.string().min(1, "DLT ID is required"),
  templateId: z.string().min(1, "Template ID is required"),
});
type MessageTemplateForm = z.infer<typeof messageTemplateSchema>;

function AdminMessageTemplate() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const editItemRef = useRef<any>(null);
  useEffect(() => {
    editItemRef.current = editItem;
  }, [editItem]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["messageTemplateInfo"],
    queryFn: () =>
      api
        .get("/MessageTemplate/", { params: { "Page.Size": 200 } })
        .then((r) => r.data?.list || r.data || []),
  });
  const messageTemplates: any[] = data || [];

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MessageTemplateForm>({
    resolver: zodResolver(messageTemplateSchema),
  });

  const openCreate = () => {
    setEditItem(null);
    reset({ messageType: "", messageContent: "", dltId: "", templateId: "" });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setValue("messageType", item.messageType);
    setValue("messageContent", item.messageContent);
    setValue("dltId", item.dltId);
    setValue("templateId", item.templateId);
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("message-template-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveTemplate = useMutation({
    mutationFn: (formData: MessageTemplateForm) => {
      const current = editItemRef.current;
      return current
        ? api
            .put(`/MessageTemplate/${current.messageTemplateId}/`, {
              ...formData,
              messageTemplateId: current.messageTemplateId, // ← add this
            })
            .then((r) => r.data)
        : api.post("/MessageTemplate/", formData).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(
        editItemRef.current
          ? "Message template updated!"
          : "Message template created!",
      );
      qc.invalidateQueries({ queryKey: ["messageTemplateInfo"] });
      cancelForm();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.detail || "Failed to save message template",
      ),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/MessageTemplate/${id}/`),
    onSuccess: () => {
      toast.success("Message template deleted");
      qc.invalidateQueries({ queryKey: ["messageTemplateInfo"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete message template"),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Message Templates
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Manage message templates
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" /> Add Message Template
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          id="message-template-form"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            padding: 28,
            marginBottom: 24,
            animation: "fadeIn .2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "#111",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="bi bi-chat-text"
                  style={{ color: "#fff", fontSize: 16 }}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editItem
                    ? "Edit Message Template"
                    : "Create New Message Template"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                  {editItem
                    ? `Editing: ${editItem.messageType}`
                    : "Fill in the details below"}
                </p>
              </div>
            </div>
            <button
              onClick={cancelForm}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#999",
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data: MessageTemplateForm) =>
              saveTemplate.mutate(data),
            )}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0 24px",
              }}
            >
              <Field label="Message Type *" error={errors.messageType?.message}>
                <input
                  {...register("messageType")}
                  style={inp}
                  placeholder="e.g. SMS, Email, WhatsApp"
                  autoFocus
                />
              </Field>
              <Field label="DLT ID *" error={errors.dltId?.message}>
                <input
                  {...register("dltId")}
                  style={inp}
                  placeholder="e.g. 1234567890"
                />
              </Field>
              <Field label="Template ID *" error={errors.templateId?.message}>
                <input
                  {...register("templateId")}
                  style={inp}
                  placeholder="e.g. TMP001"
                />
              </Field>
              <Field
                label="Message Content *"
                error={errors.messageContent?.message}
              >
                <textarea
                  {...register("messageContent")}
                  style={{ ...inp, height: 80, resize: "vertical" }}
                  placeholder="Enter message content here…"
                />
              </Field>
            </div>

            <div
              style={{ borderTop: "1px solid #f0f0f0", margin: "12px 0 20px" }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: "#f5f5f5",
                  color: "#444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveTemplate.isPending}
                style={{
                  background: saveTemplate.isPending ? "#555" : "#111",
                  color: "#fff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 6,
                  cursor: saveTemplate.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saveTemplate.isPending && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                )}
                {saveTemplate.isPending
                  ? "Saving…"
                  : editItem
                  ? "Update Template"
                  : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-list-ul" style={{ color: "#888" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              All Message Templates
            </span>
            {!isLoading && (
              <span
                style={{
                  background: "#f0f0f0",
                  color: "#666",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {messageTemplates.length}
              </span>
            )}
          </div>
          {showForm && (
            <button
              onClick={openCreate}
              style={{
                background: "none",
                color: "#6A012A",
                border: "1px solid #6A012A",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="bi bi-plus" /> New
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #f0f0f0",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
              Loading message templates…
            </p>
          </div>
        ) : messageTemplates.length === 0 ? (
          <div
            style={{ padding: "60px 24px", textAlign: "center", color: "#bbb" }}
          >
            <i
              className="bi bi-chat-text"
              style={{ fontSize: 40, display: "block", marginBottom: 12 }}
            />
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              No message templates added yet.
            </p>
            <button
              onClick={openCreate}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Add your first Message Template
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    background: "#fafafa",
                    borderBottom: "2px solid #f0f0f0",
                  }}
                >
                  {[
                    "#",
                    "Message Type",
                    "DLT ID",
                    "Template ID",
                    "Message Content",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#888",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messageTemplates.map((m: any, idx: number) => (
                  <tr
                    key={m.messageTemplateId ?? idx}
                    className="tbl-row"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#bbb",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "#f5f5f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className="bi bi-chat-text"
                            style={{ color: "#999", fontSize: 14 }}
                          />
                        </div>
                        {m.messageType}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {m.dltId || "—"}
                      </code>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code
                        style={{
                          background: "#f5f5f5",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#555",
                          fontFamily: "monospace",
                        }}
                      >
                        {m.templateId || "—"}
                      </code>
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#555",
                        maxWidth: 260,
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.messageContent || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="action-btn"
                          onClick={() => openEdit(m)}
                          style={{
                            background: "#f0f0f0",
                            border: "none",
                            padding: "7px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#333",
                          }}
                        >
                          <i className="bi bi-pencil" /> Edit
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setDeleteId(m.messageTemplateId)}
                          style={{
                            background: "#ffebee",
                            color: "#c62828",
                            border: "none",
                            padding: "7px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              animation: "fadeIn .15s ease",
              boxShadow: "0 8px 32px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: "#ffebee",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <i
                  className="bi bi-trash"
                  style={{ fontSize: 22, color: "#c62828" }}
                />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
                Delete Message Template?
              </h3>
              <p style={{ margin: 0, color: "#777", fontSize: 13 }}>
                This action cannot be undone. The message template will be
                permanently removed.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTemplate.mutate(deleteId!)}
                disabled={deleteTemplate.isPending}
                style={{
                  flex: 1,
                  background: "#c62828",
                  color: "#fff",
                  border: "none",
                  padding: "11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {deleteTemplate.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//---------------------------end-Message Templates----------------------------

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  {
    key: "brnd",
    label: "Brands",
    icon: "bi bi-bookmark-star",
    component: <AdminBrands />,
  },
  {
    key: "size",
    label: "Sizes",
    icon: "bi bi-rulers",
    component: <AdminSizes />,
  },
  {
    key: "fabric",
    label: "Fabrics",
    icon: "bi-stack",
    component: <AdminFabric />,
  },
  {
    key: "hsn",
    label: "Tax HSN Codes",
    icon: "bi-receipt",
    component: <AdminTaxHSNCode />,
  },
  {
    key: "sup",
    label: "Suppliers Info",
    icon: "bi-truck",
    component: <AdminSupplierInfo />,
  },
  {
    key: "ship",
    label: "Shipping Types",
    icon: "bi bi-tags",
    component: <AdminShippingType />,
  },
  {
    key: "pack",
    label: "Packaging Templates",
    icon: "bi bi-box-seam",
    component: <AdminPackagingTemplates />,
  },
  {
    key: "country",
    label: "Countries",
    icon: "bi bi-flag",
    component: <AdminCountry />,
  },
  {
    key: "state",
    label: "States",
    icon: "bi bi-geo-alt",
    component: <AdminState />,
  },
  {
    key: "msg",
    label: "Message Templates",
    icon: "bi bi-chat-text",
    component: <AdminMessageTemplate />,
  },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function AdminMDM() {
  const [activeTab, setActiveTab] = useState<TabKey>("fabric");
  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <div style={{ padding: "0 0 40px" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .tbl-row:hover    { background: #fafafa !important; }
        .action-btn       { transition: opacity .15s; }
        .action-btn:hover { opacity: .8; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Master Data Management
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          Configure fabric types and tax HSN codes
        </p>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "#f5f5f5",
          padding: 4,
          borderRadius: 10,
          marginBottom: 28,
          width: "fit-content",
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: isActive ? "#fff" : "rgb(106, 1, 42)",
                color: isActive ? "#111" : "#fff",
                border: "none",
                padding: "9px 8px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 3,
                transition: "all .15s",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,.10)" : "none",
              }}
            >
              <i className={`bi ${tab.icon}`} style={{ fontSize: 14 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div key={activeTab} style={{ animation: "fadeIn .18s ease" }}>
        {active.component}
      </div>
    </div>
  );
}
