import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminAssignStock() {
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [locationType, setLocationType] = useState<"store" | "warehouse">("store");
  const [locationId, setLocationId] = useState("");
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get("/Billing/stores").then((res) => res.data),
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/Billing/warehouses").then((res) => res.data),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => api.post("/Billing/inventory/assign", payload),
    onSuccess: () => {
      toast.success("Stock assigned successfully");
      setStockId("");
      setQuantity("");
      setLocationId("");
      queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to assign stock");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockId || !quantity || !locationId) return toast.error("Please fill all fields");

    assignMutation.mutate({
      stockId,
      quantity: parseInt(quantity, 10),
      storeId: locationType === "store" ? parseInt(locationId, 10) : undefined,
      warehouseId: locationType === "warehouse" ? parseInt(locationId, 10) : undefined,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Assign Stock to Location</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15, maxWidth: 400, marginTop: 20 }}>
        <div>
          <label>Stock ID (SKU)</label>
          <input
            type="text"
            className="form-control"
            value={stockId}
            onChange={(e) => setStockId(e.target.value)}
            placeholder="e.g. SKU-123"
            required
          />
        </div>
        <div>
          <label>Quantity</label>
          <input
            type="number"
            className="form-control"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="1"
          />
        </div>
        <div>
          <label>Location Type</label>
          <select className="form-control" value={locationType} onChange={(e) => setLocationType(e.target.value as any)}>
            <option value="store">Store</option>
            <option value="warehouse">Warehouse</option>
          </select>
        </div>
        <div>
          <label>Select {locationType === "store" ? "Store" : "Warehouse"}</label>
          <select className="form-control" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
            <option value="">-- Select --</option>
            {locationType === "store"
              ? stores?.map((s: any) => (
                  <option key={s.storeId} value={s.storeId}>{s.storeName || `Store ${s.storeId}`}</option>
                ))
              : warehouses?.map((w: any) => (
                  <option key={w.warehouseId} value={w.warehouseId}>{w.warehouseName}</option>
                ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={assignMutation.isPending}>
          {assignMutation.isPending ? "Assigning..." : "Assign Stock"}
        </button>
      </form>
    </div>
  );
}
