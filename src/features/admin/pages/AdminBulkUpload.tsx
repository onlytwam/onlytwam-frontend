/**
 * AdminBulkUpload.tsx
 * ───────────────────
 * Minimalistic, elegant Excel bulk-import page.
 * Flow: Select entity → Download template → Upload filled file →
 *       Preview rows → Confirm import → See results.
 */

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EntityDef {
  key: string;
  label: string;
  columns: string[];
  required: string[];
  notes: string;
}

interface PreviewResult {
  entity: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  columns: string[];
  rows: Record<string, any>[];
  canImport: boolean;
}

interface ImportResult {
  entity: string;
  inserted: number;
  skipped: number;
  errors: { row: number; errors: string[] }[];
  message: string;
}

type Step = 'select' | 'upload' | 'preview' | 'result';

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminBulkUpload() {
  const [step, setStep]               = useState<Step>('select');
  const [entity, setEntity]           = useState<string>('');
  const [file, setFile]               = useState<File | null>(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [preview, setPreview]         = useState<PreviewResult | null>(null);
  const [result, setResult]           = useState<ImportResult | null>(null);
  const fileRef                       = useRef<HTMLInputElement>(null);

  // ── Fetch supported entities ──────────────────────────────────────────────
  const { data: entitiesData } = useQuery<{ entities: EntityDef[] }>({
    queryKey: ['bulk-import-entities'],
    queryFn: () => api.get('/BulkImport/entities').then(r => r.data),
  });
  const entities: EntityDef[] = entitiesData?.entities ?? [];
  const selectedEntity = entities.find(e => e.key === entity);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const previewMutation = useMutation<PreviewResult, any, File>({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append('file', f);
      return api.post(`/BulkImport/preview/${entity}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to parse file'),
  });

  const importMutation = useMutation<ImportResult, any, void>({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      return api.post(`/BulkImport/import/${entity}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('result');
      if (data.inserted > 0) toast.success(data.message);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Import failed'),
  });

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) {
      toast.error('Please upload an .xlsx file');
      return;
    }
    setFile(f);
    previewMutation.mutate(f);
  }, [entity]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0] || null);
  }, [handleFile]);

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/BulkImport/template/${entity}`;
    link.download = `twam_${entity}_template.xlsx`;
    link.click();
  };

  const reset = () => {
    setStep('select');
    setEntity('');
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    page:    { padding: '32px 24px', maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
    head:    { marginBottom: 28 } as React.CSSProperties,
    h1:      { fontSize: 22, fontWeight: 700, color: 'var(--brand)', margin: 0, letterSpacing: '-0.3px' } as React.CSSProperties,
    sub:     { fontSize: 13, color: 'var(--heirloom)', marginTop: 4 } as React.CSSProperties,

    stepper: {
      display: 'flex', gap: 0, marginBottom: 32, borderRadius: 10,
      overflow: 'hidden', border: '1px solid var(--ivory)',
    } as React.CSSProperties,
    stepItem:(active: boolean, done: boolean) => ({
      flex: 1, padding: '10px 0', textAlign: 'center' as const,
      fontSize: 12, fontWeight: active ? 600 : 400,
      background: done ? 'var(--brand)' : active ? 'var(--ivory)' : '#fff',
      color: done ? '#fff' : active ? 'var(--brand)' : 'var(--heirloom)',
      borderRight: '1px solid var(--ivory)',
      transition: 'all .2s',
    }),

    card:  {
      background: '#fff', border: '1px solid var(--ivory)',
      borderRadius: 12, padding: 28, marginBottom: 20,
    } as React.CSSProperties,
    cardTitle: { fontSize: 15, fontWeight: 600, color: 'var(--brand)', marginBottom: 16 } as React.CSSProperties,

    entityGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 } as React.CSSProperties,
    entityCard: (sel: boolean) => ({
      border: sel ? '2px solid var(--brand)' : '1px solid var(--ivory)',
      borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
      background: sel ? 'var(--ivory)' : '#fff',
      transition: 'all .15s',
    }) as React.CSSProperties,
    entityName: { fontSize: 14, fontWeight: 600, color: 'var(--brand)', marginBottom: 4 } as React.CSSProperties,
    entityNote: { fontSize: 11, color: 'var(--heirloom)' } as React.CSSProperties,

    btnPrimary: {
      background: 'var(--brand)', color: '#fff', border: 'none',
      borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 600,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    } as React.CSSProperties,
    btnSecondary: {
      background: 'transparent', color: 'var(--brand)',
      border: '1px solid var(--brand)', borderRadius: 8,
      padding: '10px 22px', fontSize: 13, fontWeight: 600,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    } as React.CSSProperties,
    btnGhost: {
      background: 'transparent', color: 'var(--heirloom)',
      border: 'none', borderRadius: 8, padding: '10px 16px',
      fontSize: 13, cursor: 'pointer',
    } as React.CSSProperties,

    dropzone: (dragging: boolean) => ({
      border: `2px dashed ${dragging ? 'var(--brand)' : 'var(--ivory)'}`,
      borderRadius: 12, padding: '48px 32px', textAlign: 'center' as const,
      background: dragging ? 'var(--ivory)' : '#fafafa',
      cursor: 'pointer', transition: 'all .2s',
    }),

    table: {
      width: '100%', borderCollapse: 'collapse' as const,
      fontSize: 12,
    } as React.CSSProperties,
    th: {
      background: 'var(--brand)', color: '#fff', padding: '9px 12px',
      textAlign: 'left' as const, fontWeight: 600, whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    td: {
      padding: '8px 12px', borderBottom: '1px solid var(--ivory)',
      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    tdErr: {
      padding: '8px 12px', borderBottom: '1px solid var(--ivory)',
      background: '#fff5f5', color: '#c0392b', fontSize: 11,
    } as React.CSSProperties,

    statRow: { display: 'flex', gap: 16, marginBottom: 20 } as React.CSSProperties,
    statCard: (color: string) => ({
      flex: 1, padding: '16px 20px', borderRadius: 10,
      background: color, border: '1px solid var(--ivory)',
    }) as React.CSSProperties,
    statNum:  { fontSize: 28, fontWeight: 700, color: 'var(--brand)' } as React.CSSProperties,
    statLbl:  { fontSize: 12, color: 'var(--heirloom)', marginTop: 2 } as React.CSSProperties,

    note: {
      background: 'var(--ivory)', borderRadius: 8, padding: '10px 14px',
      fontSize: 12, color: 'var(--heirloom)', marginTop: 12,
    } as React.CSSProperties,
    actions: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 20 } as React.CSSProperties,
  };

  // ── Step indicators ────────────────────────────────────────────────────────
  const STEPS = ['Select Type', 'Upload File', 'Preview', 'Done'];
  const stepIdx = { select: 0, upload: 1, preview: 2, result: 3 };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.head}>
        <h2 style={s.h1}>Bulk Import</h2>
        <p style={s.sub}>Upload an Excel file to import multiple records at once</p>
      </div>

      {/* Stepper */}
      <div style={s.stepper}>
        {STEPS.map((label, i) => {
          const current = stepIdx[step];
          return (
            <div key={label} style={s.stepItem(current === i, current > i)}>
              <span style={{ marginRight: 5 }}>
                {current > i ? '✓' : `${i + 1}.`}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Select entity ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div style={s.card}>
          <p style={s.cardTitle}>What would you like to import?</p>
          <div style={s.entityGrid}>
            {entities.length === 0
              ? [
                  { key: 'products',   label: 'Products',   notes: 'Bulk create products' },
                  { key: 'categories', label: 'Categories', notes: 'Bulk create categories' },
                  { key: 'brands',     label: 'Brands',     notes: 'Bulk create brands' },
                  { key: 'sizes',      label: 'Sizes',      notes: 'Bulk create sizes' },
                  { key: 'coupons',    label: 'Coupons',    notes: 'Bulk create coupons' },
                ].map(e => (
                  <div key={e.key} style={s.entityCard(entity === e.key)} onClick={() => setEntity(e.key)}>
                    <div style={s.entityName}>{e.label}</div>
                    <div style={s.entityNote}>{e.notes}</div>
                  </div>
                ))
              : entities.map(e => (
                  <div key={e.key} style={s.entityCard(entity === e.key)} onClick={() => setEntity(e.key)}>
                    <div style={s.entityName}>{e.label}</div>
                    <div style={s.entityNote}>{e.notes}</div>
                  </div>
                ))
            }
          </div>

          {entity && selectedEntity && (
            <div style={s.note}>
              <strong>Required columns:</strong>{' '}
              {selectedEntity.required.join(', ')}<br />
              {selectedEntity.notes}
            </div>
          )}

          <div style={s.actions}>
            <button
              style={{ ...s.btnSecondary, opacity: entity ? 1 : 0.4 }}
              disabled={!entity}
              onClick={downloadTemplate}
            >
              <i className="bi bi-download" /> Download Template
            </button>
            <button
              style={{ ...s.btnPrimary, opacity: entity ? 1 : 0.4 }}
              disabled={!entity}
              onClick={() => setStep('upload')}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload ────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div style={s.card}>
          <p style={s.cardTitle}>
            Upload your <strong>{selectedEntity?.label || entity}</strong> Excel file
          </p>

          <div
            style={s.dropzone(isDragging)}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <i className="bi bi-file-earmark-spreadsheet"
               style={{ fontSize: 40, color: 'var(--brand)', display: 'block', marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', margin: '0 0 6px' }}>
              {previewMutation.isPending ? 'Parsing file…' : 'Drop your .xlsx file here'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--heirloom)', margin: 0 }}>
              or click to browse · Only .xlsx files are supported
            </p>
            {file && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--heirloom)' }}>
                <i className="bi bi-file-check" /> {file.name}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={s.note}>
            <i className="bi bi-lightbulb" /> Don't have a template?{' '}
            <span
              style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }}
              onClick={downloadTemplate}
            >
              Download the template
            </span>{' '}
            — fill it in and upload it here.
          </div>

          <div style={s.actions}>
            <button style={s.btnGhost} onClick={() => setStep('select')}>← Back</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ───────────────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div>
          {/* Stats */}
          <div style={s.statRow}>
            {[
              { label: 'Total Rows',    val: preview.totalRows,   bg: '#fff' },
              { label: 'Ready to Import', val: preview.validRows, bg: '#f0fff4' },
              { label: 'Rows with Errors', val: preview.invalidRows, bg: preview.invalidRows > 0 ? '#fff5f5' : '#fff' },
            ].map(stat => (
              <div key={stat.label} style={s.statCard(stat.bg)}>
                <div style={s.statNum}>{stat.val}</div>
                <div style={s.statLbl}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div style={s.card}>
            <p style={s.cardTitle}>Row Preview (first {Math.min(preview.rows.length, 200)} rows)</p>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--ivory)' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: 50 }}>Row</th>
                    <th style={{ ...s.th, width: 80 }}>Status</th>
                    {preview.columns.map(col => (
                      <th key={col} style={s.th}>{col.replace('*', '')}</th>
                    ))}
                    <th style={s.th}>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((row, idx) => {
                    const hasErr = row._errors && row._errors.length > 0;
                    return (
                      <tr key={idx} style={{ background: hasErr ? '#fffafa' : idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={s.td}>{row._row}</td>
                        <td style={s.td}>
                          {hasErr
                            ? <span style={{ color: '#c0392b', fontWeight: 600 }}>✗ Error</span>
                            : <span style={{ color: '#27ae60', fontWeight: 600 }}>✓ OK</span>
                          }
                        </td>
                        {preview.columns.map((col, ci) => {
                          // Map column label back to field key
                          const fieldKey = Object.keys(row).find(k =>
                            k !== '_row' && k !== '_errors' && ci < preview.columns.length
                          );
                          const fields = Object.keys(row).filter(k => k !== '_row' && k !== '_errors');
                          const val = fields[ci] ? row[fields[ci]] : '';
                          return (
                            <td key={col} style={s.td} title={String(val ?? '')}>
                              {val ?? <span style={{ color: '#ccc' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={hasErr ? s.tdErr : s.td}>
                          {hasErr ? row._errors.join('; ') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {preview.rows.length > 100 && (
              <p style={{ fontSize: 11, color: 'var(--heirloom)', marginTop: 8, textAlign: 'center' }}>
                Showing 100 of {preview.rows.length} rows — all will be imported.
              </p>
            )}
          </div>

          <div style={s.actions}>
            <button style={s.btnGhost} onClick={() => { setStep('upload'); setFile(null); setPreview(null); }}>
              ← Re-upload
            </button>
            {preview.canImport ? (
              <button
                style={s.btnPrimary}
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending
                  ? <><i className="bi bi-arrow-repeat spin" /> Importing…</>
                  : <><i className="bi bi-upload" /> Import {preview.validRows} rows</>
                }
              </button>
            ) : (
              <span style={{ color: '#c0392b', fontSize: 13 }}>
                No valid rows to import. Fix the errors and re-upload.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Result ────────────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '20px 0 28px' }}>
            {result.inserted > 0 ? (
              <i className="bi bi-check-circle-fill"
                 style={{ fontSize: 52, color: 'var(--brand)', display: 'block', marginBottom: 12 }} />
            ) : (
              <i className="bi bi-exclamation-triangle-fill"
                 style={{ fontSize: 52, color: '#e67e22', display: 'block', marginBottom: 12 }} />
            )}
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)', margin: '0 0 6px' }}>
              {result.inserted > 0 ? 'Import Complete' : 'Nothing Imported'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--heirloom)', margin: 0 }}>{result.message}</p>
          </div>

          <div style={s.statRow}>
            {[
              { label: 'Imported',   val: result.inserted, bg: '#f0fff4' },
              { label: 'Skipped',    val: result.skipped,  bg: result.skipped > 0 ? '#fff5f5' : '#fff' },
            ].map(stat => (
              <div key={stat.label} style={s.statCard(stat.bg)}>
                <div style={s.statNum}>{stat.val}</div>
                <div style={s.statLbl}>{stat.label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div style={{ ...s.card, border: '1px solid #fce4e4', background: '#fffafa', marginTop: 0 }}>
              <p style={{ ...s.cardTitle, color: '#c0392b' }}>Rows with Errors</p>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c0392b', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #fce4e4' }}>
                  <strong>Row {e.row}:</strong> {e.errors.join(' · ')}
                </div>
              ))}
            </div>
          )}

          <div style={s.actions}>
            <button style={s.btnPrimary} onClick={reset}>
              <i className="bi bi-plus-lg" /> Import More
            </button>
            <button style={s.btnGhost} onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null); }}>
              Re-upload same entity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
