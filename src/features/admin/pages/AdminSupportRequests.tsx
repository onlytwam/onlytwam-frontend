import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { formatDate } from "@/shared/utils/helpers";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

export default function AdminSupportRequests() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatus] = useState("All");
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support-requests", page, statusFilter],
    queryFn: () => {
      const filters: any[] = [];
      if (statusFilter !== "All")
        filters.push({
          property: "state",
          comparison: "eq",
          value: statusFilter,
        });
      return api
        .get("/SupportRequest", {
          params: {
            ...(filters.length ? { Filters: JSON.stringify(filters) } : {}),
            "Page.Index": page,
            "Page.Size": PAGE_SIZE,
            "Order.Property": "createdDate",
            "Order.Ascending": false,
          },
        })
        .then((r) => r.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      state,
      remarks,
    }: {
      id: number;
      state: string;
      remarks: string;
    }) =>
      api
        .put(`/SupportRequest/${id}`, {
          supportId: id,
          state,
          remarks,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Updated!");
      qc.invalidateQueries({ queryKey: ["support-requests"] });
      setSelected(null);
      setReplyText("");
    },
    onError: () => toast.error("Update failed"),
  });

  const requests = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="s-adminblog-fe4afb">
        <div>
          <h2 className="s-adminblog-91c675">Support Requests</h2>
          <p className="s-adminblog-1c2c10">{total} total</p>
        </div>
        <div className="s-adminproduct-47622e">
          {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className="s-adminsupport-84c82e"
              style={{
                borderColor:
                  statusFilter === s ? "var(--brand)" : "var(--ivory)",
                background: statusFilter === s ? "var(--brand)" : "#fff",
                color: statusFilter === s ? "#fff" : "var(--heirloom)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="s-adminbrands-a637bc">
        <table className="s-adminbrands-de3642">
          <thead>
            <tr className="s-adminbrands-1ba202">
              {["#", "Subject", "User", "Status", "Date", "Actions"].map(
                (h) => (
                  <th key={h} className="s-adminbrands-84e069">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="s-adminbrands-3e0634">
                  Loading…
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="s-adminbrands-3e0634">
                  No requests found.
                </td>
              </tr>
            ) : (
              requests.map((r: any) => (
                <tr key={r.supportId} className="s-adminbrands-59d787">
                  <td className="s-admincategor-ec7211">#{r.supportId}</td>
                  <td className="s-adminsupport-321d60">
                    {r.subject || "No subject"}
                  </td>
                  <td className="s-admincategor-ec7211">{r.email || "—"}</td>
                  <td className="s-admincategor-19b711">
                    <span className="s-admindashboa-dbacab s-adminsupport-c2234d">
                      {r.state || "Open"}
                    </span>
                  </td>
                  <td className="s-admincategor-ec7211">
                    {formatDate(r.createdDate)}
                  </td>
                  <td className="s-admincategor-19b711">
                    <button
                      onClick={() => {
                        setSelected(r);
                        setReplyText(r.remarks || "");
                      }}
                      className="s-adminbrands-6ea383"
                    >
                      View
                    </button>
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
              className="s-adminsupport-0e579f"
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

      {selected && (
        <div className="s-adminsupport-a4b347">
          <div className="s-adminsupport-8eb56a">
            <div className="s-adminproduct-d763a3">
              <h3 className="s-adminproduct-53697f">
                Request #{selected.supportId}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="s-adminsupport-40536d"
              >
                ×
              </button>
            </div>
            <div className="s-adminsupport-779479">
              <p className="s-admininvento-b153ec">
                From: {selected.email} · {formatDate(selected.createdDate)}
              </p>
              <p className="s-adminsupport-d95a4a">{selected.subject}</p>
              <p className="s-adminsupport-939e02">{selected.message}</p>
            </div>
            <div className="s-adminblog-22a617">
              <label className="s-addressform-f1fb64">Update Status</label>
              <select
                value={selected.state || "Open"}
                onChange={(e) =>
                  setSelected({ ...selected, state: e.target.value })
                }
                className="s-adminsupport-3f979a"
              >
                {["Open", "In Progress", "Resolved", "Closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="s-adminblog-19fd7a">
              <label className="s-addressform-f1fb64">Reply to customer</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                className="s-adminsupport-0e37c7"
                placeholder="Write your reply here…"
              />
            </div>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setSelected(null)}
                className="s-adminsupport-6d579d"
              >
                Close
              </button>
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.supportId,
                    state: selected.state || "Open",
                    remarks: replyText,
                  })
                }
                disabled={updateMutation.isPending}
                className="s-adminsupport-d9bc58"
              >
                {updateMutation.isPending ? "Saving…" : "Save & Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
