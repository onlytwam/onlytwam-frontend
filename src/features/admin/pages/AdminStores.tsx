import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminStores() {
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingPasswordId, setViewingPasswordId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: storesResponse, isLoading } = useQuery({
    queryKey: ["stores-list"],
    queryFn: () => api.get("/Stores").then((res) => res.data),
  });
  
  const stores = storesResponse?.list || [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/Stores", payload),
    onSuccess: () => {
      toast.success("Store created successfully");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["stores-list"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create store");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/Stores/${editingId}`, payload),
    onSuccess: () => {
      toast.success("Store updated successfully");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["stores-list"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update store");
    },
  });

  const resetForm = () => {
    setStoreName("");
    setAddress("");
    setLoginEmail("");
    setLoginPassword("");
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (store: any) => {
    setEditingId(store.storeId);
    setStoreName(store.storeName || "");
    setAddress(store.address || "");
    setLoginEmail(store.loginEmail || "");
    setLoginPassword(store.loginPassword || "");
    setIsFormOpen(true);
  };

  const toggleActive = (store: any) => {
    api.put(`/Stores/${store.storeId}`, {
      storeId: store.storeId,
      isActive: !store.isActive
    }).then(() => {
      toast.success(`Store ${store.isActive ? 'deactivated' : 'activated'}`);
      queryClient.invalidateQueries({ queryKey: ["stores-list"] });
    }).catch((err: any) => {
      toast.error(err.response?.data?.detail || "Failed to toggle status");
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName) return toast.error("Store Name is required");

    if (editingId) {
      updateMutation.mutate({
        storeId: editingId,
        storeName,
        address,
        loginEmail,
        loginPassword,
      });
    } else {
      createMutation.mutate({
        storeName,
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
        <h1 style={{ margin: 0 }}>Stores</h1>
        {!isFormOpen && (
          <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
            <i className="bi bi-plus-circle" /> New Store
          </button>
        )}
      </div>

      {isFormOpen ? (
        <div className="card shadow-sm" style={{ maxWidth: 600, margin: "0 auto 30px" }}>
          <div className="card-header">
            <h5 className="mb-0">{editingId ? "Edit Store" : "Add New Store"}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <label>Store Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
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
              <h5>Store Login Credentials</h5>
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
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingId ? "Update Store" : "Create Store")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        isLoading ? <p>Loading stores...</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {stores?.map((s: any) => (
              <div key={s.storeId} className="card shadow-sm h-100">
                <div className="card-body" style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <h5 className="card-title text-primary" style={{ fontWeight: 600 }}>{s.storeName}</h5>
                    <span className={`badge ${s.isActive ? 'bg-success' : 'bg-danger'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="card-text text-muted small mb-3">
                    <i className="bi bi-geo-alt-fill me-1" />
                    {s.address || "No address provided"}
                  </p>
                  
                  <div className="bg-light p-2 rounded mb-3" style={{ fontSize: "0.9rem" }}>
                    <strong>Login Details:</strong>
                    {s.loginEmail ? (
                      <div className="mt-1">
                        <div><i className="bi bi-envelope me-1" /> {s.loginEmail}</div>
                        <div className="mt-1">
                          <i className="bi bi-key me-1" />
                          {viewingPasswordId === s.storeId ? (
                            <span>{s.loginPassword || "(none)"}</span>
                          ) : (
                            <span>********</span>
                          )}
                          <button 
                            className="btn btn-link btn-sm p-0 ms-2 text-decoration-none"
                            onClick={() => setViewingPasswordId(viewingPasswordId === s.storeId ? null : s.storeId)}
                          >
                            {viewingPasswordId === s.storeId ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted mt-1">No login set</div>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-2" style={{ display: "flex", gap: 5, borderTop: "1px solid #eee" }}>
                    <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => handleEdit(s)}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className={`btn btn-sm flex-grow-1 ${s.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => toggleActive(s)}>
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-sm btn-outline-danger flex-grow-1" onClick={() => {
                      if(window.confirm('Are you sure you want to permanently delete this store?')) {
                        api.delete(`/Stores/${s.storeId}`).then(() => {
                          toast.success('Store deleted permanently');
                          queryClient.invalidateQueries({ queryKey: ["stores-list"] });
                        }).catch((err: any) => toast.error('Failed to delete store'));
                      }
                    }}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {stores?.length === 0 && (
              <div className="col-12 text-center py-5 text-muted">
                <i className="bi bi-shop display-4" />
                <p className="mt-3">No stores found. Click "New Store" to add one.</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}


