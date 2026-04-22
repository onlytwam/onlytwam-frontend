import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;
const empty = {
  code: "",
  discountType: "Percentage",
  discountValue: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  expiryDate: "",
  usageLimit: "",
  isActive: true,
  description: "",
};

export default function AdminCoupons() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons", page, search],
    queryFn: () => {
      const filters: any[] = [];
      if (search.trim())
        filters.push({
          property: "QuickSearch",
          comparison: "contains",
          value: search.trim(),
        });
      return api
        .get("/Coupons/", {
          params: {
            ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
            "Page.Index": page,
            "Page.Size": PAGE_SIZE,
            "Order.Property": "CreatedDate",
            "Order.Ascending": false,
          },
        })
        .then((r) => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) => {
      const payload = {
        couponCode: form.couponCode,
        couponName: form.couponName,
        description: form.description,
        discount: form.discount,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
        isCommon: form.isCommon,
        toUserProfileId: form.toUserProfileId,
        state: "Approved",
      };

      return form.couponId
        ? api.put(`/Coupons/${form.couponId}`, payload)
        : api.post(`/Coupons/`, payload);
    },
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setModal(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/Coupons/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const coupons = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Coupons</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminbrands-bccf37">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search coupons…"
            className="inp-field s-admincoupons-2b5f69"
          />
          <button
            onClick={() => setModal({ ...empty })}
            className="s-admincoupons-2798d5"
          >
            + New Coupon
          </button>
        </div>
      </div>

      <div className="s-admincoupons-b0d5b2">
        <table className="s-admincoupons-bbc29c">
          <thead>
            <tr className="s-adminbrands-1ba202">
              {[
                "Code",
                "Name",
                "Discount",
                "Start Date",
                "End Date",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="s-adminbrands-84e069">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="s-adminbrands-3e0634">
                  Loading…
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="s-adminbrands-3e0634">
                  No coupons found.
                </td>
              </tr>
            ) : (
              coupons.map((c: any) => (
                <tr key={c.couponId} className="s-adminbrands-59d787">
                  {/* Code */}
                  <td className="s-admincoupons-9db09c">{c.couponCode}</td>

                  {/* Name */}
                  <td className="s-admincategor-ec7211">
                    {c.couponName || "—"}
                  </td>

                  {/* Discount */}
                  <td className="s-admincategor-46dbfc">
                    {c.discount ? `${c.discount}%` : "—"}
                  </td>

                  {/* Start Date */}
                  <td className="s-admincategor-ec7211">
                    {c.startDate
                      ? new Date(c.startDate).toLocaleDateString("en-IN")
                      : "—"}
                  </td>

                  {/* End Date */}
                  <td className="s-admincategor-ec7211">
                    {c.endDate
                      ? new Date(c.endDate).toLocaleDateString("en-IN")
                      : "—"}
                  </td>

                  {/* Status */}
                  <td>
                    {c.isExpire ? (
                      <span style={{ color: "red" }}>Expired</span>
                    ) : c.isActive ? (
                      <span style={{ color: "green" }}>Active</span>
                    ) : (
                      <span>Inactive</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="s-admincategor-19b711">
                    <div className="s-adminbrands-ac734d">
                      <button
                        onClick={() => setModal(c)}
                        className="s-adminbrands-6ea383"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirm(c)}
                        className="s-adminbrands-6ea383"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="s-adminblog-213a15">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className="s-admincoupons-174989"
              style={{
                borderColor: page === i + 1 ? "var(--brand)" : "var(--ivory)",
                background: page === i + 1 ? "var(--brand)" : "#fff",
                color: page === i + 1 ? "#fff" : "#000000",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {modal && (
        <div className="s-admincoupons-d93fb3">
          {" "}
          {/* overlay */}
          <div className="s-admincoupons-5920ba">
            {" "}
            {/* modal box */}
            {/* Header */}
            <h3 className="s-adminblog-e6371f">
              {modal.couponId ? "Edit Coupon" : "New Coupon"}
            </h3>
            {/* Form */}
            <div className="s-admincoupons-ad5066">
              {/* Coupon Code */}
              <div>
                <label>Coupon Code *</label>
                <input
                  value={modal.couponCode || ""}
                  onChange={(e) =>
                    setModal({ ...modal, couponCode: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Coupon Name */}
              <div>
                <label>Coupon Name *</label>
                <input
                  value={modal.couponName || ""}
                  onChange={(e) =>
                    setModal({ ...modal, couponName: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Description */}
              <div>
                <label>Description</label>
                <input
                  value={modal.description || ""}
                  onChange={(e) =>
                    setModal({ ...modal, description: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Discount */}
              <div>
                <label>Discount (%) *</label>
                <input
                  type="number"
                  value={modal.discount || ""}
                  onChange={(e) =>
                    setModal({ ...modal, discount: Number(e.target.value) })
                  }
                  className="inp-field"
                />
              </div>

              {/* Start Date */}
              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={(modal.startDate || "").split("T")[0]}
                  onChange={(e) =>
                    setModal({ ...modal, startDate: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* End Date */}
              <div>
                <label>End Date</label>
                <input
                  type="date"
                  value={(modal.endDate || "").split("T")[0]}
                  onChange={(e) =>
                    setModal({ ...modal, endDate: e.target.value })
                  }
                  className="inp-field"
                />
              </div>

              {/* Active */}
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={modal.isActive ?? true}
                    onChange={(e) =>
                      setModal({ ...modal, isActive: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>

              {/* Common */}
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={modal.isCommon ?? false}
                    onChange={(e) =>
                      setModal({ ...modal, isCommon: e.target.checked })
                    }
                  />
                  Common Coupon
                </label>
              </div>

              {/* Assign User */}
              <div>
                <label>Assign to User</label>
                <input
                  value={modal.toUserProfileId || ""}
                  onChange={(e) =>
                    setModal({ ...modal, toUserProfileId: e.target.value })
                  }
                  className="inp-field"
                />
              </div>
            </div>
            {/* Footer Buttons */}
            <div className="s-admincoupons-45d476">
              <button
                onClick={() => setModal(null)}
                className="s-admincoupons-db4fcf"
              >
                Cancel
              </button>

              <button
                onClick={() => saveMutation.mutate(modal)}
                disabled={!modal.couponCode || !modal.discount}
                className="s-admincoupons-2798d5"
                style={{
                  opacity: !modal.couponCode || !modal.discount ? 0.5 : 1,
                }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <div className="s-admincoupons-f1fb3c">
          <div className="s-adminblog-69ab70">
            <h3 className="s-adminblog-caf79d">
              Delete coupon "{confirm.code || confirm.couponCode}"?
            </h3>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                className="s-admincoupons-99e32e"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirm.couponId)}
                className="s-admincoupons-2253c0"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
