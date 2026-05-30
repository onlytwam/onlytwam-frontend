import React, { useCallback, useRef, useState } from "react";

const BASE = `${
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"
}/BulkImport/product-bulk`;

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    null
  );
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${getToken()}`,
    ...(options.headers || {}),
  };
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (networkErr: unknown) {
    throw new Error(`Network error — is the server running? (${networkErr instanceof Error ? networkErr.message : String(networkErr)})`);
  }
  if (!res.ok) {
    if (res.status === 401) {
      ["token","access_token"].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
      throw new Error("Session expired — please log in again. (401 Unauthorized)");
    }
    if (res.status === 403) throw new Error("You do not have permission to perform this action. (403 Forbidden)");
    if (res.status === 404) throw new Error(`Endpoint not found: ${BASE}${path} (404)`);
    if (res.status === 422) {
      let detail = "Validation error";
      try {
        const body = await res.json();
        if (Array.isArray(body?.detail)) detail = body.detail.map((d: { loc?: string[]; msg: string }) => `${d.loc?.join(".")}: ${d.msg}`).join("; ");
        else if (typeof body?.detail === "string") detail = body.detail;
      } catch { /* ignore */ }
      throw new Error(detail);
    }
    let errMsg = `Server error (${res.status})`;
    try { const body = await res.json(); errMsg = body?.detail || body?.message || errMsg; } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  return res;
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --brand:#6B0F2A; --brand-lt:#8C3120; --brand-bg:#FBF4F1;
    --ok:#047857;    --ok-bg:#F0FDF4;    --ok-bd:#6EE7B7;
    --err:#B91C1C;   --err-bg:#FEF2F2;   --err-bd:#FCA5A5;
    --warn:#92400E;  --warn-bg:#FFFBEB;  --warn-bd:#FCD34D;
    --dup:#7C3AED;   --dup-bg:#F5F3FF;   --dup-bd:#C4B5FD;
    --surface:#fff;  --canvas:#F8F7F5;
    --border:#E8E3DC; --muted:#A09890;   --text:#1A1917;
    --mono:'DM Mono',monospace;
  }
  body{font-family:'DM Sans',system-ui,sans-serif;background:var(--canvas);color:var(--text);}
  .wrap{max-width:960px;margin:0 auto;padding:32px 24px 64px;}
  .hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:28px;}
  .hdr-left h1{font-size:22px;font-weight:600;letter-spacing:-.3px;}
  .hdr-left p{font-size:13px;color:var(--muted);margin-top:3px;}
  .steps{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px;}
  .step{flex:1;display:flex;align-items:center;gap:9px;padding:13px 16px;font-size:12px;font-weight:500;color:var(--muted);border-right:1px solid var(--border);}
  .step:last-child{border-right:none;}
  .step.active{background:var(--brand-bg);color:var(--brand-lt);}
  .step.done{color:var(--ok);}
  .step-n{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:var(--border);color:var(--muted);}
  .step.active .step-n{background:var(--brand);color:#fff;}
  .step.done .step-n{background:var(--ok);color:#fff;}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:26px 28px;margin-bottom:20px;}
  .card-ttl{font-size:15px;font-weight:600;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
  .badge{font-size:11px;padding:2px 10px;border-radius:20px;font-weight:600;margin-left:auto;}
  .badge-run{background:var(--warn-bg);color:var(--warn);border:1px solid var(--warn-bd);}
  .badge-done{background:var(--ok-bg);color:var(--ok);border:1px solid var(--ok-bd);}
  .dl-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:22px;border:1.5px solid var(--brand);background:#fff;color:var(--brand);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s;font-family:inherit;}
  .dl-btn:hover{background:var(--brand);color:#fff;}
  .auth-warn{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;margin-bottom:18px;font-size:13px;color:#92400E;line-height:1.6;}
  .auth-warn strong{display:block;margin-bottom:4px;}
  .auth-warn code{font-family:var(--mono);font-size:11px;background:rgba(0,0,0,.07);padding:1px 5px;border-radius:3px;}
  .drop{border:2px dashed var(--border);border-radius:10px;padding:52px 32px;text-align:center;cursor:pointer;transition:all .2s;background:#FDFCFB;}
  .drop:hover,.drop.drag{border-color:var(--brand);background:var(--brand-bg);}
  .drop-ico{font-size:36px;margin-bottom:14px;display:block;}
  .drop-title{font-size:16px;font-weight:600;margin-bottom:5px;}
  .drop-sub{font-size:13px;color:var(--muted);}
  .drop-badge{display:inline-block;margin-top:12px;padding:3px 13px;background:#F0EBE4;border-radius:20px;font-size:11px;font-family:var(--mono);color:var(--brand);font-weight:600;}
  .tip{display:flex;gap:8px;margin-top:16px;padding:11px 15px;background:#FFFBF0;border-radius:8px;border:1px solid #F0D9A0;font-size:12px;color:var(--warn);line-height:1.6;}
  .how{background:var(--brand-bg);border:1px solid #EAD2CA;border-radius:12px;padding:18px 22px;margin-bottom:20px;}
  .how-title{font-size:13px;font-weight:600;color:var(--brand-lt);margin-bottom:14px;display:flex;align-items:center;gap:7px;}
  .how-flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .how-card{background:#fff;border-radius:9px;padding:11px 16px;flex:1;min-width:140px;}
  .how-card-name{font-size:13px;font-weight:600;}
  .how-card-key{font-size:11px;color:var(--muted);margin-top:3px;font-family:var(--mono);}
  .how-warn{margin-top:12px;font-size:12px;color:var(--warn);display:flex;gap:6px;line-height:1.5;}
  .preview-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px;}
  .pstat{padding:14px 16px;border-radius:10px;border:1.5px solid var(--border);}
  .pstat-n{font-size:24px;font-weight:600;}
  .pstat-l{font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-top:2px;}
  .pstat.total{background:#F8F7F5;} .pstat.total .pstat-n{color:var(--text);}
  .pstat.ok{background:var(--ok-bg);border-color:var(--ok-bd);} .pstat.ok .pstat-n,.pstat.ok .pstat-l{color:var(--ok);}
  .pstat.err{background:var(--err-bg);border-color:var(--err-bd);} .pstat.err .pstat-n,.pstat.err .pstat-l{color:var(--err);}
  .pstat.dup{background:var(--dup-bg);border-color:var(--dup-bd);} .pstat.dup .pstat-n,.pstat.dup .pstat-l{color:var(--dup);}
  .pstat.imp{background:#EFF6FF;border-color:#93C5FD;} .pstat.imp .pstat-n,.pstat.imp .pstat-l{color:#2563EB;}
  .tbl-wrap{overflow:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:18px;max-height:400px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;padding:8px 12px;background:#F8F7F5;color:var(--muted);font-weight:600;position:sticky;top:0;z-index:1;border-bottom:1px solid var(--border);white-space:nowrap;}
  td{padding:8px 12px;border-bottom:1px solid #F5F0EA;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  tr.row-err td{background:#FFF8F8;}
  tr.row-dup td{background:#FAF5FF;}
  .status-ok{color:var(--ok);font-weight:700;font-size:11px;}
  .status-err{color:var(--err);font-weight:700;font-size:11px;}
  .status-dup{color:var(--dup);font-weight:700;font-size:11px;}
  .issue-item{color:var(--err);font-size:11px;line-height:1.5;}
  .dup-item{color:var(--dup);font-size:11px;line-height:1.5;}
  .mono{font-family:var(--mono);font-size:11px;}
  .stock-dup-pill{display:inline-block;background:#FEE2E2;color:#B91C1C;border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;font-weight:700;border:1px solid #FCA5A5;}
  .feed{max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;background:#FDFCFB;}
  .log-row{display:flex;align-items:flex-start;gap:10px;padding:9px 11px;border-radius:7px;margin-bottom:4px;}
  .log-ok{background:var(--ok-bg);} .log-err{background:var(--err-bg);} .log-skip{background:var(--warn-bg);} .log-dup{background:var(--dup-bg);}
  .log-ico{font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px;width:14px;text-align:center;}
  .log-ok .log-ico{color:var(--ok);} .log-err .log-ico{color:var(--err);} .log-skip .log-ico{color:var(--warn);} .log-dup .log-ico{color:var(--dup);}
  .log-code{font-family:var(--mono);font-size:12px;font-weight:600;}
  .log-tag{display:inline-flex;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px;text-transform:uppercase;}
  .log-ok .log-tag{background:#DCFCE7;color:var(--ok);}
  .log-err .log-tag{background:#FEE2E2;color:var(--err);}
  .log-skip .log-tag{background:#FEF9C3;color:var(--warn);}
  .log-dup .log-tag{background:#EDE9FE;color:var(--dup);}
  .log-msg{font-size:11px;color:var(--muted);margin-top:2px;}
  .feed-empty{text-align:center;padding:28px;font-size:13px;color:var(--muted);}
  .pills{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;}
  .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;}
  .pill-ok{background:var(--ok-bg);color:var(--ok);border:1px solid var(--ok-bd);}
  .pill-skip{background:var(--warn-bg);color:var(--warn);border:1px solid var(--warn-bd);}
  .pill-dup{background:var(--dup-bg);color:var(--dup);border:1px solid var(--dup-bd);}
  .pill-err{background:var(--err-bg);color:var(--err);border:1px solid var(--err-bd);}
  .btn-row{display:flex;gap:10px;justify-content:flex-end;padding-top:18px;border-top:1px solid var(--border);}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .15s;font-family:inherit;}
  .btn:disabled{opacity:.45;cursor:not-allowed;}
  .btn-ghost{background:#fff;color:var(--text);border:1px solid var(--border);}
  .btn-ghost:hover:not(:disabled){border-color:var(--muted);}
  .btn-green{background:#059669;color:#fff;}
  .btn-green:hover:not(:disabled){background:#047857;}
  .dots{text-align:center;padding:48px;color:var(--muted);font-size:13px;}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--brand);margin:0 3px;animation:dp 1.2s ease infinite;}
  .dot:nth-child(2){animation-delay:.2s;} .dot:nth-child(3){animation-delay:.4s;}
  @keyframes dp{0%,100%{opacity:.2;transform:scale(.8);}50%{opacity:1;transform:scale(1);}}
  .err-banner{background:var(--err-bg);border:1px solid var(--err-bd);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--err);margin-bottom:16px;display:flex;gap:8px;align-items:flex-start;line-height:1.6;}
  .dup-panel{margin-bottom:18px;border:1.5px solid var(--dup-bd);border-radius:10px;overflow:hidden;}
  .dup-panel-hdr{background:var(--dup-bg);padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--dup-bd);}
  .dup-panel-title{font-weight:600;color:var(--dup);font-size:13px;}
  .dup-panel-sub{font-size:12px;color:#5B21B6;margin-top:2px;}
  .dup-tbl-wrap{overflow-x:auto;max-height:260px;overflow-y:auto;}
  .dup-tbl{width:100%;border-collapse:collapse;font-size:12px;}
  .dup-tbl th{padding:8px 14px;text-align:left;color:#9CA3AF;font-weight:600;border-bottom:1px solid var(--dup-bd);background:#FAF5FF;white-space:nowrap;}
  .dup-tbl td{padding:8px 14px;border-bottom:1px solid #EDE9FE;}
  .dup-tbl tr:last-child td{border-bottom:none;}
  .dup-tbl tr:nth-child(even) td{background:#F5F3FF;}
`;

const STEPS = ["Download Template", "Upload File", "Preview & Validate", "Import"];

function StepBar({ active }: { active: number }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const n = i + 1, isDone = n < active, isActive = n === active;
        return (
          <div key={n} className={`step${isActive ? " active" : ""}${isDone ? " done" : ""}`}>
            <div className="step-n">{isDone ? "✓" : n}</div>
            {label}
          </div>
        );
      })}
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="how">
      <div className="how-title">📋 Hierarchical format — PRODUCT → VARIANT → SIZE rows</div>
      <div className="how-flow">
        {[
          { color:"#7C3AED", bg:"#F5F2FF", bd:"#C2AFFC", label:"PRODUCT row", key:"Code, Name, Category, Brand" },
          { color:"#2563EB", bg:"#EFF6FF", bd:"#93C5FD", label:"VARIANT row", key:"Variant Code, Color, Fabric, HSN" },
          { color:"#059669", bg:"#F0FDF4", bd:"#6EE7B7", label:"SIZE row",    key:"Stock ID, Size, MRP, Price, Qty, Date" },
        ].map((c, i) => (
          <React.Fragment key={c.label}>
            <div className="how-card" style={{ border:`1.5px solid ${c.bd}`, background:c.bg }}>
              <div className="how-card-name" style={{ color:c.color }}>{c.label}</div>
              <div className="how-card-key">{c.key}</div>
            </div>
            {i < 2 && <span style={{ color:"#C4B9B0", fontSize:18 }}>→</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="how-warn">
        ⚠️ Rows with validation errors or duplicate Stock IDs are shown in preview but <strong>skipped on import</strong>.
      </div>
    </div>
  );
}

function AuthWarning() {
  if (getToken()) return null;
  return (
    <div className="auth-warn">
      <span style={{ fontSize:20 }}>⚠️</span>
      <div>
        <strong>No auth token found — all requests will return 401</strong>
        Token is read from <code>localStorage.token</code> or <code>localStorage.access_token</code>.
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewRow {
  [key: string]: unknown;
  row?: number;
  status?: string;
  issues?: string[];
  isDuplicateStock?: boolean;
  stockId?: number | string | null;
  productCode?: string;
  productName?: string;
  variantCode?: string;
  color?: string;
  sizeName?: string;
  mrpPrice?: number;
  finalPrice?: number;
  stockQty?: number;
}

interface PreviewResult {
  totalSizeRows: number;
  validRows: number;
  errorRows: number;
  duplicateStockRows: number;
  willImportProducts: number;
  willImportVariants: number;
  willImportDetails: number;
  rows: PreviewRow[];
  canImport: boolean;
  duplicateStockWarnings?: DuplicateStockWarning[];
}

interface DuplicateStockWarning {
  stockId: string;
  variantCode: string;
  productCode: string;
  message: string;
}

interface ImportResult {
  insertedProducts: number;
  insertedVariants: number;
  insertedDetails: number;
  skippedRows: number;
  skippedValidation: number;
  skippedDuplicates: number;
  message: string;
  duplicateStockWarnings?: DuplicateStockWarning[];
  hsnWarnings?: { hsnCodeId: number; variantCode: string; message: string }[];
  storeWarnings?: { storeName: string; variantCode: string; message: string }[];
  warehouseWarnings?: { warehouseName: string; variantCode: string; message: string }[];
}

interface LogItem {
  status: "success" | "error" | "skipped" | "duplicate";
  code: string;
  type: string;
  message: string;
}

// ─── Duplicate warnings panel (reused in preview + done) ─────────────────────

function DupPanel({ warnings, title, sub }: {
  warnings: DuplicateStockWarning[];
  title: string;
  sub: string;
}) {
  if (!warnings.length) return null;
  return (
    <div className="dup-panel">
      <div className="dup-panel-hdr">
        <span style={{ fontSize:18 }}>🔁</span>
        <div>
          <div className="dup-panel-title">{title}</div>
          <div className="dup-panel-sub">{sub}</div>
        </div>
      </div>
      <div className="dup-tbl-wrap">
        <table className="dup-tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Stock ID</th>
              <th>Product Code</th>
              <th>Variant Code</th>
              <th>Action Required</th>
            </tr>
          </thead>
          <tbody>
            {warnings.map((w, i) => (
              <tr key={i}>
                <td style={{ color:"#9CA3AF", fontFamily:"var(--mono)", fontSize:11 }}>{i+1}</td>
                <td><span className="stock-dup-pill">{w.stockId}</span></td>
                <td style={{ fontFamily:"var(--mono)", fontSize:12 }}>{w.productCode || "—"}</td>
                <td style={{ fontFamily:"var(--mono)", fontSize:12 }}>{w.variantCode || "—"}</td>
                <td style={{ fontSize:11, color:"#5B21B6", lineHeight:1.5 }}>
                  Replace <strong>{w.stockId}</strong> with a unique Stock ID and re-upload
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Status</th>
            <th>Stock ID</th>
            <th>Product Code</th>
            <th>Product Name</th>
            <th>Variant Code</th>
            <th>Color</th>
            <th>Size</th>
            <th>MRP</th>
            <th>Final</th>
            <th>Qty</th>
            <th>Issues / Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isDup = r.isDuplicateStock === true;
            const isErr = r.status === "Error";
            return (
              <tr
                key={i}
                className={isDup ? "row-dup" : isErr ? "row-err" : ""}
              >
                <td className="mono">{String(r.row ?? "")}</td>
                <td>
                  {isDup ? (
                    <span className="status-dup">⊘ Duplicate</span>
                  ) : r.status === "OK" ? (
                    <span className="status-ok">✓ OK</span>
                  ) : (
                    <span className="status-err">✕ Error</span>
                  )}
                </td>
                <td className="mono">
                  {isDup
                    ? <span className="stock-dup-pill">{String(r.stockId ?? "—")}</span>
                    : String(r.stockId ?? "—")
                  }
                </td>
                <td className="mono">{r.productCode || "—"}</td>
                <td>{r.productName || "—"}</td>
                <td className="mono">{r.variantCode || "—"}</td>
                <td>{r.color || "—"}</td>
                <td className="mono">{r.sizeName ?? "—"}</td>
                <td className="mono">{r.mrpPrice ?? "—"}</td>
                <td className="mono">{r.finalPrice ?? "—"}</td>
                <td className="mono">{r.stockQty ?? "—"}</td>
                <td>
                  {isDup && (
                    <div className="dup-item">⊘ Stock ID already exists in DB — will be skipped</div>
                  )}
                  {(r.issues?.length ?? 0) > 0
                    ? r.issues!.map((iss, j) => (
                        <div key={j} className="issue-item">• {iss}</div>
                      ))
                    : !isDup && <span style={{ color:"var(--muted)", fontSize:11 }}>—</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminProductBulkUpload() {
  type Stage = "idle" | "previewing" | "previewed" | "importing" | "done" | "error";

  const [stage, setStage]       = React.useState<Stage>("idle");
  const [file, setFile]         = React.useState<File | null>(null);
  const [preview, setPreview]   = React.useState<PreviewResult | null>(null);
  const [result, setResult]     = React.useState<ImportResult | null>(null);
  const [logs, setLogs]         = React.useState<LogItem[]>([]);
  const [importErr, setImportErr] = React.useState("");
  const [isDragging, setDrag]   = React.useState(false);
  const fileRef                 = React.useRef<HTMLInputElement>(null);
  const feedRef                 = React.useRef<HTMLDivElement>(null);

  const downloadTemplate = async () => {
    try {
      const res  = await apiFetch("/template", { method:"GET" });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "twam_product_bulk_template.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setImportErr(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const previewFile = useCallback(async (f: File) => {
    if (!f?.name.endsWith(".xlsx")) { alert("Please upload a .xlsx file only."); return; }
    setFile(f); setStage("previewing"); setPreview(null); setImportErr("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const res  = await apiFetch("/preview", { method:"POST", body:fd });
      const data = await res.json();
      setPreview(data); setStage("previewed");
    } catch (e: unknown) {
      setImportErr(e instanceof Error ? e.message : String(e)); setStage("error");
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) previewFile(f); e.target.value = "";
  };

  const reset = () => {
    setStage("idle"); setFile(null); setPreview(null);
    setResult(null); setLogs([]); setImportErr("");
  };

  const runImport = async () => {
    if (!file) return;
    setStage("importing"); setLogs([]); setResult(null); setImportErr("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res  = await apiFetch("/import", { method:"POST", body:fd });
      const data: ImportResult = await res.json();
      setResult(data);

      const feed: LogItem[] = [];
      if (data.insertedProducts > 0)
        feed.push({ status:"success", code:"Products", type:"Batch", message:`${data.insertedProducts} product(s) inserted` });
      if (data.insertedVariants > 0)
        feed.push({ status:"success", code:"Variants", type:"Batch", message:`${data.insertedVariants} variant(s) inserted` });
      if (data.insertedDetails > 0)
        feed.push({ status:"success", code:"Details",  type:"Batch", message:`${data.insertedDetails} size detail(s) inserted` });
      if (data.skippedValidation > 0)
        feed.push({ status:"skipped", code:"Skipped", type:"Validation", message:`${data.skippedValidation} row(s) skipped — validation errors` });
      if (data.skippedDuplicates > 0)
        feed.push({ status:"duplicate", code:"Skipped", type:"Duplicate Stock", message:`${data.skippedDuplicates} row(s) skipped — Stock ID already in DB` });

      (data.duplicateStockWarnings || []).forEach(w =>
        feed.push({
          status:"duplicate", code:w.stockId, type:"Duplicate Stock ID",
          message:`Product: ${w.productCode} · Variant: ${w.variantCode} — already exists in DB`,
        })
      );
      (data.hsnWarnings || []).forEach(w =>
        feed.push({ status:"skipped", code:`HSN ${w.hsnCodeId}`, type:"HSN Warning", message:w.message })
      );
      (data.storeWarnings || []).forEach(w =>
        feed.push({ status:"skipped", code:w.storeName, type:"Store Warning", message:w.message })
      );
      (data.warehouseWarnings || []).forEach(w =>
        feed.push({ status:"skipped", code:w.warehouseName, type:"Warehouse Warning", message:w.message })
      );

      setLogs(feed); setStage("done");
    } catch (e: unknown) {
      setImportErr(e instanceof Error ? e.message : String(e)); setStage("error");
    }
  };

  const activeStep = ({ idle:1, previewing:2, previewed:3, importing:4, done:4, error:2 } as Record<Stage,number>)[stage] || 1;

  const dupWarnings = preview?.duplicateStockWarnings ?? [];

  return (
    <>
      <style>{S}</style>
      <div className="wrap">
        {/* ── Header ── */}
        <div className="hdr">
          <div className="hdr-left">
            <h1>Product Bulk Upload</h1>
            <p>Hierarchical Excel → Products · Variants · Sizes in one go</p>
          </div>
          <button className="dl-btn" onClick={downloadTemplate}>⬇ Download Template</button>
        </div>

        <StepBar active={activeStep} />
        <AuthWarning />
        <HowItWorks />

        {/* ── IDLE ── */}
        {stage === "idle" && (
          <div className="card">
            <div className="card-ttl">Upload Excel File</div>
            <div
              className={`drop${isDragging ? " drag" : ""}`}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) previewFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <span className="drop-ico">📊</span>
              <div className="drop-title">Drag & drop your .xlsx file here</div>
              <div className="drop-sub">Hierarchical format — PRODUCT / VARIANT / SIZE rows</div>
              <div className="drop-badge">.xlsx only</div>
              <input type="file" ref={fileRef} onChange={handleInput} hidden accept=".xlsx" />
            </div>
            <div className="tip">
              💡 First time? Click <strong>Download Template</strong> above — includes dropdowns, sample rows, and field notes.
            </div>
          </div>
        )}

        {/* ── PREVIEWING ── */}
        {stage === "previewing" && (
          <div className="card">
            <div className="dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <div style={{ marginTop:12 }}>Parsing & validating file…</div>
            </div>
          </div>
        )}

        {/* ── PREVIEWED ── */}
        {stage === "previewed" && preview && (
          <div className="card">
            <div className="card-ttl">Preview — {file?.name}</div>

            {/* Stats */}
            <div className="preview-summary">
              <div className="pstat total">
                <div className="pstat-n">{preview.totalSizeRows}</div>
                <div className="pstat-l">Total Rows</div>
              </div>
              <div className="pstat ok">
                <div className="pstat-n">{preview.validRows}</div>
                <div className="pstat-l">Valid</div>
              </div>
              <div className="pstat err">
                <div className="pstat-n">{preview.errorRows}</div>
                <div className="pstat-l">Errors</div>
              </div>
              <div className="pstat dup">
                <div className="pstat-n">{preview.duplicateStockRows ?? dupWarnings.length}</div>
                <div className="pstat-l">Dup Stock IDs</div>
              </div>
              <div className="pstat imp">
                <div className="pstat-n">{preview.willImportProducts}</div>
                <div className="pstat-l" style={{ fontSize:9 }}>
                  Products / {preview.willImportVariants}V / {preview.willImportDetails}D
                </div>
              </div>
            </div>

            {/* Duplicate Stock panel in preview */}
            {dupWarnings.length > 0 && (
              <DupPanel
                warnings={dupWarnings}
                title={`${dupWarnings.length} duplicate Stock ID${dupWarnings.length > 1 ? "s" : ""} found — these rows will be skipped`}
                sub="These Stock IDs already exist in the database. Fix them in your file before importing."
              />
            )}

            {preview.rows?.length > 0 && <PreviewTable rows={preview.rows} />}

            {!preview.canImport && (
              <div className="err-banner">✕ &nbsp;No valid rows to import. Fix the errors above and re-upload.</div>
            )}

            <div className="btn-row">
              <button className="btn btn-ghost" onClick={reset}>← Re-upload</button>
              <button className="btn btn-green" onClick={runImport} disabled={!preview.canImport}>
                {(preview.errorRows > 0 || dupWarnings.length > 0)
                  ? `Import (skip ${preview.errorRows + dupWarnings.length} row${(preview.errorRows + dupWarnings.length) > 1 ? "s" : ""}) →`
                  : "Start Import →"
                }
              </button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {stage === "importing" && (
          <div className="card">
            <div className="card-ttl">Importing… <span className="badge badge-run">⏳ Running</span></div>
            <div className="dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <div style={{ marginTop:12 }}>Inserting records into the database…</div>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {stage === "done" && result && (
          <div className="card">
            <div className="card-ttl">
              Import Complete
              <span className="badge badge-done">✓ Done</span>
            </div>

            {/* Summary pills */}
            <div className="pills">
              {result.insertedProducts > 0 && (
                <span className="pill pill-ok">✓ {result.insertedProducts} Product{result.insertedProducts > 1 ? "s" : ""}</span>
              )}
              {result.insertedVariants > 0 && (
                <span className="pill pill-ok">✓ {result.insertedVariants} Variant{result.insertedVariants > 1 ? "s" : ""}</span>
              )}
              {result.insertedDetails > 0 && (
                <span className="pill pill-ok">✓ {result.insertedDetails} Size Detail{result.insertedDetails > 1 ? "s" : ""}</span>
              )}
              {result.skippedValidation > 0 && (
                <span className="pill pill-skip">– {result.skippedValidation} validation error{result.skippedValidation > 1 ? "s" : ""} skipped</span>
              )}
              {result.skippedDuplicates > 0 && (
                <span className="pill pill-dup">⊘ {result.skippedDuplicates} duplicate Stock ID{result.skippedDuplicates > 1 ? "s" : ""} skipped</span>
              )}
            </div>

            {/* Duplicate Stock panel in done screen */}
            {(result.duplicateStockWarnings?.length ?? 0) > 0 && (
              <DupPanel
                warnings={result.duplicateStockWarnings!}
                title={`${result.duplicateStockWarnings!.length} Stock ID${result.duplicateStockWarnings!.length > 1 ? "s" : ""} already existed — rows NOT imported`}
                sub="Update these Stock IDs in your file and re-upload to import the missing rows."
              />
            )}

            {/* Activity feed */}
            <div className="feed" ref={feedRef}>
              {logs.length === 0
                ? <div className="feed-empty">No activity logged.</div>
                : logs.map((log, i) => {
                    const map: Record<string, [string, string]> = {
                      success:   ["log-ok",  "✓"],
                      error:     ["log-err", "✕"],
                      skipped:   ["log-skip","–"],
                      duplicate: ["log-dup", "⊘"],
                    };
                    const [cls, ico] = map[log.status] || ["log-skip","–"];
                    return (
                      <div key={i} className={`log-row ${cls}`}>
                        <span className="log-ico">{ico}</span>
                        <div style={{ flex:1 }}>
                          <span className="log-code">{log.code}</span>
                          <span className="log-tag">{log.type}</span>
                          <div className="log-msg">{log.message}</div>
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            <div className="btn-row">
              <button className="btn btn-ghost" onClick={reset}>Upload Another File</button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === "error" && (
          <div className="card">
            <div className="err-banner">
              <span style={{ fontSize:16 }}>✕</span>
              <div>
                <strong style={{ display:"block", marginBottom:4 }}>Request failed</strong>
                {importErr}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={reset}>← Try Again</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}