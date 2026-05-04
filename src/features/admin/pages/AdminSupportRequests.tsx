/**
 * Customer Support Dashboard — /admin/support
 *
 * Only role 6 (Customer Support) and Super Admin (role 1) reach this page.
 * Shows all user queries submitted via the Contact Us page.
 *
 * Features:
 *  • Stats: Total | Open | Resolved
 *  • List with status filter tabs
 *  • Side-panel detail: user info (name / email / phone), message, attachment
 *  • Reply panel: type reply, choose send via Email and/or SMS
 *  • Orders tab: view all orders for the querying user
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { formatDate } from "@/shared/utils/helpers";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;
const BRAND = "var(--brand, #6a012a)";

/* ─── tiny helpers ─────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        border: "1.5px solid #e8e0d8",
        borderRadius: 10,
        padding: "18px 20px",
        boxShadow: "0 1px 6px rgba(0,0,0,.05)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#888", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color }}>
        {value}
      </p>
    </div>
  );
}

function Badge({ state }: { state: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    Open:     { bg: "#fff3e0", color: "#e65100" },
    Resolved: { bg: "#e8f5e9", color: "#2e7d32" },
  };
  const c = colors[state] ?? { bg: "#f5f5f5", color: "#555" };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        display: "inline-block",
      }}
    >
      {state}
    </span>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function AdminSupportRequests() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [activeTab, setActiveTab] = useState<"query" | "orders">("query");

  /* ── Stats ────────────────────────────────────────────────────────────── */
  const { data: stats } = useQuery({
    queryKey: ["uq-stats"],
    queryFn: () => api.get("/UserQuery/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  /* ── Query list ───────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery({
    queryKey: ["user-queries", page, statusFilter],
    queryFn: () => {
      const filters: any[] = [];
      if (statusFilter !== "All")
        filters.push({ property: "state", comparison: "eq", value: statusFilter });
      return api
        .get("/UserQuery", {
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

  /* ── Orders for selected user ─────────────────────────────────────────── */
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["cs-orders", selected?.userProfileId],
    queryFn: () =>
      api
        .get(`/UserQuery/orders/${selected.userProfileId}`, {
          params: { "Page.Size": 20 },
        })
        .then((r) => r.data),
    enabled: !!selected?.userProfileId && activeTab === "orders",
  });

  /* ── Reply mutation ───────────────────────────────────────────────────── */
  const replyMutation = useMutation({
    mutationFn: () =>
      api
        .put(`/UserQuery/${selected.queryId}/reply`, {
          replyText,
          sendEmail,
          sendSms,
        })
        .then((r) => r.data),
    onSuccess: (res) => {
      const channels = res?.sentChannels ?? [];
      toast.success(
        channels.length
          ? `Reply sent via ${channels.join(" & ")}!`
          : "Reply saved (no notification sent)."
      );
      qc.invalidateQueries({ queryKey: ["user-queries"] });
      qc.invalidateQueries({ queryKey: ["uq-stats"] });
      setSelected(null);
      setReplyText("");
    },
    onError: () => toast.error("Failed to send reply."),
  });

  const queries = data?.list ?? [];
  const total = data?.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  /* ── Render ─────────────────────────────────────────────────────────────*/
  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-heading, serif)",
              fontSize: 22,
              fontWeight: 800,
              color: "var(--heirloom, #1a1a2e)",
            }}
          >
            Customer Queries
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
            Messages submitted via the Contact Us page
          </p>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Queries" value={stats?.total ?? 0} color="#333" />
        <StatCard label="Open" value={stats?.open ?? 0} color="#e65100" />
        <StatCard label="Resolved" value={stats?.resolved ?? 0} color="#2e7d32" />
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {["All", "Open", "Resolved"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            style={{
              padding: "7px 18px",
              borderRadius: 20,
              border: `1.5px solid ${statusFilter === s ? BRAND : "#e0d8d0"}`,
              background: statusFilter === s ? BRAND : "#fff",
              color: statusFilter === s ? "#fff" : "#555",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1.5px solid #e8e0d8",
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf8f6" }}>
              {["#", "User", "Preview", "Status", "Date", "Action"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    borderBottom: "1.5px solid #e8e0d8",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: 40, color: "#888" }}
                >
                  Loading…
                </td>
              </tr>
            ) : queries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: 40, color: "#aaa" }}
                >
                  No queries found.
                </td>
              </tr>
            ) : (
              queries.map((q: any) => (
                <tr
                  key={q.queryId}
                  style={{
                    borderBottom: "1px solid #f0ece6",
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "#faf8f6")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "")
                  }
                >
                  <td style={{ padding: "12px 16px", color: "#888", fontSize: 13 }}>
                    #{q.queryId}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
                      {q.userName || "—"}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                      {q.userEmail || ""}
                    </p>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      maxWidth: 280,
                      fontSize: 13,
                      color: "#555",
                    }}
                  >
                    <span
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {q.message}
                    </span>
                    {q.attachmentUrl && (
                      <span
                        style={{
                          fontSize: 11,
                          color: BRAND,
                          fontWeight: 600,
                          marginLeft: 4,
                        }}
                      >
                        📎
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge state={q.state || "Open"} />
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      color: "#888",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(q.createdDate)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => {
                        setSelected(q);
                        setReplyText(q.replyText || "");
                        setActiveTab("query");
                      }}
                      style={{
                        background: BRAND,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
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

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1.5px solid ${page === i + 1 ? BRAND : "#e0d8d0"}`,
                background: page === i + 1 ? BRAND : "#fff",
                color: page === i + 1 ? "#fff" : "#555",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ── Detail side-panel ───────────────────────────────────────────── */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 900,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              width: "min(560px, 96vw)",
              height: "100%",
              background: "#fff",
              boxShadow: "-4px 0 24px rgba(0,0,0,.15)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1.5px solid #e8e0d8",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  Query #{selected.queryId}
                </h3>
                <Badge state={selected.state || "Open"} />
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#888",
                }}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1.5px solid #e8e0d8",
              }}
            >
              {(["query", "orders"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "none",
                    border: "none",
                    borderBottom: `3px solid ${activeTab === t ? BRAND : "transparent"}`,
                    color: activeTab === t ? BRAND : "#666",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t === "query" ? "Query & Reply" : "Orders"}
                </button>
              ))}
            </div>

            {/* ── Tab: Query & Reply ─────────────────────────────────────── */}
            {activeTab === "query" && (
              <div style={{ padding: 24, flex: 1 }}>
                {/* User info */}
                <div
                  style={{
                    background: "#faf8f6",
                    borderRadius: 8,
                    padding: "14px 16px",
                    marginBottom: 20,
                    border: "1px solid #e8e0d8",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Customer Details
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i className="bi bi-person" style={{ color: "#888", fontSize: 14 }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {selected.userName || "—"}
                      </span>
                    </div>
                    {selected.userEmail && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className="bi bi-envelope" style={{ color: "#888", fontSize: 14 }} />
                        <a
                          href={`mailto:${selected.userEmail}`}
                          style={{ fontSize: 13, color: BRAND, textDecoration: "none" }}
                        >
                          {selected.userEmail}
                        </a>
                      </div>
                    )}
                    {selected.userPhone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className="bi bi-telephone" style={{ color: "#888", fontSize: 14 }} />
                        <a
                          href={`tel:${selected.userPhone}`}
                          style={{ fontSize: 13, color: BRAND, textDecoration: "none" }}
                        >
                          {selected.userPhone}
                        </a>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i className="bi bi-clock" style={{ color: "#888", fontSize: 13 }} />
                      <span style={{ fontSize: 12, color: "#888" }}>
                        Submitted {formatDate(selected.createdDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Message
                </p>
                <div
                  style={{
                    background: "#f5f0eb",
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#333",
                    marginBottom: 16,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selected.message}
                </div>

                {/* Attachment */}
                {selected.attachmentUrl && (
                  <div style={{ marginBottom: 20 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      Attachment
                    </p>
                    <a
                      href={selected.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#fff3e0",
                        color: "#e65100",
                        padding: "8px 14px",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "1px solid #ffccbc",
                      }}
                    >
                      <i className="bi bi-paperclip" />
                      View Attachment
                    </a>
                  </div>
                )}

                {/* Previous reply (if any) */}
                {selected.replyText && (
                  <div
                    style={{
                      background: "#e8f5e9",
                      borderRadius: 8,
                      padding: "12px 14px",
                      marginBottom: 20,
                      border: "1px solid #c8e6c9",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#2e7d32",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Previous Reply — {selected.repliedBy || "Support"}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>
                      {selected.replyText}
                    </p>
                  </div>
                )}

                {/* Reply form */}
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Reply to Customer
                </p>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here…"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1.5px solid #d4c5b5",
                    borderRadius: 8,
                    padding: "12px",
                    fontSize: 14,
                    resize: "vertical",
                    fontFamily: "inherit",
                    marginBottom: 12,
                    outline: "none",
                  }}
                />

                {/* Send channels */}
                <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      style={{ accentColor: BRAND }}
                    />
                    <i className="bi bi-envelope" style={{ color: "#666" }} />
                    Send via Email
                    {selected.userEmail && (
                      <span style={{ color: "#888", fontSize: 11 }}>
                        ({selected.userEmail})
                      </span>
                    )}
                  </label>

                  {selected.userPhone && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sendSms}
                        onChange={(e) => setSendSms(e.target.checked)}
                        style={{ accentColor: BRAND }}
                      />
                      <i className="bi bi-chat-text" style={{ color: "#666" }} />
                      Send via SMS
                      <span style={{ color: "#888", fontSize: 11 }}>
                        ({selected.userPhone})
                      </span>
                    </label>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      flex: 1,
                      padding: "11px",
                      background: "#fff",
                      border: "1.5px solid #d4c5b5",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                      color: "#555",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => replyMutation.mutate()}
                    disabled={replyMutation.isPending || !replyText.trim()}
                    style={{
                      flex: 2,
                      padding: "11px",
                      background:
                        replyMutation.isPending || !replyText.trim()
                          ? "#c5a9b4"
                          : BRAND,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor:
                        replyMutation.isPending || !replyText.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {replyMutation.isPending ? "Sending…" : "Send Reply & Resolve"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Orders ───────────────────────────────────────────── */}
            {activeTab === "orders" && (
              <div style={{ padding: 24, flex: 1 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 16,
                  }}
                >
                  Orders for {selected.userName || selected.userEmail}
                </p>

                {ordersLoading ? (
                  <p style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
                    Loading orders…
                  </p>
                ) : !ordersData?.list?.length ? (
                  <p style={{ color: "#aaa", textAlign: "center", marginTop: 40 }}>
                    No orders found for this customer.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {ordersData.list.map((o: any) => (
                      <div
                        key={o.orderId}
                        style={{
                          background: "#faf8f6",
                          borderRadius: 8,
                          padding: "14px 16px",
                          border: "1px solid #e8e0d8",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            #{o.orderNumber || o.orderId}
                          </span>
                          <Badge state={o.state || "—"} />
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 4,
                          }}
                        >
                          <span style={{ fontSize: 12, color: "#888" }}>
                            Date: {o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "—"}
                          </span>
                          <span style={{ fontSize: 12, color: "#888" }}>
                            Amount: ₹{o.totalAmount?.toFixed(2) ?? "—"}
                          </span>
                          <span style={{ fontSize: 12, color: "#888" }}>
                            Payment: {o.paymentMethod || "—"}
                          </span>
                          <span style={{ fontSize: 12, color: "#888" }}>
                            Tracking: {o.trackingId || "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
