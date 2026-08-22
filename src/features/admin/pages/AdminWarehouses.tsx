import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminWarehouses() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingPasswordId, setViewingPasswordId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/Billing/warehouses").then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/Billing/warehouses", payload),
    onSuccess: () => {
      toast.success("Warehouse created successfully");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create warehouse");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/Billing/warehouses/${editingId}`, payload),
    onSuccess: () => {
      toast.success("Warehouse updated successfully");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update warehouse");
    },
  });

  const resetForm = () => {
    setName("");
    setAddress("");
    setLoginEmail("");
    setLoginPassword("");
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (wh: any) => {
    setEditingId(wh.id || wh.warehouseId);
    setName(wh.name || wh.warehouseName || "");
    setAddress(wh.address || "");
    setLoginEmail(wh.loginEmail || "");
    setLoginPassword(wh.loginPassword || "");
    setIsFormOpen(true);
  };

  const toggleActive = (wh: any) => {
    const id = wh.id || wh.warehouseId;
    api.put(`/Billing/warehouses/${id}`, {
      isActive: !wh.isActive
    }).then(() => {
      toast.success(`Warehouse ${wh.isActive ? 'deactivated' : 'activated'}`);
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    }).catch((err: any) => {
      toast.error(err.response?.data?.detail || "Failed to toggle status");
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Warehouse Name is required");

    if (editingId) {
      updateMutation.mutate({
        warehouseName: name,
        address,
        loginEmail,
        loginPassword,
      });
    } else {
      createMutation.mutate({
        warehouseName: name,
        address,
        loginEmail,
        loginPassword,
        isActive: true,
      });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Warehouses</h1>
        {!isFormOpen && (
          <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
            <i className="bi bi-plus-circle" /> New Warehouse
          </button>
        )}
      </div>

      {isFormOpen ? (
        <div className="card shadow-sm" style={{ maxWidth: 600, margin: "0 auto 30px" }}>
          <div className="card-header">
            <h5 className="mb-0">{editingId ? "Edit Warehouse" : "Add New Warehouse"}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <label>Warehouse Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Address (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              
              <hr style={{ margin: "5px 0" }} />
              <h5>Warehouse Login Credentials</h5>
              <div>
                <label>Login Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div>
                <label>Login Password</label>
                <input
                  type="text"
                  className="form-control"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingId ? "Update Warehouse" : "Create Warehouse")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        isLoading ? <p>Loading warehouses...</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {warehouses?.map((w: any) => {
              const id = w.id || w.warehouseId;
              return (
              <div key={id} className="card shadow-sm h-100">
                <div className="card-body" style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <h5 className="card-title text-primary" style={{ fontWeight: 600 }}>{w.name || w.warehouseName}</h5>
                    <span className={`badge ${w.isActive ? 'bg-success' : 'bg-danger'}`}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="card-text text-muted small mb-3">
                    <i className="bi bi-geo-alt-fill me-1" />
                    {w.address || "No address provided"}
                  </p>
                  
                  <div className="bg-light p-2 rounded mb-3" style={{ fontSize: "0.9rem" }}>
                    <strong>Login Details:</strong>
                    {w.loginEmail ? (
                      <div className="mt-1">
                        <div><i className="bi bi-envelope me-1" /> {w.loginEmail}</div>
                        <div className="mt-1">
                          <i className="bi bi-key me-1" />
                          {viewingPasswordId === id ? (
                            <span>{w.loginPassword || "(none)"}</span>
                          ) : (
                            <span>********</span>
                          )}
                          <button 
                            className="btn btn-link btn-sm p-0 ms-2 text-decoration-none"
                            onClick={() => setViewingPasswordId(viewingPasswordId === id ? null : id)}
                          >
                            {viewingPasswordId === id ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted mt-1">No login set</div>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-2" style={{ display: "flex", gap: 10, borderTop: "1px solid #eee" }}>
                    <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => handleEdit(w)}>
                      <i className="bi bi-pencil" /> Edit
                    </button>
                    <button className={`btn btn-sm flex-grow-1 ${w.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => toggleActive(w)}>
                      {w.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            )})}
            {warehouses?.length === 0 && (
              <div className="col-12 text-center py-5 text-muted">
                <i className="bi bi-building display-4" />
                <p className="mt-3">No warehouses found. Click "New Warehouse" to add one.</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}


