import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminStores() {
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [phone, setPhone] = useState("");
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
      setCity("");
      setState("");
      setPinCode("");
      setPhone("");
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
      city,
      state,
      pinCode,
      phone,
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
              <label>Address</label>
              <input
                type="text"
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>City</label>
                <input
                  type="text"
                  className="form-control"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>State</label>
                <input
                  type="text"
                  className="form-control"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Pincode</label>
                <input
                  type="text"
                  className="form-control"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            
            <hr style={{ margin: "5px 0" }} />
            <h5>Store Login Credentials (Optional)</h5>
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
                    <th>Name</th>
                    <th>Address</th>
                    <th>City / State</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {stores?.map((s: any) => (
                    <tr key={s.storeId}>
                      <td>{s.storeId}</td>
                      <td>{s.storeName}</td>
                      <td>{s.address}</td>
                      <td>{s.city}, {s.state} - {s.pinCode}</td>
                      <td>{s.phone}</td>
                    </tr>
                  ))}
                  {stores?.length === 0 && (
                    <tr><td colSpan={5} className="text-center">No stores found.</td></tr>
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
