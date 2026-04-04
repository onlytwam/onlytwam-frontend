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
  Approved:                         { bg: 'var(--ivory)', color: 'var(--brand)' },
  Created:                          { bg: 'var(--ivory)', color: 'var(--brand)' },
  Modified:                         { bg: 'var(--ivory)', color: 'var(--brand)' },
  Rejected:                         { bg: 'var(--ivory)', color: 'var(--brand)' },
  'Submitted To Product Manager':   { bg: 'var(--ivory)', color: 'var(--brand)' },
  'Submitted To Inventory Manager': { bg: 'var(--ivory)', color: 'var(--brand)' },
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--heirloom)', display: 'block', marginBottom: 5 };

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="s-updateprofil-246fef">
      <label style={lbl}>{label}</label>
      {children}
      {error && <p className="auth-err-text">{error}</p>}
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
  const [colorHex,  setColorHex]  = useState('var(--heirloom)');

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
      setColorHex('var(--heirloom)');
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
    const s = STATUS_COLOR[state || 'Created'] || { bg: 'var(--ivory)', color: 'var(--heirloom)' };
    return (
      <span className="s-adminproduct-2b277c s-adminproduct-69e3b0">
        {state || 'New'}
      </span>
    );
  };

  const tabSt = (t: Tab): React.CSSProperties => ({
    padding: '10px 20px', border: 'none', background: 'none',
    cursor: t === 'details' ? (selVid ? 'pointer' : 'not-allowed') : (t === 'variants' ? (savedPid ? 'pointer' : 'not-allowed') : 'pointer'),
    fontSize: 14, fontWeight: tab === t ? 700 : 400,
    color: tab === t ? 'var(--brand)' : 'var(--heirloom)',
    borderBottom: `3px solid ${tab === t ? 'var(--brand)' : 'transparent'}`,
    fontFamily: 'var(--font-body)',
    opacity: (t === 'variants' && !savedPid) || (t === 'details' && !selVid) ? 0.4 : 1,
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ── */}
      <div className="s-adminproduct-3d61cb">
        <div>
          <button onClick={() => nav('/admin/products')}
            className="s-adminproduct-13d9f1">
            ← Products
          </button>
          <h2 className="s-addressform-638cea">
            {isEdit ? 'Edit Product' : 'Create New Product'}
          </h2>
        </div>
        <div className="s-adminproduct-4f5591">
          {badge(pState)}
          {savedPid > 0 && STATUS_ACTIONS[pState || '']?.map(a => (
            <button key={a} onClick={() => updState.mutate(a)}
              className="s-adminproduct-76a1ab">
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="s-adminproduct-eafda1">
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
        <div className="s-updateprofil-245770">
          <form onSubmit={hP(data => saveProd.mutate(data))}>
            <div className="s-adminproduct-25b090">
              <Field label="Product Name *" error={eP.name?.message as string}>
                <input {...rP('name')} className="inp-field" placeholder="e.g. Amante Lightly Padded Bra" />
              </Field>
              <Field label="Product Code *" error={eP.productCode?.message as string}>
                <input {...rP('productCode')} className="inp-field" placeholder="e.g. AMT-BRA-001" />
              </Field>
              <Field label="Parent Category *" error={eP.categoryId?.message as string}>
                <select {...rP('categoryId', { valueAsNumber: true })} className="inp-field s-adminproduct-c9137f">
                  <option value="">Select Category</option>
                  {cats.filter((c: any) => !c.parentCategoryId).map((c: any) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </Field>
              {childCats.length > 0 && (
                <Field label="Sub Category">
                  <select {...rP('childCategoryId', { valueAsNumber: true })} className="inp-field s-adminproduct-c9137f">
                    <option value="">Select Sub Category</option>
                    {childCats.map((c: any) => (
                      <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Brand *" error={eP.brandId?.message as string}>
                <select {...rP('brandId', { valueAsNumber: true })} className="inp-field s-adminproduct-c9137f">
                  <option value="">Select Brand</option>
                  {brands.map((b: any) => (
                    <option key={b.brandId} value={b.brandId}>{b.brandName || b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tag (optional)">
                <input {...rP('tag')} className="inp-field" placeholder="e.g. new-arrival, bestseller" />
              </Field>
            </div>
            <Field label="Description *" error={eP.description?.message as string}>
              <textarea {...rP('description')} className="inp-field s-adminproduct-c6d4c8" />
            </Field>
            <div className="s-adminproduct-cb83c3">
              <button type="button" onClick={() => nav('/admin/products')}
                className="s-adminproduct-a52f52">
                Cancel
              </button>
              <button type="submit" disabled={saveProd.isPending}
                className="s-adminproduct-c236dd">
                {saveProd.isPending ? 'Saving…' : savedPid > 0 ? 'Update & Continue →' : 'Create & Continue →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2 — Variants */}
      {tab === 'variants' && (
        <div>
          <div className="s-adminproduct-d763a3">
            <h3 className="s-adminproduct-53697f">Product Variants</h3>
            <button onClick={() => { setEditV(null); setShowVF(true); }}
              className="s-adminproduct-717817">
              <i className="bi bi-plus-lg" /> Add Variant
            </button>
          </div>

          {variants.length === 0 ? (
            <div className="s-adminproduct-0584c4">
              <i className="bi bi-palette s-adminproduct-8eb3fc" />
              <p className="s-adminorders-18f7bb">No variants yet. Add a color/style variant to continue.</p>
            </div>
          ) : (
            <div className="s-adminproduct-068605">
              {variants.map((v: any) => {
                // Resolve a proper swatch color for each variant card
                const { colorHex: vHex } = resolveColorSwatch(v.color, v.colorHex);
                return (
                  <div key={v.productVariantId}
                    className="s-adminproduct-dc47e1" style={ {border: `2px solid ${selVid === v.productVariantId ? 'var(--brand)' : 'var(--ivory)'}`} }
                    onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}>
                    <div className="s-adminproduct-436612">
                      <div className="s-adminproduct-9d4d46">
                        {(v.image || (v.images && v.images[0])) ? (
                          <img src={getImageUrl(v.image || v.images?.[0])} alt={v.variantName} className="s-userdashboar-4ebae2"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : v.color ? (
                          // Use resolved hex — never raw name as background
                          <div className="s-adminproduct-302ea8" style={ { background: vHex } } />
                        ) : (
                          <i className="bi bi-image s-adminproduct-e37bf7" />
                        )}
                      </div>
                      <div className="s-userdashboar-7aa8c4">
                        <p className="s-adminproduct-e1341a">{v.variantName}</p>
                        {v.color && (
                          <p className="s-adminproduct-cf7653">
                            <span className="s-adminproduct-431516" style={ {background: vHex} } />
                            {v.color}
                          </p>
                        )}
                        {v.isBestSeller && <span className="s-adminproduct-4e66ec">Best Seller</span>}
                      </div>
                    </div>
                    <div className="s-adminbrands-ac734d" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditV(v); setShowVF(true); }}
                        className="s-adminproduct-ac303b">
                        <i className="bi bi-pencil me-1" />Edit
                      </button>
                      <button onClick={() => { if (window.confirm(`Delete "${v.variantName}"?`)) delVar.mutate(v.productVariantId); }}
                        className="s-adminproduct-751429">
                        <i className="bi bi-trash" />
                      </button>
                      <button onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}
                        className="s-adminproduct-751429">
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
            <div className="s-adminproduct-ca0ae5"
              onClick={() => { setShowVF(false); setEditV(null); }}>
              <div className="s-adminproduct-a33585"
                onClick={e => e.stopPropagation()}>
                <div className="s-adminproduct-a1f2ef">
                  <h3 className="s-adminproduct-1ecd3b">{editV ? 'Edit Variant' : 'Add Variant'}</h3>
                  <button onClick={() => { setShowVF(false); setEditV(null); }}
                    className="s-adminproduct-83b18f">×</button>
                </div>

                <form onSubmit={hV(data => saveVar.mutate(data))}>
                  <div className="s-updateprofil-900022">
                    <Field label="Variant Name *" error={eV.variantName?.message as string}>
                      <input {...rV('variantName')} className="inp-field" placeholder="e.g. Midnight Black" />
                    </Field>

                    {/* ── Color field — two-way auto-resolution ── */}
                    <Field label="Color">
                      <div className="s-adminproduct-6597c4">

                        {/* Row 1: picker + live swatch preview */}
                        <div className="s-adminproduct-04b6ac">
                          {/* Native color picker — changes hex, auto-resolves name */}
                          <input
                            type="color"
                            value={colorHex}
                            onChange={e => handleColorHexChange(e.target.value)}
                            className="s-adminproduct-d36f9a"
                            title="Pick a color — name is resolved automatically"
                          />
                          {/* Hex text input — changes hex, auto-resolves name */}
                          <input
                            value={colorHex}
                            onChange={e => handleColorHexChange(e.target.value)}
                            className="inp-field s-adminproduct-68dfb3"
                            placeholder="#C8A882"
                          />
                        </div>

                        {/* Row 2: color name input — changes name, auto-resolves hex */}
                        <input
                          value={colorName}
                          onChange={e => handleColorNameChange(e.target.value)}
                          className="inp-field"
                          placeholder="Color name, e.g. Bark, Midnight, Coral Red"
                        />

                        {/* Live resolved preview */}
                        {colorName && (
                          <div className="s-adminproduct-9511b6">
                            <span className="s-adminproduct-81ef4f" style={ {background: colorHex} } />
                            <span className="s-adminbrands-95b451">Stored as:</span>
                            <strong>{colorName}</strong>
                            <span className="s-adminbrands-95b451">→</span>
                            <code className="s-adminproduct-d7fbe2">{colorHex}</code>
                          </div>
                        )}
                      </div>
                    </Field>
                  </div>

                  <Field label="Variant Description">
                    <textarea {...rV('variantDescription')} className="inp-field s-adminproduct-f4c34e" placeholder="Optional description for this color/style" />
                  </Field>

                  <div className="s-adminproduct-99eeea">
                    {[
                      { n: 'isBestSeller',      l: '⭐ Best Seller' },
                      { n: 'isReturnAvailable', l: '↩ Returnable' },
                      { n: 'isCupSize',         l: '📐 Has Cup Size' },
                    ].map(o => (
                      <label key={o.n} className="s-adminproduct-66250b">
                        <input type="checkbox" {...rV(o.n as any)} /> {o.l}
                      </label>
                    ))}
                  </div>

                  {/* ── Image Upload Section ── */}
                  <Field label="Product Images">
                    {existingImgs.length > 0 && (
                      <div className="s-adminproduct-02d219">
                        <p className="s-adminproduct-d4b2a4">Current images — click × to remove:</p>
                        <div className="s-adminproduct-47622e">
                          {existingImgs.map((src, i) => (
                            <div key={i} className="s-updateprofil-1d5e50">
                              <img src={getImageUrl(src)} alt=""
                                className="s-adminproduct-8b47fe"
                                onError={e => { (e.target as HTMLImageElement).src = '/assets/category-bg.png'; }} />
                              <button type="button"
                                onClick={() => setExistingImgs(p => p.filter((_, j) => j !== i))}
                                className="s-adminproduct-34e986">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className="s-adminproduct-bb2af0" style={ {cursor: uploading ? 'not-allowed' : 'pointer'} }
                      onClick={() => !uploading && fileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; }}
                      onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ivory)'; }}
                      onDrop={async e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--ivory)';
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (files.length) await processFiles(files);
                      }}>
                      {uploading ? (
                        <>
                          <div className="s-adminproduct-a67995" />
                          <p className="s-adminblog-1c2c10">Uploading to server…</p>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-upload s-adminproduct-25eff0" />
                          <p className="s-adminproduct-063709">Click to upload or drag & drop</p>
                          <p className="s-adminproduct-ba4567">JPG, PNG, WebP · Multiple files allowed</p>
                        </>
                      )}
                      <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} className="s-addressform-8251cb" />
                    </div>

                    {imgPreviews.length > 0 && (
                      <div className="s-adminnewslet-171a67">
                        <p className="s-adminproduct-d4b2a4">
                          New uploads — {uploadedPaths.length}/{imgPreviews.length} done:
                        </p>
                        <div className="s-adminproduct-47622e">
                          {imgPreviews.map((src, i) => (
                            <div key={i} className="s-updateprofil-1d5e50">
                              <img src={src} alt="" className="s-adminproduct-8b47fe" />
                              {i >= uploadedPaths.length && uploading && (
                                <div className="s-adminproduct-a21c09">
                                  <div className="s-adminproduct-cdd4e7" />
                                </div>
                              )}
                              {i < uploadedPaths.length && (
                                <div className="s-adminproduct-f1c780">
                                  <i className="bi bi-check s-adminproduct-b5c012" />
                                </div>
                              )}
                              <button type="button"
                                onClick={() => {
                                  setImgPreviews(p => p.filter((_, j) => j !== i));
                                  setImgFiles(f => f.filter((_, j) => j !== i));
                                  setUploadedPaths(p => p.filter((_, j) => j !== i));
                                }}
                                className="s-adminproduct-34e986">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Field>

                  <div className="s-adminbrands-fcea5e">
                    <button type="button" onClick={() => { setShowVF(false); setEditV(null); }}
                      className="s-adminproduct-83422c">
                      Cancel
                    </button>
                    <button type="submit" disabled={saveVar.isPending || uploading}
                      className="s-adminproduct-dd48fb" style={ {background: uploading ? 'var(--heirloom)' : '#000000', cursor: uploading ? 'not-allowed' : 'pointer'} }>
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
            <div className="s-adminproduct-e64ca9">
              {variants.map((v: any) => {
                const { colorHex: vHex } = resolveColorSwatch(v.color, v.colorHex);
                return (
                  <button key={v.productVariantId} onClick={() => setSelVid(v.productVariantId)}
                    className="s-adminproduct-f3e70e" style={ {border: `2px solid ${selVid === v.productVariantId ? 'var(--brand)' : 'var(--ivory)'}`, background: selVid === v.productVariantId ? 'var(--ivory)' : '#fff'} }>
                    {v.color && (
                      <div className="s-adminproduct-e603d0" style={ {background: vHex} } />
                    )}
                    {v.variantName}
                  </button>
                );
              })}
            </div>
          )}

          <div className="s-userdashboar-aee024">
            <h3 className="s-adminproduct-53697f">
              Sizes & Pricing
              {selVid && <span className="s-adminproduct-675c1f">
                for {variants.find((v: any) => v.productVariantId === selVid)?.variantName}
              </span>}
            </h3>
            <button onClick={() => { setEditVD(null); setShowVDF(true); }} disabled={!selVid}
              className="s-adminproduct-9c0395" style={ {background: selVid ? '#000000' : 'var(--ivory)', cursor: selVid ? 'pointer' : 'not-allowed'} }>
              <i className="bi bi-plus-lg" /> Add Size
            </button>
          </div>

          {!selVid ? (
            <div className="s-adminproduct-0584c4">
              <i className="bi bi-rulers s-adminproduct-05c981" />
              <p className="s-adminorders-18f7bb">Select a variant above to manage its sizes.</p>
            </div>
          ) : (
            <div className="s-adminbrands-a637bc">
              <div className="s-admindashboa-ce7380">
                <table className="s-adminbrands-de3642">
                  <thead>
                    <tr className="s-admininvento-d3aab0">
                      {['Size', 'Cup', 'MRP', 'Final Price', 'Discount', 'Stock', 'Status', 'Actions'].map(h => (
                        <th key={h} className="s-admininvento-947fb4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vds.length === 0 ? (
                      <tr><td colSpan={8} className="s-admininvento-2925c8">No sizes yet — click "Add Size" to start.</td></tr>
                    ) : vds.map((vd: any) => (
                      <tr key={vd.productVariantDetailId} className="s-adminbrands-59d787">
                        <td className="s-admininvento-192c9d">{vd.sizeLabel || '—'}</td>
                        <td className="s-admindashboa-76859f">{vd.cupSizeLabel || '—'}</td>
                        <td className="s-adminproduct-08c274">₹{vd.mrpPrice}</td>
                        <td className="s-adminproduct-d42842">₹{vd.finalPrice}</td>
                        <td className="s-admindashboa-f5f90c">
                          {vd.discountPercent > 0 && (
                            <span className="s-adminproduct-023f38">
                              {vd.discountPercent}% OFF
                            </span>
                          )}
                        </td>
                        <td className="s-adminproduct-087ce1" style={ {color: (vd.stockQuantity || 0) === 0 ? 'var(--brand)' : (vd.stockQuantity || 0) < 10 ? 'var(--brand)' : 'var(--brand)'} }>
                          {vd.stockQuantity ?? 0}
                        </td>
                        <td className="s-admindashboa-f5f90c">
                          <span className="s-adminproduct-78beb4" style={{ background: vd.state === 'Approved' ? 'var(--ivory)' : '#fff', color: vd.state === 'Approved' ? 'var(--brand)' : 'var(--heirloom)' }}>
                            {vd.state || 'Draft'}
                          </span>
                        </td>
                        <td className="s-admindashboa-f5f90c">
                          <div className="s-adminproduct-6209be">
                            <button onClick={() => { setEditVD(vd); setShowVDF(true); }}
                              className="s-adminproduct-bec64d">
                              <i className="bi bi-pencil" />
                            </button>
                            <button onClick={() => { if (window.confirm('Delete this size entry?')) delVDm.mutate(vd.productVariantDetailId); }}
                              className="s-adminproduct-feb1ca">
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
            <div className="s-adminproduct-ca0ae5"
              onClick={() => { setShowVDF(false); setEditVD(null); }}>
              <div className="s-adminproduct-2ec4f9"
                onClick={e => e.stopPropagation()}>
                <div className="s-adminproduct-a1f2ef">
                  <h3 className="s-adminproduct-1ecd3b">{editVD ? 'Edit Size' : 'Add Size & Pricing'}</h3>
                  <button onClick={() => { setShowVDF(false); setEditVD(null); }}
                    className="s-adminproduct-83b18f">×</button>
                </div>
                <form onSubmit={hVD(data => saveVDm.mutate(data))}>
                  <div className="s-updateprofil-900022">
                    <Field label="Size *" error={eVD.sizeId?.message as string}>
                      <select {...rVD('sizeId', { valueAsNumber: true })} className="inp-field s-adminproduct-c9137f">
                        <option value="">Select Size</option>
                        {sizes.map((s: any) => (
                          <option key={s.sizeId} value={s.sizeId}>{s.sizeLabel}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cup Size (optional)">
                      <select {...rVD('cupSizeId', { valueAsNumber: true })} className="inp-field s-adminproduct-c9137f">
                        <option value="">No Cup Size</option>
                        {cupSizes.map((c: any) => (
                          <option key={c.cupSizeId} value={c.cupSizeId}>{c.sizeLabel}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="MRP (₹) *" error={eVD.mrpPrice?.message as string}>
                      <input type="number" {...rVD('mrpPrice', { valueAsNumber: true })} className="inp-field" placeholder="0" min="0" />
                    </Field>
                    <Field label="Final Price (₹) *" error={eVD.finalPrice?.message as string}>
                      <input type="number" {...rVD('finalPrice', { valueAsNumber: true })} className="inp-field" placeholder="0" min="0" />
                    </Field>
                    <Field label="Discount % (auto)">
                      <input type="number" {...rVD('discountPercent', { valueAsNumber: true })} style={{ ...inp, background: 'var(--ivory)', color: 'var(--heirloom)' }} readOnly />
                    </Field>
                    <Field label="Stock Quantity *" error={eVD.stockQuantity?.message as string}>
                      <input type="number" {...rVD('stockQuantity', { valueAsNumber: true })} className="inp-field" placeholder="0" min="0" />
                    </Field>
                  </div>

                  {mrp > 0 && fin > 0 && fin < mrp && (
                    <div className="s-adminproduct-e7f79a">
                      <i className="bi bi-tag-fill" />
                      Customer saves ₹{(mrp - fin).toFixed(0)} — {Math.round(((mrp - fin) / mrp) * 100)}% OFF
                    </div>
                  )}

                  <div className="s-adminblog-679e96">
                    <button type="button" onClick={() => { setShowVDF(false); setEditVD(null); }}
                      className="s-adminproduct-83422c">
                      Cancel
                    </button>
                    <button type="submit" disabled={saveVDm.isPending}
                      className="s-adminproduct-811531">
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