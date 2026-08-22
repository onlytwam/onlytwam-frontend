import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminStores() {
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
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
      setStoreName("");
      setAddress("");
      setLoginEmail("");
      setLoginPassword("");
      queryClient.invalidateQueries({ queryKey: ["stores-list"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create store");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName) return toast.error("Store Name is required");

    createMutation.mutate({
      storeName,
      address,
      loginEmail,
      loginPassword,
      isActive: true,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Manage Stores</h2>

      <div style={{ display: "flex", gap: 40, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h4>Add New Store</h4>
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

            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Store"}
            </button>
          </form>
        </div>

        <div style={{ flex: "2 1 500px" }}>
          <h4>Existing Stores</h4>
          {isLoading ? <p>Loading...</p> : (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Store Name</th>
                    <th>Address</th>
                    <th>Login Email</th>
                  </tr>
                </thead>
                <tbody>
                  {stores?.map((s: any) => (
                    <tr key={s.storeId}>
                      <td>{s.storeId}</td>
                      <td>{s.storeName}</td>
                      <td>{s.address}</td>
                      <td>{s.loginEmail || "-"}</td>
                    </tr>
                  ))}
                  {stores?.length === 0 && (
                    <tr><td colSpan={4} className="text-center">No stores found.</td></tr>
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
