import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminWarehouses() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const queryClient = useQueryClient();

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/Billing/warehouses").then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/Billing/warehouses", payload),
    onSuccess: () => {
      toast.success("Warehouse created successfully");
      setName("");
      setAddress("");
      setPhone("");
      setLoginEmail("");
      setLoginPassword("");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create warehouse");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Name is required");

    createMutation.mutate({
      warehouseName: name,
      address,
      contactPhone: phone,
      loginEmail,
      loginPassword,
      isActive: true,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Manage Warehouses</h2>
      
      <div style={{ display: "flex", gap: 40, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h4>Add New Warehouse</h4>
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
              <label>Address</label>
              <textarea
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label>Contact Phone</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            
            <hr style={{ margin: "5px 0" }} />
            <h5>Warehouse Login Credentials (Optional)</h5>
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
              {createMutation.isPending ? "Creating..." : "Create Warehouse"}
            </button>
          </form>
        </div>

        <div style={{ flex: "2 1 500px" }}>
          <h4>Existing Warehouses</h4>
          {isLoading ? <p>Loading...</p> : (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses?.map((w: any) => (
                    <tr key={w.warehouseId}>
                      <td>{w.warehouseId}</td>
                      <td>{w.warehouseName}</td>
                      <td>{w.address}</td>
                      <td>{w.contactPhone}</td>
                    </tr>
                  ))}
                  {warehouses?.length === 0 && (
                    <tr><td colSpan={4} className="text-center">No warehouses found.</td></tr>
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
