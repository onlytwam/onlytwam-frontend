/**
 * AdminStock.tsx
 * Comprehensive stock management page for admin.
 * - Product list with small image + name + code
 * - Click product → expand variants
 * - Click variant → show PVDs (size/cup combos)
 * - Click PVD → full stock detail panel with edit + history log
 *
 * Design: follows the same P / PLT / BDR / GRY / TXT / SUB / BG / WHITE tokens
 * used across admin pages.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/shared/api/axiosInstance";
import toast from "react-hot-toast";

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = "#7A1E2C";
const PLT = "#F5E9E6";
const BDR = "#E6DAD3";
const GRY = "#F3EFEC";
const TXT = "#2B2B2B";
const SUB = "#8A7F7A";
const BG = "#FAF7F4";
const WHITE = "#ffffff";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function imgUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/uploads/") || src.startsWith("uploads/"))
    return `http://127.0.0.1:8000/${src.replace(/^\//, "")}`;
  return src;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateFull(iso: string | null | undefined): {
  dayName: string;
  date: string;
  time: string;
  relative: string;
} {
  if (!iso) return { dayName: "—", date: "—", time: "—", relative: "" };
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMin < 1) relative = "just now";
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24) relative = `${diffHr}h ago`;
  else if (diffDay === 1) relative = "yesterday";
  else if (diffDay < 7) relative = `${diffDay}d ago`;
  else relative = "";

  return {
    dayName: d.toLocaleDateString("en-IN", { weekday: "long" }),
    date: d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    relative,
  };
}

// Group flat log entries (one per changed field) into save-session groups
// Entries within 10 seconds of each other with the same changedBy are one session
interface LogGroup {
  sessionTime: string; // ISO of first entry
  changedBy: string | null;
  note: string | null;
  entries: any[];
  // Snapshot of state AFTER this save (from the last entry's snapshot fields)
  snapshot: {
    totalStock: number | null;
    processedQuantity: number | null;
    returnedQuantity: number | null;
    availableQuantity: number | null;
  };
}

function groupLogs(logs: any[]): LogGroup[] {
  if (!logs.length) return [];
  // logs come in desc order; work in desc order (most recent first)
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );

  const groups: LogGroup[] = [];
  let currentEntries: any[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const timeDiff = Math.abs(
      new Date(prev.createdDate).getTime() -
        new Date(curr.createdDate).getTime(),
    );
    // Same session: within 10 seconds, same changedBy and note
    const sameSession =
      timeDiff < 10000 &&
      prev.changedBy === curr.changedBy &&
      prev.note === curr.note;
    if (sameSession) {
      currentEntries.push(curr);
    } else {
      groups.push(buildGroup(currentEntries));
      currentEntries = [curr];
    }
  }
  groups.push(buildGroup(currentEntries));
  return groups;
}

function buildGroup(entries: any[]): LogGroup {
  // Use the entry with the latest timestamp as the "session time"
  const newest = entries.reduce((a, b) =>
    new Date(a.createdDate) > new Date(b.createdDate) ? a : b,
  );
  // Snapshot: from any entry (they all carry the same post-save snapshot)
  const snap = entries[0];
  return {
    sessionTime: newest.createdDate,
    changedBy: newest.changedBy ?? null,
    note: newest.note ?? null,
    entries,
    snapshot: {
      totalStock: snap.totalStock,
      processedQuantity: snap.processedQuantity,
      returnedQuantity: snap.returnedQuantity,
      availableQuantity: snap.availableQuantity,
    },
  };
}

function colorFor(changeType: string): { color: string; bg: string } {
  switch (changeType) {
    case "TOTAL_STOCK":
      return { color: "#1565c0", bg: "#e3f2fd" };
    case "PROCESSED":
      return { color: "#6a1b9a", bg: "#f3e5f5" };
    case "RETURNED":
      return { color: "#795548", bg: "#efebe9" };
    case "AVAILABLE":
      return { color: "#2e7d32", bg: "#e8f5e9" };
    case "INITIAL_STOCK":
      return { color: "#e65100", bg: "#fff3e0" };
    default:
      return { color: SUB, bg: GRY };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Pill({
  val,
  color,
  bg,
  label,
}: {
  val: number;
  color: string;
  bg: string;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: SUB,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color,
          background: bg,
          borderRadius: 7,
          padding: "4px 12px",
          minWidth: 42,
          textAlign: "center",
          letterSpacing: "-0.5px",
        }}
      >
        {val ?? 0}
      </span>
    </div>
  );
}

function StatusBadge({ pvd }: { pvd: any }) {
  const avail = pvd.availableQuantity ?? 0;
  if (pvd.isOutOfStock || avail <= 0)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#c62828",
          background: "#fdecea",
          borderRadius: 20,
          padding: "2px 8px",
        }}
      >
        Out of Stock
      </span>
    );
  if (pvd.isLowStock || avail <= 3)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#e65100",
          background: "#fff3e0",
          borderRadius: 20,
          padding: "2px 8px",
        }}
      >
        Low Stock
      </span>
    );
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#2e7d32",
        background: "#e8f5e9",
        borderRadius: 20,
        padding: "2px 8px",
      }}
    >
      In Stock
    </span>
  );
}

// ─── Stock Detail Panel ───────────────────────────────────────────────────────
function StockDetailPanel({
  pvd,
  onClose,
  onSaved,
}: {
  pvd: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalQty, setTotalQty] = useState<number>(pvd.stockQuantity ?? 0);
  const [processedQty, setProcessedQty] = useState<number>(
    pvd.processedQuantity ?? 0,
  );
  const [returnedQty, setReturnedQty] = useState<number>(
    pvd.returnedQuantity ?? 0,
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");

  const available = Math.max(0, totalQty - processedQty + returnedQty);
  const availColor =
    available <= 0 ? "#c62828" : available <= 3 ? "#e65100" : "#2e7d32";
  const availBg =
    available <= 0 ? "#fdecea" : available <= 3 ? "#fff3e0" : "#e8f5e9";

  useEffect(() => {
    setTotalQty(pvd.stockQuantity ?? 0);
    setProcessedQty(pvd.processedQuantity ?? 0);
    setReturnedQty(pvd.returnedQuantity ?? 0);
  }, [pvd]);

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await api.get(`/StockLog/logs/${pvd.productVariantDetailId}`);
      setLogs(res.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [pvd.productVariantDetailId]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/StockLog/update/${pvd.productVariantDetailId}`, {
        stockQuantity: totalQty,
        processedQuantity: processedQty,
        returnedQuantity: returnedQty,
        note: note || null,
        changedBy: "Admin",
      });
      toast.success("Stock updated & logged");
      setNote("");
      await loadLogs();
      onSaved();
    } catch {
      toast.error("Failed to update stock");
    } finally {
      setSaving(false);
    }
  }

  const sizeParts: string[] = [];
  if (pvd.sizeLabel) sizeParts.push(pvd.sizeLabel);
  if (pvd.cupSizeLabel) sizeParts.push(pvd.cupSizeLabel);
  const sizeDisplay = sizeParts.join(" / ") || "—";

  return (
    <div
      style={{
        border: `1.5px solid ${BDR}`,
        borderRadius: 14,
        background: WHITE,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(122,30,44,0.07)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1.5px solid ${BDR}`,
          background: PLT,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: P }}>
            {sizeDisplay}
          </div>
          {pvd.stockId && (
            <div
              style={{
                fontSize: 11,
                color: SUB,
                fontFamily: "'Courier New',monospace",
                marginTop: 2,
              }}
            >
              #{pvd.stockId}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge pvd={{ ...pvd, availableQuantity: available }} />
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1.5px solid ${BDR}`,
              background: WHITE,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: SUB,
            }}
          >
            <i className="bi bi-x" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1.5px solid ${BDR}` }}>
        {(["edit", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: activeTab === tab ? P : SUB,
              background: activeTab === tab ? PLT : WHITE,
              borderBottom:
                activeTab === tab
                  ? `2.5px solid ${P}`
                  : "2.5px solid transparent",
            }}
          >
            {tab === "edit" ? "✏️ Edit Stock" : `📋 History (${logs.length})`}
          </button>
        ))}
      </div>

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div style={{ padding: 18 }}>
          {/* Live stock preview */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-around",
              background: GRY,
              borderRadius: 10,
              padding: "14px 10px",
              marginBottom: 18,
            }}
          >
            <Pill val={totalQty} color="#1565c0" bg="#e3f2fd" label="Total" />
            <Pill
              val={processedQty}
              color="#6a1b9a"
              bg="#f3e5f5"
              label="Processed"
            />
            <Pill
              val={returnedQty}
              color="#795548"
              bg="#efebe9"
              label="Returned"
            />
            <Pill
              val={available}
              color={availColor}
              bg={availBg}
              label="Available"
            />
          </div>

          {/* Formula hint */}
          <div
            style={{
              fontSize: 11,
              color: SUB,
              background: "#fffbf8",
              border: `1px dashed ${BDR}`,
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Available = Total − Processed + Returned
          </div>

          {/* Fields */}
          {[
            {
              label: "Total Stock (Uploaded)",
              key: "total",
              value: totalQty,
              setter: setTotalQty,
              hint: "Number of units you received / uploaded",
            },
            {
              label: "Processed (Orders)",
              key: "processed",
              value: processedQty,
              setter: setProcessedQty,
              hint: "Units shipped out via orders (usually auto-updated)",
            },
            {
              label: "Returned Stock",
              key: "returned",
              value: returnedQty,
              setter: setReturnedQty,
              hint: "Units returned by customers and added back",
            },
          ].map(({ label, key, value, setter, hint }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: SUB,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                {label}
              </label>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setter(Math.max(0, Number(e.target.value)))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: `1.5px solid ${BDR}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: TXT,
                  background: WHITE,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = P)}
                onBlur={(e) => (e.target.style.borderColor = BDR)}
              />
              <div style={{ fontSize: 10, color: SUB, marginTop: 3 }}>
                {hint}
              </div>
            </div>
          ))}

          {/* Note */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 700,
                color: SUB,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received new batch from supplier..."
              style={{
                width: "100%",
                padding: "9px 12px",
                border: `1.5px solid ${BDR}`,
                borderRadius: 8,
                fontSize: 13,
                color: TXT,
                background: WHITE,
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = P)}
              onBlur={(e) => (e.target.style.borderColor = BDR)}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: "11px 0",
              background: saving ? "#b0b0b0" : P,
              color: WHITE,
              border: "none",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Saving…" : "💾 Save Stock & Log Change"}
          </button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div style={{ padding: 18 }}>
          {loadingLogs ? (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: SUB,
                fontSize: 13,
              }}
            >
              Loading history…
            </div>
          ) : logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: SUB,
                fontSize: 13,
                background: GRY,
                borderRadius: 10,
              }}
            >
              No stock changes recorded yet.
              <br />
              <span style={{ fontSize: 11 }}>
                Changes will appear here after the first edit.
              </span>
            </div>
          ) : (
            (() => {
              const groups = groupLogs(logs);
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Summary count */}
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 2 }}>
                    {groups.length} change event{groups.length !== 1 ? "s" : ""}{" "}
                    &nbsp;·&nbsp; {logs.length} log entr
                    {logs.length !== 1 ? "ies" : "y"}
                  </div>

                  {groups.map((group, gi) => {
                    const dt = fmtDateFull(group.sessionTime);
                    // Determine which fields changed in this session
                    const changedFields = group.entries.map(
                      (e) => e.changeType,
                    );
                    const isInitial = changedFields.includes("INITIAL_STOCK");

                    // Build diff rows: for each changed field, find prev/new
                    const fieldMap: Record<
                      string,
                      { prev: number | null; next: number | null }
                    > = {};
                    for (const entry of group.entries) {
                      fieldMap[entry.changeType] = {
                        prev: entry.previousValue,
                        next: entry.newValue,
                      };
                    }

                    // Snapshot from any entry (post-save state)
                    const snap = group.snapshot;

                    // Border accent: red if any decrease, green if all increases, blue for initial
                    const hasDecrease = group.entries.some(
                      (e) => (e.newValue ?? 0) < (e.previousValue ?? 0),
                    );
                    const accentColor = isInitial
                      ? "#e65100"
                      : hasDecrease
                      ? "#c62828"
                      : "#2e7d32";
                    const accentBg = isInitial
                      ? "#fff3e0"
                      : hasDecrease
                      ? "#fdecea"
                      : "#e8f5e9";

                    // Friendly label map
                    const fieldLabel: Record<string, string> = {
                      TOTAL_STOCK: "Total Stock",
                      PROCESSED: "Processed",
                      RETURNED: "Returned",
                      AVAILABLE: "Available",
                      INITIAL_STOCK: "Initial Stock",
                    };

                    return (
                      <div
                        key={gi}
                        style={{
                          border: `1.5px solid ${BDR}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: WHITE,
                          borderLeft: `4px solid ${accentColor}`,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        }}
                      >
                        {/* ── Header: timestamp + who ─────────────────── */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            padding: "10px 14px 8px",
                            borderBottom: `1px solid ${BDR}`,
                            background: GRY,
                            gap: 8,
                          }}
                        >
                          <div>
                            {/* Event label */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: accentColor,
                                  background: accentBg,
                                  borderRadius: 20,
                                  padding: "2px 8px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {isInitial
                                  ? "📦 Initial Stock"
                                  : `✏️ Stock Edit · ${
                                      group.entries.length
                                    } field${
                                      group.entries.length !== 1 ? "s" : ""
                                    } changed`}
                              </span>
                            </div>
                            {/* Day + Date */}
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: TXT,
                              }}
                            >
                              {dt.dayName}, {dt.date}
                            </div>
                            {/* Time + relative */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginTop: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  color: P,
                                  fontWeight: 700,
                                }}
                              >
                                🕐 {dt.time}
                              </span>
                              {dt.relative && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: WHITE,
                                    background: SUB,
                                    borderRadius: 20,
                                    padding: "1px 7px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {dt.relative}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Who + stock ID */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {group.changedBy && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  justifyContent: "flex-end",
                                  marginBottom: 4,
                                }}
                              >
                                <i
                                  className="bi bi-person-circle"
                                  style={{ fontSize: 12, color: SUB }}
                                />
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: TXT,
                                  }}
                                >
                                  {group.changedBy}
                                </span>
                              </div>
                            )}
                            {group.entries[0]?.stockId && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#5d4037",
                                  background: "#efebe9",
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  fontFamily: "'Courier New',monospace",
                                  fontWeight: 700,
                                  display: "inline-block",
                                }}
                              >
                                #{group.entries[0].stockId}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── What Changed ───────────────────────────── */}
                        <div style={{ padding: "10px 14px" }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: SUB,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 8,
                            }}
                          >
                            What Changed
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 5,
                            }}
                          >
                            {group.entries.map((entry) => {
                              const delta =
                                (entry.newValue ?? 0) -
                                (entry.previousValue ?? 0);
                              const { color, bg } = colorFor(entry.changeType);
                              const isIncrease = delta > 0;
                              const isDecrease = delta < 0;
                              return (
                                <div
                                  key={entry.stockLogId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 10px",
                                    background: bg,
                                    borderRadius: 8,
                                    border: `1px solid ${color}22`,
                                  }}
                                >
                                  {/* Field label */}
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color,
                                      minWidth: 90,
                                    }}
                                  >
                                    {fieldLabel[entry.changeType] ??
                                      entry.changeType.replace(/_/g, " ")}
                                  </span>

                                  {/* Before → After */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      flex: 1,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: "#888",
                                        background: WHITE,
                                        borderRadius: 5,
                                        padding: "1px 8px",
                                        border: `1px solid ${BDR}`,
                                        minWidth: 32,
                                        textAlign: "center",
                                      }}
                                    >
                                      {entry.previousValue ?? "—"}
                                    </span>
                                    <span style={{ fontSize: 14, color: SUB }}>
                                      →
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color,
                                        background: WHITE,
                                        borderRadius: 5,
                                        padding: "1px 8px",
                                        border: `1.5px solid ${color}`,
                                        minWidth: 32,
                                        textAlign: "center",
                                      }}
                                    >
                                      {entry.newValue ?? "—"}
                                    </span>
                                  </div>

                                  {/* Delta badge */}
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 800,
                                      color: isIncrease
                                        ? "#2e7d32"
                                        : isDecrease
                                        ? "#c62828"
                                        : SUB,
                                      background: isIncrease
                                        ? "#e8f5e9"
                                        : isDecrease
                                        ? "#fdecea"
                                        : GRY,
                                      borderRadius: 20,
                                      padding: "2px 8px",
                                      minWidth: 40,
                                      textAlign: "center",
                                    }}
                                  >
                                    {delta > 0
                                      ? `+${delta}`
                                      : delta === 0
                                      ? "±0"
                                      : delta}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── Snapshot after save ─────────────────────── */}
                        <div
                          style={{
                            margin: "0 14px 10px",
                            background: GRY,
                            borderRadius: 8,
                            padding: "8px 12px",
                            border: `1px dashed ${BDR}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: SUB,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 6,
                            }}
                          >
                            Stock Snapshot After This Save
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            {[
                              {
                                l: "Total",
                                v: snap.totalStock,
                                c: "#1565c0",
                                b: "#e3f2fd",
                              },
                              {
                                l: "Processed",
                                v: snap.processedQuantity,
                                c: "#6a1b9a",
                                b: "#f3e5f5",
                              },
                              {
                                l: "Returned",
                                v: snap.returnedQuantity,
                                c: "#795548",
                                b: "#efebe9",
                              },
                              {
                                l: "Available",
                                v: snap.availableQuantity,
                                c: "#2e7d32",
                                b: "#e8f5e9",
                              },
                            ].map(({ l, v, c, b }) => (
                              <div
                                key={l}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: SUB,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {l}
                                </span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: c,
                                    background: b,
                                    borderRadius: 4,
                                    padding: "1px 7px",
                                  }}
                                >
                                  {v ?? "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ── Note ───────────────────────────────────── */}
                        {group.note && (
                          <div
                            style={{
                              margin: "0 14px 12px",
                              padding: "8px 12px",
                              background: "#fffbf0",
                              border: `1px solid #ffe082`,
                              borderRadius: 8,
                              display: "flex",
                              gap: 8,
                              alignItems: "flex-start",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>💬</span>
                            <span
                              style={{
                                fontSize: 12,
                                color: TXT,
                                fontStyle: "italic",
                                lineHeight: 1.5,
                              }}
                            >
                              {group.note}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

// ─── PVD Row ──────────────────────────────────────────────────────────────────
function PvdRow({
  pvd,
  isOpen,
  onToggle,
  onSaved,
}: {
  pvd: any;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const total = pvd.stockQuantity ?? 0;
  const processed = pvd.processedQuantity ?? 0;
  const returned = pvd.returnedQuantity ?? 0;
  const available =
    pvd.availableQuantity ?? Math.max(0, total - processed + returned);

  const sizeLabel =
    [pvd.sizeLabel, pvd.cupSizeLabel].filter(Boolean).join(" / ") || "—";

  return (
    <div style={{ borderBottom: `1px solid ${BDR}` }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          cursor: "pointer",
          background: isOpen ? PLT : WHITE,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) (e.currentTarget as HTMLElement).style.background = GRY;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isOpen
            ? PLT
            : WHITE;
        }}
      >
        {/* Size */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isOpen ? P : TXT,
            minWidth: 80,
          }}
        >
          {sizeLabel}
        </div>

        {/* Stock pills */}
        <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          {[
            { l: "Total", v: total, c: "#1565c0", b: "#e3f2fd" },
            { l: "Processed", v: processed, c: "#6a1b9a", b: "#f3e5f5" },
            { l: "Returned", v: returned, c: "#795548", b: "#efebe9" },
            {
              l: "Available",
              v: available,
              c:
                available <= 0
                  ? "#c62828"
                  : available <= 3
                  ? "#e65100"
                  : "#2e7d32",
              b:
                available <= 0
                  ? "#fdecea"
                  : available <= 3
                  ? "#fff3e0"
                  : "#e8f5e9",
            },
          ].map(({ l, v, c, b }) => (
            <div
              key={l}
              style={{ display: "flex", alignItems: "center", gap: 3 }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: SUB,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {l}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: c,
                  background: b,
                  borderRadius: 5,
                  padding: "1px 7px",
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>

        <StatusBadge pvd={{ ...pvd, availableQuantity: available }} />
        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 11, color: SUB, flexShrink: 0 }}
        />
      </div>

      {isOpen && (
        <div style={{ padding: "0 14px 14px" }}>
          <StockDetailPanel pvd={pvd} onClose={onToggle} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

// ─── Variant Row ──────────────────────────────────────────────────────────────
function VariantRow({
  variant,
  isOpen,
  onToggle,
  targetPvdId,
}: {
  variant: any;
  isOpen: boolean;
  onToggle: () => void;
  targetPvdId?: number | null;
}) {
  const [pvds, setPvds] = useState<any[]>([]);
  const [loadingPvds, setLoadingPvds] = useState(false);
  const [openPvd, setOpenPvd] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingPvds(true);
    api
      .get(`/StockLog/pvds/${variant.productVariantId}`)
      .then((r) => {
        const data = r.data ?? [];
        setPvds(data);
        // Auto-open target pvd if navigated from ProductDetail
        if (
          targetPvdId &&
          data.find((p: any) => p.productVariantDetailId === targetPvdId)
        ) {
          setOpenPvd(targetPvdId);
          // Scroll to panel after a brief paint delay
          setTimeout(() => {
            const el = document.getElementById(`pvd-${targetPvdId}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        }
      })
      .catch(() => setPvds([]))
      .finally(() => setLoadingPvds(false));
  }, [isOpen, variant.productVariantId, targetPvdId]);

  const reloadPvds = useCallback(() => {
    api
      .get(`/StockLog/pvds/${variant.productVariantId}`)
      .then((r) => setPvds(r.data ?? []));
  }, [variant.productVariantId]);

  const totalStock = pvds.reduce((s, p) => s + (p.stockQuantity ?? 0), 0);
  const totalAvail = pvds.reduce((s, p) => s + (p.availableQuantity ?? 0), 0);

  const colorHex = variant.color?.startsWith("#") ? variant.color : null;

  return (
    <div style={{ borderBottom: `1px solid ${BDR}` }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          cursor: "pointer",
          background: isOpen ? "#fdf6f4" : WHITE,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) (e.currentTarget as HTMLElement).style.background = GRY;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isOpen
            ? "#fdf6f4"
            : WHITE;
        }}
      >
        {/* Color swatch */}
        {colorHex ? (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: colorHex,
              border: "1.5px solid #ddd",
              flexShrink: 0,
            }}
          />
        ) : (
          <i className="bi bi-palette" style={{ fontSize: 14, color: SUB }} />
        )}

        <div style={{ flex: 1 }}>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: isOpen ? P : TXT }}
          >
            {variant.variantName ||
              variant.color ||
              `Variant #${variant.productVariantId}`}
          </div>
          <div style={{ fontSize: 11, color: SUB }}>
            {pvds.length} size{pvds.length !== 1 ? "s" : ""} &nbsp;·&nbsp; Total
            stock: {totalStock} &nbsp;·&nbsp; Available: {totalAvail}
          </div>
        </div>

        {!variant.isActive && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#888",
              background: "#eee",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            Inactive
          </span>
        )}
        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 11, color: SUB }}
        />
      </div>

      {isOpen && (
        <div style={{ borderTop: `1px solid ${BDR}` }}>
          {loadingPvds ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: SUB,
                fontSize: 13,
              }}
            >
              Loading sizes…
            </div>
          ) : pvds.length === 0 ? (
            <div style={{ padding: "16px 18px", color: SUB, fontSize: 13 }}>
              No sizes configured for this variant.
            </div>
          ) : (
            pvds.map((pvd) => (
              <div
                key={pvd.productVariantDetailId}
                id={`pvd-${pvd.productVariantDetailId}`}
              >
                <PvdRow
                  pvd={pvd}
                  isOpen={openPvd === pvd.productVariantDetailId}
                  onToggle={() =>
                    setOpenPvd((prev) =>
                      prev === pvd.productVariantDetailId
                        ? null
                        : pvd.productVariantDetailId,
                    )
                  }
                  onSaved={reloadPvds}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────
function ProductRow({
  product,
  isOpen,
  onToggle,
  targetVariantId,
  targetPvdId,
}: {
  product: any;
  isOpen: boolean;
  onToggle: () => void;
  targetVariantId?: number | null;
  targetPvdId?: number | null;
}) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [openVariant, setOpenVariant] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingVariants(true);
    api
      .get(`/StockLog/variants/${product.productId}`)
      .then((r) => {
        const data = r.data ?? [];
        setVariants(data);
        // Auto-open target variant if navigated from ProductDetail
        if (
          targetVariantId &&
          data.find((v: any) => v.productVariantId === targetVariantId)
        ) {
          setOpenVariant(targetVariantId);
        }
      })
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [isOpen, product.productId, targetVariantId]);

  const thumb = imgUrl(product.image);

  return (
    <div
      style={{
        border: `1.5px solid ${isOpen ? P : BDR}`,
        borderRadius: 12,
        overflow: "hidden",
        background: WHITE,
        boxShadow: isOpen ? `0 4px 16px rgba(122,30,44,0.08)` : "none",
        transition: "all 0.2s",
      }}
    >
      {/* Product header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          cursor: "pointer",
          background: isOpen ? PLT : WHITE,
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            overflow: "hidden",
            border: `1.5px solid ${BDR}`,
            flexShrink: 0,
            background: GRY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <i
              className="bi bi-image"
              style={{ fontSize: 20, color: "#ccc" }}
            />
          )}
        </div>

        {/* Name + code */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: isOpen ? P : TXT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name || "Unnamed Product"}
          </div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
            <span
              style={{
                fontFamily: "'Courier New',monospace",
                background: GRY,
                borderRadius: 4,
                padding: "1px 6px",
                border: `1px solid ${BDR}`,
              }}
            >
              {product.productCode || `#${product.productId}`}
            </span>
          </div>
        </div>

        <i
          className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
          style={{ fontSize: 12, color: SUB, flexShrink: 0 }}
        />
      </div>

      {/* Variants */}
      {isOpen && (
        <div style={{ borderTop: `1.5px solid ${BDR}` }}>
          {loadingVariants ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: SUB,
                fontSize: 13,
              }}
            >
              Loading variants…
            </div>
          ) : variants.length === 0 ? (
            <div style={{ padding: 16, color: SUB, fontSize: 13 }}>
              No variants found.
            </div>
          ) : (
            variants.map((v) => (
              <VariantRow
                key={v.productVariantId}
                variant={v}
                isOpen={openVariant === v.productVariantId}
                onToggle={() =>
                  setOpenVariant((prev) =>
                    prev === v.productVariantId ? null : v.productVariantId,
                  )
                }
                targetPvdId={
                  targetVariantId === v.productVariantId ? targetPvdId : null
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminStock() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openProduct, setOpenProduct] = useState<number | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const SIZE = 30;

  async function handleBackfill() {
    if (
      !window.confirm(
        "Seed StockLog from existing product data?\nThis is safe to run multiple times — already-logged items are skipped.",
      )
    )
      return;
    setBackfilling(true);
    try {
      const res = await api.post("/StockLog/backfill");
      toast.success(`✅ ${res.data.message}`);
    } catch {
      toast.error("Backfill failed — check server logs");
    } finally {
      setBackfilling(false);
    }
  }

  // If navigated here with pvdId from ProductDetail, auto-open that product
  const pvdIdParam = searchParams.get("pvdId");
  const productIdParam = searchParams.get("productId");
  const variantIdParam = searchParams.get("variantId");

  useEffect(() => {
    if (productIdParam) setOpenProduct(Number(productIdParam));
  }, [productIdParam]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await api.get("/StockLog/products", {
        params: { page, size: SIZE, search: debouncedSearch },
      });
      setProducts(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [page, debouncedSearch]);

  const totalPages = Math.ceil(total / SIZE);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "inherit" }}>
      {/* Page header */}
      <div
        style={{
          background: WHITE,
          borderBottom: `1.5px solid ${BDR}`,
          padding: "18px 28px 14px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: SUB,
              fontSize: 18,
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <i className="bi bi-arrow-left" />
          </button>
          <div>
            <h1
              style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TXT }}
            >
              Stock Management
            </h1>
            <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
              {total} product{total !== 1 ? "s" : ""} &nbsp;·&nbsp; Click a
              product to see variants and manage stock
            </div>
          </div>

          {/* Search */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* One-time backfill button */}
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              title="Seed StockLog from existing ProductVariantDetail data (safe to run multiple times)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: `1.5px solid ${BDR}`,
                background: backfilling ? GRY : PLT,
                color: P,
                fontSize: 12,
                fontWeight: 700,
                cursor: backfilling ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <i
                className={`bi ${
                  backfilling ? "bi-hourglass-split" : "bi-database-fill-up"
                }`}
              />
              {backfilling ? "Seeding…" : "Seed Stock Log"}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `1.5px solid ${BDR}`,
                borderRadius: 9,
                background: WHITE,
                padding: "6px 12px",
                gap: 8,
                minWidth: 240,
              }}
            >
              <i
                className="bi bi-search"
                style={{ color: SUB, fontSize: 13 }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name or code…"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: TXT,
                  background: "transparent",
                  flex: 1,
                  fontFamily: "inherit",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: SUB,
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  <i className="bi bi-x" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "12px 28px",
          flexWrap: "wrap",
          borderBottom: `1px solid ${BDR}`,
          background: "#fdfaf8",
        }}
      >
        {[
          { color: "#1565c0", bg: "#e3f2fd", label: "Total — units received" },
          {
            color: "#6a1b9a",
            bg: "#f3e5f5",
            label: "Processed — orders placed",
          },
          {
            color: "#795548",
            bg: "#efebe9",
            label: "Returned — customer returns",
          },
          {
            color: "#2e7d32",
            bg: "#e8f5e9",
            label: "Available = Total − Processed + Returned",
          },
        ].map(({ color, bg, label }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: SUB }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Product list */}
      <div
        style={{
          padding: "20px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: SUB,
              fontSize: 14,
            }}
          >
            <i
              className="bi bi-arrow-repeat"
              style={{ fontSize: 24, animation: "spin 1s linear infinite" }}
            />
            <br />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: SUB,
              fontSize: 14,
              background: WHITE,
              borderRadius: 12,
              border: `1.5px solid ${BDR}`,
            }}
          >
            <i
              className="bi bi-box-seam"
              style={{ fontSize: 36, display: "block", marginBottom: 12 }}
            />
            No products found{search ? ` for "${search}"` : ""}.
          </div>
        ) : (
          products.map((p) => (
            <ProductRow
              key={p.productId}
              product={p}
              isOpen={openProduct === p.productId}
              onToggle={() =>
                setOpenProduct((prev) =>
                  prev === p.productId ? null : p.productId,
                )
              }
              targetVariantId={
                openProduct === p.productId && variantIdParam
                  ? Number(variantIdParam)
                  : null
              }
              targetPvdId={
                openProduct === p.productId && pvdIdParam
                  ? Number(pvdIdParam)
                  : null
              }
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "16px 28px 32px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: "7px 14px",
              border: `1.5px solid ${BDR}`,
              borderRadius: 8,
              background: WHITE,
              color: page <= 1 ? "#ccc" : TXT,
              cursor: page <= 1 ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: SUB }}>
            Page {page} of {totalPages} &nbsp;({total} products)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: "7px 14px",
              border: `1.5px solid ${BDR}`,
              borderRadius: 8,
              background: WHITE,
              color: page >= totalPages ? "#ccc" : TXT,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
