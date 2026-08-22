import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";

export default function AdminMyStock() {
  const [search, setSearch] = useState("");
  
  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["my-stock"],
    queryFn: () => api.get("/Billing/inventory").then((res) => res.data),
  });

  if (isLoading) return <div style={{ padding: 20 }}>Loading stock...</div>;
  if (error) return <div style={{ padding: 20 }}>Failed to load stock.</div>;

  const filtered = (inventory || []).filter((inv: any) => 
    (inv.productName || "").toLowerCase().includes(search.toLowerCase()) || 
    (inv.stockId || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.productCode || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 20 }}>
      <h2>My Stock</h2>
      <p>Inventory assigned to your location. (Read-only)</p>

      <div style={{ marginBottom: 20, maxWidth: 300 }}>
        <input 
          className="form-control" 
          placeholder="Search by product name, code, or Stock ID" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {filtered.length === 0 ? (
        <div className="alert alert-info mt-4">No stock found for your search.</div>
      ) : (
        <div className="table-responsive mt-4">
          <table className="table table-bordered table-striped bg-white">
            <thead className="table-light">
              <tr>
                <th>Product Name</th>
                <th>Code</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Stock ID</th>
                <th>Location</th>
                <th>Total Qty</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv: any) => (
                <tr key={inv.inventoryId}>
                  <td>{inv.productName}</td>
                  <td>{inv.productCode}</td>
                  <td>{inv.colorName || "-"}</td>
                  <td>{inv.sizeName || "-"}</td>
                  <td><strong>{inv.stockId}</strong></td>
                  <td>{inv.locationName}</td>
                  <td>{inv.quantity}</td>
                  <td>{inv.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
