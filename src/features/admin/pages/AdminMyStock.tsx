import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";

export default function AdminMyStock() {
  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["my-stock"],
    queryFn: () => api.get("/Billing/inventory").then((res) => res.data),
  });

  if (isLoading) return <div style={{ padding: 20 }}>Loading stock...</div>;
  if (error) return <div style={{ padding: 20 }}>Failed to load stock.</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>My Stock</h2>
      <p>Inventory assigned to your location.</p>

      {inventory?.length === 0 ? (
        <div className="alert alert-info mt-4">No stock assigned to your location yet.</div>
      ) : (
        <div className="table-responsive mt-4">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Stock ID</th>
                <th>Location</th>
                <th>Quantity</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {inventory?.map((inv: any) => (
                <tr key={inv.inventoryId}>
                  <td>{inv.stockId}</td>
                  <td>{inv.locationName} ({inv.locationType})</td>
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
