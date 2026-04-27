import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  productCode: z.string().min(1, 'Product code is required'),
  categoryId: z.coerce.number().min(1, 'Category is required'),
  childCategoryId: z.coerce.number().optional().nullable(),
  brandId: z.coerce.number().min(1, 'Brand is required'),
  tag: z.string().optional().nullable(),
});

const variantSchema = z.object({
  variantName: z.string().min(1, 'Variant name is required'),
  variantProductCode: z.string().min(1, 'Variant product code is required'),
  variantDescription: z.string().optional().nullable(),
  fabricId: z
    .union([z.coerce.number(), z.literal(''), z.null()])
    .transform(v => (v === '' || v === 0 ? null : v))
    .optional()
    .nullable(),
  // FIX-V2: taxHSNCodeId replaces free-text hsnCode
  taxHSNCodeId: z
    .union([z.coerce.number(), z.literal(''), z.null()])
    .transform(v => (v === '' || v === 0 ? null : v))
    .optional()
    .nullable(),
  isBestSeller: z.boolean().optional().default(false),
  isReturnAvailable: z.boolean().optional().default(false),
  // FIX-V5: isCupSize must be in schema — registered via hidden input + Toggle
  isCupSize: z.boolean().optional().default(false),
});

const vdSchema = z.object({
  stockQuantity: z.coerce.number().min(0, 'Stock quantity is required'),
  sizeId: z.coerce.number().min(1, 'Size is required'),
  cupSizeId: z.union([z.coerce.number(), z.literal(''), z.null()])
    .transform(v => (v === '' || v === 0 ? null : v))
    .optional().nullable(),
  mrpPrice: z.coerce.number().min(1, 'MRP is required'),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  finalPrice: z.coerce.number().min(1, 'Final price is required'),
  cgst: z.coerce.number().min(0, 'CGST is required'),
  sgst: z.coerce.number().min(0, 'SGST is required'),
  availableStockQuantity: z.coerce.number().optional().nullable(),
  processedStockQuantity: z.coerce.number().optional().nullable(),
  amendmentStockQuantity: z.coerce.number().optional().nullable(),
});

type Tab = 'product' | 'variants' | 'details';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_ACTIONS: Record<string, string[]> = {
  Created: ['Submit For Approval'],
  Modified: ['Submit For Approval'],
  'Submitted To Product Manager': ['Approve', 'Reject'],
  'Submitted To Inventory Manager': ['Approve', 'Reject'],
  Approved: ['Return For Correction'],
  Rejected: ['Resubmit'],
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Approved: { bg: '#e8f5e9', color: '#2e7d32' },
  Created: { bg: '#e3f2fd', color: '#1565c0' },
  Modified: { bg: '#fff8e1', color: '#f57f17' },
  Rejected: { bg: '#ffebee', color: '#c62828' },
  'Submitted To Product Manager': { bg: '#fce4ec', color: '#c62828' },
  'Submitted To Inventory Manager': { bg: '#fce4ec', color: '#c62828' },
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const primary = '#7A1E2C';
const primaryLt = '#F5E9E6';
const bgMain = '#FAF7F4';
const cardBg = '#FFFFFF';
const border = '#E6DAD3';
const grey = '#F3EFEC';
const txt = '#2B2B2B';
const sub = '#8A7F7A';

// ─── Inline styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: cardBg,
  borderRadius: 12,
  padding: '28px 32px 24px',
  marginBottom: 20,
  border: `1px solid ${border}`,
};
const grid3: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
  gap: '20px 32px', marginBottom: 22,
};
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: sub, marginBottom: 6 };
const inp: React.CSSProperties = {
  border: 'none', borderBottom: `1.5px solid ${border}`,
  padding: '8px 0', fontSize: 14, color: txt,
  background: 'transparent', outline: 'none',
  width: '100%', fontFamily: 'inherit',
};
const sel: React.CSSProperties = { ...inp, cursor: 'pointer', appearance: 'auto' as const };
const errStyle: React.CSSProperties = { fontSize: 11, color: primary, marginTop: 3 };
const btnPrimary: React.CSSProperties = {
  background: primary, color: '#fff', border: 'none',
  borderRadius: 24, padding: '10px 26px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  letterSpacing: 0.3, whiteSpace: 'nowrap' as const,
};
const btnOut: React.CSSProperties = {
  background: '#fff', color: primary, border: `1.5px solid ${primary}`,
  borderRadius: 24, padding: '10px 26px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};
const actionsRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end',
  gap: 12, marginTop: 28, flexWrap: 'wrap' as const,
};
const badgeStyle = (state: string | null): React.CSSProperties => {
  const s = STATUS_COLOR[state || ''] ?? { bg: grey, color: sub };
  return {
    background: s.bg, color: s.color,
    border: `1.5px solid ${s.color}`,
    borderRadius: 20, padding: '5px 16px',
    fontSize: 13, fontWeight: 700,
  };
};
const tabBtn = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: '13px 24px', border: 'none', background: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 14, fontWeight: active ? 700 : 400,
  color: active ? primary : '#555',
  borderBottom: `2px solid ${active ? primary : 'transparent'}`,
  marginBottom: -2, fontFamily: 'inherit',
  opacity: disabled ? 0.5 : 1,
});

// ─── Safe helpers ─────────────────────────────────────────────────────────────
function safeColorHex(color?: string | null, colorHex?: string | null): string {
  try {
    const r = resolveColorSwatch(color ?? undefined, colorHex ?? undefined);
    return r?.colorHex || colorHex || color || '#888888';
  } catch {
    return colorHex || color || '#888888';
  }
}
function safeImageUrl(path: unknown): string | null {
  if (!path || typeof path !== 'string') return null;
  try { return getImageUrl(path); } catch { return null; }
}

// ─── Small components ─────────────────────────────────────────────────────────
function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div style={fieldWrap}>
      <label style={lbl}>{label}{required && <span style={{ color: primary }}>*</span>}</label>
      {children}
      {error && <p style={errStyle}>{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      onClick={() => onChange(!checked)}>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: checked ? primary : '#ccc',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          left: checked ? 20 : 2, top: 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 14, color: '#444' }}>{label}</span>
    </div>
  );
}

// ─── File upload helpers ──────────────────────────────────────────────────────
async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Uploads directly to /{variantId}/images endpoint — saves to ProductImage table
async function uploadVariantImage(
  file: File,
  variantId: number
): Promise<{ productImageId: number; filePath: string }> {
  const formData = new FormData();
  formData.append('files', file);

  const res = await api.post(`/ProductVariants/${variantId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // Backend returns { uploaded: N, images: [{productImageId, filePath}] }
  const first = res.data?.images?.[0];
  if (!first) throw new Error('Upload succeeded but no image path returned');
  return first;
}
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminProductForm() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { getUserId } = useAuthStore();
  const isEdit = !!id && id !== '0' && id !== 'new';
  const pid = isEdit ? Number(id) : 0;

  const [tab, setTab] = useState<Tab>('product');
  const [savedPid, setSavedPid] = useState(pid);
  const [pState, setPState] = useState<string | null>(null);
  const [selVid, setSelVid] = useState<number | null>(null);
  const [vdState, setVdState] = useState<string | null>(null);

  const [showVF, setShowVF] = useState(false);
  const [showVDF, setShowVDF] = useState(false);
  const [editV, setEditV] = useState<any>(null);
  const [editVD, setEditVD] = useState<any>(null);
  const [childCats, setChildCats] = useState<any[]>([]);

  // ── Color state ──────────────────────────────────────────────────────────────
  const [colorHex, setColorHex] = useState('#888888');

  // ── Image state ──────────────────────────────────────────────────────────────
  const [imgPreviews, setImgPreviews] = useState<string[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingImgs, setExistingImgs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetImages = useCallback(() => {
    setImgPreviews([]); setUploadedPaths([]); setExistingImgs([]);
  }, []);

  // ── Lookups ──────────────────────────────────────────────────────────────────
  const { data: cD } = useQuery({ queryKey: ['ac'], queryFn: () => api.get('/Category', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: bD } = useQuery({ queryKey: ['ab'], queryFn: () => api.get('/Brand/', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: sD } = useQuery({ queryKey: ['as'], queryFn: () => api.get('/Size', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: csD } = useQuery({ queryKey: ['acs'], queryFn: () => api.get('/CupSize', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  const { data: fbD } = useQuery({ queryKey: ['afb'], queryFn: () => api.get('/Fabric', { params: { 'Page.Size': 200 } }).then(r => r.data?.list || []) });
  // FIX-V2: Fetch HSN codes from /TaxHSNCode API
  const { data: hsnD } = useQuery({ queryKey: ['ahsn'], queryFn: () => api.get('/TaxHSNCode', { params: { 'Page.Size': 500 } }).then(r => r.data?.list || []) });

  const cats = useMemo(() => (cD as any[]) ?? [], [cD]);
  const brands = useMemo(() => (bD as any[]) ?? [], [bD]);
  const sizes = useMemo(() => (sD as any[]) ?? [], [sD]);
  const cupSizes = useMemo(() => (csD as any[]) ?? [], [csD]);
  const fabrics = useMemo(() => (fbD as any[]) ?? [], [fbD]);
  // FIX-V2: HSN codes list
  const hsnCodes = useMemo(() => (hsnD as any[]) ?? [], [hsnD]);

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: pData } = useQuery({
    queryKey: ['apf', savedPid],
    queryFn: () => api.get(`/Products/${savedPid}`).then(r => r.data),
    enabled: savedPid > 0,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: vData, refetch: refV, isLoading: vLoading, isError: vError } = useQuery({
    queryKey: ['avs', savedPid],
    queryFn: () => api.get('/ProductVariants', {
      params: {
        Filters: JSON.stringify([{ property: 'ProductId', comparison: '==', value: String(savedPid) }]),
        'Page.Size': 50,
      },
    }).then(r => r.data?.list || []),
    enabled: savedPid > 0,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: vdData, refetch: refVD } = useQuery({
    queryKey: ['avds', selVid],
    queryFn: () => api.get('/ProductVariantDetail', {
      params: {
        Filters: JSON.stringify([{ property: 'ProductVariantId', comparison: '==', value: String(selVid) }]),
        'Page.Size': 100,
      },
    }).then(r => r.data?.list || []),
    enabled: !!selVid,
    staleTime: 0,
    refetchOnMount: true,
  });

  const variants = useMemo(() => (vData as any[]) ?? [], [vData]);
  const vds = useMemo(() => {
    const list = (vdData as any[]) ?? [];
    return list.filter(v => v.productVariantId === selVid);
  }, [vdData, selVid]);

  // ── Product form ──────────────────────────────────────────────────────────────
  const { register: rP, handleSubmit: hP, reset, watch: wP, formState: { errors: eP } } =
    useForm({ resolver: zodResolver(productSchema) });

  const selCat = Number(wP('categoryId'));
  useEffect(() => {
    if (pData) {
      reset({
        name: pData.name ?? '',
        description: pData.description ?? '',
        productCode: pData.productCode ?? '',
        categoryId: pData.categoryId ?? undefined,
        childCategoryId: pData.childCategoryId ?? undefined,
        brandId: pData.brandId ?? undefined,
        tag: pData.tag ?? '',
      });
      setPState(pData.state ?? null);
    }
  }, [pData, reset, tab]);;

  useEffect(() => {
    if (selCat && cats.length)
      setChildCats(cats.filter((c: any) => c.parentCategoryId === selCat));
    else
      setChildCats([]);
  }, [selCat, cats]);

  // ── Variant form ──────────────────────────────────────────────────────────────
  const {
    register: rV,
    handleSubmit: hV,
    setValue: sV,
    reset: resetV,
    watch: wV,
    formState: { errors: eV },
  } = useForm({ resolver: zodResolver(variantSchema) });

  const variantId = selVid ?? editV?.productVariantId;

  const { data: prodImgData, refetch: refImgs } = useQuery({
    queryKey: ['productImages', variantId],
    queryFn: async () => {
      if (!variantId) return [];

      const res = await api.get(
        `/ProductVariants/${variantId}/images`
      );

      return res.data || [];
    },
    enabled: !!variantId,
    staleTime: 0,
  });
  const productImages: any[] = useMemo(() => prodImgData ?? [], [prodImgData]);

  // Add a delete mutation
  const delProductImage = useMutation({
    mutationFn: (imageId: number) =>
      api.delete(`/ProductVariants/${selVid ?? editV?.productVariantId}/images/${imageId}`),
    onSuccess: () => refImgs(),
    onError: () => toast.error('Failed to remove image'),
  });

  // Watch boolean fields to drive Toggle visuals
  const isBestSellerVal = !!wV('isBestSeller');
  const isReturnVal = !!wV('isReturnAvailable');
  const isCupSizeVal = !!wV('isCupSize');

  useEffect(() => {
    if (editV) {
      sV('variantName', editV.variantName ?? '');
      sV('variantProductCode', editV.variantProductCode ?? editV.productCode ?? editV.variantCode ?? '');
      sV('variantDescription', editV.variantDescription ?? '');
      sV('fabricId', editV.fabricId ?? null);
      sV('taxHSNCodeId', editV.taxHSNCodeId ?? null);
      sV('isBestSeller', !!editV.isBestSeller);
      sV('isReturnAvailable', !!editV.isReturnAvailable);
      sV('isCupSize', !!editV.isCupSize);
      setColorHex(safeColorHex(editV.color, editV.colorHex));
    } else {
      resetV({
        variantName: '', variantProductCode: '', variantDescription: '',
        fabricId: null, taxHSNCodeId: null,
        isBestSeller: false, isReturnAvailable: false, isCupSize: false,
      });
      setColorHex('#888888');
      setExistingImgs([]);
    }
    // Always clear local state on form open
    setImgPreviews([]);
    setUploadedPaths([]);
    setPendingFiles([]);
  }, [editV, resetV, sV]);

  useEffect(() => {
    if (productImages.length > 0) {
      setExistingImgs(productImages.map((img: any) => img.filePath));
    }
  }, [productImages]);

  // ── VD form ───────────────────────────────────────────────────────────────────
  const {
    register: rVD,
    handleSubmit: hVD,
    setValue: sVD,
    reset: resetVD,
    watch: wVD,
    formState: { errors: eVD },
  } = useForm({ resolver: zodResolver(vdSchema) });

  const mrp = Number(wVD('mrpPrice') || 0);
  const fin = Number(wVD('finalPrice') || 0);

  useEffect(() => {
    if (editVD) {
      sVD('stockQuantity', editVD.stockQuantity ?? 0);
      sVD('sizeId', editVD.sizeId ?? '');
      sVD('cupSizeId', editVD.cupSizeId ?? '');
      sVD('mrpPrice', editVD.mrpPrice ?? '');
      sVD('discountPercent', editVD.discountPercent ?? 0);
      sVD('finalPrice', editVD.finalPrice ?? '');
      sVD('cgst', editVD.cgst ?? 0);
      sVD('sgst', editVD.sgst ?? 0);
      sVD('availableStockQuantity', editVD.availableStockQuantity ?? '');
      sVD('processedStockQuantity', editVD.processedStockQuantity ?? '');
      sVD('amendmentStockQuantity', editVD.amendmentStockQuantity ?? '');
      setVdState(editVD.state ?? null);
    } else {
      resetVD();
      setVdState(null);
    }
  }, [editVD, resetVD, sVD]);

  // Auto discount
  useEffect(() => {
    if (mrp > 0 && fin > 0 && fin <= mrp)
      sVD('discountPercent', Math.round(((mrp - fin) / mrp) * 100));
    else if (mrp > 0 && fin > mrp)
      sVD('discountPercent', 0);
  }, [mrp, fin, sVD]);

  // ── Image upload ──────────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const processFiles = async (files: File[]) => {
    const valid = files.filter(f => {
      if (f.size > 2 * 1024 * 1024) { toast.error(`${f.name} exceeds 2 MB`); return false; }
      return true;
    });
    if (!valid.length) return;

    // Always show local previews immediately
    valid.forEach(f => {
      const r = new FileReader();
      r.onload = ev => setImgPreviews(p => [...p, ev.target?.result as string]);
      r.readAsDataURL(f);
    });

    const currentVariantId = editV?.productVariantId ?? null;

    if (currentVariantId) {
      // EDIT MODE: variant exists → upload to DB right now
      setUploading(true);
      try {
        await Promise.all(valid.map(f => uploadVariantImage(f, currentVariantId)));
        toast.success(`${valid.length} image${valid.length > 1 ? 's' : ''} uploaded`);
        refImgs(); // refresh from DB
        setImgPreviews([]); // clear previews — DB images will show instead
      } catch (e: any) {
        toast.error(e?.response?.data?.detail || 'Upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      // ADD MODE: no variant yet → queue files, upload after variant save
      setPendingFiles(p => [...p, ...valid]);
      toast('Images queued — will upload after variant is saved', { icon: 'ℹ️' });
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await processFiles(files);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const saveProd = useMutation({
    mutationFn: async (data: any) => {
      const wasNew = savedPid === 0;
      const pl = { ...data, userProfileId: getUserId(), state: wasNew ? 'Created' : 'Modified' };
      return wasNew
        ? api.post('/Products/', pl).then(r => r.data)
        : api.put(`/Products/${savedPid}`, pl).then(r => r.data);
    },
    onSuccess: (res) => {
      const wasNew = savedPid === 0;
      // FIX-V8: capture nid before any state changes
      const nid: number =
        res?.productId ?? res?.id ?? res?.data?.productId ?? res?.data?.id ?? savedPid;

      if (nid && nid !== savedPid) {
        setSavedPid(nid);
        window.history.replaceState(null, '', `/admin/products/${nid}`);
        if (res && typeof res === 'object') qc.setQueryData(['apf', nid], res);
      }
      setPState(wasNew ? 'Created' : 'Modified');
      toast.success(wasNew ? 'Product created! Now add variants.' : 'Product updated!');
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      // FIX-V8: setTab directly after setSavedPid — no pendingTabRef needed
      if (wasNew) setTab('variants');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save product'),
  });

  // FIX-V4: correct onError — was copy-pasted from variant save
  const updProdState = useMutation({
    mutationFn: (s: string) => api.put(`/Products/${savedPid}`, { ...(pData ?? {}), state: s }),
    onSuccess: (_, s) => {
      setPState(s);
      toast.success(`Status → ${s}`);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['apf', savedPid] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to update status'),
  });

  const saveVar = useMutation({
    mutationFn: async (data: any) => {
      if (!savedPid || savedPid === 0)
        throw new Error('Please save the product before adding variants.');

      if (!editV) {
        const exists = variants.some(
          (v: any) => v.variantName?.toLowerCase().trim() === data.variantName?.toLowerCase().trim()
        );
        if (exists) throw new Error(`Variant "${data.variantName}" already exists.`);
      }

      const payload: Record<string, any> = {
        variantName: data.variantName,
        productCode: data.variantProductCode,
        productId: savedPid,
        variantDescription: data.variantDescription || null,
        fabricId: data.fabricId || null,
        taxHSNCodeId: data.taxHSNCodeId || null,
        isBestSeller: !!data.isBestSeller,
        isReturnAvailable: !!data.isReturnAvailable,
        isCupSize: !!data.isCupSize,
        color: colorHex || '#888888',
        colorHex: colorHex || '#888888',
        userProfileId: getUserId(),
        createdBy: getUserId(),
        // image fields — will be updated after image upload if new variant
        images: existingImgs,
        image: existingImgs[0] || null,
        state: editV ? 'Modified' : 'Created',
      };

      const res = editV
        ? await api.put(`/ProductVariants/${editV.productVariantId}`, payload)
        : await api.post('/ProductVariants', payload);

      const savedVariant = res.data;
      const newVariantId: number =
        savedVariant?.productVariantId ?? savedVariant?.id ?? savedVariant?.data?.productVariantId;

      // ── Upload queued images now that we have a variantId ──
      if (pendingFiles.length > 0 && newVariantId) {
        try {
          await Promise.all(pendingFiles.map(f => uploadVariantImage(f, newVariantId)));
        } catch (e: any) {
          // Don't block variant save — warn user instead
          toast.error('Variant saved but some images failed to upload. Edit variant to retry.');
        }
      }

      return { ...savedVariant, _newVariantId: newVariantId };
    },
    onSuccess: (res) => {
      toast.success(editV ? 'Variant updated!' : 'Variant created!');
      setShowVF(false);
      setEditV(null);
      setPendingFiles([]);
      setImgPreviews([]);
      setUploadedPaths([]);
      setExistingImgs([]);
      refV();
    },
    onError: (e: any) => {
      const msg =
        e instanceof Error
          ? e.message
          : e?.response?.data?.detail || e?.response?.data?.title || 'Failed to save variant';
      toast.error(msg);
    },
  });

  const delVar = useMutation({
    mutationFn: (id: number) => api.delete(`/ProductVariants/${id}`),
    onSuccess: () => {
      toast.success('Variant deleted');
      if (selVid) setSelVid(null);
      refV();
    },
    onError: () => toast.error('Failed to delete'),
  });

  const saveVD = useMutation<any, any, any>({
    mutationFn: async (data: any) => {
      if (!selVid) throw new Error('Please select a variant first.');

      const payload = {
        productVariantId: selVid,
        productId: savedPid,
        sizeId: Number(data.sizeId),
        cupSizeId: data.cupSizeId ? Number(data.cupSizeId) : null,
        stockQuantity: Number(data.stockQuantity),
        mrpPrice: Number(data.mrpPrice),
        finalPrice: Number(data.finalPrice),
        cgst: Number(data.cgst),
        sgst: Number(data.sgst),
        discountPercent: data.discountPercent || 0,
        availableStockQuantity: data.availableStockQuantity || 0,
        processedStockQuantity: data.processedStockQuantity || 0,
        amendmentStockQuantity: data.amendmentStockQuantity || 0,
        userProfileId: getUserId(),
        createdBy: getUserId(),
        state: editVD ? 'Modified' : 'Created',
      };

      console.log('✅ VD PAYLOAD:', payload);

      return editVD
        ? api.put(`/ProductVariantDetail/${editVD.productVariantDetailId}`, payload)
        : api.post('/ProductVariantDetail', payload);
    },
    onSuccess: () => {
      toast.success(editVD ? 'Details updated!' : 'Details added!');
      setShowVDF(false);
      setEditVD(null);
      refVD();
    },
    onError: (e: any) => {
      console.error('❌ VD ERROR:', e?.response?.data || e);
      toast.error(e?.response?.data?.detail || 'Failed to save details');
    },
  });

  const delVD = useMutation({
    mutationFn: (id: number) => api.delete(`/ProductVariantDetail/${id}`),
    onSuccess: () => { toast.success('Deleted'); refVD(); },
    onError: () => toast.error('Failed to delete'),
  });

  const amendQty = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      api.put(`/ProductVariantDetail/${id}`, { ...editVD, amendmentStockQuantity: qty }),
    onSuccess: () => { toast.success('Quantity amended!'); setShowVDF(false); setEditVD(null); refVD(); },
    onError: () => toast.error('Failed to amend'),
  });

  const markOutOfStock = useMutation({
    mutationFn: (id: number) =>
      api.put(`/ProductVariantDetail/${id}`, { ...editVD, stockQuantity: 0, state: 'OutOfStock' }),
    onSuccess: () => { toast.success('Marked out of stock'); setShowVDF(false); setEditVD(null); refVD(); },
    onError: () => toast.error('Failed'),
  });

  // ── Tab navigation ────────────────────────────────────────────────────────────
  const goTab = (t: Tab) => {
    if (t === 'variants' && !savedPid) { toast('Save the product first.', { icon: 'ℹ️' }); return; }
    if (t === 'details' && !selVid) { toast('Select a variant first.', { icon: 'ℹ️' }); return; }
    setShowVF(false);
    setShowVDF(false);
    setTab(t);
  };

  // ── Variant form submit handler ───────────────────────────────────────────────
  // FIX-V6: single clean submit path
  const onVariantSubmit = hV((data) => {
    saveVar.mutate(data);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: 'var(--font-body, "Segoe UI", sans-serif)', background: bgMain, minHeight: '100vh' }}>

      {/* ── Tab bar ── */}
      <div style={{ background: cardBg, borderRadius: '12px 12px 0 0', padding: '0 32px', borderBottom: `2px solid ${border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex' }}>
          <button style={tabBtn(tab === 'product', false)} onClick={() => goTab('product')}>Product Info</button>
          <button style={tabBtn(tab === 'variants', !savedPid)} onClick={() => goTab('variants')}>
            Variants {variants.length > 0 && `(${variants.length})`}
          </button>
          <button style={tabBtn(tab === 'details', !selVid)} onClick={() => goTab('details')}>
            Variant Details {vds.length > 0 && `(${vds.length})`}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════ TAB 1: Product Form ══ */}
      {tab === 'product' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: txt }}>Product Form</h2>
            {pState && <span style={badgeStyle(pState)}>{pState}</span>}
          </div>

          <form onSubmit={hP(
            (d) => saveProd.mutate(d),
            (errors) => {
              console.error('Validation errors:', errors);
              toast.error('Please fill all required fields');
            }
          )}>            <div style={grid3}>
              <Field label="Name" required error={eP.name?.message as string}>
                <input {...rP('name')} style={inp} placeholder="Product name" />
              </Field>
              <Field label="Description" required error={eP.description?.message as string}>
                <textarea {...rP('description')} style={{ ...inp, resize: 'vertical', minHeight: 56 }} placeholder="Description" />
              </Field>
              <Field label="Product Code" required error={eP.productCode?.message as string}>
                <input {...rP('productCode')} style={inp} placeholder="e.g. TLCB 925" />
              </Field>
            </div>

            <div style={grid3}>
              <Field label="Parent Category" required error={eP.categoryId?.message as string}>
                <select {...rP('categoryId')} style={sel}>
                  <option value="">Select</option>
                  {cats.filter((c: any) => !c.parentCategoryId).map((c: any) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Child Category">
                <select {...rP('childCategoryId', { valueAsNumber: true })} style={sel}>
                  <option value="">Select</option>
                  {childCats.map((c: any) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Brand" required error={eP.brandId?.message as string}>
                <select {...rP('brandId')} style={sel}>
                  <option value="">Select</option>
                  {brands.map((b: any) => (
                    <option key={b.brandId} value={b.brandId}>{b.brandName || b.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ maxWidth: 380, marginBottom: 20 }}>
              <Field label="Tag">
                <input {...rP('tag')} style={inp} placeholder="Tag" />
              </Field>
            </div>

            <div style={actionsRow}>
              {pState === 'Approved' && (
                <button type="button" onClick={() => updProdState.mutate('Return For Correction')}
                  disabled={updProdState.isPending} style={btnPrimary}>
                  Return For Correction
                </button>
              )}
              {pState !== 'Approved' && STATUS_ACTIONS[pState || '']?.map(a => (
                <button key={a} type="button" onClick={() => updProdState.mutate(a)}
                  disabled={updProdState.isPending} style={btnPrimary}>{a}</button>
              ))}
              <button type="button" onClick={() => nav('/admin/products')} style={btnOut}>Cancel</button>
              {pState !== 'Approved' && (
                <button type="submit" disabled={saveProd.isPending} style={btnPrimary}>
                  {saveProd.isPending ? 'Saving…' : savedPid > 0 ? 'Update & Next' : 'Save & Continue'}
                </button>
              )}
              {savedPid > 0 && (
                <button type="button" onClick={() => goTab('variants')}
                  style={{ ...btnPrimary, background: '#1565c0' }}>
                  Next: Add Variants →
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════ TAB 2: Variants ══════ */}
      {tab === 'variants' && (
        <div>
          {/* Variant list */}
          {!showVF && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
                  Product Variants {variants.length > 0 && `(${variants.length})`}
                </h3>
                <button onClick={() => { setEditV(null); setShowVF(true); }} style={btnPrimary}>
                  + Add Variant
                </button>
              </div>

              {vLoading ? (
                <p style={{ textAlign: 'center', padding: '48px 0', color: sub }}>⏳ Loading variants…</p>
              ) : vError ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ color: primary }}>Failed to load.{' '}
                    <button onClick={() => refV()} style={{ color: primary, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
                  </p>
                </div>
              ) : variants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb' }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>🎨</div>
                  <p>No variants yet — click "Add Variant" to start.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {variants.map((v: any) => {
                    const vHex = safeColorHex(v.color, v.colorHex);
                    const imgSrc = safeImageUrl(v.image || (Array.isArray(v.images) ? v.images[0] : null));
                    return (
                      <div key={v.productVariantId}
                        style={{
                          border: `2px solid ${selVid === v.productVariantId ? primary : '#f0f0f0'}`,
                          borderRadius: 10, padding: '14px 18px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: selVid === v.productVariantId ? primaryLt : '#fff', cursor: 'pointer',
                        }}
                        onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {imgSrc ? (
                            <img src={imgSrc} alt={v.variantName}
                              style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div style={{ width: 52, height: 52, borderRadius: 8, background: vHex, flexShrink: 0 }} />
                          )}
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{v.variantName}</p>
                            <p style={{ fontSize: 12, color: sub, margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {v.color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: vHex, display: 'inline-block' }} />}
                              {v.color || v.productCode || ''}
                            </p>
                            {v.isBestSeller && <span style={{ fontSize: 11, color: '#f57f17', fontWeight: 600 }}>⭐ Best Seller</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditV(v); setShowVF(true); }} style={{ ...btnOut, padding: '7px 16px', fontSize: 12 }}>Edit</button>
                          <button onClick={() => { setSelVid(v.productVariantId); setTab('details'); }}
                            style={{ background: 'transparent', color: '#555', border: '1.5px solid #ddd', borderRadius: 24, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>
                            Details →
                          </button>
                          <button onClick={() => {
                            if (window.confirm(`Delete "${v.variantName}"? All sizes will also be removed.`))
                              delVar.mutate(v.productVariantId);
                          }} style={{ background: 'transparent', color: primary, border: `1.5px solid ${primary}`, borderRadius: 24, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {variants.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
                  <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
                    ✅ {variants.length} variant{variants.length > 1 ? 's' : ''} added. Now add size &amp; pricing for each.
                  </p>
                  <button type="button" onClick={() => { setSelVid(variants[0].productVariantId); setTab('details'); }}
                    style={{ ...btnPrimary, background: '#1565c0' }}>
                    Next: Add Variant Details →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Variant Form ── */}
          {showVF && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Product Variant Form</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!savedPid && (
                    <span style={{ fontSize: 12, color: primary }}>⚠ Save the product first</span>
                  )}
                  {/* FIX-V6: single submit path */}
                  <button
                    type="button"
                    disabled={saveVar.isPending || uploading || !savedPid}
                    onClick={onVariantSubmit}
                    style={{ ...btnPrimary, opacity: !savedPid ? 0.4 : 1 }}
                  >
                    {saveVar.isPending ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
                  </button>
                  <button type="button"
                    onClick={() => { setShowVF(false); setEditV(null); resetImages(); }}
                    style={btnOut}>
                    Cancel
                  </button>
                </div>
              </div>

              {/* FIX-V6: form has no onSubmit — submission driven by Save button */}
              <form onSubmit={e => e.preventDefault()}>

                {/* Row 1: Variant Name | Variant Product Code | Variant Description */}
                <div style={grid3}>
                  <Field label="Variant Name" required error={eV.variantName?.message as string}>
                    <input {...rV('variantName')} style={inp} placeholder="e.g. Black & White Lace Bra" />
                  </Field>
                  <Field label="Variant Product Code" required error={eV.variantProductCode?.message as string}>
                    <input {...rV('variantProductCode')} style={inp} placeholder="e.g. TLCB 925-BLK" />
                  </Field>
                  <Field label="Variant Description">
                    <textarea {...rV('variantDescription')} style={{ ...inp, resize: 'vertical', minHeight: 56 }} placeholder="Optional description" />
                  </Field>
                </div>

                {/* Row 2: Fabrics | Color | HSN Code (FIX-V2: dropdown from API) */}
                <div style={grid3}>
                  <Field label="Fabrics">
                    <select {...rV('fabricId')} style={sel}>
                      <option value="">Select Fabric</option>
                      {fabrics.map((f: any) => (
                        <option key={f.fabricId ?? f.id} value={f.fabricId ?? f.id}>{f.fabricName || f.name}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Color">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        value={colorHex}
                        onChange={e => setColorHex(e.target.value)}
                        style={{ ...inp, flex: 1 }}
                        placeholder="#292323"
                      />
                      <label style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: /^#[0-9a-f]{3,6}$/i.test(colorHex) ? colorHex : '#888',
                          border: '2px solid #ddd',
                        }} />
                        <input type="color"
                          value={/^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : '#888888'}
                          onChange={e => setColorHex(e.target.value)}
                          style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                      </label>
                    </div>
                  </Field>

                  {/* FIX-V2: HSN Code — dropdown fetched from /TaxHSNCode, stores taxHSNCodeId */}
                  <Field label="HSN Code" error={eV.taxHSNCodeId?.message as string}>
                    <select {...rV('taxHSNCodeId')} style={sel}>
                      <option value="">Select HSN Code</option>
                      {hsnCodes.map((h: any) => (
                        <option key={h.taxHSNCodeId ?? h.id} value={h.taxHSNCodeId ?? h.id}>
                          {h.hsnCode ?? h.code ?? h.name} {h.description ? `— ${h.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Row 3: Toggles */}
                {/* FIX-V5: hidden inputs register booleans with RHF so zod receives them */}
                <input type="hidden" {...rV('isBestSeller')} />
                <input type="hidden" {...rV('isReturnAvailable')} />
                <input type="hidden" {...rV('isCupSize')} />

                <div style={{ display: 'flex', gap: 48, marginBottom: 28, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  <Toggle
                    checked={isBestSellerVal}
                    onChange={v => sV('isBestSeller', v)}
                    label="Is Best Seller"
                  />
                  <Toggle
                    checked={isReturnVal}
                    onChange={v => sV('isReturnAvailable', v)}
                    label="Is Return Available"
                  />
                  <Toggle
                    checked={isCupSizeVal}
                    onChange={v => sV('isCupSize', v)}
                    label="Is Cup Size Required"
                  />
                </div>

                {/* Upload zone */}
                <div
                  style={{
                    border: '2px dashed #f8bbd0', borderRadius: 10,
                    background: '#fff9fb', padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    cursor: uploading ? 'default' : 'pointer', marginBottom: 16,
                  }}
                  onClick={() => !uploading && fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = primary; }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f8bbd0'; }}
                  onDrop={async e => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).style.borderColor = '#f8bbd0';
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    if (files.length) await processFiles(files);
                  }}>
                  <div style={{ fontSize: 28, color: '#e57373' }}>☁</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#555', fontSize: 14, margin: '0 0 3px' }}>
                      {uploading ? 'Uploading…' : 'Drag File here to Upload'}
                    </p>
                    <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Allowed Files: JPG, PNG | Max File Size: 2 MB</p>
                  </div>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                    style={{ ...btnPrimary, padding: '8px 22px', fontSize: 13 }}>
                    Browse
                  </button>
                  <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png"
                    onChange={handleFileInput} style={{ display: 'none' }} />
                </div>

                {/* Image thumbnails */}
                {(existingImgs.length > 0 || imgPreviews.length > 0) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 20 }}>
                    {/* Image thumbnails — DB images (edit mode) */}
                    {productImages.map((img: any) => {
                      const s = safeImageUrl(img.filePath);
                      return (
                        <div key={img.productImageId}
                          style={{ position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          {s && <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).src = '/assets/placeholder.png'; }} />}
                          <div style={{
                            position: 'absolute', bottom: 2, left: 4, fontSize: 10, color: '#fff',
                            background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '1px 4px'
                          }}>saved</div>
                          <button type="button" onClick={() => delProductImage.mutate(img.productImageId)}
                            style={{
                              position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                              borderRadius: '50%', background: primary, color: '#fff', border: 'none',
                              fontSize: 14, cursor: 'pointer', fontWeight: 700, padding: 0,
                              lineHeight: '22px', textAlign: 'center'
                            }}>×</button>
                        </div>
                      );
                    })}

                    {/* Local previews — queued files (add mode) or upload-in-progress */}
                    {imgPreviews.map((src, i) => (
                      <div key={`preview-${i}`}
                        style={{ position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {/* "queued" badge for new variant pending files */}
                        {!editV && (
                          <div style={{
                            position: 'absolute', bottom: 2, left: 4, fontSize: 10, color: '#fff',
                            background: 'rgba(245,127,23,0.85)', borderRadius: 4, padding: '1px 4px'
                          }}>queued</div>
                        )}
                        <button type="button"
                          onClick={() => {
                            setImgPreviews(p => p.filter((_, j) => j !== i));
                            setPendingFiles(p => p.filter((_, j) => j !== i));
                          }}
                          style={{
                            position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                            borderRadius: '50%', background: primary, color: '#fff', border: 'none',
                            fontSize: 14, cursor: 'pointer', fontWeight: 700, padding: 0,
                            lineHeight: '22px', textAlign: 'center'
                          }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ TAB 3: Variant Details ══ */}
      {tab === 'details' && (
        <div>
          {/* Variant selector chips */}
          {variants.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, padding: '12px 0 8px' }}>
              {variants.map((v: any) => {
                const vHex = safeColorHex(v.color, v.colorHex);
                const active = selVid === v.productVariantId;
                return (
                  <button key={v.productVariantId} onClick={() => setSelVid(v.productVariantId)}
                    style={{
                      border: `2px solid ${active ? primary : '#e0e0e0'}`,
                      borderRadius: 24, padding: '7px 18px', fontSize: 13,
                      background: active ? primaryLt : '#fff',
                      color: active ? primary : '#555', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontWeight: active ? 600 : 400,
                    }}>
                    {v.color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: vHex }} />}
                    {v.variantName}
                  </button>
                );
              })}
            </div>
          )}

          {/* VD list */}
          {!showVDF && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
                  Product Variant Details
                  {selVid && (
                    <span style={{ fontSize: 14, fontWeight: 400, color: sub, marginLeft: 8 }}>
                      — {variants.find((v: any) => v.productVariantId === selVid)?.variantName}
                    </span>
                  )}
                </h3>
                <button onClick={() => { setEditVD(null); setShowVDF(true); }} disabled={!selVid}
                  style={{ ...btnPrimary, opacity: selVid ? 1 : 0.4, cursor: selVid ? 'pointer' : 'not-allowed' }}>
                  + Add Detail
                </button>
              </div>

              {!selVid ? (
                <p style={{ color: '#bbb', textAlign: 'center', padding: '32px 0' }}>Select a variant above.</p>
              ) : vds.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center', padding: '32px 0' }}>No details yet — click "Add Detail".</p>
              ) : (
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                        {['Stock', 'Size', 'Cup', 'MRP', 'Disc%', 'Final', 'CGST', 'SGST', 'Avail.', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: sub, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vds.map((vd: any) => (
                        <tr key={vd.productVariantDetailId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '12px', fontSize: 14, fontWeight: 600, color: (vd.stockQuantity ?? 0) === 0 ? primary : '#2e7d32' }}>{vd.stockQuantity ?? 0}</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>{vd.sizeLabel || '—'}</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>{vd.cupSizeLabel || '—'}</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>₹{vd.mrpPrice}</td>
                          <td style={{ padding: '12px', fontSize: 14, color: '#2e7d32' }}>{vd.discountPercent > 0 ? `${vd.discountPercent}%` : '—'}</td>
                          <td style={{ padding: '12px', fontSize: 14, fontWeight: 600 }}>₹{vd.finalPrice}</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>{vd.cgst ?? '—'}%</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>{vd.sgst ?? '—'}%</td>
                          <td style={{ padding: '12px', fontSize: 14 }}>{vd.availableStockQuantity ?? '—'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ ...badgeStyle(vd.state), padding: '3px 10px', fontSize: 11 }}>{vd.state || 'Draft'}</span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setEditVD(vd); setShowVDF(true); }} style={{ ...btnOut, padding: '5px 14px', fontSize: 12 }}>Edit</button>
                              <button onClick={() => { if (window.confirm('Delete?')) delVD.mutate(vd.productVariantDetailId); }}
                                style={{ background: 'transparent', color: primary, border: `1.5px solid ${primary}`, borderRadius: 20, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {vds.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#444', margin: '0 0 4px', fontWeight: 600 }}>Ready to submit?</p>
                    <p style={{ fontSize: 12, color: '#888', margin: 0 }}>All variants and sizes entered.</p>
                  </div>
                  {(pState === 'Created' || pState === 'Modified' || pState === 'Rejected') && (
                    <button type="button" onClick={() => updProdState.mutate('Submitted To Product Manager')}
                      disabled={updProdState.isPending}
                      style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 26px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {updProdState.isPending ? 'Submitting…' : '✓ Submit For Approval'}
                    </button>
                  )}
                  {pState === 'Submitted To Product Manager' && (
                    <span style={{ fontSize: 13, color: primary, fontWeight: 600 }}>⏳ Awaiting approval…</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Variant Detail form ── */}
          {showVDF && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Product Variant Details</h2>
                {vdState && <span style={badgeStyle(vdState)}>{vdState}</span>}
              </div>

              <form onSubmit={hVD(d => saveVD.mutate(d))}>
                <div style={grid3}>
                  <Field label="Stock Quantity" required error={eVD.stockQuantity?.message as string}>
                    <input type="number" {...rVD('stockQuantity', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                  </Field>
                  <Field label="Size" required error={eVD.sizeId?.message as string}>
                    <select {...rVD('sizeId', { valueAsNumber: true })} style={sel}>
                      <option value="">Select</option>
                      {sizes.map((s: any) => <option key={s.sizeId} value={s.sizeId}>{s.sizeLabel}</option>)}
                    </select>
                  </Field>
                  <Field label="Cup Size">
                    <select {...rVD('cupSizeId')} style={sel}>
                      <option value="">No Cup Size</option>
                      {cupSizes.map((c: any) => <option key={c.cupSizeId} value={c.cupSizeId}>{c.sizeLabel}</option>)}
                    </select>
                  </Field>
                </div>

                <div style={grid3}>
                  <Field label="MRP Price" required error={eVD.mrpPrice?.message as string}>
                    <input type="number" {...rVD('mrpPrice', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                  </Field>
                  <Field label="Discount Percent">
                    <input type="number" {...rVD('discountPercent', { valueAsNumber: true })}
                      style={{ ...inp, color: sub, background: '#fafafa' }} readOnly placeholder="Auto" />
                  </Field>
                  <Field label="Final Price" required error={eVD.finalPrice?.message as string}>
                    <input type="number" {...rVD('finalPrice', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                  </Field>
                </div>

                <div style={grid3}>
                  <Field label="CGST" required error={eVD.cgst?.message as string}>
                    <input type="number" {...rVD('cgst', { valueAsNumber: true })} style={inp} placeholder="e.g. 6" min="0" step="0.01" />
                  </Field>
                  <Field label="SGST" required error={eVD.sgst?.message as string}>
                    <input type="number" {...rVD('sgst', { valueAsNumber: true })} style={inp} placeholder="e.g. 6" min="0" step="0.01" />
                  </Field>
                </div>

                <div style={grid3}>
                  <Field label="Available Stock Quantity">
                    <input type="number" {...rVD('availableStockQuantity', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                  </Field>
                  <Field label="Processed Stock Quantity">
                    <input type="number" {...rVD('processedStockQuantity', { valueAsNumber: true })} style={inp} placeholder="0" min="0" />
                  </Field>
                  <Field label="Amendment Stock Quantity">
                    <input type="number" {...rVD('amendmentStockQuantity', { valueAsNumber: true })}
                      style={{ ...inp, borderBottom: `1.5px solid ${primary}` }} placeholder="Enter quantity" min="0" />
                  </Field>
                </div>

                {mrp > 0 && fin > 0 && fin < mrp && (
                  <div style={{ background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#f57f17', marginBottom: 12 }}>
                    🏷 Customer saves ₹{(mrp - fin).toFixed(0)} — {Math.round(((mrp - fin) / mrp) * 100)}% OFF
                  </div>
                )}
                {mrp > 0 && fin > mrp && (
                  <div style={{ background: primaryLt, border: `1px solid ${primary}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: primary, marginBottom: 12 }}>
                    ⚠️ Final price cannot exceed MRP
                  </div>
                )}

                <div style={actionsRow}>
                  {editVD && (
                    <>
                      <button type="button"
                        onClick={() => amendQty.mutate({ id: editVD.productVariantDetailId, qty: Number(wVD('amendmentStockQuantity') || 0) })}
                        disabled={amendQty.isPending} style={btnPrimary}>
                        {amendQty.isPending ? '…' : 'Amend Quantity'}
                      </button>
                      <button type="button"
                        onClick={() => saveVD.mutate({ ...wVD() as any, state: 'Return For Correction' })}
                        disabled={saveVD.isPending} style={btnPrimary}>
                        Return For Correction
                      </button>
                      <button type="button"
                        onClick={() => { if (window.confirm('Mark as out of stock?')) markOutOfStock.mutate(editVD.productVariantDetailId); }}
                        disabled={markOutOfStock.isPending} style={btnPrimary}>
                        {markOutOfStock.isPending ? '…' : 'Out Of Stock'}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => { setShowVDF(false); setEditVD(null); }} style={btnOut}>Cancel</button>
                  <button type="submit" disabled={saveVD.isPending || (fin > mrp && mrp > 0)} style={btnPrimary}>
                    {saveVD.isPending ? 'Saving…' : editVD ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
