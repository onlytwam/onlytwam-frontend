import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

interface SizeTableProps {
  endpoint: string;
  title: string;
  idKey: string;
  showSizeType?: boolean;
}

function SizeTable({ endpoint, title, idKey, showSizeType }: SizeTableProps) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () =>
      api
        .get(`/${endpoint}`, {
          params: {
            "Page.Size": 200,
            "Order.Property": "SortOrder",
            "Order.Ascending": true,
          },
        })
        .then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (form: any) =>
      form[idKey]
        ? api.put(`/${endpoint}/${form[idKey]}`, form)
        : api.post(`/${endpoint}`, form),
    onSuccess: () => {
      toast.success("Saved!");
      qc.invalidateQueries({ queryKey: [endpoint] });
      setModal(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/${endpoint}/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: [endpoint] });
      setConfirm(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const items = data?.list ?? [];

  const sizeTypeBadge = (type?: string) => {
    if (!type) return null;
    const isAlpha = type === "alphabetical";
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 5px",
          borderRadius: 4,
          background: isAlpha ? "#e8f5e9" : "#e3f2fd",
          color: isAlpha ? "#2e7d32" : "#1565c0",
          letterSpacing: "0.5px",
          marginLeft: 4,
          textTransform: "uppercase",
        }}
      >
        {isAlpha ? "α" : "#"}
      </span>
    );
  };

  return (
    <div className="s-adminsizes-1266df">
      <div className="s-adminsizes-bd87d0">
        <h3 className="s-adminblog-ffb607">{title}</h3>
        <button
          onClick={() =>
            setModal({
              sizeLabel: "",
              sortOrder: 0,
              ...(showSizeType ? { sizeType: "alphabetical" } : {}),
            })
          }
          className="s-adminsizes-861dea"
        >
          + Add
        </button>
      </div>

      {isLoading ? (
        <p className="s-adminsizes-104f28">Loading…</p>
      ) : (
        <div className="s-adminsizes-66eec9">
          {items.length === 0 ? (
            <p className="s-adminsizes-441124">No {title.toLowerCase()} yet.</p>
          ) : (
            items.map((item: any) => (
              <div key={item[idKey]} className="s-adminsizes-383d88">
                <span className="s-adminsizes-5de088">
                  {item.sizeLabel || item.label}
                  {showSizeType && sizeTypeBadge(item.sizeType)}
                </span>
                <span className="s-adminsizes-b54cfc">#{item[idKey]}</span>
                {item.sortOrder != null && (
                  <span className="s-adminsizes-b54cfc">
                    ({item.sortOrder})
                  </span>
                )}
                <button
                  onClick={() => setModal({ ...item })}
                  className="s-adminsizes-594003"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirm(item)}
                  className="s-adminsizes-594003"
                >
                  Del
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {modal && (
        <div className="s-adminsizes-1673b9">
          <div className="s-adminsizes-9fb87d">
            <h3 className="s-admindashboa-2f7b3b">
              {modal[idKey] ? "Edit" : "Add"} {title.slice(0, -1)}
            </h3>

            <div className="s-adminblog-22a617">
              <label className="s-addressform-f1fb64">Label *</label>
              <input
                value={modal.sizeLabel || ""}
                onChange={(e) =>
                  setModal({ ...modal, sizeLabel: e.target.value })
                }
                className="inp-field"
                placeholder="e.g. S, M, XL, 32B"
              />
            </div>

            {showSizeType && (
              <div className="s-adminblog-22a617">
                <label className="s-addressform-f1fb64">Size Type</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {(["alphabetical", "numerical"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setModal({ ...modal, sizeType: t })}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 20,
                        border: `1.5px solid ${
                          modal.sizeType === t ? "var(--brand)" : "#ddd"
                        }`,
                        background:
                          modal.sizeType === t ? "var(--brand)" : "#fff",
                        color: modal.sizeType === t ? "#fff" : "#555",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {t === "alphabetical"
                        ? "🔤 Alphabetical (S, M, L…)"
                        : "🔢 Numerical (32, 34, 36…)"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="s-updateprofil-246fef">
              <label className="s-addressform-f1fb64">Sort Order</label>
              <input
                type="number"
                value={modal.sortOrder ?? 0}
                onChange={(e) =>
                  setModal({ ...modal, sortOrder: Number(e.target.value) })
                }
                className="inp-field"
              />
            </div>

            <div className="s-adminblog-679e96">
              <button
                onClick={() => setModal(null)}
                className="s-adminsizes-fbedb3"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(modal)}
                disabled={!modal.sizeLabel}
                className="s-adminsizes-4049dc"
                style={{ opacity: !modal.sizeLabel ? 0.5 : 1 }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="s-adminsizes-1673b9">
          <div className="s-adminsizes-025333">
            <h3 className="s-adminsizes-b2cfeb">
              Delete "{confirm.sizeLabel}"?
            </h3>
            <div className="s-adminblog-679e96">
              <button
                onClick={() => setConfirm(null)}
                className="s-adminsizes-fbedb3"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirm[idKey])}
                className="s-adminsizes-4049dc"
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

export default function AdminSizes() {
  return (
    <div>
      <div className="s-adminnewslet-70cb1d">
        <h2 className="s-adminblog-91c675">Sizes &amp; Cup Sizes</h2>
        <p className="s-adminblog-1c2c10">
          Manage clothing sizes and bra cup sizes used across products.
        </p>
      </div>
      <SizeTable endpoint="Size" title="Sizes" idKey="sizeId" showSizeType />
      <SizeTable endpoint="CupSize" title="Cup Sizes" idKey="cupSizeId" />
    </div>
  );
}
