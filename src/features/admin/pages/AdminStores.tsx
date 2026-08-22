import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminStores() {
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
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
    mutationFn: (payload: any) => api.put(/Stores/\, payload),
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
  };

  const handleEdit = (store: any) => {
    setEditingId(store.storeId);
    setStoreName(store.storeName || "");
    setAddress(store.address || "");
    setLoginEmail(store.loginEmail || "");
    setLoginPassword(store.loginPassword || "");
  };

  const toggleActive = (store: any) => {
    api.put(/Stores/\, {
      storeId: store.storeId,
      isActive: !store.isActive
    }).then(() => {
      toast.success(Store \);
      queryClient.invalidateQueries({ queryKey: ["stores-list"] });
    }).catch((err) => {
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
      <h2>Manage Stores</h2>

      <div style={{ display: "flex", gap: 40, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h4>{editingId ? "Edit Store" : "Add New Store"}</h4>
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

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingId ? "Update Store" : "Create Store")}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ flex: "2 1 600px" }}>
          <h4>Existing Stores</h4>
          {isLoading ? <p>Loading...</p> : (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Store Name</th>
                    <th>Address</th>
                    <th>Login Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores?.map((s: any) => (
                    <tr key={s.storeId}>
                      <td>{s.storeId}</td>
                      <td>{s.storeName}</td>
                      <td>{s.address}</td>
                      <td>
                        {s.loginEmail ? (
                          <div style={{ fontSize: "0.9rem" }}>
                            <div><strong>Email:</strong> {s.loginEmail}</div>
                            <div>
                              <strong>Password:</strong>{" "}
                              {viewingPasswordId === s.storeId ? (
                                <span>{s.loginPassword || "(none)"}</span>
                              ) : (
                                <span>********</span>
                              )}
                              <button 
                                className="btn btn-link btn-sm p-0 ms-2"
                                onClick={() => setViewingPasswordId(viewingPasswordId === s.storeId ? null : s.storeId)}
                              >
                                {viewingPasswordId === s.storeId ? "Hide" : "View"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">No login set</span>
                        )}
                      </td>
                      <td>
                        <span className={adge \}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(s)}>
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          <button className={tn btn-sm \} onClick={() => toggleActive(s)}>
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stores?.length === 0 && (
                    <tr><td colSpan={6} className="text-center">No stores found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
