import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toast } from "react-hot-toast";

export default function AdminAssignStock() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: matrixData, isLoading } = useQuery({
    queryKey: ["inventory-matrix", page, search],
    queryFn: () => api.get("/Billing/inventory/matrix", { params: { page, size: 50, search } }).then(res => res.data)
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => api.post("/Billing/inventory/assign", payload),
    onSuccess: () => {
      toast.success("Stock assigned successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-matrix"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to assign stock");
    }
  });

  const handleAssign = (stockId: string, locationType: "store" | "warehouse", locationId: number) => {
    const qtyStr = prompt(`Enter quantity to add to ${locationType} ${locationId} for Stock ${stockId}:`);
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return toast.error("Invalid quantity");

    assignMutation.mutate({
      stockId,
      quantity: qty,
      storeId: locationType === "store" ? locationId : undefined,
      warehouseId: locationType === "warehouse" ? locationId : undefined,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Assign Stock Matrix</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input 
          className="form-control" 
          placeholder="Search product or stock ID..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ maxWidth: 300 }}
        />
      </div>
      
      {isLoading ? <p>Loading matrix...</p> : (
        <div className="table-responsive" style={{ maxHeight: "70vh" }}>
          <table className="table table-bordered table-sm" style={{ whiteSpace: "nowrap" }}>
            <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <tr>
                <th>Product Name</th>
                <th>Code</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Stock ID</th>
                <th>Total Qty</th>
                {matrixData?.stores?.map((s: any) => (
                  <th key={`store-${s.id}`} className="bg-light text-primary">Store: {s.name}</th>
                ))}
                {matrixData?.warehouses?.map((w: any) => (
                  <th key={`wh-${w.id}`} className="bg-light text-success">WH: {w.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData?.list?.map((item: any) => (
                <tr key={item.productVariantDetailId}>
                  <td>{item.productName}</td>
                  <td>{item.productCode}</td>
                  <td>{item.colorName || "-"}</td>
                  <td>{item.sizeName || "-"}</td>
                  <td>{item.stockId}</td>
                  <td><strong>{item.totalAvailable}</strong></td>
                  {matrixData?.stores?.map((s: any) => {
                    const assigned = item.stores?.[s.id] || 0;
                    return (
                      <td key={`st-${s.id}`}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "space-between" }}>
                          <span>{assigned}</span>
                          <button 
                            className="btn btn-sm btn-outline-primary py-0 px-1"
                            onClick={() => handleAssign(item.stockId, "store", s.id)}
                            title="Add stock"
                          >+</button>
                        </div>
                      </td>
                    );
                  })}
                  {matrixData?.warehouses?.map((w: any) => {
                    const assigned = item.warehouses?.[w.id] || 0;
                    return (
                      <td key={`wh-${w.id}`}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "space-between" }}>
                          <span>{assigned}</span>
                          <button 
                            className="btn btn-sm btn-outline-success py-0 px-1"
                            onClick={() => handleAssign(item.stockId, "warehouse", w.id)}
                            title="Add stock"
                          >+</button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <button className="btn btn-secondary" onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
