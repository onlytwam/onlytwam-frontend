import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminWarehouses() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [editingId, setEditingId] = useState<number | null>(null);

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
    mutationFn: (payload: any) => api.put(/Billing/warehouses/\, payload),
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
  };

  const handleEdit = (wh: any) => {
    setEditingId(wh.id || wh.warehouseId);
    setName(wh.name || wh.warehouseName || "");
    setAddress(wh.address || "");
    setLoginEmail(wh.loginEmail || "");
    setLoginPassword(""); // Don't pre-fill password
  };

  const toggleActive = (wh: any) => {
    const id = wh.id || wh.warehouseId;
    api.put(/Billing/warehouses/\, {
      isActive: !wh.isActive
    }).then(() => {
      toast.success(Warehouse \);
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    }).catch((err) => {
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
      <h2>Manage Warehouses</h2>

      <div style={{ display: "flex", gap: 40, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h4>{editingId ? "Edit Warehouse" : "Add New Warehouse"}</h4>
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
              <label>Login Password {editingId && "(Leave blank to keep current)"}</label>
              <input
                type="text"
                className="form-control"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingId ? "Update Warehouse" : "Create Warehouse")}
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
          <h4>Existing Warehouses</h4>
          {isLoading ? <p>Loading...</p> : (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Warehouse Name</th>
                    <th>Address</th>
                    <th>Login Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses?.map((w: any) => (
                    <tr key={w.id || w.warehouseId}>
                      <td>{w.id || w.warehouseId}</td>
                      <td>{w.name || w.warehouseName}</td>
                      <td>{w.address}</td>
                      <td>{w.loginEmail || "-"}</td>
                      <td>
                        <span className={adge \}>
                          {w.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(w)}>
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          <button className={tn btn-sm \} onClick={() => toggleActive(w)}>
                            {w.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {warehouses?.length === 0 && (
                    <tr><td colSpan={6} className="text-center">No warehouses found.</td></tr>
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
