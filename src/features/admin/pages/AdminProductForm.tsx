import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getImageUrl } from '@/shared/utils/helpers';
import { resolveColorSwatch } from '@/shared/utils/colorHelpers';
import toast from 'react-hot-toast';

// ─── Schemas ──────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name:            z.string().min(1, 'Name is required'),
  description:     z.string().min(1, 'Description is required'),
  productCode:     z.string().min(1, 'Product code is required'),
  categoryId:      z.coerce.number().min(1, 'Category is required'),
  childCategoryId: z.number().optional().nullable(),
  brandId:         z.coerce.number().min(1, 'Brand is required'),
  tag:             z.string().optional().nullable(),
});
const variantSchema = z.object({
  variantName:        z.string().min(1, 'Variant name is required'),
  variantDescription: z.string().optional().nullable(),
  color:              z.string().optional().nullable(),
  isBestSeller:       z.boolean().optional(),
  isReturnAvailable:  z.boolean().optional(),
  isCupSize:          z.boolean().optional(),
});
const vdSchema = z.object({
  sizeId:          z.coerce.number().min(1, 'Size is required'),
  cupSizeId:       z.coerce.number().optional().nullable(),
  mrpPrice:        z.coerce.number().min(1, 'MRP is required'),
  finalPrice:      z.coerce.number().min(1, 'Final price is required'),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  stockQuantity:   z.coerce.number().min(0, 'Stock is required'),
});

type Tab = 'product' | 'variants' | 'details';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_ACTIONS: Record<string, string[]> = {
  Created:                           ['Submit For Approval'],
  Modified:                          ['Submit For Approval'],
  'Submitted To Product Manager':    ['Approve', 'Reject'],
  'Submitted To Inventory Manager':  ['Approve', 'Reject'],
  Approved:                          ['Reject'],
  Rejected:                          ['Resubmit'],
};
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Approved:                         { bg: '#e8f5e9', color: '#2e7d32' },
  Created:                          { bg: '#e3f2fd', color: '#1565c0' },
  Modified:                         { bg: '#fff3e0', color: '#e65100' },
  Rejected:                         { bg: '#ffebee', color: '#c62828' },
  'Submitted To Product Manager':   { bg: '#f3e5f5', color: '#6a1b9a' },
  'Submitted To Inventory Manager': { bg: '#e8eaf6', color: '#283593' },
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6,
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
};
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#444', display: 'block', marginBottom: 5 };
const errSt: React.CSSProperties = { color: '#e53935', fontSize: 12, marginTop: 3 };

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
      {error && <p style={errSt}>{error}</p>}
    </div>
  );
}

const jf = (filters: any[]) => (filters.length ? JSON.stringify(filters) : undefined);

// ─── File upload helpers ──────────────────────────────────────────────────────
async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function uploadFile(file: File): Promise<string> {
  const b64 = await fileToBase64(file);
  const res = await api.post('/FileUpload', {
    fileName: file.name,
    fileData: b64,
    fileType: file.type,
  });
  return res.data?.filePath || res.data?.fileUrl || `uploads/${file.name}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminProductForm() {
  const { id }        = useParams<{ id?: string }>();
  const nav           = useNavigate();
  const qc            = useQueryClient();
  const { getUserId } = useAuthStore();
  const isEdit        = !!id && id !== '0';
  const pid           = isEdit ? Number(id) : 0;

  // UI state
  const [tab,      setTab]     = useState<Tab>('product');
  const [savedPid, setSavedPid]= useState(pid);
  const [pState,   setPState]  = useState<string | null>(null);
  const [selVid,   setSelVid]  = useState<number | null>(null);
  const [showVF,   setShowVF]  = useState(false);
  const [showVDF,  setShowVDF] = useState(false);
  const [editV,    setEditV]   = useState<any>(null);
  const [editVD,   setEditVD]  = useState<any>(null);
  const [childCats, setChildCats] = useState<any[]>([]);

  // ── Color state — TWO fields that auto-resolve each other ─────────────────
  // colorName: human label ("Bark")   — stored in ProductVariants.Color
  // colorHex:  CSS hex    ("#C8A882") — shown in picker, derived automatically
  const [colorName, setColorName] = useState('');
  const [colorHex,  setColorHex]  = useState('#9E6070');

  /** Called when admin types in the name input */
  const handleColorNameChange = (raw: string) => {
    setColorName(raw);
    if (raw.trim()) {
      const { colorHex: hex } = resolveColorSwatch(raw.trim());
      setColorHex(hex);
    }
  };

  /** Called when admin picks from the native color-picker */
  const handleColorHexChange = (hex: string) => {
    setColorHex(hex);
    const { colorName: name } = resolveColorSwatch(undefined, hex);
    // Only overwrite the name when it was blank or still a generic placeholder
    if (!colorName.trim() || colorName === colorHex) {
      setColorName(name);
    }
  };

  // Image state
  const [imgFiles,      setImgFiles]      = useState<File[]>([]);
  const [imgPreviews,   setImgPreviews]   = useState<string[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [existingImgs,  setExistingImgs]  = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Lookups ──────────────────────────────────────────────────────────────────
  const { data: cD }  = useQuery({ queryKey: ['ac'],  queryFn: () => api.get('/Category', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: bD }  = useQuery({ queryKey: ['ab'],  queryFn: () => api.get('/Brand',    { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: sD }  = useQuery({ queryKey: ['as'],  queryFn: () => api.get('/Size',     { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: csD } = useQuery({ queryKey: ['acs'], queryFn: () => api.get('/CupSize',  { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const cats     = (cD  as any[]) || [];
  const brands   = (bD  as any[]) || [];
  const sizes    = (sD  as any[]) || [];
  const cupSizes = (csD as any[]) || [];

  // ── Product data ──────────────────────────────────────────────────────────────
  const { data: pData } = useQuery({
    queryKey: ['apf', savedPid],
    queryFn:  () => api.get(`/Products/${savedPid}`).then(r => r.data),
    enabled:  savedPid > 0,
  });

  const { data: vData, refetch: refV } = useQuery({
    queryKey: ['avs', savedPid],
    queryFn:  () => api.get('/ProductVariants', {
      params: { Filters: jf([{ property: 'ProductId', comparison: '==', value: String(savedPid) }]), 'Page.Size': 50 },
    }).then(r => r.data?.list || []),
    enabled: savedPid > 0,
  });

  const { data: vdData, refetch: refVD } = useQuery({
    queryKey: ['avds', selVid],
    queryFn:  () => api.get('/ProductVariantDetail', {
      params: { Filters: jf([{ property: 'ProductVariantId', comparison: '==', value: String(selVid) }]), 'Page.Size': 100 },
    }).then(r => r.data?.list || []),
    enabled: !!selVid,
  });

  const variants = (vData  as any[]) || [];
  const vds      = (vdData as any[]) || [];

  // ── Product form ──────────────────────────────────────────────────────────────
  const { register: rP, handleSubmit: hP, setValue: sP, watch: wP, formState: { errors: eP } } =
    useForm({ resolver: zodResolver(productSchema) });
  const selCat = wP('categoryId');

  useEffect(() => {
    if (pData) {
      sP('name',            pData.name);
      sP('description',     pData.description);
      sP('productCode',     pData.productCode);
      sP('categoryId',      pData.categoryId);
      sP('childCategoryId', pData.childCategoryId);
      sP('brandId',         pData.brandId);
      sP('tag',             pData.tag);
      setPState(pData.state);
    }
  }, [pData]);

  useEffect(() => {
    if (selCat && cats.length)
      setChildCats(cats.filter((c: any) => c.parentCategoryId === Number(selCat)));
  }, [selCat, cats]);

  // ── Variant form ──────────────────────────────────────────────────────────────
  const { register: rV, handleSubmit: hV, setValue: sV, reset: resetV, formState: { errors: eV } } =
    useForm({ resolver: zodResolver(variantSchema) });

  useEffect(() => {
    if (editV) {
      sV('variantName',        editV.variantName);
      sV('variantDescription', editV.variantDescription);
      sV('isBestSeller',       editV.isBestSeller);
      sV('isReturnAvailable',  editV.isReturnAvailable);
      sV('isCupSize',          editV.isCupSize);
      // Auto-resolve both fields from whatever was stored
      const rawColor = editV.color || '';
      const { colorName: name, colorHex: hex } = resolveColorSwatch(rawColor);
      setColorName(name);
      setColorHex(hex);
      const imgs = editV.images?.length ? editV.images : editV.image ? [editV.image] : [];
      setExistingImgs(imgs);
    } else {
      resetV();
      setColorName('');
      setColorHex('#9E6070');
      setExistingImgs([]);
    }
    setImgFiles([]);
    setImgPreviews([]);
    setUploadedPaths([]);
  }, [editV]);

  // ── VD form ───────────────────────────────────────────────────────────────────
  const { register: rVD, handleSubmit: hVD, setValue: sVD, reset: resetVD, watch: wVD, formState: { errors: eVD } } =
    useForm({ resolver: zodResolver(vdSchema) });
  const mrp = Number(wVD('mrpPrice')  || 0);
  const fin = Number(wVD('finalPrice') || 0);

  useEffect(() => {
    if (editVD) {
      sVD('sizeId',          editVD.sizeId);
      sVD('cupSizeId',       editVD.cupSizeId);
      sVD('mrpPrice',        editVD.mrpPrice);
      sVD('finalPrice',      editVD.finalPrice);
      sVD('discountPercent', editVD.discountPercent);
      sVD('stockQuantity',   editVD.stockQuantity);
    } else {
      resetVD();
    }
  }, [editVD]);

  useEffect(() => {
    if (mrp && fin) sVD('discountPercent', Math.max(0, Math.round(((mrp - fin) / mrp) * 100)));
  }, [mrp, fin]);

  // ── Image upload handler ──────────────────────────────────────────────────────
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await processFiles(files);
    if (fileRef.current) fileRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
    files.forEach(f => {
      const r = new FileReader();
      r.onload = ev => setImgPreviews(p => [...p, ev.target?.result as string]);
      r.readAsDataURL(f);
    });
    setImgFiles(p => [...p, ...files]);
    setUploading(true);
    try {
      const paths = await Promise.all(files.map(uploadFile));
      setUploadedPaths(p => [...p, ...paths]);
      toast.success(`${files.length} image${files.length > 1 ? 's' : ''} uploaded!`);
    } catch {
      toast.error('Image upload failed — check file size and try again');
    } finally {
      setUploading(false);
    }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const saveProd = useMutation({
    mutationFn: async (data: any) => {
      const pl = { ...data, userProfileId: getUserId(), state: savedPid > 0 ? 'Modified' : 'Created' };
      return savedPid > 0
        ? api.put(`/Products/${savedPid}`, pl).then(r => r.data)
        : api.post('/Products', pl).then(r => r.data);
    },
    onSuccess: (res) => {
      const nid = res?.productId || res?.id || savedPid;
      if (nid) setSavedPid(nid);
      setPState(savedPid > 0 ? 'Modified' : 'Created');
      toast.success(savedPid > 0 ? 'Product updated!' : 'Product created! Now add variants.');
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      if (!savedPid) setTab('variants');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save product'),
  });

  const updState = useMutation({
    mutationFn: (s: string) => api.put(`/Products/${savedPid}`, { state: s }),
    onSuccess: (_, s) => {
      setPState(s);
      toast.success(`Status updated to: ${s}`);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const saveVar = useMutation({
    mutationFn: async (data: any) => {
      const allImgs = [...existingImgs, ...uploadedPaths];
      const pl = {
        ...data,
        productId:     savedPid,
        userProfileId: getUserId(),
        state:         editV ? 'Modified' : 'Created',
        images:        allImgs,
        image:         allImgs[0] || null,
        // color stores the NAME (e.g. "Bark") — this is what goes into ProductVariants.Color
        color:         colorName.trim() || colorHex,
        // colorHex is passed along so backend can upsert twam.ProductColor if supported
        colorHex:      colorHex,
      };
      return editV
        ? api.put(`/ProductVariants/${editV.productVariantId}`, pl)
        : api.post('/ProductVariants', pl);
    },
    onSuccess: () => {
      toast.success(editV ? 'Variant updated!' : 'Variant created!');
      setShowVF(false);
      setEditV(null);
      setImgFiles([]);
      setImgPreviews([]);
      setUploadedPaths([]);
      setExistingImgs([]);
      refV();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save variant'),
  });

  const delVar = useMutation({
    mutationFn: (id: number) => api.delete(`/ProductVariants/${id}`),
    onSuccess: () => {
      toast.success('Variant deleted');
      refV();
      if (selVid) setSelVid(null);
    },
    onError: () => toast.error('Failed to delete variant'),
  });

  const saveVDm = useMutation({
    mutationFn: async (data: any) => {
      const pl = {
        ...data,
        productVariantId: selVid,
        productId:        savedPid,
        userProfileId:    getUserId(),
        state:            editVD ? 'Modified' : 'Created',
      };
      return editVD
        ? api.put(`/ProductVariantDetail/${editVD.productVariantDetailId}`, pl)
        : api.post('/ProductVariantDetail', pl);
    },
    onSuccess: () => {
      toast.success(editVD ? 'Size updated!' : 'Size added!');
      setShowVDF(false);
      setEditVD(null);
      refVD();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save size'),
  });

  const delVDm = useMutation({
    mutationFn: (id: number) => api.delete(`/ProductVariantDetail/${id}`),
    onSuccess: () => { toast.success('Deleted'); refVD(); },
    onError: () => toast.error('Failed to delete'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const badge = (state: string | null) => {
    const s = STATUS_COLOR[state || 'Created'] || { bg: '#f5f5f5', color: '#555' };
    return (
      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
        {state || 'New'}
      </span>
    );
  };

  const tabSt = (t: Tab): React.CSSProperties => ({
    padding: '10px 20px', border: 'none', background: 'none',
    cursor: t === 'details' ? (selVid ? 'pointer' : 'not-allowed') : (t === 'variants' ? (savedPid ? 'pointer' : 'not-allowed') : 'pointer'),
    fontSize: 14, fontWeight: tab === t ? 700 : 400,
    color: tab === t ? '#6A012A' : '#666',
    borderBottom: `3px solid ${tab === t ? '#6A012A' : 'transparent'}`,
    fontFamily: 'inherit',
    opacity: (t === 'variants' && !savedPid) || (t === 'details' && !selVid) ? 0.4 : 1,
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => nav('/admin/products')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A012A', fontSize: 14, padding: 0, marginBottom: 4 }}>
            ← Products
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {isEdit ? 'Edit Product' : 'Create New Product'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {badge(pState)}
          {savedPid > 0 && STATUS_ACTIONS[pState || '']?.map(a => (
            <button key={a} onClick={() => updState.mutate(a)}
              style={{ background: '#111', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: '2px solid #f0f0f0', marginBottom: 24, display: 'flex' }}>
        <button style={tabSt('product')}  onClick={() => setTab('product')}>
          <i className="bi bi-info-circle me-1" />Product Info
        </button>
        <button style={tabSt('variants')} onClick={() => savedPid > 0 && setTab('variants')} disabled={!savedPid}>
          <i className="bi bi-palette me-1" />Variants {variants.length > 0 && `(${variants.length})`}
        </button>
        <button style={tabSt('details')}  onClick={() => selVid && setTab('details')} disabled={!selVid}>
          <i className="bi bi-rulers me-1" />Sizes & Pricing {vds.length > 0 && `(${vds.length})`}
        </button>
      </div>

      {/* TAB 1 — Product Info */}
      {tab === 'product' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 28 }}>
          <form onSubmit={hP(data => saveProd.mutate(data))}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0 24px' }}>
              <Field label="Product Name *" error={eP.name?.message as string}>
                <input {...rP('name')} style={inp} placeholder="e.g. Amante Lightly Padded Bra" />
              </Field>
              <Field label="Product Code *" error={eP.productCode?.message as string}>
                <input {...rP('productCode')} style={inp} placeholder="e.g. AMT-BRA-001" />
              </Field>
              <Field label="Parent Category *" error={eP.categoryId?.message as string}>
                <select {...rP('categoryId', { valueAsNumber: true })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Select Category</option>
                  {cats.filter((c: any) => !c.parentCategoryId).map((c: any) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </Field>
              {childCats.length > 0 && (
                <Field label="Sub Category">
                  <select {...rP('childCategoryId', { valueAsNumber: true })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Select Sub Category</option>
                    {childCats.map((c: any) => (
                      <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Brand *" error={eP.brandId?.message as string}>
                <select {...rP('brandId', { valueAsNumber: true })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Select Brand</option>
                  {brands.map((b: any) => (
                    <option key={b.brandId} value={b.brandId}>{b.brandName || b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tag (optional)">
                <input {...rP('tag')} style={inp} placeholder="e.g. new-arrival, bestseller" />
              </Field>
            </div>
            <Field label="Description *" error={eP.description?.message as string}>
              <textarea {...rP('description')} style={{ ...inp, minHeight: 100, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => nav('/admin/products')}
                style={{ background: '#f5f5f5', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button type="submit" disabled={saveProd.isPending}
                style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {saveProd.isPending ? 'Saving…' : savedPid > 0 ? 'Update & Continue →' : 'Create & Continue →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2 — Variants */}
      {tab === 'variants' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Product Variants</h3>
            <button onClick={() => { setEditV(null); setShowVF(true); }}
              style={{ background: '#111', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi bi-plus-lg" /> Add Variant
            </button>
          </div>

          {variants.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: '#aaa' }}>
              <i className="bi bi-palette" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
              <p style={{ margin: 0 }}>No variants yet. Add a color/style variant to continue.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              {variants.map((v: any) => {
                // Resolve a proper swatch color for each variant card
                const { colorHex: vHex } = resolveColorSwatch(v.color, v.colorHex);
                return (
                  <div key={v.productVariantId}
                    style={{ background: '#fff', border: `2px solid ${selVid === v.productVariantId ? '#6A012A' : '#eee'}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color .15s' }}
                    onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 56, height: 68, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid #eee', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(v.image || (v.images && v.images[0])) ? (
                          <img src={getImageUrl(v.image || v.images?.[0])} alt={v.variantName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : v.color ? (
                          // Use resolved hex — never raw name as background
                          <div style={{ width: '100%', height: '100%', background: vHex }} />
                        ) : (
                          <i className="bi bi-image" style={{ color: '#ccc', fontSize: 20 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.variantName}</p>
                        {v.color && (
                          <p style={{ margin: 0, fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: vHex, display: 'inline-block', border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
                            {v.color}
                          </p>
                        )}
                        {v.isBestSeller && <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '1px 6px', borderRadius: 4 }}>Best Seller</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditV(v); setShowVF(true); }}
                        style={{ flex: 1, background: '#f0f0f0', border: 'none', padding: '7px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                        <i className="bi bi-pencil me-1" />Edit
                      </button>
                      <button onClick={() => { if (window.confirm(`Delete "${v.variantName}"?`)) delVar.mutate(v.productVariantId); }}
                        style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                        <i className="bi bi-trash" />
                      </button>
                      <button onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}
                        style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                        Sizes →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Variant Modal ── */}
          {showVF && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={() => { setShowVF(false); setEditV(null); }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editV ? 'Edit Variant' : 'Add Variant'}</h3>
                  <button onClick={() => { setShowVF(false); setEditV(null); }}
                    style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
                </div>

                <form onSubmit={hV(data => saveVar.mutate(data))}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Field label="Variant Name *" error={eV.variantName?.message as string}>
                      <input {...rV('variantName')} style={inp} placeholder="e.g. Midnight Black" />
                    </Field>

                    {/* ── Color field — two-way auto-resolution ── */}
                    <Field label="Color">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                        {/* Row 1: picker + live swatch preview */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {/* Native color picker — changes hex, auto-resolves name */}
                          <input
                            type="color"
                            value={colorHex}
                            onChange={e => handleColorHexChange(e.target.value)}
                            style={{ width: 44, height: 40, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                            title="Pick a color — name is resolved automatically"
                          />
                          {/* Hex text input — changes hex, auto-resolves name */}
                          <input
                            value={colorHex}
                            onChange={e => handleColorHexChange(e.target.value)}
                            style={{ ...inp, flex: 1, fontFamily: 'monospace' }}
                            placeholder="#C8A882"
                          />
                        </div>

                        {/* Row 2: color name input — changes name, auto-resolves hex */}
                        <input
                          value={colorName}
                          onChange={e => handleColorNameChange(e.target.value)}
                          style={inp}
                          placeholder="Color name, e.g. Bark, Midnight, Coral Red"
                        />

                        {/* Live resolved preview */}
                        {colorName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                            <span style={{ width: 16, height: 16, borderRadius: '50%', background: colorHex, border: '1px solid rgba(0,0,0,.15)', display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: '#888' }}>Stored as:</span>
                            <strong>{colorName}</strong>
                            <span style={{ color: '#aaa' }}>→</span>
                            <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>{colorHex}</code>
                          </div>
                        )}
                      </div>
                    </Field>
                  </div>

                  <Field label="Variant Description">
                    <textarea {...rV('variantDescription')} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Optional description for this color/style" />
                  </Field>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
                    {[
                      { n: 'isBestSeller',      l: '⭐ Best Seller' },
                      { n: 'isReturnAvailable', l: '↩ Returnable' },
                      { n: 'isCupSize',         l: '📐 Has Cup Size' },
                    ].map(o => (
                      <label key={o.n} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" {...rV(o.n as any)} /> {o.l}
                      </label>
                    ))}
                  </div>

                  {/* ── Image Upload Section ── */}
                  <Field label="Product Images">
                    {existingImgs.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 12, color: '#888', margin: '0 0 6px' }}>Current images — click × to remove:</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {existingImgs.map((src, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={getImageUrl(src)} alt=""
                                style={{ width: 72, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                                onError={e => { (e.target as HTMLImageElement).src = '/assets/category-bg.png'; }} />
                              <button type="button"
                                onClick={() => setExistingImgs(p => p.filter((_, j) => j !== i))}
                                style={{ position: 'absolute', top: -6, right: -6, background: '#e53935', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      style={{ border: '2px dashed #ddd', borderRadius: 8, padding: '20px 16px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: '#fafafa', transition: 'border-color .15s' }}
                      onClick={() => !uploading && fileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#6A012A'; }}
                      onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ddd'; }}
                      onDrop={async e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = '#ddd';
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (files.length) await processFiles(files);
                      }}>
                      {uploading ? (
                        <>
                          <div style={{ width: 28, height: 28, border: '3px solid #f0f0f0', borderTopColor: '#6A012A', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 8px' }} />
                          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Uploading to server…</p>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-upload" style={{ fontSize: 30, color: '#aaa', display: 'block', marginBottom: 8 }} />
                          <p style={{ margin: '0 0 4px', color: '#666', fontSize: 13, fontWeight: 500 }}>Click to upload or drag & drop</p>
                          <p style={{ margin: 0, color: '#bbb', fontSize: 11 }}>JPG, PNG, WebP · Multiple files allowed</p>
                        </>
                      )}
                      <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
                    </div>

                    {imgPreviews.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: 12, color: '#888', margin: '0 0 6px' }}>
                          New uploads — {uploadedPaths.length}/{imgPreviews.length} done:
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {imgPreviews.map((src, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={src} alt="" style={{ width: 72, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                              {i >= uploadedPaths.length && uploading && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.75)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: 20, height: 20, border: '2px solid #f0f0f0', borderTopColor: '#6A012A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                </div>
                              )}
                              {i < uploadedPaths.length && (
                                <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#2e7d32', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <i className="bi bi-check" style={{ color: '#fff', fontSize: 11 }} />
                                </div>
                              )}
                              <button type="button"
                                onClick={() => {
                                  setImgPreviews(p => p.filter((_, j) => j !== i));
                                  setImgFiles(f => f.filter((_, j) => j !== i));
                                  setUploadedPaths(p => p.filter((_, j) => j !== i));
                                }}
                                style={{ position: 'absolute', top: -6, right: -6, background: '#e53935', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Field>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="button" onClick={() => { setShowVF(false); setEditV(null); }}
                      style={{ background: '#f5f5f5', color: '#333', border: 'none', padding: '10px 18px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={saveVar.isPending || uploading}
                      style={{ background: uploading ? '#999' : '#111', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                      {saveVar.isPending ? 'Saving…' : uploading ? 'Wait — uploading images…' : editV ? 'Update Variant' : 'Add Variant'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3 — Sizes & Pricing */}
      {tab === 'details' && (
        <div>
          {variants.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {variants.map((v: any) => {
                const { colorHex: vHex } = resolveColorSwatch(v.color, v.colorHex);
                return (
                  <button key={v.productVariantId} onClick={() => setSelVid(v.productVariantId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: `2px solid ${selVid === v.productVariantId ? '#6A012A' : '#ddd'}`, borderRadius: 20, background: selVid === v.productVariantId ? '#fff5f5' : '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}>
                    {v.color && (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: vHex, border: '1px solid rgba(0,0,0,.15)', flexShrink: 0 }} />
                    )}
                    {v.variantName}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Sizes & Pricing
              {selVid && <span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 8 }}>
                for {variants.find((v: any) => v.productVariantId === selVid)?.variantName}
              </span>}
            </h3>
            <button onClick={() => { setEditVD(null); setShowVDF(true); }} disabled={!selVid}
              style={{ background: selVid ? '#111' : '#ccc', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, cursor: selVid ? 'pointer' : 'not-allowed', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi bi-plus-lg" /> Add Size
            </button>
          </div>

          {!selVid ? (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: '#aaa' }}>
              <i className="bi bi-rulers" style={{ fontSize: 36, display: 'block', marginBottom: 12 }} />
              <p style={{ margin: 0 }}>Select a variant above to manage its sizes.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                      {['Size', 'Cup', 'MRP', 'Final Price', 'Discount', 'Stock', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vds.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center', color: '#aaa' }}>No sizes yet — click "Add Size" to start.</td></tr>
                    ) : vds.map((vd: any) => (
                      <tr key={vd.productVariantDetailId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{vd.sizeLabel || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#555' }}>{vd.cupSizeLabel || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#888', textDecoration: 'line-through' }}>₹{vd.mrpPrice}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111' }}>₹{vd.finalPrice}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {vd.discountPercent > 0 && (
                            <span style={{ padding: '2px 8px', background: '#fff3e0', color: '#e65100', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {vd.discountPercent}% OFF
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: (vd.stockQuantity || 0) === 0 ? '#c62828' : (vd.stockQuantity || 0) < 10 ? '#e65100' : '#2e7d32' }}>
                          {vd.stockQuantity ?? 0}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: vd.state === 'Approved' ? '#e8f5e9' : '#fff3e0', color: vd.state === 'Approved' ? '#2e7d32' : '#e65100' }}>
                            {vd.state || 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setEditVD(vd); setShowVDF(true); }}
                              style={{ background: '#f0f0f0', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button onClick={() => { if (window.confirm('Delete this size entry?')) delVDm.mutate(vd.productVariantDetailId); }}
                              style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Size/Pricing Modal */}
          {showVDF && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={() => { setShowVDF(false); setEditVD(null); }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editVD ? 'Edit Size' : 'Add Size & Pricing'}</h3>
                  <button onClick={() => { setShowVDF(false); setEditVD(null); }}
                    style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
                </div>
                <form onSubmit={hVD(data => saveVDm.mutate(data))}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Field label="Size *" error={eVD.sizeId?.message as string}>
                      <select {...rVD('sizeId', { valueAsNumber: true })} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="">Select Size</option>
                        {sizes.map((s: any) => (
                          <option key={s.sizeId} value={s.sizeId}>{s.sizeLabel}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cup Size (optional)">
                      <select {...rVD('cupSizeId', { valueAsNumber: true })} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="">No Cup Size</option>
                        {cupSizes.map((c: any) => (
                          <option key={c.cupSizeId} value={c.cupSizeId}>{c.sizeLabel}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="MRP (₹) *" error={eVD.mrpPrice?.message as string}>
                      <input type="number" {...rVD('mrpPrice', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                    </Field>
                    <Field label="Final Price (₹) *" error={eVD.finalPrice?.message as string}>
                      <input type="number" {...rVD('finalPrice', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                    </Field>
                    <Field label="Discount % (auto)">
                      <input type="number" {...rVD('discountPercent', { valueAsNumber: true })} style={{ ...inp, background: '#f9f9f9', color: '#888' }} readOnly />
                    </Field>
                    <Field label="Stock Quantity *" error={eVD.stockQuantity?.message as string}>
                      <input type="number" {...rVD('stockQuantity', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                    </Field>
                  </div>

                  {mrp > 0 && fin > 0 && fin < mrp && (
                    <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="bi bi-tag-fill" />
                      Customer saves ₹{(mrp - fin).toFixed(0)} — {Math.round(((mrp - fin) / mrp) * 100)}% OFF
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setShowVDF(false); setEditVD(null); }}
                      style={{ background: '#f5f5f5', color: '#333', border: 'none', padding: '10px 18px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={saveVDm.isPending}
                      style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                      {saveVDm.isPending ? 'Saving…' : editVD ? 'Update Size' : 'Add Size'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}