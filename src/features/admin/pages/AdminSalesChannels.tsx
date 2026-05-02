
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

interface SalesChannel {
  channelId:     number;
  channelCode:   string;
  channelName:   string;
  emoji:         string | null;
  stockSource:   "store" | "warehouse";
  commissionPct: number;
  isActive:      boolean;
  sortOrder:     number;
}

const EMPTY_FORM = {
  channelCode:   "",
  channelName:   "",
  emoji:         "",
  stockSource:   "warehouse" as "store" | "warehouse",
  commissionPct: 0,
  sortOrder:     0,
};

export default function AdminSalesChannels() {
  const qc = useQueryClient();
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editingId,  setEditingId]  = useState<number | null>(null);
  const [showForm,   setShowForm]   = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const { data: channels = [], isLoading } = useQuery<SalesChannel[]>({
    queryKey: ["sales-channels-admin"],
    queryFn:  async () => (await api.get("/SalesChannels?active_only=false")).data,
  });

  // ── Create ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) =>
      (await api.post("/SalesChannels", data)).data,
    onSuccess: () => {
      toast.success("Channel created.");
      qc.invalidateQueries({ queryKey: ["sales-channels-admin"] });
      qc.invalidateQueries({ queryKey: ["sales-channels"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Create failed."),
  });

  // ── Update ───────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof EMPTY_FORM> }) =>
      (await api.patch(`/SalesChannels/${id}`, data)).data,
    onSuccess: () => {
      toast.success("Channel updated.");
      qc.invalidateQueries({ queryKey: ["sales-channels-admin"] });
      qc.invalidateQueries({ queryKey: ["sales-channels"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Update failed."),
  });

  // ── Deactivate ────────────────────────────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/SalesChannels/${id}`),
    onSuccess: () => {
      toast.success("Channel deactivated.");
      qc.invalidateQueries({ queryKey: ["sales-channels-admin"] });
      qc.invalidateQueries({ queryKey: ["sales-channels"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Deactivate failed."),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (ch: SalesChannel) => {
    setForm({
      channelCode:   ch.channelCode,
      channelName:   ch.channelName,
      emoji:         ch.emoji || "",
      stockSource:   ch.stockSource,
      commissionPct: ch.commissionPct,
      sortOrder:     ch.sortOrder,
    });
    setEditingId(ch.channelId);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.channelName.trim()) { toast.error("Channel name is required."); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      if (!form.channelCode.trim()) { toast.error("Channel code is required."); return; }
      createMutation.mutate(form);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=DM+Sans:wght@400;500;600&display=swap');
        .sc-root { font-family:'DM Sans',sans-serif; padding:1.5rem; background:#F5F0E6; min-height:100vh; }
        .sc-root * { box-sizing:border-box; }
        .sc-card { background:#fff; border:1.5px solid #e8ddd5; border-radius:14px; }
        .sc-inp  { width:100%; border:1.5px solid #ddd0c8; border-radius:8px; background:#fff;
                   padding:.6rem .875rem; font-size:.875rem; color:#3b1c25; font-family:inherit; outline:none; }
        .sc-inp:focus  { border-color:#6B0F2A; box-shadow:0 0 0 3px rgba(107,15,42,.10); }
        .sc-lbl  { font-size:.67rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
                   color:#9E6070; display:block; margin-bottom:5px; }
        .sc-btn  { display:inline-flex; align-items:center; gap:6px; font-family:'DM Sans',sans-serif;
                   font-weight:600; cursor:pointer; border:none; border-radius:8px; padding:.6rem 1.2rem;
                   font-size:.85rem; transition:all .15s; }
        .sc-btn-p { background:#6B0F2A; color:#F5F0E6; box-shadow:0 2px 8px rgba(107,15,42,.25); }
        .sc-btn-p:hover:not(:disabled) { background:#8a1235; }
        .sc-btn-p:disabled { opacity:.6; cursor:not-allowed; }
        .sc-btn-s { background:#fff; color:#6B0F2A; border:1.5px solid #ddd0c8; }
        .sc-btn-s:hover { border-color:#9E6070; background:#fdf4f7; }
        .sc-btn-d { background:#fff; color:#dc2626; border:1.5px solid #fecaca; }
        .sc-btn-d:hover { background:#fef2f2; }
        .sc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1rem; }
        .sc-tag  { display:inline-flex; align-items:center; border-radius:999px; padding:2px 10px;
                   font-size:.7rem; font-weight:700; }
        .sc-sel  { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239E6070' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
                   background-repeat:no-repeat; background-position:right 10px center; padding-right:2rem; cursor:pointer; }
      `}</style>

      <div className="sc-root">

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      marginBottom:"1.5rem", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.8rem",
                         fontWeight:700, color:"#6B0F2A", margin:0 }}>
              Sales Channels
            </h1>
            <p style={{ fontSize:".78rem", color:"#9E6070", margin:"4px 0 0" }}>
              Manage where orders come from and how stock is deducted
            </p>
          </div>
          <button className="sc-btn sc-btn-p" onClick={() => { resetForm(); setShowForm(true); }}>
            + Add Channel
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="sc-card" style={{ marginBottom:"1.5rem", padding:"1.25rem" }}>
            <h3 style={{ fontFamily:"'Cormorant Garamond',serif", color:"#6B0F2A",
                         fontSize:"1.1rem", margin:"0 0 1rem" }}>
              {editingId ? "Edit Channel" : "New Channel"}
            </h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14 }}>

              {/* Code — only for new */}
              {!editingId && (
                <div>
                  <label className="sc-lbl">Channel Code *</label>
                  <input className="sc-inp" placeholder="e.g. MYNTRA"
                         value={form.channelCode}
                         onChange={e => setForm(f => ({ ...f, channelCode: e.target.value.toUpperCase() }))} />
                  <span style={{ fontSize:".68rem", color:"#9E6070" }}>Unique slug, cannot change later</span>
                </div>
              )}

              <div>
                <label className="sc-lbl">Channel Name *</label>
                <input className="sc-inp" placeholder="e.g. Myntra"
                       value={form.channelName}
                       onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))} />
              </div>

              <div>
                <label className="sc-lbl">Emoji</label>
                <input className="sc-inp" placeholder="🛍️" maxLength={4}
                       value={form.emoji}
                       onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} />
              </div>

              <div>
                <label className="sc-lbl">Stock Source *</label>
                <select className="sc-inp sc-sel" value={form.stockSource}
                        onChange={e => setForm(f => ({ ...f, stockSource: e.target.value as "store" | "warehouse" }))}>
                  <option value="store">Store (POS / walk-in)</option>
                  <option value="warehouse">Warehouse (online orders)</option>
                </select>
              </div>

              <div>
                <label className="sc-lbl">Commission %</label>
                <input className="sc-inp" type="number" min={0} max={100} step={0.5}
                       placeholder="0"
                       value={form.commissionPct}
                       onChange={e => setForm(f => ({ ...f, commissionPct: parseFloat(e.target.value) || 0 }))} />
              </div>

              <div>
                <label className="sc-lbl">Sort Order</label>
                <input className="sc-inp" type="number" min={0} placeholder="0"
                       value={form.sortOrder}
                       onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div style={{ display:"flex", gap:10, marginTop:"1.25rem" }}>
              <button className="sc-btn sc-btn-p" onClick={handleSubmit} disabled={isBusy}>
                {isBusy ? "Saving…" : editingId ? "Save Changes" : "Create Channel"}
              </button>
              <button className="sc-btn sc-btn-s" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Channel cards */}
        {isLoading ? (
          <p style={{ color:"#9E6070" }}>Loading…</p>
        ) : (
          <div className="sc-grid">
            {channels.map(ch => (
              <div key={ch.channelId} className="sc-card"
                   style={{ padding:"1.1rem", opacity: ch.isActive ? 1 : 0.55 }}>

                {/* Top row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:"1.8rem" }}>{ch.emoji || "🏷️"}</span>
                    <div>
                      <div style={{ fontWeight:700, color:"#3b1c25", fontSize:".95rem" }}>{ch.channelName}</div>
                      <code style={{ fontSize:".7rem", color:"#9E6070", background:"#f5f0e6",
                                     padding:"1px 6px", borderRadius:4 }}>{ch.channelCode}</code>
                    </div>
                  </div>
                  <span className="sc-tag" style={{
                    background: ch.isActive ? "#f0fdf4" : "#f5f5f5",
                    color:      ch.isActive ? "#15803d" : "#9E6070",
                    border:     `1px solid ${ch.isActive ? "#bbf7d0" : "#e5e7eb"}`,
                  }}>
                    {ch.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div style={{ background:"#fdf8f4", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:".63rem", fontWeight:700, color:"#9E6070",
                                  textTransform:"uppercase", letterSpacing:".08em" }}>Stock Source</div>
                    <div style={{ fontSize:".82rem", fontWeight:600, color:"#3b1c25", marginTop:2 }}>
                      {ch.stockSource === "store" ? "🏪 Store" : "🏭 Warehouse"}
                    </div>
                  </div>
                  <div style={{ background:"#fdf8f4", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:".63rem", fontWeight:700, color:"#9E6070",
                                  textTransform:"uppercase", letterSpacing:".08em" }}>Commission</div>
                    <div style={{ fontSize:".82rem", fontWeight:600,
                                  color: ch.commissionPct > 0 ? "#dc2626" : "#15803d", marginTop:2 }}>
                      {ch.commissionPct > 0 ? `${ch.commissionPct}%` : "None"}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:8 }}>
                  <button className="sc-btn sc-btn-s" style={{ flex:1, justifyContent:"center" }}
                          onClick={() => startEdit(ch)}>
                    Edit
                  </button>
                  {ch.isActive && ch.channelCode !== "POS" && (
                    <button className="sc-btn sc-btn-d"
                            onClick={() => {
                              if (confirm(`Deactivate ${ch.channelName}?`))
                                deactivateMutation.mutate(ch.channelId);
                            }}>
                      Disable
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}